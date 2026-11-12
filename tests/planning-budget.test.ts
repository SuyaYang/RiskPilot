import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { budgetSuggestions, categoryId } from "../lib/planning/budget";
import { buildPersonas } from "../lib/personas";
import type { Coverage, Transaction } from "../lib/spending/types";

Object.assign(globalThis, { AsyncLocalStorage });
process.env.DEMO_TODAY = "2026-11-10";
const owner = "budget-a:alex";
const coverage: Coverage = { start: "2026-08-01", end: "2026-11-09", asOf: "2026-11-10", source: "local-sandbox-fixture" };
const tx = (id: string, date: string, amountCents: number, patch: Partial<Transaction> = {}): Transaction => ({ id, ownerId: owner, accountId: "checking", merchantName: "Merchant", description: "Merchant", date, amountCents, category: "Food and dining", currency: "USD", source: "local-sandbox-fixture", status: "posted", kind: "expense", ...patch });
const suggestions = (rows: Transaction[], period = coverage) => budgetSuggestions(rows, owner, period, buildPersonas()[0].recurring);

test("budget category means reuse complete observed months and exclude the current partial month", () => {
  const rows = [tx("aug", "2026-08-02", 1000), tx("sep", "2026-09-02", 2000), tx("oct", "2026-10-02", 3001), tx("partial", "2026-11-02", 999999)];
  const result = suggestions(rows)[0];
  assert.equal(result.historicalMonthlyAverageCents, 2000); assert.equal(result.proposedMonthlyCents, 2000);
  assert.deepEqual(result.observation.completeMonths, ["2026-08", "2026-09", "2026-10"]);
  assert.equal(result.source, "local-sandbox-fixture"); assert.equal(result.categoryId, "food-and-dining");
});
test("budget averages use refund posting dates and original categories without duplicate spending", () => {
  const debit = tx("purchase", "2026-08-02", 20000, { category: "Shopping" });
  const result = suggestions([debit, { ...debit }, tx("sep", "2026-09-02", 1000, { category: "Shopping" }), tx("refund", "2026-09-04", -5000, { kind: "refund", originalTransactionId: "purchase" })]);
  assert.equal(result.length, 1); assert.equal(result[0].category, "Shopping"); assert.equal(result[0].historicalMonthlyAverageCents, 8000);
});
test("transfers, card repayments, pending, reversed and foreign rows never become budget spending", () => {
  const rows = [tx("valid", "2026-08-02", 1000), tx("transfer", "2026-08-03", 50000, { kind: "internal_transfer" }), tx("card", "2026-08-04", 50000, { kind: "credit_card_payment" }), tx("pending", "2026-08-05", 50000, { status: "pending" }), tx("reversed", "2026-08-06", 50000, { status: "reversed" }), tx("foreign", "2026-08-07", 50000, { ownerId: "other:alex" })];
  assert.equal(suggestions(rows)[0].historicalMonthlyAverageCents, 1000);
});
test("empty, partial-only, missing-month and partial-only-category history is not invented", () => {
  assert.deepEqual(suggestions([]), []);
  assert.equal(suggestions([tx("partial", "2026-11-02", 2000)])[0].proposedMonthlyCents, null);
  const rows = [tx("aug", "2026-08-02", 1000), tx("oct", "2026-10-02", 3000), tx("partial", "2026-11-02", 99999, { category: "Shopping" })];
  const result = suggestions(rows);
  assert.equal(result.find(row => row.category === "Shopping")?.historicalMonthlyAverageCents, null);
  assert.equal(result.find(row => row.category === "Food and dining")?.historicalMonthlyAverageCents, 2000);
  assert.deepEqual(result[0].observation.completeMonths, ["2026-08", "2026-10"]);
});
test("a category's zero total in another observed complete month is included in its average", () => {
  const rows = [tx("food", "2026-08-02", 1000), tx("shopping", "2026-09-02", 2000, { category: "Shopping" })];
  assert.equal(suggestions(rows).find(row => row.category === "Food and dining")?.proposedMonthlyCents, 500);
});
test("net refunds stay visible as negative history while the proposed budget is floored at zero", () => {
  const result = suggestions([tx("refund", "2026-08-02", -1234, { kind: "refund" })])[0];
  assert.equal(result.historicalMonthlyAverageCents, -1234); assert.equal(result.proposedMonthlyCents, 0);
});
test("exact scheduled references and uncertain recurring categories are flagged without subtracting amounts", () => {
  const rows = [tx("rent", "2026-08-02", 140000, { category: "Housing and utilities", scheduledItemId: "a-rent", recurringHint: "housing" }), tx("service", "2026-08-03", 1500, { category: "Subscriptions" })];
  const result = suggestions(rows);
  const rent = result.find(row => row.category === "Housing and utilities")!;
  assert.equal(rent.proposedMonthlyCents, 140000); assert.equal(rent.overlap.requiresReview, true); assert.ok(rent.overlap.scheduledBills.some(item => item.id === "a-rent"));
  assert.equal(result.find(row => row.category === "Subscriptions")?.overlap.requiresReview, true);
});

