import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { currentPersonaId } from "@/lib/state";
import { load, update } from "@/lib/store";
import { createOrder, paypalConfigured } from "@/lib/paypal";
import type { MethodId } from "@/lib/types";

/**
 * Create a PayPal order for one option of a saved decision. The amount comes from the server-side
 * decision (catalog price), never from the browser.
 */
export async function POST(req: Request) {
  const { decisionId, method } = (await req.json().catch(() => ({}))) as { decisionId?: string; method?: MethodId };
  const personaId = await currentPersonaId();
  const decision = decisionId ? load().decisions[decisionId] : undefined;
  if (!decision || decision.personaId !== personaId) return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  const option = decision.options.find((o) => o.method === method);
  if (!option || option.method === "wait" || !option.eligible) return NextResponse.json({ error: "This option can't be purchased" }, { status: 400 });

  const base = {
    personaId,
    decisionId: decision.id,
    productId: decision.productId,
    productName: option.productName,
    method: option.method,
    amount: option.price,
    status: "CREATED" as const,
    createdAt: new Date().toISOString(),
  };

  if (!paypalConfigured()) {
    const orderId = `SIM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    update((d) => {
      d.orders[orderId] = { ...base, orderId, simulated: true };
    });
    return NextResponse.json({ id: orderId, simulated: true });
  }

  try {
    const order = await createOrder({
      amount: option.price,
      name: option.productName,
      customId: `${decision.id}:${option.method}`,
      requestId: `create-${decision.id}-${option.method}`,
    });
    update((d) => {
      d.orders[order.id] = { ...base, orderId: order.id };
    });
    return NextResponse.json({ id: order.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
