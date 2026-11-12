import { test } from "node:test";
import assert from "node:assert/strict";
import { progressPercent, readinessView, scheduledItems } from "../lib/presentation";
import { buildPersonas } from "../lib/personas";
import { forecast } from "../lib/engine/forecast";
import { allocateGoals } from "../lib/engine/goals";
import { investableNow } from "../lib/engine/investable";
process.env.DEMO_TODAY = "2026-11-10";
const passing = ["buffer","stress","goals"].map(id=>({id,label:id,ok:true}));

test("zero capacity never presents an investment-ready status, even when checks pass", () => {
  const result = readinessView({investable:0,checks:passing});
  assert.equal(result.status,"hold");
  assert.match(result.explanation,/No cash remains/);
});
test("failed and missing checks hold or mark readiness unknown", () => {
  assert.equal(readinessView({investable:100,checks:[]}).status,"unknown");
  assert.equal(readinessView({investable:NaN,checks:[{id:"b",label:"Buffer",ok:true}]}).status,"unknown");
  assert.equal(readinessView({investable:100,checks:[passing[0]]}).status,"unknown");
  const held = readinessView({investable:100,checks:passing.map(check=>({...check,ok:check.id!=="buffer"}))});
  assert.equal(held.status,"hold");
  assert.match(held.explanation,/have not passed/);
  assert.equal(readinessView({investable:100,checks:passing}).status,"ready");
});
test("readiness presentation preserves real persona engine capacity and check results", () => {
  let zeros=0;
  for(const persona of buildPersonas()) {
    const projected=forecast(persona);
    const result=investableNow(persona,projected,allocateGoals(persona,persona.goals));
    const before=structuredClone(result),view=readinessView(result);
    if(result.investable===0){zeros++;assert.equal(view.status,"hold");}
    if(view.status==="ready")assert.ok(result.investable>0&&result.checks.every(check=>check.ok));
    assert.deepEqual(result,before);
  }
  assert.ok(zeros>0);
});
test("scheduled items use snapshot date and separate fictional bills from recorded future reserves", () => {
  const recurring=[{id:"rent",name:"Rent",direction:"out" as const,amount:1000,frequency:"monthly" as const,firstInDays:0},{id:"pay",name:"Income",direction:"in" as const,amount:3000,frequency:"biweekly" as const,firstInDays:2}];
  const payments=[{date:"2026-11-10",label:"Already reserved",amount:900},{date:"2026-11-20",label:"Future purchase",amount:225},{date:"2026-12-25",label:"Outside horizon",amount:225}];
  assert.deepEqual(scheduledItems(recurring,payments,"2026-11-10"),[
    {date:"2026-11-10",label:"Rent",amount:1000,source:"Fictional bill"},
    {date:"2026-11-20",label:"Future purchase",amount:225,source:"Recorded reserve"},
    {date:"2026-12-10",label:"Rent",amount:1000,source:"Fictional bill"},
  ]);
});
test("goal progress stays within bounds and handles unavailable targets",()=>{
  assert.equal(progressPercent(250,1000),25);
  assert.equal(progressPercent(2000,1000),100);
  assert.equal(progressPercent(-20,1000),0);
  assert.equal(progressPercent(100,0),0);
  assert.equal(progressPercent(NaN,100),0);
});
