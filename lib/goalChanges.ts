import type { Allocation, Goal } from "./types";
import { fmtDate } from "./dates";

/** Human summary of how goal ETAs moved after a change, computed from two allocations. */
export function describeChange(before: Allocation, after: Allocation): string[] {
  const out: string[] = [];
  for (const a of after.goals) {
    const b = before.goals.find((x) => x.goalId === a.goalId);
    if (!b) {
      out.push(`${a.name}: ${a.eta ? `expected ${fmtDate(a.eta)}` : "not reachable at current savings"}`);
      continue;
    }
    if (b.eta !== a.eta || b.status !== a.status) {
      const was = b.status === "paused" ? "paused" : b.eta ? fmtDate(b.eta) : "not reachable";
      const now = a.status === "paused" ? "paused" : a.eta ? fmtDate(a.eta) : "not reachable";
      out.push(`${a.name}: ${now} (was ${was})`);
    }
  }
  return out;
}

export function validateGoal(g: Partial<Goal>): string | null {
  if (!g.name || String(g.name).trim().length === 0) return "Name is required";
  if (!Number.isFinite(Number(g.targetAmount)) || !(Number(g.targetAmount) > 0)) return "Target amount must be positive";
  if (!g.targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(g.targetDate)) return "Target date must be YYYY-MM-DD";
  const date = new Date(`${g.targetDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== g.targetDate) return "Target date is invalid";
  if (g.type !== "spend" && g.type !== "invest") return "Type must be spend or invest";
  if (![1, 2, 3].includes(Number(g.priority))) return "Priority must be 1, 2 or 3";
  if (!Number.isFinite(Number(g.savedSoFar ?? 0)) || Number(g.savedSoFar ?? 0) < 0) return "Saved so far cannot be negative";
  return null;
}
