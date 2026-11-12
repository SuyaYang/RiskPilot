# Phase 2 — demo reliability and end-to-end validation

Validated November 10, 2026. This pass fixes reliability defects in the existing demo; it adds no
payment provider, product capability, database architecture or dependency. Phase 1 UI changes remain.

## Actual implementation

The working application is Next.js/React with a deterministic TypeScript financial engine and a
single-instance JSON ledger. Dashboard, goal CRUD/planning, product assessment, educational investment
capacity, PayPal Sandbox checkout/recovery, the signed Northstar bridge and Gemini fact explanations
are implemented. Capture, the conservative full-price reserve, and the before/after forecast snapshot
are saved atomically. Provider approval does not call capture.

Northstar offers one server-priced $900 USD product; the broader RiskPilot Shop has its own fixture
catalog. The merchant is an explicitly integrated demonstration store, not a general interception
mechanism for arbitrary stores. Loan scenarios do not select or confirm actual PayPal funding.

Supabase authentication/RLS, Plaid ingestion/debit matching, the Python engine/worker architecture,
production merchant onboarding and public deployment remain planned. There is **no implemented Plaid
debit ingestion path to validate for double counting**. Bank reconciliation is unavailable, rather
than completed or actively processing. Existing captures keep their full-price reserve and unknown
funding label. Refund/reversal events flag settlement review; they do not automatically remove that
reserve, recompute a refund, or invent an observed bank credit.

## Confirmed defects fixed

| Defect | Resulting behavior |
| --- | --- |
| Created, approved, pending and unknown states were not clearly distinguished in review. | A read-only, ownership-checked provider/merchant inspection supplies separate payment, forecast and bank status. Approval explicitly says “not captured.” Lookup failure is unknown, not success. The lookup cannot execute capture or change financial state. |
| A provider-completed capture whose local save failed was indistinguishable from an unpaid order. | Review identifies remote capture completion with local recovery still required. The existing explicit recovery action saves the same verified capture and forecast. No successful local save is implied. |
| A pending/declined capture could be sent to the capture endpoint again. | Both direct checkout and the signed merchant path inspect an existing capture first. Pending returns `PAYMENT_PENDING`; failed capture requires review. Neither adds a purchase/reserve or issues another capture. Refresh checks status without payment. |
| A stale approval lookup could overwrite a concurrently completed capture command and call capture again. | Persisted completion is rechecked after lookup and under the writer lock; it wins over the stale response. The regression test starts a delayed lookup, records completion concurrently, then proves zero additional capture calls. |
| Reset could erase an unknown provider-create command before its order ID was saved. | Reset refuses outstanding real or legacy unclassified provider commands. New create commands record whether they are simulated. Stable request IDs and uncertain payment evidence survive reset attempts. |
| `APP_ENV=local` implicitly enabled reset/simulation in a production build. | Production builds require explicit `DEMO_SEED_ENABLED=true`; the route returns 404 without it. Explicitly enabled fictional Sandbox demos remain supported. |
| Header requests and merchant SDK initialization/eligibility could wait indefinitely. | Header reads use the shared abort/retry path; persona/reset writes have a bounded timeout. Merchant fetches and SDK initialization/eligibility are bounded and show actionable unavailable messages. User interaction inside PayPal remains under buyer control. |
| A malformed successful HTTP response could be treated as an empty successful mutation. | JSON parsing failures report an unreadable response and instruct checking status before retrying. A 202 response containing an error is also rejected by the client helper. |
| Goal/educational preference responses could update the UI after switching personas. | Mutation generations discard old draft/save errors and preference rollback results. Goal mutations also use a synchronous busy guard. Existing backend workspace/persona ownership remains authoritative. |
| Merchant receipt omitted pending/failed/refund capture status. | Status responses include the actual capture status; receipt copy identifies pending or settlement review without claiming bank reconciliation or completed refund processing. |

The signed merchant envelopes, exact-origin allowlist, current-review hash, explicit confirmation,
server-side pricing, stable `PayPal-Request-Id`, ownership checks and atomic forecast transaction
remain in place. No financial formulas were changed.

## Validation evidence

### Automated and build checks

- Original baseline: **85 tests passed**.
- Final suite: **98 tests passed**, 0 failed.
- `npm run typecheck`, `npm run build`, and `git diff --check`: passed.
- `npm run demo -- --check`: both sites ready with Sandbox configuration.
- Existing suites cover frozen server pricing, stale goals/purchases, same-day forecast consistency,
  unsigned webhook rejection, replay/idempotency, capture recovery after local write failure,
  purpose-bound merchant signatures, expiration and workspace ownership, and grounded AI fallback.
