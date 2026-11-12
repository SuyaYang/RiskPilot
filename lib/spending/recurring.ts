import crypto from "node:crypto";
import { daysBetween, parseIso, iso, addDays } from "../dates";
import { normalizeTransactions } from "./analysis";
import type { Transaction, SpendingFrequency } from "./types";

export const normalizeMerchant = (name: string) => name.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const monthEnd = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
function nextMonthly(date: Date, anchor: number, atEnd: boolean) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), atEnd ? monthEnd(next) : Math.min(anchor, monthEnd(next))));
}
/** At least three consistent observations; weekly requires four. Dining/shopping have no service hint. */
export function detectRecurring(input: Transaction[], ownerId: string, asOf: string) {
  const normalized = normalizeTransactions(input.filter(t => t.date < asOf), ownerId).spending;
  const refunded = new Map<string, number>();
  for (const row of normalized.filter(t => t.kind === "refund" && t.originalTransactionId)) {
    const key = `${row.accountId}:${row.originalTransactionId}`;
    refunded.set(key, (refunded.get(key) || 0) - row.amountCents);
  }
  const rows = normalized.filter(t => (refunded.get(`${t.accountId}:${t.id}`) || 0) < t.amountCents && t.kind === "expense" && t.amountCents > 0 && t.recurringHint && !["Food and dining", "Shopping", "Entertainment"].includes(t.category));
  const groups = new Map<string, typeof rows>();
  for (const t of rows) {
    const merchant = normalizeMerchant(t.merchantName || t.description);
    if (!merchant) continue;
    const key = `${t.accountId}:${merchant}`;
    groups.set(key, [...(groups.get(key) || []), t]);
  }
  return [...groups.entries()].flatMap(([key, group]) => {
    const sorted = group.sort((a, b) => a.date.localeCompare(b.date));
    const unique = sorted.filter((t, index) => index === 0 || t.date !== sorted[index - 1].date);
    if (unique.length < 3 || unique.length !== sorted.length) return [];
    const amounts = unique.map(t => t.amountCents), typical = median(amounts);
    const deviation = Math.max(...amounts.map(amount => Math.abs(amount - typical)));
    if (deviation > Math.max(100, Math.floor(typical / 10))) return [];
    const dates = unique.map(t => parseIso(t.date));
    const gaps = dates.slice(1).map((date, index) => daysBetween(dates[index], date));
    let frequency: SpendingFrequency;
    if (unique.length >= 4 && gaps.every(gap => gap >= 6 && gap <= 8)) frequency = "weekly";
    else if (gaps.every(gap => gap >= 12 && gap <= 16)) frequency = "biweekly";
    else if (dates.slice(1).every((date, index) => {
      const prior = dates[index];
      return (date.getUTCFullYear() - prior.getUTCFullYear()) * 12 + date.getUTCMonth() - prior.getUTCMonth() === 1 &&
        (Math.abs(date.getUTCDate() - prior.getUTCDate()) <= 3 || (monthEnd(date) - date.getUTCDate() <= 2 && monthEnd(prior) - prior.getUTCDate() <= 2));
    })) frequency = "monthly";
    else return [];
    const last = unique.at(-1)!;
    const atEnd = dates.every(date => date.getUTCDate() === monthEnd(date));
    const next = frequency === "monthly" ? nextMonthly(dates.at(-1)!, dates[0].getUTCDate(), atEnd) : addDays(dates.at(-1)!, frequency === "weekly" ? 7 : 14);
    // Do not silently skip an overdue estimated occurrence when newer history is missing.
    const nextDate = iso(next) >= asOf ? iso(next) : null;
    const scheduledIds = [...new Set(unique.map(t => t.scheduledItemId).filter(Boolean))];
    return [{
      id: crypto.createHash("sha256").update(`${ownerId}:${key}:${frequency}`).digest("hex").slice(0, 24),
      merchant: last.merchantName || last.description, amountCents: typical, frequency,
      firstObserved: unique[0].date, lastObserved: last.date, nextDate,
      source: "local-sandbox-fixture" as const, method: "deterministic-pattern" as const,
      quality: deviation <= Math.max(25, Math.floor(typical / 20)) ? "strong" as const : "limited" as const,
      evidence: { observations: unique.length, minCents: Math.min(...amounts), maxCents: Math.max(...amounts), minGapDays: Math.min(...gaps), maxGapDays: Math.max(...gaps) },
      scheduledItemId: scheduledIds.length === 1 && unique.every(t => t.scheduledItemId === scheduledIds[0]) ? scheduledIds[0] : null,
    }];
  }).sort((a, b) => (a.nextDate || "9999").localeCompare(b.nextDate || "9999") || b.amountCents - a.amountCents);
}
