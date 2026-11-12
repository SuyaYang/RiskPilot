import { addDays, daysBetween, iso, parseIso } from "../dates";
import { validDate } from "../spending/analysis";
import type { IncomeFrequency } from "./incomeTypes";

/** Clamp to the anchor day in each target month, without February causing permanent drift. */
export function calendarMonthDate(anchor: string, offset: number): string {
  const date = parseIso(anchor);
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(date.getUTCDate(), lastDay))));
}
export function incomeDates(nextDate: string, frequency: IncomeFrequency, start: string, end: string): string[] {
  if (![nextDate, start, end].every(validDate) || start > end || !["monthly", "biweekly", "quarterly", "once"].includes(frequency)) throw new Error("Invalid planning schedule");
  if (frequency === "once") return nextDate >= start && nextDate <= end ? [nextDate] : [];
  const dates: string[] = [];
  if (frequency === "biweekly") {
    const first = Math.max(0, Math.ceil(daysBetween(parseIso(nextDate), parseIso(start)) / 14));
    for (let date = addDays(parseIso(nextDate), first * 14); iso(date) <= end; date = addDays(date, 14)) dates.push(iso(date));
  } else {
    const step = frequency === "quarterly" ? 3 : 1;
    const anchor = parseIso(nextDate), from = parseIso(start);
    const diff = (from.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + from.getUTCMonth() - anchor.getUTCMonth();
    for (let i = Math.max(0, Math.floor(diff / step)); ; i++) {
      const date = calendarMonthDate(nextDate, i * step);
      if (date > end) break;
      if (date >= start) dates.push(date);
    }
  }
  return dates;
}
/** Current calendar-month remainder plus two complete months; financial dates are represented at UTC midnight for arithmetic. */
export function planningPeriod(asOf: string) {
  if (!validDate(asOf)) throw new Error("Invalid planning date");
  const anchor = `${asOf.slice(0, 7)}-01`;
  const months = [0, 1, 2].map(offset => {
    const monthStart = calendarMonthDate(anchor, offset), end = iso(addDays(parseIso(calendarMonthDate(anchor, offset + 1)), -1));
    const start = offset === 0 ? asOf : monthStart;
    return { month: monthStart.slice(0, 7), start, end, partial: start !== monthStart,
      days: daysBetween(parseIso(start), parseIso(end)) + 1, calendarDays: parseIso(end).getUTCDate() };
  });
  return { start: asOf, end: months[2].end, months };
}
