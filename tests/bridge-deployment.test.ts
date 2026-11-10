import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import type {IncomingMessage,ServerResponse} from "node:http";
import {bridgeOrigin,merchantKey} from "../lib/merchantBridge";
import {createMerchantServer} from "../merchant-demo/server";

test("bridge permits exact HTTPS allowlist and retains strict loopback-only HTTP",()=>{
  const allow="https://store.example.com,https://review.example.com";
  assert.equal(bridgeOrigin("https://store.example.com/",allow),"https://store.example.com");
  assert.equal(bridgeOrigin("http://localhost:3200"),"http://localhost:3200");
  for(const value of ["https://evil.example.com","http://store.example.com","https://store.example.com.evil.test","https://store.example.com/redirect","https://store.example.com?next=evil","https://user:pass@store.example.com","https://127.0.0.1","https://store.example.com:444"])assert.throws(()=>bridgeOrigin(value,allow));
  assert.throws(()=>bridgeOrigin("https://store.example.com","https://*.example.com"));
});
test("public bridge requires an explicitly shared key even in local NODE_ENV",()=>{
  const key=process.env.MERCHANT_BRIDGE_SECRET,origin=process.env.MERCHANT_ORIGIN;
  try{delete process.env.MERCHANT_BRIDGE_SECRET;process.env.MERCHANT_ORIGIN="https://store.example.com";assert.throws(()=>merchantKey(),/same MERCHANT_BRIDGE_SECRET/);}
  finally{if(key===undefined)delete process.env.MERCHANT_BRIDGE_SECRET;else process.env.MERCHANT_BRIDGE_SECRET=key;if(origin===undefined)delete process.env.MERCHANT_ORIGIN;else process.env.MERCHANT_ORIGIN=origin;}
});
test("HTTPS merchant uses configured public redirects, Secure cookie and persistent ledger across restart",async()=>{
  const previous=process.env.MERCHANT_BRIDGE_ALLOWED_ORIGINS;
  process.env.MERCHANT_BRIDGE_ALLOWED_ORIGINS="https://store.example.com,https://review.example.com";
  const dir=mkdtempSync(path.join(tmpdir(),"rp-https-"));let creates=0,customId="",configuredOrigin="";
  const gateway={configured:()=>true,create:async(args:{customId:string;experience?:{origin:string}})=>{creates++;customId=args.customId;configuredOrigin=args.experience!.origin;return {id:"HTTPSORDER",status:"CREATED"};},get:async()=>({id:"HTTPSORDER",status:"APPROVED",purchase_units:[{custom_id:customId,amount:{value:"900.00",currency_code:"USD"}}]}),capture:async()=>{throw new Error("Read-only test must not capture");}};
  const options={origin:"https://store.example.com",reviewOrigin:"https://review.example.com",bridgeKey:"a".repeat(64),ledgerPath:path.join(dir,"merchant.json"),gateway};
  async function request(server:ReturnType<typeof createMerchantServer>,url:string,method:string,cookie="",origin="https://store.example.com"){
    let status=200,body="";const headers:Record<string,string>={};
    const handler=server.listeners("request")[0] as (req:IncomingMessage,res:ServerResponse)=>Promise<void>;
    await handler({url,method,headers:{origin,cookie}} as IncomingMessage,{setHeader:(key:string,value:string)=>{headers[key.toLowerCase()]=value;},writeHead:(code:number,values:Record<string,string>={})=>{status=code;for(const [key,value]of Object.entries(values))headers[key.toLowerCase()]=value;},end:(value="")=>{body=value;}} as unknown as ServerResponse);
    return {status,headers,body};
  }
  try{
    const server=createMerchantServer(options),first=await request(server,"/api/order","POST");
    assert.equal(first.status,200);assert.equal(configuredOrigin,"https://store.example.com");assert.match(first.headers["set-cookie"],/; Secure/);
    const cookie=first.headers["set-cookie"].split(";")[0];
    const returned=await request(server,"/checkout/return?token=HTTPSORDER","GET",cookie);
    assert.equal(returned.status,302);assert.equal(new URL(returned.headers.location).origin,"https://review.example.com");
    const reopened=createMerchantServer(options),status=await request(reopened,"/api/status","GET",cookie);
    assert.equal(status.status,200);assert.equal(JSON.parse(status.body).id,"HTTPSORDER");assert.equal(creates,1);
    assert.equal((await request(reopened,"/api/order","POST",cookie,"https://evil.example.com")).status,403);
  }finally{rmSync(dir,{recursive:true,force:true});if(previous===undefined)delete process.env.MERCHANT_BRIDGE_ALLOWED_ORIGINS;else process.env.MERCHANT_BRIDGE_ALLOWED_ORIGINS=previous;}
});
