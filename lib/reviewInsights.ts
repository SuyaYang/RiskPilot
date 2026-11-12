import type { PurchaseReview } from "./orderReview";
import type { MethodId } from "./types";

export const REVIEW_QUESTIONS = {
  overview: "What should I know before paying?",
  afford: "Can I afford this purchase?",
  delay: "What if I buy it next month?",
  income: "What if I wait until after income?",
  goals: "How does this affect my savings goals?",
  alternatives: "What alternative would be less risky?",
} as const;
export type ReviewQuestion = keyof typeof REVIEW_QUESTIONS;
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

/** Read-only, server-generated sentences. The model may select them, never change their claims. */
export function reviewFacts(review: PurchaseReview, method: MethodId, question: ReviewQuestion, timing: "now"|"after_income" = "now") {
  const current = review.decision.options.find(item => item.method === method);
  const later=review.decision.afterIncome;
  if(timing==="after_income" && (method!=="full" || !later?.available))throw new Error("After-income preview unavailable");
  const option=current && timing==="after_income" && later?.available ? {...current,label:`buying on ${later.purchaseDate}`,forecast:later.forecast,goalImpact:later.goalImpact} : current;
  if (!option || !option.eligible) throw new Error("Unsupported forecast scenario");
  const f = option.forecast;
  const recommended = review.decision.options.find(item => item.recommended);
  const delays = option.goalImpact.filter(item => item.delayDays > 0);
  const facts: Record<string, string> = {
    checkout_summary: timing === "after_income"
      ? "This fixed-date preview cannot schedule payment; late income can still reduce your cash buffer."
      : option.method === "wait" ? "Skipping this purchase adds no payment obligation; your existing bills and goals remain in the forecast."
      : f.stressBufferGap < 0 ? `This purchase leaves less than your protected buffer in ${f.bufferGap < 0 ? "the current and late-income forecasts" : "the late-income forecast"}; compare waiting before confirming.`
      : `The selected ${option.hypothetical ? "hypothetical " : ""}scenario protects the buffer in both engine checks; payment funding and terms still require PayPal confirmation.`,
    outlook: `${option.method === "wait" ? "Without this purchase" : `For the ${option.label} scenario`}, lowest projected cash is ${money(f.minBalance)} on ${f.minBalanceDate}.`,
    buffer: f.bufferGap < 0
      ? `That is ${money(Math.abs(f.bufferGap))} below your ${money(review.buffer)} cash buffer.`
      : `That leaves ${money(f.bufferGap)} above your ${money(review.buffer)} cash buffer.`,
    stress: `If income arrives a week late, lowest projected cash is ${money(f.stressMinBalance)}${f.stressBufferGap < 0 ? ", below your buffer" : ", at or above your buffer"}.`,
    goals: delays.length ? delays.map(item => `${item.name}: ${item.delayDays} additional days versus skipping this purchase.`).join(" ") : "The engine projects no additional goal delay for this scenario.",
    alternative: !recommended ? "Review the current cash and buffer warnings before confirming; payment funding remains unconfirmed." : recommended.method === "wait" ? "The engine suggests not buying now: none of the evaluated purchase scenarios protects the buffer in both checks."
      : `The engine's suggested ${recommended.hypothetical ? "hypothetical " : ""}scenario is ${recommended.label}. Compare its cash flow before deciding.`,
    uncertainty: "Financial inputs are fictional. PayPal funding and loan terms are unconfirmed; a forecast cannot establish payment eligibility.",
    delay: "A purchase next month has not been evaluated. Compare 'Skip this purchase' as the no-purchase baseline; it is not a delayed-payment forecast.",
    income: later?.available ? `For a full-price purchase on ${later.purchaseDate}, one day after expected ${later.income.name} on ${later.income.date}, lowest projected cash is ${money(later.forecast.minBalance)}; risk ${later.forecast.risk}. If income arrives one week late with the purchase date unchanged, lowest cash is ${money(later.forecast.stressMinBalance)}. This is a read-only preview, not a scheduled payment.` : `The after-income scenario is unavailable: ${later && !later.available?later.reason:"refresh this assessment to calculate it"}`,
    incomeGoals: later?.available ? later.allocation.goals.map(goal=>`${goal.name}: predicted completion ${goal.eta||"not projected"}; status ${goal.status}.`).join(" ") || "No goals to compare." : "No after-income goal dates are available.",
    cheaper: "This checkout has no verified lower-cost merchant quote. A cheaper product would require a separate merchant order.",
  };
  if(timing==="after_income") facts.alternative="This view is a future-date preview. Return to the current checkout before paying; current payment-method recommendations do not schedule this purchase.";
  const ids: Record<ReviewQuestion, string[]> = {
    overview: ["outlook", "buffer", "stress", "alternative"],
    afford: ["outlook", "buffer", "stress", "alternative"],
    delay: ["delay", "alternative"],
    income: ["income", "incomeGoals"],
    goals: ["goals", "outlook"],
    alternatives: ["alternative", "cheaper"],
  };
  return { facts, required: ids[question], inputHash: review.decision.inputHash };
}
