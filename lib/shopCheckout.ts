import { captureCheckout, ownedOrder, CheckoutError, type Gateway } from "./checkout";
import { orderReview } from "./orderReview";

/** Shop already displayed the assessment; PayPal's PAY_NOW is its final confirmation. */
export async function captureShopCheckout(owner: string, id: string, reviewedHash: string, api?: Gateway) {
  const order = ownedOrder(id, owner);
  if (order.merchant) throw new CheckoutError("MERCHANT_CONFIRMATION_REQUIRED", "Merchant checkout requires the RiskPilot confirmation step.", 400);
  if (!order.shopPayNow) throw new CheckoutError("REVIEW_REQUIRED", "This order requires explicit confirmation on its review page.", 400);
  if (order.status === "CAPTURED") return captureCheckout(owner, id, api, reviewedHash);
  const review = orderReview(order);
  if (review.recheck.status !== "unchanged" || review.decision.inputHash !== reviewedHash) {
    throw new CheckoutError("STALE_REVIEW", "This purchase or your finances changed. Review the refreshed impact before confirming payment.");
  }
  return captureCheckout(owner, id, api, reviewedHash);
}
