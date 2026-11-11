import { NextResponse } from "next/server";
import { currentPersonaId, inputHash } from "@/lib/state";
import { captureCheckout, ownedOrder, CheckoutError } from "@/lib/checkout";
import { captureShopCheckout } from "@/lib/shopCheckout";
import { apiError } from "@/lib/http";
import { confirmMerchantCheckout } from "@/lib/merchantCheckout";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await currentPersonaId(), { id } = await ctx.params;
    const order = ownedOrder(id, owner);
    const body = await req.json().catch(() => ({}));
    if (body.timing !== undefined && body.timing !== "now") throw new CheckoutError("PREVIEW_ONLY", "A future-date preview cannot submit payment. Return to the current checkout.", 400);
    if (body.reviewConfirmed !== true) throw new CheckoutError("REVIEW_REQUIRED", "Review the purchase impact and select Make payment to confirm.", 400);
    if (order.status !== "CAPTURED" && body.inputHash !== inputHash(owner)) {
      throw new CheckoutError("STALE_REVIEW", "Your finances changed. Refresh the purchase overview before paying.");
    }
    return NextResponse.json(order.merchant
      ? await confirmMerchantCheckout(owner, id, body.inputHash)
      : body.checkoutSource === "shop" ? await captureShopCheckout(owner, id, body.inputHash) : await captureCheckout(owner, id, undefined, body.inputHash));
  } catch (e) { return apiError(e); }
}
