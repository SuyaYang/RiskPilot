import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createMerchantServer } from "../merchant-demo/server";
import { MERCHANT_ID, readMerchantTicket, readBridgeRequest, signEnvelope, verifyEnvelope, localOrigin } from "../lib/merchantBridge";
import type { createOrder, PayPalOrder } from "../lib/paypal";

test("cooperating store → PayPal Continue → RiskPilot review → merchant capture → store receipt", async t => {
  Object.assign(globalThis, { AsyncLocalStorage });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rp-merchant-flow-"));
  process.env.STORE_PATH = path.join(dir, "riskpilot.json");
  process.env.MERCHANT_BRIDGE_SECRET = "fixture-only-merchant-bridge-secret-0123456789";
  process.env.APP_ORIGIN = "http://localhost:3100";
  process.env.MERCHANT_ORIGIN = "http://localhost:3200";
  process.env.DEMO_TODAY = "2026-11-10";
  const key = process.env.MERCHANT_BRIDGE_SECRET;
  let creates = 0, captures = 0, timeoutAfterCapture = false, capturePending = false;
  let lastCreate: Parameters<typeof createOrder>[0];
  const remoteOrders = new Map<string, PayPalOrder>();
  const gateway = {
    configured: () => true,
    create: async (args: Parameters<typeof createOrder>[0]) => {
      lastCreate = args; creates++;
      const id = `ORDER${creates}`;
      remoteOrders.set(id, { id, status: "CREATED", purchase_units: [{ custom_id: args.customId, amount: { value: args.amount.toFixed(2), currency_code: "USD" } }] });
      return { id, status: "CREATED" }; // Minimal PayPal representations must be verified via GET.
    },
    get: async (id: string) => structuredClone(remoteOrders.get(id)!),
    capture: async (id: string) => {
      captures++;
      const remote = remoteOrders.get(id)!; remote.status = "COMPLETED";
      remote.purchase_units![0].payments = { captures: [{ id: `CAP-${id}`, status: capturePending ? "PENDING" : "COMPLETED", amount: { value: "900.00", currency_code: "USD" } }] };
      if (timeoutAfterCapture) throw new Error("Timeout after PayPal succeeded");
      return { id, status: "COMPLETED" };
    },
  };
  const ledgerPath = path.join(dir, "merchant.json");
  const server = createMerchantServer({ ledgerPath, gateway, bridgeKey: key, reviewOrigin: "http://localhost:3100" });
  const handle = server.listeners("request")[0] as (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  async function merchantRequest(route: string, options: { cookie?: string; method?: string; origin?: string; authorization?: string } = {}) {
    const headers: { [name: string]: string } = {}; let status = 200, raw = "";
    const res = {
      setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; },
      writeHead(code: number, extra: { [name: string]: string } = {}) { status = code; for (const [name, value] of Object.entries(extra)) headers[name.toLowerCase()] = value; },
      end(value: string | Buffer = "") { raw = value.toString(); },
    };
    await handle({ url: route, method: options.method || "POST", headers: { cookie: options.cookie || "", origin: options.origin ?? "http://localhost:3200", authorization: options.authorization } } as IncomingMessage, res as unknown as ServerResponse);
    return { status, headers, raw, data: raw.startsWith("{") ? JSON.parse(raw) : {}, cookie: headers["set-cookie"]?.split(";")[0] || options.cookie || "" };
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "http://localhost:3200"); assert.equal(url.pathname, "/api/riskpilot");
    const result = await merchantRequest(url.pathname, { authorization: new Headers(init?.headers).get("authorization") || undefined });
    return new Response(result.raw, { status: result.status, headers: { "Content-Type": "application/json" } });
  };
  t.after(() => { globalThis.fetch = originalFetch; fs.rmSync(dir, { recursive: true, force: true }); });
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const { RequestCookies } = await import("next/dist/compiled/@edge-runtime/cookies");
  const { NextRequest } = await import("next/server");
  const { middleware } = await import("../middleware");
  const claim = await import("../app/api/merchant/claim/route");
  const orderRoute = await import("../app/api/orders/[id]/route");
  const captureRoute = await import("../app/api/orders/[id]/capture/route");
  const { snapshot, inputHash } = await import("../lib/state");
  const { load, update } = await import("../lib/store");
  const { captureCheckout } = await import("../lib/checkout");
  const workspace = crypto.randomUUID(), otherWorkspace = crypto.randomUUID();
  const owner = `${workspace}:sam`;
  async function within<T>(workspaceId: string, fn: () => Promise<T>) {
    const cookie = `rp_workspace=${workspaceId}; rp_persona=sam`;
    return workAsyncStorage.run({ route: "/merchant-test", isStaticGeneration: false } as never, () =>
      workUnitAsyncStorage.run({ type: "request", phase: "render", cookies: new RequestCookies(new Headers({ cookie })) } as never, fn));
  }
  const req = (body: unknown) => new Request("http://localhost:3100/api/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let id = "", merchantCookie = "", ticket = "", reviewedHash = "";
  const params = () => ({ params: Promise.resolve({ id }) });
  const view = () => within(workspace, () => orderRoute.GET(new Request("http://localhost:3100"), params())).then(res => res.json());
  const confirm = (body: unknown) => within(workspace, () => captureRoute.POST(req(body), params()));

  await t.test("merchant creates its full-price order with CONTINUE and never captures on return", async () => {
    assert.equal(Object.keys(load().decisions).length, 0, "Merchant checkout must not require a prior Shop exploration");
    const created = await merchantRequest("/api/order"); assert.equal(created.status, 200);
    id = created.data.orderId; merchantCookie = created.cookie;
    assert.equal(lastCreate.amount, 900);
    assert.deepEqual(lastCreate.experience, { origin: "http://localhost:3200", brandName: "Northstar Electronics · Sandbox", userAction: "CONTINUE" });
    assert.equal((await merchantRequest("/api/order", { cookie: merchantCookie })).data.orderId, id); assert.equal(creates, 1);
    const returned = await merchantRequest(`/checkout/return?token=${id}`, { method: "GET", cookie: merchantCookie });
    assert.equal(returned.status, 302);
    const destination = new URL(returned.headers.location); assert.equal(destination.origin, "http://localhost:3100");
    assert.equal(destination.pathname, "/checkout/connect"); ticket = destination.searchParams.get("ticket")!;
    assert.equal(readMerchantTicket(ticket).orderId, id); assert.equal(captures, 0);
  });
  await t.test("unapproved, expired and tampered reviews cannot import a payment", async () => {
    const unapproved = await within(workspace, () => claim.POST(req({ ticket })));
    assert.equal(unapproved.status, 409); assert.equal(captures, 0);
    const tampered = await within(workspace, () => claim.POST(req({ ticket: `x${ticket}` })));
    assert.equal(tampered.status, 400);
    const ref = readMerchantTicket(ticket);
    const expired = signEnvelope("ticket", { ...ref, expiresAt: Date.now() - 1 });
    assert.equal((await within(workspace, () => claim.POST(req({ ticket: expired })))).status, 400);
    assert.equal(Object.keys(load().orders).length, 0);
  });
  await t.test("PayPal approval opens a read-only impact review using the current buyer profile", async () => {
    remoteOrders.get(id)!.status = "APPROVED";
    const response = await within(workspace, () => claim.POST(req({ ticket })));
    assert.equal(response.status, 200); assert.equal((await response.json()).orderId, id);
    const data = await view(); reviewedHash = data.review.decision.inputHash;
    assert.equal(data.review.recheck.status,"unavailable");assert.ok(data.review.decision.options.length>=4);
    assert.equal(data.order.amount, 900); assert.equal(data.order.merchant.name, "Northstar Electronics");
    assert.equal(data.review.decision.options.find((option: { method: string }) => option.method === "full").forecast.minBalance, 7995);
    assert.equal(data.cancelUrl, "http://localhost:3200/?cancelled=1");
    assert.equal(captures, 0); assert.equal(snapshot(owner).purchases.length, 0);
    assert.equal((await within(workspace, () => claim.POST(req({ ticket })))).status, 200);
  });
  await t.test("confirmed profile explains a signed merchant review without changing its assessment or payment", async () => {
    const { financialProfileView, editFinancialProfile } = await import("../lib/financialProfile/service");
    const { personalizedPurchaseFacts } = await import("../lib/financialProfile/purchase");
    const before = snapshot(owner), hash = inputHash(owner), profile = financialProfileView(owner), orderBefore = structuredClone(load().orders[id]);
    editFinancialProfile(owner, { version: profile.version, basisHash: profile.basisHash, action: "confirm_preferences", planningBufferCents: 200025, priorityGoalId: null, focus: "commitments" });
    const explanation = personalizedPurchaseFacts(owner, { orderId: id, method: "full", timing: "now" });
    assert.equal(explanation.personalized, true);
    assert.match(explanation.facts.confirmed_context, /scheduled bill\/reserve occurrences/);
    assert.match(explanation.facts.engine_impact, /\$7,995\.00/);
    assert.equal(inputHash(owner), hash); assert.deepEqual(snapshot(owner), before);
    assert.equal(captures, 0); assert.deepEqual(load().orders[id], orderBefore);
    assert.throws(() => personalizedPurchaseFacts(`${otherWorkspace}:sam`, { orderId: id, method: "full" }), /not found/i);
  });
  await t.test("Flow B can cancel before or after approval without capture, then reopen the same review", async () => {
    const created = await merchantRequest("/api/order");
    const cancelledId = created.data.orderId, cookie = created.cookie;
    const before = snapshot(owner), captureCount = captures;
    const cancelled = await merchantRequest(`/checkout/return?cancelled=1&token=${cancelledId}`, { method: "GET", cookie });
    assert.equal(cancelled.status, 302); assert.equal(cancelled.headers.location, "/?cancelled=1");
    assert.equal(captures, captureCount); assert.equal(load().orders[cancelledId], undefined);
    remoteOrders.get(cancelledId)!.status = "APPROVED";
    const returned = await merchantRequest(`/checkout/return?token=${cancelledId}`, { method: "GET", cookie });
    const destination = new URL(returned.headers.location);
    assert.equal(destination.pathname, "/checkout/connect");
    const cancelTicket = destination.searchParams.get("ticket")!;
    assert.equal((await within(workspace, () => claim.POST(req({ ticket: cancelTicket })))).status, 200);
    const ctx = { params: Promise.resolve({ id: cancelledId }) };
    const review = await within(workspace, () => orderRoute.GET(new Request("http://localhost:3100"), ctx)).then(r => r.json());
    assert.equal(review.payment.state, "APPROVED"); assert.ok(review.review);
    assert.equal(review.cancelUrl, "http://localhost:3200/?cancelled=1");
    assert.equal(new URL(review.order.approvalUrl).searchParams.get("token"), cancelledId);
    const storeReturn = await merchantRequest("/?cancelled=1", { method: "GET", cookie });
    assert.equal(storeReturn.status, 200);
    const status = await merchantRequest("/api/status", { method: "GET", cookie });
    assert.equal(status.data.status, "APPROVED"); assert.equal(status.data.captureId, undefined);
    assert.equal((await within(workspace, () => claim.POST(req({ ticket: cancelTicket })))).status, 200);
    assert.equal(captures, captureCount); assert.deepEqual(snapshot(owner), before);
  });
  await t.test("another buyer, direct capture and unsigned merchant requests cannot bypass review", async () => {
    assert.equal((await within(otherWorkspace, () => claim.POST(req({ ticket })))).status, 404);
    assert.equal((await within(otherWorkspace, () => orderRoute.GET(new Request("http://localhost:3100"), params()))).status, 404);
    assert.equal((await merchantRequest("/api/capture", { cookie: merchantCookie })).status, 403);
    assert.equal((await merchantRequest("/api/riskpilot")).status, 401);
    await assert.rejects(() => captureCheckout(owner, id), /captured by its merchant/);
    assert.equal((await confirm({ inputHash: reviewedHash })).status, 400);
    assert.equal((await confirm({reviewConfirmed:true,inputHash:reviewedHash,timing:"after_income"})).status,400);
    assert.equal(captures, 0);
  });
  await t.test("a changed goal invalidates confirmation until the impact is refreshed", async () => {
    update(data => { data.personas[owner].goals[0].savedSoFar += 100; });
    assert.notEqual(reviewedHash, inputHash(owner));
    assert.equal((await confirm({ reviewConfirmed: true, inputHash: reviewedHash })).status, 409);
    assert.equal(captures, 0); reviewedHash = (await view()).review.decision.inputHash;
  });
  await t.test("provider amount or currency mismatch prevents the merchant from capturing", async () => {
    remoteOrders.get(id)!.purchase_units![0].amount!.currency_code = "EUR";
    assert.equal((await confirm({ reviewConfirmed: true, inputHash: reviewedHash })).status, 502);
    assert.equal(captures, 0);
    remoteOrders.get(id)!.purchase_units![0].amount!.currency_code = "USD";
  });
  await t.test("capture timeout is not reported as success and is recovered on the same order", async () => {
    timeoutAfterCapture = true;
    const uncertain = await confirm({ reviewConfirmed: true, inputHash: reviewedHash });
    assert.equal(uncertain.status, 502); assert.equal(load().orders[id].status, "UNKNOWN");
    assert.equal(snapshot(owner).purchases.length, 0); assert.equal(captures, 1);
    const recovered = await confirm({ reviewConfirmed: true, inputHash: reviewedHash });
    const data = await recovered.json(); assert.equal(recovered.status, 200); assert.equal(data.status, "CAPTURED");
    assert.equal(data.returnUrl, `http://localhost:3200/receipt?order=${id}`);
    assert.equal(captures, 1); assert.equal(snapshot(owner).purchases.length, 1);
    assert.equal(snapshot(owner).forecast.startBalance, 8100);
    assert.equal(load().orders[id].projectionStatus, "UPDATED");
  });
  await t.test("duplicate confirmation and merchant receipt agree on one verified capture", async () => {
    assert.equal((await confirm({ reviewConfirmed: true, inputHash: reviewedHash })).status, 200);
    assert.equal(captures, 1); assert.equal(snapshot(owner).purchases.length, 1);
    const receipt = await merchantRequest("/api/status", { method: "GET", cookie: merchantCookie });
    assert.equal(receipt.data.status, "CAPTURED"); assert.equal(receipt.data.captureId, `CAP-${id}`);
    const data = await view(); assert.equal(data.review, null); assert.ok(data.forecastSnapshot);
    assert.equal(data.comparison.available,true);assert.equal(data.comparison.before.forecast.startBalance,9000);assert.equal(data.comparison.after.forecast.startBalance,8100);
    assert.equal(data.forecastSnapshot.before.purchases.length,0);assert.equal(data.forecastSnapshot.data.purchases.length,1);
    const persisted = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    assert.equal(Object.values(persisted.sessions as { [id: string]: { reviewedHash: string } }).find(record => record.reviewedHash)?.reviewedHash, reviewedHash);
  });
  await t.test("signatures are purpose-bound, requests expire, and destinations cannot redirect off-site", () => {
    const ref = readMerchantTicket(ticket);
    const payload = { ...ref, action: "capture", issuedAt: Date.now(), nonce: crypto.randomUUID(), reviewHash: reviewedHash };
    assert.throws(() => readBridgeRequest(signEnvelope("ticket", payload)));
    assert.throws(() => readBridgeRequest(signEnvelope("request", { ...payload, issuedAt: Date.now() - 120_000 })));
    assert.throws(() => readBridgeRequest(signEnvelope("request", { ...payload, reviewHash: undefined })));
    assert.throws(() => verifyEnvelope("response", signEnvelope("response", payload), "wrong-key"));
    for (const invalid of ["https://evil.example", "http://localhost:3200/path", "http://localhost:3200/?return=evil", "http://user@localhost:3200"]) assert.throws(() => localOrigin(invalid));
    const response = middleware(new NextRequest("http://localhost:3100/checkout/connect?ticket=redacted"));
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(middleware(new NextRequest("http://localhost:3100/api/merchant/claim", { method: "POST", headers: { origin: "https://evil.example" } })).status, 403);
    assert.equal(MERCHANT_ID, "northstar-demo");
  });
  await t.test("pending merchant capture is shown honestly, never recaptured, then recovered once", async () => {
    timeoutAfterCapture = false; capturePending = true;
    const created = await merchantRequest("/api/order");
    id = created.data.orderId; merchantCookie = created.cookie;
    remoteOrders.get(id)!.status = "APPROVED";
    const returned = await merchantRequest(`/review?token=${id}`, { method: "GET", cookie: merchantCookie });
    ticket = new URL(returned.headers.location).searchParams.get("ticket")!;
    assert.equal((await within(workspace, () => claim.POST(req({ ticket })))).status, 200);
    reviewedHash = inputHash(owner);
    const before = snapshot(owner), captureCount = captures;
    const review = await view();
    assert.equal(review.payment.state, "APPROVED");
    const first = await confirm({ reviewConfirmed: true, inputHash: reviewedHash });
    assert.equal(first.status, 202); assert.equal((await first.json()).code, "PAYMENT_PENDING");
    assert.equal(captures, captureCount + 1);
    const pendingReview = await view(); assert.equal(pendingReview.payment.state, "PENDING");
    assert.equal(pendingReview.payment.forecast, "Awaiting confirmed capture");
    const again = await confirm({ reviewConfirmed: true, inputHash: reviewedHash });
    assert.equal(again.status, 202); assert.equal(captures, captureCount + 1);
    assert.deepEqual(snapshot(owner), before);
    const receipt = await merchantRequest("/api/status", { method: "GET", cookie: merchantCookie });
    assert.notEqual(receipt.data.status, "CAPTURED"); assert.equal(receipt.data.captureStatus, "PENDING");
    remoteOrders.get(id)!.purchase_units![0].payments!.captures![0].status = "COMPLETED";
    const recoveryView = await view(); assert.equal(recoveryView.payment.state, "CAPTURED_UNSAVED");
    assert.equal(snapshot(owner).purchases.length, before.purchases.length, "Read-only status lookup must not update the forecast");
    assert.equal((await confirm({ reviewConfirmed: true, inputHash: reviewedHash })).status, 200);
    assert.equal(captures, captureCount + 1);
    assert.equal(snapshot(owner).purchases.length, before.purchases.length + 1);
    assert.equal((await view()).payment.state, "CAPTURED");
    assert.equal((await view()).payment.forecast, "Updated & saved");
    capturePending = false;
  });

  await t.test("Explore → signed intent → merchant approval → Smart Recheck → explicit capture stays exactly once", async () => {
    const decisions = await import("../app/api/decisions/route");
    const intentRoute = await import("../app/api/merchant/intent/route");
    const assessed = await within(workspace, () => decisions.POST(req({ productId:"aero-14" }))).then(r=>r.json());
    const prior = structuredClone(load().decisions[assessed.decision.id]);
    const intents = await within(workspace, () => intentRoute.POST(req({ decisionId:prior.id }))).then(r=>r.json());
    assert.equal(intents.createsPayment,false);
    const destination = new URL(intents.url);
    const storeVisit = await merchantRequest(destination.pathname+destination.search,{method:"GET"});
    const localCookie=storeVisit.cookie,captureCount=captures;
    const created = await merchantRequest("/api/order",{cookie:localCookie});const localId=created.data.orderId;
    remoteOrders.get(localId)!.status="APPROVED";
    const returned=await merchantRequest(`/checkout/return?token=${localId}`,{method:"GET",cookie:localCookie});
    const localTicket=new URL(returned.headers.location).searchParams.get("ticket")!;
    assert.equal((await within(workspace,()=>claim.POST(req({ticket:localTicket})))).status,200);
    const context={params:Promise.resolve({id:localId})};
    const reviewed=await within(workspace,()=>orderRoute.GET(new Request("http://localhost:3100"),context)).then(r=>r.json());
    assert.equal(reviewed.review.recheck.status,"unchanged");assert.equal(reviewed.order.priorAssessmentId,prior.id);
    assert.ok(reviewed.review.decision.options.length>=4);assert.equal(captures,captureCount);
    assert.deepEqual(load().decisions[prior.id],prior);
    update(data=>{data.personas[owner].goals[0].savedSoFar+=25;});
    const refreshed=await within(workspace,()=>orderRoute.GET(new Request("http://localhost:3100"),context)).then(r=>r.json());
    assert.equal(refreshed.review.recheck.status,"changed");
    assert.equal((await within(workspace,()=>captureRoute.POST(req({inputHash:refreshed.review.decision.inputHash}),context))).status,400);
    assert.equal(captures,captureCount);
    const before=snapshot(owner),body={reviewConfirmed:true,inputHash:refreshed.review.decision.inputHash};
    assert.equal((await within(workspace,()=>captureRoute.POST(req(body),context))).status,200);
    assert.equal((await within(workspace,()=>captureRoute.POST(req(body),context))).status,200);
    assert.equal(captures,captureCount+1);assert.equal(snapshot(owner).purchases.length,before.purchases.length+1);
    const receipt=await merchantRequest("/api/status",{method:"GET",cookie:localCookie});assert.equal(receipt.data.status,"CAPTURED");
  });
  await t.test("invalid or cross-workspace intent cannot downgrade a fresh full merchant review", async () => {
    const {createPurchaseIntent}=await import("../lib/purchaseIntent");
    const decisions=await import("../app/api/decisions/route");
    const assessed=await within(workspace,()=>decisions.POST(req({productId:"aero-14"}))).then(r=>r.json());
    const valid=createPurchaseIntent(owner,assessed.decision.id),token=new URL(valid.url).searchParams.get("riskpilot_intent")!;
    for (const intent of ["invalid",token]) {
      const storeVisit=await merchantRequest(`/?riskpilot_intent=${encodeURIComponent(intent)}`,{method:"GET"});
      const created=await merchantRequest("/api/order",{cookie:storeVisit.cookie});const localId=created.data.orderId;
      remoteOrders.get(localId)!.status="APPROVED";
      const returned=await merchantRequest(`/checkout/return?token=${localId}`,{method:"GET",cookie:storeVisit.cookie});
      const ticket=new URL(returned.headers.location).searchParams.get("ticket")!;
      assert.equal((await within(otherWorkspace,()=>claim.POST(req({ticket})))).status,200);
      const view=await within(otherWorkspace,()=>orderRoute.GET(new Request("http://localhost:3100"),{params:Promise.resolve({id:localId})})).then(r=>r.json());
      assert.equal(view.review.recheck.status,"unavailable");assert.ok(view.review.decision.options.length>=4);
    }
  });

});
