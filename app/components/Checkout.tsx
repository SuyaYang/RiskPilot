"use client";
import Script from "next/script";
import { useEffect, useRef, useState, createElement } from "react";
import { postJson, useApi } from "./ui";
import type { MethodId } from "@/lib/types";

type Session = { start: (opts: { presentationMode: "auto" }, order: Promise<{ orderId: string }>) => Promise<void> };
type Callbacks = { onApprove: (data: { orderId: string }) => Promise<void>; onCancel: () => void; onError: () => void };
type SDK = {
  findEligibleMethods: (opts: { currencyCode: "USD"; amount: string }) => Promise<{ isEligible: (method: string) => boolean; getDetails: (method: string) => { productCode?: string; countryCode?: string } }>;
  createPayPalOneTimePaymentSession: (options: Callbacks) => Session;
  createPayLaterOneTimePaymentSession: (options: Callbacks) => Session;
};
declare global { interface Window { paypal?: { createInstance: (options: { clientId: string; components: string[]; pageType: string }) => Promise<SDK> } } }

export default function Checkout({ decisionId, method, price, onComplete }: { decisionId: string; method: MethodId; price: number; onComplete: () => void }) {
  const { data: config, error: configError } = useApi<{ paypal: boolean; paypalClientId: string; simulation: boolean }>("/api/config");
  const [loaded, setLoaded] = useState(false);
  const [sdk, setSdk] = useState<SDK | null>(null);
  const [eligibility, setEligibility] = useState<{ paypal: boolean; paylater: boolean; productCode?: string; countryCode?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [captured, setCaptured] = useState<"simulation" | "paypal" | null>(null);
  const lock = useRef(false);
  const payLaterButton = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!loaded || !config?.paypalClientId || !window.paypal) return;
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) setError("PayPal eligibility could not be checked. Reload to retry."); }, 12000);
    window.paypal.createInstance({ clientId: config.paypalClientId, components: ["paypal-payments"], pageType: "checkout" })
      .then(async instance => {
        const methods = await instance.findEligibleMethods({ currencyCode: "USD", amount: price.toFixed(2) });
        if (cancelled) return;
        const details = methods.isEligible("paylater") ? methods.getDetails("paylater") : {};
        setSdk(instance);
        setEligibility({ paypal: methods.isEligible("paypal"), paylater: methods.isEligible("paylater"), ...details });
        setError("");
      }).catch(() => { if (!cancelled) setError("PayPal could not load. Reload to retry."); })
      .finally(() => clearTimeout(timer));
    return () => { cancelled = true; clearTimeout(timer); };
  }, [loaded, config?.paypalClientId, price]);
  useEffect(() => {
    if (!payLaterButton.current || !eligibility) return;
    Object.assign(payLaterButton.current, { productCode: eligibility.productCode, countryCode: eligibility.countryCode });
  }, [eligibility]);

  async function create() {
    const order = await postJson("/api/orders", { decisionId, method });
    setOrderId(order.id);
    return { orderId: order.id };
  }
  async function capture(id: string, simulated = false) {
    const out = await postJson(`/api/orders/${encodeURIComponent(id)}/${simulated ? "simulate" : "capture"}`, {});
    if (out.status !== "CAPTURED") throw new Error("Payment is not confirmed. Check this order again.");
    setCaptured(simulated ? "simulation" : "paypal");
    setError("");
    onComplete();
    window.dispatchEvent(new Event("rp:refresh"));
  }
  async function start(paylater: boolean) {
    if (!sdk || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const done = () => { lock.current = false; setBusy(false); };
    const callbacks: Callbacks = {
      onApprove: async ({ orderId: id }) => {
        setOrderId(id);
        try { await capture(id); } catch (e) { setError((e as Error).message); } finally { done(); }
      },
      onCancel: () => { setError("Checkout cancelled. Check the order status before starting another purchase."); done(); },
      onError: () => { setError("Checkout could not be confirmed. Check this order again."); done(); },
    };
    try {
      const session = paylater ? sdk.createPayLaterOneTimePaymentSession(callbacks) : sdk.createPayPalOneTimePaymentSession(callbacks);
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
    <p className="small muted">PayPal receives the full product price. Your comparison does not select or confirm a loan. Funding remains unconfirmed after capture, so the forecast reserves the full price.</p>
    {config?.paypal && <Script src="https://www.sandbox.paypal.com/web-sdk/v6/core" strategy="afterInteractive" onReady={() => setLoaded(true)} onError={() => setError("PayPal could not load. Reload to retry.")} />}
    {!captured && !orderId && <>
      {config?.simulation && <div className="warn"><p>Simulation only · no PayPal payment will occur.</p><button disabled={busy} onClick={simulate}>Simulate purchase</button></div>}
      {config?.paypal && !eligibility && !error && <p role="status">Checking PayPal eligibility…</p>}
      {eligibility?.paypal && <button className="primary" disabled={busy} onClick={() => start(false)}>Pay with PayPal Sandbox</button>}
      {eligibility?.paylater && createElement("paypal-pay-later-button", { ref: payLaterButton, onClick: () => { if (!busy) void start(true); }, disabled: busy || undefined, "aria-label": "Pay Later with PayPal Sandbox" })}
      {eligibility && !eligibility.paypal && !eligibility.paylater && <p className="warn">No eligible PayPal method is available for this checkout.</p>}
      {config && !config.paypal && !config.simulation && <p className="warn">Checkout is unavailable until PayPal Sandbox is configured.</p>}
    </>}
    {busy && <p role="status">Complete approval in PayPal. Your forecast updates after server confirmation.</p>}
    {orderId && !captured && <div className="note stack"><p>Order {orderId}</p><button disabled={busy} onClick={async () => { setBusy(true); try { await capture(orderId, Boolean(config?.simulation)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Check this order again</button></div>}
    {captured && <p className="note" role="status">{captured === "simulation" ? "Simulation recorded" : "Payment confirmed"}. A versioned forecast was saved. <a href="/">View dashboard →</a></p>}
    {(error || configError) && <p className="error" role="alert">{error || configError}</p>}
  </div>;
}
