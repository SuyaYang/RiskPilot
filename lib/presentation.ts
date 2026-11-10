/** Display-only adapters. Financial amounts and decisions remain owned by the existing APIs. */
import { occurrences, HORIZON_DAYS } from "./engine/forecast";
import { addDays, iso, parseIso } from "./dates";
import type { RecurringItem, Payment } from "./types";
import type { InvestableResult } from "./engine/investable";

export function scheduledItems(recurring: RecurringItem[], payments: Payment[], asOf: string) {
  const start = parseIso(asOf), end = iso(addDays(start, HORIZON_DAYS));
  return [
    ...recurring.filter(item => item.direction === "out").flatMap(item => occurrences(item, HORIZON_DAYS)
      .map(day => ({ date: iso(addDays(start, day)), label: item.name, amount: item.amount, source: "Fictional bill" }))),
    ...payments.filter(item => item.date > asOf && item.date < end).map(item => ({ ...item, source: "Recorded reserve" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}
export function readinessView(result: Pick<InvestableResult, "investable" | "checks">) {
  const known = Number.isFinite(result.investable) && ["buffer", "stress", "goals"].every(id => result.checks.some(check => check.id === id)) && result.checks.every(check => typeof check.ok === "boolean");
  const held = result.checks.filter(check => check.ok === false);
  if (!known) return { status: "unknown" as const, label: "Readiness unavailable", explanation: "Readiness inputs are incomplete. Refresh the analysis before interpreting an allocation amount." };
  if (result.investable <= 0 || held.length) return { status: "hold" as const, label: "Keep your cash protected", explanation: held.length
    ? `The following checks have not passed: ${held.map(check => check.label.toLowerCase()).join("; ")}.`
    : "No cash remains available after the engine's buffer, stress and protected-goal checks." };
  return { status: "ready" as const, label: "Room to explore", explanation: "The engine reports cash capacity after its buffer, delayed-income and protected-goal checks. Allocation examples below are educational." };
}
export function progressPercent(saved: number, target: number) {
  return target > 0 && Number.isFinite(saved) && Number.isFinite(target) ? Math.max(0, Math.min(100, Math.round(saved / target * 100))) : 0;
}
