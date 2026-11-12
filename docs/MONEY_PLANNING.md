# Step 4 — expected income and three-month Money planning

**Current correction:** [Step 8.6](STEP86_RESULT.md) restricts replacements to supported timing,
preserves original income for unsupported schedules, and unifies hypothetical/completed goal projections.
[Step 8.5](STEP85_RESULT.md) retains the security, budget no-op and settlement corrections.
Historical counts and policy descriptions below describe their original checkpoints.


Current follow-up: [Step 7A.2 category model](CATEGORY_SPENDING_MODEL.md) enables explicit, coverage-verified Alex category replacement. Unmapped/legacy budgets retain the planning-only behavior documented below.

Historical implementation checkpoint: [Step 5](FORECAST_INTEGRATION.md) now adds explicit income forecast mapping. Category budgets remain planning only; the isolation statements below describe their original step.

Money keeps the existing readiness hero, cash protection/checks, Allocation Explorer and learning
accordions. A compact informational overview replaces the always-expanded budget section. One
“Adjust your plan” disclosure contains the income editor and the existing Step 3 Spending Plan;
Dashboard's `/money#spending-plan` link opens it. Budget categories are not rendered a second time.

## Period and calendar rules

The exact period runs from the app's current UTC/demo date through the last day of the second
following calendar month. The first month is labeled with its remaining days; the following two
are full calendar months. A date on the first gives three full months. `DEMO_TODAY` remains supported.

New income supports monthly, biweekly (14 days), every three calendar months and one-time schedules.
Monthly/calendar-quarter recurrence anchors to the original next-payment day and clamps in shorter
months: January 31 → February 28/29 → March 31; quarterly October 31 → January 31 → April 30.
Clamping does not permanently shift the anchor. One-time income is never repeated. The timeline
lists dated expectations; a $1,500 quarterly allowance contributes $1,500 on its expected date,
not $500 in each month. No monthly averaging substitutes for receipt timing.

Existing modeled income and expenses are derived once from the persona's current recurring items,
using the existing engine's `occurrences` function. Their existing 30-day “monthly” cadence is retained
and disclosed, rather than silently changing authoritative schedules to calendar months. This is a
known difference between legacy modeled events and new calendar-based income planning.

## Persistence, confirmation and overlap

Optional `PersonaState.planningIncome` uses the existing JSON store and atomic update lock; no new
ledger, banking system or balance is introduced. Schema version 1 stores a write version, epoch and
entries keyed by stable server-generated UUIDs. Each entry has name, integer USD cents, frequency,
next expected date, draft/confirmed/paused status, user-entered/hypothetical source type, reliability,
created/updated/confirmed timestamps and an entry version. Existing modeled sources are derived,
read-only facts from demo configuration; no observation/creation timestamp is invented for them.

`GET /api/money-plan` returns income controls and the derived overview from a consistent store read.
`PATCH` supports create, edit, confirm, pause and remove. Ownership comes from workspace/account
cookies. Requests require the current write version, epoch and a planning-only basis hash covering
owner/date/modeled schedules. This hash is separate from checkout's financial input hash. Income
editing clears confirmation, pause excludes occurrences, and confirmation/resume is explicit.
Past next dates must be reviewed before reconfirmation. Removal deletes only that planning entry.

Validation rejects unsupported fields, frequencies, currency, invalid dates, negative/fractional
cents, prototype/inherited entry IDs, forged owner/confirmation fields and stale writes. Amounts
are bounded to $1,000,000 and next dates to five years; at most 20 additional sources are supported.
Hypothetical sources must remain uncertain. No detected or suggested source is automatically confirmed.
Reset uses existing persona-reset behavior to clear optional state; existing payment-record protections
are unchanged. Existing personas and their finances are not reseeded or overwritten.

Known modeled income is not copied into planning entries. Same normalized names, or equal amounts
on a shared expected date, flag potential overlap against modeled sources and other active planning
entries. Such entries remain visible but excluded from the primary income total, even if confirmed.
This conservative rule may flag distinct real-world sources; exact reconciliation belongs to Step 5.
Unconfirmed, uncertain and hypothetical income is also excluded; paused entries generate no events.
Confirmation records an expectation, not a guaranteed receipt or cash available today.

## Expense estimates and financial boundary

The overview separates expected income, scheduled expenses, the existing daily-spending model and
future recorded purchase reserves. Already-reserved past/today purchase payments are not added again.
Modeled outgoings are their partial estimated sum; this is not a complete future spending forecast.
Confirmed monthly category budgets are a separate component. The current-month budget estimate is
prorated by remaining calendar days using integer-cent rounding; later months use the confirmed
monthly amount. Historical suggestions and unconfirmed drafts are never treated as future payments.

No combined budget-plus-bills total is returned (`combinedOutgoingCents: null`). Scheduled-item IDs
provide explicit overlap references; possible overlap with daily spending remains unresolved for
all confirmed categories. No guessed subtraction is made. The displayed income-minus-modeled-outgoing
difference is labeled partial, excludes budget reconciliation/goals/unmodeled costs, and is never
called safe-to-spend, investable, or an account balance.

The 45-day engine, allocation capacity, buffers, goals, purchase assessments, checkout input hashes,
merchant integration and PayPal creation/capture code do not consume planning income or budgets.

## Validation

202 automated tests pass, including 25 new tests/subtests for recurrence, calendar/leap/year boundaries,
partial months, dated quarterly totals, confirmation/edit/pause/remove, invalid inputs, stale writes,
overlap, persona isolation, persistence, isolated deterministic reset and unchanged snapshots,
financial input hashes, goal/capacity data, purchase scenarios and payment ledgers. Type checking and
production build pass. Reset tests use temporary stores; no existing demo workspace was reset.

Chrome browser rendering and screenshots were inspected at 375, 390, 768 and 1280px. Interaction
checks cover draft/reload, confirmation, editing/reconfirmation, pause/resume/remove, budget editor
reuse and summary refresh, potential duplicate exclusion, stale-tab rejection, separate-browser
isolation and the Dashboard deep link. No horizontal overflow or browser errors were detected;
readiness hero dimensions and authoritative snapshots remain unchanged. No PayPal payment was
initiated or confirmed. Physical-device acceptance remains separate.

Step 5 is not implemented: mapping, deduplication, reliability treatment, input-hash invalidation,
checkout reassessment and any authoritative forecast integration require separate approval.
