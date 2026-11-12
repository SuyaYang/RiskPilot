"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { OrderRecord } from "@/lib/store";
import type { PurchaseReview } from "@/lib/orderReview";
import { postJson } from "@/app/components/ui";
function ReturnInner() {
  const params = useSearchParams(), router = useRouter();
  const cancelled = params.get("cancelled") === "1", token = params.get("token");
  const [error,setError] = useState("");
  useEffect(() => {
    if (!token || cancelled) return;
    let active = true;
    async function finish() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(token!)}`);
        const data = await response.json() as {order:OrderRecord;review:PurchaseReview|null;error?:string};
        if (!response.ok) throw new Error(data.error || "Cannot check this order.");
        if (!active) return;
        // Only new Shop PAY_NOW orders use PayPal as final confirmation. Merchant and legacy
        // CONTINUE orders always retain their explicit RiskPilot pre-capture review.
        if (data.order.shopPayNow && !data.order.merchant && data.order.status !== "CAPTURED") {
          if (!data.review || data.review.recheck.status !== "unchanged") throw new Error("Your assessment changed. Review the latest impact before paying.");
          await postJson(`/api/orders/${encodeURIComponent(token!)}/capture`, {reviewConfirmed:true,checkoutSource:"shop",inputHash:data.review.decision.inputHash});
        }
        if (active) router.replace(`/checkout/review?order=${encodeURIComponent(token!)}`);
      } catch (error) { if (active) setError((error as Error).message); }
    }
    void finish();
    return () => { active = false; };
  }, [token, cancelled, router]);
  return <div className="card stack"><h1>{cancelled ? "Checkout cancelled" : "Checking your checkout"}</h1>
    <p>{cancelled ? "No new payment is submitted. Check this order before deciding whether to continue." : "Verifying your PayPal confirmation and payment result."}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {token && <a className="btn primary" href={`/checkout/review?order=${encodeURIComponent(token)}`}>Check or recover this order</a>}
    <a href="/shop">Back to Shop</a></div>;
}
export default function CheckoutReturn() { return <Suspense fallback={<p>Loading…</p>}><ReturnInner /></Suspense>; }
