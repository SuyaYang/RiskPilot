import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { load } from "@/lib/store";
import { paypalConfigured } from "@/lib/paypal";
import { recordCapture } from "@/lib/purchases";

/** Local development only: completes a simulated order when no PayPal keys are configured. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (paypalConfigured()) return NextResponse.json({ error: "PayPal is configured; use real checkout" }, { status: 400 });
  const { id } = await ctx.params;
  const order = load().orders[id];
  if (!order || !order.simulated || order.personaId !== (await currentPersonaId())) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const out = recordCapture(id, `SIMCAP-${id}`, order.amount);
  return NextResponse.json({ status: "CAPTURED", captureId: out.purchase.id, simulated: true });
}
