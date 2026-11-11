import { explainReviewFacts } from "../ai";
import { CheckoutError, demoEnabled } from "../checkout";
import { snapshot } from "../state";
import { load, type StoreData } from "../store";
import { spendingView } from "../spending/service";
import { formatCents } from "../spending/money";
import { scheduledItems } from "../presentation";
import { moneyPlanView } from "./incomeService";
import { previewBudget } from "./preview";

export const MONEY_TOPICS = ["spending", "income", "obligations", "capacity", "budget_change"] as const;
export type MoneyTopic = typeof MONEY_TOPICS[number];
export type MoneyEvidence = { text: string; source: string; period: string; kind: "historical" | "expected" | "predicted" | "illustrative" | "limitation" };

export function moneyInsightEvidence(owner: string, topic: MoneyTopic, previewInput?: unknown, data: StoreData = load()) {
  const financial = snapshot(owner, data), plan = moneyPlanView(owner, data);
  const history = spendingView(owner, data).analysis;
  const period = `${plan.period.start}–${plan.period.end}`, financialPeriod = `${financial.asOf}–${financial.forecast.evaluatedThrough}`;
  const evidence: Record<string, MoneyEvidence> = {};
  const add = (id: string, text: string, source: string, period: string, kind: MoneyEvidence["kind"]) => { evidence[id] = { text, source, period, kind }; };
  if (topic === "spending") {
    add("history", history.averageMonthlyCents === null ? "There is insufficient complete-month spending history to infer a monthly pattern." : `Net spending averaged ${formatCents(history.averageMonthlyCents)} across ${history.averageMonthCount} complete observed months; the current partial month is excluded.`, "Existing simulated spending aggregates; no bank connected", `${history.coverage.start}–${history.coverage.end}`, "historical");
    const top = history.categories.filter(row => row.averageMonthlyCents !== null).sort((a, b) => b.averageMonthlyCents! - a.averageMonthlyCents!).slice(0, 2);
    add("categories", top.length ? `Largest observed category averages: ${top.map(row => `${row.category} ${formatCents(row.averageMonthlyCents!)}`).join("; ")}. These are historical patterns, not predicted transactions.` : "No supported category average is available.", "Refund- and duplicate-adjusted simulated history", `${history.coverage.start}–${history.coverage.end}`, "historical");
    add("boundary", "Category budgets remain planning only because complete coverage of the everyday-spending baseline cannot be verified; they are not added to scheduled bills.", "Verified mapping policy", financialPeriod, "limitation");
  } else if (topic === "income") {
    const incoming = plan.events.filter(event => event.direction === "in").slice(0, 2);
    add("timing", incoming.length ? `Next displayed expectations: ${incoming.map(event => `${event.name}, ${formatCents(event.amountCents)} on ${event.date}${event.included ? "" : " (excluded from expected totals)"}`).join("; ")}. Receipt is not guaranteed.` : "No expected income date is available in the displayed planning period.", "Existing modeled schedules and user-entered income plans", period, "expected");
    add("mapping", `${plan.entries.filter(row => row.forecastIntegration.status === "included").length} planning income schedules are included in the 45-day forecast through explicit source mappings. Other entries can remain informational.`, "Current confirmed mapping state", financialPeriod, "expected");
    add("boundary", "New monthly and quarterly income follows calendar dates; biweekly means 14 days. Expected income is not cash available today, and planning receipts are excluded from stress and long-term goal funding.", "Calendar scheduler and conservative forecast policy", period, "limitation");
  } else if (topic === "obligations") {
    const commitments = scheduledItems(financial.persona.recurring, financial.upcomingPayments, financial.asOf);
    add("commitments", commitments.length ? `Next scheduled obligations: ${commitments.slice(0, 2).map(item => `${item.label}, ${formatCents(Math.round(item.amount * 100))} on ${item.date} (${item.source})`).join("; ")}.` : "No scheduled bill or future purchase reserve is available in the 45-day window.", "Existing modeled bills and recorded purchase reserves", financialPeriod, "expected");
    add("everyday", "The existing everyday-spending assumption remains active separately from scheduled bills. Category budgets are not layered on top of it.", "Current deterministic engine inputs", financialPeriod, "predicted");
    add("boundary", "Scheduled expectations and verified purchase reserves differ from observed bank debits. No bank feed or automatic debit reconciliation is connected.", "Current data-source boundary", financialPeriod, "limitation");
  } else if (topic === "capacity") {
    add("buffer", `Lowest projected cash is ${formatCents(Math.round(financial.forecast.minBalance * 100))}, compared with a ${formatCents(Math.round(financial.persona.buffer * 100))} buffer. The stress minimum is ${formatCents(Math.round(financial.forecast.stressMinBalance * 100))}.`, "Authoritative deterministic forecast", financialPeriod, "predicted");
    const held = financial.investable.checks.filter(check => !check.ok).map(check => check.label);
    add("capacity", `Available to allocate is ${formatCents(Math.round(financial.investable.investable * 100))}, after protecting ${formatCents(Math.round(financial.investable.reservedForGoals * 100))} for spending goals.${held.length ? ` Checks on hold: ${held.join("; ")}.` : " A passing check does not remove current-cash and goal-reserve limits."}`, "Existing allocation engine and readiness checks", financialPeriod, "predicted");
    add("boundary", "Planning receipts are omitted from stress, and capacity is capped by the same engine without those receipts. A smaller informational budget cannot create investable cash.", "Conservative planning integration policy", financialPeriod, "limitation");
  } else {
    const preview = previewBudget(owner, previewInput, data);
    add("change", preview.monthlyDifferenceCents === null ? `${preview.category}: the adjusted budget is ${formatCents(preview.adjustedMonthlyCents)} per month; no supported original amount exists for a difference.` : `${preview.category}: the ${preview.originalSource === "user_confirmed" ? "confirmed" : "suggested"} monthly amount ${formatCents(preview.originalMonthlyCents!)} is compared with ${formatCents(preview.adjustedMonthlyCents)}. Adjusted minus original is ${formatCents(preview.monthlyDifferenceCents)} per month.`, "Current category proposal/confirmation and user-entered preview", period, "illustrative");
    add("boundary", "This is an illustrative budget change, not guaranteed savings. Baseline category coverage and bill overlap are unresolved, so the authoritative forecast remains unchanged.", "Verified replacement-coverage audit", financialPeriod, "limitation");
    add("capacity", `The unchanged authoritative amount available to allocate is ${formatCents(preview.forecast.availableToAllocateCents)}; this preview changes it by ${formatCents(0)}. Confirmation saves a planning budget only.`, "Existing forecast and allocation engine", financialPeriod, "predicted");
  }
  return { evidence, insightBasis: plan.insightBasis };
}

