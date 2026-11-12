import { load, update } from "./store";
import { recordCapture } from "./purchases";

/** Only call after PayPal signature verification. RECEIVED remains replayable on every failure. */
export function processVerifiedWebhook(raw: string) {
  const event = JSON.parse(raw);
  if (typeof event.id !== "string" || !event.id || typeof event.event_type !== "string") throw new Error("Invalid webhook event");
  const prior = load().webhookEvents[event.id];
  if (prior && prior.raw !== raw) throw new Error("Webhook event id reused with different content");
  if (prior && prior.state !== "RECEIVED") return { duplicate: true };
  update(d => { d.webhookEvents[event.id] ??= { type: event.event_type, raw, state: "RECEIVED" }; });
  const resource = event.resource;
  const orderId = resource?.supplementary_data?.related_ids?.order_id;
  let state: "PROCESSED" | "IGNORED" = "IGNORED";
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    if (!orderId || !load().orders[orderId]) throw new Error("Order not persisted yet; replay webhook later");
    if (resource.status !== "COMPLETED") throw new Error("Inconsistent capture status");
    recordCapture(orderId, resource.id, Number(resource.amount?.value), resource.amount?.currency_code ?? "");
    state = "PROCESSED";
  } else if (["PAYMENT.CAPTURE.PENDING", "PAYMENT.CAPTURE.DECLINED", "PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"].includes(event.event_type)) {
    const captureId = resource?.supplementary_data?.related_ids?.capture_id || resource?.id;
    const order = (orderId && load().orders[orderId]) || Object.values(load().orders).find(o => o.captureId === captureId);
    if (!order) throw new Error("Order not persisted yet; replay webhook later");
    update(d => {
      const o = d.orders[order.orderId];
      // Late pending/declined events cannot undo a completed capture or its conservative reserve.
      if (event.event_type.endsWith("REFUNDED") || event.event_type.endsWith("REVERSED") || o.status !== "CAPTURED") {
        o.settlementReview = event.event_type;
        if (event.event_type.endsWith("REFUNDED") || event.event_type.endsWith("REVERSED")) {
          if (typeof resource?.id !== "string" || !resource.id) throw new Error("Settlement resource id missing");
          const amount = Number(resource.amount?.value), currency = resource.amount?.currency_code;
          if (resource.amount && (!Number.isFinite(amount) || amount <= 0 || currency !== o.currency)) throw new Error("Settlement amount/currency mismatch");
          o.settlementEvents ??= [];
          if (!o.settlementEvents.some(item => item.id === resource.id && item.type === (event.event_type.endsWith("REVERSED") ? "reversal" : "refund"))) o.settlementEvents.push({ id: resource.id, type: event.event_type.endsWith("REVERSED") ? "reversal" : "refund", ...(resource.amount ? { amount, currency } : {}) });
        }
      }
    });
    state = "PROCESSED";
  }
  update(d => { d.webhookEvents[event.id].state = state; });
  return { duplicate: false };
}
