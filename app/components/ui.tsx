"use client";
import { useCallback, useEffect, useState, useRef } from "react";

export const money = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(`${s.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—";

export const fullDate = (s: string | null | undefined) =>
  s ? new Date(`${s.slice(0,10)}T00:00:00Z`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}) : "Not projected";

export function RiskBadge({ risk }: { risk: "green" | "yellow" | "red" }) {
  const label = risk === "green" ? "Within buffer" : risk === "yellow" ? "Caution" : "Risky";
  return <span className={`badge ${risk}`}>{label}</span>;
}

/** Fetch JSON and refetch whenever the persona changes or data is reset. */
export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setData(null); setError(null);
    const deadline=setTimeout(()=>{
      if(controller.current===request && !request.signal.aborted){request.abort();setError("This request timed out. Please try again.");}
    },20000);
    fetch(url, { cache: "no-store", signal: request.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Request failed");
        if (!request.signal.aborted) { setData(j); setError(null); }
      })
      .catch((e) => { if (!request.signal.aborted) setError(e.message); })
      .finally(()=>clearTimeout(deadline));
  }, [url]);
  useEffect(() => {
    load();
    window.addEventListener("rp:refresh", load);
    return () => { window.removeEventListener("rp:refresh", load); controller.current?.abort(); };
  }, [load]);
  return { data, error, reload: load };
}

export async function postJson(url: string, body: unknown, method = "POST") {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal:AbortSignal.timeout(40000) }).catch(error=>{
    if(error.name==="TimeoutError")throw new Error("The request timed out. Check the current status before retrying.");
    throw error;
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

/** 45-day balance line with the cash buffer drawn as a dashed line. */
export function BalanceChart({
  series,
  buffer,
  compare,
  activeIndex,
  events = [],
}: {
  series: { date: string; balance: number }[];
  buffer: number;
  compare?: { date: string; balance: number }[];
  activeIndex?: number;
  events?: { date: string; label: string }[];
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.min(900, entry.contentRect.width))));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const W = width;
  const H = 230;
  const P = { l: 66, r: 14, t: 18, b: 30 };
  const all = [...series, ...(compare ?? [])].map((d) => d.balance).concat(buffer, 0);
  const max = Math.max(...all);
  const min = Math.min(...all);
  const span = max - min || 1;
  const x = (i: number) => P.l + (i / Math.max(1, series.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - min) / span) * (H - P.t - P.b);
  const path = (s: { balance: number }[]) => s.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.balance).toFixed(1)}`).join(" ");
  const ticks = [...new Set([max, (max + min) / 2, min])];
  const selected = hoverIndex ?? activeIndex;
  const selectedDay = selected !== undefined ? series[selected] : undefined;
  const tooltipX = selected !== undefined ? Math.max(P.l, Math.min(x(selected) + 10, W - 222)) : P.l;
  return (
    <div ref={viewport} className="balance-chart-viewport" role="region" aria-label="Cash flow projection"><svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Projected balance for the next 45 days" onPointerMove={event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const position = (event.clientX - bounds.left) / bounds.width * W;
      setHoverIndex(Math.max(0, Math.min(series.length - 1, Math.round((position - P.l) / (W - P.l - P.r) * (series.length - 1)))));
    }} onPointerLeave={() => setHoverIndex(null)}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
          <text x={P.l - 6} y={y(t) + 4} fontSize={13} textAnchor="end" fill="var(--muted)">
            {money(t)}
          </text>
        </g>
      ))}
      <line x1={P.l} x2={W - P.r} y1={y(buffer)} y2={y(buffer)} stroke="var(--warning)" strokeDasharray="5 4" strokeWidth={1.5} />
      <text x={W - P.r} y={y(buffer) - 5} fontSize={13} textAnchor="end" fill="var(--amber)">
        Cash buffer {money(buffer)}
      </text>
      {compare && <path d={path(compare)} fill="none" stroke="var(--chart-baseline)" strokeDasharray="3 3" strokeWidth={1.5} />}
      <path d={path(series)} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {events.filter((event, index, list) => list.findIndex(item => item.date === event.date) === index).map(event => {
        const i = series.findIndex(day => day.date === event.date);
        return i < 0 ? null : <circle key={event.date} cx={x(i)} cy={y(series[i].balance)} r={3.5} fill="var(--card)" stroke="var(--accent)" strokeWidth={1.5}><title>{event.label} · {fmtDate(event.date)}</title></circle>;
      })}
      {selected !== undefined && selectedDay && <g><line x1={x(selected)} x2={x(selected)} y1={P.t} y2={H-P.b} stroke="var(--chart-baseline)" strokeDasharray="3 3" opacity=".5" /><circle cx={x(selected)} cy={y(selectedDay.balance)} r={4.5} fill="var(--accent)" stroke="var(--card)" strokeWidth={2} /></g>}
      {[0, Math.floor(series.length / 2), series.length - 1].map((i, k) => (
        <text key={i} x={x(i)} y={H - 6} fontSize={13} textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"} fill="var(--muted)">
          {fmtDate(series[i]?.date)}
        </text>
      ))}
      {hoverIndex !== null && selectedDay && <g className="chart-tooltip" pointerEvents="none"><rect x={tooltipX} y={P.t} width={210} height={compare ? 79 : 57} rx={8} fill="var(--card)" stroke="var(--line)" /><text x={tooltipX + 12} y={P.t + 20} fontSize={13} fill="var(--muted)">{fmtDate(selectedDay.date)}</text><text x={tooltipX + 12} y={P.t + 42} fontSize={13} fontWeight={650} fill="var(--ink)">Scenario {money(selectedDay.balance)}</text>{compare && <text x={tooltipX + 12} y={P.t + 64} fontSize={13} fill="var(--muted)">Without purchase {compare[hoverIndex] ? money(compare[hoverIndex].balance) : "—"}</text>}</g>}
    </svg></div>
  );
}
