import { update } from "./store";
import { schedule } from "./engine/options";
import { today } from "./dates";

/**
 * Record a verified capture exactly once. Called from the capture route and the webhook; the
 * capture id is the idempotency key, so a repeated or out-of-order event cannot double-count.
 */
export function recordCapture(orderId: string, captureId: string, capturedAmount: number) {
  return update((d) => {
    const order = d.orders[orderId];
    if (!order) throw new Error("Unknown order");
    if (Math.abs(order.amount - capturedAmount) > 0.005) {
      order.status = "FAILED";
      throw new Error(`Captured amount ${capturedAmount} does not match order amount ${order.amount}`);
    }
    order.status = "CAPTURED";
    order.captureId = captureId;
    const st = d.personas[order.personaId];
    const existing = st.purchases.find((p) => p.id === captureId);
    if (existing) return { order, purchase: existing, duplicate: true };
    const method = order.method === "cheaper" ? "full" : order.method;
    const purchase = {
      id: captureId,
      orderId,
      productName: order.productName,
      amount: order.amount,
      method: order.method,
      payments: schedule(method, order.amount).payments,
      capturedAt: today().toISOString(),
    };
    st.purchases.push(purchase);
    return { order, purchase, duplicate: false };
  });
}
