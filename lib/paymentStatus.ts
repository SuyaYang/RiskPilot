import type { OrderRecord } from "./store";
import type { readCapture } from "./paypal";

export type PaymentObservation = { status: string; capture: ReturnType<typeof readCapture> };
export type PaymentState = "CREATED" | "APPROVED" | "PENDING" | "CAPTURED" | "CAPTURED_UNSAVED" | "FAILED" | "UNKNOWN" | "REFUNDED" | "PARTIALLY_REFUNDED" | "REVERSED" | "SETTLEMENT_REVIEW";
export type PaymentStatusView = ReturnType<typeof paymentStatusView>;

/** Provider approval, capture and local forecast persistence are independent facts. */
export function paymentStatusView(order: OrderRecord, observation?: PaymentObservation, lookupFailed = false, hasSnapshot = false) {
  let state: PaymentState;
  const settlement = order.settlementEvents ?? [];
  const refunds = settlement.filter(event => event.type === "refund");
  const refundCents = refunds.reduce((sum, event) => sum + Math.round((event.amount ?? 0) * 100), 0);
  if (settlement.some(event => event.type === "reversal") || order.settlementReview === "PAYMENT.CAPTURE.REVERSED" || observation?.capture?.status === "REVERSED") state = "REVERSED";
  else if (refunds.length && refunds.every(event => Number.isFinite(event.amount) && event.amount! > 0 && event.currency === order.currency) && refundCents <= Math.round(order.amount * 100)) state = refundCents === Math.round(order.amount * 100) ? "REFUNDED" : "PARTIALLY_REFUNDED";
  else if (order.settlementReview === "PAYMENT.CAPTURE.REFUNDED" || refunds.length) state = "SETTLEMENT_REVIEW";
  else if (["REFUNDED", "PARTIALLY_REFUNDED"].includes(observation?.capture?.status || "")) state = observation!.capture!.status as "REFUNDED" | "PARTIALLY_REFUNDED";
  else if (order.status === "CAPTURED") state = "CAPTURED";
  else if (observation?.capture?.status === "COMPLETED") state = "CAPTURED_UNSAVED";
  else if (observation?.capture?.status === "PENDING") state = "PENDING";
  else if (["DECLINED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"].includes(observation?.capture?.status || "")) state = "FAILED";
  else if (lookupFailed || order.status === "UNKNOWN") state = "UNKNOWN";
  else if (order.settlementReview === "PAYMENT.CAPTURE.PENDING") state = "PENDING";
  else if (order.settlementReview === "PAYMENT.CAPTURE.DECLINED") state = "FAILED";
  else if (observation?.status === "APPROVED") state = "APPROVED";
  else if (order.status === "FAILED" || ["VOIDED", "DECLINED"].includes(observation?.status || "")) state = "FAILED";
  else if (observation?.status === "COMPLETED") state = "PENDING"; // Order completion alone is not a completed capture.
  else state = "CREATED";
  const labels: Record<PaymentState, string> = {
    REFUNDED: "Full refund verified · reserve retained pending reconciliation",
    PARTIALLY_REFUNDED: "Partial refund verified · reserve retained pending reconciliation",
    REVERSED: "Capture reversal verified · reserve retained pending reconciliation",
    SETTLEMENT_REVIEW: "Refund recorded · extent unconfirmed; reserve retained",
    CREATED: order.simulated ? "Simulation ready · no PayPal payment" : "Order created · buyer approval required",
    APPROVED: "Buyer approved · not captured",
    PENDING: "Capture pending · completion unconfirmed",
    CAPTURED: order.simulated ? "Simulation recorded" : "Capture completed · verified",
    CAPTURED_UNSAVED: "Capture completed remotely · local recovery required",
    FAILED: "Payment failed or requires settlement review",
    UNKNOWN: "Payment outcome unknown · recover this same order",
  };
  return {
    state, label: labels[state], lookupFailed,
    providerChecked: !order.simulated && !!observation && !lookupFailed,
    amountVerified: !order.simulated && !!observation && !lookupFailed,
    currencyVerified: !order.simulated && !!observation && !lookupFailed,
    forecast: order.projectionStatus === "UPDATED" && hasSnapshot ? "Updated & saved"
      : order.status === "CAPTURED" || state === "CAPTURED_UNSAVED" ? "Update not saved · recovery required" : "Awaiting confirmed capture",
    bank: "Not connected · reconciliation unavailable",
  };
}
