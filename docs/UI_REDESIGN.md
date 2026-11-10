# Purchase-impact UI update

The primary experience is now the RiskPilot purchase-impact review, with the message
**Know the impact before you pay.** Northstar remains a separate merchant site.

## Implemented

- Neutral/white design tokens with blue accents, locally hosted Inter (license in `app/fonts/OFL.txt`), consistent
  cards, keyboard focus states, reduced-motion support and responsive layouts.
- Order summary and four metrics with source labels: merchant quote, predicted cash,
  fictional scheduled bills/recorded purchase reserves, and predicted goal impact.
- Interactive 45-day cash chart using the existing engine results: selected scenario,
  no-purchase baseline, buffer, bill markers, keyboard/touch date slider and daily readout.
- Scenario comparison including skipping the purchase. Pay Later is explicitly hypothetical;
  the engine's price-range check does not establish actual PayPal eligibility.
- Read-only insights and a collapsible guided Ask RiskPilot panel. The new owned-order
  `/api/orders/[id]/insights` endpoint recomputes the review, checks its input hash, and only
  permits supported questions/scenarios. Gemini can arrange server-authored fact sentences;
  model-authored balances, payment claims and actions are discarded. Missing/invalid AI
  output uses a labeled deterministic fallback. No payment adapter or ledger write is used.
- Explicit confirmation is retained. After successful capture the UI loads the saved record
  and shows payment, forecast and funding/reconciliation separately. “Updated & saved”
  requires both the backend's UPDATED status and its saved forecast snapshot. The buyer can
  then open the merchant receipt or dashboard. Receipt navigation is now an explicit next
  action, rather than an immediate redirect that skips the success view.
- Northstar keeps PayPal as the primary checkout action, adds a concise three-step guide,
  and links its provider-verified receipt to the purchase outlook and dashboard.

## Existing boundaries preserved

Payment routes, authorization, ownership, signed handoff contracts, server prices, input-hash
confirmation, capture idempotency and ledger behavior are unchanged. The review context adds
display-only scheduled events from the same recurring fixtures used by the forecast and from
recorded purchase reserves. This is not new bank observation or a new financial calculation.

## Limitations

- No live bank data, bank reconciliation, actual funding source or confirmed loan schedule.
- Buying next month is not evaluated. The assistant says so rather than inventing a delayed
  forecast. Skipping the purchase is a separate baseline, not the same scenario.
- No verified cheaper quote for this merchant order; another product requires another order.
- Ask RiskPilot supports guided questions, not unrestricted chat, payments or data changes.
- Gemini is optional; an online Gemini response has not been verified with a configured key.
- Successful capture remains a merchant payment fact; the forecast conservatively reserves
  the full price until funding is confirmed.

## Validation

58 automated tests pass, including the existing merchant create → approval → review → explicit
capture → receipt integration with fixture provider responses. New coverage checks insight
ownership, stale inputs, invalid requests, non-mutation of financial/payment records, missing
delayed-purchase calculation, and model output restrictions. TypeScript and production build pass.

The Northstar page is browser-checked at desktop and mobile widths. Browser access to
`http://localhost:3100` remains denied by a saved browser permission, even after a retry following
the user's permission update. The new review, copilot and success layouts have therefore not
completed live visual/browser acceptance; no new live Sandbox capture was performed for this
redesign. Do not treat fixture integration results as a completed live payment test.


## Global visual refinement

The shared stylesheet has a single token source: near-black text and primary RiskPilot actions,
white cards/navigation, neutral dividers, and blue reserved for interaction, charts, selection
and insights. The dashboard balance card and copilot heading no longer use solid-blue
backgrounds. Cards use 18px corners and custom actions use 12px corners with minimal shadows.

Small blue and red text on tinted surfaces uses darker companion tokens for contrast; the
reviewed text/background combinations meet 4.5:1. Status colors remain tied to calculated risk
or returned payment state. Financial scenario figures use neutral text with separate risk badges.

