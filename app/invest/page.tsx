"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LoadingState from "../components/LoadingState";
import ContextCopilot from "../components/ContextCopilot";
import Icon from "../components/Icon";
import type { InvestableResult } from "@/lib/engine/investable";
import type { Allocation } from "@/lib/types";
import { readinessView } from "@/lib/presentation";
import { fmtDate, money, postJson, useApi } from "../components/ui";
type Mix = { label: string; cash: number; bonds: number; index: number };
type Prefs = { horizon: "short" | "medium" | "long"; risk: "conservative" | "balanced" | "growth" };
type InvestmentData = { investable: InvestableResult; prefs: Prefs; templates: Record<string, Record<string, Mix>>; concepts: { id:string; q:string }[]; allocation: Allocation };

function Concept({ id, q }: { id: string; q: string }) {
  const [answer,setAnswer] = useState(""), [loading,setLoading] = useState(false), [error,setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(),[]);
  async function load() {
    if (loading) return;
    controller.current?.abort(); const abort = new AbortController(); controller.current=abort;
    const timeout=setTimeout(()=>abort.abort(),8000);
    setLoading(true);setError("");
    try {
      const response=await fetch(`/api/concepts?id=${encodeURIComponent(id)}`,{signal:abort.signal}); const data=await response.json();
      if(!response.ok || typeof data.answer!=="string" || !data.answer.trim())throw new Error("This explanation is unavailable. Please retry.");
      setAnswer(data.answer);
    }catch(error){setError((error as Error).name==="AbortError" ? "The explanation timed out. Please retry." : (error as Error).message);}
    finally{clearTimeout(timeout);setLoading(false);}
  }
  return <details className="education-card" onToggle={event=>{if(event.currentTarget.open&&!answer&&!loading&&!error)void load();}}><summary>{q}</summary>{loading ? <p role="status" className="small muted">Loading this explanation…</p> : error ? <div><p className="error" role="alert">{error}</p><button onClick={load}>Retry explanation</button></div> : answer ? <p className="small muted">{answer}</p> : null}</details>;
}
function BufferThreshold({ inv }: { inv:InvestableResult }) {
  const scale=Math.max(inv.buffer,inv.minBalance,inv.reservedForGoals,1)*1.2;
  const cash=Math.max(0,Math.min(100,inv.minBalance/scale*100)), marker=inv.buffer/scale*100;
  return <section className="buffer-analysis"><div className="row between"><h2>Protect the money you need.</h2><span className="badge gray">Forecast threshold</span></div><p className="small muted">Lowest evaluated cash, compared with your buffer. Bills and existing purchase reserves are already included in that projection.</p><div className="threshold-caption"><span>Lowest projected cash</span><strong>{money(inv.minBalance)}</strong></div><div className="threshold-track" role="img" aria-label={`Lowest projected cash ${money(inv.minBalance)}, buffer threshold ${money(inv.buffer)}`}><span style={{width:`${cash}%`}} /><i style={{left:`${marker}%`}} /></div><div className="threshold-scale"><span>$0</span><span>Buffer {money(inv.buffer)}</span></div>{inv.minBalance<0&&<p className="small negative">The projected minimum is negative; it is below the start of this positive-cash scale.</p>}<div className="protected-goals"><Icon name="target" /><div><span>This month&apos;s protected spending goals</span><strong>{money(inv.reservedForGoals)}</strong></div></div><p className="small muted">Goal reserve is a separate requirement, not another slice of the cash bar. Available cash also depends on delayed income and goal checks.</p></section>;
}
function AllocationDonut({ mix }: { mix:Mix }) {
  const [highlight,setHighlight]=useState<string|null>(null);
  const parts=[{key:"cash",label:"Cash / savings",value:mix.cash,color:"var(--ink)"},{key:"bonds",label:"Bond funds",value:mix.bonds,color:"var(--border-strong)"},{key:"index",label:"Broad index funds",value:mix.index,color:"var(--accent)"}];
  let offset=0;
  return <div className="allocation-visual"><div className="allocation-donut"><svg viewBox="0 0 220 220" role="img" aria-label={`Educational allocation: cash ${mix.cash}%, bonds ${mix.bonds}%, index funds ${mix.index}%`}><circle cx="110" cy="110" r="82" fill="none" stroke="var(--divider)" strokeWidth="24" />{parts.map(part=>{const start=offset;offset+=part.value;return <circle key={part.key} cx="110" cy="110" r="82" fill="none" stroke={part.color} strokeWidth={highlight===part.key?28:24} pathLength="100" strokeDasharray={`${part.value} ${100-part.value}`} strokeDashoffset={-start} transform="rotate(-90 110 110)" opacity={highlight&&highlight!==part.key?0.35:1} />;})}</svg><div><strong>{highlight ? `${parts.find(part=>part.key===highlight)?.value}%` : "Example"}</strong><span>{highlight ? parts.find(part=>part.key===highlight)?.label : "Educational mix"}</span></div></div><div className="allocation-legend">{parts.map(part=><button key={part.key} aria-pressed={highlight===part.key} onClick={()=>setHighlight(highlight===part.key?null:part.key)}><i style={{background:part.color}} /><span>{part.label}</span><strong>{part.value}%</strong></button>)}</div></div>;
}
const CHECK_HELP:Record<string,{why:string;action:string;href:string}>={
  buffer:{why:"Keeps the lowest projected cash above your chosen buffer.",action:"Review bills and commitments",href:"/"},
  stress:{why:"Checks whether your buffer survives income arriving a week late.",action:"Inspect the income-late scenario",href:"/"},
  goals:{why:"Protects spending goals due within six months.",action:"Review goal priorities and deadlines",href:"/goals"},
};
export default function Invest() {
  const {data,error,reload}=useApi<InvestmentData>("/api/invest");
  const [localPrefs,setLocalPrefs]=useState<Prefs|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{const clear=()=>{setLocalPrefs(null);setMessage("");};window.addEventListener("rp:persona",clear);return()=>window.removeEventListener("rp:persona",clear);},[]);
  async function choose(next:Prefs){if(!data||busy)return;const previous=localPrefs||data.prefs;setLocalPrefs(next);setBusy(true);setMessage("");try{await postJson("/api/invest",next);}catch(error){setLocalPrefs(previous);setMessage((error as Error).message);}finally{setBusy(false);}}
  if(error)return <div className="card stack"><h1>Readiness unavailable</h1><p className="error" role="alert">{error}</p><button onClick={reload}>Try again</button></div>;
  if(!data)return <LoadingState label="Loading investment readiness" />;
  const inv=data.investable,prefs=localPrefs||data.prefs,readiness=readinessView(inv),mix=data.templates[prefs.horizon]?.[prefs.risk];
  return <div className="invest-page"><div className="studio-intro"><span className="page-kicker">Investment readiness studio</span><h1>First, make room.</h1><p className="sub">Understand what&apos;s protected before exploring what&apos;s possible.</p></div>
    <section className="readiness-hero" aria-labelledby="capacity-heading"><div><span id="capacity-heading">Available to allocate today</span><strong className="readiness-amount">{Number.isFinite(inv.investable)?money(inv.investable):"Unavailable"}</strong><p>Fictional finances · No transfers or trades</p></div><div className="readiness-outlook"><span className="readiness-label"><Icon name={readiness.status==="ready"?"check":"shield"} size={18}/>{readiness.label}</span><p>{readiness.explanation}</p><span>Engine-calculated capacity, not a recommendation to invest.</span></div></section>
    <div className="readiness-analysis"><BufferThreshold inv={inv}/><section className="readiness-checks"><h2>Your readiness checks</h2>{inv.checks.length ? inv.checks.map(check=>{const info=CHECK_HELP[check.id];return <div className="health-check" key={check.id}><span className={`check-symbol ${check.ok===true?"pass":"hold"}`}>{check.ok===true?<Icon name="check" size={16}/>:"—"}</span><div><div className="row between"><strong>{check.label}</strong><span className={`badge ${check.ok===true?"green":check.ok===false?"yellow":"gray"}`}>{check.ok===true?"Pass":check.ok===false?"Hold":"Unknown"}</span></div><p>{info?.why||"No explanation is available for this check."}</p>{info&&<Link href={info.href}>{info.action} →</Link>}</div></div>;}) : <p className="muted">No readiness checks were returned. Refresh before interpreting capacity.</p>}</section></div>
    <section className="allocation-studio" aria-labelledby="allocation-heading"><div className="row between"><div><span className="page-kicker">Explore, without moving money</span><h2 id="allocation-heading">Build an understanding of your mix.</h2></div><span className="badge gray">Educational examples</span></div>{readiness.status!=="ready"&&<p className="allocation-hold-note">You can explore these examples while your cash remains protected. They do not make any amount investable.</p>}<div className="allocation-studio-grid"><div className="allocation-controls"><label>When might you need the money?<select disabled={busy} value={prefs.horizon} onChange={event=>choose({...prefs,horizon:event.target.value as Prefs["horizon"]})}><option value="short">Within 3 years</option><option value="medium">3–7 years</option><option value="long">More than 7 years</option></select></label><fieldset className="risk-selector"><legend>Scenario risk preference</legend>{(["conservative","balanced","growth"] as const).map(risk=><button type="button" key={risk} disabled={busy} aria-pressed={prefs.risk===risk} onClick={()=>choose({...prefs,risk})}>{risk[0].toUpperCase()+risk.slice(1)}</button>)}</fieldset>{mix&&<div className="allocation-context"><h3>{mix.label}</h3><p>The percentages come from the existing educational template for your selected horizon and preference.</p></div>}<p className="small muted" role="status">{busy?"Saving scenario preferences…":message||"No money is invested. Examples are not personalized advice or return forecasts."}</p></div>{mix ? <AllocationDonut mix={mix}/> : <div className="empty-state"><h3>Allocation example unavailable</h3><p>No template was returned for this selection.</p><button onClick={reload}>Reload examples</button></div>}</div></section>
    <section className="invest-learning"><div><h2>Learn the basics</h2><p className="small muted">A little context, when you need it.</p></div><div className="education-grid">{data.concepts.map(concept=><Concept key={concept.id} {...concept}/>)}{!data.concepts.length&&<p className="muted">Educational content is unavailable.</p>}</div></section>
    <ContextCopilot page="Investment readiness" questions={[
      {id:"capacity",label:inv.investable===0?"Why is my investable cash currently zero?":"What determines my available cash?",answer:<p>{readiness.explanation} Lowest evaluated cash: {money(inv.minBalance)} on {fmtDate(inv.minBalanceDate)}; buffer: {money(inv.buffer)}; protected goal reserve: {money(inv.reservedForGoals)}.</p>},
      {id:"mix",label:"What does this allocation scenario mean?",answer:mix?<p>This educational template assigns {mix.cash}% to cash/savings, {mix.bonds}% to bond funds and {mix.index}% to broad index funds. It illustrates the selected horizon and preference; it does not recommend an investment or change your cash capacity.</p>:<p>No supported template is available for this selection.</p>},
    ]}/>
  </div>;
}
