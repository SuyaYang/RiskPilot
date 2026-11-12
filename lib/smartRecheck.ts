import { getProduct } from "./catalog";
import type { Decision, ForecastResult, OptionResult } from "./types";
import type { OrderRecord, StoreData } from "./store";

export const ASSESSMENT_MAX_AGE_MS = 30 * 60_000;
export function validAssessmentTime(createdAt: string, now = Date.now()) {
  const time = Date.parse(createdAt);
  return Number.isFinite(time) && time <= now && now - time <= ASSESSMENT_MAX_AGE_MS;
}
export type Recheck = {
  status: "unchanged" | "changed" | "unavailable";
  reason: string;
  currentAmountCents: number;
  previousAmountCents?: number;
  reviewedAt?: string;
  comparison: "full_price";
  checks: { id: string; label: string; changed: boolean; detail: string }[];
};
const cents = (value: number) => Math.round(value * 100);
const money = (value: number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(value);
const forecastKey = (f: ForecastResult) => JSON.stringify({ risk:f.risk, min:cents(f.minBalance), stress:cents(f.stressMinBalance), daily:f.dailyBalances.map(day=>[day.date,cents(day.balance)]) });
const goalKey = (o: OptionResult) => JSON.stringify({ impact:o.goalImpact.map(g=>({goalId:g.goalId,delayDays:g.delayDays})).sort((a,b)=>a.goalId.localeCompare(b.goalId)), plan:o.goalPlan?.goals.map(g=>({ id:g.goalId, eta:g.eta, status:g.status, delay:g.delayDays, allocated:cents(g.allocatedThisMonth) })).sort((a,b)=>a.id.localeCompare(b.id)) });

/** Read-only comparison of a trusted prior server assessment with a freshly recomputed engine result. */
export function smartRecheck(order: OrderRecord, current: Decision, buffer: number, data: StoreData, now = Date.now()): Recheck {
  const unavailable = (reason: string): Recheck => ({ status:"unavailable", reason, currentAmountCents:cents(order.amount), comparison:"full_price", checks:[] });
  if (order.status !== "CREATED" || ["STARTED","UNKNOWN"].includes(order.captureCommand || "")) return unavailable("Payment status needs confirmation or recovery. Showing the current full review.");
  const priorId = order.merchant ? order.priorAssessmentId : order.decisionId;
  const prior = priorId ? data.decisions[priorId] : undefined;
  if (!prior || prior.origin !== "shop") return unavailable("No verified prior Shop assessment is associated with this checkout. Showing a fresh full review.");
  if (prior.personaId !== order.personaId || current.personaId !== order.personaId) return unavailable("Prior assessment ownership cannot be verified. Showing a fresh full review.");
  if (order.currency !== "USD" || prior.currency !== order.currency) return unavailable("Prior purchase currency cannot be verified. Showing a fresh full review.");
  if (!validAssessmentTime(prior.createdAt,now) || prior.schemaVersion !== current.schemaVersion) return unavailable("The prior assessment expired or its policy version is unavailable. Showing a fresh full review.");
  let previous: OptionResult | undefined;
  if (order.merchant) {
    const intent = order.reviewIntentId ? data.reviewIntents?.[order.reviewIntentId] : undefined;
    if (!intent || intent.owner !== order.personaId || intent.decisionId !== prior.id || intent.merchantId !== order.merchant.id || intent.productId !== order.productId || intent.currency !== order.currency || intent.expiresAt <= now || prior.productId !== "aero-14" || order.productId !== "northstar:aero-14") return unavailable("No valid server-bound merchant purchase intent is available. Showing a fresh full review.");
    previous = prior.options.find(option=>option.method === "full");
  } else {
    const productId = order.method === "cheaper" ? getProduct(prior.productId)?.alternativeId : prior.productId;
    if (productId !== order.productId) return unavailable("The prior assessment is for a different purchase. Showing a fresh full review.");
    previous = prior.options.find(option=>option.method === (order.method === "cheaper" ? "cheaper" : "full"));
  }
  const latest = current.options.find(option=>option.method === "full");
  if (!/^[a-f0-9]{64}$/.test(prior.inputHash) || !previous || !latest || !Number.isFinite(previous.price) || previous.price <= 0 || !Number.isFinite(order.amount) || order.amount <= 0 || ![previous.forecast.minBalance,previous.forecast.stressMinBalance,previous.forecast.bufferGap,previous.forecast.stressBufferGap].every(Number.isFinite)) return unavailable("A reliable prior amount/forecast comparison is unavailable. Showing a fresh full review.");
  const oldBuffer = previous.forecast.minBalance - previous.forecast.bufferGap;
  const amountChanged = cents(previous.price) !== cents(order.amount);
  const inputsChanged = prior.inputHash !== current.inputHash;
  const forecastChanged = forecastKey(previous.forecast) !== forecastKey(latest.forecast);
  const goalsChanged = goalKey(previous) !== goalKey(latest);
  const bufferChanged = cents(oldBuffer) !== cents(buffer) || cents(previous.forecast.bufferGap) !== cents(latest.forecast.bufferGap) || cents(previous.forecast.stressBufferGap) !== cents(latest.forecast.stressBufferGap);
  const riskChanged = previous.forecast.risk !== latest.forecast.risk;
  const checks: Recheck["checks"] = [
    { id:"amount", label:"Purchase amount", changed:amountChanged, detail:amountChanged ? `${money(previous.price)} → ${money(order.amount)}` : `${money(order.amount)} · unchanged` },
    { id:"inputs", label:"Financial inputs", changed:inputsChanged, detail:inputsChanged ? "Changed · engine assessment refreshed" : "Same verified financial snapshot" },
    { id:"forecast", label:"Cash-flow forecast", changed:forecastChanged, detail:forecastChanged ? `Minimum ${money(previous.forecast.minBalance)} → ${money(latest.forecast.minBalance)}; late-income ${money(previous.forecast.stressMinBalance)} → ${money(latest.forecast.stressMinBalance)}` : "Current and late-income projections unchanged" },
    { id:"goals", label:"Savings goals", changed:goalsChanged, detail:goalsChanged ? "Projected goal delays or allocations changed" : "Goal impact unchanged" },
    { id:"buffer", label:"Cash-buffer impact", changed:bufferChanged, detail:bufferChanged ? `Headroom ${money(previous.forecast.bufferGap)} → ${money(latest.forecast.bufferGap)}; protected buffer ${money(buffer)}` : `Protected buffer ${money(buffer)} · impact unchanged` },
    { id:"risk", label:"Engine risk conclusion", changed:riskChanged, detail:riskChanged ? `${previous.forecast.risk} → ${latest.forecast.risk}` : `${latest.forecast.risk} · unchanged` },
  ];
  const changed = checks.some(check=>check.changed);
  return { status:changed ? "changed" : "unchanged", reason:changed ? "Important changes detected. Review the refreshed engine assessment before confirming." : "No material changes. Your prior assessment was verified against this checkout and the latest engine calculation.", currentAmountCents:cents(order.amount), previousAmountCents:cents(previous.price), reviewedAt:prior.createdAt, comparison:"full_price", checks };
}
