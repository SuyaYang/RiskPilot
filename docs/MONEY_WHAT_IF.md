# Step 6 — budget What-if and evidence-grounded Money explanations

**Current correction:** [Step 8.6](STEP86_RESULT.md) restricts replacements to supported timing,
preserves original income for unsupported schedules, and unifies hypothetical/completed goal projections.
[Step 8.5](STEP85_RESULT.md) retains the security, budget no-op and settlement corrections.
Historical counts and policy descriptions below describe their original checkpoints.


Current follow-up: [Step 7A.2 category model](CATEGORY_SPENDING_MODEL.md) enables explicit, coverage-verified Alex category replacement. Unmapped/legacy budgets retain the planning-only behavior documented below.

## Spending-replacement investigation

The source audit still finds only `Persona.dailySpend`, an unclassified aggregate scalar. No baseline
coverage manifest says which categories, accounts, services or consumption periods it represents.
Historical transaction categories demonstrate observations, not equivalence to that scalar or complete
future expense coverage. Scheduled rent, utilities/subscriptions, card repayments and capture reserves
also remain separate model inputs. Confirming every observed category cannot prove that all required
expenses are represented or that those separate inputs have been removed from the budget amounts.

Therefore no full or partial authoritative budget replacement is enabled. Preview returns
`replacement.supported: false` and `requiredCoverage: "unknown"`. Unsupported mapping fields are
rejected; no percentage is guessed, daily assumption replaced, bill deleted or reserve duplicated.
A source-backed coverage contract and explicit confirmation would be prerequisites to future support.

## What-if behavior

The Money page adds a collapsed What-if disclosure within its existing planning section. A user selects
an existing category and enters an adjusted monthly USD amount. The original is the current confirmed
budget, if present, otherwise the system proposal. An unconfirmed saved draft is not silently treated
as the original confirmed plan. Missing originals remain unavailable rather than becoming invented zero.

`POST /api/planning-budget/preview` validates category, integer cents, current budget version/epoch,
historical basis and financial input hash. It reads the current store, budget suggestions and authoritative
snapshot without mutating them. It returns:

- Original amount/source, adjusted monthly amount, and adjusted-minus-original difference in cents.
- Three illustrative calendar-month estimates using the existing current-month-remainder period.
  Each original/adjusted monthly amount is separately prorated and rounded to integer cents for the
  remaining days; the difference subtracts those two rounded estimates. Full months use full amounts.
- Current authoritative minimum/stress/buffer/capacity facts, with forecast changed=false and allocation
  difference=0. No improvement in cash, goal timing or investment capacity is fabricated.
- Historical source/observation period, unsupported coverage reason and confirmation tokens.

These are budget assumptions, not predicted transaction dates or guaranteed savings. Revert is local:
it clears the preview and restores the original input, leaving saved drafts/confirmations untouched.
Confirm explicitly calls the existing budget PATCH endpoint and saves a planning-only confirmation.
The preview's financial hash is rechecked inside the atomic write along with existing budget versions.
Stale history, budgets or material financial changes require refresh instead of overwriting a newer plan.

The existing Spending Plan editor is reused. A lightweight `rp:budget` UI notification keeps its values
and the What-if baseline synchronized; it is not a financial invalidation or payment event. Informational
confirmations change the explanation evidence key but leave checkout input hashes and prior valid
purchase assessments intact. Income integration and its existing stale-payment checks are unchanged.

## Gemini and deterministic facts

A second collapsed disclosure offers Money-specific spending, income-timing, obligations and
buffer/capacity explanations. The What-if result also offers an explanation for the particular change.
No duplicate AI card is added to Dashboard or Checkout, and explanations run only on explicit request.

`POST /api/money-plan/insights` constructs three concise statements for the selected topic from existing
spending aggregation, dated planning events, scheduled commitments and the authoritative snapshot.
Each statement includes structured source, observation/forecast period and fact kind. Raw transaction
rows, account/workspace IDs and payment identifiers are not sent to Gemini.

The existing `explainReviewFacts` integration accepts only an ordering of required fact IDs. Model-authored
text, amounts and actions never reach the UI; unknown, duplicate or missing IDs use the deterministic
fallback. Missing credentials, provider errors, invalid responses or timeouts retain the same server-owned
facts. Money calls use a five-second timeout per attempt with one bounded retry; existing AI paths retain
their previous timeout default. The UI identifies AI versus deterministic output and exposes sources.

A planning explanation evidence hash covers the existing financial hash plus income and budget review
versions/epochs/history basis. It is UI freshness metadata, not a second financial version. The API
checks this key before generation and rereads it afterward; a planning edit during generation rejects
the stale response even when the checkout financial hash is unchanged. Preview explanations also
revalidate the selected amount/category and preview versions. Clients discard superseded responses.

## Validation

239 automated tests pass, including 20 new What-if/insight tests and subtests. Coverage includes preview
without mutations, reverted comparisons, explicit confirmation, partial/full-month cent arithmetic,
incomplete coverage, bill/daily-spend overlap, unsupported mappings, zero/invalid values, ownership,
provider fallback and deadline, required-ID grounding, stale evidence before/after generation,
forecast isolation and prior purchase-review validity. Existing checkout/idempotency tests still pass.
Type checking and production build pass. Tests use isolated stores and provider mocks.

Chrome rendering/screenshots were inspected at 375, 390, 768 and 1280px. Browser checks cover collapsed
defaults, unchanged readiness-hero dimensions, compare/revert/confirm, cross-editor synchronization,
source/partial-month details, stale-preview rejection and separate-browser isolation. No horizontal
overflow or browser errors were detected. Live Gemini returned valid fact selections for budget-change
and capacity explanations; deterministic fallback was separately verified with provider mocks.

No payment/order/capture/reset requests were made during browser verification; no existing workspace
was reset. Physical-device and actual PayPal Sandbox payment acceptance remain separate. The next
activity requires approval: final acceptance of both purchase flows, cancellation/recovery and demo
readiness. No acceptance payment or Vision page was implemented in Step 6.
