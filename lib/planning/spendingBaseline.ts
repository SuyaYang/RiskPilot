import crypto from "node:crypto";
import type { Persona } from "../types";
import type { PersonaState } from "../store";
import { budgetSuggestions } from "./budget";
import { spendingFixture } from "../spending/fixtures";
import type { BudgetSuggestion } from "./types";

export const SPENDING_MODEL_VERSION = "alex-everyday-v1";
/** Declared fictional coverage, NOT a reconstruction of historical transactions or card debt. */
export const ALEX_SPENDING_BASELINE = [
  { categoryId: "food-and-dining", dailyCents: 1000, coverage: "New everyday groceries and dining; excludes existing card debt and separately scheduled obligations." },
  { categoryId: "transportation", dailyCents: 400, coverage: "Incidental transport only; excludes transit memberships and separately scheduled obligations." },
  { categoryId: "shopping", dailyCents: 300, coverage: "New discretionary goods; excludes existing card debt, PayPal purchase reserves and scheduled obligations." },
  { categoryId: "entertainment", dailyCents: 100, coverage: "One-off leisure; excludes subscriptions, memberships and scheduled obligations." },
  { categoryId: "other", dailyCents: 200, coverage: "Residual incidental household and personal consumables only; excludes housing, utilities, insurance, tuition, debt, subscriptions and purchase reserves. Broad Other budgets cannot replace it." },
] as const;
export const SPENDING_COVERAGE_SIGNATURE = crypto.createHash("sha256").update(JSON.stringify({ version: SPENDING_MODEL_VERSION, categories: ALEX_SPENDING_BASELINE, excluded: ["a-rent", "a-card", "a-phone", "a-subs", "all-purchase-reserves"] })).digest("hex");
export type EverydaySpending = {
  modelVersion: typeof SPENDING_MODEL_VERSION;
  coverageSignature: string;
  categories: { categoryId: string; dailyCents: number; override?: { monthlyCents: number; effectiveFrom: string } }[];
};
export function spendingModelAvailable(base: Persona, state?: PersonaState) {
  return state?.spendingBaseline?.modelVersion === SPENDING_MODEL_VERSION && base.id === "alex" && Math.round(base.dailySpend * 100) === 2000 &&
    base.recurring.filter(item => item.direction === "out").map(item => item.id).sort().join() === "a-card,a-phone,a-rent,a-subs";
}
export function categoryCoverage(base: Persona, state: PersonaState | undefined, category: BudgetSuggestion) {
  const declared = ALEX_SPENDING_BASELINE.find(row => row.categoryId === category.categoryId);
  const supported = spendingModelAvailable(base, state) && !!declared && category.categoryId !== "other" && !category.overlap.requiresReview;
  return { supported, modelVersion: spendingModelAvailable(base, state) ? SPENDING_MODEL_VERSION : null,
    dailyCents: supported ? declared!.dailyCents : null, coverage: declared?.coverage ?? null,
    reason: supported ? `Explicit fictional ${SPENDING_MODEL_VERSION} coverage: ${declared!.coverage} Apply explicitly to replace this category, never add it.` :
      "Category coverage is unresolved or may overlap a bill/recurring service, or this legacy profile has no category model. Bills, card repayments and purchase reserves stay separate and unchanged. Saving a budget remains planning only." };
}
export function compileSpending(base: Persona, state?: PersonaState, suggestions?: BudgetSuggestion[]): EverydaySpending | undefined {
  if (!spendingModelAvailable(base, state)) return undefined;
  const fixture = suggestions ? null : spendingFixture(base.id);
  const evidence = suggestions ?? budgetSuggestions(fixture!.transactions, base.id, fixture!.coverage, base.recurring);
  const eligible = new Set(evidence.filter(row => categoryCoverage(base, state, row).supported).map(row => row.categoryId));
  return { modelVersion: SPENDING_MODEL_VERSION, coverageSignature: SPENDING_COVERAGE_SIGNATURE,
    categories: ALEX_SPENDING_BASELINE.map(row => {
      const applied = state?.planningBudget?.schemaVersion === 1 ? state.planningBudget.categories[row.categoryId]?.applied : undefined;
      const valid = eligible.has(row.categoryId) && applied?.modelVersion === SPENDING_MODEL_VERSION && applied.coverageSignature === SPENDING_COVERAGE_SIGNATURE &&
        Number.isSafeInteger(applied.monthlyCents) && applied.monthlyCents >= 0 && applied.monthlyCents <= 100_000_000 && /^\d{4}-\d{2}-\d{2}$/.test(applied.effectiveFrom);
      return { categoryId: row.categoryId, dailyCents: row.dailyCents, ...(valid ? { override: { monthlyCents: applied.monthlyCents, effectiveFrom: applied.effectiveFrom } } : {}) };
    }) };
}
export { calendarDays, monthlyDailyCents, categoryDailyCents, everydayCents, everydayPeriodCents, everydayMonthlyAmount } from "./spendingTiming";
