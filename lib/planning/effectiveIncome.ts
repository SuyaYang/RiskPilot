import type { Persona, RecurringItem } from "../types";
import type { IncomeFrequency } from "./incomeTypes";
import { addDays, daysBetween, iso, parseIso, today } from "../dates";
import { incomeDates } from "./calendar";

export type EffectiveIncomeSchedule = {
  id: string; name: string; amountCents: number; frequency: IncomeFrequency; nextDate: string;
  replacement?: { original: RecurringItem; equivalentCadence: boolean };
};
/** Legacy monthly means 30 days, never calendar-month equivalence. Compare the actual next event. */
export function equivalentCadence(original: RecurringItem, frequency: IncomeFrequency, nextDate: string, asOf: string) {
  return original.frequency === "biweekly" && frequency === "biweekly" && nextDate <= iso(addDays(parseIso(asOf), original.firstInDays)) &&
    daysBetween(parseIso(nextDate), addDays(parseIso(asOf), original.firstInDays)) % 14 === 0;
}
/** Expand only for the simulator's requested horizon; the visible forecast stays 45 days. */
export function effectiveIncomeEvents(p: Persona, horizon: number, stressDays = 0) {
  const start = iso(today()), end = iso(addDays(today(), horizon - 1));
  if (!p.planning?.incomeSchedules) return stressDays ? [] : (p.planning?.incomeEvents ?? []);
  return p.planning.incomeSchedules.flatMap(schedule => {
    if (stressDays && !schedule.replacement) return [];
    const original = schedule.replacement?.original;
    const dates = incomeDates(schedule.nextDate, schedule.frequency, start, end);
    return dates.flatMap(date => {
      // A mapping is not evidence of a raise or changed receipt dates. Stress trusts only
      // receipts coinciding with the original schedule, at no more than its original amount.
      const offset = daysBetween(today(), parseIso(date));
      const step = original?.frequency === "biweekly" ? 14 : 30;
      const matches = original && offset >= original.firstInDays && (offset - original.firstInDays) % step === 0;
      if (stressDays && !matches) return [];
      const effectiveDate = iso(addDays(parseIso(date), stressDays));
      if (effectiveDate > end) return [];
      return [{ id:schedule.id, name:schedule.name, date:effectiveDate,
        amountCents:stressDays ? Math.min(schedule.amountCents, Math.round(original!.amount * 100)) : schedule.amountCents,
        source:"user_confirmed_plan" as const }];
    });
  });
}
/** Additional income and changed cadence remain outside long-term goal funding. */
export function establishedReplacementMonthly(p: Persona) {
  return (p.planning?.incomeSchedules ?? []).reduce((sum, schedule) => {
    const original = schedule.replacement?.original;
    return sum + (original && schedule.replacement?.equivalentCadence ? Math.min(original.amount, schedule.amountCents / 100) * 26 / 12 : 0);
  }, 0);
}
