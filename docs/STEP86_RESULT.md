# STEP 8.6 RESULT

## Status

**Completed. Both required corrections are implemented. Ready for targeted independent Claude recheck.**
No Step 9 work, remote publication, actual PayPal order or payment was initiated.

## Git and protected state

- Branch: `cynthia`.
- Verified starting freeze: `0cf0f93f7695eb5da62aa1f37696e7d087a40e1a`, with a clean working tree.
- New freeze: the local commit containing this report (`git log -1 --format=%H`). Working tree clean after commit.
- Protected hashes were recorded before changes. All four original/Step 7B JSON ledgers match those
  hashes after verification; original workspaces, two accepted captures and immutable snapshots remain intact.
- Source, tests and documentation only are committed. Private probes, browser fixtures, screenshots,
  build output, environment credentials and ledgers remain outside Git. No remote write occurred.

## Part A — Income replacement correction

### Reproduced defect and source evidence

At November 10, clean Alex has $1,500 biweekly modeled salary `a-pay`, next November 19.
Before this change, real planning-service confirmations produced:

| Replacement | Normal minimum | Stress minimum | Goal surplus/month | Capacity | Japan Trip ETA | $249 monthly stress minimum |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| Seven days later | $1,540 | −$1,040 | −$2,608 | $0 | none | −$27,996.72 |
| Seven days earlier | $3,040 | −$1,040 | −$2,608 | $0 | none | −$27,996.72 |
| $3,250 calendar monthly | $1,720 | $460 | −$2,608 | $0 | none | −$26,496.72 |

`lib/planning/integration.ts:compilePlanning` pushed the original ID into `replacedIncomeIds`
before checking whether `equivalentCadence` was true. `effectiveIncomeEvents` then had no matching
original-date stress receipts for shifted schedules; `establishedReplacementMonthly` excluded their
cadence. Normal forecast accepted the replacement while stress and goal funding lost the salary.
The Step 8.5 normal long-horizon expansion already worked; eligibility was the remaining defect.

### Narrow guard and authoritative behavior

`compilePlanning` now checks the source signature and supported effective schedule **before** removing
any original ID or adding replacement events. `effectiveIncome.equivalentCadence` checks biweekly
cadence and the **same next effective receipt**, not just modular phase or equal annual pay.
A past anchor is supported only if its next effective receipt is exactly the next modeled one.

Identical, lower and higher timing-compatible biweekly replacements remain supported. Lower amounts
reduce normal receipts, capped stress and goal income. Higher amounts retain original established
stress/goal caps and the existing allocation cap. Calendar monthly/quarterly schedules, one-time
replacement and shifted dates remain Needs review. They are not converted into additional income.
Original modeled salary stays active in normal/stress/goal calculations. The existing UI says:

> This schedule differs from your existing modeled income. It is saved for planning only; your original income remains in the cash-flow forecast. The proposed date, cadence or income loss is not applied.

`planning/overview.ts` also excludes unsupported replacement events from informational expected-income
totals, even when a different source name would otherwise evade its overlap heuristic. Additional
calendar income keeps its existing independent mapping, confirmation, stress exclusions and caps.

Unsupported confirmation against unchanged baseline leaves the financial hash and full snapshot
unchanged. A confirmed supported lower replacement edited into an unsupported date retains the prior
schedule during the draft; explicit confirmation withdraws it, restores original salary and changes
the hash. Pause/resume/remove and duplicate-source conflict handling retain their existing safeguards.
The one-time policy bump `rp-v1-step86` invalidates older deployment assessments because goal semantics
changed. Within this policy, unsupported planning-only edits do not invalidate unchanged checkout inputs.

### Actual corrected engine values

Fixed November 10, 2026; original amount $1,500, compatible lower $1,000, compatible higher $3,000:

