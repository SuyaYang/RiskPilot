import { buildPersonas } from "../personas";
import { addDays, iso, today } from "../dates";
import type { Coverage, Transaction, SpendingCategory } from "./types";

/** Fictional statement history, not a bank connection or a reconstruction of the manual balance. */
export function spendingFixture(ownerId: string, asOf = iso(today())) {
  const persona = buildPersonas().find(p => p.id === ownerId.split(":").at(-1));
  if (!persona) throw new Error("Unknown spending persona");
  const personaId = persona.id;
  const clock = new Date(`${asOf}T00:00:00Z`);
  const start = new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth() - 3, 1));
  const coverage: Coverage = { start: iso(start), end: iso(addDays(clock, -1)), asOf, source: "local-sandbox-fixture" };
  const transactions: Transaction[] = [];
  const account = `${persona.id}-checking`, card = `${persona.id}-card`;
  function add(id: string, date: string, merchantName: string, amountCents: number, category?: SpendingCategory, fields: Partial<Transaction> = {}) {
    if (date < coverage.start || date > coverage.end) return;
    transactions.push({ id: `${personaId}:${id}:${date}`, ownerId, accountId: account, date, merchantName, description: merchantName, amountCents, category, currency: "USD", source: "local-sandbox-fixture", status: "posted", kind: "expense", ...fields });
  }
  const index = ["alex", "sam", "jordan"].indexOf(persona.id);
  for (let month = new Date(start); month <= clock; month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))) {
    const date = (day: number) => iso(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day)));
    const variation = (month.getUTCMonth() % 3) * 137;
    for (const r of persona.recurring) {
      const anchor = addDays(clock, r.firstInDays).getUTCDate();
      const day = Math.min(anchor, new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate());
      if (r.direction === "in" && r.frequency === "biweekly") continue;
      const kind = r.direction === "in" ? "income" : /credit card/i.test(r.name) ? "credit_card_payment" : "expense";
      const category: SpendingCategory = /rent|phone/i.test(r.name) ? "Housing and utilities" : /insurance/i.test(r.name) ? "Health" : /subscription/i.test(r.name) ? "Subscriptions" : "Other";
      const recurringHint = kind !== "expense" ? undefined : /rent/i.test(r.name) ? "housing" as const : /insurance/i.test(r.name) ? "insurance" as const : /phone/i.test(r.name) ? "utility" as const : "subscription" as const;
      add(r.id, date(day), r.name, Math.round(r.amount * 100) * (r.direction === "in" ? -1 : 1), category, { kind, recurringHint, scheduledItemId: kind === "expense" ? r.id : undefined });
    }
    add("internet", date(18), "Beacon Internet", 6500 + index * 500 + (month.getUTCMonth() % 2) * 450, "Housing and utilities", { recurringHint: "utility" });
    add("streaming", date(23), "Bluebird Streaming", 1499 + index * 500, "Subscriptions", { recurringHint: "subscription", accountId: card });
    for (const [n, day] of [3, 6, 10, 14, 18, 22, 25, 28].entries()) {
      add(`food-${n}`, date(day), n % 2 ? "Corner Table" : "Neighborhood Market", 1850 + index * 750 + n * 183 + variation, "Food and dining", { accountId: n % 2 ? card : account });
    }
    for (const [n, day] of [4, 11, 19, 26].entries()) add(`transport-${n}`, date(day), "Metro Transit", 575 + index * 150 + n * 125, "Transportation");
    add("shopping", date(12), "Harbor Goods", 12045 + index * 8500 + variation, "Shopping", { accountId: card });
    add("refund", date(20), "Harbor Goods", -3545, "Shopping", { accountId: card, kind: "refund", originalTransactionId: `${persona.id}:shopping:${date(12)}` });
    add("books", date(27), "Paper Trail Books", 3299 + index * 1200 + variation, "Shopping", { accountId: card });
    add("health", date(9), "Neighborhood Pharmacy", 2543 + index * 1100, "Health");
    add("cinema", date(16), "Silver Screen", 1600 + index * 800, "Entertainment", { accountId: card });
    add("unknown", date(24), "Local merchant", 2943, undefined);
    add("savings-out", date(5), "Transfer to own savings", 10000, "Other", { kind: "internal_transfer" });
    add("savings-in", date(5), "Transfer from own checking", -10000, "Other", { kind: "internal_transfer", accountId: `${persona.id}-savings` });
    // A reversal cancels its explicitly linked debit; neither contributes spending.
    add("reversed-debit", date(21), "Cancelled order", 8850, "Shopping");
    add("reversal", date(22), "Cancelled order", -8850, "Shopping", { kind: "reversal", originalTransactionId: `${persona.id}:reversed-debit:${date(21)}` });
    const duplicate = transactions.find(t => t.id === `${persona.id}:food-0:${date(3)}`);
    if (duplicate) transactions.push({ ...duplicate });
  }
  for (const r of persona.recurring.filter(r => r.direction === "in" && r.frequency === "biweekly")) {
    for (let date = addDays(clock, r.firstInDays - 14); date >= start; date = addDays(date, -14)) add(r.id, iso(date), r.name, -Math.round(r.amount * 100), "Other", { kind: "income" });
  }
  // Different supported periods across personas; service hints do not imply contractual certainty.
  const weekly = persona.id !== "jordan", interval = weekly ? 7 : 14;
  for (let date = addDays(clock, -3); date >= start; date = addDays(date, -interval)) {
    add("membership", iso(date), weekly ? (persona.id === "sam" ? "Weekly Fitness Plan" : "Weekly Transit Pass") : "Coworking Membership", weekly ? (persona.id === "sam" ? 1999 : 1200) : 4500, weekly && persona.id === "alex" ? "Transportation" : "Health", { recurringHint: "membership" });
  }
  add("pending", coverage.end, "Harbor Goods", 2995, "Shopping", { status: "pending", accountId: card });
  return { coverage, transactions };
}
