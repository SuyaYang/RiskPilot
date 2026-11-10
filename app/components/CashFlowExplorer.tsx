"use client";
import { useState } from "react";
import type { ForecastResult } from "@/lib/types";
import type { PurchaseReview } from "@/lib/orderReview";
import { BalanceChart, fmtDate, money } from "./ui";

export default function CashFlowExplorer({ baseline, forecast, buffer, upcoming, label }: {
  baseline: ForecastResult; forecast: ForecastResult; buffer: number;
  upcoming: PurchaseReview["context"]["upcoming"]; label: string;
}) {
  const [day, setDay] = useState(0);
  const selected = forecast.dailyBalances[day];
  const bills = upcoming.filter(item => item.date === selected?.date);
  return <section className="card cash-explorer" aria-labelledby="cash-flow-heading">
    <div className="row between"><div><h2 id="cash-flow-heading">Your next 45 days</h2><p className="small muted">Compare {label.toLowerCase()} with skipping this purchase.</p></div><span className="badge gray">Projection</span></div>
    <div className="flow-legend"><span><i className="legend-dot" />Selected scenario</span><span><i className="legend-line" />Without purchase</span><span><i className="legend-line buffer" />Cash buffer</span></div>
    <BalanceChart series={forecast.dailyBalances} compare={baseline.dailyBalances} buffer={buffer} activeIndex={day} events={upcoming} />
    <label className="chart-scrubber">Explore a day <strong>{fmtDate(selected?.date)}</strong><input type="range" min={0} max={Math.max(0, forecast.dailyBalances.length - 1)} value={day} onChange={event => setDay(Number(event.target.value))} aria-label="Explore forecast day" aria-valuetext={`${fmtDate(selected?.date)}: projected cash ${money(selected?.balance ?? 0)}`} /></label>
    <div className="day-readout" aria-live="polite"><div><span>Selected scenario</span><strong>{money(selected?.balance ?? 0)}</strong></div><div><span>Without purchase</span><strong>{money(baseline.dailyBalances[day]?.balance ?? 0)}</strong></div><div><span>Due this day</span><strong>{bills.length ? money(bills.reduce((sum, item) => sum + item.amount, 0)) : "—"}</strong></div></div>
    <p className="small muted chart-day-events">{bills.length ? bills.map(item => item.label).join(" · ") : "No scheduled bills or purchase reserves on this day. Everyday spending remains in the forecast."}</p>
    <details><summary>Upcoming bills & commitments <span className="muted">({upcoming.length})</span></summary><ul className="commitment-list">{upcoming.map((item, index) => <li key={`${item.date}-${index}`}><div><strong>{item.label}</strong><span>{fmtDate(item.date)} · {item.source === "fixture" ? "Fictional scheduled bill" : "Recorded purchase reserve"}</span></div><strong>{money(item.amount)}</strong></li>)}</ul>{!upcoming.length && <p className="small muted">No scheduled commitments within this chart.</p>}</details>
    <p className="chart-note">Daily balances are projections from fictional inputs. Risk checks extend through {fmtDate(forecast.evaluatedThrough)} to include later payments.</p>
  </section>;
}
