import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { claimMerchantCheckout } from "@/lib/merchantCheckout";
import { apiError } from "@/lib/http";
import { CheckoutError } from "@/lib/checkout";
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (typeof body.ticket !== "string") throw new CheckoutError("INVALID_MERCHANT_LINK", "Merchant checkout link required", 400);
    const order = await claimMerchantCheckout(await currentPersonaId(), body.ticket);
    return NextResponse.json({ orderId: order.orderId });
  } catch (error) { return apiError(error); }
}
