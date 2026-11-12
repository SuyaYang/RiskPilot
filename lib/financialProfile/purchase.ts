import { load, type StoreData } from "../store";
import { ownedOrder, CheckoutError } from "../checkout";
import { orderReview } from "../orderReview";
import { explainReviewFacts } from "../ai";
import { formatCents } from "../spending/money";
import { profileBasis } from "./features";
import type { MethodId } from "../types";
const money = (value: number) => formatCents(Math.round(value * 100));

/** One existing assessment plus confirmed preferences; no payment commands or writes. */
export function personalizedPurchaseFacts(owner: string, body: Record<string,unknown>, data: StoreData = load()) {
  const basis = profileBasis(owner,data);
  if ((typeof body.decisionId === "string") === (typeof body.orderId === "string") || Object.keys(body).some(key => !["decisionId","orderId","method","timing"].includes(key))) throw new CheckoutError("INVALID_PROFILE", "Choose one existing purchase assessment.",400);
  let decision;
  if (typeof body.orderId === "string") {
    const order = ownedOrder(body.orderId,owner);
    if (order.status === "CAPTURED") throw new CheckoutError("ALREADY_PAID","View the saved outcome for this payment.");
    decision = orderReview(order).decision;
  } else {
    decision = data.decisions[String(body.decisionId)];
    if (!decision || decision.personaId !== owner) throw new CheckoutError("NOT_FOUND","Purchase assessment not found.",404);
  }
  if (decision.inputHash !== basis.financialHash) throw new CheckoutError("STALE_PROFILE","Your financial inputs changed. Assess or refresh the purchase first.");
  const method = body.method as MethodId, timing = body.timing ?? "now";
  const option = decision.options.find(option => option.method === method && option.eligible);
  if (!option || !["now","after_income"].includes(String(timing))) throw new CheckoutError("INVALID_SCENARIO","Choose a supported purchase scenario.",400);
  const later = decision.afterIncome;
  if (timing === "after_income" && (method !== "full" || !later?.available)) throw new CheckoutError("INVALID_SCENARIO","This future-date preview is unavailable.",400);
  const forecast = timing === "after_income" && later?.available ? later.forecast : option.forecast;
  const goalImpact = timing === "after_income" && later?.available ? later.goalImpact : option.goalImpact;
  const preference = basis.state.preferences;
  const goal = basis.financial.goals.find(goal => goal.id === basis.features.preferredGoalId);
  const impact = goal ? goalImpact.find(item => item.goalId === goal.id) : undefined;
  const context = goal && impact && preference?.focus === "goals" ? `Your confirmed preferred goal is ${goal.name}; this scenario adds ${impact.delayDays} projected days versus skipping the purchase.`
    : preference?.focus === "commitments" ? `Your confirmed focus is upcoming commitments; the current plan has ${basis.features.commitmentCount} scheduled bill/reserve occurrences in the next 45 days.`
    : preference ? `Your confirmed planning buffer preference is ${formatCents(preference.planningBufferCents)}; it is an explanation preference, not a changed forecast constraint.`
    : "No financial-profile preference has been confirmed; no personalized assumption is applied.";
  const facts = {
    confirmed_context: context,
    engine_impact: `For ${timing === "after_income" && later?.available ? `the read-only preview on ${later.purchaseDate}` : option.hypothetical ? `the hypothetical ${option.label} scenario` : option.label}, engine-projected minimum cash is ${money(forecast.minBalance)}; with income a week late it is ${money(forecast.stressMinBalance)}, against the existing ${money(basis.financial.persona.buffer)} buffer.`,
  };
  const alternative = timing === "after_income" ? "This is a read-only future-date preview. Return to current checkout before any payment."
    : decision.recommendedMethod === "wait" ? "The existing engine suggests waiting; compare the no-purchase scenario before proceeding."
    : forecast.risk !== "green" && later?.available ? `You can inspect the existing after-income comparison on ${later.purchaseDate}. Its fixed-date preview does not schedule a purchase or confirm funding.` : null;
  return { ...basis, facts, required: ["confirmed_context","engine_impact"], alternative, personalized: Boolean(preference) };
}
export async function explainProfilePurchase(owner: string, body: Record<string,unknown>) {
  const before = personalizedPurchaseFacts(owner,body);
  const explanation = before.personalized ? await explainReviewFacts(before.facts,before.required,"Explain the selected engine scenario using the confirmed planning preference. Do not change its numbers or funding assumptions.")
    : { text: before.facts.confirmed_context, source: "template" as const };
  const after = personalizedPurchaseFacts(owner,body);
  if (after.basisHash !== before.basisHash || after.state.version !== before.state.version) throw new CheckoutError("STALE_PROFILE","Profile or financial inputs changed. Refresh this explanation.");
  return { ...explanation, personalized: before.personalized, alternative: before.alternative, financialInputHash: before.financialHash, profileVersion: before.state.version, readOnly: true,
    uncertainty: "Fictional inputs. Planning preferences do not change financial calculations; PayPal funding and loan terms remain unconfirmed." };
}
