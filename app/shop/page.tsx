"use client";
import { useEffect, useState } from "react";
import type { Decision, MethodId } from "@/lib/types";
import type { Product } from "@/lib/catalog";
import { BalanceChart, fmtDate, money, postJson, RiskBadge, useApi } from "../components/ui";
import PurchaseImpact from "../components/PurchaseImpact";
import Checkout from "../components/Checkout";

export default function Shop() {
  const { data, error: loadError } = useApi<{ products: Product[] }>("/api/products");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [buffer, setBuffer] = useState(0);
  const [selected, setSelected] = useState<MethodId>("full");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    const clear = () => { setDecision(null); setPaid(false); setError(""); };
    window.addEventListener("rp:persona", clear);
    return () => window.removeEventListener("rp:persona", clear);
  }, []);
  async function assess(productId: string) {
    setBusy(true); setError(""); setDecision(null); setPaid(false);
    try {
      const result = await postJson("/api/decisions", { productId });
      setDecision(result.decision); setBuffer(result.buffer); setSelected(result.decision.recommendedMethod);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const option = decision?.options.find(o => o.method === selected);
  return <div className="stack">
    <h1>Assess before you pay</h1>
    <p className="sub">Compare this purchase with bills, your buffer and goals using fictional demo finances.</p>
    <div className="grid g3">{data?.products.map(p => <div className="card stack" key={p.id}>
      <h2>{p.name}</h2><p className="muted">{p.description}</p><div className="big">{money(p.price)}</div>
      <button disabled={busy} onClick={() => assess(p.id)}>Compare payment scenarios</button>
    </div>)}</div>
    {busy && <p role="status">Assessing cash flow and goals…</p>}
    {(error || loadError) && <p className="error" role="alert">{error || loadError}</p>}
    {decision && <>
      <div className="note"><strong>Assessment</strong> · {decision.explanation?.text}<p className="small">{decision.explanation?.source === "ai" ? "AI explanation of calculated figures" : "Calculated figures · template explanation"}</p></div>
      <p className="warn">Pay Later schedules below are hypothetical estimates. Purchase-price ranges do not prove eligibility. PayPal determines eligible methods and actual loan terms at checkout.</p>
      <div className="grid g3">{decision.options.map(o => <div className={`card stack ${selected === o.method ? "rec" : ""}`} key={o.method}>
        <h3>{o.label}</h3>{o.recommended && <span className="badge blue">{o.hypothetical ? "Best hypothetical scenario" : "Suggested scenario"}</span>}
        {o.hypothetical && <span className="badge gray">Hypothetical · terms unconfirmed</span>}
        <p className="small">{o.productName}{o.price > 0 ? ` · ${money(o.price)}` : ""}</p>
        <RiskBadge risk={o.forecast.risk} />
        <p>Lowest projection: <strong>{money(o.forecast.minBalance)}</strong> on {fmtDate(o.forecast.minBalanceDate)}</p>
        <p className="small muted">Evaluated through {fmtDate(o.forecast.evaluatedThrough)}, including all estimated payment dates. Estimated extra cost {money(o.extraCost)}.</p>
        {o.goalImpact.filter(g => g.delayDays > 0).map(g => <p className="small" key={g.goalId}>{g.name}: {g.delayDays} more days</p>)}
        {o.responsible.reasons.map(r => <p className="small muted" key={r}>{r}</p>)}
        <button disabled={!o.eligible || paid} aria-pressed={selected === o.method} onClick={() => setSelected(o.method)}>{!o.eligible ? o.ineligibleReason : selected === o.method ? "Selected" : "View scenario"}</button>
      </div>)}</div>
      {option && <div className="card stack">
        <PurchaseImpact decision={decision} option={option} buffer={buffer} onSelect={setSelected} locked={paid} />
        <BalanceChart series={option.forecast.dailyBalances} compare={decision.baseline.dailyBalances} buffer={buffer} />
        <p className="small muted">Solid: selected scenario · dashed: without this purchase · visible chart: 45 days.</p>
        {option.payments.length > 0 && <details><summary>{option.hypothetical ? "Hypothetical" : "Projected"} payment dates</summary><table><tbody>{option.payments.map(p => <tr key={p.date}><td>{fmtDate(p.date)}</td><td>{p.label}</td><td>{money(p.amount)}</td></tr>)}</tbody></table></details>}
        {selected === "wait" ? <p>No checkout is started. You can revisit the purchase after your finances change.</p> : <Checkout key={`${decision.id}:${selected}`} decisionId={decision.id} method={selected} price={option.price} onComplete={() => setPaid(true)} />}
      </div>}
    </>}
  </div>;
}
