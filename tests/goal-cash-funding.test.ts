import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { buildPersonas } from "../lib/personas";
import { projectGoals, allocateGoals } from "../lib/engine/goals";
import { forecast } from "../lib/engine/forecast";
import { buildOptions, schedule } from "../lib/engine/options";
import { getProduct } from "../lib/catalog";
import { investableNow } from "../lib/engine/investable";
import { reviewFacts } from "../lib/reviewInsights";
import type { PurchaseReview } from "../lib/orderReview";
import type { Payment, Persona } from "../lib/types";

process.env.DEMO_TODAY = "2026-11-12";
const alex = () => buildPersonas().find(p => p.id === "alex")!;
const payment = (date: string, amount: number): Payment => ({ date, amount, label: "Test obligation" });
const dates = (a: ReturnType<typeof projectGoals>["allocation"]) => a.goals.map(g => g.eta);
const cleanDates = ["2027-03-14", "2027-04-13", "2027-04-13"];
const total = (a: ReturnType<typeof allocateGoals>) => Math.round(a.goals.reduce((n, g) => n + g.allocatedThisMonth, 0) * 100) / 100;
// Small analytical fixture: $500 existing headroom, $100 monthly surplus.
const simple = (): Persona => ({ ...alex(), checkingBalance: 1500, buffer: 1000, dailySpend: 0,
  recurring: [{ id: "salary", name: "Salary", amount: 100, direction: "in", frequency: "monthly", firstInDays: 29 }],
  goals: [{ id: "goal", name: "Goal", type: "spend", priority: 1, targetAmount: 1000, savedSoFar: 0, targetDate: "2027-11-12" }],
});

test("Step 8.7: Nov 12, Nov 13 and Nov 22 use the same cash-funded policy for clean Alex", () => {
  const p = alex(), original = structuredClone(p);
  for (const [date, min, risk] of [["2026-11-12", 820, "red"], ["2026-11-13", 820, "red"], ["2026-11-22", 1260, "yellow"]] as const) {
    const r = projectGoals(p, p.goals, [], [payment(date, 900)]);
    assert.deepEqual(dates(r.allocation), cleanDates);
    assert.deepEqual(r.allocation.goals.map(g => g.allocatedThisMonth), [250, 200, 12]);
    assert.equal(total(r.allocation), 462);
    assert.equal(r.forecast.minBalance, min); assert.equal(r.forecast.stressMinBalance, 640); assert.equal(r.forecast.risk, risk);
  }
  assert.deepEqual(p, original);
});

test("future payment within headroom affects cash once and leaves goal funding intact", () => {
  const p = simple(), pay = payment("2026-11-13", 400);
  const r = projectGoals(p, p.goals, [], [pay]);
  assert.deepEqual(r.allocation, allocateGoals(p, p.goals, [], 0, 0));
  assert.equal(total(r.allocation), 100); assert.equal(r.forecast.minBalance, 1100);
  assert.deepEqual(r, projectGoals(p, p.goals, [pay]));
});

test("future payment exceeding headroom charges only uncovered cents to contributions", () => {
  const p = simple(), pay = payment("2026-11-13", 600.01);
  const r = projectGoals(p, p.goals, [], [pay]);
  assert.equal(r.forecast.bufferGap, -100.01);
  assert.deepEqual(r.allocation, allocateGoals(p, p.goals, [{ ...pay, amount: 100.01 }], 100.01, 0));
  assert.equal(total(r.allocation), 0);
});

test("multiple payments consume headroom once, chronologically, across contribution periods with exact cents", () => {
  const p = simple();
  const payments = [payment("2026-11-13", 300.01), payment("2026-11-26", 300.02), payment("2026-12-24", 300.03)];
  const r = projectGoals(p, p.goals, [], payments);
  const residual = [{ ...payments[1], amount: 100.03 }, payments[2]];
  assert.deepEqual(r.allocation, allocateGoals(p, p.goals, residual, Math.max(0, -r.forecast.bufferGap), 0));
  assert.deepEqual(projectGoals(p, p.goals, [], [...payments].reverse()), r);
  assert.deepEqual(projectGoals(p, p.goals, [payments[2]], payments.slice(0, 2)), r);
  assert.equal(Math.round(payments.reduce((n, x) => n + x.amount, 0) * 100), 50000 + 40006);
  assert.equal(Math.round(residual.reduce((n, x) => n + x.amount, 0) * 100), 40006);
});

