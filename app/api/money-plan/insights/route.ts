import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { apiError } from "@/lib/http";
import { demoEnabled } from "@/lib/checkout";
import { explainMoneyPlan } from "@/lib/planning/insights";
export async function POST(req: Request) {
  if (!demoEnabled()) return NextResponse.json({ error: "Demo planning is disabled" }, { status: 404 });
  try { return NextResponse.json(await explainMoneyPlan(await currentPersonaId(), await req.json().catch(() => null))); }
  catch (error) { return apiError(error); }
}
