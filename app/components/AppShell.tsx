"use client";

import { usePathname } from "next/navigation";
import Nav from "./Nav";

// The presentation has no account navigation or financial-data hooks.
// Every product route retains the approved application shell.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/vision") return <>{children}</>;

  return <>
    <Nav />
    <div className="environment-bar"><span className="environment-dot" />Sandbox demo · Fictional finances</div>
    <main>{children}</main>
    <footer>
      <span className="footer-brand">RiskPilot<span>.</span></span><p>Independent demo using PayPal Sandbox · Fictional people and financial data.<br />Investing content is educational only. No real funds are moved.</p>
    </footer>
  </>;
}
