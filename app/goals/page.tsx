"use client";
import { useState, type FormEvent, useEffect } from "react";
import type { Goal, Allocation } from "@/lib/types";
import { fmtDate, money, postJson, useApi } from "../components/ui";
type Draft = Omit<Goal, "id">;
const empty: Draft = { name: "", type: "spend", targetAmount: 1000, savedSoFar: 0, targetDate: "", priority: 2 };
export default function Goals() {
  const { data, error: loadError, reload } = useApi<{ goals: Goal[]; allocation: Allocation; history: { at: string; name: string; summary: string }[] }>("/api/goals");
  const [draft, setDraft] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const clear = () => { setDraft(empty); setEditing(null); setMessage(""); setText(""); };
    window.addEventListener("rp:persona", clear);
    return () => window.removeEventListener("rp:persona", clear);
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const result = await postJson(editing ? `/api/goals/${editing}` : "/api/goals", draft, editing ? "PATCH" : "POST");
      setMessage(result.changes?.join(". ") || "Goal saved. Forecast updated.");
      setDraft(empty); setEditing(null); reload();
    });
  }
  return <div className="stack">
    <h1>Your goals</h1><p className="sub">Allocate savings by priority and deadline. Every confirmed change updates the projection.</p>
    <div className="grid g2">
      <div className="card stack">
        <h2>{editing ? "Edit goal" : "Add a goal"}</h2>
        {!editing && <div className="stack"><label>Describe a goal<input value={text} onChange={e => setText(e.target.value)} placeholder="Japan trip by next March, $3,000" maxLength={500} /></label>
          <button disabled={busy || !text.trim()} onClick={() => run(async () => {
            const result = await postJson("/api/goals/parse", { text });
            setDraft({ ...empty, ...result.draft });
            setMessage("Draft only. Check the amount and date, then confirm to save.");
          })}>Draft with AI</button><p className="small muted">If AI is unavailable, use the form. A draft never saves automatically.</p></div>}
        <form className="stack" onSubmit={save}>
          <label>Name<input required maxLength={60} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
          <div className="grid g2"><label>Target amount (USD)<input required type="number" min="0.01" step="0.01" value={draft.targetAmount} onChange={e => setDraft({ ...draft, targetAmount: Number(e.target.value) })} /></label>
            <label>Already saved (USD)<input required type="number" min="0" step="0.01" value={draft.savedSoFar} onChange={e => setDraft({ ...draft, savedSoFar: Number(e.target.value) })} /></label></div>
          <label>Target date<input required type="date" value={draft.targetDate} onInput={e => { const targetDate = e.currentTarget.value; setDraft(current => ({ ...current, targetDate })); }} onChange={e => { const targetDate = e.target.value; setDraft(current => ({ ...current, targetDate })); }} /></label>
          <label>Purpose<select value={draft.type} disabled={Boolean(editing)} onChange={e => setDraft({ ...draft, type: e.target.value as Draft["type"] })}><option value="spend">Save for spending</option><option value="invest">Save to invest</option></select></label>
          <label>Priority<select value={draft.priority} onChange={e => setDraft({ ...draft, priority: Number(e.target.value) as Draft["priority"] })}><option value={1}>High</option><option value={2}>Medium</option><option value={3}>Low</option></select></label>
          <div className="row"><button className="primary" disabled={busy}>{editing ? "Save changes" : "Confirm and save goal"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setDraft(empty); }}>Cancel edit</button>}</div>
        </form>
      </div>
      <div className="stack">{data?.goals.map(g => {
        const status = data.allocation.goals.find(s => s.goalId === g.id);
        return <div className="card stack" key={g.id}><div className="row between"><h2>{g.name}</h2><span className="badge gray">{g.paused ? "Paused" : status?.status.replaceAll("_", " ")}</span></div>
          <p>{money(g.savedSoFar)} / {money(g.targetAmount)} · due {fmtDate(g.targetDate)}</p>
          <div className="bar" aria-label="Goal progress"><span style={{ width: `${Math.min(100, g.savedSoFar / g.targetAmount * 100)}%` }} /></div>
          <p className="small muted">This month: {money(status?.allocatedThisMonth || 0)} · projected completion: {fmtDate(status?.eta)}</p>
          <div className="row"><button disabled={busy} onClick={() => { setEditing(g.id); setDraft({ ...g }); }}>Edit</button>
            <button disabled={busy} onClick={() => run(async () => { await postJson(`/api/goals/${g.id}`, { paused: !g.paused, version: g.version }, "PATCH"); reload(); })}>{g.paused ? "Resume" : "Pause"}</button>
            <button disabled={busy} onClick={() => { if (confirm(`Delete ${g.name}?`)) void run(async () => { await postJson(`/api/goals/${g.id}`, { version: g.version }, "DELETE"); reload(); }); }}>Delete</button></div>
        </div>;
      })}</div>
    </div>
    {(error || loadError) && <p className="error" role="alert">{error || loadError}</p>}{message && <p className="note" role="status">{message}</p>}
    {data?.history.length ? <div className="card"><h2>Recent changes</h2>{data.history.slice(0, 10).map((h, i) => <p className="small" key={`${h.at}-${i}`}><strong>{h.name}</strong> · {h.summary}</p>)}</div> : null}
  </div>;
}
