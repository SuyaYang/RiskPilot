# Step 7A.2 — explicit fictional category spending coverage

## Provenance, migration and compatibility

Alex's legacy assumption is exactly **$20.00/day (2,000 cents)**. `alex-everyday-v1`
is a newly declared fictional planning model, not a reconstruction of that scalar or
verified bank/card transaction evidence. Historical statistics still supply suggestions
independently. The declaration partitions the exact same daily amount:

| Stable category ID | Daily cents | Declared future coverage | Override eligibility |
| --- | ---: | --- | --- |
| food-and-dining | 1000 | New groceries/dining consumption; excludes scheduled obligations and existing debt | Eligible |
| transportation | 400 | Incidental transport; excludes transit memberships | Planning only: observed category also contains a recurring transit pass |
| shopping | 300 | New discretionary goods; excludes existing debt, scheduled obligations and PayPal reserves | Eligible |
| entertainment | 100 | One-off leisure; excludes subscriptions/memberships | Eligible |
| other | 200 | Residual incidental household/personal consumables; excludes housing, utilities, insurance, tuition, debt, subscriptions and reserves | Not replaceable by a broad Other/Uncategorized budget |
| **Total** | **2000** | Separate from every scheduled bill and recorded reserve | |

`PersonaState.spendingBaseline.modelVersion` opts a workspace into this declaration.
New Alex workspaces have the marker. Existing workspaces without it retain the legacy
aggregate until the user explicitly chooses **Enable Alex category model** in What-if.
This opt-in changes neither daily balances nor the financial hash, does not activate old
budget confirmations, and preserves goals, purchases and other account data in place.
Sam/Jordan, unknown model versions, changed aggregate totals or unknown scheduled-outflow
IDs retain the legacy fallback. No existing workspace is reset/reseeded by this upgrade.

The model covers *new everyday consumption*. Alex's separately scheduled card payment
represents existing debt, not a second copy of this future consumption. Rent, phone,
subscriptions, insurance, education, debt and all purchase reserves are explicitly outside
category coverage. Recurring-service/bill overlap vetoes override eligibility. Health,
housing/utilities, subscriptions and uncategorized budgets lack a matching safe baseline.
No fuzzy matching, inferred exclusion, proportional deduction or full-budget replacement
is used. Coverage is rechecked when compiling active assumptions; failed verification
restores the category's known baseline instead of keeping an unverifiable override.

## Confirmation, activation, versions and persistence

Historical average → suggestion → saved draft → planning confirmation are distinct from
an **applied** category assumption. Old confirmations never activate automatically.
`BudgetEntry.applied` holds the last explicit amount, effective date, application timestamp,
model version and coverage signature. Drafts and later planning-only confirmations retain
the prior applied copy. The What-if action **Apply to money plan** is the authoritative
activation. **Restore category baseline** withdraws it explicitly from the Spending Plan
editor while preserving the planning confirmation.

The existing atomic store lock validates owner-scoped budget version/epoch/history/model
basis and the financial-input hash inside the write. Unknown fields, client-supplied
ownership/model/timing, unsupported coverage and stale inputs reject without publication.
Enable-model and restore actions also require financial freshness. Material application
updates the shared financial hash and atomically saves `moneyPlanSnapshot` with the new
forecast/allocation/readiness. Existing captured purchase snapshots remain immutable.
Every page still recomputes from current inputs; the saved plan snapshot is audit evidence,
not an alternative calculation path or a stale source for later reads.

## Timing, partial months and cent precision

Unchanged categories retain their exact legacy daily debit. For an applied monthly amount
M cents and calendar length D, each day receives floor(M/D) cents; the first M mod D days
receive one extra cent. Full 28/29/30/31-day months therefore sum exactly to M, without
rounding drift. Application takes effect on today's app UTC/demo date, including today;
only days on/after that date enter future projections. Past days and historical MTD debits
are never imported/recharged and current checking/starting balance does not increase.
For example, applying 10,001 cents on November 11 charges 6,661 cents for the remaining
20 days, not the full monthly amount. The earlier 10 days are not rescheduled.
Reapplying the same amount retains its existing effective date and financial hash.

The shared simulator applies the same spending in normal and seven-day income-delay
stress. Planning income remains omitted from stress. The visible forecast remains 45 days;
pre-existing evaluation extensions for longer purchase schedules remain unchanged.
The existing goal allocator retains its 30.4-day monthly approximation for unchanged
categories and substitutes an applied category's monthly amount only. It is not a new
calendar-based goal engine. Conservative income/current-cash/stress/goal/reserve capacity
checks remain intact; a monthly reduction is never copied into available-to-allocate.

## Preview, overview and AI

Covered What-if comparisons start from the *authoritative category assumption*, not an
unapplied historical suggestion/confirmation. An unchanged daily baseline is displayed at
its current calendar-month equivalent; future months may differ in length. The scenario
uses an in-memory copy of only the selected persona and the same `snapshot`/forecast/goal/
capacity functions. Merely previewing or reverting changes no stored field, hash or payment
assessment. It returns current/scenario minima, buffer checks, delayed-income minima and
capacity. Unsupported categories retain the prior illustrative planning-only comparison.

The three-month overview sums the same category/day policy. Applied categories are already
inside modeled outgoings and are not added again as confirmed budgets. Only unapplied
confirmations remain in the separate planning-budget estimate. Both the overview and its
income-minus-outgoings comparison remain incomplete informational planning views, never
safe-to-spend cash. The Step 7A cards/chart/month selector/hero/allocation layout is preserved.

Gemini can order only server-authored fact IDs. Engine results supply all current/scenario
amounts, coverage/application explanations and remaining failed checks. Existing fallback,
required-ID validation, timeout and before/after evidence freshness remain in force.

## Deterministic regression example and validation

Fixed app date **2026-11-10**, clean Alex workspace, food 30,000 → 15,000 cents/month:

| Engine fact | Before | After explicit application |
| --- | ---: | ---: |
| Lowest projected cash | $1,720.00 | $1,765.00 |
| Delayed-income minimum | $1,540.00 | $1,620.00 |
| Available to allocate | $90.00 | $170.00 |
| Buffer / stress / near-term goal checks | Pass / Pass / Pass | Pass / Pass / Pass |

Monthly difference is −$150.00, capacity difference is +$80.00. This example has no failed
checks. Separate regressions keep capacity at $0 when checks fail and preserve conservative
income caps. Migration alone keeps the original $1,720/$1,540/$90, green baseline risk,
red full-price laptop purchase risk and Pay-in-4 hypothetical recommendation unchanged.
This is engine output under fictional assumptions, not guaranteed savings or lending advice.

See the Step 7A.2 result and saved artifacts for final test counts and actual browser evidence.
Tests cover full daily migration equality/hash/options, legacy opt-in, eligibility/vetoes,
replacement, cent calendars/partial periods, drafts and explicit application, read-only
preview/revert, atomic saved snapshot, stale/forged writes, API cross-page consistency,
capacity safeguards, grounded fallback, reset isolation and both stale payment paths.
No payment endpoint implementation changed. Changing a budget creates/captures no order;
Shop creation/capture and merchant confirmation reject old hashes before provider calls.
Full existing idempotency/recovery regressions remain mandatory. Step 7B live Sandbox
acceptance, physical-device behavior and real bank reconciliation remain separate work.
