# Implementation and acceptance status

Checked on 2026-11-10 against the local `feature/checkout-mvp` base commit `6189343` and repository
README. Remote HEAD/PR state could not be refreshed: the connected GitHub API returned 404 and shell
network access could not resolve github.com. Do not infer this branch has been pushed or merged.

## Implemented in this branch

- Four navigable pages: Dashboard, Goals, Shop/comparison/checkout, Invest/educational scenarios.
- SDK v6 client-ID initialization, amount/currency eligibility checks, and separate actual payment
  buttons. Pay Later comparisons remain hypothetical; eligibility is never inferred from price alone.
- Server-catalog price and product freezing; stale-input hash/date/expiry checks; same scoped create
  request key on recovery; capture commands recorded before provider calls.
- Provider status/identity/custom-ID/currency/amount checks before capture. Unapproved orders return
  an actionable incomplete response without a capture request. OAuth and REST requests are bounded.
- Capture timeout lookup, duplicate capture protection, and recovery after a local persistence failure.
- Capture + full-price conservative commitment + immutable versioned forecast snapshot in one local
  store transaction. No assumed loan schedule is committed as fact.
- Verified, durable webhook inbox with replayable failures, duplicate/out-of-order safety, and
  settlement-review flags for refund/reversal. No made-up bank credit is created.
- Separate opaque-cookie demo workspaces; scoped read/write/reset checks; reset refuses real Sandbox
  order ledgers. These checks are demo isolation, not completed production authentication.
- Forecast daily arithmetic in integer cents; checks extend through the last payment while the chart
  remains 45 days. Allocate-today capacity also protects the late-income scenario and initial cash.
- Confirmed goal CRUD, version conflicts, finite amounts, valid calendar dates, and cent precision.
- Gemini selects server-approved fact sentences so a valid dollar amount cannot be attached to a
  fabricated claim. Unavailable/invalid Gemini output falls back to the deterministic explanation.
- Environment template, reproducible dependency lock, running/reset instructions, MIT license, CI
  workflow, finance/payment/route regression tests. Canonical checkout/dashboard/reset API aliases
  preserve the earlier route names for teammates.

## README acceptance gates

| Gate | Current evidence | Remaining work |
|---|---|---|
| Real Sandbox create → approve → capture updates versioned forecast | Mocked provider/service recovery and route-level simulation pass; smoke script exists | Real buyer/browser run with credentials and reachable local/public origin |
| Pay Later eligibility and hypothetical schedules | SDK integration and explicit labels implemented | Browser confirmation against the real Sandbox SDK; actual consumer terms/source confirmation flow |
| No double charge/count on retries, out-of-order callbacks, local write failure and bank debit | Payment/webhook/local failure regression tests pass | Plaid debit reconciliation and durable background worker are absent |
| User A cannot access user B data, including server-secret queries | Two independent demo workspaces pass order/decision/goal/reset checks | Supabase Auth, SQL migrations, RLS and service-secret tenant-isolation tests are absent |
| Deterministic engine facts + constrained AI + fallback | TypeScript kernel and guarded fact selection tested | Required private Python service, versioned JSON contracts, full input snapshot/replay and all protected-goal capacity invariants |
| Tested startup/reset, migrations, license, public repository/video | Build, type checks, local tests, instructions and license; CI file added | Listener/browser startup blocked by execution permissions; migrations, real Render deployment, remote publication and video unverified |

## Verification limits

`npm run typecheck`, `npm test` and `npm run build` exercise real source code; provider responses in
automated tests are fixtures, not evidence of a real PayPal payment. Route integration tests run
Next request-local handlers and middleware without a TCP listener. They do not prove visual layout,
SDK popup behavior, real loan eligibility, signature verification against PayPal, or Render startup.

Starting `next dev --hostname 127.0.0.1 --port 3100` returned `listen EPERM`, including after the user
authorized full permissions. The execution sandbox did not change. No browser or real Sandbox
payment is marked passed. A clean remote `npm ci` and CI run also remain unverified in this network
restricted environment; the local build uses the pre-existing pinned dependencies.

## Architecture still required

Keep README's production target unchanged: Supabase Auth/Postgres/RLS and real migrations;
`services/engine` Python service and integer-minor-unit contracts; durable worker/jobs; optional
Plaid Sandbox Link/sync/reconciliation; funding-plan confirmation; deployment to Render; public
submission assets. This branch intentionally documents these as incomplete instead of relabeling
the local JSON demo as the finished architecture.

## Official integration reference

Implementation checked against PayPal's [SDK v6 setup](https://developer.paypal.com/sdk/js/set-up/)
and [Orders integration](https://developer.paypal.com/api/rest/integration/orders-api). These sources
specify eligibility-gated payment methods, server capture after approval, and the v6 order promise
shape `{ orderId }`. The real SDK/Sandbox smoke test remains a release gate.
