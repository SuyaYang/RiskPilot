import { NextResponse } from "next/server";
import { currentPersonaId, snapshot } from "@/lib/state";
import { update } from "@/lib/store";
import { TEMPLATES } from "@/lib/engine/investable";
import { CONCEPT_LIST } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = snapshot(await currentPersonaId());
  return NextResponse.json({ financialInputHash: s.financialInputHash, planningIncomePolicy: s.forecast.planningIncomePolicy, investable: s.investable, prefs: s.prefs, templates: TEMPLATES, concepts: CONCEPT_LIST, allocation: s.allocation });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const horizons = ["short", "medium", "long"];
  const risks = ["conservative", "balanced", "growth"];
  if (!horizons.includes(body.horizon) || !risks.includes(body.risk)) return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
  let custom: { cash: number; bonds: number; index: number } | undefined;
  if (body.custom) {
    const c = { cash: Number(body.custom.cash), bonds: Number(body.custom.bonds), index: Number(body.custom.index) };
    if (Object.values(c).some((v) => !(v >= 0 && v <= 100)) || Math.round(c.cash + c.bonds + c.index) !== 100) {
      return NextResponse.json({ error: "Mix must add up to 100%" }, { status: 400 });
    }
    custom = c;
  }
  const personaId = await currentPersonaId();
  update((d) => {
    d.personas[personaId].prefs = { horizon: body.horizon, risk: body.risk, custom };
  });
  return NextResponse.json({ ok: true });
}
