import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { createCheckout } from "@/lib/checkout";
import { apiError } from "@/lib/http";
export async function POST(req: Request) {
  try {
    const { decisionId, method } = await req.json();
    const order = await createCheckout(await currentPersonaId(), decisionId, method);
    return NextResponse.json({ id: order.orderId, simulated: order.simulated, approvalUrl: order.approvalUrl });
  } catch (e) { return apiError(e); }
}