test("independent cash deficit survives once alongside future obligations and completed purchases", () => {
  const p = simple(); p.checkingBalance = 800;
  const paid = payment("2026-11-12", 50), pay = payment("2026-11-13", 300);
  const r = projectGoals(p, p.goals, [paid], [pay]);
  assert.deepEqual(r.allocation, allocateGoals(p, p.goals, [pay], 550, 250));
  assert.equal(total(r.allocation), 0); assert.equal(r.forecast.startBalance, 750);
  assert.deepEqual(r, projectGoals(p, p.goals, [paid, pay]));
});

test("payment timing can still change goal dates when uncovered obligations cross contribution periods", () => {
  const p = simple(); p.goals[0].targetAmount = 100;
  const tomorrow = projectGoals(p, p.goals, [], [payment("2026-11-13", 600)]);
  const later = projectGoals(p, p.goals, [], [payment("2027-01-12", 600)]);
  assert.equal(total(tomorrow.allocation), 0); assert.equal(total(later.allocation), 100);
  assert.deepEqual(dates(tomorrow.allocation), ["2027-01-12"]);
  assert.deepEqual(dates(later.allocation), ["2026-12-12"]);
});

test("headroom is capped by current cash even when a modeled payday immediately increases the forecast", () => {
  const p = simple(); p.recurring[0].firstInDays = 0;
  const pay = payment("2026-11-13", 600), r = projectGoals(p, p.goals, [], [pay]);
  assert.equal(forecast(p).bufferGap, 600);
  assert.deepEqual(r.allocation, allocateGoals(p, p.goals, [{ ...pay, amount: 100 }], 0, 0));
});

test("additional planned receipts and uncertain income cannot create safe headroom", () => {
  const p = simple(); p.dailySpend = 10; p.recurring[0].amount = 1000;
  p.planning = { policy: "verified-planning-v1", replacedIncomeIds: [], incomeEvents: [{ id: "extra", name: "Proposed receipt", date: "2026-11-12", amountCents: 100000, source: "user_confirmed_plan" }] };
  const pay = payment("2026-11-13", 300), r = projectGoals(p, p.goals, [], [pay]);
  const { planning: _, ...withoutPlanning } = p;
  const headroom = forecast(withoutPlanning).bufferGap;
  assert.equal(headroom, 210);
  assert.deepEqual(r.allocation, allocateGoals(p, p.goals, [{ ...pay, amount: 90 }], 0, 0));
  const uncertain = simple(); uncertain.recurring[0].amount = 1000; uncertain.recurring[0].uncertain = true; uncertain.dailySpend = 10;
  const u = projectGoals(uncertain, uncertain.goals, [], [pay]);
  assert.deepEqual(u.allocation, allocateGoals(uncertain, uncertain.goals, [{ ...pay, amount: 250 }], Math.max(0, -u.forecast.bufferGap), 0));
});

test("long schedules evaluate baseline liquidity through final payment rather than reuse 45-day headroom", () => {
  const p = simple(); p.checkingBalance = 1575;
  p.recurring = [
    { id: "salary", name: "Salary", amount: 500, direction: "in", frequency: "biweekly", firstInDays: 9 },
    { id: "bill", name: "Bill", amount: 1050, direction: "out", frequency: "monthly", firstInDays: 20 },
  ];
  const payments = schedule("pay_monthly", 249).payments;
  const long = forecast(p, [], [{ ...payments.at(-1)!, amount: 0 }]);
  assert.ok(forecast(p).bufferGap > 0); assert.ok(long.bufferGap < 0);
  const r = projectGoals(p, p.goals, [], payments);
  assert.deepEqual(r.allocation, allocateGoals(p, p.goals, payments, Math.max(0, -r.forecast.bufferGap), -long.bufferGap));
  assert.ok(r.allocation.monthlySurplus > 0); assert.equal(total(r.allocation), 0);
  assert.equal(r.forecast.dailyBalances.length, 45); assert.equal(r.forecast.evaluatedThrough, "2027-11-07");
  assert.deepEqual(projectGoals(p, p.goals).forecast, forecast(p));
});

