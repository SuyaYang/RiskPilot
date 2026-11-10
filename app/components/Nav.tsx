"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/goals", label: "Goals" },
  { href: "/shop", label: "Shop" },
  { href: "/invest", label: "Invest" },
];

export default function Nav() {
  const path = usePathname();
  const [personas, setPersonas] = useState<{ id: string; name: string; tagline: string }[]>([]);
  const [active, setActive] = useState("alex");

  useEffect(() => {
    fetch("/api/personas")
      .then((r) => r.json())
      .then((j) => {
        setPersonas(j.personas);
        setActive(j.active);
      });
  }, []);

  async function choose(id: string) {
    await fetch("/api/personas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setActive(id);
    window.dispatchEvent(new Event("rp:refresh"));
  }

  async function resetDemo() {
    if (!window.confirm("Reset all demo data (goals, purchases)?")) return;
    await fetch("/api/reset", { method: "POST" });
    window.dispatchEvent(new Event("rp:refresh"));
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <span className="brand">RiskPilot Checkout</span>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}>
            {l.label}
          </Link>
        ))}
        <span className="spacer" />
        <select aria-label="Demo persona" value={active} onChange={(e) => choose(e.target.value)}>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.tagline}
            </option>
          ))}
        </select>
        <button onClick={resetDemo} className="small">
          Reset demo
        </button>
      </div>
    </nav>
  );
}
