import type { OrderRecord } from "./store";
import type { readCapture } from "./paypal";

export type PaymentObservation = { status: string; capture: ReturnType<typeof readCapture> };
export type PaymentState = "CREATED" | "APPROVED" | "PENDING" | "CAPTURED" | "CAPTURED_UNSAVED" | "FAILED" | "UNKNOWN";
export type PaymentStatusView = ReturnType<typeof paymentStatusView>;

/** Provider approval, capture and local forecast persistence are independent facts. */
export function paymentStatusView(order: OrderRecord, observation?: PaymentObservation, lookupFailed = false, hasSnapshot = false) {
  let state: PaymentState;
  if (order.status === "CAPTURED") state = "CAPTURED";
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
    forecast: order.projectionStatus === "UPDATED" && hasSnapshot ? "Updated & saved"
      : state === "CAPTURED" || state === "CAPTURED_UNSAVED" ? "Update not saved · recovery required" : "Awaiting confirmed capture",
    bank: "Not connected · reconciliation unavailable",
  };
}
