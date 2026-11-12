import type { Allocation, Goal, GoalStatus, Payment, Persona } from "../types";
import { addDays, daysBetween, iso, monthsBetween, parseIso, today } from "../dates";
import { forecast, monthlySurplus } from "./forecast";

const MONTH_DAYS = 30.4;
const MAX_MONTHS = 48;
const round2 = (n: number) => Math.round(n * 100) / 100;

function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => a.priority - b.priority || a.targetDate.localeCompare(b.targetDate));
}

/**
 * Month-by-month funding simulation. Each month the monthly surplus, minus any purchase payments
 * falling in that month (residual obligations after cash funding via projectGoals), is allocated
 * to goals by priority then deadline, each up to the amount it needs per month; anything left accelerates the same goals in order. A shortfall (including
 * restoring the cash buffer) carries forward and must be repaid before goals get money again.
 */
export function allocateGoals(
  p: Persona,
  goals: Goal[],
  futurePayments: Payment[] = [],
  bufferDeficit = 0,
  cashBufferDeficit = Math.max(0, -forecast(p).bufferGap),
): Allocation {
  const t = today();
  const surplus = monthlySurplus(p);
  const outByMonth = new Array(MAX_MONTHS).fill(0);
  for (const x of futurePayments) {
    const d = daysBetween(t, parseIso(x.date));
    if (d < 0) continue;
    const m = Math.min(MAX_MONTHS - 1, Math.floor(d / MONTH_DAYS));
    outByMonth[m] += x.amount;
  }
  // The scheduled purchase and its resulting buffer shortfall overlap. Protect the larger
  // requirement, not their sum; any independent pre-existing deficit remains protected.
  const scheduledCost = outByMonth.reduce((sum, value) => sum + value, 0);
  const independentBufferDeficit = Math.max(cashBufferDeficit, bufferDeficit - scheduledCost);
  const active = sortGoals(goals.filter((g) => !g.paused));
  const remaining = new Map(active.map((g) => [g.id, Math.max(0, g.targetAmount - g.savedSoFar)]));
  const required = new Map(
    active.map((g) => {
      // whole months left, so a goal funded at this rate completes by its target date
      const months = Math.max(1, Math.floor(monthsBetween(t, parseIso(g.targetDate))));
      return [g.id, round2((remaining.get(g.id) ?? 0) / months)];
    }),
  );
  const firstMonth = new Map<string, number>();
  const doneMonth = new Map<string, number>();
  let carry = 0;
  for (let m = 0; m < MAX_MONTHS; m++) {
    let avail = surplus - outByMonth[m] - (m === 0 ? independentBufferDeficit : 0) + carry;
    if (avail < 0) {
      carry = avail;
      avail = 0;
    } else carry = 0;
    const give = (g: Goal, cap: number) => {
      const r = remaining.get(g.id) ?? 0;
      const amt = Math.min(r, cap, avail);
      if (amt <= 0) return;
      avail -= amt;
      remaining.set(g.id, r - amt);
      if (m === 0) firstMonth.set(g.id, (firstMonth.get(g.id) ?? 0) + amt);
      if (r - amt <= 0.005 && !doneMonth.has(g.id)) doneMonth.set(g.id, m);
    };
    for (const g of active) give(g, required.get(g.id) ?? 0);
    for (const g of active) give(g, Infinity);
    if ([...remaining.values()].every((r) => r <= 0.005)) break;
  }

  const statuses: GoalStatus[] = sortGoals(goals).map((g) => {
    const rem = Math.max(0, g.targetAmount - g.savedSoFar);
    if (g.paused) {
      return base(g, rem, 0, 0, null, "paused", 0);
    }
    if (rem <= 0) return base(g, 0, 0, 0, iso(t), "done", 0);
    const dm = doneMonth.get(g.id);
    const eta = dm === undefined ? null : iso(addDays(t, Math.round((dm + 1) * MONTH_DAYS)));
    const delay = eta === null ? 9999 : Math.max(0, daysBetween(parseIso(g.targetDate), parseIso(eta)));
    return base(g, rem, required.get(g.id) ?? 0, round2(firstMonth.get(g.id) ?? 0), eta, delay > 0 ? "delayed" : "on_track", delay);
  });
  return { monthlySurplus: surplus, goals: statuses };
}

/** One economic view for authoritative reserves and hypothetical schedules. On/before-today
 * outflows reduce starting cash once; later outflows consume safe cash headroom first, then
 * future contribution buckets.
 * The remaining cash-buffer deficit is protected by the existing allocator, not added as a bill.
 * This creates no reserve and never edits goal balances or schedules.
 */
export function projectGoals(p: Persona, goals: Goal[], existing: Payment[] = [], candidate: Payment[] = []) {
  const payments = [...existing, ...candidate];
  const asOf = iso(today());
  const paid = payments.filter(payment => payment.date <= asOf);
  const scheduled = payments.filter(payment => payment.date > asOf)
    .sort((a, b) => a.date.localeCompare(b.date));
  const projected = forecast(p, payments);
  // A zero-value horizon marker evaluates the no-future-payment baseline through the SAME
  // final installment as the purchase forecast, without deducting that installment twice.
  const horizon = scheduled.length ? [{ ...scheduled[scheduled.length - 1], amount: 0 }] : [];
  const cash = forecast(p, paid, horizon);
  const cashDeficit = Math.max(0, -cash.bufferGap);
  // Headroom is existing cash, not permission to spend new planned receipts or a raise.
  // Taking the smaller baseline also preserves supported lower-income replacements.
  const { planning: _planning, ...established } = p;
  const conservative = forecast({ ...established,
    recurring: established.recurring.filter(item => item.direction !== "in" || !item.uncertain),
  }, paid, horizon);
  let headroom = Math.max(0, Math.min(cash.bufferGap, conservative.bufferGap, cash.startBalance - p.buffer));
  const future = scheduled.flatMap(payment => {
    const used = Math.min(headroom, payment.amount);
    headroom = round2(headroom - used);
    const residual = round2(payment.amount - used);
    return residual > 0 ? [{ ...payment, amount: residual }] : [];
  });
  const allocation = allocateGoals(p, goals, future, Math.max(0, -projected.bufferGap), cashDeficit);
  return { forecast: projected, allocation };
}

function base(
  g: Goal,
  remaining: number,
  requiredMonthly: number,
  allocatedThisMonth: number,
  eta: string | null,
  status: GoalStatus["status"],
  delayDays: number,
): GoalStatus {
  return {
    goalId: g.id,
    name: g.name,
    type: g.type,
    priority: g.priority,
    remaining: round2(remaining),
    requiredMonthly,
    allocatedThisMonth,
    eta,
    targetDate: g.targetDate,
    status,
    delayDays,
  };
}

/** Extra delay (days) each goal suffers in `withOption` compared with `baseline`. */
export function goalImpact(baseline: Allocation, withOption: Allocation) {
  return withOption.goals.map((g) => {
    const b = baseline.goals.find((x) => x.goalId === g.goalId);
    const etaDays = (s: string | null) => (s === null ? MAX_MONTHS * MONTH_DAYS : daysBetween(today(), parseIso(s)));
    const delayDays = b ? Math.max(0, Math.round(etaDays(g.eta) - etaDays(b.eta))) : 0;
    return { goalId: g.goalId, name: g.name, delayDays };
  });
}
