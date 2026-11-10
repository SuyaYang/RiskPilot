import type { PurchaseReview } from "./orderReview";
import type { MethodId } from "./types";

export const REVIEW_QUESTIONS = {
  overview: "What should I know before paying?",
  afford: "Can I afford this purchase?",
  delay: "What if I buy it next month?",
  goals: "How does this affect my savings goals?",
  alternatives: "What alternative would be less risky?",
} as const;
export type ReviewQuestion = keyof typeof REVIEW_QUESTIONS;
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

/** Read-only, server-generated sentences. The model may select them, never change their claims. */
export function reviewFacts(review: PurchaseReview, method: MethodId, question: ReviewQuestion) {
  const option = review.decision.options.find(item => item.method === method);
  if (!option || !option.eligible) throw new Error("Unsupported forecast scenario");
  const f = option.forecast;
  const recommended = review.decision.options.find(item => item.recommended)!;
  const delays = option.goalImpact.filter(item => item.delayDays > 0);
  const facts: Record<string, string> = {
    outlook: `${option.method === "wait" ? "Without this purchase" : `For the ${option.label} scenario`}, lowest projected cash is ${money(f.minBalance)} on ${f.minBalanceDate}.`,
    buffer: f.bufferGap < 0
      ? `That is ${money(Math.abs(f.bufferGap))} below your ${money(review.buffer)} cash buffer.`
      : `That leaves ${money(f.bufferGap)} above your ${money(review.buffer)} cash buffer.`,
    stress: `If income arrives a week late, lowest projected cash is ${money(f.stressMinBalance)}${f.stressBufferGap < 0 ? ", below your buffer" : ", at or above your buffer"}.`,
    goals: delays.length ? delays.map(item => `${item.name}: ${item.delayDays} additional days versus skipping this purchase.`).join(" ") : "The engine projects no additional goal delay for this scenario.",
    alternative: recommended.method === "wait" ? "The engine suggests not buying now: none of the evaluated purchase scenarios protects the buffer in both checks."
      : `The engine's suggested ${recommended.hypothetical ? "hypothetical " : ""}scenario is ${recommended.label}. Compare its cash flow before deciding.`,
    uncertainty: "Financial inputs are fictional. PayPal funding and loan terms are unconfirmed; a forecast cannot establish payment eligibility.",
    delay: "A purchase next month has not been evaluated. Compare 'Skip this purchase' as the no-purchase baseline; it is not a delayed-payment forecast.",
    cheaper: "This checkout has no verified lower-cost merchant quote. A cheaper product would require a separate merchant order.",
  };
  const ids: Record<ReviewQuestion, string[]> = {
    overview: ["outlook", "buffer", "stress", "alternative"],
    afford: ["outlook", "buffer", "stress", "alternative"],
    delay: ["delay", "alternative"],
    goals: ["goals", "outlook"],
    alternatives: ["alternative", "cheaper"],
  };
  return { facts, required: ids[question], inputHash: review.decision.inputHash };
}
