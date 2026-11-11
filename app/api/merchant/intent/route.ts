import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { CheckoutError } from "@/lib/checkout";
import { createPurchaseIntent } from "@/lib/purchaseIntent";
import { apiError } from "@/lib/http";
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(()=>null);
    if (!body || typeof body.decisionId !== "string" || Object.keys(body).some(key=>key!=="decisionId")) throw new CheckoutError("INVALID_INTENT","Choose one existing Shop assessment.",400);
    return NextResponse.json(createPurchaseIntent(await currentPersonaId(),body.decisionId));
  } catch(error) { return apiError(error); }
}
