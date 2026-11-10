# Run RiskPilot Checkout

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

## Walk through

1. Choose Alex, Sam or Jordan. The balances, bills and goals are explicitly fictional manual fixtures.
2. Open Goals. Add/edit/pause/resume/delete a goal and review the recalculated expected completion.
   AI drafting is optional and always requires confirmation; without Gemini, use the manual form.
3. Open Shop and compare a product. The visible chart is 45 days, but minimum balance/risk checks run
   through the last evaluated payment date. Pay Later comparison schedules are hypothetical.
4. Without PayPal keys, choose **Simulate purchase**. No PayPal request or money movement occurs.
   With keys, SDK v6 checks eligibility before showing actual payment buttons; approve as the
   **Sandbox personal buyer**, not the merchant. PayPal receives the full server-catalog price.
5. Capture is verified on the server. Return from a redirect or use **Check this order again**.
   Unapproved payments are reported as incomplete. Unknown outcomes must be recovered on the same
   order, not by starting another purchase.
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

Approve in the opened PayPal window before pressing Enter. Early Enter reports an incomplete payment
and does not send a capture request for an unapproved order. A failed smoke test is never printed as
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
