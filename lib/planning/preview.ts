import { CheckoutError, demoEnabled } from "../checkout";
import { inputHash, snapshot } from "../state";
import { load, type StoreData } from "../store";
import { roundedRatio } from "../spending/money";
import { planningPeriod } from "./calendar";
import { addDays, iso, parseIso } from "../dates";
import { categoryDailyCents, SPENDING_MODEL_VERSION, SPENDING_COVERAGE_SIGNATURE } from "./spendingBaseline";
import { personaWithState } from "../state";
import { newPlanningBudget, planningBudgetView } from "./service";

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
  // Covered categories compare the currently authoritative assumption. Legacy comparisons use confirmations or proposals, never a hidden draft.
  const supported = category.forecastIntegration.supported;
  const originalMonthlyCents = category.forecastIntegration.currentMonthlyCents ?? category.confirmedMonthlyCents ?? category.proposedMonthlyCents;
  const originalSource = supported ? category.forecastIntegration.appliedMonthlyCents !== null ? "applied_money_plan" as const : "declared_baseline" as const : category.confirmedMonthlyCents !== null ? "user_confirmed" as const : category.proposedMonthlyCents !== null ? "system_suggestion" as const : "unavailable" as const;
  const adjustedMonthlyCents = Number(request.monthlyCents);
  const monthlyDifferenceCents = originalMonthlyCents === null ? null : adjustedMonthlyCents - originalMonthlyCents;
  const financial = snapshot(owner, data), period = planningPeriod(financial.asOf);
  const scenarioData = { ...data, personas: { ...data.personas, [owner]: structuredClone(data.personas[owner]) } };
  const baselineNoOp = supported && category.forecastIntegration.appliedMonthlyCents === null && adjustedMonthlyCents === originalMonthlyCents;
  if (supported && !baselineNoOp) {
    const state = scenarioData.personas[owner].planningBudget ??= newPlanningBudget();
    const entry = state.categories[category.categoryId] ??= { updatedAt: "preview-only" };
    entry.applied = { monthlyCents: adjustedMonthlyCents, effectiveFrom: entry.applied?.monthlyCents === adjustedMonthlyCents ? entry.applied.effectiveFrom : financial.asOf, modelVersion: SPENDING_MODEL_VERSION, coverageSignature: SPENDING_COVERAGE_SIGNATURE, appliedAt: "preview-only" };
  }
  const scenario = supported ? snapshot(owner, scenarioData) : financial;
  const facts = (value: typeof financial) => ({ minBalanceCents: Math.round(value.forecast.minBalance * 100), stressMinBalanceCents: Math.round(value.forecast.stressMinBalance * 100),
    bufferHolds: value.forecast.bufferGap >= 0, stressBufferHolds: value.forecast.stressBufferGap >= 0,
    availableToAllocateCents: Math.round(value.investable.investable * 100), checks: value.investable.checks,
    failedChecks: value.investable.checks.filter(check => !check.ok).map(check => check.id === "goals" ? "Near-term goals are not on track" : check.id === "stress" ? "Delayed income breaks the cash buffer" : check.id === "buffer" ? "Projected cash falls below the buffer" : `Unmet check: ${check.label}`), risk: value.forecast.risk });
  const currentCategory = personaWithState(owner, data).persona.everydaySpending?.categories.find(row => row.categoryId === category.categoryId);
  const scenarioCategory = personaWithState(owner, scenarioData).persona.everydaySpending?.categories.find(row => row.categoryId === category.categoryId);
  const categoryEstimate = (row: NonNullable<typeof currentCategory>, start: string, days: number) => {
    let sum = 0; for (let d = 0; d < days; d++) sum += categoryDailyCents(row, iso(addDays(parseIso(start), d))); return sum;
  };
  const estimate = (amount: number, days: number, calendarDays: number) => roundedRatio(BigInt(amount) * BigInt(days), BigInt(calendarDays));
  return {
    categoryId: category.categoryId, category: category.category,
    originalMonthlyCents, originalSource, adjustedMonthlyCents, monthlyDifferenceCents,
    observation: category.observation, sourceLabel: budget.sourceLabel,
    months: period.months.map(month => {
      const originalEstimateCents = supported && currentCategory ? categoryEstimate(currentCategory, month.start, month.days) : originalMonthlyCents === null ? null : estimate(originalMonthlyCents, month.days, month.calendarDays);
      const adjustedEstimateCents = supported && scenarioCategory ? categoryEstimate(scenarioCategory, month.start, month.days) : estimate(adjustedMonthlyCents, month.days, month.calendarDays);
      return { ...month, originalEstimateCents, adjustedEstimateCents, differenceCents: originalEstimateCents === null ? null : adjustedEstimateCents - originalEstimateCents };
    }),
    replacement: { supported, requiredCoverage: supported ? "explicit-demo-category" as const : "unknown" as const, reason: category.forecastIntegration.reason },
    forecast: { current: facts(financial), scenario: facts(scenario), changed: financial.financialInputHash !== scenario.financialInputHash, financialInputHash: financial.financialInputHash,
      minBalanceCents: Math.round(financial.forecast.minBalance * 100), stressMinBalanceCents: Math.round(financial.forecast.stressMinBalance * 100),
      bufferCents: Math.round(financial.persona.buffer * 100), availableToAllocateCents: Math.round(financial.investable.investable * 100), availableToAllocateDifferenceCents: Math.round((scenario.investable.investable - financial.investable.investable) * 100) },
    confirmation: { categoryId: category.categoryId, monthlyCents: adjustedMonthlyCents, version: budget.version, epoch: budget.epoch, basisHash: budget.basisHash, financialInputHash: financial.financialInputHash },
    policy: supported ? "Scenario preview, not guaranteed savings. Matching the daily baseline’s current calendar-month equivalent keeps the daily model unchanged. A different amount explicitly converts to a fixed calendar-month budget; future month lengths can change spending. Goal contributions retain the existing 30.4-day normalization for daily categories. Apply to money plan explicitly replaces this covered category from today forward. Monthly cents are spread across actual calendar days; remainder cents go to the earliest days. Past days are not charged again. Current-cash, stress and goal safeguards still apply." : "Illustrative budget estimates only, not guaranteed savings or future transaction dates. The authoritative 45-day forecast and available-to-allocate amount remain unchanged. Confirm saves a planning budget only.",
  };
}
export type BudgetPreview = ReturnType<typeof previewBudget>;
