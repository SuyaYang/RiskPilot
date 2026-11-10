import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPersonas } from "../lib/personas";
import { getProduct } from "../lib/catalog";
import { buildOptions, schedule } from "../lib/engine/options";
import { forecast, occurrences } from "../lib/engine/forecast";
import { allocateGoals } from "../lib/engine/goals";
import { investableNow } from "../lib/engine/investable";

// today() reads this at call time, so every date below is fixed
process.env.DEMO_TODAY = "2026-11-10";

const persona = (id: string) => buildPersonas().find((p) => p.id === id)!;
const laptop = getProduct("aero-14")!;
const cheaper = getProduct("aero-13")!;

test("pay in 4 splits into four payments two weeks apart that sum to the price", () => {
  const { payments, extraCost } = schedule("pay_in_4", 900.01);
  assert.equal(payments.length, 4);
  assert.deepEqual(payments.map((p) => p.date), ["2026-11-10", "2026-11-24", "2026-12-08", "2026-12-22"]);
  assert.equal(Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100, 900.01);
  assert.equal(extraCost, 0);
});

test("pay monthly adds interest at the assumed APR", () => {
  const { payments, extraCost } = schedule("pay_monthly", 900);
  assert.equal(payments.length, 12);
  assert.ok(extraCost > 90 && extraCost < 110);
});

test("biweekly income occurs every 14 days and shifts in the stress test", () => {
  const pay = persona("alex").recurring.find((r) => r.id === "a-pay")!;
  assert.deepEqual(occurrences(pay), [9, 23, 37]);
  assert.deepEqual(occurrences(pay, 45, 7), [16, 30, 44]);
});

test("forecast finds the lowest balance before the next paycheck", () => {
  const f = forecast(persona("alex"));
  assert.equal(f.minBalance, 1720);
  assert.equal(f.minBalanceDate, "2026-11-18");
  assert.equal(f.risk, "green");
});

test("Alex: paying in full breaks the buffer, Pay in 4 is recommended", () => {
  const p = persona("alex");
  const r = buildOptions(p, p.goals, [], laptop, cheaper);
  const by = (m: string) => r.options.find((o) => o.method === m)!;
  assert.equal(by("full").forecast.risk, "red");
  assert.equal(by("pay_in_4").forecast.risk, "green");
  assert.equal(r.recommended, "pay_in_4");
  assert.ok(by("pay_in_4").goalImpact.find((g) => g.goalId === "a-trip")!.delayDays < by("full").goalImpact.find((g) => g.goalId === "a-trip")!.delayDays);
});

test("Sam: comfortable buyers are not pushed into installments", () => {
  const p = persona("sam");
  assert.equal(buildOptions(p, p.goals, [], laptop, cheaper).recommended, "full");
});

test("Jordan: when no option is safe the recommendation is to wait", () => {
  const p = persona("jordan");
  const r = buildOptions(p, p.goals, [], laptop, cheaper);
  assert.equal(r.recommended, "wait");
  assert.ok(r.options.filter((o) => o.method !== "wait").every((o) => !o.responsible.ok));
});

test("goals are funded by priority and deadline", () => {
  const p = persona("alex");
  const a = allocateGoals(p, p.goals);
  const trip = a.goals.find((g) => g.goalId === "a-trip")!;
  assert.equal(trip.status, "on_track");
  assert.equal(trip.allocatedThisMonth, 250);
});

test("paused goals receive nothing", () => {
  const p = persona("alex");
  const goals = p.goals.map((g) => (g.id === "a-trip" ? { ...g, paused: true } : g));
  const a = allocateGoals(p, goals);
  assert.equal(a.goals.find((g) => g.goalId === "a-trip")!.status, "paused");
});

test("investable amount drops after a Pay in 4 purchase and is zero when a check fails", () => {
  const p = persona("alex");
  const f0 = forecast(p);
  const inv0 = investableNow(p, f0, allocateGoals(p, p.goals));
  assert.equal(inv0.investable, 90);
  const { payments } = schedule("pay_in_4", 900);
  const f1 = forecast(p, payments);
  const inv1 = investableNow(p, f1, allocateGoals(p, p.goals, payments.slice(1)));
  assert.ok(inv1.investable < inv0.investable);
  const j = persona("jordan");
  const fj = forecast(j);
  assert.equal(investableNow(j, fj, allocateGoals(j, j.goals)).investable, 0);
});

test("risk checks include payments beyond the visible 45-day chart", () => {
  const p = { ...persona("sam"), checkingBalance: 5000, buffer: 1000, dailySpend: 0, recurring: [], goals: [] };
  const f = forecast(p, [], [{ date: "2027-02-10", amount: 4500, label: "Later installment" }]);
  assert.equal(f.dailyBalances.length, 45);
  assert.equal(f.risk, "red");
  assert.equal(f.minBalance, 500);
  assert.equal(f.evaluatedThrough, "2027-02-10");
});
