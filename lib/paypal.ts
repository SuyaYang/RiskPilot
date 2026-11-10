const BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
if (BASE !== "https://api-m.sandbox.paypal.com") throw new Error("This demo supports PayPal Sandbox only");
const ORIGIN = process.env.APP_ORIGIN || "http://localhost:3000";

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let token: { value: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expires - 60_000) return token.value;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status}). Check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET.`);
  const j = await res.json();
  token = { value: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return token.value;
}

async function call(pathname: string, init: RequestInit & { requestId?: string } = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "Content-Type": "application/json",
  };
  if (init.requestId) headers["PayPal-Request-Id"] = init.requestId;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${BASE}${pathname}`, { ...init, headers, signal: ctrl.signal, cache: "no-store" });
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const err = new Error(`PayPal request failed (${res.status}): ${body?.details?.[0]?.issue ?? body?.name ?? "PROVIDER_ERROR"}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export async function createOrder(opts: { amount: number; name: string; customId: string; requestId: string }) {
  const value = opts.amount.toFixed(2);
  return call("/v2/checkout/orders", {
    method: "POST",
    requestId: opts.requestId,
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: opts.customId,
          description: opts.name,
          amount: { currency_code: "USD", value, breakdown: { item_total: { currency_code: "USD", value } } },
          items: [{ name: opts.name, quantity: "1", unit_amount: { currency_code: "USD", value }, category: "PHYSICAL_GOODS" }],
        },
      ],
      // Where PayPal sends the buyer after approving or cancelling. Without these, approving from a
      // plain checkout link spins forever because PayPal has nowhere to return.
      payment_source: {
        paypal: {
          experience_context: {
            return_url: `${ORIGIN}/checkout/return`,
            cancel_url: `${ORIGIN}/checkout/return?cancelled=1`,
            user_action: "PAY_NOW",
            brand_name: "RiskPilot Demo Store",
          },
        },
      },
    }),
  });
}

export async function getOrder(orderId: string) {
  return call(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

/** Capture with a fixed request id, so a retry of the same capture is not charged twice. */
export async function captureOrder(orderId: string) {
  return call(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    requestId: `capture-${orderId}`,
    body: "{}",
  });
}

export interface PayPalOrder {
  id: string;
  status: string;
  purchase_units?: Array<{
    custom_id?: string;
    amount?: { value: string; currency_code: string };
    payments?: { captures?: Array<{ id: string; status: string; amount: { value: string; currency_code: string } }> };
  }>;
  links?: Array<{ rel: string; href: string }>;
}
export function readCapture(order: PayPalOrder) {
  const caps = order.purchase_units?.flatMap(u => u.payments?.captures ?? []) ?? [];
  if (caps.length > 1) throw new Error("Unexpected multiple captures; manual reconciliation required");
  const cap = caps[0];
  return cap ? { id: cap.id, status: cap.status, amount: Number(cap.amount.value), currency: cap.amount.currency_code } : null;
}
export async function getCapture(captureId: string) {
  return call(`/v2/payments/captures/${encodeURIComponent(captureId)}`, { method: "GET" });
}

export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const res = await call("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  return res.verification_status === "SUCCESS";
}
