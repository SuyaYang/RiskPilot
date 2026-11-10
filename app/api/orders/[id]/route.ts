import { captureComparison } from "@/lib/captureComparison";
import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { ownedOrder } from "@/lib/checkout";
import { load } from "@/lib/store";
import { orderReview } from "@/lib/orderReview";
import { apiError } from "@/lib/http";
import { merchantReturnUrl } from "@/lib/merchantCheckout";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const order = ownedOrder((await ctx.params).id, await currentPersonaId());
    return NextResponse.json({ comparison:captureComparison(order,load()), order, returnUrl: merchantReturnUrl(order), cancelUrl: merchantReturnUrl(order, true), review: order.status === "CAPTURED" ? null : orderReview(order), forecastSnapshot: order.snapshotId ? load().snapshots[order.snapshotId] : null });
  } catch (e) { return apiError(e); }
}
