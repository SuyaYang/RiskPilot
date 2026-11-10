"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { MethodId } from "@/lib/types";
import { REVIEW_QUESTIONS, type ReviewQuestion } from "@/lib/reviewInsights";
import Icon from "./Icon";

type Answer = { text: string; source: "ai" | "template" | "unsupported"; uncertainty: string; inputHash: string };

export default function ReviewInsights({ orderId, inputHash, method, timing="now", fallback="" }: { orderId: string; inputHash: string; method: MethodId; timing?:"now"|"after_income"; fallback?:string }) {
  const [input,setInput]=useState(""),[customQuestion,setCustomQuestion]=useState("");
  const [overview, setOverview] = useState<Answer | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [question, setQuestion] = useState<ReviewQuestion | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const askButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [overviewError, setOverviewError] = useState("");
  async function request(question: ReviewQuestion, signal?: AbortSignal, prompt?: string): Promise<Answer> {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/insights`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, method, inputHash, prompt, timing }), signal: signal?AbortSignal.any([signal,AbortSignal.timeout(35000)]):AbortSignal.timeout(35000),
    });
    const data = await response.json();
    if (!response.ok || data.inputHash !== inputHash) throw new Error(data.error || "Refresh this review to get current insights.");
    return data;
  }
  useEffect(() => {
    const abort = new AbortController();
    request("overview", abort.signal).then(setOverview).catch(error => { if (!abort.signal.aborted) setOverviewError(error.message); });
    return () => { abort.abort(); controller.current?.abort(); };
    // The parent keys this component by the order, scenario and financial input hash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (open) panel.current?.focus(); }, [open]);
  function close() { setOpen(false); askButton.current?.focus(); }
  async function ask(next: ReviewQuestion, prompt?: string) {
    setCustomQuestion(prompt || "");
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setQuestion(next); setLoading(true); setError(""); setAnswer(null);
    try { const result = await request(next, abort.signal, prompt); if (!abort.signal.aborted) setAnswer(result); }
    catch (error) { if (!abort.signal.aborted) setError((error as Error).message); }
    finally { if (!abort.signal.aborted) setLoading(false); }
  }
  return <>
    <section className="insight-card" aria-labelledby="insight-title"><div className="row between"><div className="row"><span className="insight-icon"><Icon name="spark" /></span><h2 id="insight-title">RiskPilot insights</h2></div><span className="badge blue">{overview?.source === "ai" ? "AI · grounded facts" : "Engine facts"}</span></div>
      <p className="insight-copy" role="status">{overview?.text || fallback || "Reading your forecast…"}</p>
      <p className="small muted">{overview?.source === "template" ? "AI is unavailable; showing a deterministic engine summary. " : ""}Fictional inputs. Funding and loan terms remain unconfirmed.</p>
      {overviewError&&<p className="small muted" role="status">AI explanation is unavailable. The current engine summary is shown above.</p>}
      <button className="insight-ask" onClick={() => setOpen(true)}>Explore with RiskPilot <Icon name="arrow" size={15} /></button>
    </section>
    <button ref={askButton} className="copilot-launcher" onClick={() => open ? close() : setOpen(true)} aria-expanded={open} aria-controls="riskpilot-copilot"><Icon name="spark" size={18} />Ask RiskPilot {open ? "−" : "+"}</button>
    {open && <div ref={panel} tabIndex={-1} className="copilot-panel" id="riskpilot-copilot" role="dialog" aria-modal="false" aria-label="Ask RiskPilot" onKeyDown={event => { if (event.key === "Escape") close(); }}><div className="copilot-heading"><div className="row"><Icon name="spark" /><div><strong>Ask RiskPilot</strong><span>Understand this purchase</span></div></div><button aria-label="Close assistant" onClick={close}>×</button></div>
      <div className="copilot-body"><p className="small muted">Ask a question about this purchase, or choose a topic.</p><div className="copilot-questions">{(Object.keys(REVIEW_QUESTIONS) as ReviewQuestion[]).filter(id => id !== "overview").map(id => <button key={id} disabled={loading} aria-pressed={!customQuestion && question === id} onClick={() => ask(id)}>{REVIEW_QUESTIONS[id]}</button>)}</div>
        {question && <div className="copilot-answer" aria-live="polite"><strong>{customQuestion || REVIEW_QUESTIONS[question]}</strong><p>{loading ? "Checking the current forecast…" : error || answer?.text}</p>{answer && <span className="small muted">{answer.source === "ai" ? "Gemini-selected engine facts" : answer.source === "unsupported" ? "Outside the available data" : "Engine facts · AI fallback"}</span>}</div>}
      </div><form className="copilot-composer" onSubmit={(event:FormEvent)=>{event.preventDefault();if(!loading&&input.trim())void ask("overview",input.trim());}}><label className="sr-only" htmlFor="review-ai-question">Your purchase question</label><textarea id="review-ai-question" value={input} onChange={event=>setInput(event.target.value)} maxLength={800} rows={2} disabled={loading} placeholder="Ask about this purchase…"/><button type="submit" className="primary" disabled={loading||!input.trim()}>{loading?"Thinking…":"Send"}</button></form><div className="copilot-footnote">Questions &amp; demo facts go to Google Gemini.<br />Read-only · No payments or account changes.</div>
    </div>}
  </>;
}
