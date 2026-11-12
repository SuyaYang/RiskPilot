# Phase 4 — AI Financial Profile

Dashboard now includes a compact **Your Financial Profile** section. It shows one summary, at most two observations, one supported next action, and expandable evidence. Generate/Refresh, dismiss, restore, and confirmed planning preferences are scoped to the existing workspace and demo persona.

## Feature extraction and AI contract

`lib/financialProfile/features.ts` builds deterministic facts from the existing snapshot and Phase 3 aggregates:

- Coverage, full-month average spending, category monthly averages, and observed monthly range. Partial months are excluded from averages and variability; fewer than two complete months cannot establish a pattern.
- Confirmed recurring-review count, explicitly informational. These patterns do not become forecast bills.
- Upcoming 45-day manual bills/reserves, active goals, engine capacity, protected buffer, and delayed-income stress result.
- Explicitly confirmed buffer preference, preferred active goal, and explanation focus.

Every fact records its source, observation/evaluation period, and kind: observed, predicted, user-confirmed, or limitation. No demographic, psychological, or unsupported risk-score inference is made. Historical variability is not a forecast.

The existing Gemini adapter receives aggregate server-authored sentences and supported action labels. It returns exactly `summaryId`, up to two unique `insightIds`, and `actionId`; arbitrary prose, numbers, extra fields, unknown IDs, missing critical constraints, or invalid selections are rejected. Server facts supply every displayed amount, so there are no unchecked model numerical claims. Available history and confirmed focus are required where applicable. Missing key, provider failure, timeout, or invalid output uses a deterministic template and a visible source label. Model availability varies; a configured key does not guarantee an AI result.

No new AI framework or autonomous agent is introduced.

## Confirmation and correction

The form saves a cent-precise planning buffer preference, preferred active savings goal, and explanation focus. These personalize explanations only. For example, a confirmed **$2,000.25** preference does not replace Alex's **$1,000.00** engine buffer, increase capacity, reprioritize a goal, or move money. Real goal edits remain in Goals; recurring pattern classification remains in Spending Intelligence.

Users can dismiss selected observations, restore them, dismiss the whole generated profile, clear preferences, and regenerate. Dismissed spending cannot reappear through a spending-summary alias. Evidence continues to show source facts for transparency. Preference confirmation invalidates the old generated profile and requires regeneration.

Generated state stores selected fact IDs, source, timestamp, and basis hash, rather than raw model inputs, raw model prose, or transaction records. Facts are reconstructed from current inputs. Generation and mutations require the current version and basis hash; concurrent changes are rejected. Financial/date, spending-review, and preference changes make old profiles stale. Profile inputs are excluded from the authoritative financial-engine hash.

## Purchase impact

Shop and checkout review show a small profile explanation beside the existing engine assessment. `/api/financial-profile/purchase` accepts one owned existing decision or order plus a supported method/timing. It uses confirmed preferences and the exact selected engine scenario's minimum cash, stress minimum, and preferred-goal delay. With no confirmed preference it explicitly avoids personalization.

Pay Later comparisons are labeled hypothetical. After-income comparisons are fixed-date read-only previews. Alternatives reference existing engine comparisons or waiting; they do not schedule a purchase. Ownership and financial hashes are checked, then checked again after AI returns; changed preferences invalidate in-flight explanations. The endpoint makes no payment or ledger mutation. Merchant capture, approval, funding, idempotency, reserves, and recovery keep their existing rules.

## Demo and privacy

Run with `DEMO_SEED_ENABLED=true`; pin `DEMO_TODAY=2026-11-10` for the verified examples. On Dashboard, confirm a preference, Generate, and inspect **View details · sources & preferences**. Explore a purchase in Shop, then compare supported scenarios. Switch the demo persona to verify separate preferences. Simulation-only reset clears profile preferences and generated IDs for the active persona; existing real-provider reset protection still applies.

This implementation uses clearly labeled fictional fixture history, not a connected bank. Raw transactions, account identifiers, workspace IDs, and payment identifiers are not sent to Gemini by this feature. Aggregate goal names and preference facts are included where needed. Existing server-only Gemini configuration is reused. Production bank authorization and production authentication/storage are outside this MVP.

## Verification — November 10, 2026

- **132 automated tests pass**, including missing/short history, full-month math, missing Gemini key, provider failure, invalid output, contradictory numbers/scores, explicit preference confirmation, dismissal aliases, workspace/persona isolation, stale snapshots/concurrent AI updates, current/future purchase scenarios, merchant review, and reset.
- `npm run typecheck` and `npm run build` pass.
- Live Gemini generated a verified browser profile and current/order-scoped purchase explanations. An additional HTTP profile generation used the expected template fallback when the live selection failed validation.
- Browser acceptance covered preference editing, generation, evidence, dismissal/restoration, stale refresh, persona switching, and purchase-review rendering. Viewports 375, 390, 768, and 1280 pixels had no horizontal document overflow; primary controls meet the existing 44-pixel minimum.
- Isolated production server with PayPal/Plaid credentials disabled: HTTP current and after-income explanations, simulation order review, persona isolation, and reset passed. Financial input hash stayed unchanged. Signed merchant integration regression also verifies unchanged snapshot/order and zero captures during profile explanation.
- No new payment capture or real bank connection was performed for Phase 4. Prior Phase 2 Sandbox capture evidence remains separate.

The sequential roadmap pass revalidated live Gemini profile, current/future purchase and order-scoped explanations using an isolated ledger. All returned source `ai`; financial input hashes stayed unchanged, and persona isolation/reset passed. Checkout uses the concise standard engine explanation when no confirmed preference is present. Provider or model failure still uses the labeled deterministic fallback.
