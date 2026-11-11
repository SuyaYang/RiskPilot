# Run RiskPilot Checkout

## Current buyer experience: independent store and impact review

**Northstar store → PayPal Continue → RiskPilot review → Confirm and pay → store receipt**.
Users do not install a browser extension. The simulated merchant has integrated RiskPilot.

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

This branch implements a **local fictional-data demo** with Dashboard, Goals, Shop and Invest.
The [README target architecture](README.md) remains the requirement; see
[implementation / acceptance status](docs/IMPLEMENTATION_STATUS.md) for gaps. This is not a production
financial application and does not connect a bank or authenticate a Supabase user.

## Start

Node.js 20+ (CI uses Node 22), npm, and optional PayPal Sandbox / Gemini credentials.

```bash
npm ci
cp .env.example .env
# Fill Sandbox keys for real payment; leave blank for clearly labeled local simulation.
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

## Earlier Shop-based regression demo

```bash
npm run demo:shop
```

This opens `http://localhost:3100/shop` from the beginning of the visual flow. It starts the local dev
server if one is not running and verifies Sandbox configuration. Choose **Sam**, assess the $900
laptop, continue to PayPal, choose **Review Order**, then inspect the RiskPilot purchase-impact page.
Stop at **Make payment** for a preview. Capture is always an explicit final action. Existing payment
records are preserved. The script never invokes capture or resets demo data.

```bash
npm run demo:shop -- --check       # check an existing app without opening it
npm run demo:shop -- --no-open     # start/check and print the URL
BASE=http://localhost:3300 npm run demo:shop
```

If the script started the dev server, keep its terminal open and press Ctrl+C to stop it. If the app
was already running, its process is left alone.

## Walk through

1. Choose Alex, Sam or Jordan. The balances, bills and goals are explicitly fictional manual fixtures.
2. Open Goals. Add/edit/pause/resume/delete a goal and review the recalculated expected completion.
   AI drafting is optional and always requires confirmation; without Gemini, use the manual form.
3. Open Shop and compare a product. The visible chart is 45 days, but minimum balance/risk checks run
   through the last evaluated payment date. Pay Later comparison schedules are hypothetical.
4. Review the **Check purchase impact** overview next to checkout. Switch forecast scenarios to see
   projected cash, buffer headroom and goal delays together. Without PayPal keys, choose **Simulate purchase**. No PayPal request or money movement occurs.
   With keys, SDK v6 checks eligibility before showing actual payment buttons; approve as the
   **Sandbox personal buyer**, not the merchant. PayPal receives the full server-catalog price.
5. With PayPal, select **Continue with PayPal Sandbox**. The SDK and Orders API both use the
   Continue flow (`commit=false`, `user_action=CONTINUE`). PayPal returns the buyer to
   `/checkout/review?order=...` after **Review Order**. Approval and return never trigger capture.
   The buyer sees the current purchase overview and selects **Make payment** to capture explicitly.
   The request must contain `reviewConfirmed: true` and the current overview `inputHash`; stale
   finances require refreshing the overview. Unapproved payments are reported as incomplete.
   Recover unknown outcomes on the same order rather than starting another purchase.
6. Return to Dashboard. The verified capture, conservative full-price reserve, and versioned
   forecast snapshot are saved together. Merchant capture does not identify the consumer's funding
   account or confirm a loan schedule. Manual fixture balances remain distinct from projections.
7. Invest shows educational allocation templates and conservative cash capacity; it performs no trades.

Browsers get independent opaque demo-workspace cookies. Switching personas changes only that
workspace's fixture. This is **not Supabase authentication or a verified production tenant boundary**.
A changed goal/purchase/date invalidates an unstarted assessment. Existing order recovery remains valid.

## Real Sandbox smoke test

With the app running and matching Sandbox keys in `.env`:

```bash
bash scripts/smoke-paypal.sh
# Another port:
BASE=http://localhost:3100 bash scripts/smoke-paypal.sh
```

Select Review Order / Continue in the opened PayPal window, review the impact printed in the terminal,
then press Enter to confirm capture. Early Enter reports an incomplete payment and does not send a
capture request for an unapproved order. The CLI uses its own isolated cookie workspace; use the
web UI when validating the browser return/review page. A failed smoke test is never printed as
success. This script tests redirect checkout; SDK eligibility/buttons still need a browser smoke test.

For verified inbound events, register a public HTTPS listener at `/api/webhooks/paypal` and configure
`PAYPAL_WEBHOOK_ID`. Subscribe to the five capture event types listed in README. Unsigned events are
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

Supabase SQL migrations, production Auth/RLS, Python engine service, background sync/reconciliation,
Render deployment and the public submission video are still required before all README gates pass.

## Gemini and optional HTTPS deployment

Configure `GEMINI_API_KEY` in the ignored `.env`, with `GEMINI_MODEL=gemini-3.6-flash`, then restart.
`bash scripts/set-keys.sh gemini` accepts hidden input. Ask RiskPilot now accepts free-text questions
on main pages and order review; the key stays server-only. The model selects verified fact sentences,
not new financial calculations. AI goal drafts require confirmation. Missing-key and provider errors
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
existing financial bills and PayPal reserves are unchanged. Switch personas to see different histories.
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
