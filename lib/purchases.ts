import { update } from "./store";
import { inputHash, snapshot } from "./state";
import { iso, today } from "./dates";

/** Verified merchant payment ≠ a confirmed consumer loan or funding account. */
export function recordCapture(orderId: string, captureId: string, capturedAmount: number, currency = "USD") {
  return update(d => {
    const order = d.orders[orderId];
    if (!order) throw new Error("Unknown order");
    if (!captureId || currency !== order.currency || !Number.isFinite(capturedAmount) ||
        Math.round(capturedAmount * 100) !== Math.round(order.amount * 100)) throw new Error("Capture currency or amount mismatch");
    if (order.captureId && order.captureId !== captureId) throw new Error("Order already has a different capture");
    if (Object.values(d.orders).some(o => o.orderId !== orderId && o.captureId === captureId)) throw new Error("Capture already belongs to another order");
    const st = d.personas[order.personaId];
    const existing = st.purchases.find(p => p.id === captureId);
    if (existing) return { order, purchase: existing, duplicate: true };
    const before = structuredClone(snapshot(order.personaId, d));
    const purchase = {
      id: captureId, orderId, productName: order.productName, amount: order.amount, method: order.method,
      payments: [{ date: iso(today()), amount: order.amount, label: "Conservative reserve · funding unconfirmed" }],
      capturedAt: new Date().toISOString(), fundingStatus: "UNCONFIRMED" as const, simulated: Boolean(order.simulated),
    };
    st.purchases.push(purchase);
    order.status = "CAPTURED";
    order.captureId = captureId;
    order.captureCommand = "COMPLETED";
    const id = `capture:${captureId}`;
    d.snapshots[id] = {
      id, personaId: order.personaId, orderId, inputHash: inputHash(order.personaId, d), schemaVersion: "rp-v1",
      createdAt: new Date().toISOString(), before, data: snapshot(order.personaId, d),
    };
    order.snapshotId = id;
    order.projectionStatus = "UPDATED";
    return { order, purchase, duplicate: false };
  });
}
