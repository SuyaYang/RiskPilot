import type { Allocation, Goal, MethodId, OptionResult, Payment, Persona, PurchaseTiming } from "../types";
import type { Product } from "../catalog";
import { purchaseAfterIncome } from "./purchaseTiming";
import { addDays, iso, today } from "../dates";
import { forecast } from "./forecast";
import { allocateGoals, goalImpact } from "./goals";

// PayPal US Pay Later ranges (paypal.com/payin4/faq). Final terms are decided by PayPal at checkout.
export const PAY_IN_4 = { min: 10, max: 2000 };
export const PAY_MONTHLY = { min: 49, max: 10000, months: 12, assumedApr: 0.1999, aprRange: [0, 0.3599] as const };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function schedule(method: MethodId, price: number): { payments: Payment[]; extraCost: number } {
  const t = today();
  const on = (d: number) => iso(addDays(t, d));
  if (method === "full" || method === "cheaper") {
    return { payments: [{ date: on(0), amount: price, label: "Paid in full" }], extraCost: 0 };
  }
  if (method === "pay_in_4") {
    const part = Math.floor((price / 4) * 100) / 100;
    const last = round2(price - part * 3);
    const payments = [0, 14, 28, 42].map((d, i) => ({
      date: on(d),
      amount: i === 3 ? last : part,
      label: `Pay in 4 · payment ${i + 1} of 4`,
    }));
    return { payments, extraCost: 0 };
  }
  if (method === "pay_monthly") {
    const r = PAY_MONTHLY.assumedApr / 12;
    const n = PAY_MONTHLY.months;
    const pmt = round2((price * r) / (1 - Math.pow(1 + r, -n)));
    const payments = Array.from({ length: n }, (_, i) => ({
      date: on(30 * (i + 1)),
      amount: pmt,
      label: `Pay Monthly · payment ${i + 1} of ${n} (estimate)`,
    }));
    return { payments, extraCost: round2(pmt * n - price) };
  }
  return { payments: [], extraCost: 0 };
}

const LABELS: Record<MethodId, string> = {
  full: "Pay in full",
  pay_in_4: "PayPal Pay in 4",
  pay_monthly: "PayPal Pay Monthly (12 mo, estimate)",
  cheaper: "Choose a cheaper model",
  wait: "Don't buy now",
};

export function buildOptions(
  p: Persona,
  goals: Goal[],
  existing: Payment[],
  product: Product,
  alternative?: Product,
): { baselineAlloc: Allocation; options: OptionResult[]; recommended: MethodId; afterIncome: PurchaseTiming } {
  const t = today();
  // Payments on or before today already reduce forecast.startBalance. Do not allocate them twice.
  const futureExisting = existing.filter((x) => x.date > iso(t));
  const baseF = forecast(p, existing);
  const cashDeficit = Math.max(0, -forecast(p, existing.filter(x => x.date <= iso(t))).bufferGap);
  const baselineAlloc = allocateGoals(p, goals, futureExisting, Math.max(0, -baseF.bufferGap), cashDeficit);

  const methods: MethodId[] = ["full", "pay_in_4", "pay_monthly"];
  if (alternative) methods.push("cheaper");
  methods.push("wait");

  const options: OptionResult[] = methods.map((method) => {
    const prod = method === "cheaper" && alternative ? alternative : product;
    let eligible = true;
    let ineligibleReason: string | undefined;
    if (method === "pay_in_4" && (prod.price < PAY_IN_4.min || prod.price > PAY_IN_4.max)) {
      eligible = false;
      ineligibleReason = `Pay in 4 covers $${PAY_IN_4.min}–$${PAY_IN_4.max} purchases`;
    }
    if (method === "pay_monthly" && (prod.price < PAY_MONTHLY.min || prod.price > PAY_MONTHLY.max)) {
      eligible = false;
      ineligibleReason = `Pay Monthly covers $${PAY_MONTHLY.min}–$${PAY_MONTHLY.max} purchases`;
    }
    const { payments, extraCost } = method === "wait" ? { payments: [], extraCost: 0 } : schedule(method, prod.price);
    const f = method === "wait" ? baseF : forecast(p, existing, payments);
    const alloc = allocateGoals(p, goals, [...futureExisting, ...payments], Math.max(0, -f.bufferGap), cashDeficit);
    const reasons: string[] = [];
    if (f.bufferGap < 0) reasons.push("A payment would push your balance below your cash buffer");
    else if (f.stressBufferGap < 0) reasons.push("If income arrives a week late, you would dip below your buffer");
    if (method === "pay_monthly") reasons.push("Adds interest; the APR is set by PayPal at checkout");
    return {
      method,
      label: LABELS[method],
      productName: method === "wait" ? product.name : prod.name,
      price: method === "wait" ? 0 : prod.price,
      eligible,
      ineligibleReason,
      payments,
      extraCost,
      forecast: f,
      goalPlan: alloc,
      goalImpact: goalImpact(baselineAlloc, alloc),
      responsible: { ok: eligible && f.bufferGap >= 0, reasons },
      recommended: false,
      hypothetical: method === "pay_in_4" || method === "pay_monthly",
    };
  });

  // Recommendation rules (deterministic):
  // 1) only buying options that are eligible and green; 2) lowest extra cost first;
  // 3) then the simplest plan: paying in full is preferred, so installments are never pushed on
  //    someone who can comfortably pay now; 4) if nothing is green, recommend waiting.
  const rank: Record<MethodId, number> = { full: 0, pay_in_4: 1, cheaper: 2, pay_monthly: 3, wait: 4 };
  const green = options.filter((o) => o.method !== "wait" && o.eligible && o.forecast.risk === "green");
  green.sort(
    (a, b) =>
      a.extraCost - b.extraCost ||
      rank[a.method] - rank[b.method] ||
      b.forecast.stressMinBalance - a.forecast.stressMinBalance,
  );
  const recommended: MethodId = green[0]?.method ?? "wait";
  for (const o of options) o.recommended = o.method === recommended;
  return { baselineAlloc, options, recommended, afterIncome:purchaseAfterIncome(p,goals,existing,product.price,baselineAlloc) };
}
