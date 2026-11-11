"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SpendingView } from "@/lib/spending/service";
import type { SpendingFrequency } from "@/lib/spending/types";
import { formatCents, parseCents } from "@/lib/spending/money";
import { fmtDate, fullDate, postJson, useApi } from "./ui";
import ResponsiveDetails from "./ResponsiveDetails";

type Candidate = SpendingView["candidates"][number];
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const percentage = (basisPoints: number) => `${basisPoints > 0 ? "+" : basisPoints < 0 ? "−" : ""}${(Math.abs(basisPoints) / 100).toFixed(1)}%`;

export default function SpendingIntelligence() {
  const { data: loaded, error, reload } = useApi<SpendingView>("/api/spending");
  const [localData, setLocalData] = useState<SpendingView | null>(null);
  const data = localData || loaded;
  useEffect(() => { setLocalData(null); }, [loaded]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ merchant: "", amount: "", frequency: "monthly" as SpendingFrequency, nextDate: "" });
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [saveError, setSaveError] = useState("");
  const generation = useRef(0), lock = useRef(false), nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const clear = () => { generation.current++; lock.current = false; setBusy(false); setLocalData(null); setEditing(null); setMessage(""); setSaveError(""); };
    window.addEventListener("rp:persona", clear);
    return () => { generation.current++; window.removeEventListener("rp:persona", clear); };
  }, []);
  useEffect(() => { if (editing) nameRef.current?.focus(); }, [editing]);
  async function save(candidate: Candidate, action: "confirm" | "edit" | "not_recurring", edits = {}) {
    if (!data || lock.current) return;
    lock.current = true; setBusy(true); setSaveError(""); setMessage("");
    const version = ++generation.current;
    try {
      const result = await postJson(`/api/spending/recurring/${candidate.id}`, { action, version: data.version, asOf: data.analysis.coverage.asOf, ...edits }, "PATCH");
      if (version !== generation.current) return;
      setLocalData(result.spending); setEditing(null); setMessage(result.message); window.dispatchEvent(new Event("rp:spending"));
    } catch (error) { if (version === generation.current) setSaveError((error as Error).message); }
    finally { if (version === generation.current) { lock.current = false; setBusy(false); } }
  }
  function edit(candidate: Candidate) {
    setEditing(candidate.id); setSaveError("");
    setDraft({ merchant: candidate.merchant, amount: `${Math.floor(candidate.amountCents / 100)}.${String(candidate.amountCents % 100).padStart(2, "0")}`, frequency: candidate.frequency, nextDate: candidate.nextDate || "" });
  }
  function submit(event: FormEvent, candidate: Candidate) {
    event.preventDefault();
    const cents = parseCents(draft.amount);
    if (cents === null || cents <= 0) { setSaveError("Enter a positive USD amount with at most two decimal places."); return; }
    void save(candidate, "edit", { merchant: draft.merchant, amountCents: cents, frequency: draft.frequency, nextDate: draft.nextDate || null });
  }
  if (error) return <section className="card spending-intelligence"><h2>Spending intelligence unavailable</h2><p className="error" role="alert">{error}</p><button onClick={reload}>Retry spending analysis</button></section>;
  if (!data) return <section className="card spending-intelligence" role="status"><h2>Spending intelligence</h2><p className="small muted">Loading simulated transaction history…</p></section>;
  const { analysis, candidates } = data;
  const coverageLabel = analysis.coverage.start.slice(0, 4) === analysis.coverage.end.slice(0, 4)
    ? `${fmtDate(analysis.coverage.start)}–${fmtDate(analysis.coverage.end)}, ${analysis.coverage.end.slice(0, 4)}`
    : `${fullDate(analysis.coverage.start)}–${fullDate(analysis.coverage.end)}`;
  const latest = analysis.months.filter(month => month.complete).at(-1);
  const max = Math.max(1, ...analysis.months.map(month => Math.abs(month.netCents)));
  const maxCategory = Math.max(1, ...analysis.categories.map(category => Math.abs(category.netCents)));
  const active = candidates.filter(candidate => candidate.status !== "rejected"), rejected = candidates.filter(candidate => candidate.status === "rejected");
  const confirmedCount = active.filter(candidate => candidate.status === "confirmed").length;
  const suggestedCount = active.length - confirmedCount;
  function candidateRow(candidate: Candidate) {
    return <li key={candidate.id} className="recurring-pattern">
      <div className="pattern-heading"><div><strong>{candidate.merchant}</strong><span>{formatCents(candidate.amountCents)} · {candidate.frequency} · estimated {candidate.nextDate ? fmtDate(candidate.nextDate) : "date unavailable"}</span></div><span className={`badge ${candidate.status === "confirmed" ? "blue" : candidate.quality === "limited" ? "yellow" : "gray"}`}>{candidate.status === "confirmed" ? "Confirmed pattern" : candidate.quality === "limited" ? "Uncertain pattern" : "Suggested"}</span></div>
      <div className="pattern-actions">{candidate.status !== "confirmed" && <button disabled={busy} onClick={() => save(candidate, "confirm")}>Confirm</button>}<button disabled={busy} onClick={() => edit(candidate)} aria-expanded={editing === candidate.id}>Edit</button><button className="text-action" disabled={busy} onClick={() => save(candidate, "not_recurring")}>Not recurring</button></div>
      <details className="pattern-evidence"><summary>Evidence & forecast treatment</summary><p>{candidate.evidence.observations} posted observations, {fmtDate(candidate.firstObserved)}–{fmtDate(candidate.lastObserved)}. Observed amounts {formatCents(candidate.evidence.minCents)}–{formatCents(candidate.evidence.maxCents)}; intervals {candidate.evidence.minGapDays}–{candidate.evidence.maxGapDays} days. Source: deterministic pattern in simulated history.</p><p>Last observed {fmtDate(candidate.lastObserved)}. {candidate.quality === "limited" ? "Amounts vary; evidence quality is limited." : "Dates and amounts are reasonably consistent."} {candidate.edited && "Your saved edit overrides the displayed estimate, not the original observations."}</p><p>{candidate.forecastReference ? `The forecast already contains ${candidate.forecastReference.name}: ${formatCents(candidate.forecastReference.amountCents)}, next scheduled ${fmtDate(candidate.forecastReference.nextDate)}. This pattern is not added again; edits here do not change that bill.` : "Not included in the forecast. Confirming a pattern does not create an authoritative obligation; bank-debit matching is unavailable."}</p></details>
      {editing === candidate.id && <form className="pattern-editor" onSubmit={event => submit(event, candidate)} aria-label={`Edit ${candidate.merchant} pattern`}>
        <label>Merchant<input ref={nameRef} required maxLength={80} value={draft.merchant} onChange={event => setDraft({ ...draft, merchant: event.target.value })} /></label>
        <label>Estimated amount (USD)<input required inputMode="decimal" value={draft.amount} onChange={event => setDraft({ ...draft, amount: event.target.value })} /></label>
        <label>Estimated frequency<select value={draft.frequency} onChange={event => setDraft({ ...draft, frequency: event.target.value as SpendingFrequency })}><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="monthly">Monthly</option></select></label>
        <label>Estimated next date (optional)<input type="date" min={analysis.coverage.asOf} value={draft.nextDate} onInput={event => { const nextDate = event.currentTarget.value; setDraft(current => ({ ...current, nextDate })); }} onChange={event => setDraft({ ...draft, nextDate: event.target.value })} /></label>
        {saveError && <p className="error" role="alert">{saveError}</p>}
        <p className="small muted">Saves this pattern only. Existing forecast bills are unchanged.</p><div className="row"><button className="primary" disabled={busy}>Save pattern edit</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button></div>
      </form>}
    </li>;
  }
  return <section className="card spending-intelligence" aria-labelledby="spending-title">
    <header className="row between"><div><span className="page-kicker">Understand your everyday</span><h2 id="spending-title">Spending intelligence</h2></div><span className="badge gray">Simulated history</span></header>
    <p className="spending-coverage">No bank connected · {coverageLabel}. {analysis.analyzedCount} spending/refund records.</p>
    <div className="spending-analysis-grid"><div className="spending-trend"><div className="spending-metrics"><div><span>Avg. monthly spending</span><strong>{analysis.averageMonthlyCents === null ? "Unavailable" : formatCents(analysis.averageMonthlyCents)}</strong><small>{analysis.averageMonthCount} fully covered months</small></div>{latest && <div><span>{monthLabel(latest.month)} net spending</span><strong>{formatCents(latest.netCents)}</strong><small>{latest.changeBasisPoints === null ? "Comparable prior month unavailable" : `${monthLabel(latest.month)}: ${percentage(latest.changeBasisPoints)} vs prior full month`}</small></div>}</div>
      {analysis.months.length ? <div className="spending-bars" role="img" aria-label={analysis.months.map(month => `${monthLabel(month.month)}: ${formatCents(month.netCents)} net spending${month.complete ? "" : ", partial coverage"}`).join("; ")}>{analysis.months.map(month => <div className="spending-month" key={month.month}><span>{formatCents(month.netCents)}</span><div><i className={month.complete ? "" : "partial"} style={{ height: `${Math.max(2, Math.abs(month.netCents) / max * 100)}%` }} /></div><span>{monthLabel(month.month)}{!month.complete && <small>Partial</small>}</span></div>)}</div> : <p className="small muted">No posted history in this coverage period. No months or totals have been invented.</p>}
    </div><ResponsiveDetails className="spending-categories"><summary>Category breakdown · net spending</summary><ul>{analysis.categories.map(category => <li key={category.category}><div><span>{category.category}</span><strong>{formatCents(category.netCents)}</strong></div><span className="category-track"><i style={{ width: `${Math.abs(category.netCents) / maxCategory * 100}%` }} /></span></li>)}</ul><p className="small muted">Across the full coverage period. Negative amounts mean net refunds.</p></ResponsiveDetails></div>
    <details className="spending-recurring"><summary>Recurring expenses · {confirmedCount} confirmed {confirmedCount === 1 ? "pattern" : "patterns"} · {suggestedCount} {suggestedCount === 1 ? "suggestion" : "suggestions"}</summary><p className="small muted">Estimates for review, not guaranteed bills. Confirm saves the pattern; it does not add or edit a forecast commitment.</p>{active.length ? <ul className="recurring-patterns">{active.map(candidateRow)}</ul> : <p className="small muted">No recurring suggestions to review. More consistent posted history is needed.</p>}
      {rejected.length > 0 && <details><summary>Marked not recurring ({rejected.length})</summary><ul className="rejected-patterns">{rejected.map(candidate => <li key={candidate.id}><span>{candidate.merchant} · not recurring</span><button disabled={busy} onClick={() => save(candidate, "confirm")}>Confirm pattern</button></li>)}</ul></details>}
    {message && <p className="small" role="status">{message}</p>}{saveError && !editing && <div><p className="error" role="alert">{saveError}</p><button onClick={() => { setEditing(null); reload(); }}>Refresh patterns</button></div>}
    <details className="spending-method"><summary>Coverage & calculation rules</summary><p className="small muted">Amounts use integer cents. Transfers between own accounts, card repayments, pending items, reversals and duplicate records are excluded. Refunds reduce spending on their posted date. Averages use fully covered months only; partial months are not used for month-over-month comparisons.</p><p className="small muted">Excluded: {analysis.excluded.transfers} transfers, {analysis.excluded.cardPayments} card repayments, {analysis.excluded.pending} pending, {analysis.excluded.reversed} reversed records, {analysis.excluded.duplicates} duplicates, {analysis.excluded.income} income records, {analysis.excluded.invalid} invalid/conflicting records.</p><p className="small muted">{data.forecastPolicy} Historical fixtures illustrate behavior; they do not reconstruct or overwrite today's manual balance. No PayPal buyer spending history or Plaid connection is used.</p></details></details>
  </section>;
}