| Income scenario | Lowest projected cash | Delayed-income minimum | Monthly goal surplus | Available to allocate | Integration status |
| --- | ---: | ---: | ---: | ---: | --- |
| Original baseline | $1,720 | $1,540 | $642 | $90 | modeled |
| Identical replacement | $1,720 | $1,540 | $642 | $90 | included |
| Seven days later | $1,720 | $1,540 | $642 | $90 | needs_review |
| Seven days earlier | $1,720 | $1,540 | $642 | $90 | needs_review |
| Monthly replacement | $1,720 | $1,540 | $642 | $90 | needs_review |
| Compatible lower amount | $1,160 | $980 | −$441.33 | $0 | included |
| Compatible higher amount | $1,720 | $1,540 | $642 | $90 | included |

The original, identical, both shifted and changed-frequency cases all evaluate the $249 Pay Monthly
schedule through **2027-11-05 (361 days)** with minimum $1,720, stress $1,540 and green risk after the
fix. The shifted/changed cases achieve this by retaining original salary, not by accepting the proposal.
The genuinely lower compatible salary produces long-horizon normal −$3,293.66 / stress −$4,113.66,
red risk: that is the supported lower-income assumption, not missing recurrence. The higher compatible
salary keeps original stress/goal caps. Displayed authoritative daily balances remain exactly 45 days.

## Part B — Shared purchase-to-goal consistency

### Reproduced discrepancy

Clean Alex, fixed November 12, 2026, $900 immediate full-price laptop:

| Goal | Before purchase | Old hypothetical | Old post-capture |
| --- | --- | --- | --- |
| Japan Trip | 2027-03-14 | 2027-04-13 | 2027-03-14 |
| Emergency Fund | 2027-04-13 | 2027-06-13 | 2027-04-13 |
| Start investing | 2027-04-13 | 2027-05-13 | 2027-04-13 |

`options.buildOptions` previously passed today's candidate as a future contribution expense, while
`state.snapshot` excluded completed on/before-today payments from future goal deductions after they
had reduced starting cash. The review thus budgeted the purchase against future contributions;
the completed version used cash-funded accounting. The $249 non-buffer-breaching fixture had the
same mismatch for Emergency Fund. These were actual allocation objects, not UI string comparisons.

### Chosen model and conservation

The correction keeps the existing authoritative **cash-funded** policy and reuses the existing goal
allocator. `engine/goals.projectGoals` combines recorded reserves and optional in-memory candidate
payments into one effective snapshot:

1. On/before-today outflows reduce forecast starting cash once through the existing `startingBalance`.
2. Only later outflows enter future monthly contribution buckets.
3. The remaining cash-buffer deficit is protected through the existing allocator and its Step 8.5
   overlap rule, with the pre-future-payment cash deficit as an explicit floor.
4. No goal balance, priority, target date or cached ETA is written by previewing.

`state.snapshot` (including the conservative allocation-cap branch), `options.buildOptions` and
`purchaseTiming.purchaseAfterIncome` all call this helper. Every production goal-allocation caller
now supplies the same explicit cash/future-payment treatment rather than relying on differing default
arguments. There is one allocator, not a second engine. Priority/deadline sorting, saved goal balances,
30.4-day funding buckets and the 48-month funding evaluation remain unchanged. No excess checking
cash is automatically allocated to goals.

The actual captured full-price reserve still reduces modeled checking by $900 exactly once.
The preview uses that same reduction in memory, without also deducting $900 from future contributions.
Its resulting $180 normal buffer pressure reduces current contribution room; that restoration is
protected liquidity, not an invented second bill. Independent pre-existing deficits remain protected.

### Actual equivalence table

All dates below are estimates. Clean Alex, November 12, identical $900 amount/date, same goals and inputs:

| Measure | Before purchase | Hypothetical immediate purchase | After simulated verified capture |
| --- | --- | --- | --- |
| Japan Trip completion | 2027-03-14 | 2027-03-14 | 2027-03-14 |
| Emergency Fund completion | 2027-04-13 | 2027-04-13 | 2027-04-13 |
| Start investing completion | 2027-04-13 | 2027-04-13 | 2027-04-13 |
| Monthly recurring goal-funding surplus | $642 | $642 | $642 |
| This month's total goal allocation | $642 | $462 | $462 |
| Japan / emergency / investing allocation | $250 / $200 / $192 | $250 / $200 / $12 | $250 / $200 / $12 |
| Projected starting cash | $3,500 | $2,600 | $2,600 |
| Lowest projected cash | $1,720 | $820 | $820 |
| Delayed-income minimum | $1,540 | $640 | $640 |
| Available to allocate | $90 | $0 | $0 |
| New persisted purchase reserves | 0 | 0 | 1 |

