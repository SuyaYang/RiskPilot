"use client";
import { useRef, useState } from "react";
import { postJson } from "./ui";
export default function MerchantCheckoutLink({ decisionId }: {decisionId:string}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");const lock=useRef(false);
  async function continueAtMerchant() {
    if(lock.current)return;lock.current=true;setBusy(true);setError("");
    try { const result=await postJson("/api/merchant/intent",{decisionId});window.location.assign(result.url); }
    catch(error){setError((error as Error).message);lock.current=false;setBusy(false);}
  }
  return <div className="merchant-continuation"><button className="primary" disabled={busy} onClick={continueAtMerchant}>{busy?"Opening Northstar…":"Continue at Northstar →"}</button><p className="small muted">Continue to securely associate this assessment with the store. No order is created until you choose PayPal there; RiskPilot rechecks before final payment.</p>{error&&<p className="error" role="alert">{error}</p>}</div>;
}
