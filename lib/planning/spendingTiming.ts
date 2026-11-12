import { addDays, iso, parseIso, today } from "../dates";
import type { Persona } from "../types";
import type { EverydaySpending } from "./spendingBaseline";

export const calendarDays = (date: string) => { const d = parseIso(date); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); };
/** The first remainder days receive one extra cent. Never re-charge days before effectiveFrom. */
export function monthlyDailyCents(monthlyCents: number, date: string) {
  const days = calendarDays(date);
  return Math.floor(monthlyCents / days) + (parseIso(date).getUTCDate() <= monthlyCents % days ? 1 : 0);
}
export function categoryDailyCents(category: EverydaySpending["categories"][number], date: string) {
  return category.override && date >= category.override.effectiveFrom ? monthlyDailyCents(category.override.monthlyCents, date) : category.dailyCents;
}
export function everydayCents(persona: Persona, date: string) {
  const model = persona.everydaySpending;
  if (!model || model.categories.reduce((sum, row) => sum + row.dailyCents, 0) !== Math.round(persona.dailySpend * 100)) return Math.round(persona.dailySpend * 100);
  return model.categories.reduce((sum, row) => sum + categoryDailyCents(row, date), 0);
}
export function everydayPeriodCents(persona: Persona, start: string, days: number) {
  let sum = 0;
  for (let d = 0; d < days; d++) sum += everydayCents(persona, iso(addDays(parseIso(start), d)));
  return sum;
}
/** Preserve the existing 30.4-day goal approximation; replace only applied categories with monthly amounts. */
export function everydayMonthlyAmount(persona: Persona) {
  let amount = persona.dailySpend * 30.4;
  if (persona.everydaySpending?.categories.reduce((sum, row) => sum + row.dailyCents, 0) !== Math.round(persona.dailySpend * 100)) return amount;
  for (const row of persona.everydaySpending?.categories || []) if (row.override && row.override.effectiveFrom <= iso(today())) amount += row.override.monthlyCents / 100 - row.dailyCents / 100 * 30.4;
  return amount;
}