**Hypothetical and post-capture forecast and allocation objects agree exactly.** The April 13 Japan
Trip date was not forced into the authoritative model. Under the existing monthly cash-funded policy,
$642 recurring surplus minus $180 protected buffer restoration leaves $462 in this first month.
The allocator still gives Japan Trip $250 and Emergency Fund $200 before the investing goal's $12.
The coarse monthly completion buckets happen to remain unchanged in this clean fixture. This does
not make the purchase safe: both cash-buffer checks fail and allocation capacity is zero.

A future-date purchase still enters the appropriate future contribution bucket and creates no saved
reserve. Hypothetical installment timing can legitimately yield different goal dates; the actual
payment path still captures/reserves the full price and does not establish an installment schedule.
Later confirmed budgets, compatible income changes and goal edits recompute from current inputs,
not stored scenario dates. Existing historical capture snapshots are immutable evidence, not caches.

### Regression evidence

| Case | Result |
| --- | --- |
| $249 purchase, no buffer breach | Full forecast/allocation equality before-vs-recorded representation; no future contribution charge for today's expense. |
| $900 buffer breach | Exact equivalence table above; no $900-plus-$180 future double charge. |
| Existing independent deficit | Prior $1,200 reserve remains; new $900 event counted once; hypothetical/captured projections match and capacity stays zero. |
| Multiple goals | Priority order preserved; shared first-month allocations total $462 rather than separate full-capacity allocations per goal. |
| Applied Shopping $90 → $30 | Scenario and capture agree. Minimum $838, stress $672, capacity $0; Japan March 14, Emergency April 13; Start investing March 14 → April 13, 2027. |
| Compatible replacement before purchase | Supported salary participates consistently and projections match after capture. |
| Unsupported replacement before purchase | Original salary remains active, proposal stays Needs review, and projections still match. |
| Preview / cancellation / skip / future | No financial mutation or purchase reserve; unpaid mocked order leaves snapshot unchanged; existing cancellation/future-capture rejection tests pass. |
| Repeated capture / receipt / recovery | Mock-provider capture called once, one reserve/snapshot, repeat confirmation and receipt GETs leave projections unchanged. |
| Later budget / income / goal edits | Natural recomputation changes allocations, not cached preview dates. |
| Dashboard / Goals / merchant review | Actual APIs and frozen-amount review agree with shared scenario/authoritative objects. |

## Existing financial reference scenarios

| Scenario | Lowest projected cash | Delayed-income minimum | Available to allocate |
| --- | ---: | ---: | ---: |
| Clean Alex baseline | $1,720 | $1,540 | $90 |
| Food $300 → $150, November 10 | $1,765 | $1,620 | $170 |
| Shopping $90 → $30, November 12 | $1,738 | $1,572 | $122 |

All cash references are unchanged. New isolated tests independently verify preview non-mutation,
preview/application equality, no purchase creation, checking input $3,500, material-hash changes and
restoration. Existing regressions preserve no-op daily budgets, unsupported categories, calendar cents,
partial months, category coverage and Sam/Jordan compatibility. Goal-specific immediate-purchase
references intentionally changed because the previous preview charged a cash-funded cost to future
contributions as well; the actual completed-purchase policy was preserved and shared.

## Payment safety

