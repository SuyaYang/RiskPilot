# Final purchase experience — November 10, 2026

**Current correction:** [Step 8.5](STEP85_RESULT.md) supersedes earlier blanket replacement-income exclusions,
duplicate purchase/buffer goal charges, zero-difference budget application and client-selected capture validation.
Historical test counts and acceptance statements below describe their original checkpoints.


RiskPilot has two purchase entry points. Direct merchant checkout reviews impact after PayPal approval; Shop displays the assessment before PayPal and uses PayPal’s final Pay Now confirmation. There are no subscription tiers, Protection toggles, locked dashboards or upgrade prompts. Every fixed demo account receives the full purchase-impact review. Earlier Basic/Premium checkout restrictions have been removed.

## User journeys

**A — Direct merchant checkout:** Northstar → server-priced PayPal order → buyer approval → automatic signed RiskPilot handoff → normal full impact review → explicit Confirm and pay → verified capture, one saved forecast → merchant receipt. No Shop visit, prior exploration or chat interaction is required. Key risk/buffer/stress/goal facts are visible first; cash-flow charts, timing comparisons and hypothetical scenarios are expandable.

**B — Explore without buying:** RiskPilot Shop → select a catalog product → Explore purchase impact → compare available scenarios or fixed-date after-income What-if → leave freely. Assessment and scenario changes never create or capture a provider payment. A single, always-visible PayPal Checkout section sits immediately below the essential risk assessment; there is no expandable checkout or duplicate Quick Review. PayPal uses `commit:true` / `PAY_NOW`; its final confirmation triggers the existing verified, idempotent capture and then the success receipt. Merely exploring or selecting a scenario never submits payment.

**C — Merchant Smart Recheck (behavior, not a tier):** Shop assessment → Continue at Northstar (supported Aero 14 only) → optional merchant PayPal checkout → approval → the same RiskPilot review, with a validated comparison to the earlier assessment. In-app Shop checkout checks its server-bound original decision before capture without showing a second review when unchanged. The three outcomes are:

| Result | Review behavior |
| --- | --- |
| No material changes | Compact verified comparison and current essential risk facts. Repeated AI/chart/scenario detail is available under **View reviewed analysis**. A match never implies that a risky purchase became safe. |
| Important changes detected | Changed amount, inputs, cash-flow projections, goal plans, buffer effects or risk category are highlighted. The fresh full engine assessment is available. |
| Previous assessment unavailable/outdated | Explicit reason and normal full review. No stale “unchanged” conclusion is presented. |

The existing baseline can already violate the buffer after an earlier purchase. Review now says when pressure exists before this purchase; skipping adds no new payment. Financial risk labels and calculations are not altered to produce a favorable demo result.

## Matching and authority

New Shop decisions record server-owned `origin: shop`, `currency: USD`, creation time, financial input hash and existing `rp-v1` policy/schema version. The input hash covers current financial inputs, goals, date and policy. The existing 30-minute decision lifetime is shared with checkout/recheck validation; no arbitrary financial risk threshold is introduced.

For in-app checkout, the frozen order's existing decision association must resolve to the same workspace/account, explicit product (including the server catalog's supported cheaper-product association), currency and unexpired policy. Legacy decisions without verifiable source/currency metadata receive a fresh full review.

For Northstar, **Continue at Northstar** posts only the owned decision ID. RiskPilot stores an expiring purchase intent in the existing ledger and signs an opaque intent ID plus merchant/product/currency/expiry using a new purpose-bound HMAC envelope. It does not put workspace IDs, raw financial data or a buyer-controlled price in the merchant URL. The merchant verifies the signature, binds metadata to its own session before order creation, and echoes the intent ID only in its signed quote. RiskPilot verifies the stored owner, decision, merchant, exact SKU, currency and expiry again. A copied, missing, expired, mismatched or invalid association cannot make another workspace's assessment appear matched.

The only cross-site catalog association is explicitly `aero-14` → `northstar:aero-14`. Product names, URL resemblance, local storage and broad searches through previous purchases are never matching proof. If an existing merchant session already has an order, the new link does not relabel that old order. Use a fresh demo browser workspace for a repeatable new purchase demonstration.

Every order review recomputes through the unchanged authoritative engine using its frozen checkout amount. Comparisons use full-price forecasts; hypothetical Pay Later selection is not evidence of actual funding or terms. All monetary comparison uses cents. Changes to input hashes are conservatively reported even if a particular forecast metric remains unchanged. Forecast differences use engine risk, minimum/stress balances and daily paths; goal/buffer differences use the existing engine's goal plans and protected-buffer results. Pending/unknown/in-progress payment recovery does not receive an “unchanged” shortcut.

Signed merchant handoff, pricing, approval/capture separation, ownership, current input-hash confirmation, idempotency, provider verification, immutable capture snapshots and exactly-once reserves remain in place. Intent creation/store visits never initiate payment; AI never initiates capture. Smart Recheck is read-only.

## Demo configuration

Run `npm run demo` to start/check RiskPilot `http://localhost:3100` and Northstar `http://localhost:3200`. `npm run demo -- --check` is read-only and checks the updated merchant's `reviewIntent: signed-v1` capability. Restart an older merchant process after upgrading server code; retain its ledger and bridge key.

