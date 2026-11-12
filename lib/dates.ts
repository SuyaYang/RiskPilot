const DAY = 24 * 60 * 60 * 1000;

/** Financial calendar day, represented at UTC midnight for date arithmetic. Payment timestamps stay real UTC instants. */
export function today(): Date {
  const pinned = process.env.DEMO_TODAY;
  if (pinned) {
    const value = new Date(`${pinned}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pinned) || !Number.isFinite(value.getTime()) || iso(value) !== pinned) throw new Error("Invalid DEMO_TODAY");
    return value;
  }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: process.env.FINANCIAL_TIMEZONE || "America/New_York", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(new Date());
  const value = (name: string) => parts.find(part => part.type === name)!.value;
  return new Date(`${value("year")}-${value("month")}-${value("day")}T00:00:00Z`);
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
