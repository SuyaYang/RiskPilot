import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { Decision } from "../lib/types";

 test("Financial Profile facts, AI contract, preferences and purchase integration", async t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"rp-profile-"));
  process.env.STORE_PATH=path.join(dir,"store.json");process.env.DEMO_TODAY="2026-11-10";process.env.DEMO_SEED_ENABLED="true";
  delete process.env.GEMINI_API_KEY;delete process.env.PAYPAL_CLIENT_ID;delete process.env.PAYPAL_CLIENT_SECRET;
  const {ensurePersona,load,update,reset}=await import("../lib/store");
  const {snapshot,inputHash,personaWithState}=await import("../lib/state");
  const {spendingView,updateRecurring}=await import("../lib/spending/service");
  const {extractProfileFeatures,profileBasis}=await import("../lib/financialProfile/features");
  const {financialProfileView,generateFinancialProfile,editFinancialProfile}=await import("../lib/financialProfile/service");
  const {personalizedPurchaseFacts,explainProfilePurchase}=await import("../lib/financialProfile/purchase");
  const {explainFinancialProfile}=await import("../lib/ai");
  const {buildOptions}=await import("../lib/engine/options");const {getProduct}=await import("../lib/catalog");
  const {formatCents}=await import("../lib/spending/money");
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;delete process.env.GEMINI_API_KEY;fs.rmSync(dir,{recursive:true,force:true});});
  function fresh(persona="alex"){const owner=`${crypto.randomUUID()}:${persona}`;ensurePersona(owner);return owner;}
  function body(owner:string){const view=financialProfileView(owner);return {version:view.version,basisHash:view.basisHash};}
  function preferences(owner:string,extra={}){return editFinancialProfile(owner,{...body(owner),action:"confirm_preferences",planningBufferCents:200000,priorityGoalId:null,focus:"cash_buffer",...extra});}
  function assess(owner:string){const {persona,payments}=personaWithState(owner),result=buildOptions(persona,persona.goals,payments,getProduct("aero-14")!,getProduct("aero-13"));const decision:Decision={id:crypto.randomUUID(),personaId:owner,productId:"aero-14",createdAt:new Date().toISOString(),schemaVersion:"rp-v1",inputHash:inputHash(owner),baseline:result.options.find(o=>o.method==="wait")!.forecast,options:result.options,afterIncome:result.afterIncome,recommendedMethod:result.recommended};update(data=>{data.decisions[decision.id]=decision;});return decision;}
  const respond=(value:unknown)=>{globalThis.fetch=async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify(value)}]}}]});};

  await t.test("missing and insufficient history never produce a behavior pattern",()=>{
    const owner=fresh(),financial=snapshot(owner),spending=spendingView(owner);
    const missing=extractProfileFeatures(financial,null);
    assert.equal(missing.averageMonthlyCents,null);assert.equal(missing.fallback.summaryId,"summary_history");assert.ok(missing.facts.history_limit);assert.equal(missing.facts.variability,undefined);
    const partial=structuredClone(spending);partial.analysis.months=partial.analysis.months.slice(0,1);
    const short=extractProfileFeatures(financial,partial);assert.equal(short.fullMonthCount,1);assert.equal(short.facts.variability,undefined);assert.equal(short.summaries.summary_spending,undefined);
    const complete=extractProfileFeatures(financial,spending);
    assert.equal(complete.fullMonthCount,3);assert.equal(complete.averageMonthlyCents,227128);
    assert.match(complete.facts.categories.text,/\$1,728\.00/);assert.match(complete.facts.variability.text,/\$2,263\.08.*\$2,276\.78/);
    assert.equal(complete.facts.recurring.kind,"user_confirmed");assert.match(complete.facts.data_scope.text,/fictional/);
  });
  await t.test("missing Gemini configuration generates a useful fallback without a network call or financial mutation",async()=>{
    const owner=fresh(),before=snapshot(owner),hash=inputHash(owner);let calls=0;
    globalThis.fetch=async()=>{calls++;throw new Error("Must not call without a key");};
    const result=await generateFinancialProfile(owner,body(owner));
    assert.equal(result.status,"ready");assert.equal(result.profile?.source,"template");assert.ok(result.profile!.insights.length<=2);assert.equal(calls,0);
    assert.deepEqual(snapshot(owner),before);assert.equal(inputHash(owner),hash);
    const saved=load().personas[owner].financialProfile!;
    assert.equal(Object.hasOwn(saved.generated!,"text"),false);assert.equal(Object.hasOwn(saved.generated!,"facts"),false);
    globalThis.fetch=originalFetch;
  });
  await t.test("Gemini selects only safe fact IDs and receives no raw transactions, account IDs or workspace IDs",async()=>{
    const owner=fresh(),features=profileBasis(owner).features;let sent="";process.env.GEMINI_API_KEY="fixture-only";
    globalThis.fetch=async(_url,init)=>{sent=String(init?.body);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(features.fallback)}]}}]});};
    const result=await explainFinancialProfile(features);assert.equal(result.source,"ai");
    assert.doesNotMatch(sent,/accountId|ownerId|originalTransactionId|captureId/);assert.equal(sent.includes(owner),false);assert.equal(sent.includes("food-0"),false);
    assert.ok(sent.includes("Complete-month category averages"));
    delete process.env.GEMINI_API_KEY;globalThis.fetch=originalFetch;
  });
  await t.test("invalid output, conflicting numbers, arbitrary scores and hidden critical constraints fall back",async()=>{
    const owner=fresh("jordan"),features=profileBasis(owner).features;process.env.GEMINI_API_KEY="fixture-only";
    for(const value of [{...features.fallback,text:"Your real bank balance is $999999."},{...features.fallback,riskScore:98},{...features.fallback,insightIds:["execute_payment"]},{...features.fallback,summaryId:"summary_spending"},{...features.fallback,insightIds:["goals","goals"]}]){
      respond(value);const result=await explainFinancialProfile(features);assert.equal(result.source,"template");assert.equal(result.summaryId,"summary_capacity");
    }
    globalThis.fetch=async()=>new Response("down",{status:503});assert.equal((await explainFinancialProfile(features)).source,"template");
    globalThis.fetch=async()=>{throw new DOMException("timed out","TimeoutError");};assert.equal((await explainFinancialProfile(features)).source,"template");
    delete process.env.GEMINI_API_KEY;globalThis.fetch=originalFetch;
  });
  await t.test("a profile must use available history and respect a confirmed focus rather than repeat generic dashboard facts",async()=>{
    const owner=fresh();preferences(owner,{focus:"goals",priorityGoalId:"a-emergency"});const features=profileBasis(owner).features;process.env.GEMINI_API_KEY="fixture-only";
    respond({summaryId:"summary_plan",insightIds:["goals","buffer"],actionId:"review_goals"});
    assert.equal((await explainFinancialProfile(features)).source,"template");assert.equal(features.requiredInsightId,"focus");assert.ok(features.fallback.insightIds.includes("focus"));
    respond(features.fallback);assert.equal((await explainFinancialProfile(features)).source,"ai");
    delete process.env.GEMINI_API_KEY;globalThis.fetch=originalFetch;
  });
  await t.test("confirmed preferences are explicit, cent-precise and separate from engine constraints",()=>{
    const owner=fresh(),before=snapshot(owner),hash=inputHash(owner);
    const view=preferences(owner,{priorityGoalId:"a-trip",focus:"goals"});
    assert.equal(view.preferences?.planningBufferCents,200000);assert.equal(view.engineBufferCents,100000);assert.equal(view.preferences?.priorityGoalId,"a-trip");
    assert.deepEqual(snapshot(owner),before);assert.equal(inputHash(owner),hash);assert.equal(load().personas[owner].goals[0].priority,before.goals[0].priority);
    assert.match(view.evidence.preference.text,/engine still uses.*\$1,000\.00/);
    assert.throws(()=>preferences(owner,{planningBufferCents:1.1}),/valid planning buffer/);
    assert.throws(()=>preferences(owner,{priorityGoalId:"s-wedding"}),/valid planning buffer/);
    assert.throws(()=>editFinancialProfile(owner,{...body(owner),action:"confirm_preferences",planningBufferCents:50000,priorityGoalId:null,focus:"cash_buffer",balance:999}),/valid planning buffer/);
  });
  await t.test("dismiss, restore, regenerate and clear preferences remain scoped to the active persona",async()=>{
    const owner=fresh(),other=fresh();preferences(owner);
    let view=await generateFinancialProfile(owner,body(owner));const dismissed=view.profile!.insights[0].id;
    view=editFinancialProfile(owner,{...body(owner),action:"dismiss_insight",insightId:dismissed});
    assert.equal(view.status,"ready");assert.ok(view.profile!.insights.every(i=>i.id!==dismissed));
    view=await generateFinancialProfile(owner,body(owner));assert.ok(view.profile!.insights.every(i=>i.id!==dismissed));
    view=editFinancialProfile(owner,{...body(owner),action:"dismiss_profile"});assert.equal(view.status,"dismissed");assert.equal(view.profile,null);assert.ok(view.preferences);
    assert.equal(financialProfileView(other).status,"not_generated");assert.equal(financialProfileView(other).preferences,null);
    view=editFinancialProfile(owner,{...body(owner),action:"restore_insights"});assert.deepEqual(view.dismissedInsightIds,[]);
    view=editFinancialProfile(owner,{...body(owner),action:"clear_preferences"});assert.equal(view.preferences,null);
  });
  await t.test("a dismissed spending observation cannot reappear as a summary alias",async()=>{
    const owner=fresh();await generateFinancialProfile(owner,body(owner));
    let view=editFinancialProfile(owner,{...body(owner),action:"dismiss_insight",insightId:"spending"});
    assert.equal(view.profile,null);assert.equal(profileBasis(owner).features.summaries.summary_spending,undefined);
    view=await generateFinancialProfile(owner,body(owner));assert.equal(view.status,"ready");assert.ok(view.profile!.insights.every(i=>i.id!=="spending"));assert.doesNotMatch(view.profile!.summary,/full-month spending averages/);
  });
  await t.test("goal edits and recurring review changes mark generated profiles stale without altering saved financial snapshots",async()=>{
    const owner=fresh();await generateFinancialProfile(owner,body(owner));const staleBody=body(owner);
    update(data=>{data.personas[owner].goals[0].targetAmount+=100;});
    assert.equal(financialProfileView(owner).status,"stale");assert.equal(financialProfileView(owner).profile,null);
    await assert.rejects(generateFinancialProfile(owner,staleBody),/inputs changed/);
    await generateFinancialProfile(owner,body(owner));const beforeHash=inputHash(owner),spending=spendingView(owner);
    updateRecurring(owner,spending.candidates[0].id,{action:"confirm",version:spending.version,asOf:spending.analysis.coverage.asOf});
    assert.equal(inputHash(owner),beforeHash);assert.equal(financialProfileView(owner).status,"stale");
  });
  await t.test("financial changes while Gemini is working discard the late response",async()=>{
    const owner=fresh(),features=profileBasis(owner).features;process.env.GEMINI_API_KEY="fixture-only";
    globalThis.fetch=async()=>{update(data=>{data.personas[owner].goals[0].savedSoFar+=1;});return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(features.fallback)}]}}]});};
    await assert.rejects(generateFinancialProfile(owner,body(owner)),/inputs changed/);
    assert.equal(load().personas[owner].financialProfile,undefined);
    delete process.env.GEMINI_API_KEY;globalThis.fetch=originalFetch;
  });
  await t.test("purchase explanations use the exact engine scenario and confirmed goal impact, never a planning buffer as cash capacity",async()=>{
    const owner=fresh(),decision=assess(owner);preferences(owner,{priorityGoalId:"a-trip",focus:"goals"});
    const before=snapshot(owner),bodyNow={decisionId:decision.id,method:"full",timing:"now"};
    const result=await explainProfilePurchase(owner,bodyNow),option=decision.options.find(o=>o.method==="full")!;
    assert.equal(result.personalized,true);assert.equal(result.readOnly,true);
    assert.ok(result.text.includes(formatCents(Math.round(option.forecast.minBalance*100))));assert.ok(result.text.includes(formatCents(Math.round(option.forecast.stressMinBalance*100))));
    assert.match(result.text,/Japan trip/);assert.match(result.text,/existing \$1,000\.00 buffer/);assert.equal(result.source,"template");
    assert.deepEqual(snapshot(owner),before);
    if(decision.afterIncome?.available){const later=await explainProfilePurchase(owner,{...bodyNow,timing:"after_income"});assert.ok(later.text.includes(formatCents(Math.round(decision.afterIncome.forecast.minBalance*100))));assert.match(later.alternative!,/read-only/);}
    const other=fresh();assert.throws(()=>personalizedPurchaseFacts(other,bodyNow),/not found/);
    assert.throws(()=>personalizedPurchaseFacts(owner,{...bodyNow,method:"pay_in_4",timing:"after_income"}),/unavailable/);
    update(data=>{data.personas[owner].goals[0].targetAmount+=1;});
    await assert.rejects(explainProfilePurchase(owner,bodyNow),/inputs changed/);
  });
  await t.test("unconfirmed preferences are never personalized and stale preference updates invalidate pending explanations",async()=>{
    const owner=fresh(),decision=assess(owner),request={decisionId:decision.id,method:"full"};
    assert.equal((await explainProfilePurchase(owner,request)).personalized,false);
    preferences(owner);process.env.GEMINI_API_KEY="fixture-only";
    globalThis.fetch=async()=>{preferences(owner,{planningBufferCents:300000});return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({factIds:["confirmed_context","engine_impact"]})}]}}]});};
    await assert.rejects(explainProfilePurchase(owner,request),/inputs changed/);
    delete process.env.GEMINI_API_KEY;globalThis.fetch=originalFetch;
  });
  await t.test("demo reset removes generated profiles and confirmed preferences only in the intended persona",async()=>{
    const owner=fresh(),sameWorkspace=owner.replace(":alex",":sam");ensurePersona(sameWorkspace);preferences(owner);await generateFinancialProfile(owner,body(owner));preferences(sameWorkspace);
    reset(owner);assert.equal(financialProfileView(owner).status,"not_generated");assert.equal(financialProfileView(owner).preferences,null);assert.ok(financialProfileView(sameWorkspace).preferences);
    assert.equal(financialProfileView(owner).version,0);
  });
});
