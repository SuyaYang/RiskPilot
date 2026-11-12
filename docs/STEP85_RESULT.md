# STEP 8.5 RESULT

**Status: Completed. Final verdict: Ready for Step 9 within the local fictional/Sandbox prototype scope.**
Step 9 and GitHub publication have not begun. No actual payment was initiated or captured.

## Git checkpoint and publication boundary

- Branch: `cynthia`.
- Step 7B: `42e94b99ca7de0513ba9f8d9bba3ed3766c92509`.
- Complete Step 8 checkpoint: `57bcc9583b854a5e57c23061ab30c4f8bbe1375b`.
- Step 8 includes README, root layout, AppShell, both Vision files and implementation status.
- The remediation candidate is the local freeze commit containing this report; inspect with `git log -1 --format=%H`.
- Working tree is clean after that local commit. No push, merge, force-push or remote branch write was performed.
- Read-only `git ls-remote --heads origin` found `cynthia` and `feature/checkout-mvp` at `fa2f5c2d2721b1221dfbaa2e3f43b9e89bde9975`.
- Original two local data ledgers and two Step 7B acceptance runtime ledgers have unchanged SHA-256 hashes.
  Captured snapshots were not migrated, recalculated in place or overwritten.

## Finding-by-finding disposition

| Finding | Disposition | Source/root cause and correction | Reproduction / tests / limits |
| --- | --- | --- | --- |
| Replacement disappears after day 45 | Confirmed, corrected | `lib/planning/integration.ts:compilePlanning`, `lib/engine/forecast.ts:simulate`: only 45-day credits survived after suppressing original income. New `lib/planning/effectiveIncome.ts:effectiveIncomeEvents` expands validated schedules to the simulator's actual horizon. | Equivalent salary and 361-day installment regression; monthly/quarterly/one-time expansions. Visible chart stays 45 days. |
| Replacement destroys established stress and goal income | Confirmed, corrected | All planning receipts were omitted from stress; `monthlySurplus` skipped original salary and added no replacement. Stress now retains original-date matching receipts, capped at the original amount and delayed seven days. Equivalent biweekly goal income uses the original 26/12 normalization and an original-amount cap. | Equal/larger/lower replacement tests, changed recurrence, pause, uncertain/hypothetical sources, existing additional-income caps. A mapping is not external proof of a raise or new dates. |
| Purchase goal delay double counts buffer loss | Confirmed, corrected | `lib/engine/options.ts` supplied payments and the resulting buffer deficit to `lib/engine/goals.ts:allocateGoals`, which summed them. The allocation now protects the larger overlapping requirement, with an independent pre-purchase cash-deficit floor. | No-purchase, safe/breaching purchases, existing deficit, installments, and shared snapshot/assessment baseline checks. Existing monthly goal strategy and same-day cash accounting remain. |
| Browser chooses weaker capture path | Confirmed, corrected | `app/api/paypal/orders/[id]/capture/route.ts` re-exports the general orders route. That route previously dispatched on browser `checkoutSource`. It now dispatches on persisted `order.merchant` / `order.shopPayNow`; `lib/checkout.ts:captureCheckout` also enforces Shop recheck. | Both routes tested with correct, omitted and forged source; expired/stale/ambiguous/unapproved/foreign-owned orders never capture. Provider recovery and duplicates tested. |
| Zero-difference budget changes spending | Confirmed, corrected | `lib/planning/preview.ts` and `service.ts` converted a daily baseline into a fixed calendar-month budget even at the displayed baseline equivalent. Matching baseline amounts now retain the daily model. | November, February, leap February, following 31-day month, actual conversion, identical active monthly budget, preview read-only and financial-hash tests. |
| Financial date flips at UTC midnight | Confirmed, corrected | `lib/dates.ts:today` used the UTC clock date. It now uses configured `FINANCIAL_TIMEZONE`, default `America/New_York`, and represents the resulting date at UTC midnight for arithmetic. | Winter/summer local midnight, DST boundaries, Tokyo configuration and pinned demo-date tests. Real payment timestamps are unchanged. |
| Verified refund/reversal hidden by captured status | Confirmed, corrected | `lib/paymentStatus.ts` prioritized historical CAPTURED status. Verified settlement resource evidence now takes precedence; `lib/webhooks.ts` persists deduplicated evidence. Success copy displays the changed settlement. | Partial/full refund, reversal, duplicate webhook/resource, unknown refund extent and unchanged reserve/snapshot tests. No financial refund reconciliation implemented. |
| Hypothetical installments could imply borrowing advice | Clarified; no ranking overhaul | Existing hypothetical flags remain. `PurchaseImpact.tsx` and `lib/ai.ts` now explicitly distinguish educational estimates from enabled financing, state full-price capture, and explain that waiting may preserve goals. | Existing ranking/grounding tests pass. Loan eligibility, funding schedules and terms remain unconfirmed. |
| Incomplete publication and conflicting guides | Confirmed, prepared locally | Vision dependency checkpointed; current source and tests included in freeze candidate. Older script points to one authoritative rehearsal. | Clean install/build verified. Publishing remains explicitly unperformed. |
| Dependency advisories | Known limitation, deferred | Next 15.5.29 directly pins transitive PostCSS 8.4.31. See assessment below. | No attacker-supplied CSS processing route found; no broad dependency migration or force fix. |