The chart has a neutral dashed baseline, amber dashed buffer, blue scenario line and fact-based
hover readouts. Dashboard, Goals, Shop and Invest share loading placeholders. Motion is restrained
and disabled by prefers-reduced-motion. Navigation and mobile controls retain touch targets.
Northstar retains its own product styling and checkout presentation; only its supporting text,
card border radius and shadow were refined in this pass.

This pass changes frontend presentation only. Financial models, API endpoints, AI contracts,
payment authorization, signed handoffs and capture behavior were not edited. Official SDK-rendered
PayPal controls are not targeted by the shared stylesheet. The existing 58 tests, TypeScript and
production build pass. Live RiskPilot browser acceptance remains subject to the saved origin
permission restriction described above.

## Multi-page experience refinement — November 10, 2026

- Dashboard: a wide interactive forecast, date slider, source-aware position strip,
  upcoming commitment timeline, engine risk facts and confirmed purchase records.
- Goals: saved-progress ring, featured priority goal, percentage milestones, separate
  target/projected dates, completion timeline and expandable existing AI/manual planner.
- Shop: featured product stage, compact catalog selector, side-by-side scenario table,
  selected impact forecast and the existing checkout component. Hypothetical schedules
  remain labeled; changing product clears the old assessment.
- Invest: charcoal readiness hero, a buffer threshold visualization, compact health
  checks with next actions, template-backed interactive allocation donut and educational
  accordions with timeout/error/retry states. Zero capacity is a hold, never investment-ready;
  missing required checks produce unknown readiness. No financial model was changed.
- Page-specific Ask RiskPilot prompts use available page facts and explicitly identify
  unsupported what-if calculations. They are guided explanations, not new AI outputs.
  Existing AI goal drafting and grounded order-review insights remain available.

Supporting copy uses 13–15px text, readable contrast and consistent spacing. Mobile
breakpoints stack editorial compositions; scenario tables and charts scroll inside their
own containers. Shared navigation, persona/reset events, payment APIs and merchant handoff
are retained. No dependencies were added.

Validation: all 63 automated tests pass (including five presentation tests covering zero,
unknown, real persona results, date/source boundaries and progress bounds), TypeScript
passes and all four routes compile in the production build. Existing mocked merchant
approval → review → capture → receipt tests pass. Saved browser permission still denies
localhost:3100; live four-page visual, responsive and interaction acceptance is outstanding.
No fresh live Sandbox payment was made for this pass.

## Gemini free-text questions

Four-page Ask RiskPilot now includes an 800-character question composer backed by
`POST /api/copilot`. The server loads the active workspace snapshot, optionally validates
an owned/current Shop decision, and sends an allowlisted factual context to Gemini.
The model selects fact IDs; only server-authored facts enter the answer. Unsupported
questions, unverified output, changed inputs, missing configuration and provider failures
have explicit states. No chat writes, financial actions or payment commands are exposed.
Provider requests use the existing server-only GEMINI_API_KEY/GEMINI_MODEL integration;
keys, provider credentials and order/workspace IDs are not included in model context.
The interface discloses that questions and fictional profile facts go to Google Gemini.
Existing suggested page facts remain usable independently of the provider.

The goal draft API now identifies missing Gemini configuration explicitly. Local `.env`
is ignored by git. A real key must be configured before live AI acceptance; fixture tests
cover free question forwarding, fact validation, unavailable responses, workspace ownership
and non-mutation. All 71 tests and TypeScript checks pass. Live browser acceptance remains
outstanding under the saved origin restriction described above.

## P0/P1 follow-up and live AI

Gemini now defaults to `gemini-3.6-flash`, verified with live goal extraction and fact-retrieval
requests on November 10. Order review also accepts custom questions through its owned-order,
current-input-hash-validated insights API. AI-selected sentences remain server-authored facts.
Same-day payment allocation consistency, an explicit engine waiting recommendation and exact
HTTPS deployment origins are covered by this follow-up. See IMPLEMENTATION_STATUS.md for current
acceptance evidence; earlier test counts and local-only restrictions above are historical notes.
