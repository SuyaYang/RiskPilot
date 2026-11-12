import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { parseTotal, readCheckoutContext, fundingFromLabel } from "../extension/src/checkout-context";
import { assessExternalPurchase } from "../extension/src/impact";

// Pinned Next dependency supplies a real HTML parser for checkout DOM fixtures.
const require = createRequire(import.meta.url);
const { parse } = require("next/dist/compiled/node-html-parser") as { parse: (html: string) => Pick<Document, "querySelectorAll"> };
process.env.DEMO_TODAY = "2026-11-10";

test("checkout amounts accept a single total and reject malformed, foreign or ambiguous prices", () => {
  assert.deepEqual(parseTotal("Order details USD 1,234.56"), { amount: 1234.56, explicitUsd: true });
  assert.deepEqual(parseTotal("Pay in full $900.00 today"), { amount: 900, explicitUsd: false });
  for (const value of ["$225.00 $900.00", "CAD $900.00", "€900.00", "$9,00.00", "$900.001", "$0.00", "$100001.00", "900"]) assert.equal(parseTotal(value), null, value);
});

test("external checkout reads the full order total, not selected installments or account details", () => {
  const dom = parse(`<button aria-label="Order details $900.00">Order $900.00</button>
    <div role="checkbox" aria-checked="true">Pay in 4 4 interest-free payments of $225.00</div>
    <div role="radio" aria-checked="true">Credit Union checking $51.00</div><input value="sensitive never read">`);
  // Accessible labels and visible text may repeat the same total. It is still one authoritative amount.
  const context = readCheckoutContext(dom);
  assert.equal(context.amount, 900);
  assert.equal(context.funding, "pay_in_4");
  assert.equal(context.currency, "unconfirmed");
});

test("unknown or conflicting order totals never fall back to a smaller installment", () => {
  assert.equal(readCheckoutContext(parse(`<div role="checkbox" aria-checked="true">Pay in 4 $225.00</div>`)).amount, null);
  assert.equal(readCheckoutContext(parse(`<button>Order $900.00</button><button>Order $800.00</button><div id="id-pay-in-full-action">Pay in full $900.00</div>`)).amount, null);
});

test("non-USD checkout never produces a USD total and unsupported methods remain unknown", () => {
  const context = readCheckoutContext(parse(`<button>Order CAD $900.00</button><div id="id-pay-in-full-action">Pay in full $900.00</div>`));
  assert.equal(context.amount, null); assert.equal(context.currency, "unsupported");
  assert.equal(fundingFromLabel("PayPal Credit"), "unknown");
});

test("checkout amounts recalculate when tax or shipping changes, independent of the store catalog", () => {
  const dom = parse(`<button>Order USD 937.81</button>`);
  assert.equal(readCheckoutContext(dom).amount, 937.81);
  const regular = assessExternalPurchase(900, "sam").options.find(o => o.method === "full")!;
  const taxed = assessExternalPurchase(937.81, "sam").options.find(o => o.method === "full")!;
  assert.equal(Math.round((regular.forecast.minBalance - taxed.forecast.minBalance) * 100), 3781);
});

test("extension reuses the financial kernel and keeps loans hypothetical", () => {
  const result = assessExternalPurchase(900, "sam");
  const full = result.options.find(o => o.method === "full")!;
  const four = result.options.find(o => o.method === "pay_in_4")!;
  assert.equal(full.forecast.minBalance, 7995); assert.equal(four.forecast.minBalance, 8670);
  assert.equal(full.forecast.bufferGap, 5995); assert.equal(four.hypothetical, true);
  // Immediate cash-funded purchase matches the recorded-reserve goal model.
  assert.equal(full.goalImpact.find(g => g.name === "Wedding")?.delayDays, 0);
  assert.throws(() => assessExternalPurchase(-1, "sam"));
  assert.throws(() => assessExternalPurchase(900, "missing"));
});

test("extension manifest limits content access to top-level Sandbox checkout", () => {
  const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://www.sandbox.paypal.com/pay/checkout*", "https://www.sandbox.paypal.com/checkoutnow*"]);
  assert.equal(manifest.content_scripts[0].all_frames, false);
  assert.equal(manifest.content_scripts[0].world, "ISOLATED");
  assert.equal(manifest.permissions, undefined); assert.equal(manifest.host_permissions, undefined);
});
