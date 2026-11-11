/** All analysis and mutation amounts use safe integer cents, including averages and percentage ratios. */
export function roundedRatio(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) throw new Error("Invalid ratio denominator");
  const sign = numerator < 0n ? -1n : 1n;
  return Number(sign * ((sign * numerator + denominator / 2n) / denominator));
}
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) return "Unavailable";
  const value = Math.abs(cents);
  return `${cents < 0 ? "−" : ""}$${Math.floor(value / 100).toLocaleString("en-US")}.${String(value % 100).padStart(2, "0")}`;
}
export function parseCents(value: string): number | null {
  const parts = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!parts) return null;
  const cents = Number(parts[1]) * 100 + Number((parts[2] || "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
