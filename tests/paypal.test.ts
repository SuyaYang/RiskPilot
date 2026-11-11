import {test} from "node:test";
import assert from "node:assert/strict";
import {createOrder,getOrder} from "../lib/paypal";

test("PayPal transport preserves status and debug metadata for non-JSON responses",async t=>{
  const originalFetch=globalThis.fetch;
  const clientId=process.env.PAYPAL_CLIENT_ID,secret=process.env.PAYPAL_CLIENT_SECRET;
  process.env.PAYPAL_CLIENT_ID="fixture-client";process.env.PAYPAL_CLIENT_SECRET="fixture-secret";
  t.after(()=>{globalThis.fetch=originalFetch;if(clientId===undefined)delete process.env.PAYPAL_CLIENT_ID;else process.env.PAYPAL_CLIENT_ID=clientId;if(secret===undefined)delete process.env.PAYPAL_CLIENT_SECRET;else process.env.PAYPAL_CLIENT_SECRET=secret;});
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    if(calls===1)return Response.json({access_token:"fixture-token",expires_in:3600});
    return new Response("<html>temporary proxy failure</html>",{status:502,headers:{"paypal-debug-id":"DBG-502"}});
  };
  await assert.rejects(createOrder({amount:900,name:"Fixture",customId:"decision:full",requestId:"fixture-create"}),error=>{
    const value=error as Error&{status?:number;debugId?:string;retryable?:boolean;code?:string};
    assert.equal(value.status,502);assert.equal(value.debugId,"DBG-502");assert.equal(value.retryable,true);assert.equal(value.code,"PROVIDER_ERROR");assert.match(value.message,/DBG-502/);return true;
  });
  assert.equal(calls,2);
  globalThis.fetch=async()=>new Response("<html>unexpected success body</html>",{status:200,headers:{"paypal-debug-id":"DBG-200"}});
  await assert.rejects(getOrder("ORDER-1"),error=>{
    const value=error as Error&{status?:number;debugId?:string};
    assert.equal(value.status,200);assert.equal(value.debugId,"DBG-200");assert.match(value.message,/invalid JSON/);return true;
  });
});
