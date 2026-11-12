"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { postJson, useApi } from "./ui";
import type { MethodId } from "@/lib/types";

type Session = { start: (opts: { presentationMode: "auto" }, order: Promise<{ orderId: string }>) => Promise<void> };
type Callbacks = { commit: true; onApprove: (data: { orderId: string }) => Promise<void>; onCancel: () => void; onError: () => void };
type SDK = {
  findEligibleMethods: (opts: { currencyCode: "USD"; amount: string }) => Promise<{ isEligible: (method: string) => boolean; getDetails: (method: string) => { productCode?: string; countryCode?: string } }>;
  createPayPalOneTimePaymentSession: (options: Callbacks) => Session;
};
declare global { interface Window { paypal?: { createInstance: (options: { clientId: string; components: string[]; pageType: string }) => Promise<SDK> } } }

export default function Checkout({ decisionId, method, price, inputHash, onComplete }: { decisionId: string; method: MethodId; price: number; inputHash: string; onComplete: () => void }) {
  const { data: config, error: configError } = useApi<{ paypal: boolean; paypalClientId: string; simulation: boolean }>("/api/config");
  const [loaded, setLoaded] = useState(false);
  const [sdk, setSdk] = useState<SDK | null>(null);
  const [eligibility, setEligibility] = useState<{ paypal: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [captured, setCaptured] = useState<"simulation" | "paypal" | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (!loaded || !config?.paypalClientId || !window.paypal) return;
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) setError("PayPal eligibility could not be checked. Reload to retry."); }, 12000);
    window.paypal.createInstance({ clientId: config.paypalClientId, components: ["paypal-payments"], pageType: "checkout" })
      .then(async instance => {
        const methods = await instance.findEligibleMethods({ currencyCode: "USD", amount: price.toFixed(2) });
        if (cancelled) return;
        setSdk(instance);
        setEligibility({ paypal: methods.isEligible("paypal") });
        setError("");
      }).catch(() => { if (!cancelled) setError("PayPal could not load. Reload to retry."); })
      .finally(() => clearTimeout(timer));
    return () => { cancelled = true; clearTimeout(timer); };
  }, [loaded, config?.paypalClientId, price]);

  async function create() {
    const order = await postJson("/api/orders", { decisionId, method });
    setOrderId(order.id);
    return { orderId: order.id };
  }
  async function capture(id: string, simulated = false) {
    const out = await postJson(`/api/orders/${encodeURIComponent(id)}/${simulated ? "simulate" : "capture"}`, simulated ? {} : {reviewConfirmed:true,inputHash,checkoutSource:"shop"});
    if (out.status !== "CAPTURED") throw new Error("Payment is not confirmed. Check this order again.");
    setCaptured(simulated ? "simulation" : "paypal");
    setError("");
    onComplete();
    window.dispatchEvent(new Event("rp:refresh"));
  }
  async function start() {
    if (!sdk || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const done = () => { lock.current = false; setBusy(false); };
    const callbacks: Callbacks = {
      commit: true,
      onApprove: async ({ orderId: id }) => {
        setOrderId(id);
        try {
          // PAY_NOW / commit:true makes PayPal the final explicit confirmation for Shop.
          await capture(id);
          window.location.assign(`/checkout/review?order=${encodeURIComponent(id)}`);
        } catch (error) { setError((error as Error).message); }
        finally { done(); }
      },
      onCancel: () => { setError("Checkout cancelled. Check the order status before starting another purchase."); done(); },
      onError: () => { setError("Checkout could not be confirmed. Check this order again."); done(); },
    };
    try {
      const session = sdk.createPayPalOneTimePaymentSession(callbacks);
      await session.start({ presentationMode: "auto" }, create());
    } catch (e) { setError((e as Error).message || "Checkout failed"); done(); }
  }
  async function simulate() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { const order = await create(); await capture(order.orderId, true); }
    catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="stack">
    <p className="small muted">Confirm and pay in PayPal. If your assessment changes, payment pauses for review. Scenarios do not select a loan; funding remains unconfirmed and the forecast reserves the full price.</p>
    {config?.paypal && <Script src="https://www.sandbox.paypal.com/web-sdk/v6/core" strategy="afterInteractive" onReady={() => setLoaded(true)} onError={() => setError("PayPal could not load. Reload to retry.")} />}
    {!captured && !orderId && <>
      {config?.simulation && <div className="warn"><p>Simulation only · no PayPal payment will occur.</p><button disabled={busy} onClick={simulate}>Simulate purchase</button></div>}
      {config?.paypal && !eligibility && !error && <p role="status">Checking PayPal eligibility…</p>}
      {eligibility?.paypal && <div className="paypal-checkout-actions">
      {eligibility?.paypal && <div className="paypal-action-slot"><button className="primary" disabled={busy} onClick={() => start()}>PayPal Checkout</button></div>}
      </div>}
      {eligibility && !eligibility.paypal && <p className="warn">No eligible PayPal method is available for this checkout.</p>}
      {config && !config.paypal && !config.simulation && <p className="warn">Checkout is unavailable until PayPal Sandbox is configured.</p>}
    </>}
    {busy && <p role="status">Confirm payment in PayPal. We will verify the result and save your updated forecast.</p>}
    {orderId && !captured && <div className="note stack"><p>Order {orderId}</p><a className="btn primary" href={`/checkout/review?order=${encodeURIComponent(orderId)}`}>Check or recover this order</a></div>}
    {captured && <p className="note" role="status">{captured === "simulation" ? "Simulation recorded" : "Payment confirmed"}. A versioned forecast was saved. <a href="/">View dashboard →</a></p>}
    {(error || configError) && <p className="error" role="alert">{error || configError}</p>}
  </div>;
}
