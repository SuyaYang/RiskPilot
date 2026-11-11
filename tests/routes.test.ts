import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";

test("middleware and API integration without opening a network listener", async t => {
  Object.assign(globalThis, { AsyncLocalStorage });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riskpilot-routes-"));
  process.env.STORE_PATH = path.join(dir, "store.json");
  process.env.DEMO_TODAY = "2026-11-10";
  process.env.DEMO_SEED_ENABLED = "true";
  delete process.env.PAYPAL_CLIENT_ID; delete process.env.PAYPAL_CLIENT_SECRET; delete process.env.GEMINI_API_KEY;
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const { RequestCookies } = await import("next/dist/compiled/@edge-runtime/cookies");
  const { NextRequest } = await import("next/server");
  const { middleware } = await import("../middleware");
  const decisions = await import("../app/api/decisions/route");
  const goals = await import("../app/api/goals/route");
  const goal = await import("../app/api/goals/[id]/route");
  const orders = await import("../app/api/orders/route");
  const order = await import("../app/api/orders/[id]/route");
  const capture = await import("../app/api/orders/[id]/capture/route");
  const insights = await import("../app/api/orders/[id]/insights/route");
  const simulate = await import("../app/api/orders/[id]/simulate/route");
  const copilot = await import("../app/api/copilot/route");
  const parse = await import("../app/api/goals/parse/route");
  const snap = await import("../app/api/snapshot/route");
  const financialProfile = await import("../app/api/financial-profile/route");
  const profilePurchase = await import("../app/api/financial-profile/purchase/route");
  const spending = await import("../app/api/spending/route");
  const recurringPattern = await import("../app/api/spending/recurring/[id]/route");
  const reset = await import("../app/api/reset/route");
  const webhook = await import("../app/api/webhooks/paypal/route");
  function workspace() {
    const res = middleware(new NextRequest("http://localhost:3000/api/snapshot"));
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    assert.ok(res.cookies.get("rp_workspace")?.value);
    return `rp_workspace=${res.cookies.get("rp_workspace")!.value}; rp_persona=alex`;
  }
  const a = workspace(), b = workspace(); assert.notEqual(a, b);
  async function within<T>(cookie: string, fn: () => Promise<T>) {
    const requestStore = { type: "request", phase: "render", cookies: new RequestCookies(new Headers({ cookie })) };
    // Next's public request APIs require request-local storage. No test HTTP server is needed.
    return workAsyncStorage.run({ route: "/integration", isStaticGeneration: false } as never,
      () => workUnitAsyncStorage.run(requestStore as never, fn));
  }
  const req = (url: string, body: unknown, method = "POST") => new Request(`http://localhost:3000${url}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  await t.test("Flow A explores scenarios without PayPal authorization, order creation or financial mutation", async () => {
    const cookie = workspace(), originalFetch = globalThis.fetch;
    const { load } = await import("../lib/store");
    const { orderReview } = await import("../lib/orderReview");
    const before = await within(cookie, () => snap.GET()).then(r => r.json());
    const ordersBefore = structuredClone(load().orders);
    let providerCalls = 0;
    globalThis.fetch = async () => { providerCalls++; throw new Error("Exploration must not contact a payment provider"); };
    try {
      const response = await within(cookie, () => decisions.POST(req("/api/decisions", { productId: "aero-14" })));
      assert.equal(response.status, 200);
      const { decision } = await response.json();
      assert.deepEqual(decision.options.map((option: { method: string }) => option.method), ["full", "pay_in_4", "pay_monthly", "cheaper", "wait"]);
      assert.equal(decision.afterIncome.available, true);
      assert.equal(decision.options.find((option: { method: string }) => option.method === "full").forecast.minBalance, 820);
      assert.equal(decision.afterIncome.forecast.minBalance, 1260);
      const explained = await within(cookie, () => profilePurchase.POST(req("/api/financial-profile/purchase", { decisionId: decision.id, method: "wait", timing: "now" })));
      assert.equal(explained.status, 200); assert.equal((await explained.json()).readOnly, true);
      assert.deepEqual(load().orders, ordersBefore);
      assert.deepEqual(await within(cookie, () => snap.GET()).then(r => r.json()), before);
      assert.equal(providerCalls, 0);
      // A frozen merchant quote with the same price/profile must use identical calculations.
      const review = orderReview({ orderId: "comparison-only", captureRequestId: "comparison-only-no-capture", personaId: decision.personaId, decisionId: decision.id, productId: "merchant:laptop", productName: "Merchant laptop", method: "full", amount: 900, currency: "USD", status: "CREATED", createdAt: decision.createdAt });
      for (const method of ["full", "pay_in_4", "pay_monthly", "wait"]) {
        const exploration = decision.options.find((option: { method: string }) => option.method === method);
        const checkout = review.decision.options.find(option => option.method === method)!;
        assert.deepEqual(checkout.forecast, exploration.forecast);
        assert.deepEqual(checkout.goalImpact, exploration.goalImpact);
      }
      assert.deepEqual(review.decision.afterIncome, decision.afterIncome);
      assert.deepEqual(load().orders, ordersBefore);
    } finally { globalThis.fetch = originalFetch; }
    // An optional checkout is still available, but starts only after its explicit order request.
    const assessment = await within(cookie, () => decisions.POST(req("/api/decisions", { productId: "aero-14" }))).then(r => r.json());
    const checkout = await within(cookie, () => orders.POST(req("/api/orders", { decisionId: assessment.decision.id, method: "full" })));
    assert.equal(checkout.status, 200); assert.equal((await checkout.json()).simulated, true);
    assert.deepEqual(await within(cookie, () => snap.GET()).then(r => r.json()), before);
  });
  await t.test("copilot validates input and reports missing Gemini configuration without network calls",async()=>{
    const invalid=await copilot.POST(req("/api/copilot",{question:"",page:"Goals"}));assert.equal(invalid.status,400);
    const unavailable=await copilot.POST(req("/api/copilot",{question:"Am I on track?",page:"Goals"}));assert.equal(unavailable.status,503);
    assert.match((await unavailable.json()).error,/not configured/);
    const draft=await parse.POST(req("/api/goals/parse",{text:"Save $1000 for travel"}));assert.equal(draft.status,503);
  });
  await t.test("copilot uses the active workspace and rejects another workspace's purchase",async()=>{
    const originalFetch=globalThis.fetch;
    process.env.GEMINI_API_KEY="fixture-only";
    globalThis.fetch=async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({supported:true,factIds:["context","forecast"]})}]}}]});
    try{
      const before=await within(a,()=>snap.GET()).then(r=>r.json());
      const result=await within(a,()=>copilot.POST(req("/api/copilot",{question:"What is my cash forecast?",page:"Dashboard"})));
      assert.equal(result.status,200);const answer=await result.json();assert.equal(answer.source,"ai");assert.match(answer.text,/fictional demo/);
      const after=await within(a,()=>snap.GET()).then(r=>r.json());assert.deepEqual(after,before);
      const assessed=await within(a,()=>decisions.POST(req("/api/decisions",{productId:"aero-14"}))).then(r=>r.json());
      const denied=await within(b,()=>copilot.POST(req("/api/copilot",{question:"Can I buy it?",page:"Shop",decisionId:assessed.decision.id})));assert.equal(denied.status,404);
    }finally{globalThis.fetch=originalFetch;delete process.env.GEMINI_API_KEY;}
  });

  let decisionId = "", orderId = "";
  await t.test("cross-site writes rejected; first request receives an opaque workspace", () => {
    const res = middleware(new NextRequest("http://localhost:3000/api/orders", { method: "POST", headers: { origin: "https://evil.example" } }));
    assert.equal(res.status, 403);
  });
  await t.test("assess → create → simulate → immutable snapshot and changed projection", async () => {
    const before = await within(a, () => snap.GET()).then(r => r.json());
    const assessment = await within(a, () => decisions.POST(req("/api/decisions", { productId: "aero-14" }))).then(r => r.json());
    decisionId = assessment.decision.id;
    assert.equal(assessment.decision.explanation.source, "template");
    assert.equal(assessment.decision.options.find((o: { method: string }) => o.method === "pay_in_4").hypothetical, true);
    const created = await within(a, () => orders.POST(req("/api/orders", { decisionId, method: "full", amount: 0.01 }))).then(r => r.json());
    orderId = created.id; assert.equal(created.simulated, true);
    const out = await within(a, () => simulate.POST(req("/simulate", {}), params(orderId))).then(r => r.json());
    assert.equal(out.status, "CAPTURED");
    const after = await within(a, () => snap.GET()).then(r => r.json());
    assert.equal(after.forecast.startBalance, before.forecast.startBalance - 900);
    assert.equal(after.purchases.length, 1);
    const status = await within(a, () => order.GET(new Request("http://localhost:3000"), params(orderId))).then(r => r.json());
    assert.equal(status.forecastSnapshot.data.forecast.startBalance, after.forecast.startBalance);
    assert.equal(status.order.amount, 900);
    assert.equal(status.comparison.available,true);
    assert.equal(status.forecastSnapshot.before.purchases.length,0);
    assert.equal(status.forecastSnapshot.data.purchases.length,1);
    assert.equal(status.comparison.before.forecast.startBalance,before.forecast.startBalance);
    assert.equal(status.comparison.after.forecast.startBalance,after.forecast.startBalance);
    const savedComparison=JSON.stringify(status.comparison);
    const legacyStore=JSON.parse(fs.readFileSync(process.env.STORE_PATH!,"utf8"));
    delete legacyStore.snapshots[status.forecastSnapshot.id].before;
    const {captureComparison}=await import("../lib/captureComparison");
    assert.equal(captureComparison(legacyStore.orders[orderId],legacyStore)?.available,false);
    await within(a, () => simulate.POST(req("/simulate", {}), params(orderId)));
    assert.equal((await within(a, () => snap.GET()).then(r => r.json())).purchases.length, 1);
    const repeated=await within(a,()=>order.GET(new Request("http://localhost:3000"),params(orderId))).then(r=>r.json());
    assert.equal(JSON.stringify(repeated.comparison),savedComparison,"Repeated capture must preserve the original before/after snapshots");
  });
  await t.test("purchase overview is read-only and explicit current review is required", async () => {
    const assessment = await within(a, () => decisions.POST(req("/api/decisions", { productId: "quiet-buds" }))).then(r => r.json());
    const created = await within(a, () => orders.POST(req("/api/orders", { decisionId: assessment.decision.id, method: "full" }))).then(r => r.json());
    const status = await within(a, () => order.GET(new Request("http://localhost:3000"), params(created.id))).then(r => r.json());
    assert.equal(status.order.status, "CREATED");
    assert.equal(status.review.decision.options.find((o: { method: string }) => o.method === "full").price, 249);
    const missing = await within(a, () => capture.POST(req("/capture", {}), params(created.id)));
    assert.equal(missing.status, 400); assert.equal((await missing.json()).code, "REVIEW_REQUIRED");
    const stale = await within(a, () => capture.POST(req("/capture", { reviewConfirmed: true, inputHash: "tampered" }), params(created.id)));
    assert.equal(stale.status, 409); assert.equal((await stale.json()).code, "STALE_REVIEW");
    assert.equal((await within(a, () => snap.GET()).then(r => r.json())).purchases.length, 1);
  });
  await t.test("a second browser cannot read, capture or change the first browser's order", async () => {
    assert.equal((await within(b, () => order.GET(new Request("http://localhost:3000"), params(orderId)))).status, 404);
    assert.equal((await within(b, () => simulate.POST(req("/simulate", {}), params(orderId)))).status, 404);
    assert.equal((await within(b, () => orders.POST(req("/orders", { decisionId, method: "full" })))).status, 404);
    assert.equal((await within(b, () => snap.GET()).then(r => r.json())).purchases.length, 0);
  });
  await t.test("review insights are grounded, read-only, scoped and invalidated by changed inputs", async () => {
    const assessment = await within(a, () => decisions.POST(req("/api/decisions", { productId: "quiet-buds" }))).then(r => r.json());
    const created = await within(a, () => orders.POST(req("/api/orders", { decisionId: assessment.decision.id, method: "full" }))).then(r => r.json());
    const status = await within(a, () => order.GET(new Request("http://localhost:3000"), params(created.id))).then(r => r.json());
    assert.equal(status.review.context.source, "fictional-manual-demo");
    assert.ok(status.review.context.upcoming.some((item: { label: string }) => item.label === "Rent"));
    const body = { question: "afford", method: "full", inputHash: status.review.decision.inputHash };
    const before = fs.readFileSync(process.env.STORE_PATH!, "utf8");
    const timing=status.review.decision.afterIncome;
    assert.equal(timing.available,true);
    const previewAnswer=await within(a,()=>insights.POST(req("/insights",{...body,method:"full",question:"overview",timing:"after_income"}),params(created.id))).then(r=>r.json());
    assert.equal(previewAnswer.source,"template");assert.match(previewAnswer.text,/future-date preview/);
    assert.equal((await within(a,()=>insights.POST(req("/insights",{...body,method:"pay_in_4",timing:"after_income"}),params(created.id)))).status,400);
    const concise = await within(a, () => insights.POST(req("/insights", { ...body, question: "overview", compact: true }), params(created.id))).then(r => r.json());
    assert.equal(concise.readOnly, true); assert.match(concise.text, /buffer/); assert.equal(concise.text.split(".").filter(Boolean).length, 1);
    assert.equal((await within(a, () => insights.POST(req("/insights", { ...body, compact: "yes" }), params(created.id)))).status, 400);
    const answer = await within(a, () => insights.POST(req("/insights", body), params(created.id))).then(r => r.json());
    assert.equal(answer.readOnly, true); assert.equal(answer.source, "template");
    assert.equal(answer.inputHash, body.inputHash);
    assert.match(answer.uncertainty, /fictional/);
    const delay = await within(a, () => insights.POST(req("/insights", { ...body, question: "delay" }), params(created.id))).then(r => r.json());
    assert.match(delay.text, /has not been evaluated/);
    assert.equal((await within(a,()=>insights.POST(req("/insights",{...body,prompt:"Why is my cash low?"}),params(created.id)))).status,503);
    const originalFetch=globalThis.fetch;
    process.env.GEMINI_API_KEY="fixture-only";
    globalThis.fetch=async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({supported:true,factIds:["outlook","buffer","stress"]})}]}}]});
    try{
      const own=await within(a,()=>insights.POST(req("/insights",{...body,prompt:"Why is my cash low?"}),params(created.id)));
      assert.equal(own.status,200);assert.equal((await own.json()).source,"ai");
      assert.equal((await within(b,()=>insights.POST(req("/insights",{...body,prompt:"Why is my cash low?"}),params(created.id)))).status,404);
    }finally{globalThis.fetch=originalFetch;delete process.env.GEMINI_API_KEY;}
    assert.equal(fs.readFileSync(process.env.STORE_PATH!, "utf8"), before, "Insights must not mutate financial or payment state");
    assert.equal((await within(b, () => insights.POST(req("/insights", body), params(created.id)))).status, 404);
    assert.equal((await within(a, () => insights.POST(req("/insights", { ...body, question: "capture this payment" }), params(created.id)))).status, 400);
    assert.equal((await within(a, () => insights.POST(req("/insights", { ...body, method: "invented" }), params(created.id)))).status, 400);
    assert.equal((await within(a, () => insights.POST(req("/insights", { ...body, inputHash: "stale" }), params(created.id)))).status, 409);
    await within(a, () => goals.POST(req("/goals", { name: "New commitment", type: "spend", targetAmount: 100, savedSoFar: 0, priority: 2, targetDate: "2027-03-01" })));
    assert.equal((await within(a, () => insights.POST(req("/insights", body), params(created.id)))).status, 409);
    const recorded=await within(a,()=>order.GET(new Request("http://localhost:3000"),params(orderId))).then(r=>r.json());
    assert.equal(recorded.comparison.available,true);
    assert.equal(recorded.comparison.before.forecast.startBalance,3500);
    assert.equal(recorded.comparison.after.forecast.startBalance,2600);
  });
  await t.test("an assessment is discarded if finances change while Gemini is preparing its explanation",async()=>{
    const originalFetch=globalThis.fetch;
    const {update}=await import("../lib/store");
    process.env.GEMINI_API_KEY="fixture-only";
    globalThis.fetch=async()=>{
      update(store=>{const id=Object.keys(store.personas).find(id=>id.startsWith(a.match(/rp_workspace=([^;]+)/)![1]))!;store.personas[id].goals[0].savedSoFar+=1;});
      return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({factIds:["recommendation","buffer"]})}]}}]});
    };
    try{
      const result=await within(a,()=>decisions.POST(req("/api/decisions",{productId:"aero-14"})));
      assert.equal(result.status,409);assert.equal((await result.json()).code,"STALE_DECISION");
    }finally{globalThis.fetch=originalFetch;delete process.env.GEMINI_API_KEY;}
  });
  await t.test("goal confirmation, cent precision, optimistic version and invalid dates", async () => {
    const response = await within(a, () => goals.POST(req("/goals", { name: "Test trip", type: "spend", targetAmount: 123.45, savedSoFar: 12.34, priority: 2, targetDate: "2027-03-01" })));
    const saved = (await response.json()).goal;
    assert.equal(response.status, 200); assert.equal(saved.targetAmount, 123.45); assert.equal(saved.savedSoFar, 12.34);
    const res = await within(a, () => goal.PATCH(req("/goal", { name: "Updated trip", version: saved.version }, "PATCH"), params(saved.id)));
    assert.equal(res.status, 200);
    assert.equal((await within(a, () => goal.PATCH(req("/goal", { name: "Stale edit", version: saved.version }, "PATCH"), params(saved.id)))).status, 409);
    assert.equal((await within(b, () => goal.PATCH(req("/goal", { name: "Cross workspace", version: 2 }, "PATCH"), params(saved.id)))).status, 404);
    assert.equal((await within(a, () => goals.POST(req("/goals", { ...saved, targetDate: "2027-02-30" })))).status, 400);
  });
  await t.test("unsigned webhook cannot create payment facts", async () => {
    const response = await webhook.POST(req("/webhook", { id: "fake", event_type: "PAYMENT.CAPTURE.COMPLETED" }));
    assert.equal(response.status, 400);
  });
  await t.test("reset affects only current workspace", async () => {
    await within(b, () => reset.POST());
    assert.equal((await within(a, () => snap.GET()).then(r => r.json())).purchases.length, 1);
    await within(a, () => reset.POST());
    assert.equal((await within(a, () => snap.GET()).then(r => r.json())).purchases.length, 0);
  });
  await t.test("reset removes simulation histories and leaves another persona in the same workspace intact", async () => {
    const sam = a.replace("rp_persona=alex", "rp_persona=sam");
    const beforeSam = await within(sam, () => snap.GET()).then(r => r.json());
    const assessment = await within(a, () => decisions.POST(req("/api/decisions", { productId: "quiet-buds" }))).then(r => r.json());
    const created = await within(a, () => orders.POST(req("/api/orders", { decisionId: assessment.decision.id, method: "full" }))).then(r => r.json());
    await within(a, () => simulate.POST(req("/simulate", {}), params(created.id)));
    assert.equal((await within(a, () => reset.POST())).status, 200);
    const after = await within(a, () => snap.GET()).then(r => r.json());
    assert.equal(after.purchases.length, 0); assert.equal(after.goalHistory.length, 0);
    assert.deepEqual(await within(sam, () => snap.GET()).then(r => r.json()), beforeSam);
    assert.equal((await within(a, () => order.GET(new Request("http://localhost:3000"), params(created.id)))).status, 404);
    const { load } = await import("../lib/store");
    assert.equal(Object.values(load().snapshots).some(x => x.orderId === created.id), false);
  });
  await t.test("production reset route is unavailable without explicit demo opt-in", async () => {
    const node = process.env.NODE_ENV, flag = process.env.DEMO_SEED_ENABLED;
    try {
      Object.assign(process.env, { NODE_ENV: "production" }); delete process.env.DEMO_SEED_ENABLED;
      assert.equal((await reset.POST()).status, 404);
    } finally {
      if (node === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, { NODE_ENV: node });
      if (flag === undefined) delete process.env.DEMO_SEED_ENABLED; else process.env.DEMO_SEED_ENABLED = flag;
    }
  });
  await t.test("spending API is fictional, versioned, profile-scoped and cannot silently alter purchase impact", async () => {
    const before = await within(a, () => snap.GET()).then(r => r.json());
    const view = await within(a, () => spending.GET()).then(r => r.json());
    assert.equal(view.mode, "local-sandbox-fixture");
    assert.equal(view.analysis.averageMonthCount, 3);
    const candidate = view.candidates[0];
    const patch = (body: unknown) => req("/api/spending/recurring", body, "PATCH");
    const confirmed = await within(a, () => recurringPattern.PATCH(patch({ action: "confirm", version: 0, asOf: view.analysis.coverage.asOf }), params(candidate.id)));
    assert.equal(confirmed.status, 200); assert.equal((await confirmed.json()).forecastChanged, false);
    const saved = await within(a, () => spending.GET()).then(r => r.json());
    assert.equal(saved.candidates.find((c: { id: string }) => c.id === candidate.id).status, "confirmed");
    const foreign = await within(b, () => recurringPattern.PATCH(patch({ action: "confirm", version: 0, asOf: view.analysis.coverage.asOf }), params(candidate.id)));
    assert.equal(foreign.status, 404);
    const stale = await within(a, () => recurringPattern.PATCH(patch({ action: "edit", version: 0, asOf: view.analysis.coverage.asOf, amountCents: 1000 }), params(candidate.id)));
    assert.equal(stale.status, 409);
    const invalid = await within(a, () => recurringPattern.PATCH(patch({ action: "edit", version: 1, asOf: view.analysis.coverage.asOf, amountCents: 10.01 }), params(candidate.id)));
    assert.equal(invalid.status, 400);
    const injected = await within(a, () => recurringPattern.PATCH(patch({ action: "confirm", version: 1, asOf: view.analysis.coverage.asOf, personaId: "sam" }), params(candidate.id)));
    assert.equal(injected.status, 400);
    const malformed = await within(a, () => recurringPattern.PATCH(new Request("http://localhost:3000/api/spending", { method: "PATCH", body: "{" }), params(candidate.id)));
    assert.equal(malformed.status, 400);
    assert.deepEqual(await within(a, () => snap.GET()).then(r => r.json()), before);
    await within(a, () => reset.POST());
    const baseline = await within(a, () => spending.GET()).then(r => r.json());
    assert.equal(baseline.version, 0); assert.deepEqual(baseline.analysis, view.analysis);
    assert.ok(baseline.candidates.every((c: { status: string }) => c.status === "suggested"));
  });
  await t.test("Financial Profile API confirms preferences, falls back safely and personalizes the existing assessment", async () => {
    const getProfile = () => within(a, () => financialProfile.GET()).then(r=>r.json());
    const before = await within(a,()=>snap.GET()).then(r=>r.json());
    let profile = await getProfile();
    assert.equal(profile.status,"not_generated");
    let response = await within(a,()=>financialProfile.PATCH(req("/api/financial-profile",{action:"confirm_preferences",version:profile.version,basisHash:profile.basisHash,planningBufferCents:200000,priorityGoalId:"a-trip",focus:"goals"},"PATCH")));
    assert.equal(response.status,200);profile=await response.json();
    response=await within(a,()=>financialProfile.POST(req("/api/financial-profile",{version:profile.version,basisHash:profile.basisHash})));
    assert.equal(response.status,200);profile=await response.json();assert.equal(profile.profile.source,"template");assert.equal(profile.status,"ready");
    assert.equal((await within(b,()=>financialProfile.GET()).then(r=>r.json())).preferences,null);
    assert.equal((await within(a,()=>financialProfile.POST(req("/api/financial-profile",{version:0,basisHash:"stale"})))).status,409);
    const assessed=await within(a,()=>decisions.POST(req("/api/decisions",{productId:"aero-14"}))).then(r=>r.json());
    const explanation=await within(a,()=>profilePurchase.POST(req("/api/financial-profile/purchase",{decisionId:assessed.decision.id,method:"full"})));
    assert.equal(explanation.status,200);const result=await explanation.json();assert.equal(result.personalized,true);assert.equal(result.readOnly,true);assert.match(result.text,/Japan trip/);
    assert.equal((await within(b,()=>profilePurchase.POST(req("/api/financial-profile/purchase",{decisionId:assessed.decision.id,method:"full"})))).status,404);
    const created=await within(a,()=>orders.POST(req("/api/orders",{decisionId:assessed.decision.id,method:"full"}))).then(r=>r.json());
    const merchantStyleReview=await within(a,()=>profilePurchase.POST(req("/api/financial-profile/purchase",{orderId:created.id,method:"full"})));
    assert.equal(merchantStyleReview.status,200);assert.equal((await merchantStyleReview.json()).readOnly,true);
    assert.equal((await within(a,()=>order.GET(new Request("http://localhost:3000"),params(created.id))).then(r=>r.json())).order.status,"CREATED");
    assert.deepEqual(await within(a,()=>snap.GET()).then(r=>r.json()),before);
    await within(a,()=>reset.POST());assert.equal((await getProfile()).preferences,null);assert.equal((await getProfile()).status,"not_generated");
  });
  await t.test("Financial Profile API rejects malformed and unsupported write commands",async()=>{
    const profile=await within(a,()=>financialProfile.GET()).then(r=>r.json());
    assert.equal((await within(a,()=>financialProfile.POST(req("/api/financial-profile",{version:profile.version,basisHash:profile.basisHash,executePayment:true})))).status,400);
    assert.equal((await within(a,()=>financialProfile.PATCH(req("/api/financial-profile",{version:profile.version,basisHash:profile.basisHash,action:"capture"},"PATCH")))).status,400);
    assert.equal((await within(a,()=>profilePurchase.POST(req("/api/financial-profile/purchase",{method:"full"})))).status,400);
    assert.equal((await within(a,()=>financialProfile.POST(new Request("http://localhost:3000/api/financial-profile",{method:"POST",body:"{"})))).status,400);
  });
  fs.rmSync(dir, { recursive: true });
});
