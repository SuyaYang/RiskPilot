import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { ALEX_SPENDING_BASELINE, monthlyDailyCents, everydayCents, categoryDailyCents, SPENDING_MODEL_VERSION, compileSpending, categoryCoverage } from "../lib/planning/spendingBaseline";
import { formatCents } from "../lib/spending/money";
import { addDays, iso, parseIso } from "../lib/dates";
Object.assign(globalThis, { AsyncLocalStorage });
process.env.DEMO_TODAY = "2026-11-10";

test("explicit category coverage replaces spending safely through the shared engine", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riskpilot-category-"));
  process.env.STORE_PATH = path.join(dir, "store.json"); process.env.DEMO_SEED_ENABLED = "true";
  delete process.env.GEMINI_API_KEY; delete process.env.PAYPAL_CLIENT_ID; delete process.env.PAYPAL_CLIENT_SECRET;
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { ensurePersona, newPersona, load, update, reset } = await import("../lib/store");
  const { inputHash, snapshot, personaWithState } = await import("../lib/state");
  const { planningBudgetView, updatePlanningBudget } = await import("../lib/planning/service");
  const { previewBudget } = await import("../lib/planning/preview");
  const { moneyPlanView, updatePlanningIncome } = await import("../lib/planning/incomeService");
  const { moneyInsightEvidence, explainMoneyPlan } = await import("../lib/planning/insights");
  const { buildPersonas } = await import("../lib/personas");
  const { forecast, monthlySurplus } = await import("../lib/engine/forecast");
  const { buildOptions } = await import("../lib/engine/options");
  const { getProduct } = await import("../lib/catalog");
  const { orderReview } = await import("../lib/orderReview");
  const { createCheckout } = await import("../lib/checkout");
  const { captureShopCheckout } = await import("../lib/shopCheckout");
  const { confirmMerchantCheckout } = await import("../lib/merchantCheckout");
  const { recordCapture } = await import("../lib/purchases");
  let seq = 0;
  const fresh = (persona = "alex") => { const id = `category-${++seq}:${persona}`; ensurePersona(id); return id; };
  const request = (owner: string, monthlyCents = 15000, categoryId = "food-and-dining") => { const b = planningBudgetView(owner); return { categoryId, monthlyCents, version: b.version, epoch: b.epoch, basisHash: b.basisHash, financialInputHash: inputHash(owner) }; };
  const apply = (owner: string, amount = 15000, categoryId = "food-and-dining") => updatePlanningBudget(owner, { action: "apply", ...request(owner, amount, categoryId) });
  const options = (owner: string) => { const { persona, payments } = personaWithState(owner); return buildOptions(persona, persona.goals, payments, getProduct("aero-14")!); };
  await t.test("declared categories sum to the exact $20 legacy daily amount", () => {
    assert.equal(ALEX_SPENDING_BASELINE.reduce((s, row) => s + row.dailyCents, 0), 2000);
    const owner = fresh(), p = personaWithState(owner).persona;
    for (let d = 0; d < 370; d++) assert.equal(everydayCents(p, iso(addDays(parseIso("2026-11-10"), d))), 2000);
    assert.match(planningBudgetView(owner).baseline.source, /not inferred/);
  });
  await t.test("migration preserves every daily balance, minimum/stress/risk, goals, capacity, purchase conclusions and financial hash", () => {
    const owner = fresh(); update(data => { delete data.personas[owner].spendingBaseline; });
    const legacy = snapshot(owner), oldOptions = options(owner);
    update(data => { data.personas[owner].spendingBaseline = { modelVersion: SPENDING_MODEL_VERSION }; });
    assert.deepEqual(snapshot(owner), legacy); assert.deepEqual(options(owner), oldOptions);
    console.log("MIGRATION", JSON.stringify({ lowest: legacy.forecast.minBalance, stress: legacy.forecast.stressMinBalance, allocate: legacy.investable.investable, risk: legacy.forecast.risk, purchaseRisk: oldOptions.options.find(x => x.method === "full")!.forecast.risk, recommended: oldOptions.recommended }));
  });
  await t.test("legacy Alex, Sam and Jordan retain aggregate timing and do not acquire category eligibility", () => {
    for (const persona of ["alex", "sam", "jordan"]) {
      const owner = fresh(persona); if (persona === "alex") update(data => { delete data.personas[owner].spendingBaseline; });
      assert.equal(planningBudgetView(owner).baseline.available, false);
      assert.deepEqual(snapshot(owner).forecast, forecast(buildPersonas().find(p => p.id === persona)!));
      assert.throws(() => apply(owner), /coverage|legacy/);
    }
  });
  await t.test("legacy Alex can explicitly enable coverage in place without changing finances or activating saved budgets", () => {
    const owner = fresh(); update(data => { delete data.personas[owner].spendingBaseline; });
    updatePlanningBudget(owner, { action: "confirm", ...request(owner, 12000) });
    const before = snapshot(owner), stored = load().personas[owner];
    const { monthlyCents: _, ...tokens } = request(owner);
    updatePlanningBudget(owner, { action: "enable_baseline", ...tokens });
    assert.deepEqual(snapshot(owner), before); assert.deepEqual(load().personas[owner].goals, stored.goals); assert.deepEqual(load().personas[owner].purchases, stored.purchases);
    const category = planningBudgetView(owner).categories.find(row => row.categoryId === "food-and-dining")!;
    assert.equal(category.forecastIntegration.supported, true); assert.equal(category.forecastIntegration.status, "planning_only"); assert.equal(category.confirmedMonthlyCents, 12000); assert.equal(category.forecastIntegration.currentMonthlyCents, 30000);
    assert.throws(() => updatePlanningBudget(owner, { action: "apply", monthlyCents: 12000, ...tokens }), /changed/);
    const sam = fresh("sam"), { monthlyCents: __, ...samTokens } = request(sam); assert.throws(() => updatePlanningBudget(sam, { action: "enable_baseline", ...samTokens }), /cannot enable/);
  });
  await t.test("a changed aggregate or scheduled coverage fails closed without guessed split", () => {
    const owner = fresh(), st = load().personas[owner], base = buildPersonas()[0];
    assert.equal(compileSpending({ ...base, dailySpend: 25 }, st), undefined);
    assert.equal(compileSpending({ ...base, recurring: [...base.recurring, { ...base.recurring[1], id: "new-unknown-bill" }] }, st), undefined);
    const suggestion = planningBudgetView(owner).categories.find(row => row.categoryId === "food-and-dining")!;
    assert.equal(categoryCoverage(base, st, { ...suggestion, overlap: { requiresReview: true, recurringMerchants: [], scheduledBills: [] } }).supported, false);
  });
  await t.test("previously applied coverage becomes inactive if new overlap evidence fails verification", () => {
    const owner = fresh(); apply(owner); const state = load().personas[owner], base = buildPersonas()[0];
    const suggestions = planningBudgetView(owner).categories.map(row => row.categoryId === "food-and-dining" ? { ...row, overlap: { ...row.overlap, requiresReview: true } } : row);
    const compiled = compileSpending(base, state, suggestions)!;
    assert.equal(compiled.categories.find(row => row.categoryId === "food-and-dining")!.override, undefined);
    assert.equal(everydayCents({ ...base, everydaySpending: compiled }, "2026-11-10"), 2000);
  });
  await t.test("authoritative application rejects invalid cents and injected ownership/model/timing fields without mutations", () => {
    const owner = fresh(), before = load();
    for (const amount of [-1, 1.25, "100", null, NaN, 100_000_001]) assert.throws(() => updatePlanningBudget(owner, { action: "apply", ...request(owner), monthlyCents: amount }));
    assert.deepEqual(load(), before);
  });
  await t.test("historic suggestions, saved drafts and old planning-only confirmations never activate automatically", () => {
    const owner = fresh(), before = snapshot(owner);
    const { financialInputHash: _, ...body } = request(owner, 12000);
    updatePlanningBudget(owner, { action: "edit", ...body }); assert.deepEqual(snapshot(owner), before);
    updatePlanningBudget(owner, { action: "confirm", ...request(owner, 12000) }); assert.deepEqual(snapshot(owner), before);
    assert.equal(planningBudgetView(owner).categories.find(r => r.categoryId === "food-and-dining")!.forecastIntegration.status, "planning_only");
    update(data => { delete data.personas[owner].spendingBaseline; });
    update(data => { data.personas[owner].spendingBaseline = { modelVersion: SPENDING_MODEL_VERSION }; });
    assert.deepEqual(snapshot(owner), before);
  });
  await t.test("supported override replaces exactly one category; unchanged categories and bills remain identical", () => {
    const owner = fresh(), before = personaWithState(owner).persona, b = snapshot(owner);
    apply(owner); const after = personaWithState(owner).persona, a = snapshot(owner);
    assert.deepEqual(after.recurring, before.recurring); assert.equal(a.forecast.startBalance, b.forecast.startBalance);
    assert.equal(everydayCents(after, "2026-11-10"), 1500); // $10 other categories + $5 food, not $25.
    assert.deepEqual(after.everydaySpending!.categories.slice(1), before.everydaySpending!.categories.slice(1));
    assert.equal(Math.round((a.forecast.dailyBalances[0].balance - b.forecast.dailyBalances[0].balance) * 100), 500);
    assert.equal(monthlySurplus(after) - monthlySurplus(before), 154); // Existing 30.4-day goal approximation.
  });
  await t.test("all eligible categories work independently and unresolved categories stay planning only", () => {
    const owner = fresh();
    for (const category of ["food-and-dining", "shopping", "entertainment"]) { apply(owner, 12001, category); assert.equal(planningBudgetView(owner).categories.find(r => r.categoryId === category)!.forecastIntegration.status, "included"); }
    for (const category of ["housing-and-utilities", "subscriptions", "transportation", "health", "uncategorized"]) {
      const before = snapshot(owner); updatePlanningBudget(owner, { action: "confirm", ...request(owner, 5000, category) }); assert.deepEqual(snapshot(owner), before);
      assert.throws(() => apply(owner, 5000, category), /coverage|legacy/);
      const preview = previewBudget(owner, request(owner, 5000, category)); assert.equal(preview.replacement.supported, false); assert.deepEqual(preview.forecast.current, preview.forecast.scenario);
    }
    assert.equal(ALEX_SPENDING_BASELINE.find(r => r.categoryId === "other")!.dailyCents, 200);
  });
  for (const [month, days] of [["2027-02", 28], ["2028-02", 29], ["2026-11", 30], ["2027-01", 31]] as const) {
    await t.test(`${days}-day month conserves integer cents for zero, tiny, uneven and maximum monthly budgets`, () => {
      for (const amount of [0, 1, 29, 10001, 100_000_000]) {
        const values = Array.from({ length: days }, (_, n) => monthlyDailyCents(amount, `${month}-${String(n + 1).padStart(2, "0")}`));
        assert.equal(values.reduce((a, b) => a + b, 0), amount); assert.ok(values.every(Number.isSafeInteger)); assert.ok(Math.max(...values) - Math.min(...values) <= 1);
        assert.ok(values.every((value, i) => i === 0 || value <= values[i - 1]));
      }
    });
  }
  await t.test("partial-month activation never charges a full month or re-imports historical MTD spending", () => {
    const owner = fresh(); process.env.DEMO_TODAY = "2026-11-11";
    try { const p = previewBudget(owner, request(owner, 10001)); assert.equal(p.months[0].days, 20); assert.equal(p.months[0].adjustedEstimateCents, 6661); assert.equal(p.months[1].adjustedEstimateCents, 10001); const before = snapshot(owner); apply(owner, 10001); assert.equal(snapshot(owner).forecast.startBalance, before.forecast.startBalance); }
    finally { process.env.DEMO_TODAY = "2026-11-10"; }
  });
  await t.test("unchanged categories keep daily cadence while applied categories cross leap/year boundaries without drift", () => {
    const owner = fresh(); process.env.DEMO_TODAY = "2028-02-28";
    try { apply(owner, 10001); const p = personaWithState(owner).persona; assert.equal(everydayCents(p, "2028-02-29"), 1344); assert.equal(everydayCents(p, "2028-03-01"), 1323); assert.equal(snapshot(owner).forecast.dailyBalances.length, 45); }
    finally { process.env.DEMO_TODAY = "2026-11-10"; }
  });
  await t.test("preview, repeated preview and revert-to-original comparison do not mutate any authoritative state/hash", () => {
    const owner = fresh(), stored = load(), before = snapshot(owner), p = previewBudget(owner, request(owner));
    assert.equal(p.originalSource, "declared_baseline"); assert.equal(p.originalMonthlyCents, 30000); assert.equal(p.replacement.supported, true);
    assert.ok(p.forecast.scenario.minBalanceCents > p.forecast.current.minBalanceCents);
    previewBudget(owner, request(owner, p.originalMonthlyCents!)); assert.deepEqual(load(), stored); assert.deepEqual(snapshot(owner), before);
  });
  await t.test("explicit application matches the exact preview facts and persists an atomic financial snapshot", () => {
    const owner = fresh(), p = previewBudget(owner, request(owner)); const before = snapshot(owner); const result = updatePlanningBudget(owner, { action: "apply", ...p.confirmation }); const after = snapshot(owner);
    assert.equal(result.forecastChanged, true); assert.equal(Math.round(after.forecast.minBalance * 100), p.forecast.scenario.minBalanceCents); assert.equal(Math.round(after.forecast.stressMinBalance * 100), p.forecast.scenario.stressMinBalanceCents); assert.equal(Math.round(after.investable.investable * 100), p.forecast.scenario.availableToAllocateCents);
    assert.notEqual(after.financialInputHash, before.financialInputHash); const saved = load().personas[owner].moneyPlanSnapshot!; assert.equal(saved.financialInputHash, after.financialInputHash); assert.deepEqual(saved.forecast, after.forecast);
    console.log("ENGINE_EXAMPLE", JSON.stringify({ category: p.category, original: p.originalMonthlyCents, adjusted: p.adjustedMonthlyCents, difference: p.monthlyDifferenceCents, before: p.forecast.current, after: p.forecast.scenario }));
  });
  await t.test("stale previews and stale application reject before mutation", () => {
    const owner = fresh(), stale = request(owner); apply(owner, 14000); const before = load();
    assert.throws(() => previewBudget(owner, stale), /changed/); assert.throws(() => updatePlanningBudget(owner, { action: "apply", ...stale }), /changed/); assert.deepEqual(load(), before);
    const current = request(owner); assert.throws(() => updatePlanningBudget(owner, { action: "apply", ...current, financialInputHash: "forged" }), /changed/);
  });
  await t.test("ownership and coverage tokens cannot activate another persona or workspace", () => {
    const owner = fresh(), other = fresh(), sam = fresh("sam"), body = request(owner), before = load();
    assert.throws(() => updatePlanningBudget(other, { action: "apply", ...body }), /changed/); assert.throws(() => updatePlanningBudget(sam, { action: "apply", ...body }), /changed/); assert.deepEqual(load(), before);
    for (const extra of [{ ownerId: owner }, { modelVersion: SPENDING_MODEL_VERSION }, { coverageSignature: "fake" }, { effectiveFrom: "2026-01-01" }]) assert.throws(() => updatePlanningBudget(owner, { action: "apply", ...body, ...extra }));
    const { financialInputHash: _, ...missingHash } = body; assert.throws(() => updatePlanningBudget(owner, { action: "apply", ...missingHash }));
  });
  await t.test("applied assumption survives new drafts/planning confirmations; restoration is explicit and returns the original hash", () => {
    const owner = fresh(), original = snapshot(owner); apply(owner); const applied = snapshot(owner);
    const { financialInputHash: _, ...edit } = request(owner, 99999); updatePlanningBudget(owner, { action: "edit", ...edit }); assert.deepEqual(snapshot(owner), applied);
    updatePlanningBudget(owner, { action: "confirm", ...request(owner, 99999) }); assert.deepEqual(snapshot(owner), applied);
    apply(owner); assert.deepEqual(snapshot(owner), applied); // No-op reapply retains effective date and hash.
    const { monthlyCents: __, ...tokens } = request(owner); updatePlanningBudget(owner, { action: "restore_baseline", ...tokens }); assert.deepEqual(snapshot(owner), original);
  });
  await t.test("reapplication on a later day with the same amount does not reset its effective date or hash", () => {
    const owner = fresh(); apply(owner, 10001); process.env.DEMO_TODAY = "2026-11-11";
    try { const before = snapshot(owner); apply(owner, 10001); assert.deepEqual(snapshot(owner), before); assert.equal(load().personas[owner].planningBudget!.categories["food-and-dining"].applied!.effectiveFrom, "2026-11-10"); }
    finally { process.env.DEMO_TODAY = "2026-11-10"; }
  });
  await t.test("a lower budget retains failed goal/stress safety checks and cannot turn its monthly saving into capacity", () => {
    const owner = fresh(); update(data => { data.personas[owner].goals[0].targetAmount = 1000000; data.personas[owner].goals[0].targetDate = "2026-11-11"; }); const p = previewBudget(owner, request(owner, 0)); apply(owner, 0); const s = snapshot(owner);
    assert.equal(s.investable.investable, 0); assert.ok(s.investable.checks.some(c => !c.ok)); assert.equal(p.forecast.scenario.availableToAllocateCents, 0);
    assert.ok(s.forecast.stressMinBalance > p.forecast.current.stressMinBalanceCents / 100);
  });
  await t.test("conservative planning-income ceiling still applies after a spending override", () => {
    const owner = fresh(); apply(owner, 0); const b = snapshot(owner), v = moneyPlanView(owner);
    const created = updatePlanningIncome(owner, { action: "create", version: v.version, epoch: v.epoch, basisHash: v.basisHash, name: "Distinct family grant", amountCents: 10000000, currency: "USD", frequency: "once", nextDate: "2026-11-11", sourceType: "user_entered", reliability: "expected" });
    const next = created.plan; updatePlanningIncome(owner, { action: "confirm", id: next.entries[0].id, forecastUse: "additional", version: next.version, epoch: next.epoch, basisHash: next.basisHash });
    const s = snapshot(owner); assert.ok(s.investable.investable <= b.investable.investable); assert.equal(s.forecast.stressMinBalance, b.forecast.stressMinBalance); assert.equal(s.allocation.monthlySurplus, b.allocation.monthlySurplus);
  });
  await t.test("existing paid/future purchase reserves and scheduled bills are never duplicated", () => {
    const owner = fresh(); update(data => { data.personas[owner].purchases.push({ id: "reserve", orderId: "recorded", productName: "Existing purchase", amount: 100, method: "full", capturedAt: new Date().toISOString(), fundingStatus: "UNCONFIRMED", simulated: true, payments: [{ date: "2026-11-10", amount: 50, label: "Paid" }, { date: "2026-11-20", amount: 50, label: "Future" }] }); });
    const oldOverview = moneyPlanView(owner), b = snapshot(owner); apply(owner); const a = snapshot(owner); assert.equal(a.forecast.startBalance, b.forecast.startBalance); assert.equal(a.forecast.startBalance, 3450); assert.deepEqual(a.upcomingPayments, b.upcomingPayments); assert.deepEqual(a.persona.recurring, b.persona.recurring); assert.equal(a.purchases.length, 1);
    const overview = moneyPlanView(owner); assert.equal(overview.months[0].purchaseReservesCents, 5000); assert.equal(overview.months[0].scheduledExpensesCents, oldOverview.months[0].scheduledExpensesCents);
  });
  await t.test("three-month overview consumes the same daily category assumptions, without adding confirmed budgets again", () => {
    const owner = fresh(), b = moneyPlanView(owner); apply(owner); const a = moneyPlanView(owner), p = personaWithState(owner).persona;
    assert.equal(a.months[0].everydayEstimateCents, 31500); assert.equal(a.months[1].everydayEstimateCents, 46000); assert.equal(a.months[0].planningOnlyBudgetEstimateCents, 0); assert.equal(a.appliedBudgetCount, 1);
    assert.deepEqual(a.months.map(m => m.scheduledExpensesCents), b.months.map(m => m.scheduledExpensesCents)); assert.ok(a.months.every(m => m.combinedOutgoingCents === null));
    assert.equal(a.months[1].everydayEstimateCents, Array.from({ length: 31 }, (_, d) => everydayCents(p, `2026-12-${String(d + 1).padStart(2, "0")}`)).reduce((x, y) => x + y, 0));
  });
  await t.test("Shop and merchant stale assessments fail before any provider or merchant payment call", async () => {
    const owner = fresh(), s = snapshot(owner), result = options(owner), decision = { id: "category-old", personaId: owner, productId: "aero-14", createdAt: new Date().toISOString(), inputHash: s.financialInputHash, schemaVersion: "rp-v1" as const, origin: "shop" as const, currency: "USD" as const, baseline: s.forecast, options: result.options, recommendedMethod: result.recommended };
    const order = { orderId: "CATEGORY-SHOP", personaId: owner, decisionId: decision.id, productId: "aero-14", productName: "Aero 14 Laptop", method: "full" as const, amount: 900, currency: "USD" as const, status: "CREATED" as const, createdAt: new Date().toISOString(), captureRequestId: "category-old", shopPayNow: true };
    update(data => { data.decisions[decision.id] = decision; data.orders[order.orderId] = order; data.orders["CATEGORY-MERCHANT"] = { ...order, orderId: "CATEGORY-MERCHANT", productId: "northstar:aero-14", priorAssessmentId: decision.id, reviewIntentId: "category-intent", merchant: { id: "northstar-demo", checkoutId: "category-merchant", name: "Northstar Electronics" } }; data.reviewIntents ??= {}; data.reviewIntents["category-intent"] = { owner, decisionId: decision.id, merchantId: "northstar-demo", productId: "northstar:aero-14", currency: "USD", expiresAt: Date.now() + 60000 }; });
    apply(owner); let calls = 0; const gateway = { configured: () => true, create: async () => { calls++; throw Error("provider forbidden"); }, get: async () => { calls++; throw Error("provider forbidden"); }, capture: async () => { calls++; throw Error("provider forbidden"); } };
    await assert.rejects(createCheckout(owner, decision.id, "full", gateway), /changed/); await assert.rejects(captureShopCheckout(owner, order.orderId, decision.inputHash, gateway), /changed/); await assert.rejects(confirmMerchantCheckout(owner, "CATEGORY-MERCHANT", decision.inputHash, async () => { calls++; throw Error("merchant forbidden"); }), /changed/); assert.equal(calls, 0);
    for (const id of [order.orderId, "CATEGORY-MERCHANT"]) { const review = orderReview(load().orders[id]); assert.equal(review.decision.inputHash, inputHash(owner)); assert.deepEqual(review.decision.baseline, snapshot(owner).forecast); assert.equal(review.recheck.status, "changed"); }
    assert.equal(load().personas[owner].purchases.length, 0);
  });
  await t.test("capture recording remains exactly once with updated financial assumptions (local records only)", () => {
    const owner = fresh(); apply(owner); const result = options(owner), s = snapshot(owner); update(data => { data.decisions["cat-once"] = { id: "cat-once", personaId: owner, productId: "aero-14", createdAt: new Date().toISOString(), inputHash: s.financialInputHash, schemaVersion: "rp-v1", baseline: s.forecast, options: result.options, recommendedMethod: result.recommended }; data.orders["CAT-ONCE"] = { orderId: "CAT-ONCE", personaId: owner, decisionId: "cat-once", productId: "aero-14", productName: "Laptop", amount: 900, method: "full", currency: "USD", status: "CREATED", simulated: true, createdAt: new Date().toISOString(), captureRequestId: "cat-once" }; });
    recordCapture("CAT-ONCE", "CAT-ONCE-CAPTURE", 900); const after = snapshot(owner); assert.equal(recordCapture("CAT-ONCE", "CAT-ONCE-CAPTURE", 900).duplicate, true); assert.deepEqual(snapshot(owner), after); assert.equal(after.purchases.length, 1); assert.equal(after.forecast.startBalance, s.forecast.startBalance - 900);
  });
  await t.test("Dashboard, Money, Goals and Shop consume the identical updated forecast and hash", async () => {
    const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external"); const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external"); const { RequestCookies } = await import("next/dist/compiled/@edge-runtime/cookies");
    const workspace = "ab123456-1234-1234-1234-123456789abc", owner = `${workspace}:alex`; ensurePersona(owner); apply(owner);
    const within = <T>(fn: () => T) => workAsyncStorage.run({ route: "/category", isStaticGeneration: false } as never, () => workUnitAsyncStorage.run({ type: "request", phase: "render", cookies: new RequestCookies(new Headers({ cookie: `rp_workspace=${workspace}; rp_account=alex` })) } as never, fn));
    const dash = await import("../app/api/dashboard/route"), money = await import("../app/api/invest/route"), goals = await import("../app/api/goals/route"), shop = await import("../app/api/decisions/route");
    const d = await within(() => dash.GET()).then(r => r.json()), m = await within(() => money.GET()).then(r => r.json()), g = await within(() => goals.GET()).then(r => r.json()), decision = await within(() => shop.POST(new Request("http://localhost/api/decisions", { method: "POST", body: JSON.stringify({ productId: "aero-14" }) }))).then(r => r.json());
    assert.equal(d.financialInputHash, m.financialInputHash); assert.equal(g.financialInputHash, m.financialInputHash); assert.deepEqual(d.allocation, g.allocation); assert.deepEqual(d.investable, m.investable);
    const saved = load().decisions[decision.decision.id]; assert.ok(saved); assert.equal(saved.inputHash, d.financialInputHash); assert.deepEqual(saved.baseline, d.forecast); assert.deepEqual(saved.options.find(o => o.method === "wait")!.goalPlan, d.allocation);
  });
  await t.test("Gemini receives only engine-owned amounts and fallback explains application and remaining safety checks", async () => {
    const owner = fresh(); update(data => { data.personas[owner].goals[0].targetAmount = 1000000; data.personas[owner].goals[0].targetDate = "2026-11-11"; }); const body = request(owner), p = previewBudget(owner, body), evidence = moneyInsightEvidence(owner, "budget_change", body);
    assert.match(evidence.evidence.boundary.text, /replaced, not added/); assert.ok(evidence.evidence.boundary.text.includes(formatCents(p.forecast.scenario.minBalanceCents))); assert.match(evidence.evidence.capacity.text, /Remaining failed checks/);
    const result = await explainMoneyPlan(owner, { topic: "budget_change", preview: body, insightBasis: moneyPlanView(owner).insightBasis }); assert.equal(result.source, "template"); assert.equal(result.readOnly, true);
    const oldBasis = moneyPlanView(owner).insightBasis; apply(owner); await assert.rejects(explainMoneyPlan(owner, { topic: "capacity", insightBasis: oldBasis }), /changed/); assert.match(moneyInsightEvidence(owner, "spending").evidence.boundary.text, /explicitly applied/);
  });
  await t.test("reset is isolated, restores baseline, clears applied snapshot and preserves payment safeguards", () => {
    const owner = fresh(), other = fresh(); apply(owner); const otherBefore = load().personas[other]; reset(owner); assert.deepEqual(load().personas[owner], newPersona(owner)); assert.deepEqual(load().personas[other], otherBefore); assert.equal(load().personas[owner].moneyPlanSnapshot, undefined);
    update(data => { data.orders["protected-category"] = { orderId: "protected-category", personaId: owner, decisionId: "none", productId: "aero-14", productName: "Laptop", method: "full", amount: 900, currency: "USD", status: "CREATED", createdAt: new Date().toISOString(), captureRequestId: "protected-category" }; }); assert.throws(() => reset(owner), /Sandbox orders/);
  });
});
