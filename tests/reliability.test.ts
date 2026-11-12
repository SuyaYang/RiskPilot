import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Decision } from "../lib/types";
import type { PayPalOrder } from "../lib/paypal";
import { paymentStatusView } from "../lib/paymentStatus";
import { postJson } from "../app/components/ui";
import CheckoutStatus from "../app/components/CheckoutStatus";
Object.assign(globalThis, { React });

test("demo reliability: truthful states, capture concurrency and reset preservation", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rp-reliability-"));
  process.env.STORE_PATH = path.join(dir, "store.json");
  process.env.DEMO_TODAY = "2026-11-10";
  process.env.DEMO_SEED_ENABLED = "true";
  delete process.env.PAYPAL_CLIENT_ID; delete process.env.PAYPAL_CLIENT_SECRET;
  const { load, update, ensurePersona, reset, newPersona } = await import("../lib/store");
  const { personaWithState, inputHash, snapshot } = await import("../lib/state");
  const { buildOptions } = await import("../lib/engine/options");
  const { getProduct } = await import("../lib/catalog");
  const { createCheckout, captureCheckout, inspectCheckout, demoEnabled } = await import("../lib/checkout");
  const { recordCapture } = await import("../lib/purchases");
  const owner = "fixture-workspace:alex", other = "fixture-workspace:sam";
  ensurePersona(owner); ensurePersona(other);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  function assess() {
    const { persona, payments } = personaWithState(owner);
    const result = buildOptions(persona, persona.goals, payments, getProduct("aero-14")!);
    const d: Decision = { id: crypto.randomUUID(), personaId: owner, productId: "aero-14", createdAt: new Date().toISOString(), inputHash: inputHash(owner), schemaVersion: "rp-v1", baseline: result.options.at(-1)!.forecast, options: result.options, recommendedMethod: result.recommended };
    update(s => { s.decisions[d.id] = d; }); return d;
  }
  function fixture(d: Decision) {
    const id = `ORDER-${d.id}`;
    const remote: PayPalOrder = { id, status: "APPROVED", purchase_units: [{ custom_id: `${d.id}:full`, amount: { value: "900.00", currency_code: "USD" } }] };
    let captures = 0;
    const api = { configured: () => true, create: async () => structuredClone(remote), get: async () => structuredClone(remote), capture: async () => { captures++; return structuredClone(remote); } };
    return { id, remote, api, captures: () => captures };
  }
  await t.test("an uncertain real provider create cannot be erased by reset", async () => {
    const d = assess(), f = fixture(d);
    f.api.create = async () => { throw new Error("response lost"); };
    await assert.rejects(createCheckout(owner, d.id, "full", f.api), /could not be confirmed/);
    const before = load();
    assert.throws(() => reset(owner), /preserve|unconfirmed/i);
    assert.deepEqual(load(), before);
    update(s => { delete s.commands[`create-${d.id}-full`]; }); // Disposable fixture only.
  });
  await t.test("a stale preflight cannot start another capture after a concurrent completion", async () => {
    const d = assess(), f = fixture(d);
    await createCheckout(owner, d.id, "full", f.api);
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    f.api.get = async () => { const copy = structuredClone(f.remote); entered(); await waiting; return copy; };
    const pending = captureCheckout(owner, f.id, f.api);
    await started;
    recordCapture(f.id, `CAP-${f.id}`, 900);
    release();
    assert.equal((await pending).status, "CAPTURED");
    assert.equal(f.captures(), 0);
    assert.equal(load().orders[f.id].captureCommand, "COMPLETED");
  });
  await t.test("a pending capture is not retried or counted as a payment", async () => {
    const d = assess(), f = fixture(d);
    await createCheckout(owner, d.id, "full", f.api);
    f.remote.purchase_units![0].payments = { captures: [{ id: `CAP-${f.id}`, status: "PENDING", amount: { value: "900.00", currency_code: "USD" } }] };
    const before = snapshot(owner);
    await assert.rejects(captureCheckout(owner, f.id, f.api), (e: unknown) => (e as { code: string }).code === "PAYMENT_PENDING");
    await assert.rejects(captureCheckout(owner, f.id, f.api), /pending/);
    assert.equal(f.captures(), 0);
    assert.deepEqual(snapshot(owner), before);
    const observation = await inspectCheckout(load().orders[f.id], f.api);
    assert.equal(paymentStatusView(load().orders[f.id], observation).state, "PENDING");
    f.remote.purchase_units![0].payments!.captures![0].status = "COMPLETED";
    assert.equal((await captureCheckout(owner, f.id, f.api)).status, "CAPTURED");
    assert.equal(f.captures(), 0);
    assert.equal(snapshot(owner).purchases.filter(p => p.orderId === f.id).length, 1);
  });
  await t.test("a new pending capture response and later decline never create an expense or another capture", async () => {
    const d = assess(), f = fixture(d);
    const order = await createCheckout(owner, d.id, "full", f.api);
    let requests = 0;
    f.api.capture = async () => {
      requests++;
      f.remote.purchase_units![0].payments = { captures: [{ id: `CAP-${f.id}`, status: "PENDING", amount: { value: "900.00", currency_code: "USD" } }] };
      return structuredClone(f.remote);
    };
    const before = snapshot(owner);
    await assert.rejects(captureCheckout(owner, f.id, f.api), /pending/);
    await assert.rejects(captureCheckout(owner, f.id, f.api), /pending/);
    assert.equal(requests, 1);
    f.remote.purchase_units![0].payments!.captures![0].status = "DECLINED";
    await assert.rejects(captureCheckout(owner, f.id, f.api), (error: unknown) => (error as { code: string }).code === "PAYMENT_FAILED");
    assert.equal(paymentStatusView(order, await inspectCheckout(order, f.api)).state, "FAILED");
    assert.equal(requests, 1); assert.deepEqual(snapshot(owner), before);
  });
  await t.test("refund and reversal events flag review without inventing a bank credit or removing the reserve", async () => {
    const d = assess(), f = fixture(d);
    await createCheckout(owner, d.id, "full", f.api);
    recordCapture(f.id, `CAP-${f.id}`, 900);
    const before = snapshot(owner);
    const { processVerifiedWebhook } = await import("../lib/webhooks");
    for (const type of ["REFUNDED", "REVERSED"]) {
      const raw = JSON.stringify({ id: `event-${type}`, event_type: `PAYMENT.CAPTURE.${type}`, resource: { id: `CAP-${f.id}`, supplementary_data: { related_ids: { order_id: f.id } } } });
      processVerifiedWebhook(raw); assert.equal(processVerifiedWebhook(raw).duplicate, true);
      assert.equal(load().orders[f.id].settlementReview, `PAYMENT.CAPTURE.${type}`);
      assert.deepEqual(snapshot(owner), before);
      assert.equal(load().orders[f.id].status, "CAPTURED");
    }
  });
  await t.test("approval, lookup failure, remote capture and forecast persistence remain distinct", async () => {
    const d = assess(), f = fixture(d);
    const o = await createCheckout(owner, d.id, "full", f.api);
    assert.equal(paymentStatusView(o, { status: "APPROVED", capture: null }).state, "APPROVED");
    assert.equal(paymentStatusView(o, { status: "COMPLETED", capture: null }).state, "PENDING");
    assert.equal(paymentStatusView(o, undefined, true).state, "UNKNOWN");
    const remote = paymentStatusView(o, { status: "COMPLETED", capture: { id: "CAP", status: "COMPLETED", amount: 900, currency: "USD" } });
    assert.equal(remote.state, "CAPTURED_UNSAVED"); assert.match(remote.forecast, /not saved/);
    const html = renderToStaticMarkup(React.createElement(CheckoutStatus, { payment: remote }));
    assert.match(html, /local recovery required/); assert.match(html, /reconciliation unavailable/);
    assert.doesNotMatch(html, /Updated &amp; saved/);
    f.remote.purchase_units![0].amount!.value = "0.01";
    await assert.rejects(inspectCheckout(o, f.api), /does not match/);
    assert.equal(f.captures(), 0);
  });
  await t.test("simulation reset restores only the selected persona and its histories", async () => {
    const simulationOwner = "reset-only:alex";
    ensurePersona(simulationOwner);
    const beforeOther = load().personas[other];
    update(s => { s.personas[simulationOwner].goals[0].savedSoFar = 1; s.personas[simulationOwner].goalHistory.push({ at: "now", action: "update", goalId: "x", name: "x", summary: "x" }); });
    reset(simulationOwner);
    assert.deepEqual(load().personas[simulationOwner], newPersona(simulationOwner));
    assert.deepEqual(load().personas[other], beforeOther);
  });
  await t.test("malformed JSON and pending error responses never masquerade as successful mutations", async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = async () => new Response("<html>proxy error</html>", { status: 200 });
      await assert.rejects(postJson("http://fixture/api/orders", {}), /unreadable response/);
      globalThis.fetch = async () => Response.json({ error: "Capture pending" }, { status: 202 });
      await assert.rejects(postJson("http://fixture/api/capture", {}), /Capture pending/);
    } finally { globalThis.fetch = original; }
  });
  await t.test("a production build does not enable reset merely because APP_ENV is local", () => {
    const original = { node: process.env.NODE_ENV, app: process.env.APP_ENV, demo: process.env.DEMO_SEED_ENABLED };
    try {
      Object.assign(process.env, { NODE_ENV: "production", APP_ENV: "local" }); delete process.env.DEMO_SEED_ENABLED;
      assert.equal(demoEnabled(), false);
      process.env.DEMO_SEED_ENABLED = "true"; assert.equal(demoEnabled(), true);
      process.env.DEMO_SEED_ENABLED = "false"; assert.equal(demoEnabled(), false);
    } finally {
      for (const [name, value] of [["NODE_ENV", original.node], ["APP_ENV", original.app], ["DEMO_SEED_ENABLED", original.demo]]) {
        if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
      }
    }
  });
});
