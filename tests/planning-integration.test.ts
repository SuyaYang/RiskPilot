import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
Object.assign(globalThis, { AsyncLocalStorage });
process.env.DEMO_TODAY = "2026-11-10";

test("verified planning inputs share forecast, goal, decision and payment-safety infrastructure", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riskpilot-integration-"));
  process.env.STORE_PATH = path.join(dir, "store.json"); process.env.DEMO_SEED_ENABLED = "true";
  delete process.env.GEMINI_API_KEY; delete process.env.PAYPAL_CLIENT_ID; delete process.env.PAYPAL_CLIENT_SECRET;
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { ensurePersona, load, reset, update, newPersona } = await import("../lib/store");
  const { snapshot, inputHash, personaWithState } = await import("../lib/state");
  const { updatePlanningIncome, moneyPlanView } = await import("../lib/planning/incomeService");
  const { planningBudgetView, updatePlanningBudget } = await import("../lib/planning/service");
  const { forecast } = await import("../lib/engine/forecast");
  const { buildOptions } = await import("../lib/engine/options");
  const { getProduct } = await import("../lib/catalog");
  const { orderReview } = await import("../lib/orderReview");
  const { createCheckout } = await import("../lib/checkout");
  const { captureShopCheckout } = await import("../lib/shopCheckout");
  const { confirmMerchantCheckout } = await import("../lib/merchantCheckout");
  const { recordCapture } = await import("../lib/purchases");
  const owner = "integration-a:alex", other = "integration-b:alex", sam = "integration-a:sam";
  for (const id of [owner, other, sam]) ensurePersona(id);
  const baseline = snapshot(owner), baselineHash = inputHash(owner);
  const otherBefore = load().personas[other], samBefore = load().personas[sam];
  const values = { name: "Additional family allowance", amountCents: 12345, currency: "USD", frequency: "once", nextDate: "2026-11-11", sourceType: "user_entered", reliability: "expected" };
  const command = (action: string, rest: Record<string, unknown> = {}, who = owner) => { const view = moneyPlanView(who); return { action, version: view.version, epoch: view.epoch, basisHash: view.basisHash, ...rest }; };
  function create(patch: Record<string, unknown> = {}) { const before = new Set(moneyPlanView(owner).entries.map(entry => entry.id)); const result = updatePlanningIncome(owner, command("create", { ...values, ...patch })); return result.plan.entries.find(entry => !before.has(entry.id))!.id; }
  function clearIncome() { for (const entry of moneyPlanView(owner).entries) updatePlanningIncome(owner, command("remove", { id: entry.id })); }
  function unchanged() { assert.equal(inputHash(owner), baselineHash); assert.deepEqual(snapshot(owner).forecast, baseline.forecast); assert.deepEqual(snapshot(owner).allocation, baseline.allocation); }
  function assess(id: string) { const { persona, payments } = personaWithState(owner); const options = buildOptions(persona, persona.goals, payments, getProduct("aero-14")!); const d = { id, personaId: owner, productId: "aero-14", createdAt: new Date().toISOString(), inputHash: inputHash(owner), schemaVersion: "rp-v1" as const, origin: "shop" as const, currency: "USD" as const, baseline: forecast(persona, payments), options: options.options, recommendedMethod: options.recommended, afterIncome: options.afterIncome }; update(data => { data.decisions[id] = d; }); return d; }
  let id = "";
  await t.test("drafts, unmapped confirmations and unresolved overlaps leave authoritative totals and hashes unchanged", () => {
    id = create(); unchanged(); updatePlanningIncome(owner, command("confirm", { id })); unchanged();
    assert.equal(moneyPlanView(owner).entries[0].forecastIntegration.status, "planning_only");
    updatePlanningIncome(owner, command("edit", { id, ...values, name: "Paycheck" })); updatePlanningIncome(owner, command("confirm", { id, forecastUse: "additional" })); unchanged();
    assert.equal(moneyPlanView(owner).entries[0].forecastIntegration.status, "needs_review"); clearIncome();
    id = create({ nextDate: "2027-09-01" }); updatePlanningIncome(owner, command("confirm", { id, forecastUse: "additional" })); unchanged();
    assert.equal(moneyPlanView(owner).entries[0].forecastIntegration.status, "planning_only"); clearIncome();
  });
  await t.test("confirmed additional monthly income uses calendar dates, integer cents and the same 45-day simulator", () => {
    id = create({ frequency: "monthly", nextDate: "2026-11-30" });
    const result = updatePlanningIncome(owner, command("confirm", { id, forecastUse: "additional" }));
    assert.equal(result.forecastChanged, true); assert.notEqual(inputHash(owner), baselineHash);
    const current = snapshot(owner); assert.equal(current.forecast.dailyBalances.length, 45);
    const dates = current.planning!.incomeEvents.map(event => event.date); assert.deepEqual(dates, ["2026-11-30"]);
    assert.equal(Math.round((current.forecast.dailyBalances[20].balance - baseline.forecast.dailyBalances[20].balance) * 100), 12345);
    assert.equal(current.forecast.stressMinBalance, baseline.forecast.stressMinBalance);
    assert.equal(current.forecast.startBalance, baseline.forecast.startBalance);
    assert.equal(current.investable.investable, baseline.investable.investable); clearIncome(); unchanged();
  });
  await t.test("biweekly, quarterly and one-time receipts enter on their actual dates without monthly smoothing", () => {
    for (const [frequency, expected] of [["biweekly", ["2026-11-11", "2026-11-25", "2026-12-09", "2026-12-23"]], ["quarterly", ["2026-11-11"]], ["once", ["2026-11-11"]]] as const) {
      id = create({ frequency }); updatePlanningIncome(owner, command("confirm", { id, forecastUse: "additional" }));
      assert.deepEqual(snapshot(owner).planning!.incomeEvents.map(event => event.date), expected);
      assert.ok(snapshot(owner).planning!.incomeEvents.every(event => event.amountCents === 12345)); clearIncome(); unchanged();
    }
  });
  await t.test("explicit source-ID replacement removes only the identified modeled income and preserves all old expense timing", () => {
    id = create({ name: "Paycheck", frequency: "monthly", amountCents: 140001, nextDate: "2026-11-30" });
    const result = updatePlanningIncome(owner, command("confirm", { id, forecastUse: "replace", modeledItemId: "a-pay" }));
    assert.equal(result.plan.entries[0].forecastIntegration.status, "included"); assert.deepEqual(snapshot(owner).planning!.replacedIncomeIds, ["a-pay"]);
    const current = snapshot(owner); assert.equal(Math.round((current.forecast.dailyBalances[9].balance - baseline.forecast.dailyBalances[9].balance) * 100), -150000);
    assert.equal(Math.round((current.forecast.dailyBalances[20].balance - baseline.forecast.dailyBalances[20].balance) * 100), -150000 + 140001);
    assert.ok(current.investable.investable <= baseline.investable.investable);
    assert.deepEqual(current.persona.recurring, baseline.persona.recurring);
    const { persona, payments } = personaWithState(owner);
    const timing = buildOptions(persona, persona.goals, payments, getProduct("aero-14")!).afterIncome;
    assert.equal(timing.available, true);
    if (timing.available) { assert.equal(timing.purchaseDate, "2026-12-01"); assert.equal(timing.income.uncertain, true); }
    assert.ok(result.plan.events.every(event => event.sourceId !== "a-pay"));
    clearIncome(); unchanged();
  });
  await t.test("unknown replacement IDs and fuzzy similarities never authorize replacement", () => {
    id = create({ name: "Paycheck" });
    const before = load(); assert.throws(() => updatePlanningIncome(owner, command("confirm", { id, forecastUse: "replace", modeledItemId: "missing" })), /identifier/); assert.deepEqual(load(), before);
    updatePlanningIncome(owner, command("confirm", { id, forecastUse: "additional" })); unchanged(); clearIncome();
  });
  await t.test("previous confirmed forecast remains active during an unconfirmed edit; confirmation, pause and removal invalidate materially", () => {
    id = create(); updatePlanningIncome(owner, command("confirm", { id, forecastUse: "additional" }));
    const includedHash = inputHash(owner), included = snapshot(owner).forecast;
    updatePlanningIncome(owner, command("edit", { id, ...values, amountCents: 99999 }));
    assert.equal(inputHash(owner), includedHash); assert.deepEqual(snapshot(owner).forecast, included);
    assert.equal(moneyPlanView(owner).entries[0].status, "draft");
    updatePlanningIncome(owner, command("confirm", { id })); assert.notEqual(inputHash(owner), includedHash);
    updatePlanningIncome(owner, command("pause", { id })); unchanged();
    updatePlanningIncome(owner, command("confirm", { id, forecastUse: "additional" })); assert.notEqual(inputHash(owner), baselineHash);
    updatePlanningIncome(owner, command("confirm", { id, forecastUse: "planning_only" })); unchanged(); clearIncome();
  });
  await t.test("uncertain and hypothetical mapped confirmations remain excluded", () => {
    for (const patch of [{ reliability: "uncertain" }, { sourceType: "hypothetical", reliability: "uncertain" }]) {
      id = create(patch); updatePlanningIncome(owner, command("confirm", { id, forecastUse: "additional" })); unchanged(); clearIncome();
    }
  });
  await t.test("ambiguous category budgets replace no guessed fraction and double-count neither rent, subscriptions nor daily spending", () => {
    for (const categoryId of ["housing-and-utilities", "subscriptions", "food-and-dining", "shopping"]) {
      const budget = planningBudgetView(owner);
      updatePlanningBudget(owner, { action: "confirm", categoryId, monthlyCents: 12301, version: budget.version, epoch: budget.epoch, basisHash: budget.basisHash }); unchanged();
      assert.equal(planningBudgetView(owner).categories.find(row => row.categoryId === categoryId)!.forecastIntegration.status, "needs_review");
    }
    const { persona, payments } = personaWithState(owner);
    const centsPersona = { ...persona, dailySpend: 1.01, recurring: [] };
    const partial = forecast(centsPersona, payments);
    assert.equal(Math.round((partial.startBalance - partial.dailyBalances[44].balance) * 100), 4545);
    assert.equal(partial.dailyBalances.length, 45); unchanged();
  });
  await t.test("duplicate mapped sources and two replacements for one ID fail closed, restoring the baseline", () => {
    const a = create(); updatePlanningIncome(owner, command("confirm", { id: a, forecastUse: "additional" }));
    const b = create(); updatePlanningIncome(owner, command("confirm", { id: b, forecastUse: "additional" })); unchanged();
    assert.ok(moneyPlanView(owner).entries.every(entry => entry.forecastIntegration.status === "needs_review")); clearIncome();
    const c = create({ amountCents: 140000 }), d = create({ name: "Different name", amountCents: 130000 });
    updatePlanningIncome(owner, command("confirm", { id: c, forecastUse: "replace", modeledItemId: "a-pay" })); updatePlanningIncome(owner, command("confirm", { id: d, forecastUse: "replace", modeledItemId: "a-pay" })); unchanged(); clearIncome();
  });
  await t.test("calendar month-end integration preserves January/February dates without converting old cadence", () => {
    process.env.DEMO_TODAY = "2027-01-30";
    id = create({ name: "Month-end income", frequency: "monthly", nextDate: "2027-01-31" });
    updatePlanningIncome(owner, command("confirm", { id, forecastUse: "replace", modeledItemId: "a-pay" }));
    assert.deepEqual(snapshot(owner).planning!.incomeEvents.map(event => event.date), ["2027-01-31", "2027-02-28"]);
    clearIncome(); process.env.DEMO_TODAY = "2026-11-10"; unchanged();
  });
  await t.test("replacement evidence becomes unresolved when the specifically identified modeled schedule changes", async () => {
    id = create(); updatePlanningIncome(owner, command("confirm", { id, forecastUse: "replace", modeledItemId: "a-pay" }));
    const { compilePlanning } = await import("../lib/planning/integration");
    const { buildPersonas } = await import("../lib/personas");
    const base = buildPersonas()[0]; const changed = { ...base, recurring: base.recurring.map(item => item.id === "a-pay" ? { ...item, amount: item.amount + 1 } : item) };
    const compiled = compilePlanning(changed, load().personas[owner]);
    assert.equal(compiled.income[id].status, "needs_review"); assert.equal(compiled.planning, undefined);
    clearIncome(); unchanged();
  });
  await t.test("optimistic expected income cannot make a previously unsafe account investment-ready", () => {
    const who = "integration-a:jordan"; ensurePersona(who); const old = snapshot(who); assert.equal(old.investable.investable, 0);
    const created = updatePlanningIncome(who, command("create", { ...values, name: "Optimistic scholarship", amountCents: 10000000 }, who)).plan.entries[0].id;
    updatePlanningIncome(who, command("confirm", { id: created, forecastUse: "additional" }, who));
    const next = snapshot(who); assert.equal(next.investable.investable, 0); assert.equal(next.forecast.stressMinBalance, old.forecast.stressMinBalance);
  });
  await t.test("Shop creation and both Shop/merchant capture guards reject old reviews without calling payment", async () => {
    const decision = assess("old-assessment");
    const order = { orderId: "SHOP-OLD", personaId: owner, decisionId: decision.id, productId: "aero-14", productName: "Aero 14 Laptop", method: "full" as const, amount: 900, currency: "USD" as const, status: "CREATED" as const, createdAt: new Date().toISOString(), captureRequestId: "old-shop", shopPayNow: true };
    update(data => { data.orders[order.orderId] = order; data.orders["MERCHANT-OLD"] = { ...order, orderId: "MERCHANT-OLD", merchant: { id: "northstar-demo", checkoutId: "merchant-old", name: "Northstar Electronics" } }; });
    id = create(); updatePlanningIncome(owner, command("confirm", { id, forecastUse: "additional" }));
    let calls = 0; const gateway = { configured: () => true, create: async () => { calls++; throw new Error("must not create"); }, get: async () => { calls++; throw new Error("must not inspect"); }, capture: async () => { calls++; throw new Error("must not capture"); } };
    await assert.rejects(createCheckout(owner, decision.id, "full", gateway), /changed/);
    await assert.rejects(captureShopCheckout(owner, order.orderId, decision.inputHash, gateway), /changed/);
    await assert.rejects(confirmMerchantCheckout(owner, "MERCHANT-OLD", decision.inputHash, async () => { calls++; throw new Error("must not call merchant"); }), /changed/);
    assert.equal(calls, 0);
    const review = orderReview(order), current = snapshot(owner);
    assert.equal(review.decision.inputHash, current.financialInputHash); assert.equal(review.recheck.status, "changed"); assert.deepEqual(review.decision.baseline, current.forecast);
    const merchantReview = orderReview(load().orders["MERCHANT-OLD"]); assert.equal(merchantReview.decision.inputHash, current.financialInputHash); assert.deepEqual(merchantReview.decision.baseline, current.forecast);
    assert.deepEqual(review.decision.options.find(option => option.method === "wait")!.goalPlan, current.allocation);
    clearIncome();
  });
  await t.test("a fresh review can use current inputs; capture reservation and snapshots stay exactly once under deterministic mocks", async () => {
    id = create(); updatePlanningIncome(owner, command("confirm", { id, forecastUse: "additional" }));
    const decision = assess("fresh-assessment");
    update(data => { data.orders["SIM-ONCE"] = { orderId: "SIM-ONCE", personaId: owner, decisionId: decision.id, productId: "aero-14", productName: "Aero 14 Laptop", method: "full", amount: 900, currency: "USD", status: "CREATED", createdAt: new Date().toISOString(), captureRequestId: "sim-once", simulated: true }; });
    const before = snapshot(owner); recordCapture("SIM-ONCE", "SIMCAP-ONCE", 900); const first = snapshot(owner);
    const again = recordCapture("SIM-ONCE", "SIMCAP-ONCE", 900); assert.equal(again.duplicate, true);
    assert.equal(first.forecast.startBalance, before.forecast.startBalance - 900); assert.deepEqual(snapshot(owner), first);
    assert.equal(load().personas[owner].purchases.length, 1); assert.equal(Object.keys(load().snapshots).length, 1);
    // Analytics remain read-only: observing historical rows never imports another copy of a payment.
    const { spendingView } = await import("../lib/spending/service");
    spendingView(owner); assert.deepEqual(snapshot(owner), first);
    clearIncome();
  });
  await t.test("Dashboard, Money and Goals APIs expose the same recomputed snapshot/hash; ownership stays isolated", async () => {
    const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
    const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
    const { RequestCookies } = await import("next/dist/compiled/@edge-runtime/cookies");
    const dash = await import("../app/api/snapshot/route"), money = await import("../app/api/invest/route"), goals = await import("../app/api/goals/route");
    const workspace = "12345678-1234-1234-1234-123456789abc", who = `${workspace}:alex`; ensurePersona(who);
    const entry = updatePlanningIncome(who, command("create", values, who)).plan.entries[0].id;
    updatePlanningIncome(who, command("confirm", { id: entry, forecastUse: "additional" }, who));
    const within = <T>(fn: () => T) => workAsyncStorage.run({ route: "/integration", isStaticGeneration: false } as never, () => workUnitAsyncStorage.run({ type: "request", phase: "render", cookies: new RequestCookies(new Headers({ cookie: `rp_workspace=${workspace}; rp_account=alex` })) } as never, fn));
    const d = await within(() => dash.GET()).then(r => r.json()), m = await within(() => money.GET()).then(r => r.json()), g = await within(() => goals.GET()).then(r => r.json());
    assert.equal(d.financialInputHash, m.financialInputHash); assert.equal(d.financialInputHash, g.financialInputHash);
    assert.deepEqual(d.investable, m.investable); assert.deepEqual(d.allocation, g.allocation);
    assert.deepEqual(load().personas[other], otherBefore); assert.deepEqual(load().personas[sam], samBefore);
  });
  await t.test("reset clears eligible planning inputs deterministically and retains Sandbox payment protection", () => {
    const who = "reset-planning:alex"; ensurePersona(who); const entry = updatePlanningIncome(who, command("create", values, who)).plan.entries[0].id;
    updatePlanningIncome(who, command("confirm", { id: entry, forecastUse: "additional" }, who)); reset(who);
    assert.deepEqual(load().personas[who], newPersona(who)); assert.equal(snapshot(who).planning, undefined);
    assert.throws(() => reset(owner), /Sandbox orders/);
  });
});
