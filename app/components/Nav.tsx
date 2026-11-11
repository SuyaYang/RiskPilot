"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { useApi } from "./ui";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/goals", label: "Goals" },
  { href: "/shop", label: "Shop" },
  { href: "/invest", label: "Invest" },
];

export default function Nav() {
  const path = usePathname();
  const { data, error, reload } = useApi<{ account: { name: string } }>("/api/account");

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
        <Link href="/login" className="account-link" aria-label="Account and demo sign-in"><span className="avatar" aria-hidden="true">{data?.account.name.slice(0,1)||"A"}</span><span>{data?.account.name||"Account"}<small>Demo account</small></span></Link>
        {error && <span className="error" role="alert">{error}<button onClick={reload}>Retry account</button></span>}
      </div>
    </nav>
  );
}
