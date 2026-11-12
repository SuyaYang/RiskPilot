import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { buildOptions, schedule } from "../lib/engine/options";
import { forecast, monthlySurplus } from "../lib/engine/forecast";
import { getProduct } from "../lib/catalog";
import type { Decision, Payment } from "../lib/types";
import type { PayPalOrder } from "../lib/paypal";
Object.assign(globalThis,{AsyncLocalStorage});
process.env.DEMO_TODAY="2026-11-10";

test("Step 8.6 income guard and shared economic goal projections", async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"rp-step86-"));
  process.env.STORE_PATH=path.join(dir,"store.json");process.env.DEMO_SEED_ENABLED="true";
  delete process.env.PAYPAL_CLIENT_ID;delete process.env.PAYPAL_CLIENT_SECRET;delete process.env.GEMINI_API_KEY;
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const {ensurePersona,load,update}=await import("../lib/store");
  const {snapshot,personaWithState,inputHash}=await import("../lib/state");
  const {moneyPlanView,updatePlanningIncome}=await import("../lib/planning/incomeService");
  const {planningBudgetView,updatePlanningBudget}=await import("../lib/planning/service");
  const {previewBudget}=await import("../lib/planning/preview");
  const {createCheckout,captureCheckout}=await import("../lib/checkout");
  const {recordCapture}=await import("../lib/purchases");
  const {orderReview}=await import("../lib/orderReview");
  const fresh=()=>{const id=`${crypto.randomUUID()}:alex`;ensurePersona(id);return id;};
  const command=(owner:string,action:string,rest:Record<string,unknown>)=>{const v=moneyPlanView(owner);return updatePlanningIncome(owner,{action,version:v.version,epoch:v.epoch,basisHash:v.basisHash,...rest});};
  const values={name:"Paycheck",amountCents:150000,currency:"USD",frequency:"biweekly",nextDate:"2026-11-19",sourceType:"user_entered",reliability:"expected"};
  function replacement(owner:string,patch:Record<string,unknown>={}){const old=new Set(moneyPlanView(owner).entries.map(e=>e.id));const created=command(owner,"create",{...values,...patch});const id=created.plan.entries.find(e=>!old.has(e.id))!.id;const result=command(owner,"confirm",{id,forecastUse:"replace",modeledItemId:"a-pay"});return {id,result};}
  const summary=(owner:string)=>{const s=snapshot(owner),p=personaWithState(owner).persona,m=forecast(p,[],schedule("pay_monthly",249).payments);return {min:s.forecast.minBalance,stress:s.forecast.stressMinBalance,surplus:monthlySurplus(p),capacity:s.investable.investable,trip:s.allocation.goals.find(g=>g.goalId==="a-trip")!.eta,monthlyMin:m.minBalance,monthlyStress:m.stressMinBalance,monthlyRisk:m.risk};};
  for(const [label,patch] of [["seven days later",{nextDate:"2026-11-26"}],["seven days earlier",{nextDate:"2026-11-12"}],["distinct name shifted",{name:"Changed salary",nextDate:"2026-11-26"}],["monthly",{frequency:"monthly",amountCents:325000}],["once",{frequency:"once"}],["quarterly",{frequency:"quarterly"}]] as const)await t.test(`unsupported replacement: ${label} retains authoritative salary and hash`,()=>{
    process.env.DEMO_TODAY="2026-11-10";const owner=fresh(),before=snapshot(owner),baseline=summary(owner);const {result}=replacement(owner,patch);
    console.log("INCOME",label,JSON.stringify({before:baseline,after:summary(owner),status:result.plan.entries[0].forecastIntegration.status}));
    assert.equal(result.plan.entries[0].forecastIntegration.status,"needs_review");assert.match(result.plan.entries[0].forecastIntegration.reason,/original.*income.*remain/i);
    assert.equal(result.forecastChanged,false);assert.deepEqual(snapshot(owner),before);assert.equal(result.plan.modeledIncome[0].forecastReplaced,false);assert.equal(result.plan.integration.planning,undefined);assert.ok(result.plan.events.filter(e=>e.kind==="planning").every(e=>!e.included));
    assert.deepEqual(summary(owner),baseline);assert.equal(summary(owner).monthlyRisk,"green");
  });
  for(const amountCents of [150000,100000,300000])await t.test(`supported amount ${amountCents} keeps cadence, caps established income and spans installment horizon`,()=>{
    const owner=fresh(),before=summary(owner),{result}=replacement(owner,{amountCents});assert.equal(result.plan.entries[0].forecastIntegration.status,"included");const after=summary(owner);
    assert.equal(snapshot(owner).forecast.dailyBalances.length,45);assert.equal(forecast(personaWithState(owner).persona,[],schedule("pay_monthly",249).payments).evaluatedThrough,"2027-11-05");
    if(amountCents===150000)assert.deepEqual(after,before);
    if(amountCents===300000){assert.equal(after.stress,before.stress);assert.equal(after.surplus,before.surplus);assert.ok(after.capacity<=before.capacity);}
    if(amountCents===100000){assert.equal(after.surplus,-441.33);assert.ok(after.stress<before.stress);assert.equal(after.capacity,0);}
  });
  await t.test("supported edits retain confirmed assumptions until confirmation; unsupported confirmation withdraws them and changes hash",()=>{
    const owner=fresh(),baseline=snapshot(owner),{id}=replacement(owner,{amountCents:100000}),active=snapshot(owner);
    command(owner,"edit",{id,...values,nextDate:"2026-11-26"});assert.deepEqual(snapshot(owner),active);
    const changed=command(owner,"confirm",{id});assert.equal(changed.forecastChanged,true);assert.equal(changed.plan.entries[0].forecastIntegration.status,"needs_review");assert.deepEqual(snapshot(owner),baseline);
    command(owner,"edit",{id,...values,amountCents:100000});command(owner,"confirm",{id});assert.deepEqual(snapshot(owner),active);
    command(owner,"pause",{id});assert.deepEqual(snapshot(owner),baseline);command(owner,"confirm",{id});assert.deepEqual(snapshot(owner),active);command(owner,"remove",{id});assert.deepEqual(snapshot(owner),baseline);
  });
  await t.test("duplicate replacements remain unresolved; additional calendar income remains independently supported",()=>{
    const owner=fresh(),base=snapshot(owner);replacement(owner);replacement(owner,{name:"Second salary mapping"});assert.deepEqual(snapshot(owner),base);assert.ok(moneyPlanView(owner).entries.every(e=>e.forecastIntegration.status==="needs_review"));
    const other=fresh(),before=snapshot(other),created=command(other,"create",{...values,name:"Distinct allowance",amountCents:12345,frequency:"quarterly",nextDate:"2026-11-30"}),id=created.plan.entries[0].id;
    assert.deepEqual(snapshot(other),before);command(other,"confirm",{id,forecastUse:"additional"});const after=snapshot(other);assert.equal(moneyPlanView(other).entries[0].forecastIntegration.status,"included");assert.equal(after.forecast.stressMinBalance,before.forecast.stressMinBalance);assert.equal(after.allocation.monthlySurplus,before.allocation.monthlySurplus);assert.ok(after.investable.investable<=before.investable.investable);assert.deepEqual(snapshot(owner),base);
  });
  function budget(owner:string,cents=3000,categoryId="shopping"){
    const b=planningBudgetView(owner);return updatePlanningBudget(owner,{action:"apply",categoryId,monthlyCents:cents,version:b.version,epoch:b.epoch,basisHash:b.basisHash,financialInputHash:inputHash(owner)});
  }
  async function economicPair(owner:string,price:number){
    const {persona:p,payments}=personaWithState(owner),before=snapshot(owner),old=load();
    const product=getProduct(price===249?"quiet-buds":"aero-14")??{id:"fixture",name:"Fixture purchase",price,description:"Fixture"};
    const built=buildOptions(p,p.goals,payments,{...product,price});const scenario=built.options.find(o=>o.method==="full")!;
    const id=`SAFE-${crypto.randomUUID()}`,d:Decision={id:`decision-${id}`,personaId:owner,productId:"aero-14",createdAt:new Date().toISOString(),inputHash:inputHash(owner),schemaVersion:"rp-v1",origin:"merchant_review",currency:"USD",baseline:before.forecast,options:built.options,recommendedMethod:built.recommended};
    assert.deepEqual(load(),old,"Exploration cannot mutate authoritative state");
    update(data=>{data.decisions[d.id]=d;data.orders[id]={orderId:id,personaId:owner,decisionId:d.id,productId:product.id,productName:product.name,method:"full",amount:price,currency:"USD",status:"CREATED",createdAt:d.createdAt,captureRequestId:id,shopPayNow:false,simulated:true};});
    const reviewed=orderReview(load().orders[id]);assert.deepEqual(reviewed.decision.options.find(o=>o.method==="full")!.goalPlan,scenario.goalPlan);
    recordCapture(id,`CAP-${id}`,price);const after=snapshot(owner);
    console.log("GOAL_PAIR",JSON.stringify({price,before:before.allocation,scenario:scenario.goalPlan,after:after.allocation}));
    assert.deepEqual(after.allocation,scenario.goalPlan,"Hypothetical and recorded economic states must agree");assert.deepEqual(after.forecast,scenario.forecast);
    assert.equal(after.purchases.length,before.purchases.length+1);assert.equal(after.persona.checkingBalance,before.persona.checkingBalance);assert.equal(after.forecast.startBalance,before.forecast.startBalance-price);
    if(price===249 && before.purchases.length===0)assert.ok(scenario.forecast.bufferGap>=0);
    assert.equal(recordCapture(id,`CAP-${id}`,price).duplicate,true);assert.deepEqual(snapshot(owner),after);
    const comparison=load().snapshots[`capture:CAP-${id}`];assert.deepEqual(comparison.data.allocation,scenario.goalPlan);assert.deepEqual(comparison.before!.allocation,before.allocation);
    return {before,scenario,after,id};
  }
  for(const price of [249,900])await t.test(`immediate ${price} purchase has equivalent hypothetical and recorded goals and cash`,async()=>{
    process.env.DEMO_TODAY="2026-11-12";await economicPair(fresh(),price);
  });
  await t.test("independent pre-existing deficit remains protected without duplicating a purchase cost",async()=>{
    const owner=fresh();update(data=>{data.personas[owner].purchases.push({id:"PRIOR",orderId:"PRIOR",productName:"Prior",amount:1200,method:"full",payments:[{date:"2026-11-11",amount:1200,label:"Prior reserve"}],capturedAt:"2026-11-11T12:00:00Z",fundingStatus:"UNCONFIRMED",simulated:true});});
    const pair=await economicPair(owner,900);assert.equal(pair.before.investable.investable,0);assert.ok(pair.after.forecast.bufferGap<pair.before.forecast.bufferGap);assert.equal(pair.after.investable.investable,0);assert.ok(pair.after.allocation.goals.reduce((s,g)=>s+g.allocatedThisMonth,0)<=pair.before.allocation.monthlySurplus);
  });
  await t.test("applied shopping budget retains goal equivalence before and after purchase",async()=>{const owner=fresh();budget(owner);await economicPair(owner,900);});
  for(const nextDate of ["2026-11-21","2026-11-28"])await t.test(`goal equivalence after ${nextDate} income mapping`,async()=>{const owner=fresh();const {result}=replacement(owner,{nextDate});assert.equal(result.plan.entries[0].forecastIntegration.status,nextDate==="2026-11-21"?"included":"needs_review");await economicPair(owner,900);});
  await t.test("actual mock-provider capture, recovery and Dashboard/Goals APIs match the assessed economic state",async()=>{
    const owner=fresh(),{persona:p,payments}=personaWithState(owner),before=snapshot(owner),built=buildOptions(p,p.goals,payments,getProduct("aero-14")!),scenario=built.options.find(o=>o.method==="full")!;
    const id=`MOCK-${crypto.randomUUID()}`,d:Decision={id:`D-${id}`,personaId:owner,productId:"aero-14",createdAt:new Date().toISOString(),inputHash:inputHash(owner),schemaVersion:"rp-v1",origin:"shop",currency:"USD",baseline:before.forecast,options:built.options,recommendedMethod:built.recommended};
    update(data=>{data.decisions[d.id]=d;});let captures=0;
    const remote:PayPalOrder={id,status:"APPROVED",purchase_units:[{custom_id:`${d.id}:full`,amount:{value:"900.00",currency_code:"USD"}}]};
    const api={configured:()=>true,create:async()=>structuredClone(remote),get:async()=>structuredClone(remote),capture:async()=>{captures++;remote.status="COMPLETED";remote.purchase_units![0].payments={captures:[{id:`CAP-${id}`,status:"COMPLETED",amount:{value:"900.00",currency_code:"USD"}}]};return structuredClone(remote);}};
    await createCheckout(owner,d.id,"full",api);assert.deepEqual(snapshot(owner),before,"Unpaid/cancelled order has no economic effect");
    assert.equal((await captureCheckout(owner,id,api,d.inputHash)).status,"CAPTURED");const after=snapshot(owner);
    assert.deepEqual(after.forecast,scenario.forecast);assert.deepEqual(after.allocation,scenario.goalPlan);
    assert.equal((await captureCheckout(owner,id,api,d.inputHash)).duplicate,true);assert.equal(captures,1);assert.deepEqual(snapshot(owner),after);
    const {workAsyncStorage}=await import("next/dist/server/app-render/work-async-storage.external");
    const {workUnitAsyncStorage}=await import("next/dist/server/app-render/work-unit-async-storage.external");
    const {RequestCookies}=await import("next/dist/compiled/@edge-runtime/cookies");
    const dashboard=await import("../app/api/dashboard/route"),goals=await import("../app/api/goals/route"),order=await import("../app/api/orders/[id]/route");
    const within=<T>(fn:()=>Promise<T>)=>workAsyncStorage.run({route:"/step86",isStaticGeneration:false} as never,()=>workUnitAsyncStorage.run({type:"request",phase:"render",cookies:new RequestCookies(new Headers({cookie:`rp_workspace=${owner.split(":")[0]}; rp_account=alex`}))} as never,fn));
    const dash=await within(()=>dashboard.GET()).then(r=>r.json()),goal=await within(()=>goals.GET()).then(r=>r.json());
    assert.deepEqual(dash.allocation,scenario.goalPlan);assert.deepEqual(goal.allocation,scenario.goalPlan);assert.equal(dash.financialInputHash,goal.financialInputHash);
    for(let n=0;n<2;n++){const receipt=await within(()=>order.GET(new Request("http://localhost:3000"),{params:Promise.resolve({id})})).then(r=>r.json());assert.deepEqual(receipt.forecastSnapshot.data.allocation,scenario.goalPlan);}
    assert.deepEqual(snapshot(owner),after);assert.equal(after.purchases.length,1);assert.equal(captures,1);
    assert.equal(after.allocation.goals.find(g=>g.goalId==="a-trip")!.allocatedThisMonth,250);assert.equal(after.allocation.goals.find(g=>g.goalId==="a-emergency")!.allocatedThisMonth,200);assert.equal(after.allocation.goals.find(g=>g.goalId==="a-invest")!.allocatedThisMonth,12);
    assert.equal(after.allocation.goals.reduce((sum,g)=>sum+g.allocatedThisMonth,0),462);
  });
  for(const [date,category,cents,expected] of [["2026-11-10","food-and-dining",15000,[1765,1620,170]],["2026-11-12","shopping",3000,[1738,1572,122]]] as const)await t.test(`unchanged verified financial reference ${category}`,()=>{
    process.env.DEMO_TODAY=date;const owner=fresh(),before=snapshot(owner),b=planningBudgetView(owner),stored=load();assert.deepEqual([before.forecast.minBalance,before.forecast.stressMinBalance,before.investable.investable],[1720,1540,90]);
    const preview=previewBudget(owner,{categoryId:category,monthlyCents:cents,version:b.version,epoch:b.epoch,basisHash:b.basisHash,financialInputHash:inputHash(owner)});assert.deepEqual(load(),stored);
    updatePlanningBudget(owner,{action:"apply",...preview.confirmation});const after=snapshot(owner);assert.deepEqual([after.forecast.minBalance,after.forecast.stressMinBalance,after.investable.investable],expected);assert.equal(after.persona.checkingBalance,3500);assert.equal(after.purchases.length,0);assert.notEqual(after.financialInputHash,before.financialInputHash);
    assert.deepEqual([preview.forecast.scenario.minBalanceCents,preview.forecast.scenario.stressMinBalanceCents,preview.forecast.scenario.availableToAllocateCents],expected.map(x=>x*100));
    const applied=planningBudgetView(owner);updatePlanningBudget(owner,{action:"restore_baseline",categoryId:category,version:applied.version,epoch:applied.epoch,basisHash:applied.basisHash,financialInputHash:inputHash(owner)});assert.deepEqual(snapshot(owner),before);
  });
  await t.test("skip, future-date, cancellation and educational installments do not persist modeled payments",()=>{
    const owner=fresh(),{persona:p,payments}=personaWithState(owner),stored=load(),before=snapshot(owner),result=buildOptions(p,p.goals,payments,getProduct("aero-14")!);
    assert.deepEqual(result.options.find(o=>o.method==="wait")!.goalPlan,before.allocation);assert.ok(result.afterIncome.available);assert.deepEqual(load(),stored);assert.deepEqual(snapshot(owner),before);
    assert.equal(load().personas[owner].purchases.length,0);assert.ok(result.options.filter(o=>o.hypothetical).every(o=>o.payments.length>1));
  });
  await t.test("grounded fallback explains unsupported replacement and current goal facts without financial mutation",async()=>{
    process.env.DEMO_TODAY="2026-11-10";const owner=fresh();replacement(owner,{nextDate:"2026-11-26"});const before=snapshot(owner);
    const {explainMoneyPlan}=await import("../lib/planning/insights");const result=await explainMoneyPlan(owner,{topic:"income",insightBasis:moneyPlanView(owner).insightBasis});
    assert.equal(result.source,"template");assert.match(result.text,/original income remains/);assert.match(result.text,/planning only/);assert.deepEqual(snapshot(owner),before);
    const {reviewFacts}=await import("../lib/reviewInsights");const {persona:p,payments}=personaWithState(owner),options=buildOptions(p,p.goals,payments,getProduct("aero-14")!);
    const facts=reviewFacts({decision:{id:"facts",personaId:owner,productId:"aero-14",createdAt:new Date().toISOString(),inputHash:inputHash(owner),schemaVersion:"rp-v1",baseline:before.forecast,options:options.options,recommendedMethod:options.recommended},buffer:1000,inputChanged:false,recheck:{status:"unavailable",reason:"fixture",currentAmountCents:90000,comparison:"full_price",checks:[]},context:{asOf:"2026-11-10",personaName:"Alex",source:"fictional-manual-demo",upcoming:[]}},"full","goals");
    assert.match(facts.facts.goals,/no additional goal delay/);assert.deepEqual(snapshot(owner),before);
    process.env.DEMO_TODAY="2026-11-12";
  });
  await t.test("later budget/income/goal changes recompute authoritative projections without cached scenario dates",async()=>{
    const owner=fresh();await economicPair(owner,900);const captured=snapshot(owner),hash=captured.financialInputHash;
    budget(owner,3000);assert.notEqual(inputHash(owner),hash);const planned=snapshot(owner);assert.notDeepEqual(planned.allocation,captured.allocation);
    replacement(owner,{nextDate:"2026-11-21",amountCents:100000});assert.notDeepEqual(snapshot(owner).allocation,planned.allocation);
    const prev=snapshot(owner);update(data=>{data.personas[owner].goals[0].targetAmount+=1000;});assert.notDeepEqual(snapshot(owner).allocation,prev.allocation);
  });
});
