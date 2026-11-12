# Step 5 — financial-model audit and verified planning integration

**Current correction:** [Step 8.7](STEP87_RESULT.md) extends cash-funded goals to future and
installment payments. [Step 8.6](STEP86_RESULT.md) restricts replacements to supported timing,
preserves original income for unsupported schedules, and unifies hypothetical/completed goal projections.
[Step 8.5](STEP85_RESULT.md) retains the security, budget no-op and settlement corrections.
Historical counts and policy descriptions below describe their original checkpoints.


Current follow-up: [Step 7A.2 category model](CATEGORY_SPENDING_MODEL.md) enables explicit, coverage-verified Alex category replacement. Unmapped/legacy budgets retain the planning-only behavior documented below.

## Calculation path audited before implementation

- `state.personaWithState` combines the fixed demo persona, saved goals and recorded purchase
  payments. Step 4 planning fields are not part of that persona or its checkout hash.
- `engine/forecast.startingBalance` deducts purchase reserves on/before today from manual checking.
  Its integer-cent simulator applies recurring items, baseline `dailySpend`, future recorded reserves
  and candidate purchase payments. Existing monthly items repeat every 30 days; biweekly every 14.
- `forecast` returns 45 daily balances and evaluates minimum/buffer risk over at least 45 days,
  extended only when existing/candidate payment schedules require it. Stress delays modeled income
  seven days. No bank ledger supplies an alternative authoritative balance.
- `engine/goals.allocateGoals` allocates existing monthly surplus by priority/deadline with buffer
  deficit and future purchase payments. It uses a 48-month internal goal funding simulation;
  this step does not replace it with a new planning engine.
- `investableNow` gates on normal/stress buffer and near-term goals, then caps allocation by current
  starting cash less buffer and projected headroom minus protected goal contributions.
- Shop `buildOptions`, merchant claim/review, Dashboard, Goals and Money all obtain the same persona
  through `personaWithState`. `inputHash` hashes persona, payment reserves, as-of date and policy.
- Decision writes reject changed hashes; order creation and both capture paths verify current hashes
  before paying. Review recomputes frozen amounts through the same engine. Capture keys, provider
  amount/currency/ownership checks and `recordCapture` maintain exactly one purchase/snapshot.
- Simulated historical transactions power spending analytics only. No bank-observation ledger feeds
  the forecast. This preserves a capture reserve when its counterpart is later observed; no second
  expense is imported from that historical record. Production bank reconciliation is unavailable.

## Mapping boundary

The existing daily-spend assumption has no category composition. Historical category totals are
not proof of its composition. No fraction can be safely subtracted for food, shopping or another
category, and rent/subscriptions already have scheduled bills. All category budgets therefore remain
informational with an explicit unresolved status. No artificial daily category expenses are added.
A future source-backed aggregate/category replacement is required before budget timing is eligible;
there is deliberately no cent distribution policy applied to unsupported mappings in this step.

New income requires explicit forecast mapping after confirmation: declare an additional distinct
source, or replace a specific existing income ID. Name/date/amount similarity is only a review veto,
never proof of replacement. Existing monthly cadence is preserved for every unreplaced item.

## Implemented rules and provenance

`compilePlanning` resolves only the last explicitly confirmed mapping for each eligible entry.
Unconfirmed drafts do not replace the active confirmed copy. Confirming an edit retains its previously
chosen relationship; choosing Planning only withdraws that relationship explicitly. Pause and remove
withdraw forecast use. Existing Step 4 confirmations are not automatically migrated into forecasts.

| Input | Authoritative handling |
| --- | --- |
| Additional distinct income, explicitly mapped and confirmed | Add dated integer-cent credits in the next 45 days after overlap vetoes |
| Replacement of an exact modeled income ID | Verify its saved schedule signature; suppress that ID once and use calendar credits instead |
| Uncertain/hypothetical/unconfirmed source | Exclude; keep known baseline |
| Similar name/amount/date or competing mappings | Needs review; similarity never proves equivalence |
| No receipt in 45 days for an additional source | Planning only; no material hash change |
| Food, shopping, transportation, health, entertainment, other/uncategorized category budget | Needs review: the daily baseline has no verified category partition |
| Housing/utilities or subscriptions budget | Needs review: scheduled bills also overlap; no second expense |
| Credit-card repayments and PayPal reserves | Preserve current scheduled repayments and exactly-once reserves; no historical spend imported |

New receipts are user-confirmed *plans*, not externally verified income or observed cash. Explicit
additional-source mapping is the user's declaration that it is distinct, subject to conservative
vetoes. Exact-ID replacement is verified against the server-owned source and stored signature.
Unreplaced legacy monthly income/expenses retain 30-day cadence. New monthly and quarterly schedules
use Step 4's calendar-day clamping; biweekly uses 14 days. One-time income is not repeated or smoothed.
The single existing simulator applies the compiled credits; there is no second forecast engine.

The stress case omits all new planning receipts entirely, while retaining the original seven-day
stress for unreplaced modeled income. Money and both purchase-review paths disclose this policy.
New income does not increase observed checking or `forecast.startBalance`. The existing current-cash
cap remains in force, with an additional ceiling from the same engine run without planning income.
Thus reduced goal reserves after replacement cannot manufacture new allocation capacity either. Planned credits are not annualized into long-term goal surplus; replaced modeled
income is removed from that surplus. The unchanged goal allocator still uses recomputed buffer
shortfalls and purchase schedules. This is conservative and can defer goals after a replacement.

