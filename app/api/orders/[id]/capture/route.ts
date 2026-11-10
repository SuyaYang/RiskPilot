import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { load, update } from "@/lib/store";
import { captureOrder, getOrder, readCapture } from "@/lib/paypal";
import { recordCapture } from "@/lib/purchases";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const order = load().orders[id];
  if (!order || order.personaId !== (await currentPersonaId())) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "CAPTURED") return NextResponse.json({ status: "CAPTURED", duplicate: true });
  if (order.simulated) return NextResponse.json({ error: "Simulated order: use the simulate endpoint" }, { status: 400 });

  let result;
  try {
    result = await captureOrder(id);
  } catch (e) {
    // Timeout or error: never retry blindly. Ask PayPal what actually happened.
    try {
      result = await getOrder(id);
    } catch {
      update((d) => {
        d.orders[id].status = "UNKNOWN";
      });
      return NextResponse.json({ status: "UNKNOWN", error: (e as Error).message }, { status: 502 });
    }
  }
  const cap = readCapture(result);
  if (!cap || cap.status !== "COMPLETED") {
    return NextResponse.json({ status: result?.status ?? "UNKNOWN", error: "Payment was not completed" }, { status: 409 });
  }
  try {
    const out = recordCapture(id, cap.id, cap.amount);
    return NextResponse.json({ status: "CAPTURED", captureId: cap.id, duplicate: out.duplicate });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