Keep matching PayPal Sandbox server/browser credentials and the existing shared merchant bridge key. Gemini configuration remains optional with a labeled deterministic fallback. Use `DEMO_SEED_ENABLED=true` and `DEMO_TODAY=2026-11-10` for repeatable fictional data. Account entry at `/login` selects a fixed fictional financial profile, never a permission tier. Reset only disposable simulation workspaces; real/uncertain provider records keep their reset protection. For repeat live-payment demos, use a fresh browser workspace rather than erasing verified captures.

## Validation and limits

- **147 automated tests pass**, TypeScript and production build pass. Coverage includes both entry points, full analysis for all accounts, unchanged/changed/unavailable rechecks, ownership, currency/policy/expiry, explicit SKU associations, changed amount and financial inputs, reset, signed-intent tampering, cross-workspace replay, cancellation, stale confirmation, pending recovery, repeated confirmation and one capture/reserve/snapshot per order.
- Isolated browser/API walkthrough: direct approved merchant handoff opened a full review; cancellation and exploration retained zero captures and created no extra order; Shop continuation opened the integrated merchant with its signed association; fixture approval returned automatically to an unchanged recheck. Full analysis expanded to a visible cash-flow chart.
- A separate confirmed fixture purchase changed financial inputs. The second checkout highlighted changed forecasts, goals and buffer impact. Expiring only the disposable prior decision produced a full-review fallback. Explicit and duplicate confirmation of each fixture order resulted in one capture and one saved forecast each; merchant receipt status agreed.
- Responsive checks at 375, 390, 768 and 1280 pixels showed no horizontal document overflow and kept unchanged analysis collapsed until requested. Mobile risk warnings, amounts, disclosures, final confirmation and cancel/change-method controls remained available.
- **No new live PayPal Sandbox approval/capture was performed in this pass.** Browser/API approval/capture transitions used an isolated provider fixture; missing fixture SDK credentials were displayed as unavailable, not fabricated as a live PayPal approval. Earlier actual Sandbox evidence remains separately recorded in [Phase 2](DEMO_RELIABILITY_PHASE_2.md).
- Northstar supports one fixed $900 USD item. There is no arbitrary third-party checkout interception, real Pay Later terms confirmation, production authentication, real subscription/billing, bank authorization/reconciliation or public deployment acceptance. Exact matching outside supported explicit associations falls back to a fresh full review.

## Modified files

- `README.md`
- `RUNNING.md`
- `app/api/account/route.ts`
- `app/api/decisions/route.ts`
- `app/api/financial-profile/purchase/route.ts`
- `app/api/merchant/intent/route.ts`
- `app/api/orders/[id]/insights/route.ts`
- `app/api/orders/[id]/route.ts`
- `app/checkout/review/page.tsx`
- `app/components/MerchantCheckoutLink.tsx`
- `app/components/Nav.tsx`
- `app/components/PurchaseConclusion.tsx`
- `app/components/PurchaseImpact.tsx`
- `app/components/ResponsiveDetails.tsx`
- `app/components/SmartRecheckSummary.tsx`
- `app/globals.css`
- `app/login/page.tsx`
- `app/shop/page.tsx`
- `docs/DEMO_ACCOUNTS.md`
- `docs/FINAL_PURCHASE_EXPERIENCE.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/MERCHANT_CHECKOUT.md`
- `docs/PURCHASE_FLOWS.md`
- `lib/checkout.ts`
- `lib/checkoutAccess.ts`
- `lib/demoAccounts.ts`
- `lib/merchantBridge.ts`
- `lib/merchantCheckout.ts`
- `lib/orderReview.ts`
- `lib/purchaseIntent.ts`
- `lib/smartRecheck.ts`
- `lib/store.ts`
- `lib/types.ts`
- `merchant-demo/server.ts`
- `scripts/demo-merchant.sh`
- `tests/decision-ui.test.ts`
- `tests/merchant-flow.test.ts`
- `tests/routes.test.ts`
- `tests/smart-recheck.test.ts`

## Shop checkout follow-up

- The Shop entry starts on the current full-price scenario and offers one PayPal Checkout button directly below the risk conclusion. Engine suggestions remain visible; explicitly choosing no purchase or a future-date preview does not offer payment. Separate Pay Later and Continue at Northstar checkout buttons were removed from this page; the external Northstar storefront and signed merchant handoff remain operational.
- Newly created Shop orders persist `shopPayNow: true` and use PayPal `PAY_NOW` with SDK `commit: true`. Capture runs only after PayPal’s final confirmation, including the redirect-return path. Existing legacy `CONTINUE` orders and merchant orders retain their review confirmation.
- Server validation recomputes the assessment, requires an unchanged trusted Shop decision and matching financial input hash, then reuses provider verification, the capture request key and exactly-once forecast saving. Expired/changed/unavailable assessments and uncertain capture outcomes lead to explicit review or recovery on the same order.
- PayPal SDK semantics: [official v6 SDK reference](https://github.com/paypal/paypal-js/blob/main/docs/readmes/web-sdk-v6-reference.md). Buyer approval remains distinct from capture; PayPal’s final Pay Now is the explicit confirmation for this Shop path.
- Validation: 155 automated tests, including approved Shop capture, duplicate capture, changed inputs, expired assessment, missing approval, legacy orders and merchant isolation. No new real PayPal Sandbox payment was submitted during this follow-up; provider transitions were tested with deterministic mocks.
