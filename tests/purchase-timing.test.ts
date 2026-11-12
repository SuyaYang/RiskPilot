import {test} from "node:test";
import assert from "node:assert/strict";
import {buildPersonas} from "../lib/personas";
import {buildOptions} from "../lib/engine/options";
import {forecast} from "../lib/engine/forecast";
import {getProduct} from "../lib/catalog";
import {reviewFacts} from "../lib/reviewInsights";
import type {PurchaseReview} from "../lib/orderReview";
process.env.DEMO_TODAY="2026-11-10";
const laptop=getProduct("aero-14")!;

test("after-income scenario moves the purchase, recalculates cash and retains the late-income risk",()=>{
  const p=buildPersonas()[0],original=structuredClone(p),result=buildOptions(p,p.goals,[],laptop),later=result.afterIncome;
  assert.ok(later.available);if(!later.available)return;
  assert.equal(later.income.date,"2026-11-19");assert.equal(later.purchaseDate,"2026-11-20");
  assert.equal(later.payment.amount,900);assert.equal(result.options.find(o=>o.method==="full")!.forecast.minBalance,820);
  assert.equal(later.forecast.minBalance,1260);assert.equal(later.forecast.stressMinBalance,640);assert.equal(later.forecast.risk,"yellow");
  assert.deepEqual(later.forecast,forecast(p,[],[{date:"2026-11-20",amount:900,label:"After income"}]));
  assert.deepEqual(p,original,"Preview must not mutate balances, recurring schedules or goals");
  assert.ok(later.allocation.goals.every(goal=>goal.targetDate===p.goals.find(g=>g.id===goal.goalId)!.targetDate));
});
test("waiting does not fabricate safety for a persona whose finances remain risky",()=>{
  const p=buildPersonas().find(p=>p.id==="jordan")!,later=buildOptions(p,p.goals,[],laptop).afterIncome;
  assert.ok(later.available);if(!later.available)return;
  assert.equal(later.forecast.risk,"red");assert.ok(later.forecast.minBalance<0);assert.equal(later.income.uncertain,true);
});
test("missing income and dates outside the visible evaluation window are explicitly unavailable",()=>{
  const p=structuredClone(buildPersonas()[0]);p.recurring=p.recurring.filter(item=>item.direction!=="in");
  assert.equal(buildOptions(p,p.goals,[],laptop).afterIncome.available,false);
  p.recurring.push({id:"late",name:"Late income",amount:4000,direction:"in",frequency:"monthly",firstInDays:44});
  assert.equal(buildOptions(p,p.goals,[],laptop).afterIncome.available,false);
});
test("same-day reserves are not subtracted a second time by the timing simulation",()=>{
  const p=buildPersonas()[0],payments=[{date:"2026-11-10",amount:249,label:"Existing purchase"}],before=structuredClone(payments);
  const later=buildOptions(p,p.goals,payments,laptop).afterIncome;assert.ok(later.available);if(!later.available)return;
  assert.equal(later.forecast.startBalance,3251);
  assert.deepEqual(later.forecast,forecast(p,payments,[later.payment]));assert.deepEqual(payments,before);
});
test("AI facts identify fixed-date previews and do not apply them to current capture",()=>{
  const p=buildPersonas()[0],result=buildOptions(p,p.goals,[],laptop),review={buffer:p.buffer,decision:{options:result.options,afterIncome:result.afterIncome,inputHash:"test"}} as PurchaseReview;
  const facts=reviewFacts(review,"full","income");assert.match(facts.facts.income,/2026-11-20/);assert.match(facts.facts.income,/not a scheduled payment/);
  const preview=reviewFacts(review,"full","overview","after_income");assert.match(preview.facts.outlook,/1,260/);assert.match(preview.facts.alternative,/future-date preview/);
  assert.throws(()=>reviewFacts(review,"pay_in_4","overview","after_income"));
  assert.match(reviewFacts(review,"full","delay").facts.delay,/next month has not been evaluated/);
});