No PayPal create, capture, signing, merchant authorization or route-dispatch implementation was changed.
Shop remains PAY_NOW / commit:true with PayPal final confirmation and trusted current assessment;
Northstar remains CONTINUE / commit:false with server-priced quote, signed handoff and explicit
RiskPilot confirmation. Step 8.5 tests still verify omitted/forged checkoutSource cannot select weaker
validation, expired/stale/foreign-owned inputs cannot capture, and completed legacy recovery remains
idempotent. Mock-provider capture tests assert exactly one economic reserve and immutable snapshot.
No actual PayPal order or payment was initiated. All original acceptance ledger hashes are unchanged.

## AI and actual UI verification

Existing fact-ID grounding, persona/evidence freshness, deterministic fallback and bounded optional
AI deadlines remain intact. Money income evidence includes a required server-authored replacement
review fact when unsupported mappings exist. A no-key fallback test verifies the original-income
preservation explanation and current no-additional-goal-delay fact without changing finances.
No new live Gemini acceptance is claimed.

Actual rendered screenshots were inspected for Dashboard before/after, Goals before/after, Money's
unsupported replacement status, Shop purchase impact, Northstar review, saved simulation success and
Vision at measured **375, 390, 768 and 1280px**: 36 primary viewport checks. Three additional checks
cover supported income and shopping preview (39 total). All measured scroll widths are within client
widths. Contact sheets and original JPGs were inspected, including the full before/after goal pair.
The in-app browser's viewport override did not affect these new tabs; no mobile claim is based on
those attempts. Connected Chrome supplied the measured responsive evidence. Overrides were reset.

Rendered unsupported status shows original Paycheck still modeled and proposal Needs review;
compatible status shows original replaced and proposal included with unchanged baseline metrics.
The budget preview renders $1,720 → $1,738 and $1,540 → $1,572, with $90 → $122 capacity. Dashboard
and Goals render the same March 14 Japan Trip estimate before/after the isolated saved $900 simulation.
Saved success shows unchanged investing ETA but first-month allocation $192 → $12. Review retains
its explicit confirmation action and cash-risk facts. These payment outcomes are **simulation fixtures**,
not new Sandbox acceptance. Real PAY_NOW/CONTINUE behavior is verified by source and provider mocks.
Vision remains standalone; its Dashboard link restores normal product navigation. No layout redesign,
new routes or horizontal-overflow defect was found. The screenshot logs report no browser errors.

## Documentation and changed historical assertions

README, RUNNING, FORECAST_INTEGRATION, CATEGORY_SPENDING_MODEL, MONEY_PLANNING, MONEY_WHAT_IF,
IMPLEMENTATION_STATUS and the authoritative STEP7B_DEMO_REHEARSAL now identify the supported-income
boundary and shared cash-funded goal model. The rehearsal preserves its under-three-minute target,
Vision closing frame, contingency and off-camera login/MFA preparation. It narrates actual budget-
adjusted projections rather than the now-obsolete Japan Trip delay. STEP85_RESULT gains a historical
notice; the prior audit and acceptance evidence are retained.

Tests that explicitly accepted −$2,608 after unsupported recurrence now require unchanged salary and
Needs review. The existing supported-replacement integration fixture uses aligned biweekly dates;
calendar month-end expansion remains tested as genuinely additional income. Full-price/extension/UI
assertions that encoded the old 30-day or three-goal preview delay now assert the coherent cash-funded
result, with comments explaining why. Installment-specific future contribution assertions remain.
No unrelated safety assertion was relaxed and no production figure was hard-coded.

## Tests, build and committed-source reproducibility

- Previous baseline: **289 passed, 0 failed**.
- New total: **313 passed, 0 failed** (24 new tests/subtests in `submission-consistency.test.ts`).
- Pre-fix targeted run: 14 failures / 5 passes, including all required financial inconsistencies.
- New targeted suite after correction: **24 passed, 0 failed**.
- Full suite, TypeScript, production build and `git diff --check` pass.
- A fresh archive of the final local commit passes `npm ci`, typecheck, all tests and production build.
- Original/acceptance ledger SHA-256 comparison passes for four files; no workspace reset or migration.
- The existing dependency advisories remain the documented Step 8.5 limitation; no dependency changes.
- Private evidence is in `../artifacts/step-8.6/`: pre/post probes, exact JSON financial tables,
  full/targeted/clean-build logs, 39 measured browser checks, screenshots/contact sheets and ledger hashes.
  Those are excluded from the source commit and are not runtime dependencies.

