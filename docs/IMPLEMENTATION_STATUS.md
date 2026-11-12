# Implementation and acceptance status

Updated November 10, 2026. Publication target: PR #1 (`feature/checkout-mvp`), with a
matching `cynthia` branch. This document supersedes earlier local-only publication notes.

## Phase 3 spending intelligence

Dashboard now includes a compact monthly trend, category totals and deterministic recurring-pattern
review for the existing personas. **112 tests**, TypeScript and the production build pass. Plaid has
no working adapter or configured local credentials, so this uses clearly labeled local Sandbox-style
transaction fixtures. Confirmation/edit/rejection is persisted and versioned in the existing persona
store; patterns remain informational because observed-debit/capture matching is unavailable. Existing
bills/reserves and purchase-impact calculations are unchanged. See
[contracts, demo values, verification and limits](SPENDING_INTELLIGENCE.md).

## Phase 2 reliability follow-up

The demo audit and stabilization pass is complete. **98 automated tests**, TypeScript and the
production build pass. A new live PayPal Sandbox merchant checkout reached approval → explicit
RiskPilot confirmation → verified $900 USD capture → saved forecast → merchant receipt → Dashboard.
Read-only provider verification and both ledgers agree on one purchase and one snapshot. Pending
capture, reset preservation, stale capture races and unavailable states have focused regressions.
See [the audit, fixes and evidence](DEMO_RELIABILITY_PHASE_2.md) for exact validation boundaries.
Plaid/bank reconciliation, refund accounting and public webhook/deployment acceptance remain open.

## Compact UI follow-up

Phase 1 compact layouts are implemented and browser-checked at 375, 390, 768 and 1280px.
All 85 tests, TypeScript and the production build pass. Local visual acceptance now includes
all four main pages, purchase review and Northstar; an isolated explicit simulation reached
the saved forecast result. No new PayPal capture was performed. See
[changes, verification and remaining limits](COMPACT_UI_PHASE_1.md).

## Current experience

Independent Northstar store → PayPal Continue / Review Order → RiskPilot impact review →
explicit Confirm and pay → merchant capture → provider-verified receipt. No extension required.
Dashboard, Goals, Shop and Invest have distinct responsive compositions within one neutral design
system. See [UI implementation](UI_REDESIGN.md) and [running instructions](../RUNNING.md).

## Decision, timing and outcome follow-up

- A deterministic full-price conclusion summarizes normal/stress buffer risk and goal impact,
  with explicit next actions rather than waiting for an AI request to finish.
- Shop and merchant review compare full payment now with the same purchase one day after the
  next scheduled future income, inside the 45-day window. The existing forecast/allocation
  engines recalculate both dates; no income means an explicit unavailable state. The date remains
  fixed during late-income stress, so improvement does not imply safety. Arbitrary future dates,
  future stock/price and actual payment eligibility remain unknown.
- Previewing timing never schedules an order. Future-date mode removes current checkout actions;
  capture/simulation APIs reject a request explicitly marked as a future preview. Current orders
  still require their existing confirmation, approval, ownership and recovery checks.
- Newly recorded captures atomically save an immutable before-reserve and after-reserve snapshot.
  Success shows saved cash/allocation changes and goal dates, including years. Repeated capture or
  later goal edits do not replace these snapshots. Legacy captures explicitly lack before data;
  no historical numbers are fabricated or backfilled.
- Engine summaries display immediately while Gemini loads. Read timeouts have retry states;
  assessment writes reject changed inputs and late responses cannot cross a persona switch.
  Payment clicks have a synchronous lock; different order URLs remount review state.
- The small two-line assistant footer and the goal editor's automatic scroll/focus fix are retained.

The 85-test suite includes fixed-date/stress/no-income examples, preview capture rejection,
immutable comparison/legacy handling, stale AI assessments and server-rendered decision states.
Live Gemini successfully selected the calculated future-date facts and identified the preview as
read-only. TypeScript/build pass. No new Sandbox capture was performed, and the earlier browser/mobile
restriction is superseded by the compact UI verification above.
See [demo walkthrough](DEMO_SCRIPT.md) for a controlled presentation sequence.

## P0 / P1 review follow-up

