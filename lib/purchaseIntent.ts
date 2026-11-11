import crypto from "node:crypto";
import { load, update } from "./store";
import { inputHash } from "./state";
import { CheckoutError } from "./checkout";
import { ASSESSMENT_MAX_AGE_MS, validAssessmentTime } from "./smartRecheck";
import { MERCHANT_ID, merchantOrigin, signEnvelope, type MerchantPurchaseIntent } from "./merchantBridge";

/** An explicit Shop → Northstar association. Metadata only: never creates a provider order. */
export function createPurchaseIntent(owner: string, decisionId: string) {
  const data = load(), prior = data.decisions[decisionId];
  if (!prior || prior.personaId !== owner) throw new CheckoutError("NOT_FOUND","Purchase assessment not found.",404);
  if (prior.origin !== "shop" || prior.currency !== "USD" || prior.productId !== "aero-14" || prior.schemaVersion !== "rp-v1") throw new CheckoutError("UNSUPPORTED_INTENT","This product has no verified Northstar checkout association.",400);
  if (!validAssessmentTime(prior.createdAt) || prior.inputHash !== inputHash(owner,data)) throw new CheckoutError("STALE_DECISION","Refresh your Shop assessment before continuing to the merchant.");
  const intentId = crypto.randomUUID();
  const expiresAt = Math.min(Date.now()+ASSESSMENT_MAX_AGE_MS,Date.parse(prior.createdAt)+ASSESSMENT_MAX_AGE_MS);
  const payload: MerchantPurchaseIntent = { intentId, merchantId:MERCHANT_ID, productId:"northstar:aero-14", currency:"USD", expiresAt };
  const token = signEnvelope("intent",payload);
  const url = `${merchantOrigin()}/?riskpilot_intent=${encodeURIComponent(token)}`;
  update(current => {
    if (prior.inputHash !== inputHash(owner,current)) throw new CheckoutError("STALE_DECISION","Financial inputs changed. Refresh your assessment.");
    (current.reviewIntents ??= {})[intentId] = { owner, decisionId, merchantId:MERCHANT_ID, productId:payload.productId, currency:"USD", expiresAt };
  });
  return { url, expiresAt, createsPayment:false as const };
}
