# Authoritative three-minute recording rehearsal (updated Step 8.6)

Use a fresh browser profile for the recording, never Reset demo in an account with Sandbox
orders. Keep the product owner's current Alex/Sam/Jordan workspaces intact. Fixed fictional
account: `alex@riskpilot.demo`. Use a Sandbox **personal buyer**, separate from the merchant.
Never enter production credentials or real financial information.

## Preparation (off camera)

- Run `npm run demo -- --check` for the existing app/merchant at http://localhost:3100 and
  http://localhost:3200. Both must use matching Sandbox client IDs and bridge configuration.
- Verify http://localhost:3100/api/config reports PayPal available, simulation false. Do not
  publish client secrets, bridge keys, cookies, buyer passwords or complete provider responses.
- Sign into the fixed Alex demo account in a fresh browser profile; sign into the Sandbox
  buyer in advance if permitted. Keep all final payment confirmations for the product owner.
- Record actual baseline date, hash, lowest cash, delayed-income minimum, capacity and reserve
  count. Clean Alex has no prior purchases; a workspace containing earlier captures is not
  the clean example. Do not promise dates/numbers without reading the current snapshot.
- If using the isolated acceptance setup instead, the pair is http://localhost:3101 and
  http://localhost:3201 with separate ledgers under `../artifacts/step-7b/runtime/`. Keep these
  processes running while a payment remains pending. Do not delete those ledgers after payment.
- Review the remaining live-acceptance gates in STEP7B_ACCEPTANCE.md before recording.

## Preparation and timing assumptions

Use Node.js 22, npm, curl and Python 3. Set `FINANCIAL_TIMEZONE=America/New_York` and pin
`DEMO_TODAY=2026-11-12` for these figures; restart services after configuration changes.
Prewarm Dashboard, Money, Shop, Goals, Vision and the storefront off camera; run the readiness
check again after cold compilation. Prepare the Sandbox buyer session off camera. A fresh browser
profile creates a fresh RiskPilot workspace and merchant session without deleting old payments.
If buyer preparation needs another browser/profile, do it before the timed take.

The 2:50 target below includes a ten-second Vision frame and ten seconds of contingency within
three minutes. It excludes buyer login, MFA/CAPTCHA and unexpected provider/network delays.
Only the product owner handles approval and final payment actions. No actual payment should be
made merely to rehearse; use retained acceptance evidence or explicitly labeled fixture footage.
The two Step 7B captures are historical acceptance, not new Step 8.5 payment evidence.

## Main narrative (2:50 target, plus 0:10 contingency)

| Time | Route / action | Spoken point |
| --- | --- | --- |
| 0:00–0:15 | Dashboard `/` | Show manually supplied cash, 45-day projection and buffer. Fictional history is distinct from verified payments. |
| 0:15–0:30 | Spending Intelligence on Dashboard | Briefly open category history. Observed fictional spending suggests a plan; it does not create a commitment. |
| 0:30–1:05 | `/money` → What-if budget preview → Shopping | Read the current category assumption. For the verified November 12 acceptance fixture, compare $90 → $30/month. Lowest cash $1,720 → $1,738; delayed-income minimum $1,540 → $1,572; capacity $90 → $122. Preview is read-only. Choose Apply to money plan explicitly. |
| 1:05–1:20 | Northstar `http://localhost:3200` (or isolated 3201) | Start directly at the merchant. Aero 14 is server priced at $900 USD. No prior Shop visit is required. |
| 1:20–1:40 | Check out with PayPal Sandbox → buyer Continue | The prepared Sandbox buyer selects funding and approves the order; login/MFA is off camera. Continue does not capture this merchant order. |
| 1:40–2:10 | Signed RiskPilot purchase-impact review | Show full-price risk, income-late stress and goals. Do not hide an unfavorable conclusion: Alex's full-price $900 purchase can cross the $1,000 buffer. Scenarios do not select PayPal funding. |
| 2:10–2:30 | Explicit Confirm and pay | Product owner performs the final confirmation. Only verified provider capture counts as payment success. |
| 2:30–2:40 | Merchant receipt → Dashboard | Show capture/forecast-save status and exactly one new purchase reserve. If pending/unknown, describe recovery honestly instead of claiming success. |
| 2:40–2:50 | `/vision` | Close on the static future concept. Label it illustrative and distinguish it from today's merchant-integrated Sandbox prototype. |

The $60 monthly assumption reduction is not $60 of realized cash and does not itself become
investment capacity. The original food $300 → $150 example also remains available, but do not
apply both examples silently or quote a clean baseline after a recorded purchase.

The current shared model makes an immediate full-price preview agree with its saved outcome.
For the clean November 12 Alex fixture **after Shopping $90 → $30**, the $900 laptop gives
lowest cash $838, income-late minimum $672 and capacity $0 in both paths. Japan Trip remains
March 14, Emergency Fund April 13, and Start investing moves March 14 → April 13, 2027.
This is a 30-day investment-goal estimate change, not a guarantee or evidence of actual investing.
Normal buffer pressure remains $162; do not imply the purchase is safe because some goal dates hold.

For clean Alex **without** the budget adjustment, preview and capture both retain Japan Trip
March 14, Emergency Fund April 13 and Start investing April 13; this month's total modeled goal
allocation changes $642 → $462. Do not narrate the old April 13 Japan Trip preview as current behavior.
The corrected cash-funded scenario no longer charges today's purchase against future contributions
as well as reducing starting cash. Installment scenarios use a different hypothetical schedule.

Do not add income editing to the timed story. If shown separately, unsupported date/cadence changes
remain Needs review, with original salary still active; only timing-compatible replacements apply.
Identical daily-budget equivalents keep the daily model; choose $30 explicitly for the illustrated
conversion. Earlier captures retain their historical snapshots and are not refreshed to new figures.

## Optional Shop path (separate acceptance clip)

`/shop` → Explore purchase impact → read scenarios → single PayPal Checkout button → product
owner's final Pay Now **in PayPal** → server-verified capture → saved result. This path does
not add a redundant RiskPilot confirmation when its trusted assessment remains current.
Future-date and skip comparisons expose no immediate payment action. Preserve the separate
merchant Continue → RiskPilot Confirm and pay architecture.

## Human actions and limits

The product owner handles Sandbox buyer login, MFA/CAPTCHA if requested, and the final payment
confirmation. Stop if a production PayPal environment appears or the amount/currency differs.
Use only the original order for recovery; do not repeatedly capture to demonstrate idempotency.
Controlled automated recovery tests supplement, but do not replace, actual Sandbox evidence.
Public HTTPS callbacks/webhooks, physical iOS/Android payment behavior and production bank
reconciliation are separate from local responsive-browser verification.

`/vision` is now implemented as a standalone static closing frame. It creates no payment and
reads no account finances. Step 9 submission copy remains outside this remediation phase.
