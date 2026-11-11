import type { PaymentStatusView } from "@/lib/paymentStatus";
import type { OrderRecord } from "@/lib/store";
import Icon from "./Icon";
import { money } from "./ui";

export default function CheckoutVerification({ payment, order }: { payment: PaymentStatusView; order: OrderRecord }) {
  const providerClass = payment.lookupFailed ? "verification-warning" : payment.providerChecked || order.simulated ? "" : "verification-pending";
  const providerLabel = order.simulated ? "Simulation order" : payment.lookupFailed ? "PayPal check unavailable" : payment.providerChecked ? "PayPal order checked" : "PayPal verification pending";
  const amountClass = payment.amountVerified ? "" : order.simulated ? "verification-pending" : payment.lookupFailed ? "verification-warning" : "verification-pending";
  const amountLabel = payment.amountVerified ? "Amount verified" : order.simulated ? "Simulation amount" : "Local amount locked";
  return <div className="verification-strip" aria-label="Checkout verification status">
    <span className={providerClass}><Icon name={payment.providerChecked ? "check" : "shield"} size={15}/>{providerLabel}</span>
    <span className={amountClass}><Icon name="lock" size={15}/>{amountLabel}: {money(order.amount)} {order.currency}</span>
    <span><Icon name="chart" size={15}/>Forecast recalculated from current inputs</span>
  </div>;
}
