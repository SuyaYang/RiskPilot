"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ReturnInner() {
  const q = useSearchParams();
  const cancelled = q.get("cancelled") === "1";
  return (
    <div className="card stack">
      <h1>{cancelled ? "Payment cancelled" : "Payment approved"}</h1>
      <p className="sub">
        {cancelled
          ? "No money was taken. You can go back and choose another option."
          : "PayPal approved the payment. RiskPilot captures it on the server and then updates your forecast."}
      </p>
      <p className="small muted">Order {q.get("token")}</p>
      <a className="btn primary" href="/">Back to dashboard</a>
    </div>
  );
}

export default function CheckoutReturn() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <ReturnInner />
    </Suspense>
  );
}
