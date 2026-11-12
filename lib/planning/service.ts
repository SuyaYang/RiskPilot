import crypto from "node:crypto";
import { CheckoutError, demoEnabled } from "../checkout";
import { load, update, type StoreData } from "../store";
import { buildPersonas } from "../personas";
import { spendingFixture } from "../spending/fixtures";
import { budgetBasis, budgetSuggestions } from "./budget";
import { calendarDays, categoryCoverage, compileSpending, SPENDING_COVERAGE_SIGNATURE, SPENDING_MODEL_VERSION, spendingModelAvailable } from "./spendingBaseline";
import { iso, today } from "../dates";
import { inputHash, snapshot } from "../state";
import type { PlanningBudgetState } from "./types";

export const BUDGET_POLICY = "Suggestions, drafts and planning confirmations do not change forecasts. Only Apply to money plan replaces a covered everyday category. Scheduled bills and purchase reserves remain separate; unsupported categories stay planning only.";
export const newPlanningBudget = (): PlanningBudgetState => ({ schemaVersion: 1, epoch: crypto.randomUUID(), version: 0, categories: {} });

export function planningBudgetView(ownerId: string, data: StoreData = load()) {
  const persona = data.personas[ownerId];
  if (!persona) throw new CheckoutError("NOT_FOUND", "Planning profile not found", 404);
  const state = persona.planningBudget;
  if (state && state.schemaVersion !== 1) throw new CheckoutError("UNSUPPORTED_BUDGET", "This planning budget version cannot be edited.", 409);
  const fixture = spendingFixture(ownerId);
  const base = buildPersonas().find(item => item.id === ownerId.split(":").at(-1))!;
  const suggestions = budgetSuggestions(fixture.transactions, ownerId, fixture.coverage, base.recurring);
  const compiled = compileSpending(base, persona, suggestions);
  return {
    schemaVersion: 1 as const, version: state?.version ?? 0, epoch: state?.epoch ?? "legacy-unsaved",
    financialInputHash: inputHash(ownerId, data),
    baseline: { canEnable: !persona.spendingBaseline && spendingModelAvailable(base, { ...persona, spendingBaseline: { modelVersion: SPENDING_MODEL_VERSION } }), available: spendingModelAvailable(base, persona), modelVersion: spendingModelAvailable(base, persona) ? SPENDING_MODEL_VERSION : null, source: "Declared fictional demo model; not inferred from observed transactions" },
    basisHash: crypto.createHash("sha256").update(JSON.stringify({ ownerId, history: budgetBasis(suggestions), model: spendingModelAvailable(base, persona) ? SPENDING_COVERAGE_SIGNATURE : null })).digest("hex"), asOf: fixture.coverage.asOf,
    sourceLabel: "Simulated transaction history · no bank connected", forecastPolicy: BUDGET_POLICY,
    categories: suggestions.map(suggestion => {
      const saved = state?.categories[suggestion.categoryId];
      const coverage = categoryCoverage(base, persona, suggestion);
      const applied = compiled?.categories.find(row => row.categoryId === suggestion.categoryId)?.override ?? null;
      return { ...suggestion,
        forecastIntegration: { ...coverage, status: applied ? "included" as const : saved?.confirmed && !coverage.supported ? "needs_review" as const : "planning_only" as const,
          currentMonthlyCents: coverage.supported ? applied?.monthlyCents ?? coverage.dailyCents! * calendarDays(fixture.coverage.asOf) : null,
          appliedMonthlyCents: applied?.monthlyCents ?? null, effectiveFrom: applied?.effectiveFrom ?? null },
        draftMonthlyCents: saved?.draftMonthlyCents ?? null,
        confirmedMonthlyCents: saved?.confirmed?.monthlyCents ?? null,
        confirmation: saved?.confirmed ?? null, updatedAt: saved?.updatedAt ?? null,
        status: saved?.draftMonthlyCents !== undefined ? "draft" as const : saved?.confirmed ? "confirmed" as const : "suggested" as const,
      };
    }),
  };
}
export type PlanningBudgetView = ReturnType<typeof planningBudgetView>;