| Review item | Implementation / evidence |
| --- | --- |
| AI on the actual merchant path | Order-scoped insights explain current cash, buffer, stress, goals and suggested scenario. Gemini can select only server-authored facts; provider failure preserves deterministic summaries. Free-text questions are available on all four main pages and order review. Workspace ownership and current financial input hash are checked. |
| Same-day payment goal mismatch | Existing payments on or before today already reduce starting balance and are excluded from future goal-payment allocation. Regression coverage compares assessment baseline with Dashboard allocation after same-day and earlier captures, while retaining future reserves. |
| Explicit waiting recommendation | Engine-recommended waiting is prominent on the review page, with no-purchase comparison and return-to-store actions. Scenario choices include waiting and a suggested marker. They never change PayPal funding. |
| HTTPS deployment support | Exact HTTPS origin allowlist, shared signing secret, public callback origins, Secure merchant cookie, platform listener HOST/PORT and separate durable ledger paths. Render Blueprint and deployment guide supplied; local HTTP remains loopback-only. |
| Documentation and acceptance | PR description and these status notes reflect current implementation and evidence. Model, financial-data and payment limitations remain explicit. |

## Validation

- All 112 automated tests pass: finance, same-day baseline regression, goals, grounded AI,
  provider failure, workspace isolation, stale review, payment recovery, merchant handoff,
  capture/receipt, HTTPS allowlist, secure callbacks and merchant-ledger restart persistence.
- TypeScript and production build pass. CI is separately recorded in GitHub Actions after push;
  local tests are not evidence of a finished remote CI run.
- Live Gemini key verified with `gemini-3.6-flash`: goal extraction and free-text fact retrieval
  succeeded. The old 2.5 Flash model rejected this new account; 3.8 Flash returned overload.
  Secrets remain in ignored local environment files; remote environments need their own settings.
- Phase 2 completed a new $900 USD merchant Sandbox capture. Provider status, capture identity,
  amount/currency, both ledgers, one purchase and one saved before/after forecast match. The earlier
  read-only verification is superseded by [this live evidence](DEMO_RELIABILITY_PHASE_2.md).
- Local responsive browser acceptance is now recorded in [Phase 1 verification](COMPACT_UI_PHASE_1.md).
  Physical-device and external-provider checkout acceptance remain separate.

## Remaining external acceptance

- Actual Render account connection, assigned public HTTPS origins and deployment.
- Public PayPal Webhook registration, `PAYPAL_WEBHOOK_ID`, verified provider event delivery and
  public end-to-end browser/restart acceptance.
- Real Pay Later eligibility and loan-term confirmation. Hypothetical comparison schedules are not
  evidence of eligibility. Captures conservatively reserve the full price until funding is known.
- Repository public visibility, final recording and Devpost submission are separate user decisions.
  No visibility change, submission or external deployment is implied by a source push.

## Architecture boundaries

This is a fictional-data, single-instance JSON-ledger demo with opaque workspace cookies, not
production authentication or bank reconciliation. Supabase Auth/Postgres/RLS, Plaid, Python service
migration, background reconciliation and production merchant onboarding remain future work.
Optional deployment uses paid single-instance services and persistent disks, not replicated storage.
See [deployment guide](DEPLOYMENT.md) for explicit prerequisites and limitations.

## Phase 4 — AI Financial Profile

Implemented deterministic aggregate extraction, a strict Gemini fact-ID contract with template
fallback, a compact responsive Dashboard profile, source evidence, dismiss/restore/regenerate,
and confirmed editable planning preferences. Shop and merchant review add read-only explanations
using the selected engine assessment. Profile preferences never alter authoritative engine inputs,
goal priorities, bill commitments or payments. Persistence stores selection IDs, not raw AI prose.

All **129 tests**, TypeScript and production build pass. Live Gemini/profile/purchase validation,
isolated HTTP reset/isolation checks, and 375/390/768/1280 responsive browser checks are recorded
in [Phase 4 documentation](FINANCIAL_PROFILE.md). No new capture or real bank connection was made.

## Required preservation of both purchase flows

Proactive Shop exploration and the direct cooperating-merchant PayPal checkout remain operational.
Exploration needs no PayPal authorization and creates no payment; merchant approval automatically
opens signed RiskPilot review without visiting Shop. Both reuse the authoritative financial engine.
New regressions cover zero-provider exploration, matching engine results, merchant entry with no
prior decision, and cancellation before/after approval. Existing secure confirmation, verification,
idempotency, receipt and exactly-once forecast coverage remains in place.

All **131 tests**, TypeScript and production build pass. Isolated mobile/browser and HTTP acceptance
is documented in [the two-flow release gate](PURCHASE_FLOWS.md). No new live provider payment was made.

## Sequential optimization roadmap completion

