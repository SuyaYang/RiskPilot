"use client";
import { useState } from "react";
import type { InvestableResult } from "@/lib/engine/investable";
import { fmtDate, money, postJson, useApi } from "../components/ui";
type Mix = { label: string; cash: number; bonds: number; index: number };
type Prefs = { horizon: "short" | "medium" | "long"; risk: "conservative" | "balanced" | "growth" };
function Concept({ id, q }: { id: string; q: string }) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  return <details onToggle={async e => {
    if (!e.currentTarget.open || answer || loading) return;
    setLoading(true); setError("");
    try { const r = await fetch(`/api/concepts?id=${id}`); const j = await r.json(); if (!r.ok) throw new Error("Could not load. Close and reopen to retry."); setAnswer(j.answer); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }}><summary>{q}</summary><p className="small muted">{error || answer || "Loading…"}</p></details>;
}

export default function Invest() {
  const { data, error, reload } = useApi<{ investable: InvestableResult; prefs: Prefs; templates: Record<string, Record<string, Mix>>; concepts: { id: string; q: string }[] }>("/api/invest");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function choose(prefs: Prefs) {
    setBusy(true); setMessage("");
    try { await postJson("/api/invest", prefs); reload(); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading…</p>;
  const { investable: inv, prefs } = data;
  const mix = data.templates[prefs.horizon][prefs.risk];
  return <div className="stack">
    <h1>Available to allocate</h1><p className="sub">Educational scenarios using fictional data. No funds are transferred and no trades are placed.</p>
    <div className="grid g2"><div className="card stack"><h2>Cash capacity today</h2><div className="big">{money(inv.investable)}</div>
      <p className="small muted">Based on the lowest projected balance, your buffer, upcoming obligations and protected spending goals.</p>
      <table><tbody><tr><td>Lowest projected balance</td><td>{money(inv.minBalance)} on {fmtDate(inv.minBalanceDate)}</td></tr><tr><td>Cash buffer</td><td>{money(inv.buffer)}</td></tr><tr><td>Goal reserve this month</td><td>{money(inv.reservedForGoals)}</td></tr></tbody></table>
      {inv.checks.map(c => <p className="check small" key={c.id}><span className={`badge ${c.ok ? "green" : "yellow"}`}>{c.ok ? "Pass" : "Hold"}</span>{c.label}</p>)}
    </div><div className="card stack"><h2>Explore an allocation</h2>
      <label>When might you need this money?<select disabled={busy} value={prefs.horizon} onChange={e => choose({ ...prefs, horizon: e.target.value as Prefs["horizon"] })}><option value="short">Within 3 years</option><option value="medium">3–7 years</option><option value="long">More than 7 years</option></select></label>
      <label>Scenario risk preference<select disabled={busy} value={prefs.risk} onChange={e => choose({ ...prefs, risk: e.target.value as Prefs["risk"] })}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="growth">Growth</option></select></label>
      <h3>{mix.label}</h3><table><tbody><tr><td>Cash / savings</td><td>{mix.cash}%</td></tr><tr><td>Bond funds</td><td>{mix.bonds}%</td></tr><tr><td>Broad index funds</td><td>{mix.index}%</td></tr></tbody></table>
      <p className="small muted">Illustration only. These percentages are educational templates, not a recommendation or a forecast of investment returns.</p>
    </div></div>
    {message && <p className="error" role="alert">{message}</p>}
    <div className="card stack"><h2>Learn the basics</h2>{data.concepts.map(c => <Concept key={c.id} {...c} />)}</div>
  </div>;
}
