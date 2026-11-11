import {test} from "node:test";
import assert from "node:assert/strict";
import React, {createElement} from "react";
// The Node/tsx runner preserves classic JSX; Next supplies its automatic runtime in the app.
Object.assign(globalThis,{React});
import {renderToStaticMarkup} from "react-dom/server";
import SmartRecheckSummary from "../app/components/SmartRecheckSummary";
import PurchaseConclusion from "../app/components/PurchaseConclusion";
import TimingComparison from "../app/components/TimingComparison";
import ReviewInsights from "../app/components/ReviewInsights";
import {reviewFacts} from "../lib/reviewInsights";
import type {PurchaseReview} from "../lib/orderReview";
import CaptureComparison from "../app/components/CaptureComparison";
import CheckoutVerification from "../app/components/CheckoutVerification";
import CheckoutSuccess,{type CheckoutSuccessData} from "../app/components/CheckoutSuccess";
import {buildPersonas} from "../lib/personas";
import {buildOptions} from "../lib/engine/options";
import {getProduct} from "../lib/catalog";
import type {Decision} from "../lib/types";
import {paymentStatusView} from "../lib/paymentStatus";
import type {OrderRecord} from "../lib/store";
process.env.DEMO_TODAY="2026-11-10";
function decision(id="alex"):Decision{
  const p=buildPersonas().find(p=>p.id===id)!,result=buildOptions(p,p.goals,[],getProduct("aero-14")!);
  return {id:"ui",personaId:p.id,productId:"aero-14",createdAt:"2026-11-10",inputHash:"ui",schemaVersion:"rp-v1",baseline:result.options.find(o=>o.method==="wait")!.forecast,options:result.options,recommendedMethod:result.recommended,afterIncome:result.afterIncome};
}
test("decision conclusion makes risky now versus waiting explicit without asserting payment eligibility",()=>{
  const html=renderToStaticMarkup(createElement(PurchaseConclusion,{decision:decision("jordan"),buffer:500,onAfterIncome:()=>{},onSkip:()=>{}}));
  assert.match(html,/Paying now would cross your cash buffer/);assert.match(html,/engine suggests waiting/);assert.match(html,/funding remains unconfirmed/);assert.doesNotMatch(html,/Guaranteed|approved for/);
});
test("timing UI presents actual computed amounts and warns that the date remains fixed under late income",()=>{
  const html=renderToStaticMarkup(createElement(TimingComparison,{decision:decision(),active:true,onChange:()=>{}}));
  assert.match(html,/\$820/);assert.match(html,/\$1,260/);assert.match(html,/\$640/);assert.match(html,/Nov 20/);assert.match(html,/date stays fixed/);assert.match(html,/does not schedule/);
  assert.doesNotMatch(html,/Confirm and pay/);
});
test("legacy payment UI does not invent before-purchase figures",()=>{
  const html=renderToStaticMarkup(createElement(CaptureComparison,{comparison:{available:false,reason:"This earlier payment has no saved before-purchase snapshot."}}));
  assert.match(html,/no saved before-purchase snapshot/);assert.doesNotMatch(html,/\$0|Here&#x27;s what changed/);
});

test("compact merchant review preserves critical risk and gives one concise grounded explanation",()=>{
  const current=decision(),facts=reviewFacts({decision:current,buffer:1000} as PurchaseReview,"full","overview");
  const critical=renderToStaticMarkup(createElement(PurchaseConclusion,{decision:current,buffer:1000,compact:true,onAfterIncome:()=>{},onSkip:()=>{}}));
  assert.match(critical,/\$820/);assert.match(critical,/\$640/);assert.match(critical,/3 goals/);assert.match(critical,/buffer/);
  assert.doesNotMatch(critical,/Compare buying on/);
  const explanation=renderToStaticMarkup(createElement(ReviewInsights,{orderId:"fixture",inputHash:"ui",method:"full",compact:true,fallback:facts.facts.checkout_summary}));
  assert.match(explanation,/Before you confirm/);assert.match(explanation,/current and late-income forecasts/);assert.match(explanation,/Funding and loan terms remain unconfirmed/);
  assert.match(explanation,/AI can only select and explain verified engine facts/);
  assert.doesNotMatch(explanation,/copilot-launcher/);
  const future=reviewFacts({decision:current,buffer:1000} as PurchaseReview,"full","overview","after_income");assert.match(future.facts.checkout_summary,/cannot schedule payment/);
});

test("unchanged Smart Recheck never turns an existing risk warning into a safety claim",()=>{
  const html=renderToStaticMarkup(createElement(SmartRecheckSummary,{recheck:{status:"unchanged",reason:"No material changes.",currentAmountCents:90000,previousAmountCents:90000,reviewedAt:"2026-11-10T17:00:00Z",comparison:"full_price",checks:[]}}));
  assert.match(html,/No material changes/);assert.match(html,/risk warning below still applies/);assert.match(html,/does not confirm PayPal funding/);assert.doesNotMatch(html,/Guaranteed|safe to buy|Premium/);
});

test("checkout verification distinguishes provider evidence, lookup failure and simulation",()=>{
  const base:OrderRecord={orderId:"ORDER-1",personaId:"alex",decisionId:"decision",productId:"aero-14",productName:"Aero 14 Laptop",method:"full",amount:900,currency:"USD",status:"CREATED",createdAt:"2026-11-10",captureRequestId:"capture-ORDER-1"};
  const checked=paymentStatusView(base,{status:"APPROVED",capture:null});
  assert.equal(checked.providerChecked,true);assert.equal(checked.amountVerified,true);assert.equal(checked.currencyVerified,true);
  const checkedHtml=renderToStaticMarkup(createElement(CheckoutVerification,{payment:checked,order:base}));
  assert.match(checkedHtml,/PayPal order checked/);assert.match(checkedHtml,/Amount verified/);
  const failed=paymentStatusView(base,undefined,true);
  assert.equal(failed.providerChecked,false);assert.equal(failed.amountVerified,false);
  const failedHtml=renderToStaticMarkup(createElement(CheckoutVerification,{payment:failed,order:base}));
  assert.match(failedHtml,/PayPal check unavailable/);assert.match(failedHtml,/Local amount locked/);assert.doesNotMatch(failedHtml,/Amount verified/);
  const simulated={...base,orderId:"SIM-1",simulated:true,status:"CAPTURED" as const,projectionStatus:"UPDATED" as const,captureId:"SIMCAP-1"};
  const simulationHtml=renderToStaticMarkup(createElement(CheckoutVerification,{payment:paymentStatusView(simulated,undefined,false,true),order:simulated}));
  assert.match(simulationHtml,/Simulation order/);assert.match(simulationHtml,/Simulation amount/);assert.doesNotMatch(simulationHtml,/PayPal order checked/);
});

test("completed simulation uses local-record language and offers no second purchase action",()=>{
  const d=decision();
  const order:OrderRecord={orderId:"SIM-1",personaId:"alex",decisionId:d.id,productId:d.productId,productName:"Aero 14 Laptop",method:"full",amount:900,currency:"USD",status:"CAPTURED",captureId:"SIMCAP-1",createdAt:"2026-11-10",simulated:true,captureRequestId:"capture-SIM-1",projectionStatus:"UPDATED",snapshotId:"snapshot-1"};
  const data:CheckoutSuccessData={comparison:{available:false,reason:"Fixture comparison unavailable."},order,returnUrl:null,forecastSnapshot:{id:"snapshot-1",createdAt:"2026-11-10",data:{forecast:d.baseline,asOf:"2026-11-10"}}};
  const html=renderToStaticMarkup(createElement(CheckoutSuccess,{data}));
  assert.match(html,/simulation and saved forecast are linked to the same local record/i);
  assert.doesNotMatch(html,/same verified order|Simulate purchase/);
});
