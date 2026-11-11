import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Decision } from "../lib/types";
import type { Gateway } from "../lib/checkout";
import type { PayPalOrder } from "../lib/paypal";

test("Shop final PayPal confirmation reuses the assessment without a second review", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rp-shop-pay-"));
  process.env.STORE_PATH = path.join(dir, "store.json");
  process.env.DEMO_TODAY = "2026-11-10";
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { ensurePersona, update, load } = await import("../lib/store");
  const { inputHash, personaWithState } = await import("../lib/state");
  const { buildOptions } = await import("../lib/engine/options");
  const { getProduct } = await import("../lib/catalog");
  const { createCheckout } = await import("../lib/checkout");
  const { captureShopCheckout } = await import("../lib/shopCheckout");
  let sequence = 0;
  async function fixture(status = "APPROVED") {
    const owner = `shop-${++sequence}:alex`, id = `PAYPAL-${sequence}`;
    ensurePersona(owner);
    const { persona, payments } = personaWithState(owner);
    const built = buildOptions(persona, persona.goals, payments, getProduct("aero-14")!);
    const decision: Decision = { id:`decision-${sequence}`, personaId:owner, productId:"aero-14", createdAt:new Date().toISOString(), inputHash:inputHash(owner), schemaVersion:"rp-v1", origin:"shop", currency:"USD", baseline:built.options.find(o=>o.method==="wait")!.forecast, options:built.options, recommendedMethod:built.recommended };
    update(s => { s.decisions[decision.id] = decision; });
    let captures = 0;
    const remote = (captured = false): PayPalOrder => ({ id, status:captured?"COMPLETED":status, purchase_units:[{ custom_id:`${decision.id}:full`, amount:{value:"900.00",currency_code:"USD"}, ...(captured?{payments:{captures:[{id:`CAP-${id}`,status:"COMPLETED",amount:{value:"900.00",currency_code:"USD"}}]}}:{}) }] });
    const api: Gateway = { configured:()=>true, create:async opts=>{assert.equal(opts.experience?.userAction,"PAY_NOW");return remote();}, get:async()=>remote(captures>0), capture:async()=>{captures++;return remote(true);} };
    const order = await createCheckout(owner, decision.id, "full", api);
    return { owner, order, decision, api, captures:()=>captures };
  }
  await t.test("approved Shop order captures and updates exactly once", async()=>{
    const f = await fixture();
    assert.equal(f.captures(),0);
    const first = await captureShopCheckout(f.owner,f.order.orderId,f.decision.inputHash,f.api);
    assert.equal(first.status,"CAPTURED");
    const snapshot = load().orders[f.order.orderId].snapshotId;
    assert.equal((await captureShopCheckout(f.owner,f.order.orderId,f.decision.inputHash,f.api)).duplicate,true);
    assert.equal(f.captures(),1);assert.equal(load().orders[f.order.orderId].snapshotId,snapshot);
  });
  await t.test("changed finances pause payment", async()=>{
    const f = await fixture();update(s=>{s.personas[f.owner].goals[0].targetAmount+=100;});
    await assert.rejects(captureShopCheckout(f.owner,f.order.orderId,f.decision.inputHash,f.api),/changed/);assert.equal(f.captures(),0);
  });
  await t.test("expired or untrusted assessment cannot skip review", async()=>{
    const f = await fixture();update(s=>{s.decisions[f.decision.id].createdAt="2020-01-01";});
    await assert.rejects(captureShopCheckout(f.owner,f.order.orderId,f.decision.inputHash,f.api),/changed/);assert.equal(f.captures(),0);
  });
  await t.test("buyer cancellation or missing approval cannot capture", async()=>{
    const f = await fixture("CREATED");
    await assert.rejects(captureShopCheckout(f.owner,f.order.orderId,f.decision.inputHash,f.api),/Approve it in PayPal/);assert.equal(f.captures(),0);
  });
  await t.test("legacy Continue orders do not authorize direct capture", async()=>{
    const f = await fixture();update(s=>{delete s.orders[f.order.orderId].shopPayNow;});
    await assert.rejects(captureShopCheckout(f.owner,f.order.orderId,f.decision.inputHash,f.api),/explicit confirmation/);assert.equal(f.captures(),0);
  });
  await t.test("merchant orders still require their separate impact confirmation", async()=>{
    const f = await fixture();update(s=>{s.orders[f.order.orderId].merchant={id:"northstar-demo",name:"Northstar",checkoutId:"fixture"} as typeof f.order.merchant;});
    await assert.rejects(captureShopCheckout(f.owner,f.order.orderId,f.decision.inputHash,f.api),/Merchant checkout requires/);assert.equal(f.captures(),0);
  });
});
