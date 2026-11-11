"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { postJson, useApi } from "../components/ui";
export default function DemoLogin() {
  const { data } = useApi<{account:{name:string;email:string;tier:string}}>("/api/account");
  const [email,setEmail] = useState(""), [busy,setBusy]=useState(false), [error,setError]=useState("");
  async function signIn(event:FormEvent) {
    event.preventDefault();if(busy)return;setBusy(true);setError("");
    try { await postJson("/api/account",{email});window.location.assign("/"); }
    catch(error){setError((error as Error).message);setBusy(false);}
  }
  return <section className="card demo-login"><span className="page-kicker">Fictional demo accounts</span><h1>Your account. One financial profile.</h1><p>Each account has its own fixed financial situation. Change accounts here; financial scenarios cannot be switched inside an account.</p>{data&&<p className="small muted">Current: {data.account.name} · {data.account.tier === "premium" ? "Premium demo" : "Basic demo"}</p>}<form onSubmit={signIn}><label>Demo email<input type="email" required value={email} placeholder="alex@riskpilot.demo" onChange={event=>setEmail(event.target.value)} autoComplete="off" /></label><button className="primary" disabled={busy}>{busy?"Opening account…":"Enter demo account"}</button>{error&&<p role="alert" className="error">{error}</p>}</form><details><summary>Demo account credentials</summary><p><strong>alex@riskpilot.demo</strong> · Premium demo — expandable checkout scenarios and What-if.</p><p><strong>jordan@riskpilot.demo</strong> · Basic demo — concise checkout explanation and all essential payment warnings.</p><p className="small muted">No password, real sign-in, subscription purchase or billing is implemented. Fictional data stays in this browser workspace. Demo emails are not real inboxes.</p></details><p className="small muted">RiskPilot demo identity is separate from your PayPal Sandbox buyer account. PayPal approval still requires its own Sandbox sign-in.</p><Link href="/shop">Explore a purchase without paying →</Link></section>;
}
