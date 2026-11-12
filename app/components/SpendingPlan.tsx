"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PlanningBudgetView } from "@/lib/planning/service";
import { formatCents, parseCents } from "@/lib/spending/money";
import { fullDate, postJson, useApi } from "./ui";

type Category = PlanningBudgetView["categories"][number];
const decimal = (cents: number | null) => cents === null ? "" : `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
const period = (months: string[]) => months.length ? months.map(month => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })).join(", ") : "No complete observed months";

export default function SpendingPlan({ onSaved }: { onSaved?: () => void } = {}) {
  const { data: loaded, error, reload } = useApi<PlanningBudgetView>("/api/planning-budget");
  const [saved, setSaved] = useState<PlanningBudgetView | null>(null);
  const data = saved || loaded;
  const [editing, setEditing] = useState<string | null>(null), [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [saveError, setSaveError] = useState("");
  const generation = useRef(0), lock = useRef(false), input = useRef<HTMLInputElement>(null);
  useEffect(() => { setSaved(null); setEditing(null); setSaveError(""); }, [loaded]);
  useEffect(() => {
    const clear = () => { generation.current++; lock.current = false; setBusy(false); setSaved(null); setEditing(null); setMessage(""); setSaveError(""); };
    window.addEventListener("rp:persona", clear); window.addEventListener("rp:refresh", clear);
    return () => { generation.current++; window.removeEventListener("rp:persona", clear); window.removeEventListener("rp:refresh", clear); };
  }, []);
  useEffect(() => {
    const changed = (event: Event) => { if ((event as CustomEvent<{ source?: string }>).detail?.source !== "spending-plan") { setMessage(""); reload(); } };
    window.addEventListener("rp:budget", changed); return () => window.removeEventListener("rp:budget", changed);
  }, [reload]);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  function edit(row: Category) {
    setEditing(row.categoryId); setAmount(decimal(row.draftMonthlyCents ?? row.confirmedMonthlyCents ?? row.proposedMonthlyCents)); setSaveError(""); setMessage("");
  }
  async function save(row: Category, action: "edit" | "confirm" | "revert" | "restore_baseline") {
    if (!data || lock.current) return;
    const monthlyCents = parseCents(amount);
    if (!["revert", "restore_baseline"].includes(action) && (monthlyCents === null || monthlyCents > 100_000_000)) { setSaveError("Enter a nonnegative USD budget with at most two decimals, up to $1,000,000."); return; }
    lock.current = true; setBusy(true); setSaveError(""); setMessage("");
    const version = ++generation.current;
    try {
      const result = await postJson("/api/planning-budget", { action, categoryId: row.categoryId, version: data.version, epoch: data.epoch, basisHash: data.basisHash, ...(action === "restore_baseline" ? { financialInputHash: data.financialInputHash } : action === "revert" ? {} : { monthlyCents }) }, "PATCH");
      if (version !== generation.current) return;
      if (result.forecastChanged) window.dispatchEvent(new Event("rp:refresh"));
      setSaved(result.budget); setEditing(null); setMessage(result.message); window.dispatchEvent(new CustomEvent("rp:budget", { detail: { source: "spending-plan" } })); onSaved?.();
    } catch (error) { if (version === generation.current) setSaveError((error as Error).message); }
    finally { if (version === generation.current) { lock.current = false; setBusy(false); } }
  }
  function revert(row: Category) {
    if (row.draftMonthlyCents !== null) void save(row, "revert");
    else { setEditing(null); setSaveError(""); }
  }
  function submit(event: FormEvent, row: Category) { event.preventDefault(); void save(row, "edit"); }

  return <section className="spending-plan" id="spending-plan" aria-labelledby="spending-plan-title">
    <header><span className="page-kicker">Planning assumptions · monthly</span><h2 id="spending-plan-title">Your spending plan</h2><p className="small muted">Review historical spending and set the budget you want to plan around.</p></header>
    <p className="small spending-plan-policy">Drafts and confirmations are planning only. <Link href="#budget-what-if">Preview and apply covered categories</Link> to update the shared forecast explicitly.</p>
    {error ? <div><p className="error" role="alert">{error}</p><button onClick={reload}>Retry spending plan</button></div> : !data ? <p role="status" className="small muted">Loading historical budget suggestions…</p> : <>
      {data.categories.length ? <div className="budget-list">
        <div className="budget-column-headings" aria-hidden="true"><span>Category</span><span>Historical avg.</span><span>Suggested</span><span>Your budget</span><span>Review</span></div>
        {data.categories.map(row => <div className="budget-item" key={row.categoryId} data-category={row.categoryId}>
          <div className="budget-row">
            <div className="budget-category"><strong>{row.category}</strong>{row.overlap.requiresReview && <span>Possible bill overlap</span>}</div>
            <div className="budget-value"><span className="budget-mobile-label">Historical avg.</span><strong>{row.historicalMonthlyAverageCents === null ? "Insufficient history" : formatCents(row.historicalMonthlyAverageCents)}</strong></div>
            <div className="budget-value"><span className="budget-mobile-label">Suggested</span><strong>{row.proposedMonthlyCents === null ? "Unavailable" : formatCents(row.proposedMonthlyCents)}</strong></div>
            <div className="budget-status"><strong>{row.confirmedMonthlyCents === null ? "Not confirmed" : formatCents(row.confirmedMonthlyCents)}</strong><span>{row.status === "draft" ? `Draft ${formatCents(row.draftMonthlyCents!)} · unconfirmed` : row.status === "confirmed" ? "User-confirmed" : "Suggestion only"}</span><span>{row.forecastIntegration.status === "included" ? (row.forecastIntegration.appliedMonthlyCents === row.confirmedMonthlyCents ? "Included in forecast · applied" : `Included in forecast · applied ${formatCents(row.forecastIntegration.appliedMonthlyCents!)}/month`) : row.forecastIntegration.status === "needs_review" ? "Needs review · planning only" : "Planning only"}</span></div>
            <button disabled={busy} aria-expanded={editing === row.categoryId} aria-controls={`budget-editor-${row.categoryId}`} aria-label={`Edit ${row.category} budget`} onClick={() => edit(row)}>Edit</button>
          </div>
          {editing === row.categoryId && <form className="budget-editor" id={`budget-editor-${row.categoryId}`} aria-label={`Edit ${row.category} budget`} onSubmit={event => submit(event, row)}>
            <label>Monthly budget (USD)<input ref={input} inputMode="decimal" required value={amount} onChange={event => setAmount(event.target.value)} aria-describedby={`budget-help-${row.categoryId}`} /></label>
            <p id={`budget-help-${row.categoryId}`} className="small muted">Save draft keeps this unconfirmed. Confirm budget explicitly saves the amount for planning only.</p>
            <div className="row"><button disabled={busy} type="submit">Save draft</button><button className="primary" type="button" disabled={busy} onClick={() => save(row, "confirm")}>Confirm budget</button><button type="button" disabled={busy} onClick={() => revert(row)}>Revert edit</button>{row.forecastIntegration.status === "included" && <button type="button" disabled={busy} onClick={() => save(row, "restore_baseline")}>Restore category baseline</button>}</div>
          </form>}
          <details className="budget-evidence"><summary>Source & review notes<span className="sr-only"> for {row.category}</span></summary>
            <p>{data.sourceLabel}. Coverage: {fullDate(row.observation.coverageStart)}–{fullDate(row.observation.coverageEnd)}. Average uses {period(row.observation.completeMonths)}; partial months are excluded.</p>
            {row.historicalMonthlyAverageCents === null && <p>Insufficient complete-month category history. You may enter and explicitly confirm your own planning budget.</p>}
            {row.historicalMonthlyAverageCents !== null && row.historicalMonthlyAverageCents < 0 && <p>Net refunds exceed spending. The suggestion is $0.00 rather than a negative future budget.</p>}
            <p>{row.forecastIntegration.reason}</p>
            <p>{row.forecastIntegration.supported ? "This declared fictional category can replace its baseline only through an explicit What-if application. Historical averages remain suggestions, not proof of baseline composition." : row.overlap.requiresReview ? `Review required: this category may overlap with scheduled bills or recurring services${row.overlap.scheduledBills.length ? ` (${row.overlap.scheduledBills.map(item => item.name).join(", ")})` : ""}. No amount has been subtracted or added to the forecast.` : "No exact future bill mapping has been established. This category is informational and has not been added to the forecast."}</p>
            {row.overlap.recurringMerchants.length > 0 && <p>Detected services: {row.overlap.recurringMerchants.join(", ")}. Pattern confirmation is separate from budget confirmation.</p>}
            {row.confirmation && <p>Confirmed {fullDate(row.confirmation.confirmedAt)} using {period(row.confirmation.evidence.observation.completeMonths)} simulated history. The saved budget stays fixed when suggestions change.</p>}
            {row.updatedAt && <p>Last updated {fullDate(row.updatedAt)}.</p>}
          </details>
        </div>)}
      </div> : <p className="small muted">No spending categories are available in this history. No budget suggestions have been invented.</p>}
      <details className="budget-method"><summary>How suggestions work</summary><p className="small muted">{data.forecastPolicy}</p><p className="small muted">Suggestions use the deterministic average of net category spending across fully covered, observed calendar months. Refunds reduce spending when posted. Duplicates, reversals, pending items, internal transfers and card repayments follow the existing Spending Intelligence exclusions. Missing months are not invented; an observed category absent in another covered month contributes zero for that month. No AI calculation is used.</p><Link href="/#spending-title" className="small">View historical Spending Intelligence →</Link></details>
    </>}
    {busy && <p role="status" className="small">Saving planning assumption…</p>}
    {message && <p role="status" className="small">{message}</p>}
    {saveError && <div><p className="error" role="alert">{saveError}</p><button disabled={busy} onClick={() => { generation.current++; reload(); }}>Refresh spending plan</button></div>}
  </section>;
}
