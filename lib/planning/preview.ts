import { CheckoutError, demoEnabled } from "../checkout";
import { inputHash, snapshot } from "../state";
import { load, type StoreData } from "../store";
import { roundedRatio } from "../spending/money";
import { planningPeriod } from "./calendar";
import { planningBudgetView } from "./service";

export function previewBudget(owner: string, body: unknown, data: StoreData = load()) {
  if (!demoEnabled()) throw new CheckoutError("DEMO_DISABLED", "Demo planning is disabled", 404);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CheckoutError("INVALID_PREVIEW", "Invalid preview request", 400);
  const request = body as Record<string, unknown>;
  if (Object.keys(request).some(key => !["categoryId", "monthlyCents", "version", "epoch", "basisHash", "financialInputHash"].includes(key)) ||
    typeof request.categoryId !== "string" || !Number.isSafeInteger(request.monthlyCents) || Number(request.monthlyCents) < 0 || Number(request.monthlyCents) > 100_000_000 ||
    !Number.isSafeInteger(request.version) || typeof request.epoch !== "string" || typeof request.basisHash !== "string" || typeof request.financialInputHash !== "string") {
    throw new CheckoutError("INVALID_PREVIEW", "Choose a category, nonnegative integer USD cents up to $1,000,000, and current planning versions", 400);
  }
  const budget = planningBudgetView(owner, data);
  if (request.version !== budget.version || request.epoch !== budget.epoch || request.basisHash !== budget.basisHash || request.financialInputHash !== inputHash(owner, data)) throw new CheckoutError("STALE_PREVIEW", "Budget, history or financial inputs changed. Refresh before previewing or confirming.", 409);
  const category = budget.categories.find(row => row.categoryId === request.categoryId);
  if (!category) throw new CheckoutError("NOT_FOUND", "Category not found in this profile's history", 404);
  // An existing confirmation is the original plan. Otherwise compare the system proposal, never a hidden draft.
  const originalMonthlyCents = category.confirmedMonthlyCents ?? category.proposedMonthlyCents;
  const originalSource = category.confirmedMonthlyCents !== null ? "user_confirmed" as const : category.proposedMonthlyCents !== null ? "system_suggestion" as const : "unavailable" as const;
  const adjustedMonthlyCents = Number(request.monthlyCents);
  const monthlyDifferenceCents = originalMonthlyCents === null ? null : adjustedMonthlyCents - originalMonthlyCents;
  const financial = snapshot(owner, data), period = planningPeriod(financial.asOf);
  const estimate = (amount: number, days: number, calendarDays: number) => roundedRatio(BigInt(amount) * BigInt(days), BigInt(calendarDays));
  return {
    categoryId: category.categoryId, category: category.category,
    originalMonthlyCents, originalSource, adjustedMonthlyCents, monthlyDifferenceCents,
    observation: category.observation, sourceLabel: budget.sourceLabel,
    months: period.months.map(month => {
      const originalEstimateCents = originalMonthlyCents === null ? null : estimate(originalMonthlyCents, month.days, month.calendarDays);
      const adjustedEstimateCents = estimate(adjustedMonthlyCents, month.days, month.calendarDays);
      return { ...month, originalEstimateCents, adjustedEstimateCents, differenceCents: originalEstimateCents === null ? null : adjustedEstimateCents - originalEstimateCents };
    }),
    replacement: { supported: false as const, requiredCoverage: "unknown" as const, reason: "The everyday-spending baseline has no verified category composition or complete expense-coverage contract. Observed categories and user confirmation cannot prove full replacement coverage. Bills, card repayments and purchase reserves stay separate and unchanged." },
    forecast: { changed: false as const, financialInputHash: financial.financialInputHash,
      minBalanceCents: Math.round(financial.forecast.minBalance * 100), stressMinBalanceCents: Math.round(financial.forecast.stressMinBalance * 100),
      bufferCents: Math.round(financial.persona.buffer * 100), availableToAllocateCents: Math.round(financial.investable.investable * 100), availableToAllocateDifferenceCents: 0 },
    confirmation: { categoryId: category.categoryId, monthlyCents: adjustedMonthlyCents, version: budget.version, epoch: budget.epoch, basisHash: budget.basisHash, financialInputHash: financial.financialInputHash },
    policy: "Illustrative budget estimates only, not guaranteed savings or future transaction dates. The authoritative 45-day forecast and available-to-allocate amount remain unchanged. Confirm saves a planning budget only.",
  };
}
export type BudgetPreview = ReturnType<typeof previewBudget>;
