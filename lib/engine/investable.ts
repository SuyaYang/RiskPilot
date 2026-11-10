import type { Allocation, ForecastResult, Persona } from "../types";
import { daysBetween, parseIso, today } from "../dates";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface InvestableResult {
  currentBalance: number;
  buffer: number;
  minBalance: number;
  minBalanceDate: string;
  reservedForGoals: number;
  investable: number;
  monthlyToInvestGoals: number;
  checks: { id: string; label: string; ok: boolean }[];
}

/**
 * Investable now = lowest projected balance in the next 45 days − cash buffer − this month's
 * contributions to spending goals. It is 0 whenever a readiness check fails.
 */
export function investableNow(p: Persona, f: ForecastResult, alloc: Allocation): InvestableResult {
  const t = today();
  const spend = alloc.goals.filter((g) => g.type === "spend");
  const reserved = round2(spend.reduce((s, g) => s + g.allocatedThisMonth, 0));
  const shortTerm = spend.filter((g) => g.status !== "done" && g.status !== "paused" && daysBetween(t, parseIso(g.targetDate)) <= 180);
  const checks = [
    { id: "buffer", label: "Cash buffer holds for the next 45 days", ok: f.bufferGap >= 0 },
    { id: "stress", label: "Buffer still holds if income is a week late", ok: f.stressBufferGap >= 0 },
    { id: "goals", label: "Goals due within 6 months are on track", ok: shortTerm.every((g) => g.status === "on_track") },
  ];
  const raw = round2(f.bufferGap - reserved);
  const investable = checks.every((c) => c.ok) ? Math.max(0, raw) : 0;
  return {
    currentBalance: f.startBalance,
    buffer: p.buffer,
    minBalance: f.minBalance,
    minBalanceDate: f.minBalanceDate,
    reservedForGoals: reserved,
    investable: round2(investable),
    monthlyToInvestGoals: round2(alloc.goals.filter((g) => g.type === "invest").reduce((s, g) => s + g.allocatedThisMonth, 0)),
    checks,
  };
}

/** Educational asset-class templates. Users pick the row and column themselves. */
export const TEMPLATES: Record<string, Record<string, { label: string; cash: number; bonds: number; index: number }>> = {
  short: {
    conservative: { label: "Mostly cash & high-yield savings", cash: 90, bonds: 10, index: 0 },
    balanced: { label: "Mostly cash, some bond funds", cash: 70, bonds: 30, index: 0 },
    growth: { label: "Mostly bond funds", cash: 30, bonds: 60, index: 10 },
  },
  medium: {
    conservative: { label: "Mostly bond funds", cash: 20, bonds: 65, index: 15 },
    balanced: { label: "Bond funds and broad index funds", cash: 10, bonds: 45, index: 45 },
    growth: { label: "Mostly broad index funds", cash: 5, bonds: 25, index: 70 },
  },
  long: {
    conservative: { label: "Bond funds and broad index funds", cash: 10, bonds: 45, index: 45 },
    balanced: { label: "Mostly broad index funds", cash: 5, bonds: 25, index: 70 },
    growth: { label: "Broad index funds, small bond share", cash: 0, bonds: 15, index: 85 },
  },
};
