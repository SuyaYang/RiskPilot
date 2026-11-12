# Phase 3 — Spending Intelligence MVP

Implemented November 10, 2026. This is a compact historical-analysis section inside the existing
Dashboard, not a bank-linking application or a second expense ledger.

## Infrastructure audit and selected mode

There was no working Plaid adapter, Link flow, transaction sync/cursor store or recurring endpoint in
the repository. The local configuration has neither a Plaid client ID nor a Plaid secret. As allowed
by the Phase 3 request, the MVP therefore uses **deterministic local Sandbox-style fixtures**.
It does not call Plaid, access PayPal buyer spending history, request new financial permissions, or
represent fixture data as a connected bank. Both the API and UI identify the simulated source.

Existing TypeScript forecasts, the JSON workspace/persona store, scheduled manual bills, capture
ledger and immutable before/after snapshots are retained. No financial formulas or payment logic
were changed in this phase. Existing `.env`, goals, balances and payment records were preserved.

## Experience

The Dashboard section provides:

- Average monthly net spending over fully covered months; the last full month's total and change.
- A small month-by-month bar chart. The current partial month is dashed and marked **Partial**;
  it is excluded from complete-month averages and month-over-month comparisons.
- Category totals over the **entire displayed coverage period**, using compact horizontal bars.
  Category detail opens by default on desktop and is expandable on mobile.
- An expandable recurring list with merchant, typical amount, weekly/biweekly/monthly frequency,
  estimated next date, evidence quality, and suggested/confirmed/rejected review status.
- **Confirm**, **Edit**, and **Not recurring** controls. Edits preserve original detection evidence.
  Saves update the list in place, preserve disclosure state, and support cent-precise amounts and
  optional estimated dates. Invalid amounts produce a message inside the editor.
- Rejected patterns remain available in a separate disclosure and can be confirmed again.

No new Dashboard hero, separate navigation destination, large pie chart or new dependency was added.

## Observations, commitments and predictions

**Historical transactions** are typed fictional observations with an owner, stable ID, account, date,
USD integer cents, status, kind, and optional category/reference metadata. They are generated on read;
they do not create cash-flow commitments or reconstruct the manual checking balance.

**Existing commitments** remain the existing `Persona.recurring` schedules and verified purchase
reserves. Historical entries for known manual bills carry explicit fixture schedule IDs, allowing the
UI to show the existing bill's amount/date without adding it a second time. This is an exact fixture
reference, not a guess based on matching a merchant name and amount.

**Detected recurring candidates and user edits remain informational.** The existing app has no reliable
observed-debit/capture matching layer. Under the Phase 3 fallback rule, confirmation saves a reviewed
pattern, not a new authoritative forecast obligation. The UI states this before the controls and in
each row's forecast-treatment disclosure. An edited rent estimate does not replace the manual rent
bill. Unmatched Internet, streaming or membership candidates are not inserted into protected cash.

This deliberately prevents double counting a known bill, an already reflected historical debit, a
verified PayPal reserve, or everyday spending. Spending averages are never inserted as guaranteed
future obligations. The purchase-impact review continues to use existing recurring commitments via
the same engine. Confirming/editing/rejecting a pattern does not change its financial input hash,
because no forecast input changes. Future authoritative schedule editing requires explicit financial
versioning and reliable matching before being enabled.

## Calculation rules

All transaction amounts, category totals, monthly totals, refunds and saved edits use **integer USD
cents**. Rounded averages and percentage basis points use integer/BigInt ratios. Formatting does not
feed rounded display values back into calculations. Decimal input is parsed as whole dollars and
cent digits; exponent notation and more than two decimal places are rejected.

- Deduplicate within owner/source/account/transaction ID. Conflicting posted duplicates are excluded;
  a posted replacement supersedes its pending reference, and removed/reversed updates win.
- Exclude pending records, internal transfers (both legs), credit-card repayments and income.
  Individual card purchases remain expenses, so paying the card does not repeat those purchases.
- Exclude reversal records and their explicitly linked original debits.
- Refund credits reduce net spending in their **posting month**. A linked original supplies the
  category when reliable; unmatched uncategorized refunds remain Uncategorized. Net spending may
  legitimately be negative when current-period refunds exceed current-period purchases.
- Future records cannot reverse history outside the declared coverage cutoff.
- Categories come from explicit fixture metadata. Unknown categories stay Uncategorized; merchant
  names are not used to invent specific spending categories.
- Show only months containing actual valid posted records. Do not synthesize missing months as $0.
  Coverage completeness comes from the supplied fixture coverage, not the first/last purchase date.
- Compare only consecutive, fully covered calendar months. A zero/negative comparison denominator
  has no percentage change; partial or absent months have no fabricated percentage.

## Recurring detector

The deterministic detector groups normalized merchant names within the same account and owner.
It uses positive posted expenses with a service hint (housing, utility, subscription, membership or
insurance). Dining, shopping and entertainment are explicitly excluded from detection, even when
frequent. Fully refunded and reversed charges do not provide recurring evidence.

A candidate needs at least three observations; weekly requires four. All observed gaps must fit:

| Frequency | Evidence rule |
| --- | --- |
| Weekly | 6–8 days between every observation |
| Biweekly | 12–16 days between every observation |
| Monthly | Consecutive calendar months, within 3 day-of-month positions, including month-end clamping |