test("budget writes are explicit, versioned, persistent, persona-scoped and isolated from all authoritative finances", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riskpilot-budget-"));
  process.env.STORE_PATH = path.join(dir, "store.json"); process.env.DEMO_SEED_ENABLED = "true";
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { ensurePersona, load, update, reset } = await import("../lib/store");
  const { snapshot, inputHash } = await import("../lib/state");
  const { planningBudgetView, updatePlanningBudget } = await import("../lib/planning/service");
  const { buildOptions } = await import("../lib/engine/options");
  const { getProduct } = await import("../lib/catalog");
  const { personaWithState } = await import("../lib/state");
  const other = "budget-b:alex", sameWorkspace = "budget-a:sam";
  for (const id of [owner, other, sameWorkspace]) ensurePersona(id);
  const initial = planningBudgetView(owner), category = initial.categories.find(row => row.categoryId === categoryId("Food and dining"))!;
  const command = (action: string, monthlyCents?: unknown, view = planningBudgetView(owner)) => ({ action, categoryId: category.categoryId, version: view.version, epoch: view.epoch, basisHash: view.basisHash, ...(monthlyCents === undefined ? {} : { monthlyCents }) });
  for (const id of [other, sameWorkspace]) {
    const view = planningBudgetView(id);
    updatePlanningBudget(id, { action: "confirm", categoryId: view.categories[0].categoryId, monthlyCents: 7654, version: view.version, epoch: view.epoch, basisHash: view.basisHash });
  }
  const before = snapshot(owner), hash = inputHash(owner), otherBefore = load().personas[other], sameBefore = load().personas[sameWorkspace];
  const purchaseOptions = () => { const { persona, payments } = personaWithState(owner); return buildOptions(persona, persona.goals, payments, getProduct("aero-14")!); };
  const optionsBefore = purchaseOptions();
  function unchanged() { assert.deepEqual(snapshot(owner), before); assert.equal(inputHash(owner), hash); assert.deepEqual(purchaseOptions(), optionsBefore); assert.deepEqual(load().personas[other], otherBefore); assert.deepEqual(load().personas[sameWorkspace], sameBefore); }
  await t.test("GET suggestions never auto-confirm or create state", () => {
    assert.equal(load().personas[owner].planningBudget, undefined);
    assert.ok(initial.categories.every(row => row.status === "suggested" && row.confirmedMonthlyCents === null && row.updatedAt === null)); unchanged();
  });
  await t.test("save creates a persisted unconfirmed draft without changing forecasts or purchase scenarios", () => {
    const result = updatePlanningBudget(owner, command("edit", 12345));
    assert.equal(result.forecastChanged, false); const row = result.budget.categories.find(row => row.categoryId === category.categoryId)!;
    assert.equal(row.status, "draft"); assert.equal(row.draftMonthlyCents, 12345); assert.equal(row.confirmedMonthlyCents, null);
    assert.ok(row.updatedAt); assert.equal(result.budget.version, 1); unchanged();
    assert.equal(JSON.parse(fs.readFileSync(process.env.STORE_PATH!, "utf8")).personas[owner].planningBudget.categories[category.categoryId].draftMonthlyCents, 12345);
    assert.equal(planningBudgetView(owner).categories.find(row => row.categoryId === category.categoryId)?.draftMonthlyCents, 12345);
  });
  await t.test("confirmation is explicit and snapshots its historical source", () => {
    const result = updatePlanningBudget(owner, command("confirm", 12345));
    const row = result.budget.categories.find(row => row.categoryId === category.categoryId)!;
    assert.equal(row.status, "confirmed"); assert.equal(row.confirmedMonthlyCents, 12345); assert.equal(row.draftMonthlyCents, null);
    assert.ok(row.confirmation?.confirmedAt); assert.deepEqual(row.confirmation?.evidence.observation, category.observation); unchanged();
  });
  await t.test("editing a confirmed budget never confirms the new value; revert restores the old confirmation", () => {
    updatePlanningBudget(owner, command("edit", 22222));
    let row = planningBudgetView(owner).categories.find(row => row.categoryId === category.categoryId)!;
    assert.equal(row.status, "draft"); assert.equal(row.confirmedMonthlyCents, 12345); assert.equal(row.draftMonthlyCents, 22222); unchanged();
    updatePlanningBudget(owner, command("revert")); row = planningBudgetView(owner).categories.find(row => row.categoryId === category.categoryId)!;
    assert.equal(row.status, "confirmed"); assert.equal(row.confirmedMonthlyCents, 12345); assert.equal(row.draftMonthlyCents, null); unchanged();
  });
  await t.test("invalid amounts, malformed bodies, extra owner fields and implicit actions are rejected without writes", () => {
    const saved = load();
    for (const monthlyCents of [-1, 1.5, NaN, Infinity, "10", null, 100_000_001]) assert.throws(() => updatePlanningBudget(owner, command("edit", monthlyCents)), /nonnegative/);
    for (const body of [null, [], {}, command("save", 10), { ...command("edit", 10), ownerId: other }, { ...command("edit", 10), status: "confirmed" }, command("confirm"), command("revert", 5)]) assert.throws(() => updatePlanningBudget(owner, body));
    assert.deepEqual(load(), saved);
  });
  await t.test("stale versions, epochs and history bases reject conflicts and cross-persona requests", () => {
    assert.throws(() => updatePlanningBudget(owner, command("confirm", 10, initial)), /Refresh/);
    assert.throws(() => updatePlanningBudget(owner, { ...command("confirm", 10), basisHash: "stale" }), /Refresh/);
    assert.throws(() => updatePlanningBudget(owner, { ...command("confirm", 10), epoch: "stale" }), /Refresh/);
    assert.throws(() => updatePlanningBudget(other, command("confirm", 10)), /Refresh/);
    assert.throws(() => updatePlanningBudget(sameWorkspace, command("confirm", 10)), /Refresh/);
    assert.throws(() => updatePlanningBudget(owner, { ...command("edit", 10), categoryId: "unknown" }), /Category not found/); unchanged();
  });
  await t.test("zero budgets are valid, confirmation remains fixed as historical suggestions change", () => {
    updatePlanningBudget(owner, command("confirm", 0));
    const confirmation = planningBudgetView(owner).categories.find(row => row.categoryId === category.categoryId)!.confirmation;
    process.env.DEMO_TODAY = "2026-12-10";
    const row = planningBudgetView(owner).categories.find(row => row.categoryId === category.categoryId)!;
    assert.equal(row.confirmedMonthlyCents, 0); assert.deepEqual(row.confirmation, confirmation);
    assert.notDeepEqual(row.observation.completeMonths, confirmation?.evidence.observation.completeMonths);
    process.env.DEMO_TODAY = "2026-11-10"; unchanged();
  });
  await t.test("reset removes drafts and confirmations without affecting another persona, and rejects old saved-state commands", () => {
    updatePlanningBudget(owner, command("edit", 22222));
    const old = planningBudgetView(owner); reset(owner);
    const fresh = planningBudgetView(owner); assert.equal(fresh.version, 0);
    assert.ok(fresh.categories.every(row => row.status === "suggested" && row.confirmedMonthlyCents === null));
    assert.deepEqual(fresh.categories, initial.categories);
    assert.throws(() => updatePlanningBudget(owner, command("confirm", 100, old)), /Refresh/); unchanged();
  });
  await t.test("existing Sandbox-order reset protection is preserved", () => {
    updatePlanningBudget(owner, command("confirm", 500));
    update(data => { data.orders["PROTECTED"] = { orderId: "PROTECTED", personaId: owner, decisionId: "none", productId: "aero-14", productName: "Laptop", method: "full", amount: 900, currency: "USD", status: "CREATED", createdAt: "2026-11-10", captureRequestId: "protected" }; });
    const stored = load(); assert.throws(() => reset(owner), /Sandbox orders/); assert.deepEqual(load(), stored);
  });
  await t.test("disabled demo and unknown personas cannot save budgets", () => {
    process.env.DEMO_SEED_ENABLED = "false";
    assert.throws(() => updatePlanningBudget(owner, command("confirm", 10)), /disabled/);
    process.env.DEMO_SEED_ENABLED = "true";
    assert.throws(() => planningBudgetView("missing:alex"), /not found/);
  });

  await t.test("HTTP routes derive ownership from current cookies and return stale/invalid/disabled errors", async () => {
    Object.assign(globalThis, { AsyncLocalStorage });
    const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
    const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
    const { RequestCookies } = await import("next/dist/compiled/@edge-runtime/cookies");
    const { GET, PATCH } = await import("../app/api/planning-budget/route");
    const workspaceA = "12345678-1234-1234-1234-123456789abc", workspaceB = "12345678-1234-1234-1234-123456789def";
    const within = <T>(workspace: string, persona: string, fn: () => T) => workAsyncStorage.run({ route: "/api/planning-budget", isStaticGeneration: false } as never, () => workUnitAsyncStorage.run({ type: "request", phase: "render", cookies: new RequestCookies(new Headers({ cookie: `rp_workspace=${workspace}; rp_account=${persona}` })) } as never, fn));
    const request = (body: unknown) => new Request("http://localhost/api/planning-budget", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const view = await within(workspaceA, "alex", () => GET()).then(response => response.json());
    const body = { action: "confirm", categoryId: view.categories[0].categoryId, monthlyCents: 42, version: view.version, epoch: view.epoch, basisHash: view.basisHash };
    assert.equal((await within(workspaceA, "alex", () => PATCH(request(body)))).status, 200);
    assert.equal((await within(workspaceA, "alex", () => PATCH(request(body)))).status, 409);
    const another = await within(workspaceB, "alex", () => GET()).then(response => response.json());
    const sam = await within(workspaceA, "sam", () => GET()).then(response => response.json());
    assert.ok(another.categories.every((row: { status: string }) => row.status === "suggested")); assert.ok(sam.categories.every((row: { status: string }) => row.status === "suggested"));
    assert.equal((await within(workspaceB, "alex", () => PATCH(request({ ...body, monthlyCents: -1 })))).status, 400);
    const confirmed = await within(workspaceA, "alex", () => GET()).then(response => response.json());
    assert.equal(confirmed.categories[0].confirmedMonthlyCents, 42);
    process.env.DEMO_SEED_ENABLED = "false";
    assert.equal((await within(workspaceA, "alex", () => GET())).status, 404); assert.equal((await within(workspaceA, "alex", () => PATCH(request(body)))).status, 404);
    process.env.DEMO_SEED_ENABLED = "true";
  });
});