## Income replacement: exact reproduction and corrected policy

Fixed financial date **2026-11-10**, fresh Alex, salary $1,500 every 14 days starting November 19,
explicit exact-ID replacement of `a-pay` with the same amount, cadence and next event:

| Engine fact | Original salary | Broken replacement, before fix | Corrected equivalent replacement |
| --- | ---: | ---: | ---: |
| Normal minimum | $1,720 | $1,720 | $1,720 |
| Stress minimum | $1,540 | −$1,040 | $1,540 |
| Risk | green | yellow | green |
| Monthly goal surplus | $642 | −$2,608 | $642 |
| $249 Pay Monthly normal minimum | $1,720 | −$23,496.72 | $1,720 |
| $249 Pay Monthly stress minimum | $1,540 | −$27,996.72 | $1,540 |
| $249 Pay Monthly risk | green | red | green |

The existing Pay Monthly evaluation ends **2027-11-05**, 361 days from the start inclusive.
It receives replacement events throughout that horizon. The authoritative displayed forecast still
contains exactly 45 daily balances. Original salary is suppressed once, and replacement is credited once.

Equivalent means actual future event dates and normalization agree. The legacy monthly schedule is
fixed **30 days**, while new monthly/quarterly schedules use calendar dates and anchor-day clamping.
Those are not classified as equivalent merely because their first two receipts happen to align.
Biweekly equivalence requires the next modeled event to occur on the planning schedule and no missing
future modeled receipt. Stress credits only dates that match original modeled receipts, capped at the
original amount, delayed seven days. Changed timing/recurrence may therefore produce fewer trusted
stress receipts; this is intentionally conservative and disclosed by the mapping status.

A $3,000 biweekly replacement raises normal projected receipts but retains only $1,500 per original
receipt in stress and $3,250/month in goal-income normalization; capacity remains capped at the engine
without planning income. A $1,000 equivalent replacement reduces monthly goal surplus to **−$441.33**
and capacity to $0. Additional confirmed plans remain omitted from stress and long-term goal funding.
Drafts, paused, hypothetical, uncertain, unresolved or duplicate mappings do not replace original income.
The previously confirmed copy remains active during a later unconfirmed edit, as before.

## Goal impact: calculation and intentional boundaries

The reported example reproduces exactly at **2026-11-12** (November 10 gives dates two days earlier):

- No purchase: Japan Trip **2027-03-14**.
- $900 purchase charged once to the prospective contribution model: **2027-04-13**.
- Old calculation added the resulting $180 buffer deficit to the same $900: **2027-05-13**.
- Corrected full-price preview: **2027-04-13**, 30 days of additional projected delay.

