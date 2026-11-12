"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BudgetPreview } from "@/lib/planning/preview";
import type { MoneyPlanView } from "@/lib/planning/incomeService";
import type { PlanningBudgetView } from "@/lib/planning/service";
import { formatCents, parseCents } from "@/lib/spending/money";
import { fullDate, postJson, useApi } from "./ui";
import MoneyExplanation from "./MoneyExplanation";
const decimal = (cents: number | null) => cents === null ? "" : (cents / 100).toFixed(2);
export default function BudgetWhatIf({ plan, onConfirmed }: { plan: MoneyPlanView; onConfirmed: () => void }) {
  const { data, error: loadError, reload } = useApi<PlanningBudgetView>("/api/planning-budget");
  const [categoryId, setCategoryId] = useState(""), [amount, setAmount] = useState("");
  const [preview, setPreview] = useState<BudgetPreview | null>(null), [working, setWorking] = useState<"preview" | "confirm" | null>(null);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => { const open = () => { if (window.location.hash === "#budget-what-if" && disclosure.current) disclosure.current.open = true; }; open(); window.addEventListener("hashchange", open); return () => window.removeEventListener("hashchange", open); }, []);
  const generation = useRef(0), lock = useRef(false);
  const row = data?.categories.find(item => item.categoryId === categoryId);
  useEffect(() => {
    generation.current++; lock.current = false; setWorking(null); setPreview(null);
    if (data) setCategoryId(current => data.categories.some(item => item.categoryId === current) ? current : data.categories[0]?.categoryId || "");
  }, [data]);
  useEffect(() => { setAmount(decimal(row?.forecastIntegration.currentMonthlyCents ?? row?.confirmedMonthlyCents ?? row?.proposedMonthlyCents ?? null)); setPreview(null); }, [row]);
  useEffect(() => { generation.current++; lock.current = false; setWorking(null); setPreview(null); }, [plan.financialInputHash, plan.insightBasis]);
  useEffect(() => {
    const changed = (event: Event) => { if ((event as CustomEvent<{ source?: string }>).detail?.source !== "what-if") reload(); };
    window.addEventListener("rp:budget", changed); return () => { generation.current++; window.removeEventListener("rp:budget", changed); };
  }, [reload]);
  function revert() {
    if (working === "confirm") return;
    generation.current++; lock.current = false; setWorking(null); setPreview(null); setError("");
    setAmount(decimal(row?.forecastIntegration.currentMonthlyCents ?? row?.confirmedMonthlyCents ?? row?.proposedMonthlyCents ?? null)); setMessage("Preview reverted. No saved budget or financial input was changed.");
  }
  async function compare(event: FormEvent) {
    event.preventDefault(); if (!data || !row || lock.current) return;
    const monthlyCents = parseCents(amount);
    if (monthlyCents === null || monthlyCents > 100_000_000) { setError("Enter a nonnegative USD amount with up to two decimals, up to $1,000,000."); return; }
    const version = ++generation.current; lock.current = true; setWorking("preview"); setError(""); setMessage(""); setPreview(null);
    try {
      const result = await postJson("/api/planning-budget/preview", { categoryId, monthlyCents, version: data.version, epoch: data.epoch, basisHash: data.basisHash, financialInputHash: plan.financialInputHash });
      if (version === generation.current) setPreview(result);
    } catch (error) { if (version === generation.current) setError((error as Error).message); }
    finally { if (version === generation.current) { lock.current = false; setWorking(null); } }
  }
  async function confirm() {
    if (!preview || lock.current) return;
    const version = ++generation.current; lock.current = true; setWorking("confirm"); setError(""); setMessage("");
    try {
      const result = await postJson("/api/planning-budget", { action: preview.replacement.supported ? "apply" : "confirm", ...preview.confirmation }, "PATCH");
      if (version !== generation.current) return;
      if (result.forecastChanged) window.dispatchEvent(new Event("rp:refresh"));
      setPreview(null); setMessage(result.message); reload(); window.dispatchEvent(new CustomEvent("rp:budget", { detail: { source: "what-if" } })); onConfirmed();
    } catch (error) { if (version === generation.current) setError((error as Error).message); }
    finally { if (version === generation.current) { lock.current = false; setWorking(null); } }
  }
  async function enableBaseline() {
    if (!data || lock.current) return;
    const version = ++generation.current; lock.current = true; setWorking("confirm"); setError(""); setMessage("");
    try {
      const result = await postJson("/api/planning-budget", { action: "enable_baseline", categoryId: "food-and-dining", version: data.version, epoch: data.epoch, basisHash: data.basisHash, financialInputHash: plan.financialInputHash }, "PATCH");
      if (version !== generation.current) return;
      setMessage(result.message); reload(); window.dispatchEvent(new CustomEvent("rp:budget", { detail: { source: "what-if" } })); onConfirmed();
    } catch (error) { if (version === generation.current) setError((error as Error).message); }
    finally { if (version === generation.current) { lock.current = false; setWorking(null); } }
  }
  function refresh() { generation.current++; lock.current = false; setWorking(null); setPreview(null); setError(""); reload(); onConfirmed(); }
  return <details ref={disclosure} id="budget-what-if" className="budget-what-if"><summary>What-if budget preview</summary>
    <p className="small muted">Compare one monthly category assumption without changing your saved plan or current forecast.</p>
    {loadError ? <div><p role="alert" className="error">{loadError}</p><button onClick={refresh}>Retry budget preview</button></div> : !data ? <p className="small muted" role="status">Loading budget categories…</p> : !data.categories.length ? <p className="small muted">No spending categories are available to preview. Missing history is not invented.</p> : <>
      {data.baseline.canEnable && <div className="budget-model-activation"><p className="small muted">Alex can use a declared fictional category model totaling the same $20/day. Enabling preserves the current forecast and keeps saved budgets planning only until explicitly applied.</p><button disabled={!!working} onClick={enableBaseline}>Enable Alex category model</button></div>}
      <form onSubmit={compare} className="budget-what-if-controls" aria-label="What-if budget form"><label>Spending category<select disabled={!!working} value={categoryId} onChange={event => { setCategoryId(event.target.value); setError(""); setMessage(""); }}>{data.categories.map(item => <option key={item.categoryId} value={item.categoryId}>{item.category}</option>)}</select></label>
        <label>Adjusted monthly budget (USD)<input inputMode="decimal" required disabled={!!working} value={amount} onChange={event => { setAmount(event.target.value); setPreview(null); setError(""); setMessage(""); }} /></label>
        <button disabled={!!working || !row}>{working === "preview" ? "Comparing…" : "Compare budget"}</button>
      </form>
      {preview && <div className="budget-preview-result" aria-live="polite"><h3>{preview.category} · {preview.replacement.supported ? "scenario preview" : "planning comparison"}</h3><dl>
        <div><dt>{preview.replacement.supported ? "Current category plan · monthly" : preview.originalSource === "user_confirmed" ? "Original monthly confirmed budget" : "Original monthly suggestion"}</dt><dd>{preview.originalMonthlyCents === null ? "Unavailable" : formatCents(preview.originalMonthlyCents)}</dd></div>
        <div><dt>Adjusted monthly budget</dt><dd>{formatCents(preview.adjustedMonthlyCents)}</dd></div>
        <div><dt>Monthly difference · adjusted minus original</dt><dd>{preview.monthlyDifferenceCents === null ? "Unavailable" : formatCents(preview.monthlyDifferenceCents)}</dd></div>
        <div><dt>{preview.replacement.supported ? "Scenario available-to-allocate change" : "Authoritative available-to-allocate change"}</dt><dd>{formatCents(preview.forecast.availableToAllocateDifferenceCents)}</dd></div>
      </dl>
        {preview.replacement.supported && <><table className="budget-forecast-comparison"><caption>45-day engine comparison · scenario preview</caption><thead><tr><th scope="col">Measure</th><th scope="col">Current</th><th scope="col">Scenario</th></tr></thead><tbody>
          <tr><th scope="row">Lowest cash</th><td>{formatCents(preview.forecast.current.minBalanceCents)}</td><td>{formatCents(preview.forecast.scenario.minBalanceCents)}</td></tr>
          <tr><th scope="row">Income-late low</th><td>{formatCents(preview.forecast.current.stressMinBalanceCents)}</td><td>{formatCents(preview.forecast.scenario.stressMinBalanceCents)}</td></tr>
          <tr><th scope="row">Cash buffer</th><td>{preview.forecast.current.bufferHolds ? "Holds" : "Below"}</td><td>{preview.forecast.scenario.bufferHolds ? "Holds" : "Below"}</td></tr>
          <tr><th scope="row">Income-late buffer</th><td>{preview.forecast.current.stressBufferHolds ? "Holds" : "Below"}</td><td>{preview.forecast.scenario.stressBufferHolds ? "Holds" : "Below"}</td></tr>
          <tr><th scope="row">Available to allocate</th><td>{formatCents(preview.forecast.current.availableToAllocateCents)}</td><td>{formatCents(preview.forecast.scenario.availableToAllocateCents)}</td></tr>
        </tbody></table>{preview.forecast.scenario.checks.some(check => !check.ok) && <p className="small muted">Still on hold: {preview.forecast.scenario.failedChecks.join("; ")}.</p>}</>}
        <p className="small muted">{preview.policy}</p>
        <details className="budget-scenario-period"><summary>Illustrative calendar-month estimates & source</summary><p className="small muted">Current-month estimates use remaining calendar days; these are not scheduled spending transactions.</p><ul>{preview.months.map(month => <li key={month.month}><span>{fullDate(month.start)}–{fullDate(month.end)}{month.partial ? " · partial month" : " · full month"}</span><strong>{month.originalEstimateCents === null ? "Unavailable" : formatCents(month.originalEstimateCents)} → {formatCents(month.adjustedEstimateCents)}</strong><span>Difference {month.differenceCents === null ? "unavailable" : formatCents(month.differenceCents)}</span></li>)}</ul><p className="small muted">{preview.sourceLabel}. Historical coverage {fullDate(preview.observation.coverageStart)}–{fullDate(preview.observation.coverageEnd)}; complete observed months: {preview.observation.completeMonths.join(", ") || "none"}.</p><p className="small muted">{preview.replacement.reason}</p></details>
        <div className="row budget-preview-actions"><button className="primary" disabled={!!working} onClick={confirm}>{working === "confirm" ? "Confirming…" : preview.replacement.supported ? "Apply to money plan" : "Confirm planning budget"}</button></div>
        <MoneyExplanation insightBasis={plan.insightBasis} preview={preview.confirmation} onRefresh={refresh} />
      </div>}
      <button disabled={working === "confirm"} onClick={revert}>Revert preview</button>
    </>}
    {message && <p className="small" role="status">{message}</p>}{error && <div><p role="alert" className="error">{error}</p><button onClick={refresh}>Refresh preview inputs</button></div>}
  </details>;
}
