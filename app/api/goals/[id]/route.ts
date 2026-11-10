import { NextResponse } from "next/server";
import { currentPersonaId, snapshot } from "@/lib/state";
import { load, update } from "@/lib/store";
import { describeChange, validateGoal } from "@/lib/goalChanges";
import type { Goal } from "@/lib/types";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const personaId = await currentPersonaId();
  const current = load().personas[personaId].goals.find((g) => g.id === id);
  if (!current) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  const patch = (await req.json().catch(() => ({}))) as Partial<Goal>;
  const next: Goal = {
    ...current,
    ...(patch.name !== undefined && { name: String(patch.name).trim().slice(0, 60) }),
    ...(patch.targetAmount !== undefined && { targetAmount: Math.round(Number(patch.targetAmount)) }),
    ...(patch.targetDate !== undefined && { targetDate: patch.targetDate }),
    ...(patch.savedSoFar !== undefined && { savedSoFar: Math.round(Number(patch.savedSoFar)) }),
    ...(patch.priority !== undefined && { priority: Number(patch.priority) as Goal["priority"] }),
    ...(patch.paused !== undefined && { paused: Boolean(patch.paused) }),
  };
  const err = validateGoal(next);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const before = snapshot(personaId).allocation;
  update((d) => {
    const goals = d.personas[personaId].goals;
    goals[goals.findIndex((g) => g.id === id)] = next;
  });
  const changes = describeChange(before, snapshot(personaId).allocation);
  update((d) => {
    d.personas[personaId].goalHistory.unshift({ at: new Date().toISOString(), action: "update", goalId: id, name: next.name, summary: changes.join("; ") || "No change to expected dates" });
  });
  return NextResponse.json({ goal: next, changes });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const personaId = await currentPersonaId();
  const goal = load().personas[personaId].goals.find((g) => g.id === id);
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  const before = snapshot(personaId).allocation;
  update((d) => {
    d.personas[personaId].goals = d.personas[personaId].goals.filter((g) => g.id !== id);
  });
  const after = snapshot(personaId).allocation;
  const changes = describeChange({ ...before, goals: before.goals.filter((g) => g.goalId !== id) }, after);
  update((d) => {
    d.personas[personaId].goalHistory.unshift({ at: new Date().toISOString(), action: "delete", goalId: id, name: goal.name, summary: changes.join("; ") || "No change to other goals" });
  });
  return NextResponse.json({ ok: true, changes });
}