Alex's monthly contribution surplus remains $642. In the first prospective funding month, a $900
purchase uses that $642 and carries $258 into the next month. Adding another $180 had incorrectly
made the carry $438. The buffer deficit is a consequence of this purchase, not a second bill.
The allocator now subtracts scheduled payments and only the **uncovered** independent buffer deficit:
`max(pre-purchase cash deficit, total forecast deficit − scheduled purchase cost)`.
An independently existing $480 cash-buffer deficit remains protected even when later payments exist.
Normal/stress risk checks and protected-goal gates are not removed.

The existing goal model uses 30.4-day funding buckets and priorities. It does not allocate all excess
checking cash to goals. Recorded on/before-today reserves reduce starting checking and are not charged
again as future contributions; future reserves retain their scheduled contribution burden. Dashboard,
Goals and purchase-review baselines share this same model. Prospective educational payment schedules
and the actual captured full-price reserve are different inputs; their ETAs are not promised to match.
The existing engine test's strict Pay-in-4 goal-delay advantage was an artifact of the extra deficit
charge: corrected full and Pay-in-4 Japan Trip delays are both 30 days in this coarse monthly example.
The test now asserts those exact corrected delays, rather than preserving a false advantage.

## Checkout security and legacy recovery

Trusted intent is persisted `merchant` metadata for Northstar and `shopPayNow === true` for Shop.
Client `checkoutSource` is ignored for authorization. The general capture service independently
validates Shop's original assessment ownership, currency, product/amount, age, financial inputs,
recomputed forecast and goals through `orderReview` / `smartRecheck` before any new capture.
A financial-policy marker (`rp-v1-step85`) invalidates pre-remediation assessments; old saved capture
snapshots retain their original hashes and facts.

- Shop stays PAY_NOW / commit:true, with PayPal final confirmation and no added RiskPilot page.
- Northstar stays CONTINUE / commit:false, signed handoff and explicit RiskPilot confirmation.
- Persisted `shopPayNow === false` identifies known legacy Continue orders, which retain explicit review.
- Unpaid orders lacking trusted intent fail closed; no generic capture is allowed merely because a
  browser omitted a source. Preserve ambiguous old orders for reconciliation.
- Completed local orders return their existing result even if old intent metadata is absent.
- Uncertain attempts may read the original provider order: a verified remotely completed capture can
  be recorded/recovered without recapturing, even if the original assessment has since expired.
- Fresh expired/stale Shop assessments reject before provider lookup. Recovery never treats an
  expired assessment as authorization for a new capture. Locks, amount/currency verification and
  same-order idempotency remain active.

Route regressions exercise the canonical and PayPal alias routes with correct/missing/forged source,
expiry, stale inputs, unknown intent, cross-owner access, missing confirmation, missing approval,
duplicate capture and completed recovery. Existing signed merchant tests cover unconfirmed and valid
merchant confirmation. Invalid cases assert zero payment-capture calls. All provider calls are mocked.

## Budget and date correction

At the daily food baseline, November $300, February $280 and leap February $290 are current-month
equivalents. Applying that displayed unchanged amount now preserves the daily rate, future 31-day
spending, goal normalization, forecast and financial hash. An identical already-active monthly
budget preserves its effective date and hash. A genuinely different amount explicitly converts to a
fixed calendar-month budget: preview shows its actual shared-engine effects and following-month
estimates before confirmation. Daily baseline goal normalization remains 30.4 days; fixed monthly
budgets use their actual monthly amount. Restoration remains explicit and unchanged.

`FINANCIAL_TIMEZONE=America/New_York` is documented and present in `.env.example`. `DEMO_TODAY`
overrides the clock and is validated. Tests cover 04:59:59/05:00 UTC winter midnight, 03:59:59/04:00 UTC
summer midnight, DST spring/fall dates and another configured timezone. Capture/webhook timestamps
remain real UTC instants. Fixture recurring items are still relative to the financial as-of date;
a saved fixed-date plan may cease to be equivalent when the as-of date changes. Pin dates for recordings.

