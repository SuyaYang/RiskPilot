import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSpending, normalizeTransactions } from "../lib/spending/analysis";
import { spendingFixture } from "../lib/spending/fixtures";
import { detectRecurring } from "../lib/spending/recurring";
import { formatCents, parseCents } from "../lib/spending/money";
import type { Coverage, Transaction } from "../lib/spending/types";
process.env.DEMO_TODAY = "2026-11-10";
const owner = "workspace-a:alex";
const coverage: Coverage = { start: "2026-09-01", end: "2026-10-31", asOf: "2026-11-01", source: "local-sandbox-fixture" };
const tx = (id: string, date: string, amountCents: number, patch: Partial<Transaction> = {}): Transaction => ({ id, ownerId: owner, accountId: "checking", merchantName: "Beacon Internet", description: "Beacon Internet", amountCents, date, status: "posted", kind: "expense", source: "local-sandbox-fixture", currency: "USD", category: "Housing and utilities", ...patch });

test("integer-cent totals handle category attribution, partial refunds and credit-card repayment exclusion", () => {
  const food = tx("food", "2026-09-05", 10000, { category: "Food and dining" });
  const input = [food, { ...food }, tx("purchase", "2026-09-12", 20000, { category: "Shopping" }), tx("oct-purchase", "2026-10-05", 5000, { category: "Shopping" }),
    tx("refund", "2026-10-10", -6000, { kind: "refund", originalTransactionId: "purchase" }),
    tx("transfer-out", "2026-10-02", 30000, { kind: "internal_transfer" }), tx("transfer-in", "2026-10-02", -30000, { kind: "internal_transfer", accountId: "savings" }),
    tx("card-payment", "2026-10-20", 25000, { kind: "credit_card_payment" }), tx("pending", "2026-10-30", 1234, { status: "pending" }),
    tx("reversed", "2026-09-21", 8850), tx("reversal", "2026-09-22", -8850, { kind: "reversal", originalTransactionId: "reversed" }),
    tx("pay", "2026-09-01", -200000, { kind: "income" })];
  const result = analyzeSpending(input, owner, coverage);
  assert.deepEqual(result.months.map(m => m.netCents), [30000, -1000]);
  assert.equal(result.totalNetCents, 29000); assert.equal(result.averageMonthlyCents, 14500);
  assert.deepEqual(Object.fromEntries(result.categories.map(c => [c.category, c.netCents])), { Shopping: 19000, "Food and dining": 10000 });
  assert.equal(result.months[1].refundsCents, 6000); assert.equal(result.months[1].changeCents, -31000); assert.equal(result.months[1].changeBasisPoints, -10333);
  assert.equal(result.excluded.duplicates, 1); assert.equal(result.excluded.cardPayments, 1); assert.equal(result.excluded.transfers, 2); assert.equal(result.excluded.reversed, 2); assert.equal(result.excluded.pending, 1);
  assert.equal(result.categories.reduce((sum, c) => sum + c.netCents, 0), result.totalNetCents);
});
test("refunds use posting month and reliable original category, without guessing unmatched merchant credits", () => {
  const data = [tx("original", "2026-08-10", 2000, { category: "Shopping" }), tx("refund", "2026-10-02", -500, { kind: "refund", originalTransactionId: "original" }), tx("unlinked", "2026-10-03", -200, { kind: "refund", category: undefined })];
  const result = analyzeSpending(data, owner, coverage);
  assert.equal(result.totalNetCents, -700);
  assert.equal(result.categories.find(c => c.category === "Shopping")?.netCents, -500);
  assert.equal(result.categories.find(c => c.category === "Uncategorized")?.netCents, -200);
});
test("incomplete and missing months are not invented, averaged as full months or compared as month-over-month", () => {
  const result = analyzeSpending([tx("aug", "2026-08-20", 1000), tx("oct", "2026-10-10", 2000)], owner, { ...coverage, start: "2026-08-15", end: "2026-10-30" });
  assert.deepEqual(result.months.map(m => [m.month, m.complete, m.changeCents]), [["2026-08", false, null], ["2026-10", false, null]]);
  assert.equal(result.averageMonthlyCents, null);
  assert.deepEqual(analyzeSpending([], owner, coverage).months, []);
  const missingPrior = analyzeSpending([tx("aug", "2026-08-20", 1000), tx("oct", "2026-10-10", 2000)], owner, { ...coverage, start: "2026-08-01" });
  assert.equal(missingPrior.months[1].changeBasisPoints, null);
});
test("posted replacement, reversed updates and conflicting duplicate IDs fail safely", () => {
  const pending = tx("pending", "2026-10-01", 1000, { status: "pending" });
  const posted = tx("posted", "2026-10-02", 1100, { pendingTransactionId: "pending" });
  assert.equal(analyzeSpending([pending, posted], owner, coverage).totalNetCents, 1100);
  assert.equal(analyzeSpending([tx("same", "2026-10-01", 1000), tx("same", "2026-10-01", 1000, { status: "reversed" })], owner, coverage).totalNetCents, 0);
  const conflict = analyzeSpending([tx("same", "2026-10-01", 1000), tx("same", "2026-10-01", 2000)], owner, coverage);
  assert.equal(conflict.totalNetCents, 0); assert.equal(conflict.excluded.invalid, 1);
  assert.equal(normalizeTransactions([tx("fraction", "2026-10-01", 10.5), tx("date", "2026-02-30", 1000)], owner).spending.length, 0);
});
test("future reversals cannot alter covered history, and posted pending-ID replacements are counted once", () => {
  const rows = [tx("original", "2026-10-01", 1000), tx("later-reversal", "2026-11-02", -1000, { kind: "reversal", originalTransactionId: "original" })];
  assert.equal(analyzeSpending(rows, owner, coverage).totalNetCents, 1000);
  assert.equal(analyzeSpending([tx("pending-old", "2026-10-01", 1000), tx("posted-new", "2026-10-02", 1100, { pendingTransactionId: "pending-old" })], owner, coverage).totalNetCents, 1100);
  const orderedDifferently = { ...tx("ordered", "2026-10-01", 1000) };
  const reordered = Object.fromEntries(Object.entries(orderedDifferently).reverse()) as Transaction;
  assert.equal(analyzeSpending([orderedDifferently, reordered], owner, coverage).totalNetCents, 1000);
});
test("fully refunded service charges do not create recurring candidates from cancelled observations", () => {
  const rows = recurring(["2026-08-12", "2026-09-12", "2026-10-12"]);
  rows.push(tx("refund-service", "2026-10-13", -6500, { kind: "refund", originalTransactionId: "rec-2" }));
  assert.deepEqual(detectRecurring(rows, owner, "2026-10-14"), []);
});
test("foreign profile rows and unsupported categorization are never attributed to the active profile", () => {
  const result = analyzeSpending([tx("owned", "2026-10-01", 1234, { category: undefined }), tx("foreign", "2026-10-01", 99999, { ownerId: "workspace-b:alex" })], owner, coverage);
  assert.equal(result.totalNetCents, 1234); assert.equal(result.excluded.foreign, 1); assert.equal(result.categories[0].category, "Uncategorized");
});
test("USD parsing and formatting preserve cent precision and reject exponent/extra-decimal input", () => {
  assert.equal(parseCents("123.45"), 12345); assert.equal(parseCents("0.01"), 1); assert.equal(parseCents("10.5"), 1050);
  assert.equal(parseCents("1.001"), null); assert.equal(parseCents("1e3"), null); assert.equal(parseCents("-2"), null);
  assert.equal(formatCents(-12345), "−$123.45"); assert.equal(formatCents(1), "$0.01");
});
const recurring = (dates: string[], patch: Partial<Transaction> = {}) => dates.map((date, i) => tx(`rec-${i}`, date, 6500, { recurringHint: "utility", ...patch }));
test("recurring detector supports weekly, biweekly and calendar monthly evidence with estimated future dates", () => {
  const weekly = detectRecurring(recurring(["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]), owner, "2026-11-03")[0];
  assert.equal(weekly.frequency, "weekly"); assert.equal(weekly.nextDate, "2026-11-09");
  const biweekly = detectRecurring(recurring(["2026-10-01", "2026-10-15", "2026-10-29"]), owner, "2026-11-01")[0];
  assert.equal(biweekly.frequency, "biweekly"); assert.equal(biweekly.nextDate, "2026-11-12");
  const monthly = detectRecurring(recurring(["2026-01-31", "2026-02-28", "2026-03-31"]), owner, "2026-04-01")[0];
  assert.equal(monthly.frequency, "monthly"); assert.equal(monthly.nextDate, "2026-04-30"); assert.equal(monthly.evidence.observations, 3);
});
test("insufficient, irregular, variable and discretionary patterns do not become recurring obligations", () => {
  assert.deepEqual(detectRecurring(recurring(["2026-09-01", "2026-10-01"]), owner, "2026-10-02"), []);
  assert.deepEqual(detectRecurring(recurring(["2026-10-01", "2026-10-08", "2026-10-15"]), owner, "2026-10-16"), []);
  assert.deepEqual(detectRecurring(recurring(["2026-08-01", "2026-09-12", "2026-10-29"]), owner, "2026-11-01"), []);
  const dates = ["2026-08-12", "2026-09-12", "2026-10-12"];
  assert.deepEqual(detectRecurring(recurring(dates, { category: "Food and dining" }), owner, "2026-10-13"), []);
  assert.deepEqual(detectRecurring(recurring(dates, { category: "Shopping" }), owner, "2026-10-13"), []);
  const variable = recurring(dates); variable[1].amountCents = 13000;
  assert.deepEqual(detectRecurring(variable, owner, "2026-10-13"), []);
  const overdue = detectRecurring(recurring(dates), owner, "2026-11-20")[0];
  assert.equal(overdue.nextDate, null, "No silent skipping of an unobserved overdue occurrence");
});
test("recurring merchant normalization is stable while unrelated accounts remain separate", () => {
  const data = recurring(["2026-08-12", "2026-09-12", "2026-10-12"]);
  data[0].merchantName = "  BEACON  INTERNET "; data[1].merchantName = "Beacon-Internet";
  assert.equal(detectRecurring(data, owner, "2026-10-13").length, 1);
  data[1].accountId = "another-card";
  assert.equal(detectRecurring(data, owner, "2026-10-13").length, 0);
});
test("all persona histories are deterministic, dated, fictional, and provide complete-month and category evidence", () => {
  const totals: number[] = [];
  for (const id of ["alex", "sam", "jordan"]) {
    const ownerId = `fixture:${id}`, data = spendingFixture(ownerId, "2026-11-10");
    assert.deepEqual(spendingFixture(ownerId, "2026-11-10"), data);
    assert.ok(data.transactions.every(t => t.ownerId === ownerId && t.date < "2026-11-10" && Number.isSafeInteger(t.amountCents)));
    const analysis = analyzeSpending(data.transactions, ownerId, data.coverage);
    assert.equal(analysis.averageMonthCount, 3); assert.equal(analysis.months.at(-1)?.complete, false);
    assert.ok(analysis.categories.length >= 7); assert.ok(analysis.excluded.duplicates > 0); assert.ok(analysis.excluded.pending > 0);
    assert.ok(detectRecurring(data.transactions, ownerId, data.coverage.asOf).some(candidate => candidate.frequency === (id === "jordan" ? "biweekly" : "weekly")));
    totals.push(analysis.totalNetCents);
  }
  assert.equal(new Set(totals).size, 3);
});

test("pattern confirmation/edit/rejection is versioned and scoped, resets cleanly, and never double-counts the forecast", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rp-spending-"));
  process.env.STORE_PATH = path.join(dir, "store.json"); process.env.DEMO_SEED_ENABLED = "true";
  delete process.env.PAYPAL_CLIENT_ID; delete process.env.PAYPAL_CLIENT_SECRET;
  const { ensurePersona, load, reset, update } = await import("../lib/store");
  const { snapshot, inputHash } = await import("../lib/state");
  const { spendingView, updateRecurring } = await import("../lib/spending/service");
  const { recordCapture } = await import("../lib/purchases");
  const other = "workspace-b:alex", sameWorkspace = "workspace-a:sam";
  ensurePersona(owner); ensurePersona(other); ensurePersona(sameWorkspace);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  // Existing verified purchase and snapshot stay in the original ledger; no parallel spending ledger.
  update(data => { data.orders["SIM-PREEXISTING"] = { orderId: "SIM-PREEXISTING", personaId: owner, decisionId: "fixture", productId: "aero-14", productName: "Aero 14 Laptop", method: "full", amount: 900, currency: "USD", status: "CREATED", createdAt: "2026-11-10", simulated: true, captureRequestId: "capture-fixture" }; });
  recordCapture("SIM-PREEXISTING", "SIMCAP-PREEXISTING", 900);
  const before = snapshot(owner), beforeHash = inputHash(owner), beforeSnapshots = load().snapshots;
  const initial = spendingView(owner), candidate = initial.candidates.find(c => c.forecastReference)!;
  assert.ok(candidate); assert.equal(candidate.status, "suggested");
  const fields = { asOf: "2026-11-10", version: 0, action: "confirm" };
  const confirmedResponse = updateRecurring(owner, candidate.id, fields);
  assert.equal(confirmedResponse.forecastChanged, false);
  assert.equal(confirmedResponse.spending.version, 1);
  assert.equal(confirmedResponse.spending.candidates.find(c => c.id === candidate.id)?.status, "confirmed");
  assert.equal(spendingView(owner).candidates.find(c => c.id === candidate.id)?.status, "confirmed");
  assert.throws(() => updateRecurring(owner, candidate.id, fields), (e: unknown) => (e as { code: string }).code === "STALE_SPENDING");
  assert.throws(() => updateRecurring(other, candidate.id, fields), (e: unknown) => (e as { status: number }).status === 404);
  assert.throws(() => updateRecurring(sameWorkspace, candidate.id, fields), (e: unknown) => (e as { status: number }).status === 404);
  updateRecurring(owner, candidate.id, { asOf: "2026-11-10", version: 1, action: "edit", merchant: "Edited utility", amountCents: 7777, frequency: "biweekly", nextDate: "2026-11-21" });
  const edited = spendingView(owner).candidates.find(c => c.id === candidate.id)!;
  assert.equal(edited.status, "confirmed"); assert.equal(edited.amountCents, 7777); assert.equal(edited.nextDate, "2026-11-21"); assert.equal(edited.frequency, "biweekly");
  assert.notEqual(edited.detected.amountCents, 7777);
  assert.deepEqual(snapshot(owner), before); assert.equal(inputHash(owner), beforeHash); assert.deepEqual(load().snapshots, beforeSnapshots);
  assert.equal(snapshot(owner).purchases.length, 1); assert.equal(snapshot(owner).forecast.startBalance, 2600);
  updateRecurring(owner, candidate.id, { asOf: "2026-11-10", version: 2, action: "not_recurring" });
  assert.equal(spendingView(owner).candidates.find(c => c.id === candidate.id)?.status, "rejected");
  assert.ok(spendingView(other).candidates.every(c => c.status === "suggested"));
  for (const amountCents of [-1, 10.1, 0, 10_000_001]) assert.throws(() => updateRecurring(owner, candidate.id, { asOf: "2026-11-10", version: 3, action: "edit", amountCents }), (e: unknown) => (e as { status: number }).status === 400);
  assert.throws(() => updateRecurring(owner, candidate.id, { asOf: "2026-11-09", version: 3, action: "confirm" }), /History date changed/);
  assert.throws(() => updateRecurring(owner, candidate.id, { asOf: "2026-11-10", version: 3, action: "edit", nextDate: "2026-02-30" }), /estimated date/);
  assert.equal(spendingView(owner).version, 3);
  reset(owner);
  const after = spendingView(owner);
  assert.equal(after.version, 0); assert.ok(after.candidates.every(c => c.status === "suggested"));
  assert.deepEqual(after.analysis, initial.analysis); assert.equal(snapshot(owner).purchases.length, 0);
  assert.deepEqual(spendingView(other).analysis, initial.analysis);
});
