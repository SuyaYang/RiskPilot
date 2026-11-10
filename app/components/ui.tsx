"use client";
import { useCallback, useEffect, useState, useRef } from "react";

export const money = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(`${s.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—";

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
    fetch(url, { cache: "no-store", signal: request.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Request failed");
        if (!request.signal.aborted) { setData(j); setError(null); }
      })
      .catch((e) => { if (!request.signal.aborted) setError(e.message); });
  }, [url]);
  useEffect(() => {
    load();
    window.addEventListener("rp:refresh", load);
    return () => { window.removeEventListener("rp:refresh", load); controller.current?.abort(); };
  }, [load]);
  return { data, error, reload: load };
}

export async function postJson(url: string, body: unknown, method = "POST") {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

/** 45-day balance line with the cash buffer drawn as a dashed line. */
export function BalanceChart({
  series,
  buffer,
  compare,
}: {
  series: { date: string; balance: number }[];
  buffer: number;
  compare?: { date: string; balance: number }[];
}) {
  const W = 640;
  const H = 200;
  const P = { l: 56, r: 12, t: 12, b: 26 };
  const all = [...series, ...(compare ?? [])].map((d) => d.balance).concat(buffer, 0);
  const max = Math.max(...all);
  const min = Math.min(...all);
  const span = max - min || 1;
  const x = (i: number) => P.l + (i / Math.max(1, series.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - min) / span) * (H - P.t - P.b);
  const path = (s: { balance: number }[]) => s.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.balance).toFixed(1)}`).join(" ");
  const ticks = [max, (max + min) / 2, min];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Projected balance for the next 45 days">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
          <text x={P.l - 6} y={y(t) + 4} fontSize={11} textAnchor="end" fill="var(--muted)">
            {money(t)}
          </text>
        </g>
      ))}
      <line x1={P.l} x2={W - P.r} y1={y(buffer)} y2={y(buffer)} stroke="var(--amber)" strokeDasharray="5 4" strokeWidth={1.5} />
      <text x={W - P.r} y={y(buffer) - 5} fontSize={11} textAnchor="end" fill="var(--amber)">
        Cash buffer {money(buffer)}
      </text>
      {compare && <path d={path(compare)} fill="none" stroke="var(--muted)" strokeDasharray="3 3" strokeWidth={1.5} />}
      <path d={path(series)} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
      {[0, Math.floor(series.length / 2), series.length - 1].map((i, k) => (
        <text key={i} x={x(i)} y={H - 6} fontSize={11} textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"} fill="var(--muted)">
          {fmtDate(series[i]?.date)}
        </text>
      ))}
    </svg>
  );
}
