"use client";
import { useEffect, useRef, useState } from "react";
import type { MoneyPlanView } from "@/lib/planning/incomeService";
import { formatCents } from "@/lib/spending/money";
import { fullDate, useApi } from "./ui";
import IncomePlan from "./IncomePlan";
import SpendingPlan from "./SpendingPlan";

const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
export default function MoneyPlanning() {
  const { data: loaded, error, reload } = useApi<MoneyPlanView>("/api/money-plan");
  const [saved, setSaved] = useState<MoneyPlanView | null>(null), data = saved || loaded;
  const adjust = useRef<HTMLDetailsElement>(null);
  useEffect(() => { setSaved(null); }, [loaded]);
  useEffect(() => {
    const clear = () => setSaved(null);
    const openAnchor = () => { if (["#spending-plan", "#income-plan"].includes(window.location.hash) && adjust.current) adjust.current.open = true; };
    openAnchor(); window.addEventListener("hashchange", openAnchor); window.addEventListener("rp:persona", clear); window.addEventListener("rp:refresh", clear);
    return () => { window.removeEventListener("hashchange", openAnchor); window.removeEventListener("rp:persona", clear); window.removeEventListener("rp:refresh", clear); };
  }, []);
  function refresh() { setSaved(null); reload(); }
  const scale = Math.max(1, ...(data?.months.flatMap(month => [month.expectedIncomeCents, month.modeledOutgoingCents]) || []));
  return <section className="money-planning" aria-labelledby="three-month-title">
    <header><span className="page-kicker">Money planning · informational</span><h2 id="three-month-title">Your next three months</h2><p className="small muted">See what&apos;s expected to come in, what&apos;s planned to go out, and what may need your attention.</p></header>
    {error ? <div><p className="error" role="alert">{error}</p><button onClick={refresh}>Retry money plan</button></div> : !data ? <p role="status" className="small muted">Loading your planning overview…</p> : <>
      <p className="small money-plan-period">{fullDate(data.period.start)}–{fullDate(data.period.end)} · {data.months[0].partial ? "Current month remaining + two full months" : "Three full calendar months"}</p>
      <ol className="money-months">{data.months.map(month => <li key={month.month}>
        <h3>{monthLabel(month.month)}<span>{month.partial ? `${month.days} of ${month.calendarDays} days remaining` : "Full calendar month"}</span></h3>
        <div className="money-comparison" role="img" aria-label={`${monthLabel(month.month)} expected income ${formatCents(month.expectedIncomeCents)}, modeled outgoings ${formatCents(month.modeledOutgoingCents)}; budgets are separate`}><span style={{ width: `${month.expectedIncomeCents / scale * 100}%` }} /><span style={{ width: `${month.modeledOutgoingCents / scale * 100}%` }} /></div>
        <dl><div><dt><i className="income-dot" />Expected income</dt><dd>{formatCents(month.expectedIncomeCents)}</dd></div>
          <div><dt><i className="outgoing-dot" />Modeled outgoings</dt><dd>{formatCents(month.modeledOutgoingCents)}</dd></div>
          <div className="money-month-detail"><dt>Scheduled expenses</dt><dd>{formatCents(month.scheduledExpensesCents)}</dd></div>
          <div className="money-month-detail"><dt>Everyday model estimate</dt><dd>{formatCents(month.everydayEstimateCents)}</dd></div>
          {month.purchaseReservesCents > 0 && <div className="money-month-detail"><dt>Existing purchase reserves</dt><dd>{formatCents(month.purchaseReservesCents)}</dd></div>}
          <div className="money-budget-separate"><dt>Confirmed budgets{month.partial ? " · prorated" : ""}<small>Separate; not added above</small></dt><dd>{data.confirmedBudgetCount ? formatCents(month.confirmedBudgetEstimateCents) : "None confirmed"}</dd></div>
          {month.excludedIncomeCents > 0 && <div className="money-month-detail"><dt>Other income expectations<small>Unconfirmed / uncertain / overlap · excluded</small></dt><dd>{formatCents(month.excludedIncomeCents)}</dd></div>}
          <div className="money-partial-difference"><dt>Income less modeled outgoings<small>Partial comparison · not spendable cash</small></dt><dd>{formatCents(month.partialDifferenceCents)}</dd></div>
        </dl>
      </li>)}</ol>
      <p className="small muted">{data.policy} Modeled outgoings are a partial estimate: confirmed budgets are shown separately because they may overlap scheduled bills or everyday spending. Goals and unmodeled costs are not included.</p>
      <p className="small money-income-summary">{data.modeledIncome.length} modeled income {data.modeledIncome.length === 1 ? "source" : "sources"} · {data.entries.filter(entry => entry.status === "confirmed").length} confirmed planning {data.entries.filter(entry => entry.status === "confirmed").length === 1 ? "entry" : "entries"} · {data.confirmedBudgetCount} confirmed spending {data.confirmedBudgetCount === 1 ? "budget" : "budgets"}. Confirmation records your expectation, not a guaranteed receipt.</p>
      <details className="money-plan-evidence"><summary>Timing, coverage & overlap notes</summary><p className="small muted">New monthly and three-month income recurs on calendar dates, clamped to the original day in shorter months. Biweekly means 14 days. Existing modeled events retain their current engine cadence (30 days for monthly items); this overview does not change it. Confirmed monthly budgets are planning estimates, prorated by remaining calendar days for a partial month, rather than future transactions.</p>
        <p className="small muted">Unconfirmed, uncertain, hypothetical, paused and potentially duplicate income is excluded from expected income totals. Same-name sources or matching amounts on the same expected payment date require overlap review. No income is added to today&apos;s balance.</p>
        {data.expenseReview.length > 0 && <p className="small muted">Budget overlap review required for {data.expenseReview.map(row => `${row.category}${row.scheduledBills.length ? ` (${row.scheduledBills.map(item => item.name).join(", ")})` : ""}`).join("; ")}. Everyday spending may also overlap these categories. No combined budget-plus-bills total is presented.</p>}
        <ul className="money-event-list">{data.events.map(event => <li key={event.id}><time dateTime={event.date}>{fullDate(event.date)}</time><span>{event.name}<small>{event.kind === "purchase_reserve" ? "Existing purchase reserve" : event.kind === "modeled" ? "Existing model" : "Planning expectation"}{!event.included && " · excluded from totals"}</small></span><strong>{event.direction === "in" ? "+" : "−"}{formatCents(event.amountCents)}</strong></li>)}</ul>
      </details>
    </>}
    <details ref={adjust} className="adjust-money-plan"><summary>Adjust your plan · income and spending</summary><IncomePlan data={data} onSaved={setSaved} onReload={refresh} /><SpendingPlan onSaved={refresh} /></details>
  </section>;
}
