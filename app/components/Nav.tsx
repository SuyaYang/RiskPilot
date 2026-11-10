"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "./Icon";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/goals", label: "Goals" },
  { href: "/shop", label: "Shop" },
  { href: "/invest", label: "Invest" },
];

export default function Nav() {
  const path = usePathname();
  const [personas, setPersonas] = useState<{ id: string; name: string; tagline: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState("alex");

  useEffect(() => {
    fetch("/api/personas")
      .then(async (r) => { if (!r.ok) throw new Error("Could not load personas"); return r.json(); })
      .then((j) => {
        setPersonas(j.personas);
        setActive(j.active);
      }).catch(() => setError("Could not load demo personas. Reload to retry."));
  }, []);

  async function choose(id: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/personas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.dispatchEvent(new Event("rp:persona"));
      setActive(id);
      window.dispatchEvent(new Event("rp:refresh"));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function resetDemo() {
    if (!window.confirm("Reset this demo persona (goals, simulated purchases)?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.dispatchEvent(new Event("rp:persona"));
      window.dispatchEvent(new Event("rp:refresh"));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <nav className="nav" aria-label="Main navigation">
      <div className="nav-inner">
        <Link href="/" className="brand" aria-label="RiskPilot home"><span className="brand-mark"><Icon name="chart" size={23} /></span>RiskPilot<span className="brand-period">.</span></Link>
        <div className="nav-links">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""} aria-current={path === l.href ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
        </div>
        <span className="spacer" />
        <div className="persona-control"><span className="avatar" aria-hidden="true">{active.slice(0, 1).toUpperCase()}</span><label className="sr-only" htmlFor="demo-persona">Demo persona</label>
        <select id="demo-persona" disabled={busy} aria-label="Demo persona" value={active} onChange={(e) => choose(e.target.value)}>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · Demo profile
            </option>
          ))}
        </select>
        </div>
        <button disabled={busy} onClick={resetDemo} className="small reset-button">
          Reset demo
        </button>
        {error && <span className="error" role="alert">{error}</span>}
      </div>
    </nav>
  );
}
