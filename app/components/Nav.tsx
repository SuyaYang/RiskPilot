"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import { postJson, useApi } from "./ui";

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

  const { data: profile, error: profileError, reload: retryProfile } = useApi<{ personas: typeof personas; active: string }>("/api/personas");
  useEffect(() => {
    if (profile) { setPersonas(profile.personas); setActive(profile.active); }
  }, [profile]);

  async function choose(id: string) {
    setBusy(true); setError("");
    try {
      await postJson("/api/personas", { id });
      window.dispatchEvent(new Event("rp:persona"));
      setActive(id);
      window.dispatchEvent(new Event("rp:refresh"));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function resetDemo() {
    if (!window.confirm("Reset this demo persona (goals, simulated purchases)?")) return;
    setBusy(true); setError("");
    try {
      await postJson("/api/reset", {});
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
            <Icon name={l.href === "/" ? "chart" : l.href === "/goals" ? "target" : l.href === "/shop" ? "bag" : "wallet"} size={19} />{l.label}
          </Link>
        ))}
        </div>
        <span className="spacer" />
        <details className="demo-controls"><summary>Demo profile</summary><div className="demo-controls-body"><div className="persona-control"><span className="avatar" aria-hidden="true">{active.slice(0, 1).toUpperCase()}</span><label className="sr-only" htmlFor="demo-persona">Demo persona</label>
        <select id="demo-persona" disabled={busy || !personas.length} aria-label="Demo persona" value={active} onChange={(e) => choose(e.target.value)}>
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
        </div></details>
        {(error || profileError) && <span className="error" role="alert">{error || profileError}{profileError && <button onClick={retryProfile}>Retry profiles</button>}</span>}
      </div>
    </nav>
  );
}
