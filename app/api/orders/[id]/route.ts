import { paymentStatusView, type PaymentObservation } from "@/lib/paymentStatus";
import { captureComparison } from "@/lib/captureComparison";
import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { ownedOrder, inspectCheckout } from "@/lib/checkout";
import { load } from "@/lib/store";
import { orderReview } from "@/lib/orderReview";
import { apiError } from "@/lib/http";
import { merchantReturnUrl, inspectMerchantCheckout } from "@/lib/merchantCheckout";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await currentPersonaId(), id = (await ctx.params).id;
    let order = ownedOrder(id, owner);
    let observation: PaymentObservation | undefined;
    let lookupFailed = false;
    if (!order.simulated && order.status !== "CAPTURED") {
      try { observation = order.merchant ? await inspectMerchantCheckout(order) : await inspectCheckout(order); }
      catch { lookupFailed = true; }
    }
    // A capture/webhook may have completed while the read-only provider lookup was running.
    order = ownedOrder(id, owner);
    const forecastSnapshot = order.snapshotId ? load().snapshots[order.snapshotId] : null;
    return NextResponse.json({ payment: paymentStatusView(order, observation, lookupFailed, !!forecastSnapshot), comparison:captureComparison(order,load()), order, returnUrl: merchantReturnUrl(order), cancelUrl: merchantReturnUrl(order, true), review: order.status === "CAPTURED" ? null : orderReview(order), forecastSnapshot });
  } catch (e) { return apiError(e); }
}
