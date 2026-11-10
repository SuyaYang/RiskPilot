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
  const simulate = await import("../app/api/orders/[id]/simulate/route");
  const snap = await import("../app/api/snapshot/route");
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
    await within(a, () => simulate.POST(req("/simulate", {}), params(orderId)));
    assert.equal((await within(a, () => snap.GET()).then(r => r.json())).purchases.length, 1);
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
  fs.rmSync(dir, { recursive: true });
});
