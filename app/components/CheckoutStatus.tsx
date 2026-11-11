import type { PaymentStatusView } from "@/lib/paymentStatus";

export default function CheckoutStatus({ payment }: { payment: PaymentStatusView }) {
  return <div className="note small" aria-label="Payment and forecast status" role="status">
    <strong>{payment.label}</strong>
    <p>Forecast: {payment.forecast}. Bank: {payment.bank}.</p>
    {payment.lookupFailed && <p>Provider lookup is unavailable. The outcome is unconfirmed; check this same order again.</p>}
    {payment.state === "CAPTURED_UNSAVED" && <p>The provider reports a completed capture, but the local forecast has not been saved. Recover this payment on the same order.</p>}
    {payment.state === "PENDING" && <p>Do not start another purchase while this capture is pending. Refresh to check its status.</p>}
  </div>;
}
