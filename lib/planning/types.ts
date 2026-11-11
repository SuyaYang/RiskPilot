import type { SpendingCategory } from "../spending/types";

export type BudgetObservation = {
  coverageStart: string; coverageEnd: string; asOf: string; completeMonths: string[];
};
export type BudgetSuggestion = {
  categoryId: string; category: SpendingCategory;
  historicalMonthlyAverageCents: number | null; proposedMonthlyCents: number | null;
  observation: BudgetObservation; source: "local-sandbox-fixture";
  overlap: { requiresReview: boolean; scheduledBills: { id: string; name: string }[]; recurringMerchants: string[] };
};
export type BudgetConfirmation = {
  monthlyCents: number; confirmedAt: string; evidence: BudgetSuggestion;
};
export type BudgetEntry = {
  draftMonthlyCents?: number; confirmed?: BudgetConfirmation; updatedAt: string;
};
/** Planning assumptions only. Never read this state as a financial commitment. */
export type PlanningBudgetState = {
  schemaVersion: 1; epoch: string; version: number; categories: Record<string, BudgetEntry>;
};
