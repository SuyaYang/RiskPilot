"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PurchaseImpact from "@/app/components/PurchaseImpact";
import CashFlowExplorer from "@/app/components/CashFlowExplorer";
import ReviewInsights from "@/app/components/ReviewInsights";
import { fmtDate, money, postJson, RiskBadge, useApi } from "@/app/components/ui";
import type { ForecastResult, MethodId } from "@/lib/types";
import type { PurchaseReview } from "@/lib/orderReview";
import type { OrderRecord } from "@/lib/store";
import Icon from "@/app/components/Icon";

type Review = {
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
      {f && <div className="saved-outlook"><span className="small muted">Lowest projected cash · saved {fmtDate(forecastSnapshot!.data.asOf)}</span><div className="row between"><strong className="big">{money(f.minBalance)}</strong><RiskBadge risk={f.risk} /></div><p className="small muted">{fmtDate(f.minBalanceDate)} · {f.bufferGap < 0 ? `${money(Math.abs(f.bufferGap))} below` : `${money(f.bufferGap)} above`} your buffer.</p></div>}
      {order.settlementReview && <p className="warn">Settlement needs review: {order.settlementReview}</p>}
      <details><summary>Payment reference</summary><p className="small reference-id">Order: {order.orderId}<br />{order.captureId && `Capture: ${order.captureId}`}</p></details>
      <div className="success-actions">{data.returnUrl && <a className="btn primary" href={data.returnUrl}>View {order.merchant?.name || "merchant"} receipt <Icon name="arrow" size={16} /></a>}<Link className="btn" href="/">View RiskPilot dashboard</Link></div>
    </div>
  </section>;
}
function ReviewInner() {
  const params = useSearchParams();
  const id = params.get("order") || "";
  const { data, error: loadError, reload } = useApi<Review>(`/api/orders/${encodeURIComponent(id || "missing")}`);
  const [selected, setSelected] = useState<MethodId>("full");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  async function makePayment() {
    if (!data?.review || busy || paid || selected === "wait") return;
    setBusy(true); setError("");
    try {
      const result = await postJson(`/api/orders/${encodeURIComponent(id)}/${data.order.simulated ? "simulate" : "capture"}`, {
        reviewConfirmed: true, inputHash: data.review.decision.inputHash,
      });
      if (result.status !== "CAPTURED") throw new Error("Payment is not confirmed. Check this same order before starting another.");
      setPaid(true); window.dispatchEvent(new Event("rp:refresh")); reload();
    } catch (e) { setError((e as Error).message); reload(); } finally { setBusy(false); }
  }
  if (loadError) return <div className="card stack"><h1>Review unavailable</h1><p className="error">{loadError}</p><button onClick={reload}>Check this order again</button><p className="small muted">Keep this order to recover its status before starting another purchase.</p></div>;
  if (!data) return <div className="review-loading" role="status"><span className="loading-orbit" /><h2>Preparing your purchase review</h2><p className="muted">Checking your current cash, commitments and goals.</p></div>;
  if (data.order.status === "CAPTURED") return <Success data={data} />;
  const review = data.review;
  if (!review) return <p className="error">Purchase overview is unavailable. No new payment has been requested.</p>;
  const option = review.decision.options.find(o => o.method === selected) || review.decision.options.find(o => o.method === "full")!;
  const delays = option.goalImpact.filter(goal => goal.delayDays > 0);
  const unknown = data.order.status === "UNKNOWN";
  const upcomingTotal = review.context.upcoming.reduce((sum, item) => sum + item.amount, 0);
  return <div className="review-workspace">
    <div className="checkout-steps" aria-label="Checkout progress"><span><i className="step-number"><Icon name="check" size={12} /></i>PayPal selection</span><i className="step-line" /><span className="current" aria-current="step"><i className="step-number">2</i>Impact review</span><i className="step-line" /><span><i className="step-number">3</i>Confirm payment</span></div>
    <header className="review-heading"><div><h1>Know the impact<br className="desktop-break" /> before you pay.</h1><p className="sub">See how this purchase fits your cash and goals.</p></div><div className="review-merchant"><span className="metric-icon"><Icon name="bag" /></span><div><strong>{data.order.merchant?.name || "RiskPilot Demo Store"}</strong><span>{data.order.productName} · {money(data.order.amount)}</span></div><span className="badge blue">{data.order.simulated ? "Simulation" : "Sandbox"}</span></div></header>
    {review.decision.recommendedMethod === "wait" && !unknown && <section className="defer-recommendation" aria-label="Purchase recommendation"><div className="row"><Icon name="shield"/><strong>The engine suggests waiting.</strong></div><p>None of the evaluated purchase scenarios protects your cash buffer in both the regular and late-income checks. Compare skipping this purchase before deciding.</p><div className="row"><button disabled={busy || paid} onClick={()=>setSelected("wait")}>Compare skipping this purchase</button><a className="btn" href={data.cancelUrl || "/shop"}>Don&apos;t buy now · Return to {data.order.merchant?"store":"Shop"}</a></div></section>}
    {unknown && <p className="warn" role="status">Payment outcome is unknown. Retry confirmation on this same order to recover its status. Do not start another purchase.</p>}
    {review.inputChanged && <p className="note small">Your finances changed. This review now uses your latest goals and commitments.</p>}
    <div className="review-overview">
      <div><span className="data-kind">Merchant quote</span><span>Purchase amount</span><strong>{money(data.order.amount)}</strong><small>Full order · USD</small></div>
      <div><span className="data-kind">Predicted</span><span>Lowest projected cash</span><strong>{money(option.forecast.minBalance)}</strong><small>{fmtDate(option.forecast.minBalanceDate)} <RiskBadge risk={option.forecast.risk} /></small></div>
      <div><span className="data-kind">Scheduled · demo inputs</span><span>Upcoming commitments</span><strong>{money(upcomingTotal)}</strong><small>{review.context.upcoming.length} bills & reserves · next 45 days</small></div>
      <div><span className="data-kind">Predicted</span><span>Savings goal impact</span><strong>{delays.length ? `${delays.length} delayed` : "No extra delay"}</strong><small>Versus skipping this purchase</small></div>
    </div>
    <div className="review-layout"><div className="review-main">
      <CashFlowExplorer baseline={review.decision.baseline} forecast={option.forecast} buffer={review.buffer} upcoming={review.context.upcoming} label={option.label} />
      <ReviewInsights key={`${id}:${review.decision.inputHash}:${option.method}`} orderId={id} inputHash={review.decision.inputHash} method={option.method} />
      <PurchaseImpact decision={review.decision} option={option} buffer={review.buffer} onSelect={setSelected} locked={busy || unknown || paid} variant="scenarios" />
      <p className="small muted scenario-limit">Buying next month and a lower-cost merchant quote haven&apos;t been evaluated. “Skip this purchase” is a no-purchase comparison.</p>
    </div><aside className="card confirm-card" aria-labelledby="confirm-heading">
      <div className="row between"><h2 id="confirm-heading">Your checkout</h2><Icon name="lock" size={17} /></div><p className="small muted">{data.order.merchant?.name || "RiskPilot Demo Store"}</p><div className="checkout-product"><span className="checkout-product-icon"><Icon name="bag" size={27} /></span><div><strong>{data.order.productName}</strong><span>Quantity 1 · USD</span></div></div>
      <div className="checkout-total"><span>Total</span><strong>{money(data.order.amount)}</strong></div>
      <div className="confirmation-note"><Icon name="shield" size={18} /><p>{unknown ? "Recover this order before changing payment methods." : "Only your explicit confirmation completes payment."}</p></div>
      {selected === "wait" ? <div className="skip-purchase"><p>You&apos;re comparing the no-purchase baseline.</p><a className="btn primary" href={data.cancelUrl || "/shop"}>Skip and return to {data.order.merchant ? "store" : "Shop"}</a></div> : <button className="primary confirm-pay" disabled={busy || paid} onClick={makePayment}>{busy ? "Confirming…" : unknown ? "Recover this payment" : data.order.simulated ? "Confirm simulation" : "Confirm and pay"}{!busy && <Icon name="arrow" size={16} />}</button>}
      {data.order.approvalUrl && <button className="change-method" disabled={busy || unknown || paid} onClick={() => window.location.assign(data.order.approvalUrl!)}>Change method in PayPal</button>}
      <button className="text-action" disabled={busy} onClick={reload}>Refresh financial impact</button>
      <p className="small muted confirmation-disclaimer">Forecast comparisons don&apos;t change your PayPal selection. Funding and loan terms remain unconfirmed.</p>
      <p className="security-line"><Icon name="lock" size={12} />Sandbox · No real money moves</p>
      {error && <p className="error" role="alert">{error}</p>}
      <a className="cancel-checkout" href={data.cancelUrl || "/shop"}>Cancel and return to {data.order.merchant ? "store" : "Shop"}</a>
    </aside></div>
    <div className="review-data-note"><Icon name="shield" size={15} /><span>{review.context.personaName}&apos;s fictional profile · As of {fmtDate(review.context.asOf)}. No live bank is connected. Full purchase price is reserved after capture until funding is confirmed.</span></div>
  </div>;
}
export default function CheckoutReview() { return <Suspense fallback={<p role="status">Loading purchase overview…</p>}><ReviewInner /></Suspense>; }
