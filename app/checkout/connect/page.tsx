"use client";
import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { postJson } from "@/app/components/ui";
function ConnectInner() {
  const params = useSearchParams(), router = useRouter();
  const ticket = params.get("ticket");
  const [error, setError] = useState("");
  const request = useRef<{ ticket: string; promise: Promise<{ orderId: string }> } | null>(null);
  useEffect(() => {
    let active = true;
    if (!ticket) { setError("This checkout link is missing. Return to the store to reopen your review."); return; }
    if (request.current?.ticket !== ticket) request.current = { ticket, promise: postJson("/api/merchant/claim", { ticket }) };
    request.current.promise
      .then(data => { if (active) router.replace(`/checkout/review?order=${encodeURIComponent(data.orderId)}`); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [ticket, router]);
  return <div className="card stack"><h1>Preparing your purchase impact</h1>
    <p>Connecting the store&apos;s approved PayPal order to your fictional financial profile. No payment is requested here.</p>
    {error ? <><p role="alert" className="error">{error}</p><button onClick={() => window.location.reload()}>Try this checkout again</button></> : <p role="status">Verifying merchant checkout…</p>}
  </div>;
}
export default function ConnectCheckout() { return <Suspense fallback={<p>Opening checkout review…</p>}><ConnectInner /></Suspense>; }
