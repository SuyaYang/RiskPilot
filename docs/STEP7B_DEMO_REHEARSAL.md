# Step 7B — three-minute recording rehearsal

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

## Main narrative (2:50 target, excluding login/MFA)

| Time | Route / action | Spoken point |
| --- | --- | --- |
| 0:00–0:20 | Dashboard `/` | Show manually supplied cash, 45-day projection and buffer. Fictional history is distinct from verified payments. |
| 0:20–0:40 | Spending Intelligence on Dashboard | Briefly open category history. Observed fictional spending suggests a plan; it does not create a commitment. |
| 0:40–1:15 | `/money` → What-if budget preview → Shopping | Read the current category assumption. For the verified November 12 acceptance fixture, compare $90 → $30/month. Lowest cash $1,720 → $1,738; delayed-income minimum $1,540 → $1,572; capacity $90 → $122. Preview is read-only. Choose Apply to money plan explicitly. |
| 1:15–1:30 | Northstar `http://localhost:3200` (or isolated 3201) | Start directly at the merchant. Aero 14 is server priced at $900 USD. No prior Shop visit is required. |
| 1:30–1:50 | Check out with PayPal Sandbox → buyer Continue | The product owner signs in/selects funding and approves the order. Continue does not capture this merchant order. |
| 1:50–2:20 | Signed RiskPilot purchase-impact review | Show full-price risk, income-late stress and goals. Do not hide an unfavorable conclusion: Alex's full-price $900 purchase can cross the $1,000 buffer. Scenarios do not select PayPal funding. |
| 2:20–2:40 | Explicit Confirm and pay | Product owner performs the final confirmation. Only verified provider capture counts as payment success. |
| 2:40–2:50 | Merchant receipt → Dashboard | Show capture/forecast-save status and exactly one new purchase reserve. If pending/unknown, describe recovery honestly instead of claiming success. |

The $60 monthly assumption reduction is not $60 of realized cash and does not itself become
investment capacity. The original food $300 → $150 example also remains available, but do not
apply both examples silently or quote a clean baseline after a recorded purchase.

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

Step 8 is the standalone future-ecosystem `/vision` concept page, after explicit approval.
No Vision page or Devpost description is implemented in Step 7B.
