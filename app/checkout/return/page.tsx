"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { postJson } from "@/app/components/ui";
function ReturnInner() {
  const q = useSearchParams();
  const cancelled = q.get("cancelled") === "1";
  const token = q.get("token");
  const [status, setStatus] = useState("Checking payment…");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function check() {
    if (!token) { setStatus("Order reference missing"); return; }
    setBusy(true); setError("");
    try {
      // The token is only a reference. The server checks workspace ownership and PayPal facts.
      if (cancelled) {
        const r = await fetch(`/api/orders/${encodeURIComponent(token)}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Order not found");
        setStatus(j.order.status === "CAPTURED" ? "Payment confirmed" : "Checkout cancelled · payment unconfirmed");
      } else {
        const j = await postJson(`/api/orders/${encodeURIComponent(token)}/capture`, {});
        setStatus(j.status === "CAPTURED" ? "Payment confirmed · forecast saved" : "Payment unconfirmed");
      }
    } catch (e) { setStatus("Payment unconfirmed"); setError((e as Error).message); }
    finally { setBusy(false); }
  }
  useEffect(() => { void check(); /* Idempotent on remount and refresh. */ }, [token, cancelled]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="card stack">
    <h1>{status}</h1>
    <p className="sub">Approval and cancellation redirects do not prove payment. Only verified PayPal confirmation changes the forecast.</p>
    <p className="small muted">Order {token || "not provided"}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {token && <button disabled={busy} onClick={check}>Check this order again</button>}
    <a className="btn primary" href="/">Back to dashboard</a>
  </div>;
}
export default function CheckoutReturn() { return <Suspense fallback={<p>Loading…</p>}><ReturnInner /></Suspense>; }
