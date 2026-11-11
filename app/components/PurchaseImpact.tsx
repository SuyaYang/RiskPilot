"use client";
import ResponsiveDetails from "./ResponsiveDetails";
import type { Decision, MethodId, OptionResult } from "@/lib/types";
import { fmtDate, money, RiskBadge } from "./ui";

const labels: Record<string, string> = { full: "Pay now", pay_in_4: "Pay in 4", pay_monthly: "Pay Monthly", wait: "Skip this purchase", cheaper: "Lower-cost alternative" };
export default function PurchaseImpact({ decision, option, buffer, onSelect, locked = false, variant = "full" }: {
  decision: Decision; option: OptionResult; buffer: number; onSelect?: (method: MethodId) => void; locked?: boolean; variant?: "full" | "scenarios";
}) {
  const delays = option.goalImpact.filter(g => g.delayDays > 0);
  const first = option.payments[0];
  return <section className="impact-review" aria-label="Purchase impact overview">
    <div className="row between"><div><h2>{variant === "scenarios" ? "Compare your options" : "Check purchase impact"}</h2></div><RiskBadge risk={option.forecast.risk} /></div>
    {option.method === "wait" && <p className="small muted">Skipping adds no new payment. Any remaining risk comes from your existing cash flow.</p>}
    <p className="small muted">{variant === "scenarios" ? `Selected forecast: ${option.label}. Your actual payment method is selected in PayPal.` : `${option.productName} · ${money(option.price)} · Compare the effect on your cash and goals before making a payment.`}</p>
    {onSelect && <ResponsiveDetails className="scenario-picker"><summary>Compare payment forecast scenarios</summary><div className="impact-methods" role="group" aria-label="Payment forecast scenario">
      {decision.options.filter(o => (variant === "scenarios" ? ["full", "pay_in_4", "pay_monthly", "wait", "cheaper"] : ["full", "pay_in_4", "pay_monthly"]).includes(o.method)).map(o => <button
        type="button" key={o.method} className={`impact-method ${option.method === o.method ? "selected" : ""}`}
        aria-pressed={option.method === o.method} disabled={locked || !o.eligible} onClick={() => onSelect(o.method)}>
        <span className="row"><span className="method-dot" aria-hidden="true">{option.method === o.method ? "✓" : ""}</span><strong>{labels[o.method]}</strong></span>
        <span className="small">{o.hypothetical ? "Hypothetical · eligibility unconfirmed" : o.method === "wait" ? "No-purchase baseline" : "Full-price forecast"}</span>
        <span className="small muted">{o.payments[0] ? `${money(o.payments[0].amount)} first · ${fmtDate(o.payments[0].date)}` : "No payments"}</span>
        {variant === "scenarios" && <span className={`scenario-result ${o.forecast.risk}`}>Lowest cash {money(o.forecast.minBalance)}{o.recommended && <span className="scenario-suggested">Suggested{ o.hypothetical ? " estimate" : ""}</span>}</span>}
        {!o.eligible && <span className="small muted">{o.ineligibleReason}</span>}
      </button>)}
    </div></ResponsiveDetails>}
    {variant === "full" && <div className="impact-metrics">
      <div><span className="small muted">Lowest projected cash</span><strong>{money(option.forecast.minBalance)}</strong><span className="small muted">on {fmtDate(option.forecast.minBalanceDate)}</span></div>
      <div><span className="small muted">{option.forecast.bufferGap < 0 ? "Below your safety buffer" : "Above your safety buffer"}</span><strong className={option.forecast.bufferGap < 0 ? "negative" : "positive"}>{money(Math.abs(option.forecast.bufferGap))}</strong><span className="small muted">Protected buffer {money(buffer)}</span></div>
      <div><span className="small muted">Effect on your goals</span><strong>{delays.length ? `${delays.length} delayed` : "No extra delay"}</strong><span className="small muted">Versus skipping this purchase</span></div>
    </div>}
    <details className="impact-goals"><summary>{delays.length ? `${delays.length} goals delayed · view dates` : "No additional goal delay"}</summary>{delays.length ? delays.map(g => <div className="row between small" key={g.goalId}><span>{g.name}</span><strong>+{g.delayDays} days</strong></div>) : <p className="small">This scenario adds no projected delay to your goals.</p>}</details>
    <p className="small muted">If income arrives a week late, lowest cash is {money(option.forecast.stressMinBalance)}. Evaluated through {fmtDate(option.forecast.evaluatedThrough)}.</p>
    {option.hypothetical && <p className="warn small">Hypothetical estimate · Actual eligibility, APR and payment dates are set by PayPal. Estimated extra cost: {money(option.extraCost)}. Changing this forecast does not change the payment method selected in PayPal.</p>}
    {first && <details><summary className="small">View {option.hypothetical ? "estimated" : "projected"} payment dates</summary><table><tbody>{option.payments.map(p => <tr key={p.date}><td>{fmtDate(p.date)}</td><td>{p.label}</td><td>{money(p.amount)}</td></tr>)}</tbody></table></details>}
  </section>;
}
