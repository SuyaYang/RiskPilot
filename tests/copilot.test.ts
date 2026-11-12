import { test } from "node:test";
import assert from "node:assert/strict";
import { answerCopilot } from "../lib/ai";
import { copilotFacts } from "../lib/copilot";
import { buildPersonas } from "../lib/personas";
import { forecast } from "../lib/engine/forecast";
import { allocateGoals } from "../lib/engine/goals";
import { investableNow } from "../lib/engine/investable";
import type { snapshot } from "../lib/state";

test("free-text copilot only returns allowlisted facts and keeps unsupported/outage states explicit",async t=>{
  const oldFetch=globalThis.fetch,key=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY="fixture-only";
  const facts={forecast:"Lowest projected cash is USD 1720.00.",context:"Fictional demo data."};
  const respond=(value:unknown)=>{globalThis.fetch=async(_url,init)=>{
    const body=JSON.parse(String(init?.body));
    assert.match(body.contents[0].parts[0].text,/How is my cash/);
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(value)}]}}]});
  };};
  try {
    await t.test("own question reaches Gemini; model-authored claims are discarded",async()=>{
      respond({supported:true,factIds:["forecast","context"],text:"Guaranteed payment approved."});
      const result=await answerCopilot("How is my cash?","Goals",facts);
      assert.equal(result.text,Object.values(facts).join("\n\n"));assert.equal(result.source,"ai");
    });
    await t.test("invented facts cannot be displayed",async()=>{
      respond({supported:true,factIds:["guaranteed_approval"]});
      await assert.rejects(answerCopilot("How is my cash?","Goals",facts),/could not be verified/);
    });
    await t.test("unsupported question is not dressed as a calculated answer",async()=>{
      respond({supported:false,factIds:[],text:"Buy it tomorrow"});
      const result=await answerCopilot("How is my cash?","Goals",facts);
      assert.equal(result.source,"unsupported");assert.doesNotMatch(result.text,/Buy it tomorrow/);
    });
    await t.test("provider outage returns retryable failure without fabricating an AI answer",async()=>{
      globalThis.fetch=async()=>new Response("Unavailable",{status:503});
      await assert.rejects(answerCopilot("How is my cash?","Goals",facts),/unavailable/);
    });
  }finally{globalThis.fetch=oldFetch;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});
test("copilot context contains engine-owned amounts and no provider or workspace identifiers",()=>{
  process.env.DEMO_TODAY="2026-11-10";
  const p=buildPersonas()[0],f=forecast(p),allocation=allocateGoals(p,p.goals);
  const data={persona:p,forecast:f,allocation,investable:investableNow(p,f,allocation),upcomingPayments:[],purchases:[],goals:p.goals,goalHistory:[],asOf:"2026-11-10",source:"fictional-manual-demo",schemaVersion:"rp-v1"} as unknown as ReturnType<typeof snapshot>;
  const before=structuredClone(data),facts=copilotFacts(data);
  assert.match(facts.forecast,new RegExp(f.minBalance.toFixed(2)));
  assert.match(facts.goals,/individual progress/);
  assert.match(facts.purchase,/No current purchase assessment/);
  assert.doesNotMatch(JSON.stringify(facts),/GEMINI_API_KEY|PAYPAL_CLIENT_SECRET|rp_workspace/);
  assert.deepEqual(data,before);
});