## Refund/reversal status and remaining production limits

Verified refund resources with amounts distinguish partial and full cumulative refunds; duplicate
resource IDs are not counted twice. A reversal has its own state. Historical refund markers without
usable amount evidence show extent unconfirmed. Neither refunds nor reversals release reserves,
rewrite purchase history or replace capture snapshots. Financial refund/bank reconciliation remains
unsupported. Merchant receipt code already distinguishes provider refund/reversal states and was
preserved. Public verified webhook delivery and physical-device payments remain unaccepted.

Local account cookies isolate fictional workspaces; this is not production authentication. Merchant
quotes remain server-priced and provider amount/currency/custom-order identity checked. Gemini selects
server facts; it neither authorizes payments nor establishes financial correctness. No banking service,
production identity, database migration, payment method or investment feature was introduced.

## Documentation and dependency assessment

The authoritative recording guide is [STEP7B_DEMO_REHEARSAL.md](STEP7B_DEMO_REHEARSAL.md).
It now budgets 2:40 for the existing story, ten seconds for Vision, and ten seconds contingency inside
three minutes. Login, MFA/CAPTCHA and unexpected network/provider delay are excluded, with buyer
preparation and prewarming off camera. Human approval/final payment remain product-owner actions.
Old DEMO_SCRIPT points to this guide. Historical acceptance reports retain their original evidence;
current correction notices and this report distinguish those checkpoints from this candidate.
Actual launcher requirements are **Node.js 22, npm, curl and Python 3**. Gemini is optional;
merchant launcher requires Sandbox configuration, while app-only simulation can run without keys.

