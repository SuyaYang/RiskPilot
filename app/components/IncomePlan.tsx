"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { MoneyPlanView } from "@/lib/planning/incomeService";
import type { IncomeFrequency, PlanningIncomeEntry } from "@/lib/planning/incomeTypes";
import { formatCents, parseCents } from "@/lib/spending/money";
import { fullDate, postJson } from "./ui";

export const frequencyLabel: Record<IncomeFrequency, string> = { monthly: "Monthly", biweekly: "Every 14 days", quarterly: "Every 3 calendar months", once: "One time" };
const initial = { name: "", amount: "", currency: "USD", frequency: "monthly" as IncomeFrequency, nextDate: "", sourceType: "user_entered" as PlanningIncomeEntry["sourceType"], reliability: "expected" as PlanningIncomeEntry["reliability"] };
export default function IncomePlan({ data, onSaved, onReload }: { data: MoneyPlanView | null; onSaved: (view: MoneyPlanView) => void; onReload: () => void }) {
  const [editing, setEditing] = useState<string | null>(null), [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [mappingEntry, setMappingEntry] = useState<string | null>(null), [forecastUse, setForecastUse] = useState("planning_only");
  const lock = useRef(false), generation = useRef(0), nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const clear = () => { generation.current++; lock.current = false; setBusy(false); setEditing(null); setMappingEntry(null); setError(""); setMessage(""); };
    window.addEventListener("rp:persona", clear); window.addEventListener("rp:refresh", clear);
    return () => { generation.current++; window.removeEventListener("rp:persona", clear); window.removeEventListener("rp:refresh", clear); };
  }, []);
  useEffect(() => { if (editing) nameInput.current?.focus(); }, [editing]);
  function edit(entry?: PlanningIncomeEntry) {
    setError(""); setMessage(""); setEditing(entry?.id || "new");
    setDraft(entry ? { name: entry.name, amount: (entry.amountCents / 100).toFixed(2), currency: entry.currency, frequency: entry.frequency, nextDate: entry.nextDate, sourceType: entry.sourceType, reliability: entry.reliability } : { ...initial, nextDate: data?.asOf || "" });
  }
  async function save(action: "create" | "edit" | "confirm" | "pause" | "remove", id?: string, mapping?: string) {
    if (!data || lock.current) return;
    const amountCents = parseCents(draft.amount), edits = action === "create" || action === "edit";
    if (edits && (amountCents === null || amountCents > 100_000_000 || !draft.name.trim() || !draft.nextDate)) { setError("Enter an income source, a nonnegative USD amount with up to two decimals, and a next expected date."); return; }
    lock.current = true; setBusy(true); setError(""); setMessage(""); const version = ++generation.current;
    try {
      const result = await postJson("/api/money-plan", { action, ...(id ? { id } : {}), version: data.version, epoch: data.epoch, basisHash: data.basisHash,
        ...(action === "confirm" && mapping ? { forecastUse: mapping.startsWith("replace:") ? "replace" : mapping, ...(mapping.startsWith("replace:") ? { modeledItemId: mapping.slice(8) } : {}) } : {}),
        ...(edits ? { name: draft.name, amountCents, currency: "USD", frequency: draft.frequency, nextDate: draft.nextDate, sourceType: draft.sourceType, reliability: draft.reliability } : {}) }, "PATCH");
      if (version !== generation.current) return;
      onSaved(result.plan); setEditing(null); setMappingEntry(null); setMessage(result.message);
      if (result.forecastChanged) window.dispatchEvent(new Event("rp:refresh"));
    } catch (error) { if (version === generation.current) setError((error as Error).message); }
    finally { if (version === generation.current) { lock.current = false; setBusy(false); } }
  }
  function submit(event: FormEvent) { event.preventDefault(); void save(editing === "new" ? "create" : "edit", editing === "new" ? undefined : editing!); }
  return <section className="income-plan" id="income-plan" aria-labelledby="income-plan-title">
    <div className="row between"><div><h3 id="income-plan-title">Expected income</h3><p className="small muted">Review modeled sources and manage additional expectations.</p></div><button disabled={busy || !data} onClick={() => edit()}>+ Add income</button></div>
    {!data ? <p role="status" className="small muted">Loading income schedules…</p> : <>
      <ul className="income-list">{data.modeledIncome.map(entry => <li key={entry.id} className="income-row"><div><strong>{entry.name}</strong><span>{formatCents(entry.amountCents)} · {entry.frequency === "monthly" ? "Existing 30-day model cadence" : frequencyLabel[entry.frequency]} · next {fullDate(entry.nextDate)}</span></div><span className={`badge ${entry.status === "uncertain" ? "yellow" : "gray"}`}>{entry.forecastReplaced ? "Replaced in 45-day forecast" : entry.status === "uncertain" ? "Modeled · uncertain" : "Already modeled"}</span></li>)}</ul>
      <p className="small muted">Modeled sources are shown once and remain managed by the existing demo profile. Adding an income draft does not replace them.</p>
      {data.entries.length ? <ul className="income-list">{data.entries.map(entry => <li key={entry.id} className="income-entry" data-income-id={entry.id}>
        <div className="income-row"><div><strong>{entry.name}</strong><span>{formatCents(entry.amountCents)} · {frequencyLabel[entry.frequency]} · next {fullDate(entry.nextDate)}</span></div><span className={`badge ${entry.status === "confirmed" ? "blue" : "gray"}`}>{entry.status === "draft" ? "Unconfirmed draft" : entry.status === "paused" ? "Paused" : "User-confirmed"}</span></div>
        <p className="small muted">{entry.sourceType === "hypothetical" ? "Hypothetical example" : "User-entered expectation"} · {entry.reliability === "uncertain" ? "Uncertain; excluded from expected totals" : "Expected, not guaranteed"}.</p>
        {entry.overlap.length > 0 && entry.forecastIntegration.status !== "included" && <p className="small income-overlap">Potential overlap with {entry.overlap.map(item => item.name).join(", ")}. Excluded from expected totals to avoid counting the same payment twice.</p>}
        <p className="small muted" data-forecast-status={entry.forecastIntegration.status}><strong>{entry.forecastIntegration.status === "included" ? "Included in forecast" : entry.forecastIntegration.status === "needs_review" ? "Needs review" : "Planning only"}</strong> · {entry.forecastIntegration.reason}</p>
        {entry.status === "draft" && entry.confirmedForecast && <p className="small muted">Previous confirmed schedule remains active: {entry.confirmedForecast.name} · {formatCents(entry.confirmedForecast.amountCents)} · {frequencyLabel[entry.confirmedForecast.frequency]}. Confirm your edit to apply it under the previous source mapping.</p>}
        {entry.nextDate < data.asOf && <p className="small muted">The saved next date has passed. Review the schedule before confirming again; no receipt of income is assumed.</p>}
        <div className="row income-actions">{entry.status !== "confirmed" && <button disabled={busy} onClick={() => save("confirm", entry.id)}>{entry.status === "paused" ? "Confirm and resume" : "Confirm income"}</button>}<button disabled={busy} onClick={() => edit(entry)}>Edit income</button><button disabled={busy} onClick={() => { setMappingEntry(entry.id); const mapping = entry.forecastMapping || entry.confirmedForecast?.forecastMapping; setForecastUse(mapping?.kind === "replace" ? `replace:${mapping.modeledItemId}` : mapping?.kind || "planning_only"); }}>Review forecast use</button>{entry.status !== "paused" && <button disabled={busy} onClick={() => save("pause", entry.id)}>Pause</button>}<button disabled={busy} onClick={() => save("remove", entry.id)}>Remove</button></div>
        {mappingEntry === entry.id && <div className="income-mapping"><label>Forecast use for {entry.name}<select value={forecastUse} onChange={event => setForecastUse(event.target.value)}><option value="planning_only">Planning only</option><option value="additional">Additional distinct income source</option>{data.modeledIncome.map(item => <option key={item.id} value={`replace:${item.id}`}>Replace modeled {item.name}</option>)}</select></label><p className="small muted">Confirm the exact source relationship. A replacement removes that modeled income from the forecast; a separate source must be distinct. New income is omitted from stress and never added to today&apos;s balance.</p><div className="row income-actions"><button disabled={busy} onClick={() => save("confirm", entry.id, forecastUse)}>Confirm forecast use</button><button disabled={busy} onClick={() => setMappingEntry(null)}>Cancel forecast review</button></div></div>}
      </li>)}</ul> : <p className="small muted">No additional income entries. Nothing has been inferred or confirmed automatically.</p>}
    </>}
    {editing && <form className="income-editor" onSubmit={submit} aria-label="Income planning form">
      <div className="income-form-grid"><label>Income source<input ref={nameInput} required maxLength={80} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Expected amount (USD)<input inputMode="decimal" required value={draft.amount} onChange={event => setDraft({ ...draft, amount: event.target.value })} /></label>
        <label>Frequency<select value={draft.frequency} onChange={event => setDraft({ ...draft, frequency: event.target.value as IncomeFrequency })}>{Object.entries(frequencyLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Next expected date<input type="date" min={data?.asOf} required value={draft.nextDate} onChange={event => setDraft({ ...draft, nextDate: event.target.value })} /></label>
        <label>Source type<select value={draft.sourceType} onChange={event => setDraft({ ...draft, sourceType: event.target.value as PlanningIncomeEntry["sourceType"], reliability: event.target.value === "hypothetical" ? "uncertain" : draft.reliability })}><option value="user_entered">User-entered expectation</option><option value="hypothetical">Hypothetical example</option></select></label>
        <label>Reliability<select disabled={draft.sourceType === "hypothetical"} value={draft.reliability} onChange={event => setDraft({ ...draft, reliability: event.target.value as PlanningIncomeEntry["reliability"] })}><option value="expected">Expected, not guaranteed</option><option value="uncertain">Uncertain / hypothetical</option></select></label>
      </div><p className="small muted">Saves an unconfirmed draft. Confirm separately after reviewing dates and overlap warnings. Editing requires confirmation again.</p>
      <div className="row income-actions"><button className="primary" disabled={busy}>Save income draft</button><button type="button" disabled={busy} onClick={() => { setEditing(null); setError(""); }}>Cancel edit</button></div>
    </form>}
    {busy && <p role="status" className="small">Saving income plan…</p>}{message && <p role="status" className="small">{message}</p>}
    {error && <div><p role="alert" className="error">{error}</p><button disabled={busy} onClick={() => { setEditing(null); setError(""); onReload(); }}>Refresh income plan</button></div>}
  </section>;
}
