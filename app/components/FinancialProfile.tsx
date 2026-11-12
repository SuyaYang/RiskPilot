"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { FinancialProfileView } from "@/lib/financialProfile/service";
import type { ProfileFocus } from "@/lib/financialProfile/types";
import { formatCents, parseCents } from "@/lib/spending/money";
import { postJson, useApi, fullDate } from "./ui";

export default function FinancialProfile() {
  const { data: loaded, error, reload } = useApi<FinancialProfileView>("/api/financial-profile");
  const [local,setLocal] = useState<FinancialProfileView | null>(null), [editing,setEditing] = useState(false);
  const data = local || loaded;
  const [draft,setDraft] = useState({ amount:"", goal:"", focus:"cash_buffer" as ProfileFocus });
  const [busy,setBusy] = useState(false), [saveError,setSaveError] = useState(""), [message,setMessage] = useState("");
  const generation = useRef(0), lock = useRef(false), input = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocal(null); },[loaded]);
  useEffect(() => {
    const clear = () => { generation.current++;lock.current=false;setBusy(false);setLocal(null);setEditing(false);setSaveError("");setMessage(""); };
    const spendingChanged = () => { clear();reload(); };
    window.addEventListener("rp:persona",clear);window.addEventListener("rp:spending",spendingChanged);
    return () => { generation.current++;window.removeEventListener("rp:persona",clear);window.removeEventListener("rp:spending",spendingChanged); };
  },[reload]);
  useEffect(() => { if(editing)input.current?.focus(); },[editing]);
  async function mutate(method:"POST"|"PATCH", fields:Record<string,unknown>) {
    if(!data||lock.current)return;
    lock.current=true;setBusy(true);setSaveError("");setMessage("");const version=++generation.current;
    try {
      const result=await postJson("/api/financial-profile",{version:data.version,basisHash:data.basisHash,...fields},method);
      if(version!==generation.current)return;
      setLocal(result);setEditing(false);
      setMessage(method==="POST" ? result.profile?.source==="ai" ? "Profile refreshed from verified facts." : "Gemini unavailable or unverified; showing engine facts." : fields.action==="confirm_preferences" ? "Preferences confirmed for explanations. Generate a refreshed profile to apply them." : "Profile review saved.");
      window.dispatchEvent(new Event("rp:profile"));
    }catch(error){if(version===generation.current)setSaveError((error as Error).message);}
    finally{if(version===generation.current){lock.current=false;setBusy(false);}}
  }
  function editPreferences(){
    if(!data)return;const amount=data.preferences?.planningBufferCents??data.engineBufferCents;
    setDraft({amount:`${Math.floor(amount/100)}.${String(amount%100).padStart(2,"0")}`,goal:data.activeGoals.some(goal=>goal.id===data.preferences?.priorityGoalId)?data.preferences!.priorityGoalId!:"",focus:data.preferences?.focus||"cash_buffer"});setSaveError("");setEditing(true);
  }
  function savePreferences(event:FormEvent){event.preventDefault();const amount=parseCents(draft.amount);if(amount===null){setSaveError("Enter a planning amount with at most two decimal places.");return;}void mutate("PATCH",{action:"confirm_preferences",planningBufferCents:amount,priorityGoalId:draft.goal||null,focus:draft.focus});}
  if(error)return <section className="card financial-profile"><h2>Your Financial Profile</h2><p className="error" role="alert">{error}</p><button onClick={reload}>Retry profile</button></section>;
  if(!data)return <section className="card financial-profile" role="status"><h2>Your Financial Profile</h2><p className="small muted">Loading your profile facts…</p></section>;
  return <section className="card financial-profile" aria-labelledby="financial-profile-title">
    <div className="row between"><div><h2 id="financial-profile-title">Your Financial Profile</h2><p className="small muted profile-subtitle">Understand how your spending habits shape your financial outlook.</p></div><span className="badge gray">{data.profile?.source==="ai"?"Gemini · demo":"Template · demo"}</span></div>
    {data.profile ? <><p className="profile-summary">{data.profile.summary}</p><ul className="profile-insights">{data.profile.insights.map(insight=><li key={insight.id}><span>{insight.shortText||insight.text}</span></li>)}</ul><div className="row between"><Link href={data.profile.action.href} className="profile-next">{data.profile.action.label} →</Link></div></> : <p className="small muted">{data.status==="stale"?"Financial or review inputs changed. Refresh the profile before using its insights.":data.status==="dismissed"?"Generated profile dismissed. Confirmed preferences remain saved until you edit or clear them.":"Generate a concise summary of current spending, commitments and goals. No transactions or balances are changed."}</p>}
    <div className="row profile-actions"><button className="primary" disabled={busy} onClick={()=>mutate("POST",{})}>{busy?"Working…":data.profile||data.status==="stale"?"Refresh profile":"Generate profile"}</button><button disabled={busy} onClick={editPreferences}>{data.preferences?"Edit confirmed preferences":"Confirm preferences"}</button></div>
    {editing&&<form className="profile-preferences" onSubmit={savePreferences} aria-label="Planning preferences"><p className="small muted">These preferences personalize explanations only. The engine currently protects {formatCents(data.engineBufferCents)}; this form does not change that buffer, goal priorities or commitments.</p><label>Planning buffer preference (USD)<input ref={input} required inputMode="decimal" value={draft.amount} onChange={event=>setDraft({...draft,amount:event.target.value})}/></label><label>Preferred active savings goal<select value={draft.goal} onChange={event=>setDraft({...draft,goal:event.target.value})}><option value="">None selected</option>{data.activeGoals.map(goal=><option value={goal.id} key={goal.id}>{goal.name}</option>)}</select></label><label>Explanation focus<select value={draft.focus} onChange={event=>setDraft({...draft,focus:event.target.value as ProfileFocus})}><option value="cash_buffer">Cash buffer</option><option value="goals">Savings goals</option><option value="commitments">Upcoming commitments</option></select></label>{saveError&&<p className="error" role="alert">{saveError}</p>}<div className="row"><button className="primary" disabled={busy}>Save confirmed preferences</button><button type="button" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button></div></form>}
    <details className="profile-details"><summary>View details · sources & preferences</summary><p className="small muted">Explanation: {data.profile?.source==="ai"?"Gemini-selected server facts":"Deterministic facts; Gemini is unavailable or has not produced a verified profile"}. History: {data.coverage}. Current engine as of {fullDate(data.asOf)}. {data.privacy}</p><p className="small muted">{data.preferencePolicy}</p><p className="small">{data.preferences?`Confirmed planning buffer: ${formatCents(data.preferences.planningBufferCents)}. Focus: ${data.preferences.focus.replaceAll("_"," ")}.` : "Planning preferences have not been confirmed."}</p><dl className="profile-evidence">{Object.entries(data.evidence).map(([id,fact])=><div key={id}><dt><span className="badge gray">{fact.kind.replaceAll("_"," ")}</span> {fact.source}{data.profile?.insights.some(insight=>insight.id===id)&&<button className="text-action" disabled={busy} aria-label={`Dismiss ${id} observation`} onClick={()=>mutate("PATCH",{action:"dismiss_insight",insightId:id})}>Dismiss observation</button>}</dt><dd>{fact.text}<span>{fact.period}</span></dd></div>)}</dl><div className="row">{data.profile&&<button disabled={busy} onClick={()=>mutate("PATCH",{action:"dismiss_profile"})}>Dismiss generated profile</button>}{data.dismissedInsightIds.length>0&&<button disabled={busy} onClick={()=>mutate("PATCH",{action:"restore_insights"})}>Restore dismissed observations</button>}{data.preferences&&<button disabled={busy} onClick={()=>mutate("PATCH",{action:"clear_preferences"})}>Clear preferences</button>}<Link href="/goals" className="btn">Edit authoritative goals</Link></div></details>
    {message&&<p className="small muted" role="status">{message}</p>}{saveError&&!editing&&<div><p className="error" role="alert">{saveError}</p><button onClick={()=>{setLocal(null);reload();}}>Reload current profile</button></div>}
  </section>;
}
