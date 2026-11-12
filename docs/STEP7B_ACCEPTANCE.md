# Step 7B — final Sandbox acceptance and demo readiness

Public copy: provider identifiers are redacted; original payment ledgers remain private and unchanged.
The historical checkpoint below predates the final Step 8.7 financial correction.

## Result and checkpoint

**Completed for local Sandbox acceptance.** Branch `cynthia`; approved Step 7A.2 checkpoint:
`0008f283960d98bbee5b36d6229c7214953212de` (27 source/test/documentation files).
Step 7B adds one optional-AI deadline fix and a focused regression; no payment, financial or visual architecture was changed.
No Vision page or Devpost description was implemented.

## Environment and isolation

| Setting | Verified value |
| --- | --- |
| Original services, preserved | http://localhost:3100 / http://localhost:3200 |
| Isolated acceptance services | http://localhost:3101 / http://localhost:3201 |
| App UTC/demo date | 2026-11-12 |
| Snapshot schema | rp-v1 |
| Provider API | https://api-m.sandbox.paypal.com (live endpoints rejected) |
| Browser/server client configuration | Matching; both services configured; simulation false |
| Merchant callback/review | 3201 → signed handoff → 3101; same server-side bridge configuration |
| Gemini | Configured, gemini-3.6-flash; live grounded outputs observed |
| Webhooks | No webhook ID configured; public webhook delivery not accepted here |

Separate ledgers are retained under `../artifacts/step-7b/runtime/`, outside the Git repository.
The original Alex/Sam/Jordan workspaces and original services were not reset or mutated by
acceptance tests. Tests use additional temporary stores and mocked providers. Acceptance
servers remain available to inspect the saved results; preserve their ledgers after payment.
No credentials, cookies, buyer account details or provider raw personal data are published.

## Actual starting state and category planning

The initial acceptance Alex workspace was clean: manually supplied checking $3,500, savings
$2,000, projected start $3,500, lowest cash $1,720, income-delay minimum $1,540, capacity $90,
zero purchase reserves, orders and capture snapshots. Values were computed from this workspace,
not assumed from a November 10 example.

Shopping baseline $90 → $30/month (−$60): preview left the financial hash unchanged and
created no order/reserve. Explicit application produced lowest cash $1,738, delayed-income
minimum $1,572, capacity $122; all readiness checks passed. Current cash did not increase.
Dashboard/Money/Goals hashes and allocations and the Shop baseline were compared directly.

Exact workspace financial hashes and provider identifiers remain in the private acceptance artifacts.

A real pre-change assessment was rejected by order creation before a stubbed provider could
be called (zero provider calls). Automated regressions cover stale Shop and merchant capture,
income invalidation, draft/informational budget hash stability and stale browser writes.
Read-only What-if/revert and local budget editor cancellation preserved the final financial
hash; restoration controls were visible and usable at every verified width. No extra budget
was applied after the live payments.

## Completed, provider-verified Sandbox transactions

Both transactions were completed with product-owner participation in the provider/payment
confirmation flow. Read-only Sandbox provider lookups independently confirmed status, amount,
currency and capture IDs; local ledgers and rendered results agreed.

| Flow | Product | Order ID | Capture ID | Amount | Status |
| --- | --- | --- | --- | ---: | --- |
| B — Northstar | Aero 14 Laptop | [Sandbox identifier redacted] | [Sandbox identifier redacted] | $900.00 USD | COMPLETED |
| A — Shop | Quiet Buds Pro | [Sandbox identifier redacted] | [Sandbox identifier redacted] | $249.00 USD | COMPLETED |

Each order has exactly **one economic purchase reserve and one saved forecast snapshot**.
Both have `projectionStatus: UPDATED`. Snapshot IDs are `capture:<capture ID>`.
The Northstar receipt displays the original merchant order/capture. Shop displays verified
capture, Updated & saved, duplicate protection and the immutable before/after comparison.

Northstar completed first. Therefore the successful Shop test starts with the Northstar
reserve already present; it is deliberately not described as a second clean fixture:

| Actual engine fact | Before Northstar | After Northstar / before Shop | After Shop |
| --- | ---: | ---: | ---: |
| Projected starting cash | $3,500 | $2,600 | $2,351 |
| Lowest cash | $1,738 | $838 | $589 |
| Delayed-income minimum | $1,572 | $672 | $423 |
| Available to allocate | $122 | $0 | $0 |
| Verified purchase reserves | 0 | 1 | 2 |

The manually supplied checking input stays $3,500. Recorded full-price reserves affect the
projection; they do not establish an observed bank debit or actual consumer funding schedule.
The risk warnings were retained, including the existing buffer shortfall before the Shop test.

## Flow-specific observations and boundaries

