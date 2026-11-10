# Implementation and acceptance status

Updated 2026-11-10. Base: feature/checkout-mvp at 6189343. Local work continues on
fix/checkout-recovery; the intended publication target is the existing feature/checkout-mvp branch.
See [the complete update record](CHANGELOG_2026-11-10.md) and
[merchant checkout walkthrough](MERCHANT_CHECKOUT.md).

## Current implemented experience

**Independent store → PayPal Continue / Review Order → RiskPilot purchase impact →
explicit Confirm and pay → merchant capture → store receipt.** No browser extension is required.
The separate Northstar Electronics demo store has integrated RiskPilot. Other stores must integrate
it; this is not an automatic feature for every PayPal merchant.

The merchant owns its quote, PayPal credentials and capture. A signed expiring link binds the
server-verified quote to the current fictional demo workspace. The impact uses that workspace's
goals and commitments. Explicit confirmation with the current input hash sends a signed request
back to the merchant. The merchant verifies identity, amount, currency and approval before
idempotent capture. RiskPilot records the verified capture, conservative full-price commitment and
versioned forecast once, then returns the buyer to a provider-verified merchant receipt.

## Implemented and checked

- Dashboard, goal create/edit/pause/resume/delete, Shop reference flow and educational Invest page.
- SDK v6 client-ID initialization, eligibility-gated PayPal and Pay Later buttons, full-price orders.
- Payment approval is distinct from capture; returning to an impact page never submits payment.
- Unknown outcomes, capture timeouts, local-write failures, duplicate/out-of-order callbacks and
  replayable verified webhooks preserve payment facts and prevent double counting.
- Signed merchant handoff, quote checks, request/response nonce binding, expiry, fixed destinations,
  browser-workspace ownership and stale-review rejection.
- Change payment method in PayPal sits beside final confirmation. Forecast comparison buttons do
  not change actual funding. Unknown capture outcomes disable the change-method action.
- Forecast checks cover all evaluated payment dates, including beyond the visible 45-day chart;
  available allocation also protects the delayed-income scenario and protected goals.
- Gemini may select only supported fact sentences; invalid output or an outage uses templates.
- Native date-input synchronization, bounded provider calls and no silent legacy-store resets.
- Development uses .next-dev; production uses .next. Both generated outputs are ignored.

## Evidence

| Check | Evidence |
|---|---|
| Automated suite | 56 tests pass: finance, AI constraints/fallback, payment recovery, routes, merchant handoff/capture/receipt and optional extension parsing |
| TypeScript | npm run typecheck passes, including the final change-method control |
| Production | npm run build passes; reloading the active development checkout afterward still renders correctly |
| UI | Dashboard, Goals, Shop, Invest, Sandbox SDK eligibility and pre-capture impact comparison were exercised in Chrome |
| Merchant payment | The integrated Northstar order was observed completed in the merchant receipt; the local capture and versioned forecast are saved |
| Change method | A different, unpaid reference order reopened in PayPal; bank funding was changed to Sandbox Visa; Review Order returned to impact review; no capture was recorded for this test |
| Startup | The user can run npm run demo to start/check both sites. This agent cannot start new local listeners: listen EPERM |
| GitHub | The logged-in Chrome session can access the private repository and existing branch. The connector still returns 404; shell Git cannot resolve github.com. Local publication preparation does not imply a completed remote push |

The merchant receipt was observed after the user completed Sandbox payment; the agent did not
click its final payment confirmation. Automated provider responses are fixtures and do not prove
every real PayPal error path. The change-method browser test used the reference order, not a new
merchant loan application. Actual loan terms, consumer funding details and bank reconciliation are
not inferred from capture.

## Runtime fix

The missing-module error Cannot find module './855.js' resulted from production chunks under
.next/server/chunks being mixed with the running development runtime. Phase-based output isolation
in next.config.mjs fixes the collision. With development still running, a production build passed
and a reload of the same review succeeded. Purchase records were preserved.

## Remaining target architecture

- Supabase Auth, Postgres migrations, RLS and production tenant-isolation validation.
- Private Python financial engine and versioned integer-minor-unit contracts.
- Durable background jobs, Plaid Sandbox connection/sync/reconciliation and confirmed funding plans.
- Production merchant onboarding, separate merchant keys, HTTPS and real customer identity.
- Render deployment, clean remote CI run, public submission access and final demo video.
- Real Pay Later eligibility/loan-term confirmation and full provider failure acceptance.

Local JSON storage and opaque cookies are fictional-demo infrastructure, not completed production
banking or identity. Investment views do not transfer funds or place trades. The optional extension
directory preserves an earlier placement experiment and is not part of the accepted checkout flow.
