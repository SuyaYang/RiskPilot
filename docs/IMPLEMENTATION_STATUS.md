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

## Local browser follow-up

The user started the repaired checkout at `http://localhost:3100`. Chrome browser access now works,
although direct shell requests to the listener remain blocked. Dashboard loaded with the expected
fixture forecast, Goals creation and pause were exercised, Shop produced the expected comparison,
and Invest loaded cash capacity and educational templates. A native date-input synchronization issue
was found during form entry and fixed by handling input events as well as change events; creation
succeeded after filling the date and changing priority. The test goal was paused afterward.

The real Sandbox SDK initialized, checked eligibility, and showed PayPal and Pay Later controls.
A full-price $900 Sandbox merchant order was created and opened in PayPal Checkout. Buyer sign-in
and approval are awaiting the user; capture, return/recovery and the post-payment forecast are not
yet marked passed. No real-money payment or bank synchronization was performed.

## Purchase impact before final payment

The checkout now uses PayPal's supported Continue flow in both adapters: Orders
`experience_context.user_action=CONTINUE` and SDK v6 session `commit=false`. The Sandbox displayed
**Review Order**. The browser returned to RiskPilot's final review page with a purchase-impact
overview above **Make payment**. PayPal approval and redirect callbacks do not invoke capture.
The final capture route requires explicit review confirmation and the current input hash, with an
additional stale-input check immediately before the capture command is persisted.

Browser verification exercised the real Sandbox SDK through Review Order and back to the new
page. Full-price and hypothetical Pay in 4 selections changed the cash/buffer/goal overview. The
new order remained locally CREATED with no capture command after this browser review; the final
Make payment button was intentionally left untouched. The original, earlier $900 Sandbox test did
complete a verified capture and save its forecast; this does not substitute for final capture testing
of the new review flow. Thirty-nine automated tests pass, including explicit-review and stale-input
checks. A production build passed in an isolated copy without disturbing the active dev server.

This overview is on RiskPilot's merchant confirmation page, not injected into PayPal's hosted UI.
Scenario selection does not change PayPal's selected funding method, and assumed installments are
not presented as confirmed PayPal loan terms.
