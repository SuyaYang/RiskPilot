import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Decision, MethodId } from "../lib/types";
import type { Gateway } from "../lib/checkout";
import type { PayPalOrder } from "../lib/paypal";

test("checkout recovery, durable facts and isolated demo workspaces", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riskpilot-tests-"));
  process.env.STORE_PATH = path.join(dir, "store.json");
  process.env.DEMO_TODAY = "2026-11-10";
  process.env.DEMO_SEED_ENABLED = "true";
  const { load, update, ensurePersona, reset } = await import("../lib/store");
  const { inputHash, personaWithState, snapshot } = await import("../lib/state");
  const { buildOptions } = await import("../lib/engine/options");
  const { getProduct } = await import("../lib/catalog");
  const { createCheckout, captureCheckout, ownedOrder, CheckoutError } = await import("../lib/checkout");
  const { recordCapture } = await import("../lib/purchases");
  const { processVerifiedWebhook } = await import("../lib/webhooks");
  const owner = "workspace-a:alex", other = "workspace-b:alex";
  ensurePersona(owner); ensurePersona(other);
  let sequence = 0;
  function assess(user = owner) {
    const { persona, payments } = personaWithState(user);
    const result = buildOptions(persona, persona.goals, payments, getProduct("aero-14")!, getProduct("aero-13"));
    const decision: Decision = { id: `d-${++sequence}`, personaId: user, productId: "aero-14", createdAt: new Date().toISOString(), baseline: result.options.at(-1)!.forecast, options: result.options, recommendedMethod: result.recommended, inputHash: inputHash(user), schemaVersion: "rp-v1" };
    update(s => { s.decisions[decision.id] = decision; });
    return decision;
  }
  function remote(id: string, decision: Decision, method: MethodId, status = "APPROVED", captured = false): PayPalOrder {
    return { id, status, purchase_units: [{ custom_id: `${decision.id}:${method}`, amount: { value: "900.00", currency_code: "USD" }, ...(captured && { payments: { captures: [{ id: `CAP-${id}`, status: "COMPLETED", amount: { value: "900.00", currency_code: "USD" } }] } }) }] };
  }
  function mock(d: Decision, status = "APPROVED") {
    const id = `PP-${d.id}`;
    let captureCalls = 0;
    const requests: string[] = [];
    const api: Gateway = {
      configured: () => true,
      create: async opts => { requests.push(opts.requestId); assert.equal(opts.amount, 900); return remote(id, d, "pay_in_4", status); },
      get: async () => remote(id, d, "pay_in_4", status),
      capture: async () => { captureCalls++; return remote(id, d, "pay_in_4", "COMPLETED", true); },
    };
    return { id, api, requests, captures: () => captureCalls };
  }
  await t.test("unapproved payment returns actionable error without a capture request", async () => {
    const d = assess(), m = mock(d, "PAYER_ACTION_REQUIRED");
    await createCheckout(owner, d.id, "pay_in_4", m.api);
    await assert.rejects(captureCheckout(owner, m.id, m.api), (e: unknown) => e instanceof CheckoutError && e.code === "PAYMENT_NOT_APPROVED");
    assert.equal(m.captures(), 0);
    assert.equal(load().personas[owner].purchases.length, 0);
  });
  await t.test("full merchant price, stable create key and no overwritten capture on retry", async () => {
    const d = assess(), m = mock(d);
    await createCheckout(owner, d.id, "pay_in_4", m.api);
    const before = snapshot(owner).forecast.startBalance;
    await captureCheckout(owner, m.id, m.api);
    await createCheckout(owner, d.id, "pay_in_4", m.api);
    await captureCheckout(owner, m.id, m.api);
    assert.equal(m.requests.length, 1); assert.equal(m.captures(), 1);
    assert.equal(load().orders[m.id].status, "CAPTURED");
    assert.equal(snapshot(owner).forecast.startBalance, before - 900);
    const purchase = load().personas[owner].purchases.at(-1)!;
    assert.equal(purchase.fundingStatus, "UNCONFIRMED");
    assert.equal(purchase.payments.length, 1);
    assert.equal(purchase.payments[0].amount, 900);
    const saved = load().snapshots[`capture:CAP-${m.id}`];
    assert.equal(saved.schemaVersion, "rp-v1"); assert.equal(saved.data.forecast.startBalance, before - 900);
  });
  await t.test("cross-workspace order, decision and reset isolation", async () => {
    const d = assess(), m = mock(d);
    await createCheckout(owner, d.id, "pay_in_4", m.api);
    assert.throws(() => ownedOrder(m.id, other), /not found/);
    await assert.rejects(captureCheckout(other, m.id, m.api), /not found/);
    await assert.rejects(createCheckout(other, d.id, "full", m.api), /not found/);
    reset(other);
    assert.ok(load().orders[m.id]);
    assert.throws(() => reset(owner), /preserve payment records/);
  });
  await t.test("stale goal/payment inputs require reassessment", async () => {
    const d = assess(), m = mock(d);
    update(s => { s.personas[owner].goals[0].targetAmount += 100; });
    await assert.rejects(createCheckout(owner, d.id, "pay_in_4", m.api), /changed/);
    assert.equal(m.requests.length, 0);
  });
  await t.test("capture timeout reconciles completed remote payment exactly once", async () => {
    const d = assess(), m = mock(d); let called = false;
    await createCheckout(owner, d.id, "pay_in_4", m.api);
    m.api.capture = async () => { called = true; throw new Error("timeout after capture"); };
    m.api.get = async () => remote(m.id, d, "pay_in_4", called ? "COMPLETED" : "APPROVED", called);
    const result = await captureCheckout(owner, m.id, m.api);
    assert.equal(result.status, "CAPTURED");
    assert.equal(load().personas[owner].purchases.filter(p => p.orderId === m.id).length, 1);
  });
  await t.test("failed local write after remote capture recovers from provider lookup", async () => {
    const d = assess(), m = mock(d); let paid = false;
    await createCheckout(owner, d.id, "pay_in_4", m.api);
    const rename = fs.renameSync;
    m.api.capture = async () => { paid = true; fs.renameSync = () => { throw new Error("disk unavailable"); }; return remote(m.id, d, "pay_in_4", "COMPLETED", true); };
    m.api.get = async () => remote(m.id, d, "pay_in_4", paid ? "COMPLETED" : "APPROVED", paid);
    try { await assert.rejects(captureCheckout(owner, m.id, m.api)); } finally { fs.renameSync = rename; }
    const recovered = await captureCheckout(owner, m.id, m.api);
    assert.equal(recovered.status, "CAPTURED");
    assert.equal(load().personas[owner].purchases.filter(p => p.orderId === m.id).length, 1);
  });
  await t.test("unknown capture never reports success and retains the stable command", async () => {
    const d = assess(), m = mock(d);
    await createCheckout(owner, d.id, "pay_in_4", m.api);
    m.api.capture = async () => { throw new Error("timeout"); };
    await assert.rejects(captureCheckout(owner, m.id, m.api), /could not be confirmed/);
    assert.equal(load().orders[m.id].status, "UNKNOWN");
    assert.equal(load().orders[m.id].captureRequestId, `capture-${m.id}`);
  });
  await t.test("rejected writes are atomic; amount/currency/duplicate-capture checks", async () => {
    const d = assess(), m = mock(d);
    await createCheckout(owner, d.id, "pay_in_4", m.api);
    for (const amount of [NaN, Infinity, 899.99]) assert.throws(() => recordCapture(m.id, "bad", amount), /mismatch/);
    assert.throws(() => recordCapture(m.id, "bad", 900, "EUR"), /mismatch/);
    const before = load();
    assert.throws(() => update(s => { s.orders[m.id].status = "FAILED"; throw new Error("rollback"); }), /rollback/);
    assert.deepEqual(load(), before);
    recordCapture(m.id, `CAP-${m.id}`, 900);
    assert.throws(() => recordCapture(m.id, "OTHER", 900), /different capture/);
  });
  await t.test("duplicate and out-of-order completion webhooks cannot double-count", async () => {
    const d = assess(), m = mock(d);
    await createCheckout(owner, d.id, "pay_in_4", m.api);
    const resource = { id: `CAP-${m.id}`, status: "COMPLETED", amount: { value: "900.00", currency_code: "USD" }, supplementary_data: { related_ids: { order_id: m.id } } };
    const payload = JSON.stringify({ id: "evt-complete", event_type: "PAYMENT.CAPTURE.COMPLETED", resource });
    processVerifiedWebhook(payload); assert.equal(processVerifiedWebhook(payload).duplicate, true);
    processVerifiedWebhook(JSON.stringify({ id: "evt-complete-again", event_type: "PAYMENT.CAPTURE.COMPLETED", resource }));
    processVerifiedWebhook(JSON.stringify({ id: "evt-late-pending", event_type: "PAYMENT.CAPTURE.PENDING", resource: { ...resource, status: "PENDING" } }));
    assert.equal(load().orders[m.id].status, "CAPTURED");
    assert.equal(load().personas[owner].purchases.filter(p => p.orderId === m.id).length, 1);
  });
  await t.test("webhook arriving before local order persistence remains replayable", async () => {
    const d = assess(), m = mock(d);
    const payload = JSON.stringify({ id: "evt-early", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: `CAP-${m.id}`, status: "COMPLETED", amount: { value: "900", currency_code: "USD" }, supplementary_data: { related_ids: { order_id: m.id } } } });
    assert.throws(() => processVerifiedWebhook(payload), /not persisted/);
    assert.equal(load().webhookEvents["evt-early"].state, "RECEIVED");
    await createCheckout(owner, d.id, "pay_in_4", m.api);
    processVerifiedWebhook(payload);
    assert.equal(load().webhookEvents["evt-early"].state, "PROCESSED");
  });
  await t.test("unknown create replays the same key even if goals changed meanwhile", async () => {
    const d = assess(), m = mock(d); let attempts = 0; const keys: string[] = [];
    m.api.create = async opts => { keys.push(opts.requestId); if (++attempts === 1) throw new Error("response lost after remote creation"); return remote(m.id, d, "pay_in_4"); };
    await assert.rejects(createCheckout(owner, d.id, "pay_in_4", m.api), /could not be confirmed/);
    update(s => { s.personas[owner].goals[0].targetAmount += 10; });
    const recovered = await createCheckout(owner, d.id, "pay_in_4", m.api);
    assert.equal(recovered.orderId, m.id); assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
  });
  await t.test("frozen provider identity is checked before capture", async () => {
    const d = assess(), m = mock(d);
    await createCheckout(owner, d.id, "pay_in_4", m.api);
    m.api.get = async () => ({ ...remote(m.id, d, "pay_in_4"), purchase_units: [{ custom_id: "wrong-user-decision", amount: { value: "900.00", currency_code: "USD" } }] });
    await assert.rejects(captureCheckout(owner, m.id, m.api), /does not match/);
    assert.equal(m.captures(), 0);
  });
  await t.test("financial changes during provider lookup require a fresh final review", async () => {
    const d = assess(), m = mock(d);
    await createCheckout(owner, d.id, "pay_in_4", m.api);
    const reviewed = inputHash(owner);
    m.api.get = async () => { update(s => { s.personas[owner].goals[0].targetAmount += 20; }); return remote(m.id, d, "pay_in_4"); };
    await assert.rejects(captureCheckout(owner, m.id, m.api, reviewed), /finances changed/);
    assert.equal(m.captures(), 0);
  });
  await t.test("corrupt store fails closed instead of silently resetting payment facts", () => {
    const content = fs.readFileSync(process.env.STORE_PATH!, "utf8");
    fs.writeFileSync(process.env.STORE_PATH!, "{broken");
    assert.throws(() => load());
    fs.writeFileSync(process.env.STORE_PATH!, content);
  });
  fs.rmSync(dir, { recursive: true });
});
