"use client";
import { useEffect, useRef, useState } from "react";
import type { MoneyPlanView } from "@/lib/planning/incomeService";
import { formatCents } from "@/lib/spending/money";
import { fullDate, useApi } from "./ui";
import IncomePlan from "./IncomePlan";
import SpendingPlan from "./SpendingPlan";
import BudgetWhatIf from "./BudgetWhatIf";
import MoneyExplanation from "./MoneyExplanation";

const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
export default function MoneyPlanning() {
  const { data: loaded, error, reload } = useApi<MoneyPlanView>("/api/money-plan");
  const [saved, setSaved] = useState<MoneyPlanView | null>(null), [lastLoaded, setLastLoaded] = useState<MoneyPlanView | null>(null);
  const data = saved || loaded || lastLoaded;
  const [selectedMonth, setSelectedMonth] = useState(0);
  const adjust = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (loaded) { setSaved(null); setLastLoaded(loaded); } }, [loaded]);
  useEffect(() => {
    const clear = () => setSaved(null);
    const clearPersona = () => { setSaved(null); setLastLoaded(null); };
    const openAnchor = () => { if (["#spending-plan", "#income-plan"].includes(window.location.hash) && adjust.current) adjust.current.open = true; };
    openAnchor(); window.addEventListener("hashchange", openAnchor); window.addEventListener("rp:persona", clearPersona); window.addEventListener("rp:refresh", clear);
    return () => { window.removeEventListener("hashchange", openAnchor); window.removeEventListener("rp:persona", clearPersona); window.removeEventListener("rp:refresh", clear); };
  }, []);
  function refresh() { setSaved(null); reload(); }
  const confirmedCount = data?.entries.filter(entry => entry.status === "confirmed" || (entry.confirmedForecast && entry.status !== "paused")).length || 0;
  const scale = Math.max(1, ...(data?.months.flatMap(month => [month.expectedIncomeCents, month.modeledOutgoingCents]) || []));
  return <section className="money-planning" aria-labelledby="three-month-title">
    <header><span className="page-kicker">Money planning · informational</span><h2 id="three-month-title">Your next three months</h2><p className="small muted">See what&apos;s coming in, what&apos;s going out, and what may need attention.</p></header>
    {error ? <div><p className="error" role="alert">{error}</p><button onClick={refresh}>Retry money plan</button></div> : !data ? <p role="status" className="small muted">Loading your planning overview…</p> : <>
      <p className="small money-plan-period">{fullDate(data.period.start)} – {fullDate(data.period.end)}</p>
      <div className="money-month-selector" role="group" aria-label="Choose a month">{data.months.map((month, index) => <button key={month.month} type="button" aria-pressed={selectedMonth === index} onClick={() => setSelectedMonth(index)}>{monthLabel(month.month)}</button>)}</div>
      <ol className="money-months">{data.months.map((month, index) => <li key={month.month} className={selectedMonth === index ? "is-selected" : ""}>
        <header><h3>{monthLabel(month.month)}</h3><p>{month.partial ? `${month.days} of ${month.calendarDays} days remaining` : "Full calendar month"}</p></header>
        <dl><div><dt>Expected income</dt><dd>{formatCents(month.expectedIncomeCents)}</dd></div>
          <div><dt>Modeled outgoings</dt><dd>{formatCents(month.modeledOutgoingCents)}</dd></div>
          <div className="money-month-difference"><dt>Income less outgoings</dt><dd>{formatCents(month.partialDifferenceCents)}</dd></div>
        </dl>
      </li>)}</ol>
      <figure className="money-movements" aria-labelledby="money-movements-title">
        <figcaption><h3 id="money-movements-title">Monthly cash movements</h3><div className="money-chart-legend"><span><i className="income-dot" />Expected income</span><span><i className="outgoing-dot" />Modeled outgoings</span></div></figcaption>
        <ul>{data.months.map(month => <li key={month.month}>
          <div className="money-chart-month"><strong>{monthLabel(month.month)}</strong><span>{month.partial ? "Remaining days" : "Full month"}</span></div>
          <div className="money-chart-bars" role="img" aria-label={`${monthLabel(month.month)}, ${month.partial ? `${month.days} remaining days` : "full month"}: expected income ${formatCents(month.expectedIncomeCents)}; modeled outgoings ${formatCents(month.modeledOutgoingCents)}`}>
            <div><span className="money-bar-track"><span style={{ width: `${month.expectedIncomeCents / scale * 100}%` }} /></span><span>{formatCents(month.expectedIncomeCents)}</span></div>
            <div><span className="money-bar-track"><span style={{ width: `${month.modeledOutgoingCents / scale * 100}%` }} /></span><span>{formatCents(month.modeledOutgoingCents)}</span></div>
          </div>
        </li>)}</ul>
      </figure>
      <p className="small muted money-planning-note">A planning comparison, not spendable cash. Income is expected, not guaranteed; unapplied budgets stay separate. Applied categories replace their everyday model.</p>
      <details className="money-plan-evidence"><summary>Timing, coverage &amp; assumptions</summary>
        <div className="money-breakdowns">{data.months.map(month => <section key={month.month} aria-label={`${monthLabel(month.month)} breakdown`}><h3>{monthLabel(month.month)}</h3><p className="small muted">{month.partial ? "Partial month · budgets prorated" : "Full calendar month"}</p><dl>
          <div><dt>Scheduled expenses</dt><dd>{formatCents(month.scheduledExpensesCents)}</dd></div>
          <div><dt>Everyday spending model</dt><dd>{formatCents(month.everydayEstimateCents)}</dd></div>
          {month.purchaseReservesCents > 0 && <div><dt>Existing purchase reserves</dt><dd>{formatCents(month.purchaseReservesCents)}</dd></div>}
          <div><dt>Planning-only budgets <small>Separate; not added to outgoings</small></dt><dd>{data.separateBudgetCount ? formatCents(month.planningOnlyBudgetEstimateCents) : "None confirmed"}</dd></div>
          {month.excludedIncomeCents > 0 && <div><dt>Other income expectations <small>Unconfirmed / uncertain / overlap · excluded</small></dt><dd>{formatCents(month.excludedIncomeCents)}</dd></div>}
        </dl></section>)}</div>
        <p className="small muted">{data.policy} Modeled outgoings are a partial estimate; goals and unmodeled costs are not included.</p>
        <p className="small muted">{data.modeledIncome.length} modeled income sources · {confirmedCount} confirmed planning entries ({data.entries.filter(entry => entry.forecastIntegration.status === "included").length} included in the 45-day forecast) · {data.appliedBudgetCount} applied categories · {data.separateBudgetCount} planning-only budgets. Confirmation records an expectation, not a guaranteed receipt.</p><p className="small muted">New monthly and three-month income recurs on calendar dates, clamped to the original day in shorter months. Biweekly means 14 days. Existing modeled events retain their current engine cadence (30 days for monthly items); this overview does not change it. Unapplied budgets use illustrative calendar proration. Applied categories replace their own baseline from the application date, spreading monthly cents across actual calendar days with remainder cents on the earliest days. Unchanged categories keep their daily cadence; past days are not charged again. These are planning assumptions, not known transaction dates.</p>
        <p className="small muted">Unconfirmed, uncertain, hypothetical, paused and unresolved duplicate income is excluded from expected income totals. Similarity only raises a review flag. Forecast replacement requires a specific modeled source ID. No income is added to today&apos;s balance.</p>
        {data.expenseReview.length > 0 && <p className="small muted">Budget overlap review required for {data.expenseReview.map(row => `${row.category}${row.scheduledBills.length ? ` (${row.scheduledBills.map(item => item.name).join(", ")})` : ""}`).join("; ")}. Everyday spending may also overlap these categories. No combined budget-plus-bills total is presented.</p>}
        <ul className="money-event-list">{data.events.map(event => <li key={event.id}><time dateTime={event.date}>{fullDate(event.date)}</time><span>{event.name}<small>{event.kind === "purchase_reserve" ? "Existing purchase reserve" : event.kind === "modeled" ? "Existing model" : "Planning expectation"}{!event.included && " · excluded from totals"}</small></span><strong>{event.direction === "in" ? "+" : "−"}{formatCents(event.amountCents)}</strong></li>)}</ul>
      </details>
    </>}
    <details ref={adjust} className="adjust-money-plan"><summary>Adjust income &amp; spending plan</summary><IncomePlan data={data} onSaved={setSaved} onReload={refresh} /><SpendingPlan onSaved={refresh} /></details>
    {data && <><BudgetWhatIf plan={data} onConfirmed={refresh} /><details className="money-plan-insights"><summary>Understand this money plan</summary><MoneyExplanation insightBasis={data.insightBasis} onRefresh={refresh} /></details></>}
  </section>;
}
