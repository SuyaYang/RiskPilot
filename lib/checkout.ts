import crypto from "node:crypto";
import { load, update, type OrderRecord } from "./store";
import { inputHash } from "./state";
import { createOrder, captureOrder, getOrder, paypalConfigured, readCapture, type PayPalOrder } from "./paypal";
import { recordCapture } from "./purchases";
import type { MethodId } from "./types";
import { getProduct } from "./catalog";

export class CheckoutError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
export const demoEnabled = () => process.env.DEMO_SEED_ENABLED === "true" ||
  (!process.env.DEMO_SEED_ENABLED && (process.env.APP_ENV === "local" || process.env.NODE_ENV !== "production"));

export interface Gateway {
  configured(): boolean;
  create: typeof createOrder;
  get: (id: string) => Promise<PayPalOrder>;
  capture: (id: string) => Promise<PayPalOrder>;
}
const gateway: Gateway = { configured: paypalConfigured, create: createOrder, get: getOrder, capture: captureOrder };
export function ownedOrder(id: string, owner: string) {
  const o = load().orders[id];
  if (!o || o.personaId !== owner) throw new CheckoutError("NOT_FOUND", "Order not found", 404);
  return o;
}
export async function createCheckout(owner: string, decisionId: string, method: MethodId, api = gateway) {
  const d = load().decisions[decisionId];
  if (!d || d.personaId !== owner) throw new CheckoutError("NOT_FOUND", "Decision not found", 404);
  const option = d.options.find(o => o.method === method);
  if (!option || method === "wait" || !option.eligible) throw new CheckoutError("INVALID_OPTION", "This option cannot be purchased", 400);
  const key = `create-${d.id}-${method}`;
  const prior = load().commands[key];
  if (prior?.orderId) return ownedOrder(prior.orderId, owner);
  // PayPal retains idempotency keys for a bounded period. Older unknown commands need reconciliation.
  if (prior && Date.now() - prior.firstAttemptAt > 5 * 3600_000) throw new CheckoutError("CREATE_REQUIRES_REVIEW", "An earlier order is still unconfirmed. Reconcile it before creating another order.");
  if (!prior && d.inputHash !== inputHash(owner)) throw new CheckoutError("STALE_DECISION", "Your financial data changed. Assess the purchase again.");
  if (!prior && Date.now() - Date.parse(d.createdAt) > 30 * 60_000) throw new CheckoutError("STALE_DECISION", "This assessment expired. Assess again.");
  if (!api.configured() && !demoEnabled()) throw new CheckoutError("PAYPAL_UNAVAILABLE", "PayPal Sandbox is not configured", 503);
  const alternative = method === "cheaper" ? getProduct(d.productId)?.alternativeId : undefined;
  const product = prior ? { id: alternative || d.productId, name: option.productName, price: option.price } : getProduct(alternative || d.productId);
  if (!product || product.price !== option.price) throw new CheckoutError("STALE_CATALOG", "Product changed. Assess again.");
  update(s => {
    const command = s.commands[key];
    if (command?.state === "STARTED" && Date.now() - command.startedAt < 30000) throw new CheckoutError("CREATE_IN_PROGRESS", "Order creation is already running. Check again shortly.", 202);
    s.commands[key] = { requestId: key, personaId: owner, decisionId, method, state: "STARTED", startedAt: Date.now(), firstAttemptAt: command?.firstAttemptAt ?? Date.now() };
  });
  try {
    const simulated = !api.configured();
    const result: PayPalOrder = simulated ? { id: `SIM-${crypto.randomUUID()}`, status: "CREATED" } :
      await api.create({ amount: product.price, name: product.name, customId: `${d.id}:${method}`, requestId: key });
    if (!result.id) throw new Error("PayPal did not return an order id");
    const approvalUrl = result.links?.find(l => ["approve", "payer-action"].includes(l.rel))?.href;
    const order: OrderRecord = {
      orderId: result.id, personaId: owner, decisionId, productId: product.id, productName: product.name, method,
      amount: product.price, currency: "USD", status: "CREATED", createdAt: new Date().toISOString(), simulated,
      captureRequestId: `capture-${result.id}`, approvalUrl, projectionStatus: "PENDING",
    };
    update(s => {
      // Never overwrite an order already completed by a webhook or concurrent retry.
      s.orders[result.id] ??= order;
      s.commands[key].state = "COMPLETED";
      s.commands[key].orderId = result.id;
    });
    return ownedOrder(result.id, owner);
  } catch (e) {
    update(s => { s.commands[key].state = "UNKNOWN"; });
    throw new CheckoutError("CREATE_UNKNOWN", "Order creation could not be confirmed. Retry this same assessment to recover the same request.", 502);
  }
}
function validateProviderOrder(o: OrderRecord, remote: PayPalOrder) {
  const u = remote.purchase_units;
  if (remote.id !== o.orderId || u?.length !== 1 || u[0].custom_id !== `${o.decisionId}:${o.method}` ||
      u[0].amount?.currency_code !== "USD" || Math.round(Number(u[0].amount.value) * 100) !== Math.round(o.amount * 100)) {
    throw new CheckoutError("PROVIDER_MISMATCH", "PayPal order does not match the frozen checkout");
  }
}
function completed(o: OrderRecord, remote: PayPalOrder) {
  const cap = readCapture(remote);
  if (!cap || cap.status !== "COMPLETED") return null;
  const result = recordCapture(o.orderId, cap.id, cap.amount, cap.currency);
  return { status: "CAPTURED", captureId: cap.id, duplicate: result.duplicate, snapshotId: result.order.snapshotId };
}
export async function captureCheckout(owner: string, id: string, api = gateway, reviewedHash?: string) {
  const o = ownedOrder(id, owner);
  if (o.status === "CAPTURED") return { status: "CAPTURED", captureId: o.captureId, duplicate: true, snapshotId: o.snapshotId };
  if (o.simulated) throw new CheckoutError("SIMULATED_ORDER", "Use the explicitly labeled simulation action", 400);
  // Preflight avoids sending an unapproved payment to the capture endpoint.
  let remote: PayPalOrder;
  try { remote = await api.get(id); }
  catch { throw new CheckoutError("LOOKUP_UNAVAILABLE", "Cannot check PayPal right now. Payment status is unconfirmed; check again.", 502); }
  validateProviderOrder(o, remote);
  const done = completed(o, remote);
  if (done) return done;
  if (remote.status !== "APPROVED") {
    throw new CheckoutError(remote.status === "COMPLETED" ? "PAYMENT_PENDING" : "PAYMENT_NOT_APPROVED",
      remote.status === "COMPLETED" ? "Payment is still pending confirmation. Check again later." : "Payment not completed. Approve it in PayPal, then try again.");
  }
  update(s => {
    if (reviewedHash && inputHash(owner, s) !== reviewedHash) throw new CheckoutError("STALE_REVIEW", "Your finances changed. Refresh the purchase overview before paying.");
    if (s.orders[id].captureCommand === "STARTED" && Date.now() - (s.orders[id].captureStartedAt || 0) < 30000) throw new CheckoutError("CAPTURE_IN_PROGRESS", "Payment is already processing. Check status shortly.", 202);
    s.orders[id].captureCommand = "STARTED";
    s.orders[id].captureStartedAt = Date.now();
  });
  try {
    const result = await api.capture(id);
    if (result.id !== id) throw new Error("Capture order id mismatch");
    const out = completed(o, result);
    if (out) return out;
  } catch {
    // Capture may have succeeded remotely. Lookup before allowing any retry with the same key.
    try {
      const recovered = await api.get(id);
      validateProviderOrder(o, recovered);
      const out = completed(o, recovered);
      if (out) return out;
    } catch { /* persist UNKNOWN below; do not create another capture command */ }
  }
  update(s => { if (s.orders[id].status !== "CAPTURED") { s.orders[id].status = "UNKNOWN"; s.orders[id].captureCommand = "UNKNOWN"; } });
  throw new CheckoutError("CAPTURE_UNKNOWN", "Payment could not be confirmed. Check this order again; do not start another purchase.", 502);
}
export function simulateCheckout(owner: string, id: string) {
  if (!demoEnabled() || paypalConfigured()) throw new CheckoutError("SIMULATION_DISABLED", "Simulation is unavailable", 404);
  const o = ownedOrder(id, owner);
  if (!o.simulated) throw new CheckoutError("NOT_FOUND", "Simulated order not found", 404);
  const out = recordCapture(id, `SIMCAP-${id}`, o.amount);
  return { status: "CAPTURED", captureId: out.purchase.id, duplicate: out.duplicate, simulated: true, snapshotId: out.order.snapshotId };
}
