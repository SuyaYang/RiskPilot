# RiskPilot

**Financial intelligence at the moment of PayPal payment.**

RiskPilot connects planning with checkout: understand your finances, explore what a purchase could change, and see your updated outlook after a verified PayPal Sandbox capture.

## The problem

Checkout tells us the price. It rarely tells us whether upcoming bills, a delayed paycheck, an emergency reserve or an important savings goal make that purchase difficult. RiskPilot brings that context to the decision, while the user remains in control of whether to pay.

## What you can do

- **Dashboard:** inspect a fictional financial snapshot, 45-day cash-flow forecast, upcoming income/bills, protected cash buffer, available-to-allocate capacity and historical spending insights.
- **Goals:** set savings priorities and review dynamic contributions, completion estimates and purchase-related changes.
- **Money:** explore spending history, category suggestions and budget What-if previews; explicitly apply supported category replacements. Plan monthly, biweekly, quarterly or one-time income where supported. Additional planned income is treated conservatively. Only timing-compatible income replacements become authoritative; unsupported date/cadence changes remain planning-only, with original modeled salary active.
- **Shop:** explore a purchase without creating a payment; compare buying now, after expected income, waiting and educational Pay in 4 / Pay Monthly scenarios. Installment scenarios are simulations, not approved or enabled financing. Actual checkout captures the full price.
- **Grounded explanations:** ask about engine-calculated financial facts, inspect sources and use confirmed explanation preferences.
- **Vision:** open `/vision`, a standalone concept for a possible deeper PayPal experience. It is not an official PayPal interface or a current native integration.

## PayPal is part of the decision journey

### A. Explore in RiskPilot Shop, then buy

**Shop → payment-free impact analysis → PayPal Checkout (`PAY_NOW`, `commit:true`) → final buyer confirmation in PayPal → server-verified capture → saved forecast.**

An unchanged, current assessment does not require another mandatory RiskPilot confirmation after PayPal's final Pay Now. Changed or expired assessments pause for review; uncertain outcomes use recovery on the same order.

### B. Start at the independent Northstar merchant

**Northstar → server-priced PayPal order → buyer approval (`CONTINUE`, `commit:false`) → signed RiskPilot impact review → explicit Confirm and Pay → verified capture → updated outlook → merchant receipt.**

Approval alone does not capture this merchant order. The review gives the buyer financial context before the final payment action.

Both paths validate order ownership, current financial inputs, assessment expiry, amount and USD currency. Server-owned checkout intent determines the confirmation path; signed merchant handoffs protect the connection between store and review. Stable capture identifiers and recovery record one economic purchase and one saved forecast. These are local prototype safeguards, not production identity or complete payment infrastructure. [Purchase flows](docs/PURCHASE_FLOWS.md) · [Merchant integration](docs/MERCHANT_CHECKOUT.md)

## How the AI works

**Deterministic engine for financial truth. Generative AI for personalized understanding.**

The TypeScript engine calculates balances, income/expenses, cash-buffer risk, allocation capacity, goal contributions and dates, purchase timing and educational installment comparisons. Gemini receives server-generated evidence to select and organize explanations. In purchase and Money reviews, the model orders approved fact IDs; the application renders server-authored statements. Other explanation paths validate output against engine evidence. Optional goal drafts require user confirmation.

Gemini does not set authoritative balances, determine payment amounts, authorize payments or execute purchases. Purchase and Money explanations use labeled deterministic fallback for missing credentials, provider errors or invalid responses. Free-text questions need a configured Gemini key; guided page facts and manual goal editing remain available without one.

## Financial intelligence engine

The dashboard displays 45 daily balances and a seven-day income-delay stress check. Longer payment schedules extend existing affordability evaluation through their final payment, while the chart stays 45 days. Goal estimates use priority-based contributions and 30.4-day monthly funding buckets.

Immediate purchases reduce projected starting cash once. Future and hypothetical installment payments consume safe existing cash headroom once in date order, then reduce contributions only for uncovered costs. Headroom is evaluated through the payment horizon, capped by current cash and conservative income assumptions. Independent deficits and protected-goal priorities remain intact. Equivalent immediate previews and completed reserves agree under unchanged assumptions. [Current financial contract](docs/FORECAST_INTEGRATION.md) · [Step 8.7 results](docs/STEP87_RESULT.md)

## Example: fictional Alex, November 12, 2026

Alex starts with **$3,500 checking cash**, a **$1,720** minimum forecast, **$1,540** delayed-income minimum and **$90** available to allocate.

Explicitly applying Shopping **$90 → $30/month** changes the minimum to **$1,738**, delayed-income minimum to **$1,572** and allocation capacity to **$122**, without increasing checking cash.

From that **shopping-adjusted** workspace, a $900 laptop gives:

