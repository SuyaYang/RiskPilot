"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
function ReturnInner() {
  const params = useSearchParams(), router = useRouter();
  const cancelled = params.get("cancelled") === "1", token = params.get("token");
  useEffect(() => {
    // Returning from PayPal never starts capture. The buyer must review and explicitly confirm.
    if (token && !cancelled) router.replace(`/checkout/review?order=${encodeURIComponent(token)}`);
  }, [token, cancelled, router]);
  return <div className="card stack"><h1>{cancelled ? "Checkout cancelled" : "Review before payment"}</h1>
    <p>{cancelled ? "Check this order before deciding whether to continue." : "Returning to your purchase impact overview. Payment is completed only after your final confirmation."}</p>
    {token && <a className="btn primary" href={`/checkout/review?order=${encodeURIComponent(token)}`}>Review this order</a>}
    <a href="/shop">Back to Shop</a></div>;
}
export default function CheckoutReturn() { return <Suspense fallback={<p>Loading…</p>}><ReturnInner /></Suspense>; }
