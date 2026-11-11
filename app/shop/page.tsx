"use client";
import MerchantCheckoutLink from "../components/MerchantCheckoutLink";
import ProfilePurchaseInsight from "../components/ProfilePurchaseInsight";
import ContextCopilot from "../components/ContextCopilot";
import TimingComparison from "../components/TimingComparison";
import PurchaseConclusion from "../components/PurchaseConclusion";
import LoadingState from "../components/LoadingState";
import { useEffect, useRef, useState } from "react";
import type { Decision, MethodId } from "@/lib/types";
import type { Product } from "@/lib/catalog";
import { BalanceChart, fmtDate, money, postJson, RiskBadge, useApi } from "../components/ui";
import PurchaseImpact from "../components/PurchaseImpact";
import Checkout from "../components/Checkout";
import ProductArt from "../components/ProductArt";

export default function Shop() {
  const { data, error: loadError, reload } = useApi<{ products: Product[] }>("/api/products");
  const [featuredId, setFeaturedId] = useState("aero-14");
  const [afterIncome,setAfterIncome]=useState(false);
  const assessmentVersion=useRef(0);
  const resultsRef=useRef<HTMLDivElement>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  useEffect(() => {
    if (decision) { resultsRef.current?.scrollIntoView({block:"start"}); resultsRef.current?.focus({preventScroll:true}); }
  }, [decision]);
  const [buffer, setBuffer] = useState(0);
  const [selected, setSelected] = useState<MethodId>("full");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    const clear = () => { assessmentVersion.current++;setBusy(false);setAfterIncome(false);setDecision(null); setPaid(false); setError(""); };
    window.addEventListener("rp:persona", clear);
    return () => window.removeEventListener("rp:persona", clear);
  }, []);
  async function assess(productId: string) {
    const version=++assessmentVersion.current;
    setBusy(true);setAfterIncome(false); setError(""); setDecision(null); setPaid(false);
    try {
      const result = await postJson("/api/decisions", { productId });
      if(version!==assessmentVersion.current)return;
      setDecision(result.decision); setBuffer(result.buffer); setSelected(result.decision.recommendedMethod);
    } catch (e) { if(version===assessmentVersion.current)setError((e as Error).message); }
    finally { if(version===assessmentVersion.current)setBusy(false); }
  }
  if (loadError) return <div className="card stack"><h1>Products unavailable</h1><p className="error" role="alert">{loadError}</p><button onClick={reload}>Try again</button></div>;
  if (!data && !loadError) return <LoadingState label="Loading demo products" />;
  const featured = data?.products.find(product => product.id === featuredId) || data?.products[0];
  const option = decision?.options.find(o => o.method === selected);
  const timing=decision?.afterIncome;
  const preview=afterIncome&&timing?.available?timing:null;
  return <div className="shop-studio">
    <header className="shop-intro"><span className="page-kicker">Purchase decision studio</span><h1>A considered purchase.<br className="desktop-break" /> A clearer next step.</h1><p className="sub">Explore the product. Understand the impact. Then decide.</p></header>
    {featured && <section className="shop-editorial"><div className="shop-product-stage"><ProductArt id={featured.id}/><span>{featured.name} · Demo collection</span></div><div className="shop-product-copy"><span className="page-kicker">The everyday collection</span><h2>{featured.name}</h2><p className="shop-description">{featured.description}</p><div className="shop-price">{money(featured.price)}<span>USD · catalog price</span></div><div className="shop-purchase-promise"><h3>Make room for what comes next.</h3><p>Review this purchase against your cash buffer, upcoming bills and savings goals.</p><button className="primary" disabled={busy} onClick={()=>assess(featured.id)}>{busy ? "Comparing scenarios…" : "Explore purchase impact →"}</button><span>Explore without PayPal authorization. No order or payment is created.</span></div></div></section>}
    <div className="product-selector" aria-label="Choose a product">{data?.products.map(product=><button key={product.id} disabled={busy} aria-pressed={featured?.id===product.id} onClick={()=>{setFeaturedId(product.id);setAfterIncome(false);setDecision(null);setPaid(false);setError("");}}><ProductArt id={product.id}/><span><strong>{product.name}</strong><span>{money(product.price)}</span></span></button>)}</div>
    {busy && <p role="status">Assessing cash flow and goals…</p>}
    {(error || loadError) && <p className="error" role="alert">{error || loadError}</p>}
    {decision && <div className="shop-assessment" ref={resultsRef} tabIndex={-1}>
      <PurchaseConclusion decision={decision} buffer={buffer} disabled={paid} onAfterIncome={()=>{setSelected("full");setAfterIncome(true);}} onSkip={()=>{setAfterIncome(false);setSelected("wait");}}/>
      {!paid&&<ProfilePurchaseInsight decisionId={decision.id} method={selected} timing={preview?"after_income":"now"}/>}
      <TimingComparison currentMethod={selected} decision={decision} active={!!preview} disabled={paid} onChange={active=>{setSelected("full");setAfterIncome(active);}}/>
      <div className="note"><strong>Current purchase assessment</strong> · {decision.explanation?.text}<p className="small">{decision.explanation?.source === "ai" ? "AI explanation of calculated figures" : "Calculated figures · template explanation"}</p></div>
      <p className="warn">Pay Later schedules below are hypothetical estimates. Purchase-price ranges do not prove eligibility. PayPal determines eligible methods and actual loan terms at checkout.</p>
      <section className="scenario-comparison"><div className="row between"><div><span className="page-kicker">One decision, different paths</span><h2>Compare the trade-offs.</h2></div><span className="small muted">Engine projections · not lending eligibility</span></div><div className="scenario-table-viewport" tabIndex={0} role="region" aria-label="Payment scenario comparison"><table className="scenario-table"><thead><tr><th>Scenario</th><th>Lowest projected cash</th><th>Goal impact</th><th>Estimated extra cost</th><th>Explore</th></tr></thead><tbody>{decision.options.map(o=><tr key={o.method} className={selected===o.method?"selected-scenario":""}><td><strong>{o.label}</strong><span>{o.productName} · {money(o.price)}</span><span>{o.hypothetical?"Hypothetical · terms unconfirmed":o.method==="wait"?"No checkout":"Checkout available"}</span>{o.recommended&&<span className="badge blue">{o.hypothetical?"Suggested hypothetical":"Suggested scenario"}</span>}</td><td><strong>{money(o.forecast.minBalance)}</strong><span>{fmtDate(o.forecast.minBalanceDate)}</span><RiskBadge risk={o.forecast.risk}/></td><td>{o.goalImpact.some(goal=>goal.delayDays>0)?o.goalImpact.filter(goal=>goal.delayDays>0).map(goal=><span key={goal.goalId}>{goal.name}: +{goal.delayDays} days</span>):<span>No added goal delay</span>}</td><td>{money(o.extraCost)}<span>Evaluated through {fmtDate(o.forecast.evaluatedThrough)}</span></td><td><button disabled={!o.eligible||paid} aria-pressed={selected===o.method} onClick={()=>{setAfterIncome(false);setSelected(o.method);}}>{!o.eligible?"Unavailable":selected===o.method?"Selected":"View scenario"}</button>{!o.eligible&&<span>{o.ineligibleReason}</span>}</td></tr>)}</tbody></table></div></section>
      {option && <div className="card stack">
        {!preview&&<PurchaseImpact decision={decision} option={option} buffer={buffer} locked={paid} />}
        <BalanceChart series={preview?preview.forecast.dailyBalances:option.forecast.dailyBalances} compare={decision.baseline.dailyBalances} buffer={buffer} />
        <p className="small muted">Solid: selected scenario · dashed: without this purchase · visible chart: 45 days.</p>

        {preview?<div className="timing-preview-banner"><p>Previewing a purchase on {fmtDate(preview.purchaseDate)}. This does not schedule an order.</p><button onClick={()=>setAfterIncome(false)}>Return to current checkout</button></div>:selected === "wait" ? <p>No checkout is started. You can revisit the purchase after your finances change.</p> : <>{decision.productId==="aero-14" && selected!=="cheaper" && !paid && <MerchantCheckoutLink key={decision.id} decisionId={decision.id}/>}<details className="shop-checkout-details"><summary>Checkout here with PayPal</summary><Checkout key={`${decision.id}:${selected}`} decisionId={decision.id} method={selected} price={option.price} onComplete={() => setPaid(true)} /></details></>}
      </div>}
    </div>}
    <ContextCopilot decisionId={decision?.id} page="Purchase decision" source="Existing decision assessment" questions={[
      {id:"afford",label:"Can I afford this purchase?",answer:decision?<p>{decision.explanation?.text || "No explanation was returned."} This assessment uses fictional finances and is not lending approval.</p>:<p>Choose a product and explore its purchase impact first. The existing engine will compare its payment scenarios.</p>},
      {id:"delay",label:"What happens if I delay buying it?",answer:decision?<p>Use the after-income comparison above for the calculated fixed-date scenario, or select wait for no purchase. Neither preview schedules an order.</p>:<p>Run a purchase assessment to compare buying now with the supported wait scenario. The assessment also calculates buying after the next expected income when that date fits inside the forecast window.</p>},
    ]}/>
  </div>;
}
