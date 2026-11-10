# Implementation and acceptance status

Updated November 10, 2026. Publication target: PR #1 (`feature/checkout-mvp`), with a
matching `cynthia` branch. This document supersedes earlier local-only publication notes.

## Current experience

Independent Northstar store → PayPal Continue / Review Order → RiskPilot impact review →
explicit Confirm and pay → merchant capture → provider-verified receipt. No extension required.
Dashboard, Goals, Shop and Invest have distinct responsive compositions within one neutral design
system. See [UI implementation](UI_REDESIGN.md) and [running instructions](../RUNNING.md).

## Decision, timing and outcome follow-up

- A deterministic full-price conclusion summarizes normal/stress buffer risk and goal impact,
  with explicit next actions rather than waiting for an AI request to finish.
- Shop and merchant review compare full payment now with the same purchase one day after the
  next scheduled future income, inside the 45-day window. The existing forecast/allocation
  engines recalculate both dates; no income means an explicit unavailable state. The date remains
  fixed during late-income stress, so improvement does not imply safety. Arbitrary future dates,
  future stock/price and actual payment eligibility remain unknown.
- Previewing timing never schedules an order. Future-date mode removes current checkout actions;
  capture/simulation APIs reject a request explicitly marked as a future preview. Current orders
  still require their existing confirmation, approval, ownership and recovery checks.
- Newly recorded captures atomically save an immutable before-reserve and after-reserve snapshot.
  Success shows saved cash/allocation changes and goal dates, including years. Repeated capture or
  later goal edits do not replace these snapshots. Legacy captures explicitly lack before data;
  no historical numbers are fabricated or backfilled.
- Engine summaries display immediately while Gemini loads. Read timeouts have retry states;
  assessment writes reject changed inputs and late responses cannot cross a persona switch.
  Payment clicks have a synchronous lock; different order URLs remount review state.
- The small two-line assistant footer and the goal editor's automatic scroll/focus fix are retained.

The 85-test suite includes fixed-date/stress/no-income examples, preview capture rejection,
immutable comparison/legacy handling, stale AI assessments and server-rendered decision states.
Live Gemini successfully selected the calculated future-date facts and identified the preview as
read-only. TypeScript/build pass. No new Sandbox capture was performed, and browser/mobile
acceptance remains outstanding under the saved localhost:3100 permission restriction.
See [demo walkthrough](DEMO_SCRIPT.md) for a controlled presentation sequence.

## P0 / P1 review follow-up

| Review item | Implementation / evidence |
| --- | --- |
| AI on the actual merchant path | Order-scoped insights explain current cash, buffer, stress, goals and suggested scenario. Gemini can select only server-authored facts; provider failure preserves deterministic summaries. Free-text questions are available on all four main pages and order review. Workspace ownership and current financial input hash are checked. |
| Same-day payment goal mismatch | Existing payments on or before today already reduce starting balance and are excluded from future goal-payment allocation. Regression coverage compares assessment baseline with Dashboard allocation after same-day and earlier captures, while retaining future reserves. |
| Explicit waiting recommendation | Engine-recommended waiting is prominent on the review page, with no-purchase comparison and return-to-store actions. Scenario choices include waiting and a suggested marker. They never change PayPal funding. |
| HTTPS deployment support | Exact HTTPS origin allowlist, shared signing secret, public callback origins, Secure merchant cookie, platform listener HOST/PORT and separate durable ledger paths. Render Blueprint and deployment guide supplied; local HTTP remains loopback-only. |
| Documentation and acceptance | PR description and these status notes reflect current implementation and evidence. Model, financial-data and payment limitations remain explicit. |

## Validation

- All 85 automated tests pass: finance, same-day baseline regression, goals, grounded AI,
  provider failure, workspace isolation, stale review, payment recovery, merchant handoff,
  capture/receipt, HTTPS allowlist, secure callbacks and merchant-ledger restart persistence.
- TypeScript and production build pass. CI is separately recorded in GitHub Actions after push;
  local tests are not evidence of a finished remote CI run.
- Live Gemini key verified with `gemini-3.6-flash`: goal extraction and free-text fact retrieval
  succeeded. The old 2.5 Flash model rejected this new account; 3.8 Flash returned overload.
  Secrets remain in ignored local environment files; remote environments need their own settings.
- The previously completed merchant Sandbox capture was reconciled via a read-only provider lookup:
  COMPLETED capture, capture identity, amount and currency match the saved order; the versioned
  forecast snapshot exists. No new capture was made for this pass.
- Main-app live visual/browser acceptance remains incomplete because the saved browser permission
  denies localhost:3100. Automated rendering/build checks do not replace mobile interaction testing.

## Remaining external acceptance

- Actual Render account connection, assigned public HTTPS origins and deployment.
- Public PayPal Webhook registration, `PAYPAL_WEBHOOK_ID`, verified provider event delivery and
  public end-to-end browser/restart acceptance.
- Real Pay Later eligibility and loan-term confirmation. Hypothetical comparison schedules are not
  evidence of eligibility. Captures conservatively reserve the full price until funding is known.
- Repository public visibility, final recording and Devpost submission are separate user decisions.
  No visibility change, submission or external deployment is implied by a source push.

## Architecture boundaries

This is a fictional-data, single-instance JSON-ledger demo with opaque workspace cookies, not
production authentication or bank reconciliation. Supabase Auth/Postgres/RLS, Plaid, Python service
migration, background reconciliation and production merchant onboarding remain future work.
Optional deployment uses paid single-instance services and persistent disks, not replicated storage.
See [deployment guide](DEPLOYMENT.md) for explicit prerequisites and limitations.
