"use client";
import type { Decision } from "@/lib/types";
import Icon from "./Icon";
import { fmtDate, money } from "./ui";
export default function PurchaseConclusion({decision,buffer,onAfterIncome,onSkip,disabled=false}:{decision:Decision;buffer:number;onAfterIncome:()=>void;onSkip:()=>void;disabled?:boolean}) {
  const now=decision.options.find(option=>option.method==="full");if(!now)return null;
  const f=now.forecast,goals=now.goalImpact.filter(goal=>goal.delayDays>0),timing=decision.afterIncome;
  return <section className="purchase-conclusion" aria-label="Purchase decision summary"><div className="conclusion-icon"><Icon name="shield" size={22}/></div><div><span className="page-kicker">Full-price checkout assessment</span><h2>{f.risk==="red"?"Paying now would cross your cash buffer.":f.risk==="yellow"?"Leave room for income arriving late.":"Your cash buffer holds in both checks."}</h2><p>Lowest projected cash: <strong>{money(f.minBalance)}</strong> on {fmtDate(f.minBalanceDate)}, against a {money(buffer)} buffer. {goals.length?`${goals.length} goal${goals.length===1?"":"s"} would finish later than without this purchase.`:"No additional goal delay is projected."}</p>{decision.recommendedMethod==="wait"&&<p className="conclusion-recommendation"><strong>The engine suggests waiting:</strong> none of the evaluated purchase scenarios protects the buffer in both checks.</p>}<div className="row">{timing?.available&&<button disabled={disabled} onClick={onAfterIncome}>Compare buying on {fmtDate(timing.purchaseDate)} →</button>}<button className="text-action" disabled={disabled} onClick={onSkip}>Compare skipping this purchase</button></div><span className="small muted">Engine-calculated forecast · PayPal funding remains unconfirmed</span></div></section>;
}
