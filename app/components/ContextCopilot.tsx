"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Icon from "./Icon";
export type ContextQuestion = { id: string; label: string; answer: ReactNode };

/** Guided read-only explanations from the page's API data; never impersonates an AI response. */
export default function ContextCopilot({ page, questions, source = "Current page facts", decisionId }: { page: string; questions: ContextQuestion[]; source?: string; decisionId?: string }) {
  const [open, setOpen] = useState(false), [selected, setSelected] = useState<string | null>(null);
  const [input,setInput]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [reply,setReply]=useState<{question:string;text:string;source:string}|null>(null);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>{const clear=()=>{controller.current?.abort();controller.current=null;setBusy(false);setReply(null);setSelected(null);setError("");setInput("");};window.addEventListener("rp:persona",clear);window.addEventListener("rp:refresh",clear);return()=>{controller.current?.abort();window.removeEventListener("rp:persona",clear);window.removeEventListener("rp:refresh",clear);};},[]);
  useEffect(()=>{controller.current?.abort();controller.current=null;setReply(null);setError("");setBusy(false);},[decisionId]);
  async function ask(event:FormEvent) {
    event.preventDefault();if(busy||!input.trim())return;
    const question=input.trim(),abort=new AbortController();controller.current?.abort();controller.current=abort;
    const timer=setTimeout(()=>abort.abort(),35000);
    setBusy(true);setError("");setSelected(null);setReply(null);
    try {
      const response=await fetch("/api/copilot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,page,decisionId}),signal:abort.signal});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not get an answer. Please retry.");
      if(!abort.signal.aborted)setReply({question,text:result.text,source:result.source});
    }catch(error){if(controller.current===abort)setError((error as Error).name==="AbortError"?"The request timed out. Please retry.":(error as Error).message);}
    finally{clearTimeout(timer);if(controller.current===abort)setBusy(false);}
  }
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) panel.current?.focus(); }, [open]);
  const answer = questions.find(question => question.id === selected);
  function close() { setOpen(false); trigger.current?.focus(); }
  return <>
    <button ref={trigger} className="copilot-launcher" aria-expanded={open} aria-controls="context-copilot" onClick={() => open ? close() : setOpen(true)}><Icon name="spark" size={18} />Ask RiskPilot {open ? "−" : "+"}</button>
    {open && <div className="copilot-panel" id="context-copilot" role="dialog" aria-modal="false" aria-label={`Ask RiskPilot about ${page}`} tabIndex={-1} ref={panel} onKeyDown={event => { if (event.key === "Escape") close(); }}>
      <div className="copilot-heading"><div className="row"><Icon name="spark" /><div><strong>Ask RiskPilot</strong><span>{page}</span></div></div><button onClick={close} aria-label="Close assistant">×</button></div>
      <div className="copilot-body"><p className="small muted">Ask your own question, or explore a suggested topic.</p><div className="copilot-questions">{questions.map(question => <button key={question.id} aria-pressed={selected === question.id} onClick={() => { setSelected(question.id); setReply(null); setError(""); }} disabled={busy}>{question.label}</button>)}</div>
        {answer && <div className="copilot-answer" aria-live="polite"><strong>{answer.label}</strong><div className="context-answer">{answer.answer}</div><span className="small muted">{source}</span></div>}
        {busy&&<p className="small muted copilot-request-status" role="status">Checking your current figures with Gemini…</p>}
        {reply&&<div className="copilot-answer" aria-live="polite"><strong>{reply.question}</strong><p style={{whiteSpace:"pre-line"}}>{reply.text}</p><span className="small muted">{reply.source==="ai"?"Gemini-selected engine facts":"Outside the available data"}</span></div>}
        {error&&<p className="error small copilot-request-status" role="alert">{error}</p>}
      </div><form className="copilot-composer" onSubmit={ask}><label htmlFor="copilot-question" className="sr-only">Your question for RiskPilot</label><textarea id="copilot-question" value={input} maxLength={800} onChange={event=>setInput(event.target.value)} placeholder="Ask about your cash, goals or purchase…" rows={2} disabled={busy}/><button type="submit" className="primary" disabled={busy||!input.trim()}>{busy?"Thinking…":"Send"}</button></form><div className="copilot-footnote">Questions and selected fictional profile facts are sent to Google Gemini. Read-only answers; no payments or account changes.</div>
    </div>}
  </>;
}
