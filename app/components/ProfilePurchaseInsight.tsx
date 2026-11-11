"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { MethodId } from "@/lib/types";
type Explanation = { text:string; source:"ai"|"template"; personalized:boolean; alternative:string|null; uncertainty:string };
export default function ProfilePurchaseInsight({decisionId,orderId,method,timing="now",fallback}:{decisionId?:string;orderId?:string;method:MethodId;timing?:"now"|"after_income";fallback?:ReactNode}) {
  const [data,setData]=useState<Explanation|null>(null),[error,setError]=useState(""),[revision,setRevision]=useState(0);
  useEffect(()=>{const refresh=()=>setRevision(n=>n+1);window.addEventListener("rp:profile",refresh);return()=>window.removeEventListener("rp:profile",refresh);},[]);
  useEffect(()=>{
    const controller=new AbortController();setData(null);setError("");
    fetch("/api/financial-profile/purchase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...(orderId?{orderId}:{decisionId}),method,timing}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)])})
      .then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||"Profile explanation unavailable");if(!controller.signal.aborted)setData(result);})
      .catch(error=>{if(!controller.signal.aborted)setError(error.name==="TimeoutError"?"Profile explanation timed out. Your engine assessment remains available.":error.message);});
    return()=>controller.abort();
  },[decisionId,orderId,method,timing,revision]);
  if(error)return <div className="profile-purchase small"><p role="status">{error}</p><button onClick={()=>setRevision(n=>n+1)}>Retry profile explanation</button></div>;
  if(!data)return <p className="small muted profile-purchase" role="status">Checking confirmed planning preferences…</p>;
  if(!data.personalized && fallback)return <>{fallback}</>;
  if(!data.personalized)return <p className="small muted profile-purchase">No planning preferences confirmed. <Link href="/#financial-profile-title">Review your Financial Profile</Link> to personalize explanations.</p>;
  return <section className="profile-purchase" aria-label="Financial profile purchase explanation"><div className="row between"><h3>Your profile in this decision</h3><span className="badge gray">{data.source==="ai"?"Gemini-selected facts":"Engine facts · AI fallback"}</span></div><p>{data.text}</p>{data.alternative&&<p className="small">{data.alternative}</p>}<details><summary>Explanation limits</summary><p className="small muted">{data.uncertainty}</p></details></section>;
}
