import crypto from "node:crypto";
import { CheckoutError, demoEnabled } from "../checkout";
import { load, update, type StoreData } from "../store";
import { buildPersonas } from "../personas";
import { spendingFixture } from "../spending/fixtures";
import { budgetBasis, budgetSuggestions } from "./budget";
import { inputHash } from "../state";
import type { PlanningBudgetState } from "./types";

export const BUDGET_POLICY = "Planning assumptions only. Saving or confirming a budget does not change the 45-day forecast, cash buffer, goals or purchase assessments. Scheduled-bill overlap still requires review before forecast integration.";
export const newPlanningBudget = (): PlanningBudgetState => ({ schemaVersion: 1, epoch: crypto.randomUUID(), version: 0, categories: {} });

export function planningBudgetView(ownerId: string, data: StoreData = load()) {
  const persona = data.personas[ownerId];
  if (!persona) throw new CheckoutError("NOT_FOUND", "Planning profile not found", 404);
  const state = persona.planningBudget;
  if (state && state.schemaVersion !== 1) throw new CheckoutError("UNSUPPORTED_BUDGET", "This planning budget version cannot be edited.", 409);
  const fixture = spendingFixture(ownerId);
  const base = buildPersonas().find(item => item.id === ownerId.split(":").at(-1))!;
  const suggestions = budgetSuggestions(fixture.transactions, ownerId, fixture.coverage, base.recurring);
  return {
    schemaVersion: 1 as const, version: state?.version ?? 0, epoch: state?.epoch ?? "legacy-unsaved",
    basisHash: budgetBasis(suggestions), asOf: fixture.coverage.asOf,
    sourceLabel: "Simulated transaction history · no bank connected", forecastPolicy: BUDGET_POLICY,
    categories: suggestions.map(suggestion => {
      const saved = state?.categories[suggestion.categoryId];
      return { ...suggestion,
        forecastIntegration: { status: saved?.confirmed ? "needs_review" as const : "planning_only" as const, reason: "No verified category split exists for daily spending. Keep the baseline; this budget is not added to bills or purchase reserves." },
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
    !["edit", "confirm", "revert"].includes(String(input.action)) || typeof input.categoryId !== "string" ||
    !Number.isSafeInteger(input.version) || Number(input.version) < 0 || typeof input.epoch !== "string" || typeof input.basisHash !== "string") {
    throw new CheckoutError("INVALID_BUDGET", "Choose a category, explicit action and current budget version", 400);
  }
  if (Object.hasOwn(input, "financialInputHash") && (input.action !== "confirm" || typeof input.financialInputHash !== "string")) throw new CheckoutError("INVALID_BUDGET", "Financial freshness is supported for confirmation only", 400);
  if (input.action === "revert" ? Object.hasOwn(input, "monthlyCents") : !Number.isSafeInteger(input.monthlyCents) || Number(input.monthlyCents) < 0 || Number(input.monthlyCents) > 100_000_000) {
    throw new CheckoutError("INVALID_BUDGET", "Enter a nonnegative monthly budget in integer cents, up to $1,000,000", 400);
  }
  return update(data => {
    const before = planningBudgetView(ownerId, data);
    if (before.version !== input.version || before.epoch !== input.epoch || before.basisHash !== input.basisHash) throw new CheckoutError("STALE_BUDGET", "Budget or history changed. Refresh the spending plan before saving.", 409);
    if (input.financialInputHash !== undefined && input.financialInputHash !== inputHash(ownerId, data)) throw new CheckoutError("STALE_PREVIEW", "Financial inputs changed. Refresh the preview before confirming.", 409);
    const suggestion = before.categories.find(row => row.categoryId === input.categoryId);
    if (!suggestion) throw new CheckoutError("NOT_FOUND", "Category not found in this profile's history", 404);
    const state = data.personas[ownerId].planningBudget ??= newPlanningBudget();
    const prior = state.categories[suggestion.categoryId];
    const now = new Date().toISOString();
    if (input.action === "revert") {
      if (prior?.draftMonthlyCents === undefined) throw new CheckoutError("INVALID_BUDGET", "There is no saved draft to revert", 400);
      delete prior.draftMonthlyCents; prior.updatedAt = now;
    } else {
      const entry = state.categories[suggestion.categoryId] ??= { updatedAt: now };
      if (input.action === "edit") entry.draftMonthlyCents = Number(input.monthlyCents);
      else {
        const { categoryId, category, historicalMonthlyAverageCents, proposedMonthlyCents, observation, source, overlap } = suggestion;
        entry.confirmed = { monthlyCents: Number(input.monthlyCents), confirmedAt: now,
          evidence: { categoryId, category, historicalMonthlyAverageCents, proposedMonthlyCents, observation, source, overlap } };
        delete entry.draftMonthlyCents;
      }
      entry.updatedAt = now;
    }
    state.version++;
    return { budget: planningBudgetView(ownerId, data), forecastChanged: false, message: input.action === "confirm" ? "Budget confirmed for planning only. Forecast unchanged." : input.action === "edit" ? "Draft saved. Confirm explicitly when ready; forecast unchanged." : "Unconfirmed edit reverted. Forecast unchanged." };
  });
}
