/** Independent, allowlisted Sandbox merchant harness. This is NOT the RiskPilot website or a real store. */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createOrder, getOrder, captureOrder, readCapture, paypalConfigured, type PayPalOrder } from "../lib/paypal";
import { MERCHANT_ID, bridgeOrigin, merchantOrigin, merchantKey, riskpilotOrigin, readBridgeRequest, signEnvelope, type MerchantQuote, type MerchantRef } from "../lib/merchantBridge";

type MerchantGateway = { configured: typeof paypalConfigured; create: typeof createOrder; get: typeof getOrder; capture: typeof captureOrder };
export function createMerchantServer(options: { port?: number; origin?: string; ledgerPath?: string; gateway?: MerchantGateway; bridgeKey?: string; reviewOrigin?: string } = {}) {
  const api = options.gateway ?? { configured: paypalConfigured, create: createOrder, get: getOrder, capture: captureOrder };
  const port = options.port ?? Number(process.env.MERCHANT_PORT || 3200);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid MERCHANT_PORT");
  const origin = options.origin ? bridgeOrigin(options.origin) : process.env.MERCHANT_ORIGIN ? merchantOrigin() : `http://localhost:${port}`;
  const reviewOrigin = bridgeOrigin(options.reviewOrigin || riskpilotOrigin());
  const key = () => options.bridgeKey || merchantKey();
  const price = 900;
  const product = "Aero 14 Laptop";
  const file = options.ledgerPath ?? process.env.MERCHANT_STORE_PATH ?? path.join(process.cwd(), "data", "merchant-demo.json");
  type Record = { requestId: string; customId: string; checkoutId?: string; orderId?: string; state: "CREATING" | "CREATED" | "UNKNOWN" | "CAPTURED"; captureId?: string; reviewedHash?: string; confirmedAt?: string };
  let ledger: { sessions: { [key: string]: Record } };
  try { ledger = JSON.parse(readFileSync(file, "utf8")); if (!ledger.sessions) throw new Error("Invalid merchant ledger"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; ledger = { sessions: {} }; }
  function save() { mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.tmp`; writeFileSync(tmp, JSON.stringify(ledger), { mode: 0o600 }); renameSync(tmp, file); }
  const pending = new Map<string, Promise<unknown>>();
  async function locked<T>(id: string, fn: () => Promise<T>): Promise<T> {
    if (pending.has(id)) throw new Error("This order is being processed. Check its status before retrying.");
    const p = fn(); pending.set(id, p);
    try { return await p; } finally { pending.delete(id); }
  }
  function session(req: IncomingMessage, res: ServerResponse) {
    const value = req.headers.cookie?.match(/(?:^|;\s*)merchant_demo=([a-f0-9-]{36})(?:;|$)/)?.[1];
    if (value) return value;
    const id = crypto.randomUUID();
    res.setHeader("Set-Cookie", `merchant_demo=${id}; HttpOnly; SameSite=Lax; Path=/${origin.startsWith("https:") ? "; Secure" : ""}`);
    return id;
  }
  function json(res: ServerResponse, status: number, data: unknown) { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); }
  function validateOrder(remote: PayPalOrder, record: Record) {
    const units = remote.purchase_units;
    if (remote.id !== record.orderId || units?.length !== 1 || units[0].custom_id !== record.customId ||
        units[0].amount?.currency_code !== "USD" || Number(units[0].amount.value) !== price) throw new Error("Provider order does not match the merchant quote");
  }
  function applyCapture(remote: PayPalOrder, record: Record) {
    validateOrder(remote, record);
    const capture = readCapture(remote);
    if (!capture || capture.status !== "COMPLETED" || capture.amount !== price || capture.currency !== "USD") return false;
    record.state = "CAPTURED"; record.captureId = capture.id; save(); return true;
  }
  function reference(record: Record): MerchantRef {
    if (!record.orderId || !record.checkoutId) throw new Error("Merchant checkout is not ready");
    return { merchantId: MERCHANT_ID, checkoutId: record.checkoutId, orderId: record.orderId };
  }
  function quote(record: Record, remote: PayPalOrder): MerchantQuote {
    return { ...reference(record), productId: "northstar:aero-14", productName: product, merchantName: "Northstar Electronics", amount: price, currency: "USD", status: remote.status, capture: readCapture(remote) };
  }

  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const url = new URL(req.url || "/", origin);
    const id = session(req, res);
    try {
      if (req.method === "GET" && url.pathname === "/api/health") { json(res, 200, { status: "ok", flow: "riskpilot-continue-v1", reviewOrigin }); return; }
      if (url.pathname === "/api/riskpilot" && req.method === "POST") {
        // Only signed server-to-server requests can ask the merchant to capture.
        const auth = req.headers.authorization;
        if (!auth?.startsWith("RiskPilot ")) { json(res, 401, { error: "Signed RiskPilot request required" }); return; }
        let request;
        try { request = readBridgeRequest(auth.slice(10), key()); }
        catch { json(res, 401, { error: "Invalid or expired RiskPilot request" }); return; }
        const entry = Object.entries(ledger.sessions).find(([, record]) => record.checkoutId === request.checkoutId && record.orderId === request.orderId);
        if (!entry) { json(res, 404, { error: "Merchant checkout not found" }); return; }
        const operation = async () => {
          const record = entry[1];
          let remote = await api.get(request.orderId); validateOrder(remote, record);
          if (request.action === "capture" && !applyCapture(remote, record)) {
            if (remote.status !== "APPROVED") throw new Error("Choose and approve a payment method in PayPal first.");
            record.reviewedHash = request.reviewHash; record.confirmedAt = new Date().toISOString(); record.state = "UNKNOWN"; save();
            await api.capture(request.orderId);
            remote = await api.get(request.orderId); validateOrder(remote, record);
            if (!applyCapture(remote, record)) throw new Error("Payment is not yet completed. Check the same order again.");
          }
          return quote(record, remote);
        };
        const result = request.action === "capture" ? await locked(entry[0], operation) : await operation();
        json(res, 200, { signed: signEnvelope("response", { nonce: request.nonce, quote: result }, key()) }); return;
      }
      if (req.method === "GET" && (url.pathname === "/review" || url.pathname === "/checkout/return")) {
        const record = ledger.sessions[id];
        if (url.searchParams.get("cancelled")) { res.writeHead(302, { Location: "/?cancelled=1" }); res.end(); return; }
        if (!record?.orderId || (url.searchParams.has("token") && url.searchParams.get("token") !== record.orderId)) throw new Error("This checkout does not belong to the current store session.");
        record.checkoutId ??= crypto.randomUUID(); save();
        const ticket = signEnvelope("ticket", { ...reference(record), expiresAt: Date.now() + 15 * 60_000 }, key());
        res.writeHead(302, { Location: `${reviewOrigin}/checkout/connect?ticket=${encodeURIComponent(ticket)}` }); res.end(); return;
      }
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/receipt")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(readFileSync(path.join(process.cwd(), "merchant-demo/index.html"))); return;
      }
      if (req.method === "GET" && url.pathname === "/api/config") {
        json(res, 200, { clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || "", configured: api.configured(), reviewOrigin }); return;
      }
      if (req.method === "GET" && url.pathname === "/api/status") {
        const record = ledger.sessions[id];
        if (!record?.orderId) { json(res, 200, { status: record?.state ?? "NONE" }); return; }
        const remote = await api.get(record.orderId); validateOrder(remote, record); applyCapture(remote, record);
        json(res, 200, { id: record.orderId, status: record.state === "CAPTURED" ? "CAPTURED" : remote.status, captureId: record.captureId }); return;
      }
      if (url.pathname === "/api/capture") { json(res, 403, { error: "Review and explicitly confirm this purchase in RiskPilot first." }); return; }
      if (req.method !== "POST" || req.headers.origin !== origin || url.pathname !== "/api/order") {
        json(res, 403, { error: "Unsupported request or origin" }); return;
      }
      if (!api.configured()) { json(res, 503, { error: "Configure PayPal Sandbox credentials in .env first." }); return; }
      const result = await locked(id, async () => {
        if (url.pathname === "/api/order") {
          let record = ledger.sessions[id];
          if (record?.state === "CAPTURED") throw new Error("This demo purchase is already paid. Use a fresh browser session for another purchase.");
          if (record?.orderId) return { orderId: record.orderId };
          // Never use a new idempotency key after an uncertain create, including after restart.
          if (record) throw new Error("Order creation is uncertain. Preserve this session for manual recovery; do not create a second order.");
          record = { requestId: crypto.randomUUID(), customId: `merchant-${crypto.randomUUID()}`, checkoutId: crypto.randomUUID(), state: "CREATING" };
          ledger.sessions[id] = record; save();
          try {
            const remote = await api.create({ amount: price, name: product, customId: record.customId, requestId: record.requestId,
              experience: { origin, brandName: "Northstar Electronics · Sandbox", userAction: "CONTINUE" } });
            record.orderId = remote.id;
            save();
            // Create/capture responses may be minimal; GET supplies the authoritative full order.
            validateOrder(await api.get(record.orderId!), record);
            record.state = "CREATED"; save(); return { orderId: record.orderId };
          } catch (error) { record.state = "UNKNOWN"; save(); throw error; }
        }
        throw new Error("Unsupported merchant operation");
      });
      json(res, 200, result);
    } catch (error) { json(res, 409, { error: (error as Error).message, retryable: true }); }
  });

  return server;
}
