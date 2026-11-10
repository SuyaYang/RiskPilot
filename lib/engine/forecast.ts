import type { ForecastResult, Payment, Persona, RecurringItem } from "../types";
import { addDays, iso, parseIso, today, daysBetween } from "../dates";

export const HORIZON_DAYS = 45;
export const STRESS_DELAY_DAYS = 7;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Dates (day offsets from today) on which a recurring item occurs within [0, horizon). */
export function occurrences(item: RecurringItem, horizon = HORIZON_DAYS, shiftIncome = 0): number[] {
  const step = item.frequency === "biweekly" ? 14 : 30;
  const shift = item.direction === "in" ? shiftIncome : 0;
  const out: number[] = [];
  for (let d = item.firstInDays + shift; d < horizon; d += step) if (d >= 0) out.push(d);
  return out;
}

/** Monthly-equivalent net of recurring items minus everyday spending. */
export function monthlySurplus(p: Persona): number {
  let net = 0;
  for (const r of p.recurring) {
    const perMonth = r.frequency === "biweekly" ? (r.amount * 26) / 12 : r.amount;
    net += r.direction === "in" ? perMonth : -perMonth;
  }
  net -= p.dailySpend * 30.4;
  return round2(net);
}

/**
 * Starting balance: checking balance minus payments that already happened (date <= today)
 * for purchases made through the app. Future payments become scheduled outflows.
 */
export function startingBalance(p: Persona, existing: Payment[]): number {
  const t = today();
  const paid = existing.filter((x) => daysBetween(t, parseIso(x.date)) <= 0).reduce((s, x) => s + x.amount, 0);
  return round2(p.checkingBalance - paid);
}

function simulate(p: Persona, existing: Payment[], extra: Payment[], shiftIncome: number) {
  const t = today();
  const start = startingBalance(p, existing);
  const deltas = new Array(HORIZON_DAYS).fill(0);
  for (const r of p.recurring) {
    for (const d of occurrences(r, HORIZON_DAYS, shiftIncome)) deltas[d] += r.direction === "in" ? r.amount : -r.amount;
  }
  for (let d = 0; d < HORIZON_DAYS; d++) deltas[d] -= p.dailySpend;
  // existing future payments (already-paid ones are in the starting balance)
  for (const x of existing) {
    const d = daysBetween(t, parseIso(x.date));
    if (d > 0 && d < HORIZON_DAYS) deltas[d] -= x.amount;
  }
  // candidate purchase payments, including today's
  for (const x of extra) {
    const d = daysBetween(t, parseIso(x.date));
    if (d >= 0 && d < HORIZON_DAYS) deltas[d] -= x.amount;
  }
  const daily: { date: string; balance: number }[] = [];
  let bal = start;
  for (let d = 0; d < HORIZON_DAYS; d++) {
    bal += deltas[d];
    daily.push({ date: iso(addDays(t, d)), balance: round2(bal) });
  }
  return { start, daily };
}

export function forecast(p: Persona, existing: Payment[] = [], extra: Payment[] = []): ForecastResult {
  const normal = simulate(p, existing, extra, 0);
  const stress = simulate(p, existing, extra, STRESS_DELAY_DAYS);
  const minOf = (arr: { date: string; balance: number }[]) =>
    arr.reduce((m, x) => (x.balance < m.balance ? x : m), arr[0]);
  const min = minOf(normal.daily);
  const sMin = minOf(stress.daily);
  const gap = round2(min.balance - p.buffer);
  const sGap = round2(sMin.balance - p.buffer);
  const risk = gap < 0 ? "red" : sGap < 0 ? "yellow" : "green";
  return {
    startBalance: normal.start,
    dailyBalances: normal.daily,
    minBalance: min.balance,
    minBalanceDate: min.date,
    bufferGap: gap,
    stressMinBalance: sMin.balance,
    stressBufferGap: sGap,
    risk,
  };
}
