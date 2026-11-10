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
  let creates = 0, captures = 0, timeoutAfterCapture = false;
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
      remote.purchase_units![0].payments = { captures: [{ id: `CAP-${id}`, status: "COMPLETED", amount: { value: "900.00", currency_code: "USD" } }] };
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
      end(value = "") { raw = value; },
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
    assert.equal(data.order.amount, 900); assert.equal(data.order.merchant.name, "Northstar Electronics");
    assert.equal(data.review.decision.options.find((option: { method: string }) => option.method === "full").forecast.minBalance, 7995);
    assert.equal(data.cancelUrl, "http://localhost:3200/?cancelled=1");
    assert.equal(captures, 0); assert.equal(snapshot(owner).purchases.length, 0);
    assert.equal((await within(workspace, () => claim.POST(req({ ticket })))).status, 200);
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
});