test("Pay in 4 and Pay Monthly preserve engine risk, full horizon, ranking and grounded goal facts", () => {
  const p = alex(), r = buildOptions(p, p.goals, [], getProduct("aero-14")!);
  const four = r.options.find(o => o.method === "pay_in_4")!, monthly = r.options.find(o => o.method === "pay_monthly")!;
  assert.deepEqual(dates(four.goalPlan!), cleanDates); assert.deepEqual(dates(monthly.goalPlan!), cleanDates);
  assert.equal(four.forecast.minBalance, 1485); assert.equal(four.forecast.stressMinBalance, 1080);
  assert.equal(monthly.forecast.evaluatedThrough, "2027-11-07"); assert.equal(monthly.forecast.dailyBalances.length, 45);
  assert.equal(r.recommended, "pay_in_4"); assert.ok(four.hypothetical && monthly.hypothetical);
  const facts = reviewFacts({ buffer: 1000, decision: { options: r.options, afterIncome: r.afterIncome, inputHash: "test" } } as PurchaseReview, "pay_in_4", "goals");
  assert.match(facts.facts.goals, /no additional goal delay/i);
});

test("shopping-adjusted workspace preserves immediate/captured values and corrects every hypothetical schedule", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rp87-"));
  process.env.STORE_PATH = path.join(dir, "store.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { ensurePersona, load } = await import("../lib/store");
  const { snapshot, personaWithState, inputHash } = await import("../lib/state");
  const { planningBudgetView, updatePlanningBudget } = await import("../lib/planning/service");
  const owner = `${crypto.randomUUID()}:alex`; ensurePersona(owner);
  const before = snapshot(owner); assert.equal(before.investable.investable, 90);
  const b = planningBudgetView(owner);
  updatePlanningBudget(owner, { action: "apply", categoryId: "shopping", monthlyCents: 3000, version: b.version, epoch: b.epoch, basisHash: b.basisHash, financialInputHash: inputHash(owner) });
  const adjusted = snapshot(owner), { persona: p } = personaWithState(owner), stored = load();
  assert.deepEqual([adjusted.forecast.minBalance, adjusted.forecast.stressMinBalance, adjusted.investable.investable, total(adjusted.allocation)], [1738, 1572, 122, 703.2]);
  for (const [date, min, risk] of [["2026-11-12", 838, "red"], ["2026-11-13", 838, "red"], ["2026-11-22", 1334.54, "yellow"]] as const) {
    const r = projectGoals(p, p.goals, [], [payment(date, 900)]);
    assert.deepEqual(dates(r.allocation), cleanDates); assert.equal(total(r.allocation), 541.2);
    assert.equal(r.allocation.goals[2].allocatedThisMonth, 91.2); assert.equal(r.forecast.minBalance, min);
    assert.equal(r.forecast.stressMinBalance, 672); assert.equal(r.forecast.risk, risk);
    assert.equal(investableNow(p, r.forecast, r.allocation).investable, 0);
  }
  const r = buildOptions(p, p.goals, [], getProduct("aero-14")!);
  const four = r.options.find(o => o.method === "pay_in_4")!, monthly = r.options.find(o => o.method === "pay_monthly")!;
  assert.deepEqual(dates(four.goalPlan!), cleanDates);
  assert.deepEqual(dates(monthly.goalPlan!), ["2027-03-14", "2027-04-13", "2027-03-14"]);
  assert.deepEqual([four.forecast.minBalance, four.forecast.stressMinBalance, four.forecast.risk], [1513, 1122, "green"]);
  assert.deepEqual([monthly.forecast.minBalance, monthly.forecast.stressMinBalance, monthly.forecast.risk], [1738, 1572, "green"]);
  assert.equal(total(four.goalPlan!), 703.2); assert.equal(total(monthly.goalPlan!), 703.2);
  assert.deepEqual(load(), stored); assert.deepEqual(snapshot(owner), adjusted);
});
