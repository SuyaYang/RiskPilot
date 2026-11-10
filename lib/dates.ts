const DAY = 24 * 60 * 60 * 1000;

/** Today as a UTC-midnight Date. DEMO_TODAY (YYYY-MM-DD) pins the date for tests and recordings. */
export function today(): Date {
  const pinned = process.env.DEMO_TODAY;
  const d = pinned ? new Date(`${pinned}T00:00:00Z`) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseIso(s: string): Date {
  return new Date(`${s.slice(0, 10)}T00:00:00Z`);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

export function monthsBetween(a: Date, b: Date): number {
  return daysBetween(a, b) / 30.4;
}

export function fmtDate(s: string): string {
  const d = parseIso(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
