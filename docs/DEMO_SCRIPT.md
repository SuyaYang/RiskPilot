# Decision-to-outcome presentation (about 2½ minutes)

Use fictional data with `DEMO_TODAY=2026-11-10` on a dedicated demo workspace. Keep existing
Sandbox ledgers intact: a fresh browser profile gives a separate RiskPilot workspace and a fresh
merchant session, without resetting verified captures. Run `npm run demo` and keep both servers
open. Check your server-only Gemini and Sandbox configuration before presenting.

## 0:00–0:30 — Understand the decision

Use Alex and assess the $900 Aero 14 on Shop (or open the independent Northstar checkout and
approve Continue/Review Order to enter RiskPilot). Read the concise conclusion: paying in full
now leaves $820 at the minimum versus the $1,000 buffer. The outcome is a projection, not a bank
observation or a PayPal lending decision.

## 0:30–1:10 — Change the purchase date

Choose “Compare buying on Nov 20”. The expected income is Nov 19 and the hypothetical purchase
is one day later. For the untouched Alex fixture, minimum cash improves to $1,260, while the
late-income minimum remains $640: the scenario is still cautionary. Open predicted goal dates.
Ask “What happens if I wait until after my next income?” The assistant uses these computed facts.

The preview cannot pay and does not schedule anything. Return to the current checkout or skip
and return to the merchant. “Don't buy now” is a separate no-purchase baseline; an arbitrary
next-month purchase and future price/stock have not been calculated.

## 1:10–2:00 — A suitable checkout and an explicit choice

For a fresh Sam fixture, the full-price forecast retains its buffer under both normal and late
income. On the independent merchant, approve the Sandbox buyer selection and return to review.
Show the merchant total, current-date assessment and explicit Confirm and pay action. Actually
confirm only when ready to complete a Sandbox purchase. No real funds move.

If showing Pay Later, identify forecast schedules as hypothetical and use the methods PayPal
actually returns as eligible. Do not claim a loan or funding schedule from capture alone.

## 2:00–2:30 — Show what was recorded

After a new verified capture or explicit local simulation, show “Here's what changed”: minimum
cash, available allocation and saved goal plans before/after the full-price reserve. The result
uses immutable capture-time model snapshots. An older order with no saved before snapshot will
show a clear unavailable message; use a newly completed demo order to demonstrate the comparison.
Return to the merchant receipt and Dashboard. They should agree on the same capture, without a
second purchase or a second reserve.

## Before the presentation

Run `npm run typecheck`, `npm test` and `npm run build`. In the browser check keyboard navigation,
small widths, goal edit focus, AI outage fallback, stale goals requiring reassessment, cancellation,
and unknown payment recovery on the same order. Do not induce repeated new captures to recover
an unknown result. The automated suite covers these server paths with fixture providers; it is
not evidence of a new live checkout or full mobile visual acceptance.
