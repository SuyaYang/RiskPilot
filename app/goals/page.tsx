"use client";
import LoadingState from "../components/LoadingState";
import ContextCopilot from "../components/ContextCopilot";
import Icon from "../components/Icon";
import { progressPercent } from "@/lib/presentation";
import { useState, useRef, type FormEvent, useEffect } from "react";
import type { Goal, Allocation } from "@/lib/types";
import { fmtDate, money, postJson, useApi } from "../components/ui";
type Draft = Omit<Goal, "id">;
const empty: Draft = { name: "", type: "spend", targetAmount: 1000, savedSoFar: 0, targetDate: "", priority: 2 };
export default function Goals() {
  const { data, error: loadError, reload } = useApi<{ goals: Goal[]; allocation: Allocation; history: { at: string; name: string; summary: string }[] }>("/api/goals");
  const [planner, setPlanner] = useState(false);
  const [plannerRequest, setPlannerRequest] = useState(0);
  const plannerRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const clear = () => { setDraft(empty); setEditing(null); setMessage(""); setText(""); setPlanner(false); };
    window.addEventListener("rp:persona", clear);
    return () => window.removeEventListener("rp:persona", clear);
  }, []);
  useEffect(() => {
    if (!planner) return;
    // The editor sits above the goal cards; bring it into view after React mounts it.
    plannerRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    nameRef.current?.focus({ preventScroll: true });
  }, [planner, editing, plannerRequest]);
  function openPlanner(goal?: Goal) {
    setEditing(goal?.id ?? null); setDraft(goal ? { ...goal } : { ...empty });
    setError(""); setMessage(""); setPlanner(true);
    // Also reveal an already-open editor when the same goal is selected again.
    setPlannerRequest(request => request + 1);
  }
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
  if (!data && !loadError) return <LoadingState label="Loading your goals" />;
  if (!data) return <div className="card stack"><h1>Goals unavailable</h1><p className="error" role="alert">{loadError}</p><button onClick={reload}>Try again</button></div>;
  const total = data.goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const saved = data.goals.reduce((sum, goal) => sum + Math.min(goal.savedSoFar, goal.targetAmount), 0);
  const overall = progressPercent(saved,total);
  const ordered = [...data.goals].sort((a,b) => Number(Boolean(a.paused))-Number(Boolean(b.paused)) || a.priority-b.priority || a.targetDate.localeCompare(b.targetDate));
  const featured = ordered.find(goal => !goal.paused && goal.savedSoFar < goal.targetAmount) || ordered[0];
  const milestones = data.allocation.goals.filter(goal => !["paused","done"].includes(goal.status)).sort((a,b) => (a.eta || "9999").localeCompare(b.eta || "9999"));
  function goalCard(goal: Goal, primary = false) {
    const status = data!.allocation.goals.find(item => item.goalId === goal.id);
    const percent = progressPercent(goal.savedSoFar,goal.targetAmount);
    return <article key={goal.id} className={`goal-project ${primary ? "featured-goal" : ""}`}>
      <div className="row between"><span className="goal-purpose"><Icon name={goal.type === "invest" ? "chart" : "target"} size={17} />{primary ? "Your primary focus" : goal.type === "invest" ? "Investing goal" : "Savings goal"}</span><span className={`badge ${status?.status === "delayed" ? "yellow" : "gray"}`}>{goal.paused ? "Paused" : status?.status.replaceAll("_"," ") || "Status unknown"}</span></div>
      <h2>{goal.name}</h2><div className="goal-funding"><div><strong>{money(goal.savedSoFar)}</strong><span>saved toward {money(goal.targetAmount)}</span></div><strong className="goal-percent">{percent}%</strong></div>
      <div className="goal-track" role="progressbar" aria-label={`${goal.name} saved progress`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${percent}%`}} /></div>
      {primary && <div className="goal-milestones" aria-label="Savings milestones">{[25,50,75,100].map(mark => <span key={mark} className={percent>=mark ? "reached" : ""}><i>{percent>=mark ? "✓" : ""}</i>{mark}%</span>)}</div>}
      <div className="goal-dates"><div><span>Target date</span><strong>{fmtDate(goal.targetDate)}</strong></div><div><span>Predicted completion</span><strong>{goal.paused ? "Paused" : status?.eta ? fmtDate(status.eta) : "Not projected"}</strong></div></div>
      <p className="small muted">Saved amount: manual demo input. Monthly allocation: {status ? money(status.allocatedThisMonth) : "unknown"}, projected.</p>
      {status?.status === "delayed" && <p className="goal-adjust-note">{status.eta ? `Currently projected after your target date. Review the amount, priority or deadline.` : "The goal is not funded within the engine's evaluated allocation horizon. Review its target or priority."}</p>}
      <div className="goal-actions"><button disabled={busy} aria-controls="goal-planner" aria-expanded={planner && editing === goal.id} onClick={() => openPlanner(goal)}>Edit plan</button><button disabled={busy} onClick={() => run(async () => { await postJson(`/api/goals/${goal.id}`, { paused: !goal.paused, version:goal.version }, "PATCH"); reload(); })}>{goal.paused ? "Resume" : "Pause"}</button><button className="text-action" disabled={busy} onClick={() => { if (confirm(`Delete ${goal.name}?`)) void run(async () => { await postJson(`/api/goals/${goal.id}`, {version:goal.version}, "DELETE"); reload(); }); }}>Delete</button></div>
    </article>;
  }
  return <div className="goals-page">
    <header className="goals-hero"><div><span className="page-kicker">Progress & milestones</span><h1>Make space for<br />what matters.</h1><p className="sub">Your goals, made tangible. Track what you&apos;ve saved and what the plan predicts.</p><button className="primary" aria-expanded={planner} aria-controls="goal-planner" onClick={() => planner && !editing ? setPlanner(false) : openPlanner()}>+ Add a goal</button></div><div className="overall-progress"><svg viewBox="0 0 160 160" role="img" aria-label={`${overall}% saved toward all goal targets`}><circle cx="80" cy="80" r="66" fill="none" stroke="var(--divider)" strokeWidth="9" /><circle cx="80" cy="80" r="66" fill="none" stroke="var(--accent)" strokeWidth="9" pathLength="100" strokeDasharray={`${overall} 100`} strokeLinecap="round" transform="rotate(-90 80 80)" /></svg><div><strong>{overall}%</strong><span>of goal targets saved</span></div><p>{money(saved)} / {money(total)}<span>Across {data.goals.length} goals · manual inputs</span></p></div></header>
    {planner && <section ref={plannerRef} id="goal-planner" className="card goal-planner stack" aria-label="Goal planning form"><h2>{editing ? "Edit goal" : "Add a goal"}</h2>
        {!editing && <div className="stack"><label>Describe a goal<input value={text} onChange={e => setText(e.target.value)} placeholder="Japan trip by next March, $3,000" maxLength={300} /></label>
          <button disabled={busy || !text.trim()} onClick={() => run(async () => {
            const result = await postJson("/api/goals/parse", { text });
            setDraft({ ...empty, ...result.draft });
            setMessage("Draft only. Check the amount and date, then confirm to save.");
          })}>Draft with AI</button><p className="small muted">If AI is unavailable, use the form. A draft never saves automatically.</p></div>}
        <form className="stack" onSubmit={save}>
          <label>Name<input ref={nameRef} required maxLength={60} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
          <div className="grid g2"><label>Target amount (USD)<input required type="number" min="0.01" step="0.01" value={draft.targetAmount} onChange={e => setDraft({ ...draft, targetAmount: Number(e.target.value) })} /></label>
            <label>Already saved (USD)<input required type="number" min="0" step="0.01" value={draft.savedSoFar} onChange={e => setDraft({ ...draft, savedSoFar: Number(e.target.value) })} /></label></div>
          <label>Target date<input required type="date" value={draft.targetDate} onInput={e => { const targetDate = e.currentTarget.value; setDraft(current => ({ ...current, targetDate })); }} onChange={e => { const targetDate = e.target.value; setDraft(current => ({ ...current, targetDate })); }} /></label>
          <label>Purpose<select value={draft.type} disabled={Boolean(editing)} onChange={e => setDraft({ ...draft, type: e.target.value as Draft["type"] })}><option value="spend">Save for spending</option><option value="invest">Save to invest</option></select></label>
          <label>Priority<select value={draft.priority} onChange={e => setDraft({ ...draft, priority: Number(e.target.value) as Draft["priority"] })}><option value={1}>High</option><option value={2}>Medium</option><option value={3}>Low</option></select></label>
          <div className="row"><button className="primary" disabled={busy}>{editing ? "Save changes" : "Confirm and save goal"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setDraft(empty); }}>Cancel edit</button>}</div>
        </form><div className="row"><button className="text-action" onClick={() => setPlanner(false)}>Close planner</button></div></section>}
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="note" role="status">{message}</p>}
    {featured ? <div className="goals-composition"><div>{goalCard(featured,true)}</div><section className="milestone-panel"><div className="row between"><h2>Your milestones ahead</h2><Icon name="target" size={19} /></div><p className="small muted">Engine-predicted dates, separate from your chosen deadlines.</p>{milestones.length ? <ol className="milestone-timeline">{milestones.map(goal => <li key={goal.goalId}><i /><span className="small muted">{goal.eta ? `Est. ${fmtDate(goal.eta)}` : "Completion not projected"}</span><strong>{goal.name}</strong><span>Target {fmtDate(goal.targetDate)}</span></li>)}</ol> : <p className="small muted">No active milestones. Resume a paused goal or add a new one.</p>}</section></div> : <div className="card empty-state"><Icon name="target" size={34} /><h2>What are you working toward?</h2><p className="muted">Add a goal to see saved progress and a predicted completion date.</p><button onClick={() => openPlanner()}>Create your first goal</button></div>}
    {ordered.length > 1 && <section><div className="row between"><h2>Your other goals</h2><span className="small muted">Saved progress · fictional profile</span></div><div className="other-goals">{ordered.filter(goal => goal.id!==featured?.id).map(goal => goalCard(goal))}</div></section>}
    {data.history.length>0 && <details className="card goal-history"><summary>Plan changes ({data.history.length})</summary>{data.history.slice(0,10).map((change,index) => <div className="history-item" key={`${change.at}-${index}`}><span>{fmtDate(change.at)}</span><div><strong>{change.name}</strong><p>{change.summary || "Goal updated."}</p></div></div>)}</details>}
    <ContextCopilot page="Goals & milestones" questions={[
      {id:"track",label:"Am I on track for my savings goal?",answer:featured ? <p>{featured.name}: {data.allocation.goals.find(goal=>goal.goalId===featured.id)?.status.replaceAll("_"," ") || "status unavailable"}. The target is {fmtDate(featured.targetDate)}; predicted completion is {fmtDate(data.allocation.goals.find(goal=>goal.goalId===featured.id)?.eta)}. Saved progress comes from manual inputs.</p> : <p>Add a goal first to get an engine-generated plan.</p>},
      {id:"increase",label:"How would increasing savings affect my cash flow?",answer:<p>A contribution-increase cash-flow simulation is not implemented. The current engine allocates {money(data.allocation.monthlySurplus)} in monthly surplus across priorities. Editing a goal updates its plan; it does not move money or create a bank transaction.</p>},
    ]} />
  </div>;
}
