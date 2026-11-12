import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { demoEnabled } from "@/lib/checkout";
import { apiError } from "@/lib/http";
import { planningBudgetView, updatePlanningBudget } from "@/lib/planning/service";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!demoEnabled()) return NextResponse.json({ error: "Spending fixture demo is disabled" }, { status: 404 });
  try { return NextResponse.json(planningBudgetView(await currentPersonaId())); }
  catch (error) { return apiError(error); }
}
export async function PATCH(req: Request) {
  if (!demoEnabled()) return NextResponse.json({ error: "Spending fixture demo is disabled" }, { status: 404 });
  try { return NextResponse.json(updatePlanningBudget(await currentPersonaId(), await req.json().catch(() => null))); }
  catch (error) { return apiError(error); }
}
