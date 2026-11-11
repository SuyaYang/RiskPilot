# Two required RiskPilot purchase flows

Both experiences are intentional release requirements. A regression in either blocks release. Changes to Phases 1–4 must preserve both entry points, their distinct interfaces, and the shared financial calculations.

| | Flow A — proactive exploration | Flow B — integrated merchant checkout |
| --- | --- | --- |
| Start | RiskPilot `/shop`, **Explore purchase impact** | Cooperating merchant checkout, e.g. Northstar Electronics |
| First financial action | Save a hypothetical assessment | Merchant creates a server-priced PayPal order |
| PayPal approval needed to analyze? | No | Merchant buyer approval precedes the signed handoff |
| Interface | Detailed scenario comparisons and What-if; buying optional | Critical impact first, compact mobile review, expandable detail and explicit final confirmation |
| Order/payment during analysis? | No order or capture from Explore, scenario selection, or What-if | Approved order already exists; review, refresh, scenario selection and cancel never request capture |
| Continue | Optional existing checkout controls | **Confirm and pay**, **Change method in PayPal**, or **Cancel and return to store** |
| Finish | May leave without purchasing | Verified capture, one reserve/saved forecast, merchant receipt |

## Shared assessment, independent entry points

Flow A's `/api/decisions` and Flow B's verified merchant claim/review use the existing `buildOptions` and forecast/goal engines. Merchant review uses the frozen server quote and current buyer financial inputs. It does not accept a browser-controlled amount. For equal profile, price and timing, cash forecasts and goal impacts match. Merchant quotes can have different product labels or available alternatives; only alternatives actually supported by that path are offered.

Phase 3 spending history and Phase 4 profile explanations supply context. They do not create authoritative balances, change funding, insert bills, move money, or become a prerequisite for either purchase path.

## Flow A: exploration without payment

1. Open RiskPilot `/shop`, choose a product, and select **Explore purchase impact**.
2. Compare full price, supported hypothetical Pay Later schedules, a supported cheaper product, skipping the purchase, and the fixed after-income What-if.
3. Stop or leave freely. No PayPal authorization, order creation or capture is required.
4. If buying is desired, use the existing explicit checkout controls. PayPal approval opens impact review before capture. A simulation is a separately labeled, explicit action; Explore never simulates a purchase automatically.

## Flow B: merchant → PayPal → RiskPilot → receipt

1. Start on an explicitly integrated merchant. Visiting RiskPilot Shop is unnecessary.
2. Merchant creates its full server-priced order. PayPal uses `CONTINUE`; the SDK uses `commit: false`.
3. Buyer approval returns to the merchant, which automatically redirects through the signed `/checkout/connect?ticket=…` handoff. RiskPilot verifies and claims the order, then opens `/checkout/review?order=…` without an Explore step.
4. Review current cash minimum, protected buffer, late-income stress and goal impact before capture. Secondary comparisons are optional and collapsed on mobile.
5. Confirm payment explicitly, reopen the same order using **Change method in PayPal**, or cancel/skip back to the merchant. Scenario selection alone never changes PayPal funding.
6. Confirmation sends the existing signed server request. Merchant verifies identity, amount/currency and provider state, then uses the existing idempotent capture path.
7. Verified success records exactly one purchase reserve and immutable before/after forecast. The success action returns to the merchant receipt, whose status is verified for the merchant session.

Cancellation leaves an approved but uncaptured order unpaid; it does not claim to revoke provider authorization or permanently prevent the buyer from reopening and explicitly confirming that order. Pending/unknown results retain existing same-order recovery protections.

This is an explicit cooperating-merchant integration. RiskPilot cannot intercept arbitrary third-party PayPal checkouts. See [merchant protocol and startup](MERCHANT_CHECKOUT.md) and [earlier live Sandbox evidence](DEMO_RELIABILITY_PHASE_2.md).

## Release acceptance — November 10, 2026

| Requirement | Regression coverage / evidence |
| --- | --- |
| 1. Hypothetical exploration without payment | `tests/routes.test.ts`: no PayPal credentials; zero provider calls, orders, purchase mutations or forecast changes; scenarios and after-income results available; optional explicit checkout still works. Mobile browser confirmed Explore and What-if. |
| 2. Direct integrated merchant checkout | `tests/merchant-flow.test.ts`: merchant creates an order with no pre-existing RiskPilot decision; no Shop request. |
| 3. Approval automatically opens review | Merchant return yields a signed connect URL; unapproved claims fail. Browser followed the signed connect URL directly to review, without an Explore action. |
| 4. Review before capture | Claim, review, repeated claim and refresh retain zero captures. Mobile shows **Buyer approved · not captured** and explicit confirmation. |
| 5. Decline/cancel without capture | Test covers PayPal cancellation before approval and merchant return after approved review. Mobile selected skip and returned to the merchant. Capture count remained zero and financial state unchanged. |
| 6. Explicit confirmation uses secure capture | Missing confirmation, wrong workspace, unsigned requests and stale reviews fail. Valid confirmation uses the existing signed merchant route. |
| 7. Forecast updated exactly once | Duplicate confirmation, capture-timeout recovery, pending capture and receipt tests verify one provider capture, one reserve and saved forecast. Isolated HTTP check also confirmed one capture/reserve after duplicate requests. |
| 8. Both work on mobile | Browser at 390-pixel viewport: exploration/What-if, automatic merchant handoff, collapsed optional analysis, confirmation/change-method/cancel controls and skip return; no horizontal document overflow. Phase 1 also records broader responsive checks. |

**132 tests pass**, as do TypeScript and production build. `npm test` includes both flow suites and runs in the existing CI job; neither suite is skipped or marked optional. Release requires these checks plus provider/browser acceptance appropriate to the target deployment. Local success is not proof that remote branch protection is configured.

The new browser/HTTP merchant checks used an isolated provider fixture for approval and capture transitions; they did not log into PayPal or perform a new Sandbox capture. The real Sandbox sequence was previously verified in Phase 2. Changing methods reopens the existing verified Sandbox approval URL; no new live provider method-change acceptance is claimed here. Existing payment ledgers and running primary demo servers were preserved.

## Sequential roadmap revalidation

The final mobile confirmation card now precedes all optional detailed analysis. A concise explanation is visible without confirmed planning preferences, and funding/loan disclosures remain visible next to payment controls. Current and after-income exploration made zero payment orders/captures. The fixture handoff reached review automatically; cancel and refresh left capture count zero. Explicit confirmation and duplicate confirmation yielded one provider-fixture capture, one reserve and a saved forecast; merchant status agreed.

A read-only PayPal Sandbox lookup also reverified the previously captured `0JE5641215704915A` / `5DV57240EB846754P`: completed, $900 USD, local projection UPDATED, one purchase and one saved snapshot. This was an existing real Sandbox capture; the new capture checks used the isolated fixture. No new live-provider payment was made.
