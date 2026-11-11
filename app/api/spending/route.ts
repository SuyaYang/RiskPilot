import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { demoEnabled } from "@/lib/checkout";
import { apiError } from "@/lib/http";
import { spendingView } from "@/lib/spending/service";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!demoEnabled()) return NextResponse.json({ error: "Spending fixture demo is disabled" }, { status: 404 });
  try { return NextResponse.json(spendingView(await currentPersonaId())); }
  catch (error) { return apiError(error); }
}
