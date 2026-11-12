# Two purchase entries, one intelligent review

**Current correction:** [Step 8.5](STEP85_RESULT.md) supersedes earlier blanket replacement-income exclusions,
duplicate purchase/buffer goal charges, zero-difference budget application and client-selected capture validation.
Historical test counts and acceptance statements below describe their original checkpoints.


Both entry points are required release gates. A regression in either blocks release.

- **Flow A — Direct Merchant Checkout:** Northstar → PayPal approval → automatic signed RiskPilot
  full review → explicit Confirm and pay → verified capture → one forecast update → merchant receipt.
- **Flow B — Explore Purchase Impact:** RiskPilot Shop → assessment/scenarios/What-if → leave freely
  or explicitly continue to supported checkout. Exploration creates no payment order/capture.
- **Flow C — Smart Recheck:** a behavior of the same review, triggered only by an owned, matching,
  unexpired server assessment associated with the checkout. It is not a tier, account mode or toggle.

Every account can expand the full analysis. Unchanged matches reduce repeated content; changed
inputs/amounts highlight the refreshed result; unavailable/expired prior assessments show a fresh
full review. Approval is not capture. Scenarios do not select or establish PayPal funding.

The full **147-test suite**, TypeScript, production build, and isolated browser/API validation
cover both flows, signature/ownership/expiry checks, matching/fallback, cancellation, stale review,
idempotent confirmation and exactly-once forecast updates. New provider transitions used fixtures,
not a new live Sandbox capture. [Final specification implementation and evidence](FINAL_PURCHASE_EXPERIENCE.md).