- New regressions cover uncertain-create reset preservation, stale preflight/concurrent completion,
  pending capture before and after a capture request, decline without a new expense, all status
  distinctions, unreadable mutation responses, production reset opt-in, simulation-history cleanup,
  same-workspace persona isolation, pending merchant recovery, and refund/reversal review behavior.
- The signed merchant fixture test runs create → approve → claim → review → explicit capture → saved
  forecast → receipt, and separately pending → repeat confirmation without recapture → completed
  provider observation → explicit local recovery. These provider-failure cases use fixtures, not live
  Sandbox failures.

### Live PayPal Sandbox/browser test

This was an actual Sandbox capture, not the local simulation action or a mocked PayPal response:

1. Opened Northstar, started the Sandbox SDK checkout and reached the signed RiskPilot review.
   PayPal's separate popup was not exposed by browser control; the provider's `APPROVED` state and
   returned review were verified. No claim is made about observing a specific funding selection.
2. Before final confirmation, review showed “Buyer approved · not captured,” $900 USD, current cash
   and goal impact, $820 projected minimum and $640 late-income minimum. Gemini's grounded overview
   was also available with the same engine facts.
3. Clicked the explicit **Confirm and pay** action. RiskPilot displayed a verified Sandbox capture
   and “Updated & saved.”
4. Followed **View Northstar Electronics receipt**. The merchant displayed payment confirmation and
   the same order/capture IDs.
5. Returned to Dashboard. It showed one $900 verified Sandbox purchase, funding unconfirmed, and
   the changed forecast.
6. A subsequent read-only provider lookup and both persisted ledgers agreed:

| Evidence | Value |
| --- | --- |
| Order | `[Sandbox identifier redacted]` |
| Capture | `[Sandbox identifier redacted]` |
| PayPal order/capture | `COMPLETED` / `COMPLETED` |
| Verified amount | $900.00 USD |
| RiskPilot order/projection | `CAPTURED` / `UPDATED` |
| Purchases / saved snapshots for this order | 1 / 1 |
| Forecast starting cash, before → after reserve | $3,500 → $2,600 |
| Lowest projected cash, before → after | $1,720 → $820 |
| Merchant ledger | Same completed capture |

The merchant process was restarted to load the server fixes. Its status endpoint then recovered the
same persisted receipt with `captureStatus=COMPLETED`; no new capture was issued. Existing ledgers,
keys and other browser workspaces were preserved. The running demo remains on ports 3100 and 3200.

Local screenshot artifacts are `../phase2-sandbox-receipt.jpg` and
`../phase2-sandbox-dashboard.jpg` in the parent workspace directory. No credentials are in them.

## Repeatable demo procedure

Run `npm run demo -- --check` before presenting. For a new unpaid scenario, use a fresh browser
workspace and merchant session; preserve any prior real Sandbox records. Pick the desired fictional
persona before opening merchant review. Reset is intentionally refused for real Sandbox orders or
uncertain provider commands; simulation-only reset restores that persona's fixture, histories,
commands and snapshots without touching another persona.

Approval is a review checkpoint. Stop before **Confirm and pay** for an impact-only demonstration.
For pending outcomes use **Check payment status**; for unknown outcomes recover the same order.
If a provider capture is already completed but the local save failed, use **Recover confirmed
payment**. Do not create a replacement purchase to resolve uncertainty.

## Remaining acceptance limits

- No live bank, Plaid matching, reconciliation worker or refund/reversal accounting is implemented.
  A real Plaid debit deduplication test cannot pass until that planned integration exists.
- Real Pay Later eligibility/APR/payment schedule were not established. Forecasts remain hypothetical;
  the full purchase price is reserved until verified funding information exists.
- Public HTTPS deployment and real PayPal webhook delivery/signature acceptance were not exercised.
  Tests of verified event processing are not evidence of public delivery.
- Browser tests used the local demo and Sandbox, not physical iOS/Android hardware. No live-money
  transaction was made.
- The JSON ledgers and opaque workspace cookies remain a single-instance fictional demo, not
  production authentication, a replicated database or a production tenant-isolation claim.
- Next reports the existing multiple-lockfile workspace-root warning; type checking and build pass.