**Shop:** exploration, future-date and no-purchase scenarios exposed no immediate checkout in
the latter two modes and created no order/reserve. The real Shop SDK Checkout action created
the server-priced $249 USD order. Provider confirmation returned to captured success without
a redundant Quick Review. Dashboard showed the verified purchase and both saved records.

**Northstar:** merchant-authoritative $900 USD pricing, a signed handoff into the same Alex
workspace, merchant confirmation audit fields, provider capture and the merchant receipt were
verified. The existing Continue → RiskPilot review → explicit Confirm and pay architecture
was preserved. The intermediate approved-but-uncaptured interval was not separately polled in
this live transaction; automated merchant tests verify that approval/return alone cannot capture.

The first Shop $900 order, `[Sandbox identifier redacted]`, was left unpaid after the SDK session was closed.
A provider lookup confirmed no capture. After Northstar changed the financial hash, its old
assessment was treated as stale; it was not paid. A fresh Quiet Buds assessment was used for the
successful Shop test. The unused order has no economic reserve and was preserved for inspection.

The in-app browser's tab inventory did not expose the provider popup to the agent. The initial
same-order approval link was opened, but not paid. Product-owner interaction subsequently
completed both actual SDK purchase paths. This tooling visibility limit is not evidence of a
product popup failure or physical-device acceptance.

## Cancellation, duplicate protection and recovery

| Verification | Evidence type |
| --- | --- |
| Shop future/skip modes create no order/payment | Actual rendered UI + unchanged store/hash |
| Closing the original unpaid Shop SDK session | Actual cancellation message; provider capture count zero |
| Unpaid review Skip and enter RiskPilot → Dashboard | Actual rendered navigation; zero confirm buttons in skip mode |
| Unpaid review Cancel → Shop | Actual rendered navigation; reserves unchanged |
| Merchant cancel before/after approval → Northstar; reopen same order | Controlled HTTP/provider mocks in full suite |
| Repeated confirmation, pending/unknown capture, temporary failure, recovery | Controlled provider mocks in full suite |
| Reopening and refreshing successful Shop/merchant results | Actual UI, same capture/snapshot IDs and exactly two total reserves |
| Duplicate record/snapshot prevention | Actual ledger counts + controlled idempotency/recovery regressions |

No additional real captures were performed to demonstrate failure/retry cases. There are two
completed captures and one unpaid order in the acceptance ledger. Repeated receipt/status reads
are not counted as payments. Old captured before/after snapshots remained immutable.

## UI and AI

Measured actual viewport widths **375, 390, 768 and 1280px** were checked for Dashboard, Goals,
Shop, Money, unpaid impact review, Shop success, merchant storefront and receipt. Screenshots
were inspected. No horizontal overflow or blocking layout defect was found. Goals ring labels,
Shop product proportions/actions, compact month cards/chart/mobile selector, What-if comparison,
restoration controls, readiness hero and Allocation Explorer retained the approved design.
Browser viewport overrides were reset. These are responsive browser checks, not physical-device
payment tests. Some full-page captures show fixed navigation at its viewport position.

Live Gemini returned grounded Financial Profile, Money/capacity, category-budget and personalized
purchase-impact explanations. Purchase facts matched the current engine amounts and financial
hash; confirmed explanation preferences did not change that hash. After payments, stale profile
facts were invalidated rather than reused. Existing tests verify required fact-ID grounding,
persona/evidence freshness, provider errors/timeouts and deterministic fallback without blocking
checkout. AI never authorized or captured a payment.

## Automated checks, artifacts and remaining limits

**272 passed, 0 failed.** TypeScript, production build and Git whitespace checks passed.
A final failure-case audit reproduced one deadline mismatch: decision AI allowed two 25-second
attempts while Shop's request aborts at 40 seconds. Only the optional decision explanation now
uses two 5-second attempts (10 seconds total) before deterministic fallback. The new regression
fails before the fix and passes afterward using the actual abort-signal path with accelerated
timers. Decision inputs, financial amounts and payment behavior remain unchanged. Existing
other AI deadlines are unchanged. Documentation also removes outdated Shop-to-Northstar
instructions and records the newly completed live acceptance.

Evidence: `../artifacts/step-7b/` contains the safe capture proofs, immutable before/after facts,
current consistency/exactly-once checks, test/build/type logs, measured viewport records and
screenshots/contact sheets. Runtime payment ledgers are outside Git and must be preserved.

No blocking local-demo issue remains. Physical iOS/Android payment behavior, public HTTPS and
verified inbound webhook delivery, real-bank reconciliation, production identity and replicated
storage remain unaccepted/outside this local prototype. Do not claim Pay Later eligibility,
verified funding, native PayPal embedding or production banking integration.

See [the 2:50 rehearsal](STEP7B_DEMO_REHEARSAL.md). The next approved scope is Step 8's standalone
`/vision` page; it has not been started. No Devpost copy or additional product features were added.
