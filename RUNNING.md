# Running RiskPilot Checkout locally

Status: work in progress. Done: cash-flow engine, goal allocation, investable amount, all API routes,
PayPal order/capture/webhook code, dashboard page. Still to build: Goals, Shop (with PayPal buttons) and
Invest pages.

## Requirements

- Node.js 20 or newer

## Start

```bash
npm install
cp .env.example .env    # then fill in the keys (see below)
npm test                # engine tests
npm run dev             # http://localhost:3000
```

Without PayPal keys the app runs in a simulated-checkout mode, so the flow can be tried with no setup.
Without a Gemini key, explanations use built-in templates.

## Keys (.env)

| Variable | Where |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | developer.paypal.com → Apps & Credentials → Sandbox app (same client ID twice) |
| `PAYPAL_WEBHOOK_ID` | Optional. Sandbox app → Webhooks, pointing at `https://<public-url>/api/webhooks/paypal` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | aistudio.google.com/apikey; pick a model your key can use |

Never commit `.env`.

## How it is organised

| Path | What |
|---|---|
| `lib/engine/forecast.ts` | 45-day daily balance, stress test (income 7 days late), risk level |
| `lib/engine/options.ts` | Pay in full / Pay in 4 / Pay Monthly (estimate) / cheaper model, responsible rules, recommendation |
| `lib/engine/goals.ts` | Month-by-month goal funding by priority and deadline; delay caused by each option |
| `lib/engine/investable.ts` | Investable now = lowest projected balance − buffer − this month's goal savings; readiness checks; educational templates |
| `lib/personas.ts` | Fictional demo personas: Alex, Sam, Jordan |
| `lib/ai.ts` | Gemini explanations with number grounding check and template fallback; goal parsing |
| `lib/paypal.ts` | PayPal REST: OAuth, create order, capture (idempotent request id), webhook verification |
| `lib/purchases.ts` | Records a capture exactly once (idempotent by capture id) |
| `lib/store.ts` | JSON file store at `data/store.json`; "Reset demo" restores it |
| `app/api/*` | Route handlers |
| `tests/engine.test.ts` | Engine tests (`npm test`) |

All money figures come from the deterministic engine; AI only writes explanations, and any number it
writes must match an engine number or the template is used instead.

## Demo data

Fictional personas switch from the selector in the top bar. Set `DEMO_TODAY=YYYY-MM-DD` to pin the
date for recordings.
