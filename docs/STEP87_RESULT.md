# STEP 8.7 RESULT

**Completed: shared cash-funded purchase timing and goal allocation correction.**
This is a local freeze only. No actual PayPal order/capture, workspace reset, protected-ledger edit,
remote publication or Step 9 work occurred.

## Starting state and root cause

Verified branch `cynthia`, HEAD `98200a276f1a3622bd7a2b42b949629e039c9804`, clean working tree.
Read the Step 8.5/8.6 results, forecast integration, authoritative rehearsal, goal/forecast/options/
after-income implementations and relevant engine, timing and submission-consistency regressions.
Recorded SHA-256 hashes of the two local ledgers and two Step 7B acceptance runtime ledgers before
changes. Tests/probes used temporary isolated stores; payment tests used existing mock services.

`projectGoals` deducted immediate payments through `startingBalance`, protecting the remaining
buffer deficit, but sent every future payment's full amount to `allocateGoals`. Existing cash above
the buffer could fund today's purchase but was ignored for tomorrow's purchase. The resulting goal
penalty was unrelated to the better cash position of waiting. Forecast balances themselves were correct.

Exact reproduction on the untouched freeze, fixed **November 12, 2026**, $900 laptop. Goal dates below
are Japan Trip / Emergency Fund / Start investing, all in 2027:

| Workspace | Schedule | Normal / delayed-income minimum | Goal dates before correction | Current-month total allocation |
| --- | --- | --- | --- | ---: |
| Clean Alex | Today | $820 / $640 | Mar 14 / Apr 13 / Apr 13 | $462 |
| Clean Alex | Tomorrow | $820 / $640 | Apr 13 / Jun 13 / May 13 | $0 |
| Clean Alex | Nov 22 | $1,260 / $640 | Apr 13 / Jun 13 / May 13 | $0 |
| Clean Alex | Pay in 4 | $1,485 / $1,080 | Apr 13 / May 13 / May 13 | $192 |
| Clean Alex | Pay Monthly | $1,720 / $1,540 | Mar 14 / Apr 13 / May 13 | $558.63 |
| Shopping $90 → $30 | Today | $838 / $672 | Mar 14 / Apr 13 / Apr 13 | $541.20 |
| Shopping $90 → $30 | Tomorrow | $838 / $672 | Apr 13 / May 13 / May 13 | $0 |
| Shopping $90 → $30 | Nov 22 | $1,334.54 / $672 | Apr 13 / May 13 / May 13 | $0 |
| Shopping $90 → $30 | Pay in 4 | $1,513 / $1,122 | Mar 14 / May 13 / Apr 13 | $253.20 |
| Shopping $90 → $30 | Pay Monthly | $1,738 / $1,572 | Mar 14 / Apr 13 / Apr 13 | $619.83 |

## Narrow correction and candidate review

`projectGoals` retains the single existing allocator and the Step 8.6 immediate-payment handling.
On/before-today payments are included in `paid` and deducted once from starting checking. Later
payments remain in the full economic forecast. Only their uncovered residuals enter goal buckets:

1. Sort all existing/candidate future payments chronologically without mutating inputs. Stable date
   sorting keeps same-day payments deterministic; same-day splits share the same contribution bucket.
2. Forecast the baseline with only already-paid reserves, through the final scheduled payment date
   (at least 45 days). A zero-value payment marker invokes the existing horizon extension; it neither
   debits cash nor enters the allocation schedule.
3. Available headroom is the nonnegative minimum of that baseline's normal buffer gap, current
   starting cash minus buffer, and a same-horizon baseline with planning income removed and uncertain
   modeled income excluded. Comparing both baselines preserves supported lower replacements while
   preventing proposed raises/additional receipts from supplying headroom. Established modeled salary
   remains subject to existing forecast assumptions; no new income eligibility rule is introduced.
4. Consume headroom once, in payment order, rounding remaining headroom and residuals to cents.
   Charge only uncovered cents in each payment's original 30.4-day contribution bucket.
5. Preserve the independent baseline deficit as the allocator's explicit floor. The existing overlap
   rule protects buffer restoration without adding the same purchase cost twice. Deficits carry
   forward before goal funding; priorities, deadlines, goal balances and the 48-month model are unchanged.

