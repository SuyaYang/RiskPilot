import crypto from "node:crypto";
import { CheckoutError, demoEnabled } from "../checkout";
import { iso, today, addDays } from "../dates";
import { validDate } from "../spending/analysis";
import { load, update, type StoreData } from "../store";
import { personaWithState } from "../state";
import { planningBudgetView } from "./service";
import { planningOverview } from "./overview";
import { INCOME_FREQUENCIES, type IncomeFrequency, type PlanningIncomeEntry, type PlanningIncomeState } from "./incomeTypes";

export function moneyPlanView(ownerId: string, data: StoreData = load()) {
  const saved = data.personas[ownerId];
  if (!saved) throw new CheckoutError("NOT_FOUND", "Planning profile not found", 404);
  const state = saved.planningIncome;
  if (state && state.schemaVersion !== 1) throw new CheckoutError("UNSUPPORTED_INCOME", "This income plan version cannot be edited", 409);
  const asOf = iso(today()), { persona, payments } = personaWithState(ownerId, data);
  // Deliberately separate from checkout input hashes; budget edits do not invalidate income forms.
  const basisHash = crypto.createHash("sha256").update(JSON.stringify({ ownerId, asOf, recurring: persona.recurring })).digest("hex");
  const budget = planningBudgetView(ownerId, data);
  return { schemaVersion: 1 as const, version: state?.version ?? 0, epoch: state?.epoch ?? "unsaved", basisHash, asOf,
    ...planningOverview(persona, payments, Object.values(state?.entries || {}), budget, asOf),
    policy: "Informational expectations only. Future income is not available cash today. The existing 45-day engine remains authoritative; this view does not calculate safe-to-spend or investable cash.",
  };
}
export type MoneyPlanView = ReturnType<typeof moneyPlanView>;
const allowedValues = ["name", "amountCents", "currency", "frequency", "nextDate", "sourceType", "reliability"];
function validateValues(input: Record<string, unknown>, asOf: string) {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80 || /[\u0000-\u001f]/.test(input.name) ||
    !Number.isSafeInteger(input.amountCents) || Number(input.amountCents) < 0 || Number(input.amountCents) > 100_000_000 || input.currency !== "USD" ||
    !INCOME_FREQUENCIES.includes(input.frequency as IncomeFrequency) || typeof input.nextDate !== "string" || !validDate(input.nextDate) || input.nextDate < asOf || input.nextDate > iso(addDays(today(), 366 * 5)) ||
    !["user_entered", "hypothetical"].includes(String(input.sourceType)) || !["expected", "uncertain"].includes(String(input.reliability)) || (input.sourceType === "hypothetical" && input.reliability !== "uncertain")) {
    throw new CheckoutError("INVALID_INCOME", "Enter a source (1–80 characters), nonnegative integer USD cents up to $1,000,000, supported frequency and a valid next date within five years. Hypothetical income must remain uncertain.", 400);
  }
  return { name: input.name.trim(), amountCents: Number(input.amountCents), currency: "USD" as const,
    frequency: input.frequency as IncomeFrequency, nextDate: input.nextDate, sourceType: input.sourceType as PlanningIncomeEntry["sourceType"], reliability: input.reliability as PlanningIncomeEntry["reliability"] };
}
export function updatePlanningIncome(ownerId: string, body: unknown) {
  if (!demoEnabled()) throw new CheckoutError("DEMO_DISABLED", "Demo planning is disabled", 404);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CheckoutError("INVALID_INCOME", "Invalid income request", 400);
  const input = body as Record<string, unknown>;
  const edits = input.action === "create" || input.action === "edit";
  const allowed = ["action", "id", "version", "epoch", "basisHash", ...(edits ? allowedValues : [])];
  if (Object.keys(input).some(key => !allowed.includes(key)) || !["create", "edit", "confirm", "pause", "remove"].includes(String(input.action)) ||
    !Number.isSafeInteger(input.version) || Number(input.version) < 0 || typeof input.epoch !== "string" || typeof input.basisHash !== "string" ||
    (input.action === "create" ? Object.hasOwn(input, "id") : typeof input.id !== "string")) throw new CheckoutError("INVALID_INCOME", "Choose an explicit action and current income-plan version", 400);
  return update(data => {
    const before = moneyPlanView(ownerId, data);
    if (before.version !== input.version || before.epoch !== input.epoch || before.basisHash !== input.basisHash) throw new CheckoutError("STALE_INCOME", "Income plan or date changed. Refresh before saving.", 409);
    const values = edits ? validateValues(input, before.asOf) : null;
    const state: PlanningIncomeState = data.personas[ownerId].planningIncome ??= { schemaVersion: 1, epoch: crypto.randomUUID(), version: 0, entries: {} };
    const now = new Date().toISOString();
    if (input.action === "create") {
      if (Object.keys(state.entries).length >= 20) throw new CheckoutError("INCOME_LIMIT", "Review or remove an existing entry before adding more than 20 income sources", 400);
      const id = crypto.randomUUID();
      state.entries[id] = { id, ...values!, status: "draft", createdAt: now, updatedAt: now, confirmedAt: null, version: 1 };
    } else {
      const entry = Object.hasOwn(state.entries, String(input.id)) ? state.entries[String(input.id)] : undefined;
      if (!entry) throw new CheckoutError("NOT_FOUND", "Income entry not found in this profile", 404);
      if (input.action === "remove") delete state.entries[entry.id];
      else {
        if (input.action === "edit") { Object.assign(entry, values); entry.status = "draft"; entry.confirmedAt = null; }
        if (input.action === "confirm") {
          if (entry.nextDate < before.asOf) throw new CheckoutError("OVERDUE_INCOME", "Review and update the next expected date before confirming this schedule", 409);
          entry.status = "confirmed"; entry.confirmedAt = now;
        }
        if (input.action === "pause") entry.status = "paused";
        entry.updatedAt = now; entry.version++;
      }
    }
    state.version++;
    return { plan: moneyPlanView(ownerId, data), forecastChanged: false,
      message: input.action === "create" || input.action === "edit" ? "Income draft saved. Confirm separately; current forecasts are unchanged." : "Income plan updated. Current forecasts are unchanged." };
  });
}
