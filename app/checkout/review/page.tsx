"use client";
import ProfilePurchaseInsight from "../../components/ProfilePurchaseInsight";
import CheckoutStatus from "../../components/CheckoutStatus";
import type { PaymentStatusView } from "@/lib/paymentStatus";
import ResponsiveDetails from "../../components/ResponsiveDetails";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CaptureComparison from "@/app/components/CaptureComparison";
import TimingComparison from "@/app/components/TimingComparison";
import PurchaseConclusion from "@/app/components/PurchaseConclusion";
import type { CaptureComparison as SavedComparison } from "@/lib/captureComparison";
import PurchaseImpact from "@/app/components/PurchaseImpact";
import CashFlowExplorer from "@/app/components/CashFlowExplorer";
import ReviewInsights from "@/app/components/ReviewInsights";
import { fmtDate, money, postJson, RiskBadge, useApi } from "@/app/components/ui";
import type { ForecastResult, MethodId } from "@/lib/types";
import { reviewFacts } from "@/lib/reviewInsights";
import type { PurchaseReview } from "@/lib/orderReview";
import type { OrderRecord } from "@/lib/store";
import Icon from "@/app/components/Icon";

type Review = {
  payment: PaymentStatusView;
  comparison: SavedComparison;
  order: OrderRecord; returnUrl?: string | null; cancelUrl?: string | null; review: PurchaseReview | null;
  forecastSnapshot: { id: string; createdAt: string; data: { forecast: ForecastResult; asOf: string } } | null;
};
function Success({ data }: { data: Review }) {
  const { order, forecastSnapshot } = data;
  const updated = order.projectionStatus === "UPDATED" && !!forecastSnapshot;
  const f = updated ? forecastSnapshot.data.forecast : null;
  return <section className="success-shell" aria-labelledby="success-title">
    <div className="success-header"><span className="success-seal"><Icon name="check" size={30} /></span><span className="badge green">{order.simulated ? "Simulation" : "Verified Sandbox capture"}</span><h1 id="success-title">{order.simulated ? "Your simulation is saved." : "Payment confirmed."}</h1><p>{order.productName} · {money(order.amount)}</p></div>
    <div className="card success-details"><div className="status-row"><span><Icon name="shield" />{order.simulated ? "Simulation status" : "PayPal payment"}</span><strong className="positive">{order.simulated ? "Recorded" : "Captured"}</strong></div>
      <div className="status-row"><span><Icon name="chart" />Cash-flow forecast</span><strong className={updated ? "positive" : "muted"}>{updated ? "Updated & saved" : "Not confirmed updated"}</strong></div>
      <div className="status-row"><span><Icon name="wallet" />Bank reconciliation</span><strong>Not connected</strong></div>
      <p className="small muted">Funding remains unconfirmed. The forecast reserves the full purchase price; it does not infer a loan schedule or bank debit.</p>
      {f && !data.comparison?.available && <div className="saved-outlook"><span className="small muted">Lowest projected cash · saved {fmtDate(forecastSnapshot!.data.asOf)}</span><div className="row between"><strong className="big">{money(f.minBalance)}</strong><RiskBadge risk={f.risk} /></div><p className="small muted">{fmtDate(f.minBalanceDate)} · {f.bufferGap < 0 ? `${money(Math.abs(f.bufferGap))} below` : `${money(f.bufferGap)} above`} your buffer.</p></div>}
      <CaptureComparison comparison={data.comparison}/>
      {order.settlementReview && <p className="warn">Settlement needs review: {order.settlementReview}</p>}
      <details><summary>Payment reference</summary><p className="small reference-id">Order: {order.orderId}<br />{order.captureId && `Capture: ${order.captureId}`}</p></details>
      <div className="success-actions">{data.returnUrl && <a className="btn primary" href={data.returnUrl}>View {order.merchant?.name || "merchant"} receipt <Icon name="arrow" size={16} /></a>}<Link className="btn" href="/">View RiskPilot dashboard</Link></div>
    </div>
  </section>;
}
function ReviewInner({id}:{id:string}) {
  const { data, error: loadError, reload } = useApi<Review>(`/api/orders/${encodeURIComponent(id || "missing")}`);
  const [selected, setSelected] = useState<MethodId>("full");
  const [busy, setBusy] = useState(false);
  const [afterIncome,setAfterIncome] = useState(false);
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
  if (data.order.status === "CAPTURED") return <Success data={data} />;
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
  const upcomingTotal = review.context.upcoming.reduce((sum, item) => sum + item.amount, 0);
  return <div className="review-workspace">
    <div className="checkout-steps" aria-label="Checkout progress"><span><i className="step-number"><Icon name="check" size={12} /></i>PayPal selection</span><i className="step-line" /><span className="current" aria-current="step"><i className="step-number">2</i>Impact review</span><i className="step-line" /><span><i className="step-number">3</i>Confirm payment</span></div>
    <header className="review-heading"><div><h1>Know the impact<br className="desktop-break" /> before you pay.</h1><p className="sub">See how this purchase fits your cash and goals.</p></div><div className="review-merchant"><span className="metric-icon"><Icon name="bag" /></span><div><strong>{data.order.merchant?.name || "RiskPilot Demo Store"}</strong><span>{data.order.productName} · {money(data.order.amount)}</span></div><span className="badge blue">{data.order.simulated ? "Simulation" : "Sandbox"}</span></div></header>
    <PurchaseConclusion compact decision={review.decision} buffer={review.buffer} disabled={busy || unknown || paid} onAfterIncome={()=>{setSelected("full");setAfterIncome(true);}} onSkip={()=>{setAfterIncome(false);setSelected("wait");}}/>
    {preview&&<p className="timing-preview-banner" role="status">Previewing a purchase on {fmtDate(preview.purchaseDate)}. Payment is unavailable in this preview; return to the current checkout to pay today.</p>}
    <ProfilePurchaseInsight orderId={id} method={option.method} timing={preview?"after_income":"now"} fallback={<ReviewInsights key={`${id}:${review.decision.inputHash}:${option.method}:${!!preview}`} compact orderId={id} inputHash={review.decision.inputHash} method={preview?"full":option.method} timing={preview?"after_income":"now"} fallback={grounded.facts.checkout_summary} />}/>
    <CheckoutStatus payment={data.payment} />
    {unknown && <p className="warn" role="status">Payment outcome is unknown. Retry confirmation on this same order to recover its status. Do not start another purchase.</p>}
    {review.inputChanged && <p className="note small">Your finances changed. This review now uses your latest goals and commitments.</p>}
    <div className="review-layout"><aside className="card confirm-card" aria-labelledby="confirm-heading">
      <div className="row between"><h2 id="confirm-heading">Your checkout</h2><Icon name="lock" size={17} /></div><p className="small muted">{data.order.merchant?.name || "RiskPilot Demo Store"}</p><div className="checkout-product"><span className="checkout-product-icon"><Icon name="bag" size={27} /></span><div><strong>{data.order.productName}</strong><span>Quantity 1 · USD</span></div></div>
      <div className="checkout-total"><span>Total</span><strong>{money(data.order.amount)}</strong></div>
      <div className="confirmation-note"><Icon name="shield" size={18} /><p>{unknown || pending || data.payment.state === "CAPTURED_UNSAVED" ? "Check or recover this same order before changing payment methods." : "Only your explicit confirmation completes payment."}</p></div>
      {preview ? <div className="skip-purchase"><p>This is a future-date forecast. No purchase is scheduled.</p><button className="primary" disabled={busy || unknown} onClick={()=>{setAfterIncome(false);setSelected("full");}}>Return to current checkout</button><a className="btn" href={data.cancelUrl || "/shop"}>Return to {data.order.merchant?"store":"Shop"}</a></div> : selected === "wait" ? <div className="skip-purchase"><p>You&apos;re comparing the no-purchase baseline.</p><a className="btn primary" href={data.cancelUrl || "/shop"}>Skip and return to {data.order.merchant ? "store" : "Shop"}</a></div> : <button className="primary confirm-pay" disabled={busy || paid} onClick={paymentBlocked ? reload : makePayment}>{busy ? "Confirming…" : paymentBlocked ? "Check payment status" : data.payment.state === "CAPTURED_UNSAVED" ? "Recover confirmed payment" : unknown ? "Recover this payment" : data.order.simulated ? "Confirm simulation" : "Confirm and pay"}{!busy && <Icon name="arrow" size={16} />}</button>}
      {data.order.approvalUrl && <button className="change-method" disabled={busy || unknown || pending || data.payment.state === "CAPTURED_UNSAVED" || paid} onClick={() => window.location.assign(data.order.approvalUrl!)}>Change method in PayPal</button>}
      <button className="text-action" disabled={busy} onClick={reload}>Refresh financial impact</button>
      <p className="small muted confirmation-disclaimer">Forecast comparisons don&apos;t change your PayPal selection. Funding and loan terms remain unconfirmed.</p>
      <p className="security-line"><Icon name="lock" size={12} />Sandbox · No real money moves</p>
      {error && <p className="error" role="alert">{error}</p>}
      <a className="cancel-checkout" href={data.cancelUrl || "/shop"}>Cancel and return to {data.order.merchant ? "store" : "Shop"}</a>
    </aside><div className="review-main"><ResponsiveDetails className="review-forecast-details"><summary>Detailed amounts & commitments</summary>    <div className="review-overview">
      <div><span className="data-kind">Merchant quote</span><span>Purchase amount</span><strong>{money(data.order.amount)}</strong><small>Full order · USD</small></div>
      <div><span className="data-kind">Predicted</span><span>Lowest projected cash</span><strong>{money(displayedForecast.minBalance)}</strong><small>{fmtDate(displayedForecast.minBalanceDate)} <RiskBadge risk={displayedForecast.risk} /></small></div>
      <div><span className="data-kind">Scheduled · demo inputs</span><span>Upcoming commitments</span><strong>{money(upcomingTotal)}</strong><small>{review.context.upcoming.length} bills & reserves · next 45 days</small></div>
      <div><span className="data-kind">Predicted</span><span>Savings goal impact</span><strong>{delays.length ? `${delays.length} delayed` : "No extra delay"}</strong><small>Versus skipping this purchase</small></div>
    </div>
</ResponsiveDetails>
      <ResponsiveDetails className="review-timing-details" expanded={!!preview}><summary>Compare buying now or after income</summary><TimingComparison currentMethod={option.method} decision={review.decision} active={!!preview} disabled={busy || unknown || paid} onChange={active=>{setSelected("full");setAfterIncome(active);}}/></ResponsiveDetails>
      {!preview&&<PurchaseImpact decision={review.decision} option={option} buffer={review.buffer} onSelect={method=>{setAfterIncome(false);setSelected(method);}} locked={busy || unknown || paid} variant="scenarios" />}
      <ResponsiveDetails className="review-forecast-details"><summary>Explore cash flow & upcoming commitments</summary><CashFlowExplorer baseline={review.decision.baseline} forecast={displayedForecast} buffer={review.buffer} upcoming={preview?[...review.context.upcoming,{...preview.payment,source:"what-if" as const}]:review.context.upcoming} label={preview?`buy on ${fmtDate(preview.purchaseDate)}`:option.label} /></ResponsiveDetails>
      <p className="small muted scenario-limit">The after-income preview assumes the same full price on a fixed future date. Other dates and lower-cost merchant quotes have not been evaluated.</p>
    </div></div>
    <div className="review-data-note"><Icon name="shield" size={15} /><span>{review.context.personaName}&apos;s fictional profile · As of {fmtDate(review.context.asOf)}. No live bank is connected. Full purchase price is reserved after capture until funding is confirmed.</span></div>
  </div>;
}
function ReviewRoute(){ const id=useSearchParams().get("order") || "";return <ReviewInner key={id} id={id}/>; }
export default function CheckoutReview() { return <Suspense fallback={<p role="status">Loading purchase overview…</p>}><ReviewRoute /></Suspense>; }