export function updatePlanningBudget(ownerId: string, body: unknown) {
  if (!demoEnabled()) throw new CheckoutError("DEMO_DISABLED", "Spending fixture demo is disabled", 404);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CheckoutError("INVALID_BUDGET", "Invalid budget request", 400);
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !["action", "categoryId", "monthlyCents", "version", "epoch", "basisHash", "financialInputHash"].includes(key)) ||
    !["edit", "confirm", "revert", "apply", "restore_baseline", "enable_baseline"].includes(String(input.action)) || typeof input.categoryId !== "string" ||
    !Number.isSafeInteger(input.version) || Number(input.version) < 0 || typeof input.epoch !== "string" || typeof input.basisHash !== "string") {
    throw new CheckoutError("INVALID_BUDGET", "Choose a category, explicit action and current budget version", 400);
  }
  const enableBaseline = input.action === "enable_baseline";
  const authoritative = input.action === "apply" || input.action === "restore_baseline";
  if (((authoritative || enableBaseline) && typeof input.financialInputHash !== "string") || (Object.hasOwn(input, "financialInputHash") && (!["confirm", "apply", "restore_baseline", "enable_baseline"].includes(String(input.action)) || typeof input.financialInputHash !== "string"))) throw new CheckoutError("INVALID_BUDGET", "Current financial freshness is required for application or restoration", 400);
  if (["revert", "restore_baseline", "enable_baseline"].includes(String(input.action)) ? Object.hasOwn(input, "monthlyCents") : !Number.isSafeInteger(input.monthlyCents) || Number(input.monthlyCents) < 0 || Number(input.monthlyCents) > 100_000_000) {
    throw new CheckoutError("INVALID_BUDGET", "Enter a nonnegative monthly budget in integer cents, up to $1,000,000", 400);
  }
  return update(data => {
    const before = planningBudgetView(ownerId, data);
    if (before.version !== input.version || before.epoch !== input.epoch || before.basisHash !== input.basisHash) throw new CheckoutError("STALE_BUDGET", "Budget or history changed. Refresh the spending plan before saving.", 409);
    if (input.financialInputHash !== undefined && input.financialInputHash !== inputHash(ownerId, data)) throw new CheckoutError("STALE_PREVIEW", "Financial inputs changed. Refresh the preview before confirming.", 409);
    const suggestion = before.categories.find(row => row.categoryId === input.categoryId);
    if (!suggestion) throw new CheckoutError("NOT_FOUND", "Category not found in this profile's history", 404);
    if (authoritative && !suggestion.forecastIntegration.supported) throw new CheckoutError("UNSUPPORTED_COVERAGE", suggestion.forecastIntegration.reason, 409);
    if (enableBaseline && !before.baseline.canEnable) throw new CheckoutError("UNSUPPORTED_COVERAGE", "This profile cannot enable the Alex category model", 409);
    const oldHash = inputHash(ownerId, data);
    const state = data.personas[ownerId].planningBudget ??= newPlanningBudget();
    const prior = state.categories[suggestion.categoryId];
    const now = new Date().toISOString();
    if (enableBaseline) {
      data.personas[ownerId].spendingBaseline = { modelVersion: SPENDING_MODEL_VERSION };
    } else if (input.action === "restore_baseline") {
      if (!prior?.applied) throw new CheckoutError("INVALID_BUDGET", "No applied category override to restore", 400);
      delete prior.applied; prior.updatedAt = now;
    } else if (input.action === "revert") {
      if (prior?.draftMonthlyCents === undefined) throw new CheckoutError("INVALID_BUDGET", "There is no saved draft to revert", 400);
      delete prior.draftMonthlyCents; prior.updatedAt = now;
    } else {
      const entry = state.categories[suggestion.categoryId] ??= { updatedAt: now };
      if (input.action === "edit") entry.draftMonthlyCents = Number(input.monthlyCents);
      else {
        const { categoryId, category, historicalMonthlyAverageCents, proposedMonthlyCents, observation, source, overlap } = suggestion;
        entry.confirmed = { monthlyCents: Number(input.monthlyCents), confirmedAt: now,
          evidence: { categoryId, category, historicalMonthlyAverageCents, proposedMonthlyCents, observation, source, overlap } };
        if (input.action === "apply" && (prior?.applied || Number(input.monthlyCents) !== suggestion.forecastIntegration.currentMonthlyCents)) entry.applied = { monthlyCents: Number(input.monthlyCents), effectiveFrom: prior?.applied?.monthlyCents === Number(input.monthlyCents) ? prior.applied.effectiveFrom : iso(today()), modelVersion: SPENDING_MODEL_VERSION, coverageSignature: SPENDING_COVERAGE_SIGNATURE, appliedAt: now };
        delete entry.draftMonthlyCents;
      }
      entry.updatedAt = now;
    }
    state.version++;
    const forecastChanged = oldHash !== inputHash(ownerId, data);
    if (authoritative || enableBaseline) {
      const current = snapshot(ownerId, data);
      data.personas[ownerId].moneyPlanSnapshot = { asOf: current.asOf, financialInputHash: current.financialInputHash, forecast: current.forecast, allocation: current.allocation, investable: current.investable };
    }
    return { budget: planningBudgetView(ownerId, data), forecastChanged, message: enableBaseline ? "Alex category model enabled. Existing budgets remain planning only; forecast unchanged." : input.action === "apply" ? forecastChanged ? "Applied money plan. Covered category replaced; shared forecast refreshed." : "No financial change. Existing daily or monthly spending model retained." : input.action === "restore_baseline" ? "Category baseline restored. Shared forecast refreshed." : input.action === "confirm" ? "Budget confirmed for planning only. Forecast unchanged." : input.action === "edit" ? "Draft saved. Confirm explicitly when ready; forecast unchanged." : "Unconfirmed edit reverted. Forecast unchanged." };
  });
}
