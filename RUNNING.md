# Run RiskPilot Checkout

## Current buyer experiences: merchant review and Shop Pay Now

**Northstar store → PayPal Continue → RiskPilot review → Confirm and pay → store receipt**.
Users do not install a browser extension. The simulated merchant has integrated RiskPilot.

**RiskPilot Shop → Explore purchase impact → PayPal Checkout → final Pay Now in PayPal → verified capture → success page**. This path does not repeat Quick Review when the assessment is unchanged.
Exploration itself creates no payment. Changed/expired assessments pause for review; uncertain payments retain same-order recovery.

```bash
npm run demo
```

This starts/checks RiskPilot on port 3100 and the independent merchant on port 3200, opens the
merchant, and never captures or resets anything. Keep its terminal open. Existing processes are
reused, and Ctrl+C stops only processes that the launcher started. Both servers must run from this
same working copy so they share the local server-only bridge key. [Full walkthrough](docs/MERCHANT_CHECKOUT.md).

`npm run demo -- --check` checks both sites without starting or opening anything.
`npm run demo -- --no-open` starts/checks both without opening a browser.
`npm run merchant-demo` starts only the merchant when RiskPilot is already running on port 3100.

This branch implements a **local fictional-data demo** with Dashboard, Goals, Shop and Money.
See the [current implementation overview](README.md) and [original proposed architecture](docs/ARCHITECTURE_ROADMAP.md); see
[implementation / acceptance status](docs/IMPLEMENTATION_STATUS.md) for gaps. This is not a production
financial application and does not connect a bank or authenticate a Supabase user.

## Start

Node.js 22, npm, curl, and Python 3. PayPal Sandbox credentials are required by `npm run demo`; Gemini is optional. App-only simulation is available with `npm run dev` and no PayPal keys.

```bash
npm ci
cp .env.example .env
# Fill your own Sandbox keys for the merchant launcher; leave blank only for app-only simulation.
npm run typecheck
npm test
npm run build
npm run dev
```

Open http://localhost:3000. For another port, set `APP_ORIGIN` to the exact URL and run, for example,
`npm run dev -- --port 3100`. Restart after editing environment values. The browser and server PayPal
client IDs must belong to the same Sandbox app. Live PayPal endpoints are deliberately rejected.

Keep `STORE_PATH=./data/demo-v2.json`. Existing `data/store.json` from the earlier branch uses an
incompatible format; preserve it for reconciliation. The app fails closed on legacy/corrupt data
instead of silently deleting verified payments. Do not use real financial data with this demo.

## Development/build cache isolation

Development uses `.next-dev`; production build/start and type generation use `.next`. These must
remain separate. Building into a running dev server's output caused the checkout error
`Cannot find module './855.js'`. The phase-aware `next.config.mjs` prevents production validation
from replacing development chunks. Both directories contain generated code, not purchase records.
If an old process still reports the missing-chunk error after the config reload, stop that demo
terminal with Ctrl+C and rerun `npm run demo` so it picks up the isolated development directory.

## Shop purchase demo

```bash
npm run demo:shop
```

This opens `http://localhost:3100/shop` from the beginning of the visual flow. It starts the local dev
server if one is not running and verifies Sandbox configuration. Sign in with a fixed demo account,
assess the $900 laptop, then use the single **PayPal Checkout** button below the risk conclusion.
New Shop orders use **Pay Now** in PayPal as the explicit final confirmation, then verify capture and
show the success page. For a read-only walkthrough, stop before PayPal’s final payment confirmation.
Existing records are preserved; the launcher itself never invokes capture or resets data.

```bash
npm run demo:shop -- --check       # check an existing app without opening it
npm run demo:shop -- --no-open     # start/check and print the URL
BASE=http://localhost:3300 npm run demo:shop
```

If the script started the dev server, keep its terminal open and press Ctrl+C to stop it. If the app
was already running, its process is left alone.

## Walk through

1. Sign in at `/login` using a fixed fictional account (for example `alex@riskpilot.demo`).
   Each account has one financial profile; balances, bills and goals are explicitly fictional.
2. Open Goals. Add/edit/pause/resume/delete a goal and review the recalculated expected completion.
   AI drafting is optional and always requires confirmation; without Gemini, use the manual form.
3. Open Shop and compare a product. The visible chart is 45 days, but minimum balance/risk checks run
   through the last evaluated payment date. Pay Later comparison schedules are hypothetical.
4. Read the risk conclusion, then use **PayPal Checkout** directly beneath it. There is one payment
   entry with no expandable checkout. Scenario comparisons do not choose a real PayPal loan.
   Without PayPal keys, the available **Simulate purchase** action is explicitly labeled and makes no
   PayPal request. No-purchase and future-date scenarios do not submit payment.