Claude's basic approach is verified, with a bounded adjustment: `forecast(p, paid).bufferGap` alone
only evaluates 45 days and may include planned receipts. It is insufficient for all future schedules.
The full-schedule baseline and current/conservative cash caps avoid that assumption. A declining-cash
fixture has positive 45-day headroom but a genuine long-horizon deficit: it receives no cash subsidy,
and that independent deficit remains protected. No forecast engine, income guard or payment service
was rewritten. `forecast.ts` and income replacement calculations are unchanged.

For clean Alex, baseline headroom is $720. Tomorrow's $900 purchase therefore has $180 of residual
contribution burden, rather than $900. The immediate purchase retains its $180 buffer restoration.
Pay in 4's first $225 is already in cash; its remaining $675 consumes $495 headroom once, leaving
$180 in the later contribution bucket. Pay Monthly's $1,000.44 total consumes $720 headroom and
leaves $280.44 in later buckets. Cash is never also credited directly to goals. Timing can still
change completion dates when residual costs fall in different periods; tests demonstrate this.

The financial policy ID becomes `rp-v1-step87` to invalidate earlier assessments under changed goal
semantics. Unsupported planning-only income edits still leave the financial hash unchanged within
the policy. Freshness, expiry and capture guards retain their existing implementation.

## Corrected deterministic results

Same fixed date, price and untouched fixture values. Goal dates remain estimates, not guarantees.
Normal/stress minima and risk are unchanged by the allocation correction.

| Workspace | Schedule | Normal / delayed-income minimum | Risk | Japan / Emergency / investing dates | Current-month allocation |
| --- | --- | --- | --- | --- | ---: |
| Clean Alex | Baseline | $1,720 / $1,540 | green | Mar 14 / Apr 13 / Apr 13 | $642 |
| Clean Alex | Today | $820 / $640 | red | Mar 14 / Apr 13 / Apr 13 | $462 |
| Clean Alex | Tomorrow | $820 / $640 | red | Mar 14 / Apr 13 / Apr 13 | $462 |
| Clean Alex | Nov 22 | $1,260 / $640 | yellow | Mar 14 / Apr 13 / Apr 13 | $462 |
| Clean Alex | Pay in 4 | $1,485 / $1,080 | green | Mar 14 / Apr 13 / Apr 13 | $642 |
| Clean Alex | Pay Monthly | $1,720 / $1,540 | green | Mar 14 / Apr 13 / Apr 13 | $642 |
| Shopping $90 → $30 | Baseline | $1,738 / $1,572 | green | Mar 14 / Apr 13 / Mar 14 | $703.20 |
| Shopping $90 → $30 | Today | $838 / $672 | red | Mar 14 / Apr 13 / Apr 13 | $541.20 |
| Shopping $90 → $30 | Tomorrow | $838 / $672 | red | Mar 14 / Apr 13 / Apr 13 | $541.20 |
| Shopping $90 → $30 | Nov 22 | $1,334.54 / $672 | yellow | Mar 14 / Apr 13 / Apr 13 | $541.20 |
| Shopping $90 → $30 | Pay in 4 | $1,513 / $1,122 | green | Mar 14 / Apr 13 / Apr 13 | $703.20 |
| Shopping $90 → $30 | Pay Monthly | $1,738 / $1,572 | green | Mar 14 / Apr 13 / Mar 14 | $703.20 |

Clean Alex recurring surplus remains $642; the immediate purchase reduces starting cash
$3,500 → $2,600, capacity $90 → $0, and goal allocations $250 / $200 / $192 → $250 / $200 / $12.
Shopping-adjusted recurring surplus remains $703.20; capacity is $122 before purchase and $0 after
full-price purchase. Immediate allocations remain $250 / $200 / $91.20, compared with baseline
$250 / $200 / $253.20. Japan and Emergency dates remain unchanged; investing moves Mar 14 → Apr 13.
The full-price purchase remains buffer-breaching despite unchanged dates for some goals.

Both workspaces still rank Pay in 4 first under existing green-risk/interest/simplicity rules.
This is an educational comparison, not financing approval. Monthly payments remain twelve estimated
$83.37 payments, $100.44 added cost. Their safety evaluation spans **361 days through Nov 7, 2027**
from Nov 12; normal/stress recurring income is expanded by existing code. Visible daily balances and
the authoritative no-installment Dashboard forecast remain exactly 45 days. The Step 8.6 Nov 10
income-guard fixture still ends Nov 5, 2027. No new forecasting feature was introduced.

## Focused regressions and preserved contracts

Added eleven tests in `tests/goal-cash-funding.test.ts`. Running them against an isolated archive of
the unmodified Step 8.6 freeze yields **1 passed / 10 failed**; corrected source passes all eleven.
The first full run after the engine fix yielded exactly the reported **311 passed / 2 failed**.

