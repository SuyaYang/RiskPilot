import { addDays, daysBetween, iso, parseIso } from "../dates";
import { occurrences } from "../engine/forecast";
import type { Payment, Persona } from "../types";
import { normalizeMerchant } from "../spending/recurring";
import { roundedRatio } from "../spending/money";
import type { PlanningBudgetView } from "./service";
import type { PlanningIncomeEntry } from "./incomeTypes";
import type { compilePlanning } from "./integration";
import { incomeDates, planningPeriod } from "./calendar";

export function incomeOverlap(entry: PlanningIncomeEntry, persona: Persona, asOf: string) {
  const period = planningPeriod(asOf);
  const dates = incomeDates(entry.nextDate, entry.frequency, period.start, period.end);
  return persona.recurring.filter(item => item.direction === "in" && (
    normalizeMerchant(item.name) === normalizeMerchant(entry.name) ||
    (Math.round(item.amount * 100) === entry.amountCents && occurrences(item, daysBetween(parseIso(asOf), parseIso(period.end)) + 1).some(day => dates.includes(iso(addDays(parseIso(asOf), day)))))
  )).map(item => ({ id: item.id, name: item.name }));
}
export function planningOverview(persona: Persona, payments: Payment[], entries: PlanningIncomeEntry[], budget: PlanningBudgetView, asOf: string, integration?: ReturnType<typeof compilePlanning>) {
  const period = planningPeriod(asOf), horizon = daysBetween(parseIso(asOf), parseIso(period.end)) + 1;
  const modeledEvents = persona.recurring.filter(item => !integration?.planning?.replacedIncomeIds.includes(item.id)).flatMap(item => occurrences(item, horizon).map(day => ({
    id: `modeled:${item.id}:${day}`, sourceId: item.id, name: item.name, date: iso(addDays(parseIso(asOf), day)),
    amountCents: Math.round(item.amount * 100), direction: item.direction, kind: "modeled" as const,
    included: !item.uncertain || item.direction === "out", reliability: item.uncertain ? "uncertain" as const : "expected" as const,
  })));
  const viewedEntries = entries.map(entry => {
    const dates = incomeDates(entry.nextDate, entry.frequency, period.start, period.end);
    const otherPlanning = entries.filter(other => other.id !== entry.id && other.status !== "paused" && (
      normalizeMerchant(other.name) === normalizeMerchant(entry.name) ||
      (other.amountCents === entry.amountCents && incomeDates(other.nextDate, other.frequency, period.start, period.end).some(date => dates.includes(date)))
    )).map(other => ({ id: other.id, name: other.name }));
    return { ...entry, forecastIntegration: integration?.income[entry.id] ?? { status: "planning_only" as const, reason: "No explicit forecast mapping." }, overlap: [...incomeOverlap(entry, persona, asOf), ...otherPlanning] };
  });
  const additionalEvents = viewedEntries.filter(entry => entry.status !== "paused").map(entry => entry.confirmedForecast ? { ...entry, ...entry.confirmedForecast, status: "confirmed" as const } : entry).flatMap(entry => incomeDates(entry.nextDate, entry.frequency, period.start, period.end).map(date => ({
    id: `${entry.id}:${date}`, sourceId: entry.id, name: entry.name, date, amountCents: entry.amountCents,
    direction: "in" as const, kind: "planning" as const, reliability: entry.reliability,
    status: entry.status, overlap: entry.overlap.length > 0,
    included: entry.status === "confirmed" && entry.reliability === "expected" && entry.sourceType !== "hypothetical" && (entry.overlap.length === 0 || entry.forecastIntegration.status === "included"),
  })));
  const reserveEvents = payments.filter(payment => payment.date > asOf && payment.date <= period.end).map((payment, index) => ({
    id: `reserve:${index}`, sourceId: "purchase-reserve", name: payment.label, date: payment.date,
    amountCents: Math.round(payment.amount * 100), direction: "out" as const, kind: "purchase_reserve" as const,
    included: true, reliability: "expected" as const,
  }));
  const events = [...modeledEvents, ...additionalEvents, ...reserveEvents].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const confirmed = budget.categories.filter(row => row.confirmedMonthlyCents !== null);
  const monthlyBudgetCents = confirmed.reduce((sum, row) => sum + row.confirmedMonthlyCents!, 0);
  const months = period.months.map(month => {
    const rows = events.filter(event => event.date >= month.start && event.date <= month.end);
    const sum = (filter: (event: typeof events[number]) => boolean) => rows.filter(filter).reduce((total, event) => total + event.amountCents, 0);
    const expectedIncomeCents = sum(event => event.direction === "in" && event.included);
    const scheduledExpensesCents = sum(event => event.direction === "out" && event.kind === "modeled");
    const purchaseReservesCents = sum(event => event.kind === "purchase_reserve");
    const everydayEstimateCents = Math.round(persona.dailySpend * 100) * month.days;
    const modeledOutgoingCents = scheduledExpensesCents + purchaseReservesCents + everydayEstimateCents;
    return { ...month, expectedIncomeCents, scheduledExpensesCents, purchaseReservesCents, everydayEstimateCents, modeledOutgoingCents,
      confirmedBudgetEstimateCents: roundedRatio(BigInt(monthlyBudgetCents) * BigInt(month.days), BigInt(month.calendarDays)),
      excludedIncomeCents: sum(event => event.direction === "in" && !event.included),
      partialDifferenceCents: expectedIncomeCents - modeledOutgoingCents,
      combinedOutgoingCents: null, // No invented budget-to-bill or budget-to-daily-spend reconciliation.
    };
  });
  return { period, months, events, entries: viewedEntries, confirmedBudgetCount: confirmed.length, monthlyBudgetCents,
    expenseReview: confirmed.map(row => ({ categoryId: row.categoryId, category: row.category,
      observation: row.confirmation!.evidence.observation, scheduledBills: row.overlap.scheduledBills,
      possibleEverydayOverlap: persona.dailySpend > 0, requiresReview: true as const })),
    modeledIncome: persona.recurring.filter(item => item.direction === "in").map(item => ({ id: item.id, name: item.name, amountCents: Math.round(item.amount * 100), currency: "USD" as const,
      forecastReplaced: integration?.planning?.replacedIncomeIds.includes(item.id) ?? false, frequency: item.frequency, nextDate: iso(addDays(parseIso(asOf), item.firstInDays)), sourceType: "modeled" as const,
      status: item.uncertain ? "uncertain" as const : "known" as const })),
  };
}
