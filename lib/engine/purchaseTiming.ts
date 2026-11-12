import type { Allocation, Goal, Payment, Persona, PurchaseTiming } from "../types";
import { addDays, daysBetween, parseIso, iso, today } from "../dates";
import { forecast, HORIZON_DAYS, occurrences } from "./forecast";
import { allocateGoals, goalImpact } from "./goals";

/** Read-only fixed-date what-if. Never changes an order, schedules a debit or assumes income is certain. */
export function purchaseAfterIncome(p: Persona, goals: Goal[], existing: Payment[], amount: number, baseline: Allocation): PurchaseTiming {
  const income = [...p.recurring.filter(item => item.direction === "in" && !p.planning?.replacedIncomeIds.includes(item.id)).flatMap(item =>
    occurrences(item).filter(day => day > 0 && day + 1 < HORIZON_DAYS).map(day => ({ item, day })))
    , ...(p.planning?.incomeEvents || []).map(event => ({ item: { id: event.id, name: event.name, amount: event.amountCents / 100, uncertain: true }, day: daysBetween(today(), parseIso(event.date)) })).filter(event => event.day > 0 && event.day + 1 < HORIZON_DAYS)]
    .sort((a,b) => a.day-b.day || a.item.id.localeCompare(b.item.id))[0];
  if (!income) return { available:false, reason:"No future income date with a following purchase day is scheduled inside the 45-day window." };
  const purchaseDate = iso(addDays(today(),income.day+1));
  const payment = { date:purchaseDate, amount, label:"What-if purchase · after expected income" };
  const projected = forecast(p,existing,[payment]);
  const future = existing.filter(item => item.date > iso(today()));
  const allocation = allocateGoals(p,goals,[...future,payment],Math.max(0,-projected.bufferGap),Math.max(0,-forecast(p,existing.filter(x=>x.date<=iso(today()))).bufferGap));
  return { available:true, income:{name:income.item.name,date:iso(addDays(today(),income.day)),amount:income.item.amount,uncertain:!!income.item.uncertain},purchaseDate,forecast:projected,allocation,goalImpact:goalImpact(baseline,allocation),payment };
}
