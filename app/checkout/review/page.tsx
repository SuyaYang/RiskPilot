"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import PurchaseImpact from "@/app/components/PurchaseImpact";
import { money, postJson, useApi } from "@/app/components/ui";
import type { Decision, MethodId } from "@/lib/types";

type Review = { order: { orderId: string; productName: string; amount: number; status: string; simulated?: boolean; projectionStatus?: string; approvalUrl?: string; merchant?: { name: string } }; returnUrl?: string | null; cancelUrl?: string | null; review: { decision: Decision; buffer: number; inputChanged: boolean } | null };
function ReviewInner() {
  const params = useSearchParams();
  const id = params.get("order") || "";
  const { data, error: loadError, reload } = useApi<Review>(`/api/orders/${encodeURIComponent(id || "missing")}`);
  const [selected, setSelected] = useState<MethodId>("full");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  async function makePayment() {
    if (!data?.review || busy || paid) return;
    setBusy(true); setError("");
    try {
      const result = await postJson(`/api/orders/${encodeURIComponent(id)}/${data.order.simulated ? "simulate" : "capture"}`, {
        reviewConfirmed: true, inputHash: data.review.decision.inputHash,
      });
      if (result.status !== "CAPTURED") throw new Error("Payment is not confirmed. Check this same order before starting another.");
      if (data.order.merchant && result.returnUrl) { window.location.assign(result.returnUrl); return; }
      setPaid(true); window.dispatchEvent(new Event("rp:refresh")); reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (loadError) return <div className="card stack"><h1>Checkout review unavailable</h1><p className="error">{loadError}</p><a href="/shop">Back to Shop</a></div>;
  if (!data) return <p role="status">Preparing your purchase overview…</p>;
  if (paid || data.order.status === "CAPTURED") return <div className="card stack"><h1>{data.order.simulated ? "Simulation recorded" : "Payment confirmed"}</h1><p>A versioned forecast was saved with this purchase.</p>{data.returnUrl && <a className="btn primary" href={data.returnUrl}>Return to {data.order.merchant?.name}</a>}<a className="btn" href="/">View updated dashboard</a></div>;
  const review = data.review;
  if (!review) return <p className="error">Purchase overview is unavailable. No new payment has been requested.</p>;
  const option = review.decision.options.find(o => o.method === selected)!;
  return <div className="checkout-shell stack">
    <div className="row between"><div><span className="eyebrow">FINAL REVIEW</span><h1>Review before you pay</h1></div><span className="badge blue">{data.order.simulated ? "Simulation" : "PayPal Sandbox"}</span></div>
    <p className="sub">{data.order.status === "UNKNOWN" ? "Payment status is unconfirmed. Use this same order to recover before starting another purchase." : data.order.merchant ? `${data.order.merchant.name} → PayPal approved → impact review → confirm payment. You have not been charged yet.` : "Check the effect on your plan, then decide whether to complete this purchase."}</p>
    <PurchaseImpact decision={review.decision} option={option} buffer={review.buffer} onSelect={setSelected} locked={busy} />
    <div className="card stack">
      <div className="row between"><h2>{data.order.productName}</h2><strong className="big">{money(data.order.amount)}</strong></div>
      <p className="small muted">The scenarios above are estimates. The method and loan terms selected in PayPal have not been confirmed to RiskPilot. After payment, we conservatively reserve the full product price until funding is confirmed.</p>
      {review.inputChanged && <p className="note small">This overview has been recalculated using your current goals and commitments.</p>}
      <div className="payment-actions">
        <button className="primary" disabled={busy} onClick={makePayment}>{busy ? "Confirming payment…" : `${data.order.simulated ? "Make simulated payment" : data.order.merchant ? "Confirm and pay" : "Make payment"} · ${money(data.order.amount)}`}</button>
        {data.order.approvalUrl && <button disabled={busy || data.order.status === "UNKNOWN"} onClick={() => window.location.assign(data.order.approvalUrl!)}>Change payment method in PayPal</button>}
        <button disabled={busy} onClick={reload}>Refresh impact</button>
      </div>
      {data.order.approvalUrl && <p className="small muted">To change the actual payment method, return to PayPal and select Continue / Review Order again. You will come back here before the final payment. The scenario buttons above change only this forecast.</p>}
      {data.order.merchant && <p className="small muted">Your confirmation asks {data.order.merchant.name} to capture this PayPal order. You will return to the store after payment is verified.</p>}
      <p className="small muted">Approval or a return link alone does not complete payment. This action asks the server to verify the order and capture it once.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><a href={data.cancelUrl || "/shop"}>{data.order.merchant ? `Cancel and return to ${data.order.merchant.name}` : "Back to Shop"}</a></div>
    </div>
  </div>;
}
export default function CheckoutReview() { return <Suspense fallback={<p>Loading purchase overview…</p>}><ReviewInner /></Suspense>; }
