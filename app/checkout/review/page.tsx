"use client";
import SmartRecheckSummary from "../../components/SmartRecheckSummary";
import ProfilePurchaseInsight from "../../components/ProfilePurchaseInsight";
import CheckoutStatus from "../../components/CheckoutStatus";
import CheckoutVerification from "../../components/CheckoutVerification";
import CheckoutSuccess, {type CheckoutSuccessData} from "../../components/CheckoutSuccess";
import type { PaymentStatusView } from "@/lib/paymentStatus";
import ResponsiveDetails from "../../components/ResponsiveDetails";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TimingComparison from "@/app/components/TimingComparison";
import PurchaseConclusion from "@/app/components/PurchaseConclusion";
import PurchaseImpact from "@/app/components/PurchaseImpact";
import CashFlowExplorer from "@/app/components/CashFlowExplorer";
import ReviewInsights from "@/app/components/ReviewInsights";
import { fmtDate, money, postJson, RiskBadge, useApi } from "@/app/components/ui";
import type { MethodId } from "@/lib/types";
import { reviewFacts } from "@/lib/reviewInsights";
import type { PurchaseReview } from "@/lib/orderReview";
import type { OrderRecord } from "@/lib/store";
import Icon from "@/app/components/Icon";

type Review = CheckoutSuccessData & {
  payment: PaymentStatusView;
  cancelUrl?: string | null; review: PurchaseReview | null;
};
function ReviewInner({id}:{id:string}) {
  const { data, error: loadError, reload } = useApi<Review>(`/api/orders/${encodeURIComponent(id || "missing")}`);
  const [selected, setSelected] = useState<MethodId>("full");
  const [busy, setBusy] = useState(false);
  const [afterIncome,setAfterIncome] = useState(false);
  const [analysisExpanded,setAnalysisExpanded] = useState(false);
  const paymentLock=useRef(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  async function makePayment() {
    if (!data?.review || busy || paymentLock.current || paid || selected === "wait" || afterIncome) return;
    paymentLock.current=true;
    setBusy(true); setError("");
    try {
      const result = await postJson(`/api/orders/${encodeURIComponent(id)}/${data.order.simulated ? "simulate" : "capture"}`, {
        timing:"now", reviewConfirmed: true, inputHash: data.review.decision.inputHash,
      });
      if (result.status !== "CAPTURED") throw new Error("Payment is not confirmed. Check this same order before starting another.");
      setPaid(true); window.dispatchEvent(new Event("rp:refresh")); reload();
    } catch (e) { setError((e as Error).message); reload(); } finally { paymentLock.current=false; setBusy(false); }
  }
  if (loadError) return <div className="card stack"><h1>Review unavailable</h1><p className="error">{loadError}</p><button onClick={reload}>Check this order again</button><p className="small muted">Keep this order to recover its status before starting another purchase.</p></div>;
  if (!data) return <div className="review-loading" role="status"><span className="loading-orbit" /><h2>Preparing your purchase review</h2><p className="muted">Checking your current cash, commitments and goals.</p></div>;
  if (data.order.status === "CAPTURED") return <CheckoutSuccess data={data} />;
  const review = data.review;
  if (!review) return <p className="error">Purchase overview is unavailable. No new payment has been requested.</p>;
  const option = review.decision.options.find(o => o.method === selected) || review.decision.options.find(o => o.method === "full")!;
  const timing=review.decision.afterIncome;
  const preview=afterIncome&&timing?.available?timing:null;
  const displayedForecast=preview?.forecast||option.forecast;
  const displayedImpact=preview?.goalImpact||option.goalImpact;
  const delays = displayedImpact.filter(goal => goal.delayDays > 0);
  const unknown = data.payment.state === "UNKNOWN";
  const pending = data.payment.state === "PENDING";
  const paymentBlocked = ["PENDING", "FAILED", "CREATED"].includes(data.payment.state) && !data.order.simulated;
  const grounded=reviewFacts(review,preview?"full":option.method,"overview",preview?"after_income":"now");
  const conciseExplanation = <ReviewInsights key={`${id}:${review.decision.inputHash}:${option.method}:${!!preview}`} compact orderId={id} inputHash={review.decision.inputHash} method={preview?"full":option.method} timing={preview?"after_income":"now"} fallback={grounded.facts.checkout_summary} />;
  const aiInsight = <ProfilePurchaseInsight orderId={id} method={option.method} timing={preview?"after_income":"now"} fallback={conciseExplanation}/>;
  const upcomingTotal = review.context.upcoming.reduce((sum, item) => sum + item.amount, 0);
  return <div className="review-workspace">
    <div className="checkout-steps" aria-label="Checkout progress"><span><i className="step-number"><Icon name="check" size={12} /></i>PayPal selection</span><i className="step-line" /><span className="current" aria-current="step"><i className="step-number">2</i>Impact review</span><i className="step-line" /><span><i className="step-number">3</i>Confirm payment</span></div>
    <header className="review-heading"><div><h1>Review before you pay.</h1><p className="sub">See how this purchase fits your cash and goals.</p></div><div className="review-merchant"><span className="metric-icon"><Icon name="bag" /></span><div><strong>{data.order.merchant?.name || "RiskPilot Demo Store"}</strong><span>{data.order.productName} · {money(data.order.amount)}</span></div><span className="badge blue">{data.order.simulated ? "Simulation" : "Sandbox"}</span></div></header>
    <CheckoutVerification payment={data.payment} order={data.order}/>
    <SmartRecheckSummary recheck={review.recheck}/>
    <PurchaseConclusion compact decision={review.decision} buffer={review.buffer} disabled={busy || unknown || paid} onAfterIncome={()=>{setSelected("full");setAfterIncome(true);}} onSkip={()=>{setAfterIncome(false);setSelected("wait");}}/>
    {preview&&<p className="timing-preview-banner" role="status">Previewing a purchase on {fmtDate(preview.purchaseDate)}. Payment is unavailable in this preview; return to the current checkout to pay today.</p>}
    {review.recheck.status!=="unchanged" && aiInsight}
    <CheckoutStatus payment={data.payment} />
    {unknown && <p className="warn" role="status">Payment outcome is unknown. Retry confirmation on this same order to recover its status. Do not start another purchase.</p>}
    {review.inputChanged && <p className="note small">Your finances changed. This review now uses your latest goals and commitments.</p>}
    <div className="review-layout"><aside className="card confirm-card" aria-labelledby="confirm-heading">
      <div className="checkout-order"><div className="row between"><h2 id="confirm-heading">Your checkout</h2><Icon name="lock" size={17} /></div><p className="small muted">{data.order.merchant?.name || "RiskPilot Demo Store"}</p><div className="checkout-product"><span className="checkout-product-icon"><Icon name="bag" size={27} /></span><div><strong>{data.order.productName}</strong><span>Quantity 1 · USD</span></div></div>
      <div className="checkout-total"><span>Total</span><strong>{money(data.order.amount)}</strong></div>
      </div><div className="checkout-payment"><div className="confirmation-note"><Icon name="shield" size={18} /><p>{unknown || pending || data.payment.state === "CAPTURED_UNSAVED" ? "Check or recover this same order before changing payment methods." : "Only your explicit confirmation completes payment."}</p></div>
      {preview ? <div className="skip-purchase"><p>This is a future-date forecast. No purchase is scheduled.</p><button className="primary" disabled={busy || unknown} onClick={()=>{setAfterIncome(false);setSelected("full");}}>Return to current checkout</button><a className="btn" href={data.cancelUrl || "/shop"}>Return to {data.order.merchant?"store":"Shop"}</a></div> : selected === "wait" ? <div className="skip-purchase"><p>No payment will be captured. Continue to your RiskPilot dashboard.</p><Link className="btn primary" href="/">Skip and enter RiskPilot</Link></div> : <button className="primary confirm-pay" disabled={busy || paid} onClick={paymentBlocked ? reload : makePayment}>{busy ? "Confirming…" : paymentBlocked ? "Check payment status" : data.payment.state === "CAPTURED_UNSAVED" ? "Recover confirmed payment" : unknown ? "Recover this payment" : data.order.simulated ? "Confirm simulation" : "Confirm and pay"}{!busy && <Icon name="arrow" size={16} />}</button>}
      {data.order.approvalUrl && <button className="change-method" disabled={busy || unknown || pending || data.payment.state === "CAPTURED_UNSAVED" || paid} onClick={() => window.location.assign(data.order.approvalUrl!)}>Change method in PayPal</button>}
      <button className="text-action" disabled={busy} onClick={reload}>Refresh financial impact</button>
      </div><div className="checkout-footnotes"><p className="small muted confirmation-disclaimer">Forecast comparisons don&apos;t change your PayPal selection. Funding and loan terms remain unconfirmed.</p>
      <p className="security-line"><Icon name="lock" size={12} />Sandbox · No real money moves</p>
      {error && <p className="error" role="alert">{error}</p>}
      <a className="cancel-checkout" href={data.cancelUrl || "/shop"}>Cancel and back to {data.order.merchant ? "store" : "Shop"}</a>
    </div></aside><details className="review-analysis" key={`${id}:${review.decision.inputHash}:${review.recheck.status}`} open={analysisExpanded}><summary onClick={event=>{event.preventDefault();setAnalysisExpanded(expanded=>!expanded);}}>{review.recheck.status==="unchanged" ? "View reviewed analysis" : "Explore full financial analysis"}</summary><div className="review-main">{review.recheck.status==="unchanged" && aiInsight}<ResponsiveDetails startCollapsed className="review-forecast-details"><summary>Detailed amounts & commitments</summary>    <div className="review-overview">
      <div><span className="data-kind">Merchant quote</span><span>Purchase amount</span><strong>{money(data.order.amount)}</strong><small>Full order · USD</small></div>
      <div><span className="data-kind">Predicted</span><span>Lowest projected cash</span><strong>{money(displayedForecast.minBalance)}</strong><small>{fmtDate(displayedForecast.minBalanceDate)} <RiskBadge risk={displayedForecast.risk} /></small></div>
      <div><span className="data-kind">Scheduled · demo inputs</span><span>Upcoming commitments</span><strong>{money(upcomingTotal)}</strong><small>{review.context.upcoming.length} bills & reserves · next 45 days</small></div>
      <div><span className="data-kind">Predicted</span><span>Savings goal impact</span><strong>{delays.length ? `${delays.length} delayed` : "No extra delay"}</strong><small>Versus skipping this purchase</small></div>
    </div>
</ResponsiveDetails>
      <ResponsiveDetails startCollapsed className="review-timing-details" expanded={!!preview}><summary>Compare buying now or after income</summary><TimingComparison currentMethod={option.method} decision={review.decision} active={!!preview} disabled={busy || unknown || paid} onChange={active=>{setSelected("full");setAfterIncome(active);}}/></ResponsiveDetails>
      {!preview&&<PurchaseImpact decision={review.decision} option={option} buffer={review.buffer} onSelect={method=>{setAfterIncome(false);setSelected(method);}} locked={busy || unknown || paid} variant="scenarios" />}
      <ResponsiveDetails startCollapsed className="review-forecast-details"><summary>Explore cash flow & upcoming commitments</summary><CashFlowExplorer baseline={review.decision.baseline} forecast={displayedForecast} buffer={review.buffer} upcoming={preview?[...review.context.upcoming,{...preview.payment,source:"what-if" as const}]:review.context.upcoming} label={preview?`buy on ${fmtDate(preview.purchaseDate)}`:option.label} /></ResponsiveDetails>
      <p className="small muted scenario-limit">The after-income preview assumes the same full price on a fixed future date. Other dates and lower-cost merchant quotes have not been evaluated.</p>
    </div></details></div>
    <div className="review-data-note"><Icon name="shield" size={15} /><span>{review.context.personaName}&apos;s fictional profile · As of {fmtDate(review.context.asOf)}. No live bank is connected. Full purchase price is reserved after capture until funding is confirmed.</span></div>
  </div>;
}
function ReviewRoute(){ const id=useSearchParams().get("order") || "";return <ReviewInner key={id} id={id}/>; }
export default function CheckoutReview() { return <Suspense fallback={<p role="status">Loading purchase overview…</p>}><ReviewRoute /></Suspense>; }
