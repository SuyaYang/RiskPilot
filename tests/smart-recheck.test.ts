import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { Decision } from "../lib/types";

test("Smart Recheck validates provenance and compares freshly recomputed engine facts",async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"rp-recheck-"));
  process.env.STORE_PATH=path.join(dir,"store.json");process.env.DEMO_TODAY="2026-11-10";process.env.DEMO_SEED_ENABLED="true";
  process.env.APP_ENV="local";process.env.MERCHANT_ORIGIN="http://localhost:3200";process.env.MERCHANT_BRIDGE_SECRET="fixture-only-recheck-bridge-secret-12345";
  delete process.env.PAYPAL_CLIENT_ID;delete process.env.PAYPAL_CLIENT_SECRET;delete process.env.GEMINI_API_KEY;
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const {ensurePersona,load,update,reset}=await import("../lib/store");
  const {personaWithState,inputHash,snapshot}=await import("../lib/state");
  const {buildOptions}=await import("../lib/engine/options");const {getProduct}=await import("../lib/catalog");
  const {createCheckout}=await import("../lib/checkout");const {orderReview}=await import("../lib/orderReview");
  const {smartRecheck}=await import("../lib/smartRecheck");const {createPurchaseIntent}=await import("../lib/purchaseIntent");
  const {readPurchaseIntent,readMerchantTicket,signEnvelope}=await import("../lib/merchantBridge");
  async function fixture(method:"full"|"cheaper"="full") {
    const owner=`${crypto.randomUUID()}:alex`;ensurePersona(owner);
    const {persona,payments}=personaWithState(owner),built=buildOptions(persona,persona.goals,payments,getProduct("aero-14")!,getProduct("aero-13"));
    const decision:Decision={id:crypto.randomUUID(),personaId:owner,productId:"aero-14",createdAt:new Date().toISOString(),inputHash:inputHash(owner),schemaVersion:"rp-v1",origin:"shop",currency:"USD",baseline:built.options.find(o=>o.method==="wait")!.forecast,options:built.options,afterIncome:built.afterIncome,recommendedMethod:built.recommended};
    update(d=>{d.decisions[decision.id]=decision;});
    const order=await createCheckout(owner,decision.id,method);
    return {owner,decision,order};
  }
  await t.test("unchanged checkout reuses a verified assessment while preserving all full-review data",async()=>{
    const {owner,decision,order}=await fixture(),before=snapshot(owner),persisted=structuredClone(load().decisions[decision.id]);
    const review=orderReview(order);
    assert.equal(review.recheck.status,"unchanged");assert.ok(review.recheck.checks.every(check=>!check.changed));
    assert.equal(review.recheck.comparison,"full_price");assert.equal(review.recheck.previousAmountCents,90000);
    assert.ok(review.decision.options.length>=4);assert.ok(review.decision.options[0].forecast.dailyBalances.length>0);
    assert.deepEqual(snapshot(owner),before);assert.deepEqual(load().decisions[decision.id],persisted);
    assert.equal(load().orders[order.orderId].status,"CREATED");
  });
  await t.test("supported lower-cost checkout matches its explicit catalog association",async()=>{
    const {order}=await fixture("cheaper"),r=orderReview(order);
    assert.equal(order.productId,"aero-13");assert.equal(r.recheck.status,"unchanged");assert.equal(r.recheck.previousAmountCents,60000);
  });
  await t.test("changed financial inputs recompute forecasts and invalidate the old conclusion",async()=>{
    const {owner,order}=await fixture();
    update(d=>{d.personas[owner].goals[0].targetAmount+=1500;});
    const review=orderReview(order);
    assert.equal(review.recheck.status,"changed");assert.equal(review.recheck.checks.find(c=>c.id==="inputs")?.changed,true);
    assert.equal(review.decision.inputHash,inputHash(owner));assert.equal(load().personas[owner].purchases.length,0);
  });
  await t.test("changed authoritative amount is compared explicitly, never taken from browser input",async()=>{
    const {order}=await fixture();const review=orderReview({...order,amount:1000});
    assert.equal(review.recheck.status,"changed");assert.equal(review.recheck.currentAmountCents,100000);
    assert.equal(review.recheck.checks.find(c=>c.id==="amount")?.changed,true);
    assert.match(review.recheck.checks.find(c=>c.id==="amount")!.detail,/900.*1,000/);
  });
  await t.test("no name-only match, foreign owner, wrong currency, old policy or unverifiable time",async()=>{
    const {decision,order}=await fixture(),review=orderReview(order),data=load();
    for(const change of [{origin:undefined},{inputHash:"unverified"},{currency:undefined},{currency:"EUR"},{schemaVersion:"old"},{createdAt:new Date(Date.now()-31*60_000).toISOString()},{createdAt:"invalid"},{createdAt:new Date(Date.now()+60_000).toISOString()},{personaId:`${crypto.randomUUID()}:alex`},{productId:"same-name-different-product"}]) {
      const copy=structuredClone(data);Object.assign(copy.decisions[decision.id],change);
      assert.equal(smartRecheck(order,review.decision,review.buffer,copy).status,"unavailable",JSON.stringify(change));
    }
    assert.equal(smartRecheck({...order,status:"UNKNOWN"},review.decision,review.buffer,data).status,"unavailable");
    assert.equal(smartRecheck({...order,captureCommand:"STARTED"},review.decision,review.buffer,data).status,"unavailable");
    const copy=structuredClone(data);delete copy.decisions[decision.id];assert.equal(smartRecheck(order,review.decision,review.buffer,copy).status,"unavailable");
    assert.equal(smartRecheck({...order,currency:"EUR" as "USD"},review.decision,review.buffer,data).status,"unavailable");
  });
  await t.test("purchase intent is purpose-bound, scoped, expiring metadata and makes no payment",async()=>{
    const {owner,decision}=await fixture();const before=load(),financial=snapshot(owner);
    const result=createPurchaseIntent(owner,decision.id),token=new URL(result.url).searchParams.get("riskpilot_intent")!,ref=readPurchaseIntent(token);
    assert.equal(result.createsPayment,false);assert.deepEqual(load().orders,before.orders);assert.deepEqual(snapshot(owner),financial);
    assert.equal(load().reviewIntents![ref.intentId].owner,owner);assert.equal(load().reviewIntents![ref.intentId].decisionId,decision.id);
    assert.equal(token.includes(owner),false);assert.throws(()=>readMerchantTicket(token));
    assert.throws(()=>readPurchaseIntent(signEnvelope("intent",{...ref,expiresAt:Date.now()-1})),/expired/);
    assert.throws(()=>readPurchaseIntent(signEnvelope("intent",{...ref,productId:"other"})),/invalid/);
    assert.throws(()=>createPurchaseIntent(`${crypto.randomUUID()}:alex`,decision.id),/not found/);
    reset(owner);assert.equal(Object.values(load().reviewIntents||{}).filter(i=>i.owner===owner).length,0);
  });
  await t.test("merchant recheck requires the explicit intent and rejects foreign/missing/expired bindings",async()=>{
    const {owner,decision,order}=await fixture();const result=createPurchaseIntent(owner,decision.id),ref=readPurchaseIntent(new URL(result.url).searchParams.get("riskpilot_intent")!);
    const merchantOrder={...order,productId:"northstar:aero-14",merchant:{id:"northstar-demo" as const,checkoutId:crypto.randomUUID(),name:"Northstar"},priorAssessmentId:decision.id,reviewIntentId:ref.intentId};
    const review=orderReview(merchantOrder);assert.equal(review.recheck.status,"unchanged");
    assert.equal(orderReview({...merchantOrder,reviewIntentId:undefined}).recheck.status,"unavailable");
    for(const extra of [{owner:`${crypto.randomUUID()}:alex`},{productId:"other"},{currency:"EUR"},{merchantId:"other"},{decisionId:crypto.randomUUID()},{expiresAt:Date.now()-1}]) {
      const data=load();Object.assign(data.reviewIntents![ref.intentId],extra);
      assert.equal(smartRecheck(merchantOrder,review.decision,review.buffer,data).status,"unavailable");
    }
  });
});
