import crypto from "node:crypto";
import { addDays, iso, today } from "../dates";
import { occurrences } from "../engine/forecast";
import { normalizeMerchant } from "../spending/recurring";
import type { Persona, RecurringItem } from "../types";
import type { PersonaState } from "../store";
import { incomeDates } from "./calendar";
import { equivalentCadence, type EffectiveIncomeSchedule } from "./effectiveIncome";

export const modeledIncomeSignature = (item: RecurringItem) => crypto.createHash("sha256").update(JSON.stringify(item)).digest("hex");
export type IncomeIntegrationStatus = { status: "included" | "planning_only" | "needs_review"; reason: string };
/** Compile explicit mappings only; similarity can veto inclusion but cannot establish equivalence. */
export function compilePlanning(base: Persona, state: PersonaState | undefined, asOf = iso(today())) {
  const end = iso(addDays(new Date(`${asOf}T00:00:00Z`), 44));
  const entries = Object.values(state?.planningIncome?.schemaVersion === 1 ? state.planningIncome.entries : {}).map(entry =>
    entry.confirmedForecast && entry.status !== "paused" ? { ...entry, ...entry.confirmedForecast, status: "confirmed" as const } : entry);
  const statuses: Record<string, IncomeIntegrationStatus> = {};
  const replacedIncomeIds: string[] = [];
  const incomeSchedules: EffectiveIncomeSchedule[] = [];
  const events: { id: string; name: string; date: string; amountCents: number; source: "user_confirmed_plan" }[] = [];
  const income = base.recurring.filter(item => item.direction === "in");
  const dates = new Map(entries.map(entry => [entry.id, incomeDates(entry.nextDate, entry.frequency, asOf, end)]));
  for (const entry of entries) {
    const mapping = entry.forecastMapping;
    const set = (status: IncomeIntegrationStatus["status"], reason: string) => { statuses[entry.id] = { status, reason }; };
    if (entry.status !== "confirmed" || entry.sourceType !== "user_entered" || entry.reliability !== "expected") { set("planning_only", "Unconfirmed, paused, hypothetical or uncertain income is not an authoritative input."); continue; }
    if (!mapping) { set("planning_only", "Choose explicit forecast use; confirmation alone does not establish a safe mapping."); continue; }
    const activeOthers = entries.filter(other => other.id !== entry.id && other.status === "confirmed" && other.forecastMapping && other.sourceType === "user_entered" && other.reliability === "expected");
    const duplicate = activeOthers.some(other => normalizeMerchant(other.name) === normalizeMerchant(entry.name) || (other.amountCents === entry.amountCents && dates.get(other.id)!.some(date => dates.get(entry.id)!.includes(date))) || (mapping.kind === "replace" && other.forecastMapping?.kind === "replace" && mapping.modeledItemId === other.forecastMapping.modeledItemId));
    if (duplicate) { set("needs_review", "Potential duplicate mapped planning sources; keep the baseline until reviewed."); continue; }
    let replacement: EffectiveIncomeSchedule["replacement"];
    if (mapping.kind === "replace") {
      const item = income.find(item => item.id === mapping.modeledItemId);
      if (!item || modeledIncomeSignature(item) !== mapping.modeledSignature) { set("needs_review", "The identified modeled income changed or cannot be verified. Its baseline remains active."); continue; }
      replacedIncomeIds.push(item.id);
      replacement = { original: item, equivalentCadence: equivalentCadence(item, entry.frequency, entry.nextDate, asOf) };
    } else {
      const overlap = income.some(item => normalizeMerchant(item.name) === normalizeMerchant(entry.name) || (Math.round(item.amount * 100) === entry.amountCents && occurrences(item).some(day => dates.get(entry.id)!.includes(iso(addDays(new Date(`${asOf}T00:00:00Z`), day))))));
      if (overlap) { set("needs_review", "Possible modeled-income overlap. Select its exact replacement ID or keep this entry planning only."); continue; }
      if (!dates.get(entry.id)!.length) { set("planning_only", "No expected receipts occur in the current 45-day window."); continue; }
    }
    incomeSchedules.push({ id: entry.id, name: entry.name, amountCents: entry.amountCents, frequency: entry.frequency, nextDate: entry.nextDate, ...(replacement ? { replacement } : {}) });
    set("included", replacement ? "Replacement spans the required evaluation horizon. Stress uses only original-date matches, capped at the original amount and delayed seven days. Goal income requires equivalent biweekly cadence and is capped at the original amount; calendar months differ from legacy 30-day recurrence." : "Additional planned income spans the required evaluation horizon but is omitted from stress and long-term goal income.");
    for (const date of dates.get(entry.id)!) events.push({ id: entry.id, name: entry.name, date, amountCents: entry.amountCents, source: "user_confirmed_plan" });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)); replacedIncomeIds.sort();
  const planning = events.length || replacedIncomeIds.length ? { policy: "verified-planning-v1" as const, incomeEvents: events, replacedIncomeIds, incomeSchedules } : undefined;
  // Category integration is resolved by the category-coverage service, separately from income mappings.
  return { planning, income: statuses };
}
