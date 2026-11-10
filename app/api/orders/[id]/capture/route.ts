import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { captureCheckout } from "@/lib/checkout";
import { apiError } from "@/lib/http";
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await captureCheckout(await currentPersonaId(), (await ctx.params).id)); }
  catch (e) { return apiError(e); }
}