5. New Shop orders use SDK `commit:true` and Orders `user_action=PAY_NOW`. Confirm as the **Sandbox
   personal buyer**, not the merchant. The final PayPal confirmation starts server-verified capture
   using the trusted Shop assessment and current input hash; unchanged assessments do not repeat
   Quick Review. Changed/expired assessments pause for a refreshed review. Legacy Continue orders
   retain explicit RiskPilot confirmation. Recover unknown outcomes on the same order.
   **External Northstar orders still use Continue → RiskPilot review → explicit Confirm and pay**;
   buyer approval alone never captures those orders. In that review, Skip enters Dashboard while
   the separate bottom Cancel link returns to the merchant.
6. Return to Dashboard. The verified capture, conservative full-price reserve, and versioned
   forecast snapshot are saved together. Merchant capture does not identify the consumer's funding
   account or confirm a loan schedule. Manual fixture balances remain distinct from projections.
7. Invest shows educational allocation templates and conservative cash capacity; it performs no trades.

Browsers get independent opaque demo-workspace cookies. Signing in to a different demo account
changes the fixed fictional profile within that workspace. This is **not Supabase authentication or a verified production tenant boundary**.
A changed goal/purchase/date invalidates an unstarted assessment. Existing order recovery remains valid.

## Real Sandbox smoke test

With the app running and matching Sandbox keys in `.env`:

```bash
bash scripts/smoke-paypal.sh
# Another port:
BASE=http://localhost:3100 bash scripts/smoke-paypal.sh
```

This is a separate manual API diagnostic, not the current Shop SDK walkthrough. Complete the
Sandbox buyer step in PayPal, review the terminal output, then press Enter for its capture request. Early Enter reports an incomplete payment and does not send a
capture request for an unapproved order. The CLI uses its own isolated cookie workspace; use the
web UI when validating the browser return/review page. A failed smoke test is never printed as
success. This script tests redirect checkout; SDK eligibility/buttons still need a browser smoke test.

For verified inbound events, register a public HTTPS listener at `/api/webhooks/paypal` and configure
`PAYPAL_WEBHOOK_ID`. Subscribe to `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`,
`PAYMENT.CAPTURE.DECLINED`, `PAYMENT.CAPTURE.REFUNDED` and `PAYMENT.CAPTURE.REVERSED`. Unsigned events are
rejected. Valid received events remain replayable on processing failure. Unknown orders return 503
so PayPal can redeliver. Late pending/declined events do not undo a completed capture. Refund/reversal
events flag settlement review; they do not fabricate an observed bank credit.

## Reset and storage

**Reset demo** resets only the current persona in the current workspace. It will refuse a workspace
with real Sandbox orders to preserve the payment ledger. Use a fresh browser profile/workspace for a
new real-payment scenario. Production builds require explicit `DEMO_SEED_ENABLED=true` to enable
simulation/reset. Never set it on a future production financial service.

The JSON store uses atomic replace, an exclusive writer lock, and fail-closed parse/version checks.
It is for a single local demo deployment, not replicated infrastructure. If a process dies while
holding `STORE_PATH.lock`, stop every process using that store and verify the recorded PID is no
longer active before removing the stale lock. Retrying an unknown provider command preserves its
idempotency key. Commands older than the bounded recovery window require manual reconciliation.

Supabase/Postgres, production Auth/RLS, a Python engine service and background bank reconciliation
remain proposed architecture work. Public hosting, real-device acceptance and final submission
artifacts are separate unfinished demo-delivery tasks; see the current README checklist.

## Gemini and optional HTTPS deployment

Configure `GEMINI_API_KEY` in the ignored `.env`, with `GEMINI_MODEL=gemini-3.6-flash`, then restart.
`bash scripts/set-keys.sh gemini` accepts hidden input. Ask RiskPilot now accepts free-text questions
on main pages and order review; the key stays server-only. The model selects verified fact sentences,
not new financial calculations. Shop decision explanations use two 5-second attempts before
deterministic fallback, within the 40-second assessment request deadline. AI goal drafts require confirmation. Missing-key and provider errors
are explicit; suggested read-only page facts remain available without Gemini.

For a public Sandbox demo, use [the HTTPS deployment guide](docs/DEPLOYMENT.md) and `render.yaml`.
The Blueprint supplies two single-instance services with separate persistent ledgers. Do not replace
safe origin checks with arbitrary URLs or assume a GitHub push has deployed or configured Webhooks.

A concise decision → after-income what-if → saved before/after outcome walkthrough is available
in [the demo script](docs/DEMO_SCRIPT.md). Timing previews are read-only and cannot schedule/pay;
new capture comparisons require newly saved before/after snapshots. Historical payments remain
readable and explicitly report a missing before snapshot.

## Reliability validation

