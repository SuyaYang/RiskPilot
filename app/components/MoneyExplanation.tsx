"use client";
import { useEffect, useRef, useState } from "react";
import type { MoneyExplanation as Explanation, MoneyTopic } from "@/lib/planning/insights";
import type { BudgetPreview } from "@/lib/planning/preview";
const topics: { value: MoneyTopic; label: string }[] = [
  { value: "spending", label: "Historical spending patterns" }, { value: "income", label: "Expected income timing" },
  { value: "obligations", label: "Upcoming obligations" }, { value: "capacity", label: "Cash buffer & allocation capacity" },
];
export default function MoneyExplanation({ insightBasis, preview, onRefresh }: { insightBasis: string; preview?: BudgetPreview["confirmation"]; onRefresh: () => void }) {
  const [topic, setTopic] = useState<MoneyTopic>("capacity"), [answer, setAnswer] = useState<Explanation | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const generation = useRef(0), controller = useRef<AbortController | null>(null);
  const previewKey = JSON.stringify(preview);
  useEffect(() => {
    generation.current++; controller.current?.abort(); setAnswer(null); setError(""); setBusy(false);
    return () => { generation.current++; controller.current?.abort(); };
  }, [insightBasis, previewKey, topic]);
  async function explain() {
    if (busy) return;
    const version = ++generation.current, abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(""); setAnswer(null);
    try {
      const response = await fetch("/api/money-plan/insights", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: preview ? "budget_change" : topic, insightBasis, ...(preview ? { preview } : {}) }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Explanation unavailable. Please retry.");
      if (generation.current === version) setAnswer(result);
    } catch (error) { if (generation.current === version && !abort.signal.aborted) setError((error as Error).name === "TimeoutError" ? "The explanation timed out. Retry with current evidence." : (error as Error).message); }
    finally { if (generation.current === version) setBusy(false); }
  }
  return <div className="money-explanation">
    {!preview && <label>Explain a planning topic<select value={topic} disabled={busy} onChange={event => setTopic(event.target.value as MoneyTopic)}>{topics.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
    <button disabled={busy} onClick={explain}>{busy ? "Checking planning evidence…" : preview ? "Explain budget change" : "Explain this money plan"}</button>
    <p className="small muted">Aggregated fictional facts only. Gemini can order verified statements; it cannot calculate amounts or change your plan.</p>
    {answer && <div role="status"><p className="small">{answer.text}</p><span className="small muted">{answer.source === "ai" ? "Gemini · verified fact selection" : "Deterministic explanation · AI unavailable or unsupported response"}</span>
      <details><summary>Sources & assumptions</summary><ul>{Object.entries(answer.evidence).map(([id, fact]) => <li key={id}><p className="small">{fact.text}</p><span className="small muted">{fact.kind} · {fact.source} · {fact.period}</span></li>)}</ul></details>
    </div>}
    {error && <div><p className="error" role="alert">{error}</p><button onClick={onRefresh}>Refresh planning evidence</button></div>}
  </div>;
}
