"use client";
import {useEffect,useRef} from "react";
import type { Decision, MethodId } from "@/lib/types";
import { fullDate, fmtDate, money, RiskBadge } from "./ui";

export default function TimingComparison({decision,active,onChange,disabled=false,currentMethod="full"}:{decision:Decision;active:boolean;currentMethod?:MethodId;onChange:(active:boolean)=>void;disabled?:boolean}) {
  const section=useRef<HTMLElement>(null);
  useEffect(()=>{if(active){section.current?.scrollIntoView({block:"start",behavior:"auto"});section.current?.focus({preventScroll:true});}},[active]);
  const timing=decision.afterIncome,now=decision.options.find(option=>option.method==="full");
  if(!now)return null;
  if(!timing?.available)return <section className="card timing-comparison"><h2>Could a different date help?</h2><p className="small muted">{timing && !timing.available?timing.reason:"Refresh this assessment to calculate an after-income scenario."}</p></section>;
  return <section ref={section} tabIndex={-1} className="card timing-comparison" aria-label="Purchase timing comparison">
    <div className="row between"><div><span className="page-kicker">A real calculation, before you commit</span><h2>Could a different date help?</h2></div><span className="badge gray">Read-only what-if</span></div>
    <p className="small muted">{timing.income.name} is expected on {fmtDate(timing.income.date)}{timing.income.uncertain?" and is marked uncertain":""}. Compare the same {money(now.price)} purchase one day later.</p>
    <div className="timing-options" role="group" aria-label="Choose forecast timing"><button aria-pressed={!active&&currentMethod==="full"} disabled={disabled} onClick={()=>onChange(false)}><strong>Pay in full now</strong><span>Current checkout forecast</span><b>{money(now.forecast.minBalance)}</b><span>Lowest projected cash</span><RiskBadge risk={now.forecast.risk}/></button><button aria-pressed={active} disabled={disabled} onClick={()=>onChange(true)}><strong>Buy on {fmtDate(timing.purchaseDate)}</strong><span>After expected income</span><b>{money(timing.forecast.minBalance)}</b><span>Lowest projected cash</span><RiskBadge risk={timing.forecast.risk}/></button></div>
    <div className="timing-stress"><span>Lowest cash if income is a week late</span><strong>{money(now.forecast.stressMinBalance)} now <span>→</span> {money(timing.forecast.stressMinBalance)} later</strong></div>
    <details><summary>Compare predicted goal dates</summary><div className="timing-goals">{timing.allocation.goals.map(goal=>{const current=now.goalPlan?.goals.find(item=>item.goalId===goal.goalId);return <div key={goal.goalId}><strong>{goal.name}</strong><span><small>Pay now</small>{current?.status==="paused"?"Paused":current?.eta?fullDate(current.eta):"Not projected"}</span><span><small>Buy later</small>{goal.status==="paused"?"Paused":goal.eta?fullDate(goal.eta):"Not projected"}</span></div>;})}{!timing.allocation.goals.length&&<p className="small muted">No saved goals to compare.</p>}</div></details>
    <p className="small muted timing-assumptions">The purchase date stays fixed if income arrives late. Price is assumed unchanged; stock and future payment eligibility are unknown. This preview does not schedule a purchase or change your checkout.</p>
  </section>;
}
