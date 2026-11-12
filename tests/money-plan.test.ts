import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { incomeDates, calendarMonthDate, planningPeriod } from "../lib/planning/calendar";
import { planningOverview, incomeOverlap } from "../lib/planning/overview";
import { buildPersonas } from "../lib/personas";
import type { PlanningIncomeEntry } from "../lib/planning/incomeTypes";
import type { PlanningBudgetView } from "../lib/planning/service";

Object.assign(globalThis, { AsyncLocalStorage });
process.env.DEMO_TODAY = "2026-11-10";
const emptyBudget = { categories: [] } as unknown as PlanningBudgetView;
const income = (patch: Partial<PlanningIncomeEntry> = {}): PlanningIncomeEntry => ({ id: "extra", name: "Family allowance", amountCents: 150000, currency: "USD", frequency: "quarterly", nextDate: "2026-11-15", status: "confirmed", sourceType: "user_entered", reliability: "expected", createdAt: "2026-11-10T00:00:00Z", updatedAt: "2026-11-10T00:00:00Z", confirmedAt: "2026-11-10T00:00:00Z", version: 1, ...patch });

test("monthly income anchors January 31 across February without permanent calendar drift", () => {
  assert.deepEqual(incomeDates("2027-01-31", "monthly", "2027-01-01", "2027-04-30"), ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  assert.deepEqual(incomeDates("2028-01-31", "monthly", "2028-01-01", "2028-03-31"), ["2028-01-31", "2028-02-29", "2028-03-31"]);
  assert.equal(calendarMonthDate("2027-04-30", 1), "2027-05-30");
});
test("biweekly income uses exactly 14 UTC days, including year and daylight-saving boundaries", () => {
  assert.deepEqual(incomeDates("2026-12-24", "biweekly", "2026-12-24", "2027-01-31"), ["2026-12-24", "2027-01-07", "2027-01-21"]);
  assert.deepEqual(incomeDates("2026-10-25", "biweekly", "2026-10-25", "2026-11-30"), ["2026-10-25", "2026-11-08", "2026-11-22"]);
});
test("quarterly income uses every three calendar months and preserves month-end anchors across years", () => {
  assert.deepEqual(incomeDates("2026-10-31", "quarterly", "2026-10-01", "2027-07-31"), ["2026-10-31", "2027-01-31", "2027-04-30", "2027-07-31"]);
});
test("one-time income occurs once and past or out-of-range entries are never fabricated", () => {
  assert.deepEqual(incomeDates("2026-11-10", "once", "2026-11-10", "2027-01-31"), ["2026-11-10"]);
  assert.deepEqual(incomeDates("2026-11-09", "once", "2026-11-10", "2027-01-31"), []);
  assert.deepEqual(incomeDates("2027-02-01", "once", "2026-11-10", "2027-01-31"), []);
  assert.deepEqual(incomeDates("2020-01-31", "quarterly", "2026-11-01", "2027-02-28"), ["2027-01-31"]);
});
test("three-calendar-month periods label partial and full months, including leap years and year transitions", () => {
  const partial = planningPeriod("2026-11-10");
  assert.deepEqual(partial.months.map(month => [month.month, month.days, month.partial]), [["2026-11", 21, true], ["2026-12", 31, false], ["2027-01", 31, false]]);
  assert.equal(partial.end, "2027-01-31");
  assert.ok(planningPeriod("2026-12-01").months.every(month => !month.partial));
  assert.equal(planningPeriod("2028-02-29").months[0].days, 1);
  assert.equal(planningPeriod("2028-02-29").months[0].calendarDays, 29);
});
test("invalid calendar dates, unsupported frequencies and reversed ranges are rejected", () => {
  assert.throws(() => incomeDates("2027-02-30", "monthly", "2027-02-01", "2027-04-30"));
  assert.throws(() => incomeDates("2027-01-01", "weekly" as never, "2027-02-01", "2027-04-30"));
  assert.throws(() => incomeDates("2027-01-01", "monthly", "2027-05-01", "2027-04-30"));
  assert.throws(() => planningPeriod("invalid"));
});
test("a $1500 quarterly allowance is received on one date rather than spread as $500 per month", () => {
  const base = buildPersonas()[0], persona = { ...base, recurring: [], dailySpend: 0 };
  const view = planningOverview(persona, [], [income()], emptyBudget, "2026-11-10");
  assert.deepEqual(view.months.map(month => month.expectedIncomeCents), [150000, 0, 0]);
  assert.deepEqual(view.events.map(event => event.date), ["2026-11-15"]);
});
test("draft, uncertain, hypothetical and paused income never enters expected-income totals", () => {
  const persona = { ...buildPersonas()[0], recurring: [], dailySpend: 0 };
  for (const patch of [{ status: "draft" }, { reliability: "uncertain" }, { sourceType: "hypothetical", reliability: "uncertain" }, { status: "paused" }] as Partial<PlanningIncomeEntry>[]) {
    const view = planningOverview(persona, [], [income(patch)], emptyBudget, "2026-11-10");
    assert.equal(view.months.reduce((sum, month) => sum + month.expectedIncomeCents, 0), 0);
    if (patch.status === "paused") assert.equal(view.events.length, 0);
    else assert.equal(view.months[0].excludedIncomeCents, 150000);
  }
});
test("same-name or amount/date-matched modeled income is flagged and not counted a second time", () => {
  const persona = buildPersonas()[0];
  for (const entry of [income({ name: " PAYCHECK ", amountCents: 10000 }), income({ name: "Salary copy", nextDate: "2026-11-19", frequency: "biweekly" })]) {
    assert.ok(incomeOverlap(entry, persona, "2026-11-10").some(item => item.id === "a-pay"));
    const baseline = planningOverview(persona, [], [], emptyBudget, "2026-11-10");
    const view = planningOverview(persona, [], [entry], emptyBudget, "2026-11-10");
    assert.deepEqual(view.months.map(month => month.expectedIncomeCents), baseline.months.map(month => month.expectedIncomeCents));
  }
});
test("potential duplicates among additional planning sources are also excluded until reviewed", () => {
  const persona = { ...buildPersonas()[0], recurring: [] };
  const view = planningOverview(persona, [], [income(), income({ id: "copy", name: "Another allowance" })], emptyBudget, "2026-11-10");
  assert.ok(view.entries.every(entry => entry.overlap.length === 1)); assert.equal(view.months[0].expectedIncomeCents, 0);
  const paused = planningOverview(persona, [], [income(), income({ id: "copy", status: "paused" })], emptyBudget, "2026-11-10");
  assert.equal(paused.months[0].expectedIncomeCents, 150000);
});
test("uncertain modeled income remains separate from expected totals for Jordan", () => {
  const view = planningOverview(buildPersonas()[2], [], [], emptyBudget, "2026-11-10");
  assert.ok(view.modeledIncome.every(entry => entry.status === "uncertain")); assert.ok(view.months.every(month => month.expectedIncomeCents === 0));
  assert.ok(view.months.some(month => month.excludedIncomeCents > 0));
});
test("confirmed budgets are prorated only as separate estimates and never blindly added to modeled expenses", () => {
  const budget = { categories: [{ categoryId: "housing-and-utilities", category: "Housing and utilities", confirmedMonthlyCents: 30000,
    confirmation: { evidence: { observation: { completeMonths: ["2026-08", "2026-09", "2026-10"] } } }, overlap: { scheduledBills: [{ id: "a-rent", name: "Rent" }] } }] } as unknown as PlanningBudgetView;
  const persona = buildPersonas()[0], baseline = planningOverview(persona, [], [], emptyBudget, "2026-11-10");
  const view = planningOverview(persona, [], [], budget, "2026-11-10");
  assert.deepEqual(view.months.map(month => month.confirmedBudgetEstimateCents), [21000, 30000, 30000]);
  assert.deepEqual(view.months.map(month => month.modeledOutgoingCents), baseline.months.map(month => month.modeledOutgoingCents));
  assert.ok(view.months.every(month => month.combinedOutgoingCents === null));
  assert.equal(view.expenseReview[0].possibleEverydayOverlap, true); assert.equal(view.expenseReview[0].scheduledBills[0].id, "a-rent");
});
test("purchase reserves appear once, past/today reserves remain excluded, and existing model cadence is retained", () => {
  const persona = buildPersonas()[0];
  const view = planningOverview(persona, [{ date: "2026-11-09", amount: 100, label: "Past" }, { date: "2026-11-10", amount: 200, label: "Already reserved today" }, { date: "2026-12-10", amount: 300, label: "Future reserve" }], [], emptyBudget, "2026-11-10");
  assert.deepEqual(view.months.map(month => month.purchaseReservesCents), [0, 30000, 0]);
  assert.deepEqual(view.events.filter(event => event.sourceId === "a-rent").map(event => event.date), ["2026-11-15", "2026-12-15", "2027-01-14"]);
  assert.equal(view.months[0].everydayEstimateCents, 42000);
});

test("income planning mutations are versioned, scoped, persisted, resettable and isolated from authoritative finances", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riskpilot-income-"));
  process.env.STORE_PATH = path.join(dir, "store.json"); process.env.DEMO_SEED_ENABLED = "true";
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { ensurePersona, load, reset, newPersona } = await import("../lib/store");
  const { moneyPlanView, updatePlanningIncome } = await import("../lib/planning/incomeService");
  const { snapshot, inputHash, personaWithState } = await import("../lib/state");
  const { buildOptions } = await import("../lib/engine/options");
  const { getProduct } = await import("../lib/catalog");
  const { updatePlanningBudget, planningBudgetView } = await import("../lib/planning/service");
  const owner = "income-a:alex", other = "income-b:alex", sam = "income-a:sam", jordan = "income-a:jordan";
  for (const id of [owner, other, sam, jordan]) ensurePersona(id);
  const values = { name: "Family allowance", amountCents: 150000, currency: "USD", frequency: "quarterly", nextDate: "2026-11-15", sourceType: "user_entered", reliability: "expected" };
  const command = (action: string, rest: Record<string, unknown> = {}, id = owner) => { const view = moneyPlanView(id); return { action, version: view.version, epoch: view.epoch, basisHash: view.basisHash, ...rest }; };
  const before = snapshot(owner), hash = inputHash(owner), otherBefore = load().personas[other], samBefore = load().personas[sam];
  const options = () => { const { persona, payments } = personaWithState(owner); return buildOptions(persona, persona.goals, payments, getProduct("aero-14")!); };
  const optionsBefore = options(), ledgers = { orders: load().orders, snapshots: load().snapshots, commands: load().commands };
  function unchanged() { assert.deepEqual(snapshot(owner), before); assert.equal(inputHash(owner), hash); assert.deepEqual(options(), optionsBefore); assert.deepEqual(load().personas[other], otherBefore); assert.deepEqual(load().personas[sam], samBefore); assert.deepEqual({ orders: load().orders, snapshots: load().snapshots, commands: load().commands }, ledgers); }
  let id = "";
  await t.test("reading derives existing income once without persisting or auto-confirming new schedules", () => {
    const view = moneyPlanView(owner); assert.equal(view.entries.length, 0); assert.equal(view.modeledIncome.length, 1); assert.equal(load().personas[owner].planningIncome, undefined); unchanged();
  });
  await t.test("create persists an unconfirmed draft with stable ID, currency and timestamps", () => {
    const result = updatePlanningIncome(owner, command("create", values)); id = result.plan.entries[0].id;
    assert.equal(result.forecastChanged, false); assert.equal(result.plan.entries[0].status, "draft"); assert.equal(result.plan.entries[0].confirmedAt, null); assert.ok(result.plan.entries[0].createdAt); assert.equal(result.plan.entries[0].currency, "USD");
    assert.equal(JSON.parse(fs.readFileSync(process.env.STORE_PATH!, "utf8")).personas[owner].planningIncome.entries[id].id, id); unchanged();
  });
  await t.test("confirmation explicitly includes a reliable non-overlapping schedule, without modifying forecasts", () => {
    const baseline = moneyPlanView(owner).months[0].expectedIncomeCents;
    const result = updatePlanningIncome(owner, command("confirm", { id }));
    assert.equal(result.plan.entries[0].status, "confirmed"); assert.ok(result.plan.entries[0].confirmedAt); assert.equal(result.plan.entries[0].version, 2);
    assert.equal(result.plan.months[0].expectedIncomeCents, baseline + 150000); unchanged();
  });
  await t.test("editing clears confirmation and preserves the stable ID; pause/resume/remove are explicit", () => {
    const edited = updatePlanningIncome(owner, command("edit", { id, ...values, amountCents: 160000 }));
    assert.equal(edited.plan.entries[0].status, "draft"); assert.equal(edited.plan.entries[0].confirmedAt, null); assert.equal(edited.plan.entries[0].id, id); unchanged();
    updatePlanningIncome(owner, command("confirm", { id })); updatePlanningIncome(owner, command("pause", { id }));
    assert.equal(moneyPlanView(owner).entries[0].status, "paused"); assert.equal(moneyPlanView(owner).events.some(event => event.sourceId === id), false); unchanged();
    updatePlanningIncome(owner, command("confirm", { id })); assert.equal(moneyPlanView(owner).entries[0].status, "confirmed");
    updatePlanningIncome(owner, command("remove", { id })); assert.equal(moneyPlanView(owner).entries.length, 0); unchanged();
  });
  await t.test("negative/fractional/missing money, invalid dates/currency/frequency and injected confirmation/owner fields are rejected", () => {
    const saved = load();
    for (const patch of [{ amountCents: -1 }, { amountCents: 1.5 }, { amountCents: NaN }, { amountCents: "100" }, { amountCents: 100_000_001 }, { currency: "EUR" }, { frequency: "weekly" }, { nextDate: "2026-02-30" }, { nextDate: "2026-11-09" }, { nextDate: "2040-01-01" }, { name: " " }, { name: "a".repeat(81) }, { sourceType: "modeled" }, { status: "confirmed" }, { ownerId: other }, { sourceType: "hypothetical", reliability: "expected" }]) assert.throws(() => updatePlanningIncome(owner, command("create", { ...values, ...patch })));
    for (const body of [null, [], {}, command("create"), command("create", { ...values, id: "injected" }), command("confirm", { id: "missing", amountCents: 100 })]) assert.throws(() => updatePlanningIncome(owner, body));
    assert.deepEqual(load(), saved);
    assert.throws(() => updatePlanningIncome(owner, command("edit", { ...values, id: "__proto__" })), /not found/); assert.equal(Object.hasOwn(Object.prototype, "amountCents"), false);
  });
  await t.test("stale versions/epochs/bases, foreign entry IDs and date changes cannot overwrite another plan", () => {
    const old = command("create", values); updatePlanningIncome(owner, old); id = moneyPlanView(owner).entries[0].id;
    assert.throws(() => updatePlanningIncome(owner, old), /Refresh/);
    assert.throws(() => updatePlanningIncome(owner, { ...command("confirm", { id }), epoch: "stale" }), /Refresh/);
    assert.throws(() => updatePlanningIncome(owner, { ...command("confirm", { id }), basisHash: "stale" }), /Refresh/);
    assert.throws(() => updatePlanningIncome(other, command("confirm", { id }, other)), /not found/);
    assert.throws(() => updatePlanningIncome(sam, command("confirm", { id }, sam)), /not found/);
    const dated = command("confirm", { id }); process.env.DEMO_TODAY = "2026-11-11";
    assert.throws(() => updatePlanningIncome(owner, dated), /Refresh/); process.env.DEMO_TODAY = "2026-11-10"; unchanged();
  });
  await t.test("zero amounts are valid; hypothetical and overlap-confirmed entries remain excluded", () => {
    updatePlanningIncome(owner, command("edit", { id, ...values, amountCents: 0 })); updatePlanningIncome(owner, command("confirm", { id })); assert.equal(moneyPlanView(owner).entries[0].amountCents, 0);
    updatePlanningIncome(owner, command("edit", { id, ...values, sourceType: "hypothetical", reliability: "uncertain" })); updatePlanningIncome(owner, command("confirm", { id }));
    let view = moneyPlanView(owner); assert.equal(view.events.filter(event => event.sourceId === id).every(event => !event.included), true);
    updatePlanningIncome(owner, command("edit", { id, ...values, name: "Paycheck" })); updatePlanningIncome(owner, command("confirm", { id }));
    view = moneyPlanView(owner); assert.ok(view.entries[0].overlap.some(item => item.id === "a-pay")); assert.ok(view.events.filter(event => event.sourceId === id).every(event => !event.included)); unchanged();
  });
  await t.test("budget confirmation updates only the separate prorated budget component, never a combined expense total", () => {
    const planBefore = moneyPlanView(owner); const budgets = planningBudgetView(owner);
    updatePlanningBudget(owner, { action: "confirm", categoryId: "housing-and-utilities", monthlyCents: 30000, version: budgets.version, epoch: budgets.epoch, basisHash: budgets.basisHash });
    const after = moneyPlanView(owner); assert.equal(after.months[0].confirmedBudgetEstimateCents, 21000);
    assert.deepEqual(after.months.map(month => month.modeledOutgoingCents), planBefore.months.map(month => month.modeledOutgoingCents)); assert.ok(after.months.every(month => month.combinedOutgoingCents === null)); unchanged();
  });
  await t.test("past-dated schedules require explicit date review before reconfirmation", () => {
    process.env.DEMO_TODAY = "2026-11-16";
    assert.throws(() => updatePlanningIncome(owner, command("confirm", { id })), /next expected date/);
    process.env.DEMO_TODAY = "2026-11-10"; unchanged();
  });
  await t.test("reset deterministically clears planning state while preserving other personas' schedules", () => {
    const otherCommand = command("create", values, jordan); updatePlanningIncome(jordan, otherCommand); const jordanBefore = load().personas[jordan];
    const old = command("confirm", { id }); reset(owner);
    assert.deepEqual(load().personas[owner], newPersona(owner)); assert.equal(moneyPlanView(owner).entries.length, 0);
    assert.deepEqual(load().personas[jordan], jordanBefore); assert.throws(() => updatePlanningIncome(owner, old), /Refresh/); unchanged();
  });
  await t.test("HTTP routes enforce current workspace/account ownership, stale versions and disabled-demo behavior", async () => {
    const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
    const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
    const { RequestCookies } = await import("next/dist/compiled/@edge-runtime/cookies");
    const { GET, PATCH } = await import("../app/api/money-plan/route");
    const within = <T>(workspace: string, account: string, fn: () => T) => workAsyncStorage.run({ route: "/api/money-plan", isStaticGeneration: false } as never, () => workUnitAsyncStorage.run({ type: "request", phase: "render", cookies: new RequestCookies(new Headers({ cookie: `rp_workspace=${workspace}; rp_account=${account}` })) } as never, fn));
    const a = "12345678-1234-1234-1234-123456789abc", b = "12345678-1234-1234-1234-123456789def";
    const req = (body: unknown) => new Request("http://localhost/api/money-plan", { method: "PATCH", body: JSON.stringify(body) });
    const view = await within(a, "alex", () => GET()).then(response => response.json());
    const body = { action: "create", ...values, version: view.version, epoch: view.epoch, basisHash: view.basisHash };
    assert.equal((await within(a, "alex", () => PATCH(req(body)))).status, 200); assert.equal((await within(a, "alex", () => PATCH(req(body)))).status, 409);
    const another = await within(b, "alex", () => GET()).then(response => response.json()); assert.equal(another.entries.length, 0);
    const same = await within(a, "sam", () => GET()).then(response => response.json()); assert.equal(same.entries.length, 0);
    assert.equal((await within(b, "alex", () => PATCH(req({ ...body, amountCents: -1, basisHash: another.basisHash })))).status, 400);
    process.env.DEMO_SEED_ENABLED = "false";
    assert.equal((await within(a, "alex", () => GET())).status, 404); assert.equal((await within(a, "alex", () => PATCH(req(body)))).status, 404);
    process.env.DEMO_SEED_ENABLED = "true";
  });
});
