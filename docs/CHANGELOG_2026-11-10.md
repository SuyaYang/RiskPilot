# Complete update record — 2026-11-10

This update contains all work after feature/checkout-mvp base commit 6189343, including the earlier
local fixes 58be00a, 04f4416 and bde744b plus the integrated-merchant implementation and follow-up
runtime/UX fixes. The existing feature/checkout-mvp branch is the intended publication target.

## Buyer flow and merchant integration

- Add the independent Northstar Electronics store on port 3200 and RiskPilot review on port 3100.
- Use PayPal Orders CONTINUE and SDK v6 commit: false. Approval returns to review without capture.
- Add a signed, 15-minute merchant ticket and the /api/merchant/claim endpoint.
- Verify quotes through a server-to-server bridge and bind an order to one fictional buyer workspace.
- Sign capture requests and nonce-bound responses; enforce expiry and fixed loopback destinations.
- Keep merchant credentials and capture on the merchant server. Browser direct capture is rejected.
- Require explicit confirmation and the current financial input hash before requesting capture.
- Record a verified capture, conservative funding reserve and versioned forecast once.
- Return the buyer to a merchant receipt that checks its own provider-verified session/order.
- Preserve unknown outcomes and recover the same order instead of starting another purchase.
- Add one-command startup/checking with npm run demo; keep the prior Shop demo as npm run demo:shop.

## Payment recovery and data consistency

- Check approval before capture so early confirmation gives an actionable incomplete-payment result.
- Persist stable create/capture request IDs and recover after provider timeout or failed local write.
- Keep verified webhooks replayable on processing failure; handle duplicate and out-of-order events.
- Preserve completed payment facts when late pending/declined events arrive.
- Flag refund/reversal settlement review without fabricating an observed bank credit.
- Isolate fictional browser workspaces and scope decisions, orders, goals and reset operations.
- Refuse resets that would erase real Sandbox order records; fail closed on incompatible stores.

## Impact, goals and educational views

- Complete Goals, Shop and Invest navigation alongside Dashboard.
- Show lowest projected cash, safety-buffer headroom, delayed-income stress and goal delays together.
- Show full-price, Pay in 4 and monthly forecasts with estimated dates and explicit assumptions.
- Evaluate risk through the last installment date, beyond the visible 45-day chart.
- Protect future obligations, goals and delayed-income stress when calculating available allocation.
- Keep assumed installments separate from confirmed merchant payment and unknown consumer funding.
- Add goal confirmation, date/cent validation, version conflicts, history and pause/resume behavior.
- Fix native date inputs so visible values are submitted consistently.
- Restrict AI explanations to current approved facts and retain a deterministic outage fallback.
- Keep investment views educational with no trading or funds transfer.

## Return to change payment method

- Put Change payment method in PayPal beside final payment confirmation.
- Reopen the same unpaid order, let PayPal handle the real selection, then return for impact review.
- Explain that forecast controls do not change actual PayPal funding.
- Disable changing methods during capture and while the payment result is unknown.
- Preserve completed payments; their funding cannot be changed using this pre-payment control.
- Browser-tested an unpaid reference order from bank funding to Sandbox Visa and back without capture.

## Development reliability

- Separate .next-dev development output from .next production output.
- Fix the missing ./855.js runtime failure caused by shared generated chunks.
- Verify production build while development stays active, then reload the same checkout successfully.
- Update generated-type configuration, ignored outputs and troubleshooting instructions.

## Optional earlier prototype

Retain the Sandbox-only Chrome extension source, manifest, build script and parser tests because this
publication includes all local work. It is an optional earlier placement experiment; the accepted
merchant Continue/review flow does not install or require it. It reads narrow Sandbox checkout
labels, uses fictional bundled profiles and does not submit payment or access live PayPal.

## Verification and remaining work

56 automated tests pass. TypeScript, production build, merchant browser-script syntax and whitespace
checks pass. A completed integrated-merchant Sandbox receipt and its saved forecast were observed.
These facts do not imply production bank connectivity, real user authentication, actual loan-term
retrieval, every provider error path, deployment or clean remote CI success.

The remaining Supabase/Python/worker/Plaid/production integration and submission work is recorded in
[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). Run instructions are in [../RUNNING.md](../RUNNING.md)
and [MERCHANT_CHECKOUT.md](MERCHANT_CHECKOUT.md).

Only source, tests, configuration templates and documentation belong in this update. Local .env,
merchant signing keys, payment ledgers, node_modules and generated build/extension files stay ignored.