Baseline and separate phase commits are recorded in [the final optimization report](OPTIMIZATION_ROADMAP.md). Phase checkpoints passed 86 / 101 / 115 / 132 tests respectively, each with TypeScript and production build. Both purchase paths remain required. Final mobile merchant review moves confirmation before optional analysis, shows a concise explanation and retains critical funding disclosures. Existing real Sandbox completion was reverified read-only; new end-to-end capture checks used an isolated fixture.

## Fixed account experience

Fixed fictional account entry preserves each account's profile and existing payment ownership.
The final purchase requirements supersede the earlier Basic/Premium demonstration: all tiers and
analysis locks are removed. Every account receives the normal full review. Smart Recheck uses
verified prior assessments, not membership.

## Final purchase experience

Both purchase entry points remain operational. Explicit signed Shop → Northstar intents and the
existing order/decision association support read-only Smart Recheck. Unchanged, changed and
unavailable/expired results preserve access to the full freshly recomputed assessment.
All **147 tests**, TypeScript and production build pass. New browser/API capture checks used an
isolated provider fixture; no new live Sandbox capture is claimed. See [complete final verification
and implementation limits](FINAL_PURCHASE_EXPERIENCE.md).

## Step 3 — spending-budget assumptions (November 11, 2026)

Money now supports category budget suggestions, saved unconfirmed drafts, explicit confirmations,
revert and source/overlap review using existing fictional spending aggregation and persona storage.
Budget state is isolated from authoritative forecasts, cash capacity, goals and purchase scenarios.
177 automated tests, TypeScript and production build pass; Chrome rendering/screenshots and
interactions were checked at 375/390/768/1280px. No payment or existing-workspace reset was performed.
See [data model, rules, verification and limits](SPENDING_BUDGETS.md). Steps 4 and 5 are not implemented.

## Step 4 — expected income and three-month planning (November 11, 2026)

Money now includes calendar-aware monthly, 14-day, three-calendar-month and one-time income
expectations with explicit confirmation, editing, pause/resume and removal. The current-month
remainder and two full months show expected income, modeled outgoings and separately estimated
confirmed budgets. Uncertain or potentially duplicate income is excluded from expected totals;
budget-to-bill/daily-spending overlaps remain separate. Existing 45-day calculations and checkout
input hashes are unchanged. The Step 3 editor is reused behind “Adjust your plan.”

202 automated tests, TypeScript and production build pass. Chrome rendering/screenshots and
interactions were checked at 375/390/768/1280px. No PayPal payment or existing-workspace reset was
performed. See [models, recurrence, financial boundaries and verification](MONEY_PLANNING.md).
Step 5 authoritative integration remains unimplemented.

## Step 5 — verified 45-day planning integration (November 11, 2026)

The shared persona materializer now compiles explicitly mapped, confirmed expected income into the
existing forecast simulator. Exact-ID replacement verifies the modeled source signature; similarity
only raises an unresolved veto. The last confirmed schedule remains active during unconfirmed edits.
New receipts are omitted from stress and long-term goal income; checking and capture reserves remain
unchanged. Snapshot hashes propagate through Dashboard, Money, Goals, Shop and merchant review,
reusing existing stale-decision and capture guards without changing payment code.

All current category budgets remain Needs review: no source-backed partition of the single daily
spend baseline exists, and scheduled bills/repayments may overlap. No arbitrary fraction is replaced
or added. This is deliberate safe partial integration, not a claim of full budget reconciliation.

219 tests, TypeScript and production build pass. Chrome rendering/screenshots and interactions were
checked at 375/390/768/1280px. No actual PayPal capture or existing-workspace reset was performed.
See the [pre-change calculation audit, mappings, timing, verification and limits](FORECAST_INTEGRATION.md).
Step 6 and Vision remain unimplemented.

## Step 6 — Money What-if and grounded explanations (November 11, 2026)

Money adds collapsed, read-only category-budget comparisons and on-demand, source-backed Money
explanations. Monthly differences and calendar-prorated planning estimates are distinct from the
authoritative 45-day forecast, which remains unchanged by unsupported category budgets. Revert
is local; explicit confirmation reuses versioned budget storage with preview financial freshness.

The coverage audit still cannot prove the categories represented by the daily-spend scalar or
complete future expense coverage. No full-baseline replacement or inferred category mapping is
enabled. Gemini may order only deterministic, server-authored facts; fallback remains available,
and evidence freshness is checked before and after generation without invalidating payment inputs.