| Scenario | Lowest cash | Delayed-income minimum | Risk |
| --- | ---: | ---: | --- |
| Buy today | $838 | $672 | Red |
| Buy after payday (Nov 22) | $1,334.54 | $672 | Yellow |
| Hypothetical Pay in 4 | $1,513 | $1,122 | Green |
| Hypothetical Pay Monthly | $1,738 | $1,572 | Green |

Pay Monthly includes $100.44 modeled financing cost; neither installment comparison establishes eligibility or actual terms. Green describes the modeled buffer checks, not guaranteed affordability.

For the immediate full-price purchase, projected starting cash becomes **$2,600** and available to allocate becomes **$0**. Japan Trip stays **March 14, 2027**, Emergency Fund stays **April 13**, and Start investing moves **March 14 → April 13**. An equivalent verified full-price capture produces matching forecasts and goal projections. These are fictional scenario results, not real customer outcomes.

## Technical architecture

**Next.js 15.5.29 · React 19.1.1 · TypeScript 5.8.3 · Google Gemini API · PayPal JavaScript SDK and Orders v2 API · local JSON demo persistence.** The independent merchant uses Node.js HTTP; tests use `node:test` with `tsx`.

```mermaid
flowchart LR
  UI[Dashboard, Goals, Money, Shop] --> Engine[Deterministic TypeScript engine]
  Engine --> Facts[Server-generated financial evidence]
  Facts --> AI[Gemini or deterministic fallback]
  AI --> UI
  Checkout[Shop or Northstar checkout] --> PayPal[PayPal Sandbox]
  PayPal --> Verify[Server capture verification]
  Verify --> Store[Exactly-once local purchase record]
  Store --> Engine
```

There is no connected bank feed, Python forecasting service or Supabase database in the running prototype. [Implementation details](docs/IMPLEMENTATION_STATUS.md)

## Judge Testing Access

