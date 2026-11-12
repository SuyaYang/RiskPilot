import Link from "next/link";
import { paymentStatusView } from "@/lib/paymentStatus";
import type { CaptureComparison as SavedComparison } from "@/lib/captureComparison";
import type { ForecastResult } from "@/lib/types";
import type { OrderRecord } from "@/lib/store";
import CaptureComparison from "./CaptureComparison";
import Icon from "./Icon";
import { fmtDate, money, RiskBadge } from "./ui";

export type CheckoutSuccessData = {
  comparison: SavedComparison;
  order: OrderRecord;
  returnUrl?: string | null;
  forecastSnapshot: { id: string; createdAt: string; data: { forecast: ForecastResult; asOf: string } } | null;
};

export default function CheckoutSuccess({ data }: { data: CheckoutSuccessData }) {
  const { order, forecastSnapshot } = data;
  const settlement = paymentStatusView(order);
  const settlementChanged = ["REFUNDED", "PARTIALLY_REFUNDED", "REVERSED", "SETTLEMENT_REVIEW"].includes(settlement.state);
  const updated = order.projectionStatus === "UPDATED" && !!forecastSnapshot;
  const f = updated ? forecastSnapshot.data.forecast : null;
  return <section className="success-shell" aria-labelledby="success-title">
    <div className="success-header"><span className="success-seal"><Icon name="check" size={30} /></span><span className="badge green">{order.simulated ? "Simulation" : "Verified Sandbox capture"}</span><h1 id="success-title">{order.simulated ? "Your simulation is saved." : settlementChanged ? "Payment settlement changed." : "Payment confirmed."}</h1><p>{order.productName} · {money(order.amount)}</p></div>
    <div className="card success-details"><div className="status-row"><span><Icon name="shield" />{order.simulated ? "Simulation status" : "PayPal payment"}</span><strong className="positive">{order.simulated ? "Recorded" : settlementChanged ? settlement.label : "Captured"}</strong></div>
      <div className="status-row reference-row"><span><Icon name="bag" />{order.simulated ? "Simulation reference" : "PayPal order"}</span><strong>{order.orderId}</strong></div>
      {!order.simulated && <div className="status-row reference-row"><span><Icon name="check" />Capture ID</span><strong>{order.captureId || "Unavailable"}</strong></div>}
      <div className="status-row"><span><Icon name="wallet" />Amount</span><strong>{money(order.amount)} {order.currency}</strong></div>
      <div className="status-row"><span><Icon name="chart" />Cash-flow forecast</span><strong className={updated ? "positive" : "muted"}>{updated ? "Updated & saved" : "Not confirmed updated"}</strong></div>
      <div className="status-row"><span><Icon name="lock" />Duplicate capture protection</span><strong>{order.simulated ? "Not applicable" : "Enabled"}</strong></div>
      <p className="small muted">Funding remains unconfirmed. The forecast reserves the full purchase price; it does not infer a loan schedule or bank debit.</p>
      {f && !data.comparison?.available && <div className="saved-outlook"><span className="small muted">Lowest projected cash · saved {fmtDate(forecastSnapshot!.data.asOf)}</span><div className="row between"><strong className="big">{money(f.minBalance)}</strong><RiskBadge risk={f.risk} /></div><p className="small muted">{fmtDate(f.minBalanceDate)} · {f.bufferGap < 0 ? `${money(Math.abs(f.bufferGap))} below` : `${money(f.bufferGap)} above`} your buffer.</p></div>}
      <CaptureComparison comparison={data.comparison}/>
      {order.settlementReview && <p className="warn">{settlement.label}. Financial refund reconciliation is unsupported; the original reserve remains.</p>}
      <p className="small muted">{order.simulated ? "The simulation and saved forecast are linked to the same local record." : "The payment result and saved forecast are linked to this same verified order."} Bank reconciliation is not connected.</p>
      <div className="success-actions">{data.returnUrl && <a className="btn primary" href={data.returnUrl}>View {order.merchant?.name || "merchant"} receipt <Icon name="arrow" size={16} /></a>}<Link className="btn" href="/">View RiskPilot dashboard</Link></div>
    </div>
  </section>;
}
