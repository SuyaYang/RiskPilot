import crypto from "node:crypto";
import { MERCHANT_ID, callMerchant, merchantOrigin, readMerchantTicket, type MerchantCaller, type MerchantQuote } from "./merchantBridge";
import { load, update, type OrderRecord } from "./store";
import { inputHash, personaWithState } from "./state";
import { ownedOrder, CheckoutError } from "./checkout";
import { buildOptions } from "./engine/options";
import { forecast } from "./engine/forecast";
import { recordCapture } from "./purchases";

function validQuote(quote: MerchantQuote, order?: OrderRecord) {
  if (quote.merchantId !== MERCHANT_ID || quote.currency !== "USD" || !Number.isFinite(quote.amount) || quote.amount <= 0 || quote.amount > 100_000 || Math.abs(Math.round(quote.amount * 100) - quote.amount * 100) > 1e-6 ||
      typeof quote.productName !== "string" || quote.productName.length > 200 || typeof quote.productId !== "string" || quote.productId.length > 100 ||
      (order && (quote.amount !== order.amount || quote.productId !== order.productId || quote.orderId !== order.orderId || quote.checkoutId !== order.merchant?.checkoutId))) {
    throw new CheckoutError("MERCHANT_MISMATCH", "The merchant quote does not match this purchase.");
  }
}
export async function inspectMerchantCheckout(order: OrderRecord, caller: MerchantCaller = callMerchant) {
  if (!order.merchant) throw new CheckoutError("NOT_FOUND", "Not a merchant checkout", 404);
  const quote = await caller("inspect", { merchantId: order.merchant.id, checkoutId: order.merchant.checkoutId, orderId: order.orderId });
  validQuote(quote, order);
  if (quote.capture && (quote.capture.currency !== order.currency || !Number.isFinite(quote.capture.amount) || Math.round(quote.capture.amount * 100) !== Math.round(order.amount * 100))) throw new CheckoutError("MERCHANT_MISMATCH", "Merchant capture does not match this purchase");
  return { status: quote.status, capture: quote.capture ?? null };
}
export async function claimMerchantCheckout(owner: string, ticket: string, caller: MerchantCaller = callMerchant) {
  let ref;
  try { ref = readMerchantTicket(ticket); }
  catch (error) { throw new CheckoutError("INVALID_MERCHANT_LINK", (error as Error).message, 400); }
  const quote = await caller("inspect", ref); validQuote(quote);
  if (quote.orderId !== ref.orderId || quote.checkoutId !== ref.checkoutId) throw new CheckoutError("MERCHANT_MISMATCH", "Merchant checkout reference changed.");
  if (!["APPROVED", "COMPLETED"].includes(quote.status)) throw new CheckoutError("PAYMENT_NOT_APPROVED", "Choose a payment method in PayPal before reviewing this purchase.");
  const claimed = update(data => {
    const prior = data.orders[quote.orderId];
    if (prior) {
      if (prior.personaId !== owner || prior.merchant?.checkoutId !== quote.checkoutId) throw new CheckoutError("NOT_FOUND", "Checkout belongs to a different demo workspace.", 404);
      validQuote(quote, prior); return prior;
    }
    const { persona, payments } = personaWithState(owner, data);
    const result = buildOptions(persona, persona.goals, payments, { id: quote.productId, name: quote.productName, price: quote.amount, description: "Verified merchant quote" });
    const decisionId = crypto.randomUUID();
    data.decisions[decisionId] = {
      id: decisionId, personaId: owner, productId: quote.productId, createdAt: new Date().toISOString(),
      inputHash: inputHash(owner, data), schemaVersion: "rp-v1", origin:"merchant_review", currency:"USD", baseline: forecast(persona, payments), options: result.options, recommendedMethod: result.recommended,
    };
    const order: OrderRecord = {
      orderId: quote.orderId, personaId: owner, decisionId, productId: quote.productId, productName: quote.productName,
      method: "full", amount: quote.amount, currency: "USD", status: "CREATED", createdAt: new Date().toISOString(), captureRequestId: `capture-${quote.orderId}`,
      merchant: { id: MERCHANT_ID, checkoutId: quote.checkoutId, name: "Northstar Electronics" },
      approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${encodeURIComponent(quote.orderId)}`,
    };
    const intent = quote.reviewIntentId ? data.reviewIntents?.[quote.reviewIntentId] : undefined;
    if (intent && intent.owner === owner && intent.merchantId === quote.merchantId && intent.productId === quote.productId && intent.currency === quote.currency && intent.expiresAt > Date.now()) {
      order.reviewIntentId = quote.reviewIntentId; order.priorAssessmentId = intent.decisionId;
    }
    data.orders[order.orderId] = order; return order;
  });
  // Recovery can discover an already completed payment; never describe that as unpaid.
  if (quote.capture?.status === "COMPLETED") recordCapture(claimed.orderId, quote.capture.id, quote.capture.amount, quote.capture.currency);
  return load().orders[claimed.orderId];
}
export function merchantReturnUrl(order: OrderRecord, cancelled = false) {
  if (!order.merchant || order.merchant.id !== MERCHANT_ID) return null;
  return `${merchantOrigin()}/${cancelled ? "?cancelled=1" : `receipt?order=${encodeURIComponent(order.orderId)}`}`;
}
export async function confirmMerchantCheckout(owner: string, id: string, reviewedHash: string, caller: MerchantCaller = callMerchant) {
  const order = ownedOrder(id, owner);
  if (!order.merchant) throw new CheckoutError("NOT_FOUND", "Not a merchant checkout", 404);
  if (order.status === "CAPTURED") return { status: "CAPTURED", captureId: order.captureId, returnUrl: merchantReturnUrl(order) };
  update(data => {
    if (reviewedHash !== inputHash(owner, data)) throw new CheckoutError("STALE_REVIEW", "Your finances changed. Refresh the impact before confirming payment.");
    const current = data.orders[id];
    if (current.captureCommand === "STARTED" && Date.now() - (current.captureStartedAt || 0) < 30_000) throw new CheckoutError("CAPTURE_IN_PROGRESS", "Confirmation is processing. Check this same order shortly.", 202);
    current.captureCommand = "STARTED"; current.captureStartedAt = Date.now();
  });
  try {
    const quote = await caller("capture", { merchantId: order.merchant.id, checkoutId: order.merchant.checkoutId, orderId: id }, reviewedHash);
    validQuote(quote, order);
    if (quote.capture && quote.capture.status !== "COMPLETED") {
      const pending = quote.capture.status === "PENDING";
      update(data => { data.orders[id].settlementReview = pending ? "PAYMENT.CAPTURE.PENDING" : "PAYMENT.CAPTURE.DECLINED"; });
      throw new CheckoutError(pending ? "PAYMENT_PENDING" : "PAYMENT_FAILED", pending ? "Capture is pending. Check this same order later; do not start another purchase." : "The merchant capture did not complete. Check the same order in PayPal.", pending ? 202 : 409);
    }
    if (quote.capture?.status !== "COMPLETED") throw new Error("Merchant payment is not yet confirmed");
    const saved = recordCapture(id, quote.capture.id, quote.capture.amount, quote.capture.currency);
    return { status: "CAPTURED", captureId: quote.capture.id, snapshotId: saved.order.snapshotId, returnUrl: merchantReturnUrl(order) };
  } catch (error) {
    update(data => { if (data.orders[id].status !== "CAPTURED") { data.orders[id].status = "UNKNOWN"; data.orders[id].captureCommand = "UNKNOWN"; } });
    if (error instanceof CheckoutError && ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(error.code)) throw error;
    throw new CheckoutError("MERCHANT_CONFIRMATION_UNKNOWN", "Payment could not be confirmed. Retry this same confirmation to check the merchant; do not start a second purchase.", 502);
  }
}