239 tests, TypeScript and production build pass. Chrome rendering/screenshots and interactions were
checked at 375/390/768/1280px. Live Gemini budget-change and capacity explanations succeeded;
mocked outage/timeout fallback and stale-input rejection passed. No payment, order or existing-data
reset was performed. See [the coverage audit, preview/AI contracts and verification](MONEY_WHAT_IF.md).
Final PayPal Sandbox acceptance and demo readiness remain separate, approval-gated work.

## Step 7A.2 — category-aware spending integration (November 11, 2026)

The approved Step 6/7A checkpoint is `c5115f4`. Alex's declared fictional category model
partitions the same $20/day; migration preserves balances, risk, goals, capacity and hashes.
New Alex profiles opt in by default; existing Alex profiles can enable it explicitly without
resetting data or activating saved planning-only budgets. Sam/Jordan retain legacy behavior.

Food, shopping and entertainment support explicit What-if application. Recurring transport,
bills, health and unknown categories remain planning only. Calendar-day integer-cent
replacement feeds the shared forecast, goals, readiness and purchase reviews. Current/scenario
engine facts, application status and restoration use the existing compact Money UI. Grounded
AI uses server facts and deterministic fallback. Payment endpoint implementations are unchanged.

271 automated tests pass, including 32 category-integration tests/subtests. Final TypeScript,
build and browser evidence are recorded with the Step 7A.2 result. No actual payment or
existing-workspace reset was performed. See [coverage, migration, cent timing and limits](CATEGORY_SPENDING_MODEL.md).
Step 7B live Sandbox acceptance and Vision remain unimplemented.

## Step 7B — final local Sandbox acceptance (November 12, 2026)

Step 7A.2 is checkpointed as `0008f283960d98bbee5b36d6229c7214953212de` on `cynthia`.
Both live Sandbox journeys completed with product-owner participation in an isolated acceptance
ledger: Northstar $900 (order `0B055045PW155242U`, capture `0FL65682BP995802J`) and Shop
$249 (order `3LJ35188YL886274D`, capture `58119035695595002`). Read-only provider verification,
merchant receipt/Shop success and exactly one reserve/saved forecast per capture agree.
No original demo workspace was reset; payment and financial implementations were unchanged.
Final failure-case QA reproduced decision AI's 50-second maximum exceeding Shop's 40-second
client deadline. Its optional explanation now falls back after at most two 5-second attempts;
a focused abort-signal regression fails before the fix and passes afterward.

Shopping $90 → $30/month changed actual clean-fixture lowest cash $1,720 → $1,738, stress
$1,540 → $1,572 and capacity $90 → $122. Subsequent verified payments correctly reduced
capacity to $0. All current pages share the final hash/forecast. Stale assessment rejection,
non-capturing exploration/skip, actual receipt refresh and controlled cancellation/failure/recovery
coverage passed. Live Gemini outputs and deterministic fallback/grounding tests passed.

272 tests, TypeScript, production build and whitespace checks pass. Actual measured responsive
browser widths 375/390/768/1280px and screenshots cover the main pages, review, merchant and
saved payment outcomes. Physical devices/public webhook delivery remain separate. See the
[precise live-versus-mock evidence and limits](STEP7B_ACCEPTANCE.md) and [2:50 rehearsal](STEP7B_DEMO_REHEARSAL.md).
Step 8 `/vision`, new product features and Devpost copy were not implemented.

## Step 8 — standalone future vision showcase (November 11, 2026)

The approved Step 7B changes are checkpointed as `42e94b99ca7de0513ba9f8d9bba3ed3766c92509`
on `cynthia`. `/vision` is a static presentation route outside the four-item product navigation.
It uses the existing local Inter font, CSS, SVG and icons; the concept does not mount account
navigation, fetch financial data, calculate forecasts, or expose a payment action. All product
routes retain their existing shell. No financial/payment services or acceptance ledgers were changed.

The phone illustration labels the verified clean Alex budget/allocation example as illustrative.
Today’s merchant-integrated Sandbox implementation is distinguished from a possible future
PayPal ecosystem integration requiring platform support and user permission. This is not an
official PayPal interface, partnership or measured business-outcome claim.

272 tests, TypeScript, production build and whitespace checks pass. Rendered browser screenshots
were inspected at 375/390/768/1280/1440/1920px. The complete desktop composition fits at 1280×800,
1440×900 and 1920×1080; mobile stacks naturally with scrolling. Screenshots and verification logs
are outside Git in `../artifacts/step-8/`. No payment was initiated or captured in Step 8.
Final submission, Devpost and video preparation remain separate, unperformed work.
