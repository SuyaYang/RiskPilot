import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { updateRecurring } from "@/lib/spending/service";
import { demoEnabled } from "@/lib/checkout";
import { apiError } from "@/lib/http";
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!demoEnabled()) return NextResponse.json({ error: "Spending fixture demo is disabled" }, { status: 404 });
  try { return NextResponse.json(updateRecurring(await currentPersonaId(), (await ctx.params).id, await req.json().catch(() => null))); }
  catch (error) { return apiError(error); }
}