| Required case | Verification |
| --- | --- |
| A — nearby full-price dates | Exact November 12/13/22 dates, allocations, cash and risks asserted; equality is fixture-specific. |
| B — within headroom | $400 future expense uses $500 headroom; cash falls once, $100 monthly contribution stays intact. |
| C — exceeds headroom | $600.01 uses $500 cash and charges exactly $100.01 to contributions. |
| D — multiple payments/cents | $900.06 split across dates uses $500 once; residual $400.06; reversed input and existing/candidate splits agree. |
| E — independent deficit | $200 starting deficit plus $50 completed reserve remains $250, alongside one $300 future obligation. |
| F — contribution periods | Tomorrow, after-payday, later-period and crossing-period obligations; small fixture produces different ETAs when timing matters. |
| G — long horizon | Declining baseline extends through final monthly payment; no unsafe reuse of short-horizon headroom; visible chart stays 45 days. Existing recurrence/conservative-income tests pass. |
| H — Shopping | Apply actual planning-service $30 budget in a temporary workspace; exact baseline and five scenario results; preview does not mutate store. |
| I — immediate/captured | Existing Step 8.6 full forecast/allocation equivalence for $249/$900, buffer deficit, Shopping and compatible/unsupported income mappings passes unchanged. |
| J — repeated/completed purchases | Existing prior-plus-new purchase, repeated receipt/recovery, exactly-once reserve/snapshot and later budget/income/goal recomputation tests pass unchanged. |
| K — replacement compatibility | All existing unsupported timing, compatible lower/higher, source conflicts and financial hash tests pass unchanged. |

`engine.test.ts:55` expected the obsolete 30-day Pay in 4 Japan delay: the cash-funded result is zero
for that fixture, while cash-risk and recommendation assertions remain. The old line 119 compared
production projection with a direct `allocateGoals` call passing gross future costs. That low-level
helper accepts contribution obligations; `projectGoals` now derives residual obligations. Its fixture's
$225 future reserve fits $395 remaining headroom, so the test expects no contribution deduction and
also verifies $3,175 starting cash and a single $225 dated forecast debit. No useful coverage was removed.

The PurchaseConclusion disclosure now states that timing-compatible replacements may apply, with
original stress/goal caps; incompatible replacements remain planning-only and original salary stays
active. Only wording changed, preserving layout and evidence grounding. Existing AI/grounded fallback
coverage and a new installment goal-fact assertion consume corrected engine results; no financing
capability or unsupported claim was added. No new live AI or responsive-browser acceptance is claimed.

Both payment journeys remain unchanged: Shop PAY_NOW / commit:true → PayPal confirmation → verified
capture; Northstar CONTINUE / commit:false → approval → signed RiskPilot review → explicit Confirm
and Pay → verified capture. Existing mock tests cover server intent, freshness/expiry, ownership,
merchant signing/pricing, currency/amount validation, idempotency and recovery. Future/installment
scenarios remain simulations and create no reserve or actual installment product.

## Final verification and local freeze

- **324 tests passed, 0 failed** (313 retained plus eleven focused regressions).
- `npm run typecheck`, `npm run build` and `git diff --check` pass.
- All four protected ledger hashes match their original Step 8.7 values after verification.
- Private exact pre/post JSON probes, baseline/final logs and ledger checks are in
  `../artifacts/step-8.7/`, outside committed source. Temporary test stores were removed.
- The local freeze is the commit containing this report (`git log -1 --format=%H`); branch `cynthia`.
  No push, publishing, actual payment or Step 9 work was performed.

Source changes: `lib/engine/goals.ts` (cash funding and allocator contract comment), `lib/state.ts`
(policy version only), `app/components/PurchaseConclusion.tsx` (disclosure only). Tests:
`tests/engine.test.ts` (two outdated assertions plus cash evidence) and `tests/goal-cash-funding.test.ts`
(eleven focused cases). Current documentation: README, RUNNING, FORECAST_INTEGRATION,
IMPLEMENTATION_STATUS, STEP7B_DEMO_REHEARSAL and this result. Historical Step 8.5/8.6 reports remain intact.

The fictional model's 30.4-day goal buckets, 48-month funding cap, modeled income assumptions,
unconfirmed financing terms and previously documented production limits remain. The correction fixes
accounting consistency; it does not guarantee future income, affordability or completion dates.
**Step 8.7 complete. Stop at this local commit.**
