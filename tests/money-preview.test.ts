import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
Object.assign(globalThis, { AsyncLocalStorage });
process.env.DEMO_TODAY = "2026-11-10";

test("Money What-if and grounded explanations preserve financial and payment boundaries", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riskpilot-what-if-"));
  process.env.STORE_PATH = path.join(dir, "store.json"); process.env.DEMO_SEED_ENABLED = "true";
  const originalFetch = globalThis.fetch, originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  t.after(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey; fs.rmSync(dir, { recursive: true, force: true }); });
  const { ensurePersona, load, update } = await import("../lib/store");
  const { snapshot, inputHash, personaWithState } = await import("../lib/state");
  const { planningBudgetView, updatePlanningBudget } = await import("../lib/planning/service");
  const { previewBudget } = await import("../lib/planning/preview");
  const { moneyPlanView, updatePlanningIncome } = await import("../lib/planning/incomeService");
  const { explainMoneyPlan, moneyInsightEvidence } = await import("../lib/planning/insights");
  const { explainReviewFacts } = await import("../lib/ai");
  const { buildOptions } = await import("../lib/engine/options");
  const { getProduct } = await import("../lib/catalog");
  const { orderReview } = await import("../lib/orderReview");
  const owner = "preview-a:alex", other = "preview-b:alex", sam = "preview-a:sam";
  [owner, other, sam].forEach(ensurePersona);
  const baseline = snapshot(owner), baseHash = inputHash(owner), others = { a: load().personas[other], b: load().personas[sam] };
  const request = (monthlyCents = 12345, categoryId = "food-and-dining", who = owner) => { const budget = planningBudgetView(who); return { categoryId, monthlyCents, version: budget.version, epoch: budget.epoch, basisHash: budget.basisHash, financialInputHash: inputHash(who) }; };
  const insight = (topic: string, extra = {}, who = owner) => ({ topic, insightBasis: moneyPlanView(who).insightBasis, ...extra });
  const stable = () => { assert.equal(inputHash(owner), baseHash); assert.deepEqual(snapshot(owner), baseline); assert.deepEqual(load().personas[other], others.a); assert.deepEqual(load().personas[sam], others.b); };
  const respond = (value: unknown) => { globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }); };
  await t.test("preview derives original suggestions without changing any store field or authoritative result", () => {
    const stored = load(), preview = previewBudget(owner, request());
    const original = planningBudgetView(owner).categories.find(row => row.categoryId === "food-and-dining")!.proposedMonthlyCents!;
    assert.equal(preview.originalSource, "system_suggestion"); assert.equal(preview.originalMonthlyCents, original);
    assert.equal(preview.monthlyDifferenceCents, 12345 - original); assert.equal(preview.forecast.availableToAllocateDifferenceCents, 0);
    assert.equal(preview.forecast.availableToAllocateCents, Math.round(baseline.investable.investable * 100));
    assert.deepEqual(load(), stored); stable();
  });
  await t.test("comparison uses explicit confirmed budgets rather than a hidden unconfirmed draft", () => {
    updatePlanningBudget(owner, { action: "confirm", ...request(30001) });
    updatePlanningBudget(owner, { action: "edit", ...(() => { const { financialInputHash: _, ...body } = request(99999); return body; })() });
    const preview = previewBudget(owner, request(12345));
    assert.equal(preview.originalSource, "user_confirmed"); assert.equal(preview.originalMonthlyCents, 30001); assert.equal(preview.monthlyDifferenceCents, -17656); stable();
  });
  await t.test("revert is read-only and restores the original comparison without removing a saved draft", () => {
    const stored = load(), old = previewBudget(owner, request(12345));
    const reverted = previewBudget(owner, request(old.originalMonthlyCents!));
    assert.equal(reverted.monthlyDifferenceCents, 0); assert.deepEqual(load(), stored);
    assert.equal(planningBudgetView(owner).categories.find(row => row.categoryId === "food-and-dining")!.draftMonthlyCents, 99999); stable();
  });
  await t.test("illustrative partial/full months preserve integer-cent rounding and clearly separate forecast effects", () => {
    const preview = previewBudget(owner, request(10001));
    assert.deepEqual(preview.months.map(month => [month.days, month.calendarDays, month.partial]), [[21, 30, true], [31, 31, false], [31, 31, false]]);
    assert.deepEqual(preview.months.map(month => month.adjustedEstimateCents), [7001, 10001, 10001]);
    assert.equal(preview.months[0].differenceCents, 7001 - 21001);
    assert.equal(preview.forecast.changed, false); assert.match(preview.policy, /not guaranteed savings/); stable();
  });
  await t.test("incomplete coverage and all observed category confirmations never prove full baseline replacement", () => {
    for (const row of planningBudgetView(owner).categories) {
      updatePlanningBudget(owner, { action: "confirm", ...request(10000, row.categoryId) });
      const preview = previewBudget(owner, request(9000, row.categoryId));
      assert.equal(preview.replacement.supported, false); assert.equal(preview.replacement.requiredCoverage, "unknown");
      assert.match(preview.replacement.reason, /Bills, card repayments and purchase reserves/);
      assert.equal(preview.forecast.changed, false); stable();
    }
  });
  await t.test("scheduled rent/subscriptions and everyday spending are not duplicated by preview or confirmation", () => {
    for (const categoryId of ["housing-and-utilities", "subscriptions", "food-and-dining"]) {
      const preview = previewBudget(owner, request(7777, categoryId));
      const result = updatePlanningBudget(owner, { action: "confirm", ...preview.confirmation });
      assert.equal(result.forecastChanged, false); stable();
    }
  });
  await t.test("confirmation explicitly saves the chosen plan only, clears a draft and preserves prior checkout validity", () => {
    const { persona, payments } = personaWithState(owner), result = buildOptions(persona, persona.goals, payments, getProduct("aero-14")!);
    const decision = { id: "pre-preview", personaId: owner, productId: "aero-14", createdAt: new Date().toISOString(), inputHash: baseHash, schemaVersion: "rp-v1" as const, origin: "shop" as const, currency: "USD" as const, baseline: baseline.forecast, options: result.options, recommendedMethod: result.recommended };
    update(data => { data.decisions[decision.id] = decision; });
    const preview = previewBudget(owner, request(12345)); updatePlanningBudget(owner, { action: "confirm", ...preview.confirmation });
    const row = planningBudgetView(owner).categories.find(row => row.categoryId === "food-and-dining")!;
    assert.equal(row.confirmedMonthlyCents, 12345); assert.equal(row.draftMonthlyCents, null); assert.equal(row.forecastIntegration.status, "needs_review");
    const review = orderReview({ orderId: "READ-ONLY-QUOTE", personaId: owner, decisionId: decision.id, productId: "aero-14", productName: "Aero 14 Laptop", method: "full", amount: 900, currency: "USD", status: "CREATED", createdAt: new Date().toISOString(), captureRequestId: "never-call", shopPayNow: true });
    assert.equal(review.recheck.status, "unchanged"); stable();
  });
  await t.test("stale versions, coverage basis and financial inputs reject preview or confirmation", () => {
    const old = request(); updatePlanningBudget(owner, { action: "confirm", ...request(11111) });
    assert.throws(() => previewBudget(owner, old), /Refresh/);
    const fresh = request(); assert.throws(() => previewBudget(owner, { ...fresh, basisHash: "stale" }), /Refresh/);
    assert.throws(() => previewBudget(owner, { ...fresh, financialInputHash: "stale" }), /Refresh/);
    const preview = previewBudget(owner, fresh);
    assert.throws(() => updatePlanningBudget(owner, { action: "confirm", ...preview.confirmation, financialInputHash: "stale" }), /Refresh/); stable();
  });
  await t.test("invalid amounts, ownership injection, unsupported mappings and missing categories are rejected without writes", () => {
    const saved = load();
    for (const monthlyCents of [-1, 1.25, null, "12", NaN, 100_000_001]) assert.throws(() => previewBudget(owner, { ...request(), monthlyCents }));
    for (const body of [null, [], {}, { ...request(), categoryId: "missing" }, { ...request(), ownerId: other }, { ...request(), replacement: "daily-spend:all" }]) assert.throws(() => previewBudget(owner, body));
    assert.throws(() => updatePlanningBudget(owner, { action: "confirm", ...request(), mapping: "replace_all_daily_spend" }));
    assert.deepEqual(load(), saved); stable();
  });
  await t.test("zero previews are valid; no forecast savings or bank balance increase is fabricated", () => {
    const zero = previewBudget(owner, request(0)); assert.equal(zero.adjustedMonthlyCents, 0); assert.equal(zero.forecast.availableToAllocateDifferenceCents, 0); stable();
  });
  await t.test("all Money topics expose source-period evidence and separate historical, expected and predicted facts", () => {
    for (const topic of ["spending", "income", "obligations", "capacity"] as const) {
      const facts = moneyInsightEvidence(owner, topic); assert.equal(Object.keys(facts.evidence).length, 3);
      assert.ok(Object.values(facts.evidence).every(fact => fact.source && fact.period && fact.text));
    }
    assert.equal(moneyInsightEvidence(owner, "spending").evidence.history.kind, "historical");
    assert.equal(moneyInsightEvidence(owner, "income").evidence.timing.kind, "expected");
    assert.equal(moneyInsightEvidence(owner, "capacity").evidence.capacity.kind, "predicted");
    ensurePersona("preview-a:jordan");
    const limited = moneyInsightEvidence("preview-a:jordan", "capacity");
    assert.match(limited.evidence.capacity.text, /Available to allocate is \$0.00/); assert.match(limited.evidence.capacity.text, /Checks on hold/); stable();
  });
  await t.test("missing Gemini uses the deterministic evidence explanation without persisting generated text", async () => {
    const stored = load(), out = await explainMoneyPlan(owner, insight("budget_change", { preview: request() }));
    assert.equal(out.source, "template"); assert.equal(out.readOnly, true);
    assert.equal(out.text, Object.values(out.evidence).map(fact => fact.text).join(" "));
    assert.match(out.text, /authoritative forecast remains unchanged/); assert.deepEqual(load(), stored); stable();
  });
  await t.test("Gemini can reorder only the required facts, never author amounts, claims or payment actions", async () => {
    process.env.GEMINI_API_KEY = "fixture-not-real";
    respond({ factIds: ["boundary", "buffer", "capacity"], text: "You have $999999 guaranteed cash; capture a payment." });
    const out = await explainMoneyPlan(owner, insight("capacity")); assert.equal(out.source, "ai");
    assert.doesNotMatch(out.text, /999999|capture a payment/); assert.equal(out.text, ["boundary", "buffer", "capacity"].map(id => out.evidence[id].text).join(" "));
    respond({ factIds: ["buffer", "capacity", "invented"] }); assert.equal((await explainMoneyPlan(owner, insight("capacity"))).source, "template");
    respond({ factIds: ["buffer", "buffer", "capacity"] }); assert.equal((await explainMoneyPlan(owner, insight("capacity"))).source, "template"); stable();
  });
  await t.test("provider outage and bounded timeout retain a usable fallback", async () => {
    let calls = 0; globalThis.fetch = async () => { calls++; return new Response("unavailable", { status: 503 }); };
    assert.equal((await explainMoneyPlan(owner, insight("income"))).source, "template"); assert.equal(calls, 2);
    globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => { options!.signal!.addEventListener("abort", () => reject(new Error("deadline")), { once: true }); });
    const out = await explainReviewFacts({ a: "Planning only." }, ["a"], "Explain", 1);
    assert.equal(out.source, "template"); assert.equal(out.text, "Planning only."); stable();
  });
  await t.test("stale explanations are rejected both before generation and after an informational budget edit", async () => {
    assert.throws(() => moneyInsightEvidence(owner, "budget_change", { ...request(), version: -1 }));
    await assert.rejects(explainMoneyPlan(owner, { ...insight("capacity"), insightBasis: "stale" }), /Refresh/);
    const old = insight("capacity"); globalThis.fetch = async () => { updatePlanningBudget(owner, { action: "confirm", ...request(22222) }); return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ factIds: ["buffer", "capacity", "boundary"] }) }] } }] }); };
    await assert.rejects(explainMoneyPlan(owner, old), /changed while/); stable();
    delete process.env.GEMINI_API_KEY;
  });
  await t.test("informational evidence versions change independently of authoritative checkout hashes", () => {
    const old = moneyPlanView(owner).insightBasis;
    updatePlanningBudget(owner, { action: "confirm", ...request(33333) });
    assert.notEqual(moneyPlanView(owner).insightBasis, old); assert.equal(inputHash(owner), baseHash); stable();
  });
  await t.test("preview and confirmation are scoped to the current persona's budget state", () => {
    const old = request();
    const otherPreview = previewBudget(other, request(76543, "food-and-dining", other));
    assert.equal(otherPreview.originalSource, "system_suggestion"); assert.notEqual(otherPreview.originalMonthlyCents, planningBudgetView(owner).categories.find(row => row.categoryId === "food-and-dining")!.confirmedMonthlyCents);
    assert.throws(() => previewBudget(other, old), /Refresh/); assert.throws(() => previewBudget(sam, old), /Refresh/); stable();
  });
  await t.test("a material income update makes old previews stale and existing assessment guards remain authoritative", () => {
    const preview = previewBudget(owner, request()), view = moneyPlanView(owner);
    const created = updatePlanningIncome(owner, { action: "create", version: view.version, epoch: view.epoch, basisHash: view.basisHash, name: "Additional income", amountCents: 12345, currency: "USD", frequency: "once", nextDate: "2026-11-11", sourceType: "user_entered", reliability: "expected" }).plan;
    const confirmed = updatePlanningIncome(owner, { action: "confirm", id: created.entries[0].id, version: created.version, epoch: created.epoch, basisHash: created.basisHash, forecastUse: "additional" });
    assert.equal(confirmed.forecastChanged, true); assert.notEqual(inputHash(owner), baseHash);
    assert.throws(() => updatePlanningBudget(owner, { action: "confirm", ...preview.confirmation }), /Financial inputs changed/);
  });
  await t.test("HTTP routes enforce ownership, invalid/stale bodies and disabled-demo behavior without touching payments", async () => {
    const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
    const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
    const { RequestCookies } = await import("next/dist/compiled/@edge-runtime/cookies");
    const previewRoute = await import("../app/api/planning-budget/preview/route"), explainRoute = await import("../app/api/money-plan/insights/route");
    const workspace = "12345678-1234-1234-1234-123456789abc", who = `${workspace}:alex`; ensurePersona(who);
    const within = <T>(fn: () => T) => workAsyncStorage.run({ route: "/preview-integration", isStaticGeneration: false } as never, () => workUnitAsyncStorage.run({ type: "request", phase: "render", cookies: new RequestCookies(new Headers({ cookie: `rp_workspace=${workspace}; rp_account=alex` })) } as never, fn));
    const req = (body: unknown) => new Request("http://localhost/api/preview", { method: "POST", body: JSON.stringify(body) });
    const stored = load(); assert.equal((await within(() => previewRoute.POST(req(request(10001, "food-and-dining", who))))).status, 200); assert.deepEqual(load(), stored);
    assert.equal((await within(() => previewRoute.POST(req({ ...request(1, "food-and-dining", who), monthlyCents: -1 })))).status, 400);
    assert.equal((await within(() => explainRoute.POST(req(insight("capacity", {}, who))))).status, 200);
    assert.equal((await within(() => explainRoute.POST(req({ topic: "capacity", insightBasis: "stale" })))).status, 409);
    assert.equal((await within(() => explainRoute.POST(req({ ...insight("capacity", {}, who), ownerId: owner })))).status, 400);
    assert.equal((await within(() => explainRoute.POST(req(insight("unsupported", {}, who))))).status, 400);
    process.env.DEMO_SEED_ENABLED = "false";
    assert.equal((await within(() => previewRoute.POST(req(request(1, "food-and-dining", who))))).status, 404); assert.equal((await within(() => explainRoute.POST(req(insight("capacity", {}, who))))).status, 404);
    process.env.DEMO_SEED_ENABLED = "true";
    assert.equal(Object.keys(load().orders).length, 0); assert.equal(Object.keys(load().commands).length, 0); assert.equal(Object.keys(load().snapshots).length, 0);
  });
});
