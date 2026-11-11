import { load, update, type StoreData } from "../store";
import { CheckoutError, demoEnabled } from "../checkout";
import { addDays, iso, today } from "../dates";
import { buildPersonas } from "../personas";
import { analyzeSpending, validDate } from "./analysis";
import { spendingFixture } from "./fixtures";
import { detectRecurring } from "./recurring";
import type { RecurringDecision, SpendingFrequency } from "./types";

export const FORECAST_POLICY = "Pattern confirmations are informational. They do not add or edit forecast commitments. Existing scheduled bills and verified PayPal reserves remain the forecast source; bank-debit matching is not implemented.";
export function spendingView(ownerId: string, data: StoreData = load()) {
  if (!data.personas[ownerId]) throw new CheckoutError("NOT_FOUND", "Spending profile not found", 404);
  const fixture = spendingFixture(ownerId);
  const stored = data.personas[ownerId].spending || { version: 0, decisions: {} };
  const base = buildPersonas().find(p => p.id === ownerId.split(":").at(-1))!;
  const candidates = detectRecurring(fixture.transactions, ownerId, fixture.coverage.asOf).map(candidate => {
    const decision = stored.decisions[candidate.id];
    const scheduled = base.recurring.find(item => item.id === candidate.scheduledItemId && item.direction === "out");
    return {
      ...candidate,
      detected: { merchant: candidate.merchant, amountCents: candidate.amountCents, frequency: candidate.frequency, nextDate: candidate.nextDate },
      merchant: decision?.merchant ?? candidate.merchant,
      amountCents: decision?.amountCents ?? candidate.amountCents,
      frequency: decision?.frequency ?? candidate.frequency,
      nextDate: decision && Object.hasOwn(decision, "nextDate") ? decision.nextDate ?? null : candidate.nextDate,
      status: decision?.status || "suggested" as const,
      edited: Boolean(decision && ["merchant", "amountCents", "frequency", "nextDate"].some(key => Object.hasOwn(decision, key))),
      forecastReference: scheduled ? { name: scheduled.name, amountCents: Math.round(scheduled.amount * 100), nextDate: iso(addDays(today(), scheduled.firstInDays)), frequency: scheduled.frequency } : null,
      forecastEffect: "informational" as const,
    };
  });
  return {
    mode: "local-sandbox-fixture" as const,
    sourceLabel: "Simulated transaction history · no bank connected",
    version: stored.version,
    forecastPolicy: FORECAST_POLICY,
    analysis: analyzeSpending(fixture.transactions, ownerId, fixture.coverage),
    candidates,
  };
}
export type SpendingView = ReturnType<typeof spendingView>;

export function updateRecurring(ownerId: string, id: string, body: Record<string, unknown>) {
  if (!demoEnabled()) throw new CheckoutError("DEMO_DISABLED", "Spending fixture demo is disabled", 404);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CheckoutError("INVALID_PATTERN", "Invalid pattern request", 400);
  const allowed = ["action", "version", "asOf", "merchant", "amountCents", "frequency", "nextDate"];
  if (Object.keys(body).some(key => !allowed.includes(key)) || !["confirm", "edit", "not_recurring"].includes(String(body.action)) || !Number.isSafeInteger(body.version) || Number(body.version) < 0) throw new CheckoutError("INVALID_PATTERN", "Choose a valid action and current version", 400);
  const asOf = iso(today());
  if (body.asOf !== asOf) throw new CheckoutError("STALE_SPENDING", "History date changed. Refresh spending before saving.");
  if (body.action !== "edit" && ["merchant", "amountCents", "frequency", "nextDate"].some(key => Object.hasOwn(body, key))) throw new CheckoutError("INVALID_PATTERN", "Use Edit to change estimates", 400);
  const edits: Partial<RecurringDecision> = {};
  if (body.action === "edit") {
    if (!["merchant", "amountCents", "frequency", "nextDate"].some(key => Object.hasOwn(body, key))) throw new CheckoutError("INVALID_PATTERN", "Enter a pattern edit", 400);
    if (body.merchant !== undefined) {
      if (typeof body.merchant !== "string" || body.merchant.trim().length < 2 || body.merchant.trim().length > 80 || /[\u0000-\u001f]/.test(body.merchant)) throw new CheckoutError("INVALID_PATTERN", "Merchant must be 2–80 characters", 400);
      edits.merchant = body.merchant.trim();
    }
    if (body.amountCents !== undefined) {
      if (!Number.isSafeInteger(body.amountCents) || Number(body.amountCents) <= 0 || Number(body.amountCents) > 10_000_000) throw new CheckoutError("INVALID_PATTERN", "Amount must be positive integer cents, up to $100,000", 400);
      edits.amountCents = Number(body.amountCents);
    }
    if (body.frequency !== undefined) {
      if (!["weekly", "biweekly", "monthly"].includes(String(body.frequency))) throw new CheckoutError("INVALID_PATTERN", "Choose weekly, biweekly or monthly", 400);
      edits.frequency = body.frequency as SpendingFrequency;
    }
    if (Object.hasOwn(body, "nextDate")) {
      if (body.nextDate !== null && (typeof body.nextDate !== "string" || !validDate(body.nextDate) || body.nextDate < asOf || body.nextDate > iso(addDays(today(), 366)))) throw new CheckoutError("INVALID_PATTERN", "Choose an estimated date within the next year, or leave it unknown", 400);
      edits.nextDate = body.nextDate as string | null;
    }
  }
  return update(data => {
    const view = spendingView(ownerId, data);
    if (view.version !== body.version) throw new CheckoutError("STALE_SPENDING", "Patterns changed. Refresh before saving.");
    if (!view.candidates.some(candidate => candidate.id === id)) throw new CheckoutError("NOT_FOUND", "Recurring candidate not found in this profile", 404);
    const state = data.personas[ownerId].spending ??= { version: 0, decisions: {} };
    const prior = state.decisions[id];
    state.decisions[id] = { ...prior, ...edits, status: body.action === "confirm" ? "confirmed" : body.action === "not_recurring" ? "rejected" : prior?.status || "suggested" };
    state.version++;
    // There is intentionally no write to purchases, balances, recurring schedules or capture snapshots.
    return { version: state.version, forecastChanged: false, message: "Pattern saved for review. Forecast commitments are unchanged.", spending: spendingView(ownerId, data) };
  });
}
