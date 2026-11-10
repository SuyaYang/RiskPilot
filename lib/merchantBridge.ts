/** Local cooperating-merchant protocol. No merchant credentials or signing key enter the browser. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MERCHANT_ID = "northstar-demo" as const;
export type MerchantRef = { merchantId: typeof MERCHANT_ID; checkoutId: string; orderId: string };
export type MerchantTicket = MerchantRef & { expiresAt: number };
export type BridgeRequest = MerchantRef & { action: "inspect" | "capture"; issuedAt: number; nonce: string; reviewHash?: string };
export type MerchantQuote = MerchantRef & {
  productId: string; productName: string; merchantName: string; amount: number; currency: "USD";
  status: string; approvalUrl?: string; capture?: { id: string; amount: number; currency: string; status: string } | null;
};

export function localOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("The demo merchant bridge accepts loopback HTTP origins only");
  }
  return url.origin;
}
export const merchantOrigin = () => localOrigin(process.env.MERCHANT_ORIGIN || `http://localhost:${process.env.MERCHANT_PORT || 3200}`);
export const riskpilotOrigin = () => localOrigin(process.env.RISKPILOT_ORIGIN || process.env.APP_ORIGIN || "http://localhost:3100");

export function merchantKey() {
  const configured = process.env.MERCHANT_BRIDGE_SECRET;
  if (configured) { if (configured.length < 32) throw new Error("MERCHANT_BRIDGE_SECRET must have at least 32 characters"); return configured; }
  if (process.env.NODE_ENV === "production" && process.env.APP_ENV !== "local") throw new Error("Merchant bridge demo disabled outside local mode");
  const file = process.env.MERCHANT_BRIDGE_KEY_FILE || path.join(process.cwd(), "data", "merchant-bridge.key");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try { fs.writeFileSync(file, crypto.randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  const key = fs.readFileSync(file, "utf8").trim();
  if (key.length < 32) throw new Error("Invalid local merchant bridge key");
  return key;
}
export function signEnvelope(purpose: "ticket" | "request" | "response", payload: unknown, key = merchantKey()) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", key).update(`${purpose}.${encoded}`).digest("hex");
  return `${encoded}.${mac}`;
}
export function verifyEnvelope<T>(purpose: "ticket" | "request" | "response", token: string, key = merchantKey()): T {
  if (typeof token !== "string" || token.length > 16_384 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(token)) throw new Error("Invalid merchant signature");
  const [payload, mac] = token.split(".");
  const expected = crypto.createHmac("sha256", key).update(`${purpose}.${payload}`).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(mac, "hex"))) throw new Error("Invalid merchant signature");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
}
export function validateRef(ref: MerchantRef) {
  if (ref.merchantId !== MERCHANT_ID || typeof ref.checkoutId !== "string" || !/^[a-f0-9-]{36}$/.test(ref.checkoutId) || typeof ref.orderId !== "string" || !/^[A-Za-z0-9-]{3,80}$/.test(ref.orderId)) throw new Error("Invalid merchant checkout reference");
}
export function readMerchantTicket(token: string, key = merchantKey()): MerchantTicket {
  const data = verifyEnvelope<MerchantTicket>("ticket", token, key); validateRef(data);
  if (!Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now() || data.expiresAt > Date.now() + 16 * 60_000) throw new Error("Merchant review link expired. Return to the store and reopen the review.");
  return data;
}
export function readBridgeRequest(token: string, key = merchantKey()): BridgeRequest {
  const data = verifyEnvelope<BridgeRequest>("request", token, key); validateRef(data);
  if (!["inspect", "capture"].includes(data.action) || !Number.isFinite(data.issuedAt) || Math.abs(Date.now() - data.issuedAt) > 60_000 || typeof data.nonce !== "string" || !/^[a-f0-9-]{36}$/.test(data.nonce)) throw new Error("Expired or invalid merchant request");
  if (data.action === "capture" && (typeof data.reviewHash !== "string" || !/^[a-f0-9]{64}$/.test(data.reviewHash))) throw new Error("Explicit reviewed input hash required");
  return data;
}
export type MerchantCaller = (action: BridgeRequest["action"], ref: MerchantRef, reviewHash?: string) => Promise<MerchantQuote>;
export const callMerchant: MerchantCaller = async (action, ref, reviewHash) => {
  const request: BridgeRequest = { ...ref, action, reviewHash, issuedAt: Date.now(), nonce: crypto.randomUUID() };
  const response = await fetch(`${merchantOrigin()}/api/riskpilot`, {
    method: "POST", headers: { Authorization: `RiskPilot ${signEnvelope("request", request)}` },
    signal: AbortSignal.timeout(20_000), cache: "no-store", redirect: "error",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Merchant checkout is unavailable. Check this same order again.");
  const result = verifyEnvelope<{ nonce: string; quote: MerchantQuote }>("response", data.signed);
  if (result.nonce !== request.nonce || result.quote.checkoutId !== ref.checkoutId || result.quote.orderId !== ref.orderId || result.quote.merchantId !== ref.merchantId) throw new Error("Merchant response does not match this checkout");
  return result.quote;
};
