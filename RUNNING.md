# Run RiskPilot

The prototype uses fictional finances and local JSON persistence. No bank account is required. PayPal Sandbox credentials are required for provider checkout; Gemini is optional. Financial analysis runs without either provider.

## Requirements and installation

Use **Node.js 22**, npm, `curl` and **Python 3**. The combined launcher uses curl for health checks and Python 3 to validate JSON. A Bash shell is needed for the launch scripts.

```bash
git clone https://github.com/SuyaYang/RiskPilot.git
cd RiskPilot
git switch cynthia
npm ci
cp .env.example .env
```

Run `cp` only in a new clone with no existing `.env`. Preserve existing configuration and ledgers. The repository is private; public open-source publication is required before submission. See [Judge Testing Access](README.md#judge-testing-access).

## Environment

Edit your own ignored `.env`. Never commit credentials or paste them into review comments.

| Variable | Purpose |
| --- | --- |
| `PAYPAL_CLIENT_ID` | Sandbox REST app client ID, server-side |
| `PAYPAL_CLIENT_SECRET` | Same Sandbox app's server-only secret |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Same app's client ID for the browser SDK; never put a secret here |
| `PAYPAL_API_BASE` | Keep `https://api-m.sandbox.paypal.com`; live endpoints are rejected |
| `GEMINI_API_KEY` | Optional server-only explanation key |
| `GEMINI_MODEL` | Existing default `gemini-3.6-flash`; unavailable models use fallback |
| `DEMO_TODAY` | Use `2026-11-12` to reproduce the final Alex example |
| `FINANCIAL_TIMEZONE` | `America/New_York`; pinned demo date overrides the clock |
| `DEMO_SEED_ENABLED` | `true` for fictional seeded history and local simulation; never enable on a future real financial service |
| `STORE_PATH` | App ledger; default template `./data/demo-v2.json` |
| `MERCHANT_STORE_PATH` | Separate merchant ledger; template `./data/merchant-demo.json` |
| `MERCHANT_BRIDGE_SECRET` | Optional shared server-only key, 32+ characters; local services in one working copy generate/reuse ignored `data/merchant-bridge.key` if blank |
| `PAYPAL_WEBHOOK_ID` | Only needed for separately configured verified inbound webhooks; not required for local browser capture |

The template contains reserved future architecture variables. Supabase, Plaid and Python engine settings are not wired into this prototype. Restart both services after configuration changes. Never print keys for troubleshooting.

## Financial analysis without credentials

```bash
DEMO_TODAY=2026-11-12 npm run dev
```

Open [localhost:3000](http://localhost:3000), sign in at `/login` as `alex@riskpilot.demo`, and explore Dashboard, Goals, Money and Shop. `sam@riskpilot.demo` and `jordan@riskpilot.demo` select other fixed fictional profiles. There is no in-account persona dropdown or production authentication.

Purchase and Money explanations use deterministic/template fallback without Gemini; guided page facts and manual goal editing remain available. Free-text Ask RiskPilot returns an unconfigured/503 message without a key; AI goal drafts are unavailable. Without PayPal credentials, Shop offers a clearly labeled simulation that makes no PayPal request. A saved simulation changes only that isolated demo workspace. Merely exploring scenarios creates no order or purchase.

## Both PayPal Sandbox sites

Configure matching Sandbox credentials first:

```bash
DEMO_TODAY=2026-11-12 npm run demo
```

| Page | URL |
| --- | --- |
| Northstar merchant | http://localhost:3200 |
| RiskPilot Dashboard | http://localhost:3100 |
| Account selection | http://localhost:3100/login |
| Shop analysis | http://localhost:3100/shop |
| Future concept | http://localhost:3100/vision |

The launcher sets the two origins and merchant port, checks configuration, starts missing services and opens Northstar. Keep its terminal open. Ctrl+C stops only services it started. It may reuse an already healthy service, so verify that existing processes use the intended checkout, date and ledger. The launcher never captures or resets data.

```bash
npm run demo -- --check     # Read-only readiness check of existing services
npm run demo -- --no-open   # Start/check without opening the browser
```

To start the services separately, use two terminals in the same checkout:

```bash
# Terminal 1
APP_ORIGIN=http://localhost:3100 DEMO_TODAY=2026-11-12 npm run dev -- --port 3100
```

```bash
# Terminal 2
DEMO_TODAY=2026-11-12 npm run merchant-demo
```

Keep `RISKPILOT_ORIGIN=http://localhost:3100`, `MERCHANT_ORIGIN=http://localhost:3200` and `MERCHANT_PORT=3200` in `.env` for this separate-terminal setup. Both services must share the bridge key. For non-default ports, set each origin consistently and use the [deployment/origin guide](docs/DEPLOYMENT.md); the combined launcher deliberately fixes 3100/3200.

`npm run demo:shop` is an alternative Shop launcher. Its printed walkthrough is historical; use the confirmation rules below and the current UI. It also requires Sandbox configuration, whereas `npm run dev` does not.

## Safe clean demonstration workspace

A fresh browser profile creates a new opaque workspace cookie without deleting an existing workspace. Use the same profile across RiskPilot and Northstar. Signing into another fictional account alone does not guarantee that account is purchase-free in the current workspace.

For complete storage isolation, use a separate checkout and unique ledger paths **before starting either server**, for example:

```bash
# In a fresh checkout's .env; choose new unused filenames for each rehearsal.
STORE_PATH=./data/reviewer-app.json
MERCHANT_STORE_PATH=./data/reviewer-merchant.json
DEMO_TODAY=2026-11-12
DEMO_SEED_ENABLED=true
```

Stop only services you own before relaunching with these settings. Do not delete, overwrite, reset or reuse someone else's ledger, accepted Sandbox workspace or recording workspace. Preserve the legacy `data/store.json`; incompatible/corrupt stores fail closed rather than being silently replaced. The demo's reset protections do not replace this isolation procedure.

## Review without making a payment

1. Sign in as Alex in the fresh profile. Confirm $3,500 checking, $1,720 minimum, $1,540 delayed-income minimum and $90 available to allocate.
2. In Money's What-if controls, preview Shopping $90 → $30/month. Preview is read-only. Explicitly **Apply to money plan** to obtain $1,738 / $1,572 / $122; checking stays $3,500.
3. In Shop, explore the $900 laptop. Buying now gives $838 minimum / $672 stress / red risk. Buying Nov 22 gives $1,334.54 / $672 / yellow. Installments are educational simulations; actual checkout remains full price.
4. Review goals: Japan March 14 and Emergency April 13 remain; Start investing moves March 14 → April 13, 2027 in the immediate-purchase projection. Capacity is $0 and projected starting cash is $2,600.
5. Open `/vision` directly to inspect the standalone future concept.

Unsupported income timing/cadence replacements remain planning-only, preserving original salary. Do not present them as an applied job loss or arbitrary salary change. [Exact final scenario table](docs/STEP87_RESULT.md)

## Two distinct confirmation flows

**RiskPilot Shop:** Explore → PayPal Checkout → final **Pay Now in PayPal** (`PAY_NOW` / `commit:true`) → server-verified capture → saved result. Stop before the final provider confirmation for a payment-free review. An unchanged assessment needs no repeated RiskPilot confirmation; stale/expired inputs pause for review.

**Northstar:** Merchant-priced order → PayPal **Continue** (`CONTINUE` / `commit:false`) → signed RiskPilot review → explicit **Confirm and Pay** → verified capture → merchant receipt. Approval alone does not pay. Stop before Confirm and Pay to leave an approved order uncaptured. Skip enters Dashboard; the separate Cancel link returns to the store.

Optional Sandbox acceptance requires explicit human approval, your own Sandbox personal buyer and an isolated workspace. Do not use a merchant account as the buyer or experimental purchases in the recording workspace. Do not run `scripts/smoke-paypal.sh` as part of read-only review: it is a separate manual provider diagnostic that can capture after human confirmation.

Unknown/pending outcomes must recover the same order. Do not create repeated orders to demonstrate recovery. Capture verification records a full-price reserve and immutable forecast once; it does not establish the consumer's funding account or a real installment schedule. Refund/reversal status does not implement bank-credit reconciliation.

## Tests and production build

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: **324 tests**, TypeScript and production build passing. Tests use temporary stores and provider mocks. To run the built app instead of development:

```bash
APP_ORIGIN=http://localhost:3100 DEMO_TODAY=2026-11-12 npm run start -- --port 3100
```

Set `DEMO_SEED_ENABLED=true` in `.env` for fictional production-build simulation. Development uses `.next-dev`; type generation/build/start use `.next`. Do not change these cache directories or erase financial data to fix a build issue.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Launcher says PayPal is missing | Check all three matching Sandbox ID/secret settings and restart. For analysis-only review, use `npm run dev`. |
| Gemini unavailable or invalid output | Purchase/Money explanations fall back; free-text Ask needs a configured key and may return an error. Verify your own key/model/quota without exposing it; financial calculations remain independent. |
| Port 3100/3200 occupied | Identify the process and stop it only if it is yours. The combined launcher may reuse a healthy older process; use a separate checkout/origins for isolation. |
| Sandbox login/MFA/CAPTCHA | Use your own Sandbox **personal buyer**, not production credentials or the merchant account. Human login and provider confirmation are manual steps. |
| Dates/figures differ | Set `DEMO_TODAY=2026-11-12`, restart both services and check applied budgets and purchases. Financial dates are separate from real capture timestamps. |
| Earlier purchases affect numbers | Open a fresh browser profile and, if needed, new isolated ledger paths. Preserve the existing workspace and its records. |
| Cold readiness check times out | Let the initial Next.js compile finish, prewarm the routes, then rerun `npm run demo -- --check`. |
| Missing dev chunks | Stop your old dev process and relaunch; `.next-dev`/`.next` separation is already configured. |
| Store parse/version/lock error | Preserve the file. Stop all processes using it before inspecting; remove a lock only after verifying its recorded PID is no longer active. Never replace an accepted ledger with an empty one. |

## Evidence and handoff

[Sanitized Sandbox acceptance](docs/STEP7B_ACCEPTANCE.md) predates the final financial corrections. [Step 8.7](docs/STEP87_RESULT.md) records final deterministic/mock regressions. The owner reports an independent final GO audit; no new provider payment was performed during release preparation.

Use the [team checklist](docs/TEAM_ACCEPTANCE_REVIEW.md), [current rehearsal](docs/STEP7B_DEMO_REHEARSAL.md) and [submission materials](docs/DEVPOST_SUBMISSION.md). Public hosting/webhooks, physical-device acceptance, production identity, real banking/reconciliation and replicated storage remain outside current acceptance. A GitHub push does not deploy the app. Final recording and human Devpost submission remain separate steps.

## Live AI and free Sandbox account setup

Use the three [Judge Testing Access modes](README.md#judge-testing-access) for full provider-account
instructions and official sources. `GEMINI_API_KEY` is server-only; the existing `GEMINI_MODEL`
is `gemini-3.6-flash`, whose standard API input/output currently has a free tier. Quotas, project
verification and geographic eligibility apply. No new live API call is claimed by the access audit.
No model, launcher or financial calculation was changed.

For Sandbox, obtain your own REST app under PayPal Developer → Apps & Credentials → Sandbox.
Use that app's ID in both `PAYPAL_CLIENT_ID` and `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, its secret only
in `PAYPAL_CLIENT_SECRET`, and the separate Personal Sandbox buyer's password only in PayPal's
Sandbox login. Both Shop and Northstar use the same configured credentials in this local setup.
`PAYPAL_WEBHOOK_ID` is optional for local capture; public webhook acceptance is separate.
The combined `npm run demo` launcher checks PayPal configuration; it never checks for a Gemini key.
The Shop launcher's no-key readiness check reports missing PayPal credentials, not missing Gemini.
For completely credential-free financial exploration, use `npm run dev` instead.

If a judge cannot use an eligible free provider account, arrange a no-charge hosted test environment
with server-held keys and dedicated login details sent through the submission's testing instructions.
Do not share a personal developer login, publish an API secret or require judges to purchase billing.
See the [official testing rules](https://paypalaihackathon.devpost.com/rules).