`npm audit --json` reports two affected package entries: direct **Next 15.5.29 (moderate)** through
transitive **PostCSS 8.4.31 (high)**, not two independent runtime exploits. The reported PostCSS issues
concern unescaped CSS output and attacker-controlled source-map loading:
[CSS output advisory](https://github.com/advisories/GHSA-qx2v-qp2m-jg93),
[source-map advisory](https://github.com/advisories/GHSA-6g55-p6wh-862q),
[incomplete-fix advisory](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp),
[path traversal advisory](https://github.com/advisories/GHSA-r28c-9q8g-f849).

Reachability review found no user-supplied CSS upload, PostCSS invocation, inline CSS stringification
or source-map transformation endpoint in `app/` or `lib/`. Application CSS comes from trusted repository
files during build. This is a scope-specific reachability assessment, not proof that the dependencies
are safe for arbitrary future uses. The registry reports PostCSS 8.5.32 available in the same major,
but Next pins 8.4.31 exactly; changing it requires a dependency override and compatibility validation.
The audit's automatic remediation proposes Next 16.4.6, a major migration. Neither is materially
necessary for this local trusted-source demo, so both are deferred; no force fix or package-lock
change was made. Reassess before accepting untrusted CSS/build input or public production deployment.

## Existing verified financial scenarios

Fresh isolated stores, with all readiness checks passing:

| Scenario | Lowest cash | Delayed-income minimum | Capacity | Checking / purchases |
| --- | ---: | ---: | ---: | --- |
| Clean baseline | $1,720 | $1,540 | $90 | $3,500 / 0 |
| Food $300 → $150, 2026-11-10 | $1,765 | $1,620 | $170 | $3,500 / 0 |
| Shopping $90 → $30, 2026-11-12 | $1,738 | $1,572 | $122 | $3,500 / 0 |

All reference amounts are unchanged. Preview is non-mutating; application creates no purchase and
never increases checking. Material changes invalidate assessments. Unsupported categories remain
planning only. Tests preserve existing additional-income safeguards and both payment architectures.

## Verification and safety

- **289 tests passed, 0 failed** (272 existing plus 17 new tests/subtests).
- New regression file: `tests/final-remediation.test.ts`; one existing engine assertion corrected
  with an explanation and exact goal-delay values.
- Pre-fix failing probes retained in private `../artifacts/step-8.5/before.log`.
- Targeted and full regression logs, exact financial JSON probes, advisory output and ledger hash
  preservation evidence are private artifacts outside Git, not application dependencies.
- Main and clean-copy TypeScript checks pass. Clean `npm ci`, all 289 tests and production build pass.
- `git diff --check` passes. Documentation local links resolve. Credential-pattern scan found no
  matches; tracked environment/data/key paths contain only the blank `.env.example` template.
- Browser checks against the isolated production build: Money's $300 → $300 preview visibly keeps
  $1,720 / $1,540 / $90 and $0 differences; Shop renders corrected $900 impact; mobile Money and Vision
  have no horizontal overflow at 390px; Vision retains its separate shell. No browser errors observed.
- All financial probes use temporary stores; payment tests use provider mocks. No actual Sandbox
  order/payment was initiated or captured. Four original/acceptance JSON ledgers match their initial
  SHA-256 hashes. Existing two verified purchases and two capture snapshots remain intact.
- Automated and responsive checks do not prove complete financial correctness, fresh live Sandbox
  acceptance, physical-device behavior or a guaranteed three-minute human checkout.

## Required publication steps — only after explicit owner approval

Run from the RiskPilot repository. These commands are recommendations and were **not executed**:

```bash
git switch cynthia
git status --short
git fetch origin
git merge-base --is-ancestor origin/cynthia cynthia
git merge-base --is-ancestor origin/feature/checkout-mvp cynthia
git push --atomic origin cynthia:cynthia cynthia:feature/checkout-mvp
```

Stop if either ancestry check fails; inspect remote changes without force-pushing. The atomic push
publishes the already prepared candidate to both branches; it does not merge the PR. No secrets,
private runtime ledgers or acceptance artifacts belong in that push. No Step 9 copy was written.

## Exact files modified in Step 8.5

All paths below are relative to the repository root `RiskPilot/` (the six Step 8 files are already
tracked in the separate checkpoint named above):

- `.env.example`
- `README.md`
- `RUNNING.md`
- `app/api/orders/[id]/capture/route.ts`
- `app/components/CheckoutSuccess.tsx`
- `app/components/PurchaseConclusion.tsx`
- `app/components/PurchaseImpact.tsx`
- `app/money/page.tsx`
- `app/page.tsx`
- `docs/CATEGORY_SPENDING_MODEL.md`
- `docs/DEMO_SCRIPT.md`
- `docs/FINAL_PURCHASE_EXPERIENCE.md`
- `docs/FORECAST_INTEGRATION.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/MONEY_PLANNING.md`
- `docs/MONEY_WHAT_IF.md`
- `docs/PURCHASE_FLOWS.md`
- `docs/STEP7B_DEMO_REHEARSAL.md`
- `docs/STEP85_RESULT.md`
- `lib/ai.ts`
- `lib/checkout.ts`
- `lib/dates.ts`
- `lib/engine/forecast.ts`
- `lib/engine/goals.ts`
- `lib/engine/options.ts`
- `lib/engine/purchaseTiming.ts`
- `lib/paymentStatus.ts`
- `lib/planning/calendar.ts`
- `lib/planning/effectiveIncome.ts`
- `lib/planning/incomeService.ts`
- `lib/planning/incomeTypes.ts`
- `lib/planning/insights.ts`
- `lib/planning/integration.ts`
- `lib/planning/preview.ts`
- `lib/planning/service.ts`
- `lib/shopCheckout.ts`
- `lib/state.ts`
- `lib/store.ts`
- `lib/types.ts`
- `lib/webhooks.ts`
- `tests/engine.test.ts`
- `tests/final-remediation.test.ts`

**STOP:** Local correction and code freeze complete. Await explicit publication/Step 9 approval.