## Remaining limitations and verdict

Both required inconsistencies are resolved under the existing fictional MVP model; no unresolved
financial-equivalence blocker was found in these tests. Arbitrary salary-date/frequency changes are
not supported authoritative replacements: the UI explicitly keeps original income until a supported
mapping exists. Relative fixture schedules re-anchor to the financial date; pin DEMO_TODAY for rechecks.
Goal dates remain estimates from a coarse 30.4-day model, not guaranteed completion dates.

Accepted limits remain fictional histories, local workspace cookies without production authentication,
no bank reconciliation/full refund accounting, unaccepted public webhook delivery and physical-device
payments, educational installment simulations, previously documented dependency advisories, and a
future Vision concept rather than an official PayPal native integration. Historical actual Sandbox
achievements remain valid as historical evidence; this step performed no new actual payment.

**Final verdict: Ready for targeted independent Claude recheck.** Step 9 and publication remain
unperformed and require explicit approval. Stop here.

## Exact files modified and reasons

All paths are relative to `RiskPilot/`:

| Path | Reason |
| --- | --- |
| `README.md` | Current contract, corrected example, verification count and result link. |
| `RUNNING.md` | Current policy link and budget-adjusted demo values. |
| `app/components/IncomePlan.tsx` | Clarify supported mapping and draft/confirmed status in existing UI. |
| `app/components/PurchaseImpact.tsx` | Label goal effect as an estimate. |
| `app/page.tsx` | Label post-purchase estimates as updated goal projection. |
| `docs/CATEGORY_SPENDING_MODEL.md` | Point historical description to current correction. |
| `docs/FORECAST_INTEGRATION.md` | Document shared financial treatment and replacement guard. |
| `docs/IMPLEMENTATION_STATUS.md` | Record this corrective phase and independent-recheck gate. |
| `docs/MONEY_PLANNING.md` | Point historical planning policy to current supported scope. |
| `docs/MONEY_WHAT_IF.md` | Point previews/explanations to the current financial contract. |
| `docs/STEP7B_DEMO_REHEARSAL.md` | Corrected narration and goal examples; preserve timing and payment limits. |
| `docs/STEP85_RESULT.md` | Mark partial prior income/goal policy as historical. |
| `docs/STEP86_RESULT.md` | Complete reproduction, correction, verification and freeze report. |
| `lib/engine/goals.ts` | Add shared economic-state adapter; preserve existing allocator and overlap protection. |
| `lib/engine/options.ts` | Use the shared model for baseline and every purchase scenario. |
| `lib/engine/purchaseTiming.ts` | Use the same model for read-only future-date scenarios. |
| `lib/planning/effectiveIncome.ts` | Require matching next effective receipt for supported cadence. |
| `lib/planning/incomeService.ts` | Describe supported replacements and retained original income. |
| `lib/planning/insights.ts` | Ground unsupported replacement explanation in server-owned facts. |
| `lib/planning/integration.ts` | Guard eligibility before suppressing original modeled income. |
| `lib/planning/overview.ts` | Exclude unsupported replacements from informational income totals. |
| `lib/state.ts` | Use shared authoritative/capped projections; invalidate prior financial policy assessments. |
| `tests/decision-ui.test.ts` | Regression expectations updated only where the prior income/goal contract was defective. |
| `tests/engine.test.ts` | Regression expectations updated only where the prior income/goal contract was defective. |
| `tests/extension.test.ts` | Regression expectations updated only where the prior income/goal contract was defective. |
| `tests/final-remediation.test.ts` | Regression expectations updated only where the prior income/goal contract was defective. |
| `tests/planning-integration.test.ts` | Regression expectations updated only where the prior income/goal contract was defective. |
| `tests/submission-consistency.test.ts` | 24 focused income, economic-equivalence, API/mock-provider, reference and grounding tests/subtests. |