RiskPilot is a working application judges can run locally. The [official rules](https://paypalaihackathon.devpost.com/rules) allow setup instructions instead of hosting and require free testing access plus a **public, open-source repository**. This repository is private; the owner must make it public before submission.

Requires **Node.js 22**, npm, `curl`, Python 3 and Bash. In a fresh clone:

```bash
git clone https://github.com/SuyaYang/RiskPilot.git
cd RiskPilot
git switch cynthia
npm ci
cp .env.example .env
```

Do not overwrite an existing `.env`. Use a fresh browser profile and isolated ledger paths as described in [RUNNING.md](RUNNING.md).

### Mode 1 — Financial Demo, No Gemini Key Required

Leave `GEMINI_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and `NEXT_PUBLIC_PAYPAL_CLIENT_ID` blank in your new `.env`. Keep `DEMO_SEED_ENABLED=true`, then run:

```bash
DEMO_TODAY=2026-11-12 npm run dev
```

Open [localhost:3000](http://localhost:3000) and select fictional `alex@riskpilot.demo` at `/login`; no password or paid account is needed. Runtime-verified features include Dashboard and its 45-day forecast, Goals and completion estimates, Money Planning, category budget preview/application, Shop purchase-impact comparisons and [Vision](http://localhost:3000/vision). Shopping $90 → $30 increases allocation capacity $90 → $122 while checking stays $3,500.

Purchase and Money explanations use server-authored deterministic templates when Gemini is absent. Suggested page explanations remain usable. Free-text **Ask RiskPilot** instead reports that Gemini is unconfigured; AI goal drafting requires Gemini, while manual goal editing works. No online AI response is claimed in this mode. Shop analysis creates no payment; an optional saved local simulation affects only the isolated demo workspace.

Use `npm run dev` for this mode. The `demo` / `demo:shop` launchers intentionally require **PayPal**, not Gemini, because they prepare provider checkout.

### Mode 2 — Live Gemini AI

The unchanged source and `.env.example` use **`gemini-3.6-flash`** via the standard `generateContent` API. Google's [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash) lists it, and [pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.6-flash) lists free-tier standard input/output. No paid-only model is required or substituted. RiskPilot grounds responses in its own engine evidence; it does not use Google's separately priced Search/Maps grounding tools.

1. Sign into [Google AI Studio API keys](https://aistudio.google.com/apikey). Follow Google's [key setup](https://ai.google.dev/gemini-api/docs/api-key) to create/select a project and key.
2. Check that the project can access this model on the free tier; imported projects may need verification. Do not enable paid billing merely to run the financial demo. Free quotas and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) depend on project eligibility and may change.
3. In your ignored `.env`, set `GEMINI_API_KEY` to your own key and retain `GEMINI_MODEL=gemini-3.6-flash`. Keep the key server-only; never use a `NEXT_PUBLIC_` name for it.
4. Restart `npm run dev`. Try **Explain this money plan**, a purchase explanation, or **Ask RiskPilot**. A template label indicates fallback; it is not proof of a live model response. Quota/provider failures do not stop financial calculations.

Model availability/free pricing were checked against official documentation; no new live Gemini call was made in this access verification. Account/region restrictions or exhausted quotas can still prevent a particular judge's live AI use. If needed, the owner must arrange a free-to-judge working demo with API credentials held on its backend, or privately grant authorized test-project access—never publish keys.

### Mode 3 — Full PayPal Sandbox Demo

The hackathon [rules](https://paypalaihackathon.devpost.com/rules) identify PayPal Sandbox as free. At [PayPal Developer](https://developer.paypal.com/), log in/sign up, open **Apps & Credentials**, select **Sandbox**, and create/select a REST app associated with a Sandbox business seller. Copy its client ID and secret using PayPal's [setup guide](https://developer.paypal.com/api/rest/).

Under **Testing Tools → Sandbox Accounts**, create/select a **Personal** buyer, separate from the Business seller. Retrieve its test email/password privately; use them only in the PayPal Sandbox login. [Sandbox account instructions](https://developer.paypal.com/tools/sandbox/accounts/)

Set these names in ignored `.env` using your own values:

```dotenv
PAYPAL_CLIENT_ID=<your-sandbox-app-client-id>
PAYPAL_CLIENT_SECRET=<your-server-only-sandbox-app-secret>
NEXT_PUBLIC_PAYPAL_CLIENT_ID=<the-same-sandbox-app-client-id>
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
RISKPILOT_ORIGIN=http://localhost:3100
MERCHANT_ORIGIN=http://localhost:3200
MERCHANT_PORT=3200
```

The public client ID is an identifier; secrets and buyer passwords never belong in browser-exposed settings. Keep Gemini blank for deterministic explanations or configure Mode 2 independently. In one checkout, the local services generate/reuse the ignored bridge key if `MERCHANT_BRIDGE_SECRET` is blank; do not publish it.

```bash
DEMO_TODAY=2026-11-12 npm run demo
```

Open [RiskPilot Shop](http://localhost:3100/shop) or [Northstar](http://localhost:3200). Shop uses final Pay Now in PayPal; Northstar uses Continue/approval → signed RiskPilot review → explicit Confirm and Pay → verified merchant receipt. Review can stop before those final actions. Sandbox uses test funds, not production money. No capture was initiated during this access check. [Full startup/isolation instructions](RUNNING.md)

No paid subscription is mandatory for these documented modes. Live provider features require eligible accounts, available quotas and configured credentials. Before judging, the owner must resolve public-source access and arrange a no-charge provider-access alternative if an individual judge cannot obtain eligible free accounts. If a hosted demo needs login, supply dedicated test login details privately in the submission's testing instructions, with API/signing secrets kept on the server.

## Demo and validation

Use the [authoritative rehearsal](docs/STEP7B_DEMO_REHEARSAL.md) and [teammate acceptance checklist](docs/TEAM_ACCEPTANCE_REVIEW.md). [Submission text](docs/DEVPOST_SUBMISSION.md) is prepared; a final video link is not yet available. No public deployment is claimed.

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

- Approved implementation freeze: `77730d2cbe8c60c4a9796322b355e6f9a5e8500e`; **324 passing tests**, TypeScript and production build passed. Clean `npm ci` and the same checks were repeated in an isolated copy for release preparation.
- Financial reference scenarios were independently reproduced. The owner reports a final independent Claude **GO** audit for Step 9.
- Historical provider-confirmed Sandbox captures: **$900 Northstar** and **$249 RiskPilot Shop**. These were test-environment payments, not production money. Their [sanitized acceptance record](docs/STEP7B_ACCEPTANCE.md) predates Step 8.7; final regressions used deterministic probes and mocked payment services, with no new actual capture.

Passing tests establish evidence for covered cases, not complete financial correctness.

## Current scope and limitations

This is a fictional-data, local, single-instance prototype. Workspace cookies and demo accounts are not production authentication. JSON storage is not a replicated financial ledger. No bank reconciliation, full refund accounting, trading or real installment product is implemented. Public HTTPS/webhook delivery and physical-device payment acceptance remain unverified. Known dependency advisories are documented in [Step 8.5](docs/STEP85_RESULT.md); no dependency migration is included in this frozen release. Financial estimates are not professional advice or guarantees.

## Future vision

RiskPilot could bring planning closer to payment through permissioned financial data, production identity, reconciliation and deeper PayPal ecosystem integration, subject to platform capabilities and permissions. `/vision` illustrates that opportunity. Whether this improves trust, repeat engagement or checkout decisions is a hypothesis to test.

## Team and license

Built by the RiskPilot team. Sheryl's [baseline MVP](https://github.com/SuyaYang/RiskPilot/commit/3d1543e) established the engine and checkout foundation; subsequent team contributions extend the product and verification. Git history preserves attribution. Code: [MIT License](LICENSE). Bundled Inter font: [SIL Open Font License](app/fonts/OFL.txt).
