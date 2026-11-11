import { SPENDING_CATEGORIES, type Coverage, type Transaction, type SpendingCategory } from "./types";
import { roundedRatio } from "./money";

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
const key = (t: Transaction) => `${t.ownerId}:${t.source}:${t.accountId}:${t.id}`;
/** Conflicting posted duplicates fail closed; a removal/reversal wins over its original observation. */
export function normalizeTransactions(input: Transaction[], ownerId: string) {
  const byId = new Map<string, Transaction>(), conflicted = new Set<string>();
  const excluded = { duplicates: 0, invalid: 0, foreign: 0, pending: 0, reversed: 0, transfers: 0, cardPayments: 0, income: 0 };
  for (const t of input) {
    if (t.ownerId !== ownerId) { excluded.foreign++; continue; }
    if (!t.id || !t.accountId || t.source !== "local-sandbox-fixture" || t.currency !== "USD" || !validDate(t.date) || !Number.isSafeInteger(t.amountCents) || Math.abs(t.amountCents) > 100_000_000 ||
      !["posted", "pending", "reversed", "removed"].includes(t.status) || !["expense", "income", "internal_transfer", "credit_card_payment", "refund", "reversal"].includes(t.kind)) { excluded.invalid++; continue; }
    const id = key(t), prior = byId.get(id);
    if (conflicted.has(id)) { excluded.duplicates++; continue; }
    if (!prior) { byId.set(id, t); continue; }
    excluded.duplicates++;
    const signature = (row: Transaction) => JSON.stringify([row.date, row.merchantName, row.description, row.amountCents, row.currency, row.status, row.kind, row.category, row.originalTransactionId, row.pendingTransactionId, row.recurringHint, row.scheduledItemId]);
    if (signature(prior) === signature(t)) continue;
    if (["reversed", "removed"].includes(t.status) || (prior.status === "pending" && t.status === "posted")) byId.set(id, t);
    else if (["reversed", "removed"].includes(prior.status) || (prior.status === "posted" && t.status === "pending")) continue;
    else { byId.delete(id); conflicted.add(id); excluded.invalid++; }
  }
  const rows = [...byId.values()];
  const reversals = new Set(rows.filter(t => t.kind === "reversal" && t.originalTransactionId).map(t => key({ ...t, id: t.originalTransactionId! })));
  const replaced = new Set(rows.filter(t => t.status === "posted" && t.pendingTransactionId).map(t => key({ ...t, id: t.pendingTransactionId! })));
  const originals = new Map(rows.map(t => [key(t), t]));
  const posted: Transaction[] = [], spending: (Transaction & { category: SpendingCategory })[] = [];
  for (const t of rows) {
    if (t.status === "pending" || replaced.has(key(t))) { excluded.pending++; continue; }
    if (t.status !== "posted" || t.kind === "reversal" || reversals.has(key(t))) { excluded.reversed++; continue; }
    if ((t.kind === "expense" && t.amountCents <= 0) || (t.kind === "refund" && t.amountCents >= 0)) { excluded.invalid++; continue; }
    posted.push(t);
    if (t.kind === "internal_transfer") { excluded.transfers++; continue; }
    if (t.kind === "credit_card_payment") { excluded.cardPayments++; continue; }
    if (t.kind === "income") { excluded.income++; continue; }
    const original = t.kind === "refund" && t.originalTransactionId ? originals.get(key({ ...t, id: t.originalTransactionId })) : undefined;
    const category = original?.kind === "expense" ? original.category : t.category;
    spending.push({ ...t, category: category && SPENDING_CATEGORIES.includes(category) ? category : "Uncategorized" });
  }
  return { posted, spending, excluded };
}
function monthBounds(month: string) {
  const date = new Date(`${month}-01T00:00:00Z`);
  return { start: `${month}-01`, end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10) };
}
function previousMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
}
export function analyzeSpending(input: Transaction[], ownerId: string, coverage: Coverage) {
  if (!validDate(coverage.start) || !validDate(coverage.end) || !validDate(coverage.asOf) || coverage.start > coverage.end || coverage.end >= coverage.asOf) throw new Error("Invalid historical coverage");
  const normalized = normalizeTransactions(input.filter(t => t.date <= coverage.end), ownerId);
  const inCoverage = (t: Transaction) => t.date >= coverage.start && t.date <= coverage.end;
  const rows = normalized.spending.filter(inCoverage);
  // Only months with actual posted records are shown; never fabricate empty months from a date range.
  const observedMonths = [...new Set(normalized.posted.filter(inCoverage).map(t => t.date.slice(0, 7)))].sort();
  const months = observedMonths.map(month => {
    const bounds = monthBounds(month), expenses = rows.filter(t => t.date.startsWith(month));
    const complete = coverage.start <= bounds.start && coverage.end >= bounds.end;
    return { month, complete, netCents: expenses.reduce((sum, t) => sum + t.amountCents, 0), grossCents: expenses.filter(t => t.amountCents > 0).reduce((sum, t) => sum + t.amountCents, 0), refundsCents: -expenses.filter(t => t.amountCents < 0).reduce((sum, t) => sum + t.amountCents, 0), transactionCount: expenses.length };
  });
  const trend = months.map(month => {
    const previous = months.find(item => item.month === previousMonth(month.month));
    const delta = month.complete && previous?.complete ? month.netCents - previous.netCents : null;
    return { ...month, changeCents: delta, changeBasisPoints: delta !== null && previous && previous.netCents > 0 ? roundedRatio(BigInt(delta) * 10_000n, BigInt(previous.netCents)) : null };
  });
  const full = months.filter(month => month.complete);
  const averageMonthlyCents = full.length ? roundedRatio(full.reduce((sum, month) => sum + BigInt(month.netCents), 0n), BigInt(full.length)) : null;
  const categories = SPENDING_CATEGORIES.map(category => ({ category, netCents: rows.filter(t => t.category === category).reduce((sum, t) => sum + t.amountCents, 0), transactionCount: rows.filter(t => t.category === category).length, averageMonthlyCents: full.length ? roundedRatio(rows.filter(t => t.category === category && full.some(month => t.date.startsWith(month.month))).reduce((sum, t) => sum + BigInt(t.amountCents), 0n), BigInt(full.length)) : null })).filter(row => row.transactionCount > 0).sort((a, b) => b.netCents - a.netCents);
  return { coverage, months: trend, averageMonthlyCents, averageMonthCount: full.length, totalNetCents: rows.reduce((sum, t) => sum + t.amountCents, 0), categories, excluded: normalized.excluded, analyzedCount: rows.length };
}
