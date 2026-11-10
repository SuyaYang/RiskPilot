import {test} from "node:test";
import assert from "node:assert/strict";
import React, {createElement} from "react";
// The Node/tsx runner preserves classic JSX; Next supplies its automatic runtime in the app.
Object.assign(globalThis,{React});
import {renderToStaticMarkup} from "react-dom/server";
import PurchaseConclusion from "../app/components/PurchaseConclusion";
import TimingComparison from "../app/components/TimingComparison";
import CaptureComparison from "../app/components/CaptureComparison";
import {buildPersonas} from "../lib/personas";
import {buildOptions} from "../lib/engine/options";
import {getProduct} from "../lib/catalog";
import type {Decision} from "../lib/types";
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
