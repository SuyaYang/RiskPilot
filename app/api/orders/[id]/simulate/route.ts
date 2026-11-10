import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { simulateCheckout, CheckoutError } from "@/lib/checkout";
import { apiError } from "@/lib/http";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const body=await req.json().catch(()=>({}));
    if(body.timing!==undefined && body.timing!=="now")throw new CheckoutError("PREVIEW_ONLY", "A future-date preview cannot record a purchase.",400);
    return NextResponse.json(simulateCheckout(await currentPersonaId(), (await ctx.params).id)); }
  catch (e) { return apiError(e); }
}
