import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { buildPersonas } from "../lib/personas";
import { forecast, monthlySurplus } from "../lib/engine/forecast";
import { buildOptions, schedule } from "../lib/engine/options";
import { allocateGoals, projectGoals } from "../lib/engine/goals";
import { getProduct } from "../lib/catalog";
import { iso, today } from "../lib/dates";
import { paymentStatusView } from "../lib/paymentStatus";
import type { Decision } from "../lib/types";
import type { PayPalOrder } from "../lib/paypal";
Object.assign(globalThis, { AsyncLocalStorage });
process.env.DEMO_TODAY = "2026-11-10";

test("Step 8.5 isolated financial and checkout regressions", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rp-final-remediation-"));
  process.env.STORE_PATH = path.join(dir, "store.json"); process.env.DEMO_SEED_ENABLED = "true";
  delete process.env.PAYPAL_CLIENT_ID; delete process.env.PAYPAL_CLIENT_SECRET; delete process.env.GEMINI_API_KEY;
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { ensurePersona, load, update } = await import("../lib/store");
  const { snapshot, personaWithState, inputHash } = await import("../lib/state");
  const { updatePlanningIncome, moneyPlanView } = await import("../lib/planning/incomeService");
  const { planningBudgetView, updatePlanningBudget } = await import("../lib/planning/service");
  const { previewBudget } = await import("../lib/planning/preview");
  const { createCheckout, captureCheckout } = await import("../lib/checkout");
  let seq = 0;
  const fresh = () => { const owner = `final-${++seq}:alex`; ensurePersona(owner); return owner; };
  function replace(owner: string, patch: Record<string, unknown> = {}) {
    const cmd = (action: string, values: Record<string, unknown>) => { const v = moneyPlanView(owner); return updatePlanningIncome(owner, { action, version:v.version, epoch:v.epoch, basisHash:v.basisHash, ...values }); };
    const result = cmd("create", { name:"Paycheck", amountCents:150000, currency:"USD", frequency:"biweekly", nextDate:"2026-11-19", sourceType:"user_entered", reliability:"expected", ...patch });
    const id = result.plan.entries[0].id; cmd("confirm", { id, forecastUse:"replace", modeledItemId:"a-pay" });
    return { id, cmd };
  }
  await t.test("equivalent replacement preserves normal/stress/surplus and the full 361-day installment evaluation", () => {
    const owner = fresh(), base = personaWithState(owner).persona, old = forecast(base), monthly = schedule("pay_monthly",249).payments;
    replace(owner); const p = personaWithState(owner).persona, after = forecast(p);
    console.log("INCOME_REPRO",JSON.stringify({before:{min:old.minBalance,stress:old.stressMinBalance,surplus:monthlySurplus(base),monthly:forecast(base,[],monthly)},after:{min:after.minBalance,stress:after.stressMinBalance,surplus:monthlySurplus(p),monthly:forecast(p,[],monthly)}}));
    assert.deepEqual(after.dailyBalances, old.dailyBalances);
    assert.equal(after.stressMinBalance, old.stressMinBalance);
    assert.equal(monthlySurplus(p), monthlySurplus(base));
    const extended = forecast(p,[],monthly), baseline = forecast(base,[],monthly);
    assert.equal(extended.evaluatedThrough,"2027-11-05"); assert.equal(extended.minBalance,baseline.minBalance); assert.equal(extended.stressMinBalance,baseline.stressMinBalance); assert.equal(extended.risk,"green");
    assert.equal(snapshot(owner).investable.investable,90);
  });
  await t.test("larger replacement does not inflate established stress, goal surplus or cash allocation", () => {
    const owner=fresh();replace(owner,{amountCents:300000});const p=personaWithState(owner).persona,base=buildPersonas()[0];
    assert.equal(forecast(p).stressMinBalance,forecast(base).stressMinBalance);assert.equal(monthlySurplus(p),monthlySurplus(base));assert.ok(snapshot(owner).investable.investable<=90);
  });
  await t.test("unsupported changed dates remain planning only and preserve original income", () => {
    const owner=fresh(),b=snapshot(owner); const {id,cmd}=replace(owner,{frequency:"monthly",nextDate:"2026-11-30",amountCents:140001});
    assert.deepEqual(snapshot(owner),b);assert.equal(moneyPlanView(owner).entries[0].forecastIntegration.status,"needs_review");
    cmd("pause",{id});assert.deepEqual(snapshot(owner).forecast,b.forecast);
  });
  await t.test("unsupported monthly/quarterly/one-time replacements preserve salary rather than erasing goal income", () => {
    for(const frequency of ["monthly","quarterly","once"] as const) {
      const owner=fresh(),before=snapshot(owner);replace(owner,{frequency,nextDate:"2026-11-30"});
      assert.deepEqual(snapshot(owner),before);assert.equal(monthlySurplus(personaWithState(owner).persona),642);
      assert.equal(moneyPlanView(owner).entries[0].forecastIntegration.status,"needs_review");
    }
  });
  await t.test("a lower equivalent replacement reduces established stress and surplus; drafts/hypotheticals do not replace salary", () => {
    const owner=fresh();replace(owner,{amountCents:100000});const p=personaWithState(owner).persona;
    assert.equal(monthlySurplus(p),-441.33);assert.ok(forecast(p).stressMinBalance<=1540);assert.equal(snapshot(owner).investable.investable,0);
    for(const patch of [{sourceType:"hypothetical",reliability:"uncertain"},{reliability:"uncertain"}]) {
      const who=fresh();replace(who,patch);assert.equal(snapshot(who).planning,undefined);assert.equal(monthlySurplus(personaWithState(who).persona),642);
    }
  });
  await t.test("purchase cost and its resulting buffer deficit are one overlapping funding loss", () => {
    const p=buildPersonas()[0],result=buildOptions(p,p.goals,[],getProduct("aero-14")!);
    const trip=(a:ReturnType<typeof allocateGoals>)=>a.goals.find(g=>g.goalId==="a-trip")!.eta;
    const once=projectGoals(p,p.goals,schedule("full",900).payments).allocation,full=result.options.find(o=>o.method==="full")!;
    console.log("GOAL_REPRO",JSON.stringify({baseline:trip(result.baselineAlloc),once:trip(once),current:trip(full.goalPlan!),price:900,bufferDeficit:-full.forecast.bufferGap}));
    assert.equal(trip(result.baselineAlloc),"2027-03-12");assert.equal(trip(full.goalPlan!),trip(once));
    assert.deepEqual(allocateGoals(p,p.goals,schedule("full",249).payments,0),allocateGoals(p,p.goals,schedule("full",249).payments,100));
    const deficitOnly=allocateGoals(p,p.goals,[],900);assert.ok(deficitOnly.goals[0].allocatedThisMonth<result.baselineAlloc.goals[0].allocatedThisMonth);
    for(const o of result.options) assert.ok(o.goalPlan!.goals.every(g=>g.allocatedThisMonth>=0));
  });
  await t.test("independent pre-purchase cash deficits remain protected and shared baselines agree", () => {
    const owner=fresh();update(data=>{data.personas[owner].purchases.push({id:"PAST",orderId:"PAST",productName:"Past reserve",amount:1200,method:"full",payments:[{date:"2026-11-09",amount:1200,label:"Prior reserve"}],capturedAt:"2026-11-09T12:00:00Z",fundingStatus:"UNCONFIRMED",simulated:true});});
    const {persona:p,payments}=personaWithState(owner),view=snapshot(owner),result=buildOptions(p,p.goals,payments,getProduct("aero-14")!);
    assert.deepEqual(result.baselineAlloc,view.allocation);assert.equal(view.investable.investable,0);
    const independent=Math.max(0,-forecast(p,payments).bufferGap);assert.equal(independent,480);
    const future=[{date:"2026-12-15",amount:100,label:"Later purchase"}];
    assert.deepEqual(allocateGoals(p,p.goals,future,480,480),allocateGoals(p,p.goals,future,0,480));
  });
  for (const date of ["2026-11-10","2027-02-10","2028-02-10"]) await t.test(`matching daily-budget equivalent is a genuine no-op on ${date}`, () => {
    process.env.DEMO_TODAY=date;
    try {
      const owner=fresh(),before=snapshot(owner),b=planningBudgetView(owner),category=b.categories.find(c=>c.categoryId==="food-and-dining")!;
      const req={categoryId:category.categoryId,monthlyCents:category.forecastIntegration.currentMonthlyCents!,version:b.version,epoch:b.epoch,basisHash:b.basisHash,financialInputHash:before.financialInputHash};
      const stored=load(),p=previewBudget(owner,req);assert.deepEqual(load(),stored);assert.equal(p.monthlyDifferenceCents,0);assert.equal(p.forecast.changed,false);
      updatePlanningBudget(owner,{action:"apply",...p.confirmation});assert.deepEqual(snapshot(owner),before);
      assert.equal(personaWithState(owner).persona.everydaySpending!.categories[0].override,undefined);
    } finally {process.env.DEMO_TODAY="2026-11-10";}
  });
  await t.test("real calendar-month conversion previews following 31-day month and repeating it is a no-op", () => {
    const owner=fresh(),b=planningBudgetView(owner),req={categoryId:"food-and-dining",monthlyCents:15000,version:b.version,epoch:b.epoch,basisHash:b.basisHash,financialInputHash:inputHash(owner)};
    const p=previewBudget(owner,req);assert.equal(p.forecast.changed,true);assert.equal(p.months[1].adjustedEstimateCents,15000);assert.equal(p.months[1].originalEstimateCents,31000);
    updatePlanningBudget(owner,{action:"apply",...p.confirmation});const before=snapshot(owner),b2=planningBudgetView(owner),p2=previewBudget(owner,{...req,version:b2.version,epoch:b2.epoch,basisHash:b2.basisHash,financialInputHash:inputHash(owner)});assert.equal(p2.forecast.changed,false);updatePlanningBudget(owner,{action:"apply",...p2.confirmation});assert.deepEqual(snapshot(owner),before);
  });
  await t.test("generic capture service cannot bypass an expired persisted Shop intent", async () => {
    const owner=fresh(),p=personaWithState(owner).persona;
    const product=getProduct("aero-14")!,built=buildOptions(p,p.goals,[],product); const d:Decision={id:"shop-expired",personaId:owner,productId:product.id,createdAt:new Date().toISOString(),inputHash:inputHash(owner),schemaVersion:"rp-v1",origin:"shop",currency:"USD",baseline:forecast(p),options:built.options,recommendedMethod:built.recommended};
    update(s=>{s.decisions[d.id]=d;});let captures=0,gets=0;
    const remote:PayPalOrder={id:"AUDIT-SHOP",status:"APPROVED",purchase_units:[{custom_id:`${d.id}:full`,amount:{value:"900.00",currency_code:"USD"}}]};
    const api={configured:()=>true,create:async()=>remote,get:async()=>{gets++;return remote;},capture:async()=>{captures++;throw Error("must not capture");}};
    await createCheckout(owner,d.id,"full",api);update(s=>{s.decisions[d.id].createdAt=new Date(Date.now()-31*60000).toISOString();});
    await assert.rejects(captureCheckout(owner,remote.id,api,d.inputHash),/expired|changed|review/i);assert.equal(captures,0);assert.equal(gets,0);
  });
  await t.test("capture routes ignore missing/forged client source, reject stale/expired/unknown intent and preserve recovery", async t2 => {
    const {workAsyncStorage} = await import("next/dist/server/app-render/work-async-storage.external");
    const {workUnitAsyncStorage} = await import("next/dist/server/app-render/work-unit-async-storage.external");
    const {RequestCookies} = await import("next/dist/compiled/@edge-runtime/cookies");
    const route = await import("../app/api/orders/[id]/capture/route");
    const alias = await import("../app/api/paypal/orders/[id]/capture/route");
    const remotes = new Map<string, PayPalOrder>(); let captures=0;
    const originalFetch=globalThis.fetch;
    globalThis.fetch=async (input,init) => {
      const url=new URL(String(input));
      assert.equal(url.origin,"https://api-m.sandbox.paypal.com");
      if (url.pathname==="/v1/oauth2/token") return Response.json({access_token:"fixture-only",expires_in:3600});
      const id=url.pathname.split("/")[4],remote=remotes.get(id);assert.ok(remote,"Unexpected provider request");
      if(init?.method==="POST") {captures++;remote.status="COMPLETED";remote.purchase_units![0].payments={captures:[{id:`CAP-${id}`,status:"COMPLETED",amount:{value:"900.00",currency_code:"USD"}}]};}
      return Response.json(remote);
    };
    t2.after(()=>{globalThis.fetch=originalFetch;});
    async function fixture() {
      const workspace=crypto.randomUUID(),owner=`${workspace}:alex`,id=`ROUTE-${++seq}`;ensurePersona(owner);
      const p=personaWithState(owner).persona,built=buildOptions(p,p.goals,[],getProduct("aero-14")!);
      const d:Decision={id:`decision-${id}`,personaId:owner,productId:"aero-14",createdAt:new Date().toISOString(),inputHash:inputHash(owner),schemaVersion:"rp-v1",origin:"shop",currency:"USD",baseline:forecast(p),options:built.options,recommendedMethod:built.recommended};
      update(data=>{data.decisions[d.id]=d;});
      const remote:PayPalOrder={id,status:"APPROVED",purchase_units:[{custom_id:`${d.id}:full`,amount:{value:"900.00",currency_code:"USD"}}]};remotes.set(id,remote);
      await createCheckout(owner,d.id,"full",{configured:()=>true,create:async()=>remote,get:async()=>remote,capture:async()=>{throw Error("Fixture creation must not capture");}});
      const invoke=(extra:Record<string,unknown>={},cookieWorkspace=workspace,useAlias=false)=>{
        const cookie=`rp_workspace=${cookieWorkspace}; rp_account=alex`;
        return workAsyncStorage.run({route:"/regression",isStaticGeneration:false} as never,()=>workUnitAsyncStorage.run({type:"request",phase:"render",cookies:new RequestCookies(new Headers({cookie}))} as never,()=>(useAlias?alias:route).POST(new Request("http://localhost:3000/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reviewConfirmed:true,inputHash:d.inputHash,...extra})}),{params:Promise.resolve({id})})));
      };
      return {id,owner,d,remote,invoke};
    }
    for(const source of ["shop",undefined,"merchant"]) {
      const f=await fixture(),before=captures;
      const response=await f.invoke(source===undefined?{}:{checkoutSource:source},undefined,source==="merchant");assert.equal(response.status,200);assert.equal(captures,before+1);
      assert.equal((await f.invoke({checkoutSource:"merchant"})).status,200);assert.equal(captures,before+1);
    }
    for(const reason of ["expired","stale","ambiguous","owner","unconfirmed","unapproved"]) {
      const f=await fixture(),before=captures;
      update(data=>{if(reason==="expired")data.decisions[f.d.id].createdAt=new Date(Date.now()-31*60000).toISOString();if(reason==="stale")data.personas[f.owner].goals[0].targetAmount++;if(reason==="ambiguous")delete data.orders[f.id].shopPayNow;});
      if(reason==="unapproved")f.remote.status="CREATED";
      const response=await f.invoke(reason==="unconfirmed"?{reviewConfirmed:false}:{checkoutSource:"merchant"},reason==="owner"?crypto.randomUUID():undefined);
      assert.ok(response.status>=400,`${reason} must reject`);assert.equal(captures,before,`${reason} cannot capture`);
    }
    const f=await fixture(),before=captures;
    update(data=>{data.orders[f.id].status="UNKNOWN";data.orders[f.id].captureCommand="UNKNOWN";data.decisions[f.d.id].createdAt=new Date(Date.now()-31*60000).toISOString();});
    f.remote.status="COMPLETED";f.remote.purchase_units![0].payments={captures:[{id:`RECOVER-${f.id}`,status:"COMPLETED",amount:{value:"900.00",currency_code:"USD"}}]};
    assert.equal((await f.invoke()).status,200);assert.equal(captures,before);
    update(data=>{delete data.orders[f.id].shopPayNow;});
    assert.equal((await f.invoke()).status,200);assert.equal(captures,before);assert.equal(snapshot(f.owner).purchases.length,1);
  });
  await t.test("verified partial/full refunds, reversals and duplicate resources update status only", () => {
    const owner=fresh(),id="REFUND-FIXTURE";
    update(data=>{data.orders[id]={orderId:id,personaId:owner,decisionId:"fixture",productId:"aero-14",productName:"Laptop",method:"full",amount:900,currency:"USD",status:"CREATED",createdAt:new Date().toISOString(),captureRequestId:"never-provider",simulated:true};});
    // Local fixture bookkeeping only; no provider call or actual payment.
    const beforeCapture=snapshot(owner);
    return import("../lib/purchases").then(async ({recordCapture})=>{
      const {processVerifiedWebhook}=await import("../lib/webhooks");recordCapture(id,"REFUND-CAP",900);const before=snapshot(owner);
      const event=(eventId:string,resourceId:string,type:string,amount?:string)=>JSON.stringify({id:eventId,event_type:`PAYMENT.CAPTURE.${type}`,resource:{id:resourceId,...(amount?{amount:{value:amount,currency_code:"USD"}}:{}),supplementary_data:{related_ids:{order_id:id,capture_id:"REFUND-CAP"}}}});
      const a=event("refund-event-a","refund-a","REFUNDED","100.00");processVerifiedWebhook(a);assert.equal(processVerifiedWebhook(a).duplicate,true);assert.equal(paymentStatusView(load().orders[id]).state,"PARTIALLY_REFUNDED");
      processVerifiedWebhook(event("refund-event-a2","refund-a","REFUNDED","100.00"));assert.equal(load().orders[id].settlementEvents!.length,1);
      processVerifiedWebhook(event("refund-event-b","refund-b","REFUNDED","800.00"));assert.equal(paymentStatusView(load().orders[id]).state,"REFUNDED");
      processVerifiedWebhook(event("reversal","reversal-a","REVERSED"));assert.equal(paymentStatusView(load().orders[id]).state,"REVERSED");
      assert.deepEqual(snapshot(owner),before);assert.equal(beforeCapture.purchases.length,0);assert.equal(before.purchases.length,1);
    });
  });
  await t.test("verified refund evidence overrides historical captured display without releasing reserve", () => {
    const order={orderId:"O",personaId:"x",decisionId:"d",productId:"p",productName:"p",method:"full" as const,amount:900,currency:"USD" as const,status:"CAPTURED" as const,captureId:"C",captureRequestId:"c",createdAt:"now",settlementReview:"PAYMENT.CAPTURE.REFUNDED"};
    assert.notEqual(paymentStatusView(order).state,"CAPTURED");
  });
});

test("financial date follows configured New York calendar while pinned dates remain exact", t => {
  delete process.env.DEMO_TODAY;process.env.FINANCIAL_TIMEZONE="America/New_York";
  t.mock.timers.enable({apis:["Date"],now:new Date("2026-11-12T01:00:00Z").getTime()});
  try {
    for(const [instant,expected] of [["2026-11-12T01:00:00Z","2026-11-11"],["2026-11-12T04:59:59Z","2026-11-11"],["2026-11-12T05:00:00Z","2026-11-12"],["2026-07-12T03:59:59Z","2026-07-11"],["2026-07-12T04:00:00Z","2026-07-12"],["2026-03-08T07:00:00Z","2026-03-08"],["2026-11-01T06:00:00Z","2026-11-01"]]){t.mock.timers.setTime(new Date(instant).getTime());assert.equal(iso(today()),expected);}
    process.env.FINANCIAL_TIMEZONE="Asia/Tokyo";t.mock.timers.setTime(new Date("2026-11-11T18:00:00Z").getTime());assert.equal(iso(today()),"2026-11-12");
    process.env.DEMO_TODAY="2026-11-10";assert.equal(iso(today()),"2026-11-10");} finally {t.mock.timers.reset();process.env.DEMO_TODAY="2026-11-10";delete process.env.FINANCIAL_TIMEZONE;}
});