Typical amount is the median observed integer amount. Variation must stay within the greater of
$1 or 10% of the median. Consistency within the greater of $0.25 or 5% yields stronger evidence;
other accepted patterns show **Uncertain pattern** / limited quality. These are pattern-quality labels,
not probabilities, bank confirmations or proof of a contract.

The next date is one estimated period after the last observed transaction. Monthly end-of-month dates
are preserved where supported. If that estimate is already past and newer observations are missing,
the date is unavailable; the detector does not silently skip missed occurrences into a future month.
User-entered dates are explicitly estimates, never payment scheduling instructions.

## Data and API contracts

- `lib/spending/types.ts`: canonical fictional observation, coverage, category and review contracts.
- `fixtures.ts`: three preceding calendar months plus the current month through yesterday, relative
  to the existing UTC demo clock. Includes income, manual bills, utilities, food, transport, service
  memberships, shopping, unknown category, card purchases/repayments, transfers, refunds, reversals,
  duplicates and pending examples. Persona amounts and service patterns vary.
- `analysis.ts`: normalization, cent-based totals, complete-month coverage and category aggregation.
- `recurring.ts`: deterministic recurrence and evidence; candidate IDs include the full owner scope.
- `service.ts`: stored review overlays and optimistic version checks in the existing atomic store.
- `GET /api/spending`: current workspace/persona analysis, source/coverage, candidates and version.
- `PATCH /api/spending/recurring/:id`: `action`, current `version`, current `asOf`, and validated edit
  fields (`merchant`, `amountCents`, `frequency`, `nextDate`). Returns the updated view and explicitly
  `forecastChanged: false`. Stale versions/date, foreign candidates and invalid edits are rejected.

Only optional `PersonaState.spending` review preferences are persisted in the existing v2 store.
There is no new transaction/expense ledger. Older v2 workspaces need no destructive migration.
Demo reset replaces that persona's state, removing reviews and restoring reproducible analysis;
other personas/workspaces and verified capture protections are unchanged. Reset still refuses a
workspace with real Sandbox orders or uncertain real provider commands. Use a fresh demo workspace
for a fully resettable scenario. Production fixture endpoints require explicit demo opt-in.

## Deterministic demonstration

Run the existing app with `DEMO_SEED_ENABLED=true`; no Plaid configuration is needed. For a repeatable
recording, set `DEMO_TODAY=2026-11-10` before starting. In a fresh fictional workspace:

| Persona | Average of Aug–Oct 2026 | Detected candidates | Distinct example |
| --- | ---: | ---: | --- |
| Alex | $2,271.28 | 6 | Weekly transit pass and existing rent/phone |
| Sam | $2,880.57 | 5 | Weekly fitness plan and larger discretionary spending |
| Jordan | $2,414.28 | 6 | Biweekly coworking membership and insurance |

Coverage is Aug 1–Nov 9, 2026. November is partial. Alex's monthly net totals are $2,276.78,
$2,273.98 and $2,263.08; partial November is $84.75. Full-coverage category totals sum to $6,898.59,
exactly matching analyzed net spending. The three-full-month average is $2,271.28.

Expand recurring expenses, confirm a pattern, edit its estimate, and inspect **Evidence & forecast
treatment**. For example, editing Rent to $1,610.25 on Nov 16 preserves the existing forecast bill of
$1,600 on Nov 15. Mark another pattern Not recurring, switch persona and return to verify isolation.
Reset a simulation-only workspace to return all reviews to Suggested without changing fixture totals.

## Validation and limits

- **112 automated tests pass**, including all existing checkout/recovery/merchant tests.
- TypeScript and production build pass; `git diff --check` passes.
- New tests cover category sums, refund posting/category handling, duplicate/conflicting IDs,
  internal transfers, card repayment exclusion, pending/posted replacement, reversals, incomplete
  history, missing months, weekly/biweekly/monthly and month-end detection, insufficient evidence,
  discretionary merchants, refunds of recurring charges, cent input, persona ownership, versioned
  confirmation/edit/rejection, reset and unchanged capture snapshots/financial input hashes.
- Actual HTTP checks against an isolated production server verified confirm → edit → reject → reset,
  same-workspace persona isolation, category/month totals, and an unchanged full financial snapshot.
  The server used `/tmp/riskpilot-phase3-browser.json` with all external credentials disabled.
- Browser checks verified trend/category rendering, mobile editor focus, cent validation, native date
  input, in-place saves, confirmed/suggested/uncertain distinctions, rejection history, and persona
  switching/persistence. The native Reset dialog required user confirmation; after confirmation,
  the browser showed zero confirmed patterns, six suggestions and unchanged historical totals.
- Final browser rendering at measured CSS widths **375, 390, 768 and 1280px** had no page-level
  horizontal overflow. All four monthly bars share the same baseline. Recurring action buttons
  measured 44px tall on mobile. Desktop/mobile screenshots were saved in the parent workspace as
  `phase3-spending-desktop.jpg` and `phase3-spending-mobile.jpg`.
- No Plaid API/Link or recurring-provider endpoint was exercised, and no new PayPal capture was made.
  Authoritative new bill insertion, debit/capture matching, real bank reconciliation and production
  bank linking remain outside this explicitly informational fixture MVP.
