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
  const generation = useRef(0), lock = useRef(false);
  const row = data?.categories.find(item => item.categoryId === categoryId);
  useEffect(() => {
    generation.current++; lock.current = false; setWorking(null); setPreview(null);
    if (data) setCategoryId(current => data.categories.some(item => item.categoryId === current) ? current : data.categories[0]?.categoryId || "");
  }, [data]);
  useEffect(() => { setAmount(decimal(row?.confirmedMonthlyCents ?? row?.proposedMonthlyCents ?? null)); setPreview(null); }, [row]);
  useEffect(() => { generation.current++; lock.current = false; setWorking(null); setPreview(null); }, [plan.financialInputHash, plan.insightBasis]);
  useEffect(() => {
    const changed = (event: Event) => { if ((event as CustomEvent<{ source?: string }>).detail?.source !== "what-if") reload(); };
    window.addEventListener("rp:budget", changed); return () => { generation.current++; window.removeEventListener("rp:budget", changed); };
  }, [reload]);
  function revert() {
    if (working === "confirm") return;
    generation.current++; lock.current = false; setWorking(null); setPreview(null); setError("");
    setAmount(decimal(row?.confirmedMonthlyCents ?? row?.proposedMonthlyCents ?? null)); setMessage("Preview reverted. No saved budget or financial input was changed.");
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
      const result = await postJson("/api/planning-budget", { action: "confirm", ...preview.confirmation }, "PATCH");
      if (version !== generation.current) return;
      setPreview(null); setMessage(result.message); reload(); window.dispatchEvent(new CustomEvent("rp:budget", { detail: { source: "what-if" } })); onConfirmed();
    } catch (error) { if (version === generation.current) setError((error as Error).message); }
    finally { if (version === generation.current) { lock.current = false; setWorking(null); } }
  }
  function refresh() { generation.current++; lock.current = false; setWorking(null); setPreview(null); setError(""); reload(); onConfirmed(); }
  return <details className="budget-what-if"><summary>What-if budget preview</summary>
    <p className="small muted">Compare one monthly category assumption without changing your saved plan or current forecast.</p>
    {loadError ? <div><p role="alert" className="error">{loadError}</p><button onClick={refresh}>Retry budget preview</button></div> : !data ? <p className="small muted" role="status">Loading budget categories…</p> : !data.categories.length ? <p className="small muted">No spending categories are available to preview. Missing history is not invented.</p> : <>
      <form onSubmit={compare} className="budget-what-if-controls" aria-label="What-if budget form"><label>Spending category<select disabled={!!working} value={categoryId} onChange={event => { setCategoryId(event.target.value); setError(""); setMessage(""); }}>{data.categories.map(item => <option key={item.categoryId} value={item.categoryId}>{item.category}</option>)}</select></label>
        <label>Adjusted monthly budget (USD)<input inputMode="decimal" required disabled={!!working} value={amount} onChange={event => { setAmount(event.target.value); setPreview(null); setError(""); setMessage(""); }} /></label>
        <button disabled={!!working || !row}>{working === "preview" ? "Comparing…" : "Compare budget"}</button>
      </form>
      {preview && <div className="budget-preview-result" aria-live="polite"><h3>{preview.category} · planning comparison</h3><dl>
        <div><dt>Original monthly {preview.originalSource === "user_confirmed" ? "confirmed budget" : "suggestion"}</dt><dd>{preview.originalMonthlyCents === null ? "Unavailable" : formatCents(preview.originalMonthlyCents)}</dd></div>
        <div><dt>Adjusted monthly budget</dt><dd>{formatCents(preview.adjustedMonthlyCents)}</dd></div>
        <div><dt>Monthly difference · adjusted minus original</dt><dd>{preview.monthlyDifferenceCents === null ? "Unavailable" : formatCents(preview.monthlyDifferenceCents)}</dd></div>
        <div><dt>Authoritative available-to-allocate change</dt><dd>{formatCents(preview.forecast.availableToAllocateDifferenceCents)}</dd></div>
      </dl><p className="small muted">{preview.policy}</p>
        <details className="budget-scenario-period"><summary>Illustrative calendar-month estimates & source</summary><p className="small muted">Current-month estimates use remaining calendar days; these are not scheduled spending transactions.</p><ul>{preview.months.map(month => <li key={month.month}><span>{fullDate(month.start)}–{fullDate(month.end)}{month.partial ? " · partial month" : " · full month"}</span><strong>{month.originalEstimateCents === null ? "Unavailable" : formatCents(month.originalEstimateCents)} → {formatCents(month.adjustedEstimateCents)}</strong><span>Difference {month.differenceCents === null ? "unavailable" : formatCents(month.differenceCents)}</span></li>)}</ul><p className="small muted">{preview.sourceLabel}. Historical coverage {fullDate(preview.observation.coverageStart)}–{fullDate(preview.observation.coverageEnd)}; complete observed months: {preview.observation.completeMonths.join(", ") || "none"}.</p><p className="small muted">{preview.replacement.reason}</p></details>
        <div className="row budget-preview-actions"><button className="primary" disabled={!!working} onClick={confirm}>{working === "confirm" ? "Confirming…" : "Confirm planning budget"}</button></div>
        <MoneyExplanation insightBasis={plan.insightBasis} preview={preview.confirmation} onRefresh={refresh} />
      </div>}
      <button disabled={working === "confirm"} onClick={revert}>Revert preview</button>
    </>}
    {message && <p className="small" role="status">{message}</p>}{error && <div><p role="alert" className="error">{error}</p><button onClick={refresh}>Refresh preview inputs</button></div>}
  </details>;
}
