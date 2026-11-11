# Merchant checkout with RiskPilot review

## Experience

1. The buyer shops at **Northstar Electronics**, a separate simulated merchant on port 3200.
2. The merchant creates a $900 USD order using its server quote and PayPal Sandbox credentials.
3. SDK v6 opens PayPal with `commit: false`; the order uses `user_action: CONTINUE`.
4. The Sandbox personal buyer chooses a method and selects **Continue / Review Order**. No capture
   is triggered by approval or return.
5. The merchant sends the buyer to RiskPilot on port 3100. A 15-minute signed link identifies the
   merchant checkout, not a client-controlled price or arbitrary return URL.
6. RiskPilot verifies the quote with the merchant and binds the order to the current demo workspace.
   The review shows the lowest projected cash, buffer headroom, income-late stress case, estimated
   dates and goal delays. Existing dashboard goals/commitments are included. Forecast comparisons
   do not alter PayPal funding or confirm actual loan terms.
7. Only **Confirm and pay** sends a signed request to the merchant. The merchant verifies the order
   identity, full amount, currency and `APPROVED` state and captures with the same idempotency key.
8. A verified capture is recorded once in both local ledgers. RiskPilot saves the conservative
   full-price commitment and a versioned forecast and returns the buyer to the merchant receipt.
9. The receipt reads provider-verified status for the original merchant browser session. A URL alone
   cannot display payment success.

Before final confirmation, **Change payment method in PayPal** sits beside the payment button. It
reopens the same unpaid order; after choosing a different method, Continue / Review Order returns
to RiskPilot for another review. The button is disabled during capture or while payment outcome is
unknown. Changing a forecast scenario does not change PayPal funding. Completed payments cannot
be changed through this checkout control.

No browser extension is needed. Unintegrated stores do not automatically gain this experience.

## Run

Node 20.6+ and the existing `.env` with matching Sandbox browser/server client IDs and merchant
secret are required. Preserve existing `.env` and payment ledgers.

```bash
npm ci
npm run demo
```

Open `http://localhost:3200` if the launcher does not open it. It starts/checks both local sites and
does not approve, capture or reset a payment. Keep the terminal open. If a previous port-3200 process
runs the earlier direct-payment prototype, stop that process and rerun the launcher. Do not run
multiple merchant processes against the same `data/merchant-demo.json`.

`APP_ORIGIN` and `RISKPILOT_ORIGIN` must identify `http://localhost:3100`; `MERCHANT_ORIGIN` is
`http://localhost:3200`. The launcher supplies those values for processes it starts. Existing
processes retain the environment with which they started.

The local bridge key is generated as `data/merchant-bridge.key` with private file permissions and
is ignored by git. Both local servers read that file. `MERCHANT_BRIDGE_SECRET` (32+ characters) can
be supplied server-side instead. It is distinct from the merchant PayPal secret and never appears
in browser code. Do not publish either key or `.env`.

For an impact-only preview, stop before **Confirm and pay**. The browser demo does not require an
actual capture to inspect all scenarios. Complete a Sandbox capture only when the buyer chooses it.

## Recovery and data boundaries

- Approval and return are read-only with respect to money. Direct browser calls to merchant
  `/api/capture` are rejected. Only authenticated server requests can execute capture.
- Signed requests are purpose-bound, limited to one minute, and responses bind the request nonce.
  Both sides pin the merchant, checkout and order IDs; destinations are restricted to loopback.
- A changed goal, commitment or scenario date invalidates a review. Refresh the impact before
  confirming. Duplicate confirmation returns the same capture/receipt rather than charging again.
- If capture succeeds remotely but a response/write fails, RiskPilot reports unconfirmed status.
  Retry **the same order** to query/recover the merchant's payment, not a new purchase. A confirmed
  capture is counted once. Merchant status lookup never starts a payment.
- Existing Sandbox payment records are preserved. Browser workspaces remain fictional cookie-based
  demo isolation, not production customer authentication. Do not enter real bank data.
- Loan eligibility, APR, schedule and the consumer funding account are not inferred from merchant
  capture. The forecast reserves the full price until actual funding information is confirmed.

## Evidence and remaining acceptance

Automated integration covers both merchant and RiskPilot request handlers using fixture PayPal
responses, with no listening port: create → approval → signed redirect → quote import → read-only
review → explicit merchant capture → forecast update → merchant receipt. Tests also cover signature
tampering/expiry, quote/currency mismatch, other browsers, stale goals, bypass attempts, timeout
recovery and duplicate confirmation.

The current **98-test suite**, TypeScript checks and Next production build pass. Phase 2 completed a
new live $900 USD merchant Sandbox capture after explicit confirmation, observed the merchant receipt
and updated Dashboard, and checked provider status and both ledgers. The merchant was restarted and
its persisted receipt remained consistent. See [the exact audit and evidence](DEMO_RELIABILITY_PHASE_2.md).
Pending/failure/recovery scenarios additionally use automated provider fixtures; real Pay Later
eligibility and actual loan terms remain unconfirmed.

This is a local cooperating-merchant prototype. Production partner onboarding, independent keys per
merchant, HTTPS hosting, durable database transactions, real user login and bank reconciliation remain
outside the implemented local flow. The wider README architecture still lists unfinished services.

## Complementary proactive exploration

The merchant flow remains independent of RiskPilot Shop. Shop's **Explore purchase impact** is a
separate, payment-free starting point for voluntary analysis. It is never required before merchant
PayPal approval or the automatic signed handoff. [Both flows are release requirements](PURCHASE_FLOWS.md).
