"use client";
import Link from "next/link";
import { BalanceChart, fmtDate, money, RiskBadge, useApi } from "./components/ui";

interface Snapshot {
  persona: { name: string; tagline: string; buffer: number; savingsBalance: number };
  forecast: {
    startBalance: number;
    dailyBalances: { date: string; balance: number }[];
    minBalance: number;
    minBalanceDate: string;
    bufferGap: number;
    risk: "green" | "yellow" | "red";
  };
  allocation: { monthlySurplus: number; goals: { goalId: string; name: string; type: string; status: string; eta: string | null; targetDate: string; allocatedThisMonth: number; remaining: number }[] };
  investable: { investable: number };
  upcomingPayments: { date: string; amount: number; label: string }[];
  goals: { id: string; targetAmount: number; savedSoFar: number }[];
}

const STATUS: Record<string, { label: string; cls: string }> = {
  on_track: { label: "On track", cls: "green" },
  delayed: { label: "Delayed", cls: "yellow" },
  paused: { label: "Paused", cls: "gray" },
  done: { label: "Done", cls: "green" },
};

export default function Dashboard() {
  const { data, error } = useApi<Snapshot>("/api/snapshot");
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const { persona, forecast: f, allocation, investable, upcomingPayments } = data;

  return (
    <div className="stack">
      <h1>Hi {persona.name}</h1>
      <p className="sub">{persona.tagline}. Everything below is projected for the next 45 days.</p>

      <div className="grid g3">
        <div className="card">
          <div className="muted small">Checking balance now</div>
          <div className="big">{money(f.startBalance)}</div>
          <div className="small muted">Savings {money(persona.savingsBalance)} · buffer {money(persona.buffer)}</div>
        </div>
        <div className="card">
          <div className="muted small">Lowest projected balance</div>
          <div className="big">{money(f.minBalance)}</div>
          <div className="row small">
            <RiskBadge risk={f.risk} />
            <span className="muted">on {fmtDate(f.minBalanceDate)}</span>
          </div>
        </div>
        <Link href="/invest" className="card" style={{ color: "inherit" }}>
          <div className="muted small">Investable now</div>
          <div className="big">{money(investable.investable)}</div>
          <div className="small muted">After bills, your buffer and this month&apos;s goal savings →</div>
        </Link>
      </div>

      <div className="card">
        <h2>Next 45 days</h2>
        <BalanceChart series={f.dailyBalances} buffer={persona.buffer} />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="row between">
            <h2>Goals</h2>
            <Link href="/goals" className="small">
              Edit goals
            </Link>
          </div>
          <p className="small muted">You can set aside about {money(allocation.monthlySurplus)} a month.</p>
          <table>
            <thead>
              <tr>
                <th>Goal</th>
                <th>This month</th>
                <th>Expected</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {allocation.goals.map((g) => (
                <tr key={g.goalId}>
                  <td>
                    {g.name}
                    {g.type === "invest" && <span className="badge blue" style={{ marginLeft: 6 }}>invest</span>}
                  </td>
                  <td>{money(g.allocatedThisMonth)}</td>
                  <td>{g.status === "paused" ? "—" : g.eta ? fmtDate(g.eta) : "not reachable"}</td>
                  <td>
                    <span className={`badge ${STATUS[g.status].cls}`}>{STATUS[g.status].label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Upcoming PayPal payments</h2>
          {upcomingPayments.length === 0 ? (
            <p className="muted small">
              None yet. <Link href="/shop">Try a purchase</Link> to see how it changes your plan.
            </p>
          ) : (
            <table>
              <tbody>
                {upcomingPayments.map((p, i) => (
                  <tr key={i}>
                    <td>{fmtDate(p.date)}</td>
                    <td>{p.label}</td>
                    <td>{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
