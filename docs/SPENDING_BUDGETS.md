# Step 3: spending-budget assumptions

Current follow-up: [Step 7A.2 category model](CATEGORY_SPENDING_MODEL.md) enables explicit, coverage-verified Alex category replacement. Unmapped/legacy budgets retain the planning-only behavior documented below.

Historical implementation checkpoint: [Step 5](FORECAST_INTEGRATION.md) now adds explicit income forecast mapping. Category budgets remain planning only; the isolation statements below describe their original step.

Money (`/money`) replaces the previous planning introduction with a compact monthly budget review.
Dashboard retains historical Spending Intelligence and links to `/money#spending-plan`.
This step does not implement a three-month forecast or integrate budgets into financial commitments.

## Historical evidence and suggestions

`lib/planning/budget.ts` reuses `analyzeSpending`, `normalizeTransactions` and recurring detection.
Category averages use fully covered, actually observed calendar months. Missing months and the
current partial month are not manufactured as full months. An observed category contributes zero
in another observed complete month where it has no spending; a category observed only in partial
months has insufficient history. Refunds reduce spending in their posting month using the original
category where supported. Duplicates, transfers, card repayments, pending items and reversals use
existing exclusions. Negative net historical averages remain visible; suggestions floor them at zero.
All authoritative amounts are integer USD cents. No Gemini calculation or second ledger is used.

Housing/utilities, subscriptions, linked scheduled bills and detected/hinted recurring services are
flagged for review. These flags do not establish future deduplication and never subtract an invented
amount. Exact mapping against scheduled commitments and everyday spending remains Step 5 work.

## Persistence and explicit confirmation

Optional `PersonaState.planningBudget` uses the existing atomic JSON store. Its schema version,
write version and saved-state epoch protect updates; a hash of current evidence rejects stale history.
`GET /api/planning-budget` derives suggestions without saving or confirming them. `PATCH` accepts
only a category, explicit edit/confirm/revert action, current version/epoch/evidence hash and a bounded
nonnegative integer-cent amount where applicable. Ownership comes from current workspace/account
cookies, never a request-body owner ID. Existing records without planning state remain supported.

Rows distinguish current historical average, proposed amount, unconfirmed draft and confirmed budget.
Saving a draft never changes the previous confirmation. Revert removes only an unconfirmed draft;
confirm stores an explicit amount, timestamp and a snapshot of source/observation/overlap evidence.
Confirmed amounts and their original evidence stay fixed when new suggestions appear. `updatedAt`
is null for an unsaved suggestion and populated on mutation. Normal navigation/reload preserves state.
Existing demo reset drops optional planning state and preserves its existing payment-record safeguards.

No authoritative engine, snapshot, financial-input hash, goals, purchase assessment, API payment
contract or PayPal creation/capture logic consumes these budgets in this step.

## Validation

177 automated tests pass, including 19 budget tests/subtests covering averaging, partial and missing
history, refunds, exclusions, validation, explicit confirmation, revert, stale writes, persistence,
workspace/account isolation, isolated reset, existing reset protection, HTTP errors and unchanged
financial snapshots/input hashes/purchase scenarios. Type check and production build pass.

Chrome rendering and screenshots were inspected at 375, 390, 768 and 1280px. Browser checks cover
save/reload, confirmation, preservation of an earlier confirmation, revert, source disclosure,
stale-tab rejection, separate-browser isolation and the Dashboard link. The readiness hero retains
its prior dimensions; financial snapshots remain equal after writes. No horizontal overflow was
detected. Reset tests use temporary stores; no existing demo workspace was reset and no payment
was initiated. Physical-device verification and future forecast integration are outside this step.