See [Phase 2 audit and live Sandbox evidence](docs/DEMO_RELIABILITY_PHASE_2.md). Review now separates
buyer approval, capture pending/completed/unknown and saved forecast status. A read-only refresh
never initiates capture. Pending captures must be checked on the same order; a remotely completed
capture with an unsaved local forecast offers explicit recovery. Reset also refuses uncertain real
provider-create commands whose order IDs have not yet been recovered. Production builds require
explicit `DEMO_SEED_ENABLED=true` even when `APP_ENV=local`.

## Spending Intelligence demonstration

With `DEMO_SEED_ENABLED=true`, open Dashboard and expand Spending Intelligence's category and recurring
sections. No Plaid credentials are required: histories are explicitly simulated. Pin `DEMO_TODAY`
for repeatable coverage/totals. Confirm/Edit/Not recurring affect only reviewed pattern estimates;
existing financial bills and PayPal reserves are unchanged. Sign into another fixed demo account in a separate workspace to see different histories.
Reset in a simulation-only workspace restores pattern reviews; real Sandbox payment records retain
existing reset protection. See [Phase 3 details and sample values](docs/SPENDING_INTELLIGENCE.md).

## Financial Profile demonstration

On Dashboard, use **Your Financial Profile → Confirm preferences**, save an explanation focus and
optional preferred goal, then **Generate profile**. Expand sources to inspect aggregate evidence,
dismiss an observation, restore it, or clear preferences. Shop and checkout review use confirmed
preferences alongside the selected engine scenario. A planning buffer preference does not change
the engine buffer or payment behavior. Missing/invalid Gemini responses show a labeled template.
See [Phase 4 architecture, privacy and verification](docs/FINANCIAL_PROFILE.md).

## Required purchase-flow checks

For proactive exploration, open `http://localhost:3100/shop` and use **Explore purchase impact**;
scenario comparisons and What-if require no PayPal approval and create no order or capture.
For merchant checkout, run `npm run demo` and start directly at `http://localhost:3200`: PayPal
approval automatically opens RiskPilot review through the signed handoff. Stop/cancel before
**Confirm and pay** to leave the approved order uncaptured. See [both release gates](docs/PURCHASE_FLOWS.md).

## Fixed demo accounts and final purchase journeys

The in-account persona dropdown remains retired. Open `/login` and enter `alex@riskpilot.demo`
or `jordan@riskpilot.demo`; each account has one fixed financial profile and full feature access.
There are no Basic/Premium tiers or upgrade controls. For Explore → Buy, assess a product in Shop,
then use its single **PayPal Checkout** action. PayPal's final Pay Now confirms the new Shop order;
there is no redundant RiskPilot confirmation when the assessment remains current. Start the
independent Northstar flow directly at the merchant: Continue → signed RiskPilot impact review →
explicit Confirm and pay → verified merchant receipt. A prior Shop assessment is optional.
Preserve both journeys and their distinct confirmation steps.

Step 7B completed new actual Sandbox captures for both paths. Use the
[final acceptance record](docs/STEP7B_ACCEPTANCE.md) and
[under-three-minute recording rehearsal](docs/STEP7B_DEMO_REHEARSAL.md) for current preparation,
verified financial values, human confirmation steps and remaining physical-device/webhook limits.

## Financial dates and final recording

`FINANCIAL_TIMEZONE=America/New_York` is the financial calendar default, independent of the
server timezone. Set `DEMO_TODAY=2026-11-12` for the recording fixture and restart both services.
Pinned dates override the clock. Actual capture/webhook timestamps are not rewritten.
Prewarm every recorded route and rerun `npm run demo -- --check` before filming; a cold dev
compile may exceed the launcher's two-second health-read deadline.

The [current rehearsal](docs/STEP7B_DEMO_REHEARSAL.md) supersedes older scripts. See
[Step 8.7](docs/STEP87_RESULT.md) for current purchase timing/goal treatment and
[Step 8.6](docs/STEP86_RESULT.md) for retained income eligibility and immediate/captured equivalence;
[Step 8.5](docs/STEP85_RESULT.md) records the retained checkout-source and settlement corrections. Historical payment ledgers must remain private and intact. Public HTTPS/webhook delivery,
physical-device checkout, production identity and bank/refund reconciliation remain unaccepted.

Unsupported replacement date/cadence changes remain planning only; original modeled income is still
active. Do not present these entries as an applied salary reduction, changed payday or job loss.
For the main recording after Shopping $90 → $30, the $900 full-price scenario and saved outcome agree:
lowest cash $838, delayed-income minimum $672, capacity $0; Japan Trip stays March 14, Emergency Fund
April 13, and Start investing moves March 14 → April 13, 2027. Read the current workspace; earlier
captures contain immutable historical estimates. No new actual payment is required for verification.
