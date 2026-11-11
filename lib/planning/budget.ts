import crypto from "node:crypto";
import { analyzeSpending, normalizeTransactions } from "../spending/analysis";
import { detectRecurring, normalizeMerchant } from "../spending/recurring";
import { SPENDING_CATEGORIES, type Coverage, type Transaction } from "../spending/types";
import type { Persona } from "../types";
import type { BudgetSuggestion } from "./types";

export const categoryId = (category: string) => category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");

/** Reuse the historical analyzer, including its full-month, refund and deduplication rules. */
export function budgetSuggestions(transactions: Transaction[], ownerId: string, coverage: Coverage, scheduled: Persona["recurring"]): BudgetSuggestion[] {
  const analysis = analyzeSpending(transactions, ownerId, coverage);
  const completeMonths = analysis.months.filter(month => month.complete).map(month => month.month);
  const observed = normalizeTransactions(transactions.filter(row => row.date <= coverage.end), ownerId).spending
    .filter(row => row.date >= coverage.start);
  const patterns = detectRecurring(transactions.filter(row => row.date <= coverage.end), ownerId, coverage.asOf);
  return SPENDING_CATEGORIES.flatMap(category => {
    const historical = analysis.categories.find(item => item.category === category);
    if (!historical) return [];
    const rows = observed.filter(row => row.category === category);
    // A category seen only in a partial month has no observed full-month amount to average.
    const hasFullObservation = rows.some(row => completeMonths.includes(row.date.slice(0, 7)));
    const average = hasFullObservation ? historical.averageMonthlyCents : null;
    const bills = scheduled.filter(item => item.direction === "out" && rows.some(row => row.scheduledItemId === item.id));
    const merchants = patterns.filter(pattern => rows.some(row => normalizeMerchant(row.merchantName || row.description) === normalizeMerchant(pattern.merchant))).map(pattern => pattern.merchant);
    const hinted = rows.some(row => row.recurringHint);
    return [{
      categoryId: categoryId(category), category, historicalMonthlyAverageCents: average,
      // Net refunds are valid observations, but never a negative proposed spending budget.
      proposedMonthlyCents: average === null ? null : Math.max(0, average),
      observation: { coverageStart: coverage.start, coverageEnd: coverage.end, asOf: coverage.asOf, completeMonths },
      source: coverage.source,
      overlap: { requiresReview: bills.length > 0 || merchants.length > 0 || hinted || category === "Housing and utilities" || category === "Subscriptions", scheduledBills: bills.map(({ id, name }) => ({ id, name })), recurringMerchants: [...new Set(merchants)] },
    }];
  });
}

export function budgetBasis(suggestions: BudgetSuggestion[]) {
  return crypto.createHash("sha256").update(JSON.stringify(suggestions)).digest("hex");
}