export async function explainMoneyPlan(owner: string, body: unknown) {
  if (!demoEnabled()) throw new CheckoutError("DEMO_DISABLED", "Demo planning is disabled", 404);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CheckoutError("INVALID_INSIGHT", "Invalid explanation request", 400);
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !["topic", "insightBasis", "preview"].includes(key)) || !MONEY_TOPICS.includes(input.topic as MoneyTopic) || typeof input.insightBasis !== "string" || (input.topic !== "budget_change" && Object.hasOwn(input, "preview"))) throw new CheckoutError("INVALID_INSIGHT", "Choose an available Money explanation and current evidence", 400);
  const before = moneyInsightEvidence(owner, input.topic as MoneyTopic, input.preview);
  if (before.insightBasis !== input.insightBasis) throw new CheckoutError("STALE_INSIGHT", "Planning evidence changed. Refresh before requesting an explanation.", 409);
  const required = Object.keys(before.evidence);
  const result = await explainReviewFacts(Object.fromEntries(required.map(id => [id, before.evidence[id].text])), required,
    JSON.stringify({ context: "Money planning explanation; no payment or account action", topic: input.topic, evidence: before.evidence }), 5000);
  const after = moneyPlanView(owner);
  if (after.insightBasis !== before.insightBasis) throw new CheckoutError("STALE_INSIGHT", "Planning evidence changed while the explanation was prepared. Refresh before retrying.", 409);
  return { ...result, evidence: before.evidence, insightBasis: before.insightBasis, topic: input.topic, readOnly: true };
}
export type MoneyExplanation = Awaited<ReturnType<typeof explainMoneyPlan>>;