## Financial versions, freshness and payments

The compiled effective plan is part of the existing persona input hash under policy
`verified-planning-v1`. Its sorted dated events and exact replacement IDs determine material changes;
write counters, draft edits, unresolved budgets and timestamps are not financial input versions.
Snapshots expose `financialInputHash`, also returned by Money and Goals APIs. Capture snapshots remain
immutable. No stored forecast cache exists to replace; APIs recompute from the current store.

Existing stale-decision, stale-review and in-lock capture guards now see material planning changes
through that same hash. Shop exploration creates no order; merchant review recomputes the frozen
quote. Old Shop creation and both capture-confirmation paths reject stale hashes. No capture,
merchant signing, ownership, amount/currency, recovery or idempotency code was changed.

Money refreshes its existing readiness API after a material mutation, retaining the editor's open
state. Dashboard renders the new series on load and exposes source notes in existing assumptions.
Cross-page API reads share one materialized persona; unrelated open browser tabs still require
refresh/navigation for display freshness, while server-side payment checks always use current state.

There is no live bank feed to reconcile. Historical observations remain read-only and cannot add a
second purchase obligation; current capture records remain exactly once. This is not evidence of a
production capture-to-bank matching service. Introducing observed-debit imports requires verified
provider identifiers/mapping before any reserve can be replaced, rather than date/amount guessing.

## Validation and limits

219 tests pass, including 17 new integration tests/subtests for all supported income frequencies,
calendar boundaries, explicit replacement, ambiguous budgets, cent precision, drafts, duplicates,
conservative capacity, current snapshot/hash/goal consistency, stale Shop and merchant reviews,
isolation, reset and deterministic capture idempotency. The original 202 tests remain passing.
Type check and production build pass. Tests use temporary stores and provider mocks.

Chrome screenshots/rendering were inspected at 375/390/768/1280px. Browser interactions verify explicit
mapping, immediate readiness refresh, open-editor retention, prior confirmation during a draft edit,
source/status labels, removal, unresolved budgets and fresh Shop exploration. No horizontal overflow
or browser errors were detected. No existing workspace was reset and no real PayPal capture was run.

Budget replacement is intentionally unresolved for every current category. No monthly budget is
converted into authoritative daily debits and no supported timing policy is falsely claimed.
Physical-device/provider acceptance and live bank reconciliation remain untested. Step 6 and Vision
are not implemented.

## Step 6 follow-up

The [What-if and explanation implementation](MONEY_WHAT_IF.md) re-investigates category coverage
and retains the unresolved baseline fallback. Monthly differences and illustrative proration are
read-only; category confirmation still does not change authoritative forecasts or payment hashes.
No full replacement is supported without a provable expense-coverage contract.

## Current shared financial contract (Steps 8.6–8.7)

Before suppressing an original modeled income, `compilePlanning` verifies the exact source signature
and `equivalentCadence`: biweekly recurrence and the same next effective receipt. Shifted, calendar-
monthly, quarterly and one-time replacements remain Needs review, do not create additional income,
and preserve original normal/stress/goal inputs. Only compatible lower/higher amounts are supported;
established stress and goal income are capped at the original amount. Additional income's independent
calendar recurrence and conservative allocation cap are unchanged. Supported schedules expand through
existing installment evaluation horizons; the displayed forecast remains 45 days.

Every production goal path now calls `engine/goals.projectGoals`. It combines existing reserves and
an optional in-memory candidate schedule, deducts on/before-today outflows from starting cash once,
and funds future outflows from existing safe cash headroom before passing residual obligations to
the existing monthly contribution allocator. Cash-buffer pressure
and independent pre-existing deficits retain the Step 8.5 overlap protection. This is the existing
cash-funded policy, not an allocation of excess checking to goals. Priorities, deadlines, saved goal
balances, 30.4-day funding buckets and 48-month goal evaluation remain unchanged.

`state.snapshot`, purchase options and after-income previews share that helper. Actual capture still
records one full-price reserve and one immutable snapshot. Future or installment scenarios differ in
schedule and need not match a full-price capture. Later valid changes recompute from inputs; no ETAs
are cached or copied into goal records. See the exact tables and regression evidence in Step 8.6.

Step 8.7 consumes headroom once in chronological payment order with cent rounding. The no-future-
payment baseline includes already-paid reserves, all scheduled bills and normal spending through the
last payment date (at least 45 days). A zero-value horizon marker uses the existing forecast extension;
it creates no expense. Headroom is the nonnegative minimum of that baseline buffer gap, current
starting cash less buffer, and the same-horizon baseline without planning income or uncertain modeled
receipts. Comparing both baselines preserves supported lower salaries and excludes proposed raises
and additional planned receipts from cash funding. It does not reserve future salary growth as cash.

Only uncovered future cents enter their original 30.4-day contribution bucket. Independent baseline
deficits remain a separate floor under the existing overlap rule. The full economic payment schedule
always remains in the normal/stress forecast, including the 361-day Pay Monthly evaluation; displayed
daily balances and no-schedule Dashboard forecasts remain 45 days. This is a bounded liquidity test
under existing fictional income/bill assumptions, not a guarantee of future receipts or goal dates.
`rp-v1-step87` invalidates assessments from the earlier allocation policy without changing capture
architecture, ownership, expiry, settlement, reserve idempotency or income replacement eligibility.
