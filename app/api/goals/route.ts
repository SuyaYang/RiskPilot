import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { currentPersonaId, snapshot } from "@/lib/state";
import { update } from "@/lib/store";
import { describeChange, validateGoal } from "@/lib/goalChanges";
import type { Goal } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = snapshot(await currentPersonaId());
  return NextResponse.json({ financialInputHash: s.financialInputHash, goals: s.goals, allocation: s.allocation, history: s.goalHistory });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Goal>;
  const err = validateGoal(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const personaId = await currentPersonaId();
  const before = snapshot(personaId).allocation;
  const goal: Goal = {
    id: crypto.randomUUID(),
    version: 1,
    name: String(body.name).trim().slice(0, 60),
    type: body.type!,
    targetAmount: Math.round(Number(body.targetAmount) * 100) / 100,
    targetDate: body.targetDate!,
    savedSoFar: Math.round(Number(body.savedSoFar ?? 0) * 100) / 100,
    priority: Number(body.priority) as Goal["priority"],
  };
  update((d) => {
    d.personas[personaId].goals.push(goal);
  });
  const after = snapshot(personaId).allocation;
  const changes = describeChange(before, after);
  update((d) => {
    d.personas[personaId].goalHistory.unshift({ at: new Date().toISOString(), action: "create", goalId: goal.id, name: goal.name, summary: changes.join("; ") });
  });
  return NextResponse.json({ goal, changes });
}
