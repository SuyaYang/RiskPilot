# Step 9A & 9B release record

## Status

GitHub review-branch publication and PR creation completed. Documentation and English Devpost
materials are prepared. Teammate review, owner-controlled judge access, recording and human submission
remain outstanding. The product implementation is frozen; no automatic merge occurred.

## Release identity and repository workflow

- Approved implementation: `77730d2cbe8c60c4a9796322b355e6f9a5e8500e`, verified as starting HEAD on clean `cynthia`.
- Initial documentation release: `45d68c15a8a04f0125b3398cb03f216e85e72cf6`.
- Final handoff release: the commit containing this report (`git log -1 --format=%H`).
- Repository: https://github.com/SuyaYang/RiskPilot
- Published branch: https://github.com/SuyaYang/RiskPilot/tree/cynthia
- PR: https://github.com/SuyaYang/RiskPilot/pull/3
- Title: Finalize RiskPilot: PayPal Checkout, Financial Intelligence & Hackathon Submission
- Head/base: `cynthia` → `feature/checkout-mvp`; open, non-draft, mergeable at creation; no reviews yet.

The initial remote `cynthia` and integration tip were `fa2f5c2d2721b1221dfbaa2e3f43b9e89bde9975`,
with zero remote-only and twelve local-only commits before documentation. Both were ancestors of
the approved freeze. Explicitly fetched all four live branches because the configured default fetch
was narrower than the available refs. A fresh ancestry check preceded the normal fast-forward push.
No force push, history rewrite or direct shared/default-branch update occurred.

The repository's default is `main`; existing PR #1 integrates `feature/checkout-mvp` into `main`,
and PR #2 separately reviews `Evans` into `main`. Those PRs and branches were not edited. The new
PR follows that established integration workflow rather than bypassing teammate review. Teammate
commits already in the approved ancestry retain their attribution.

## Documentation and submission deliverables

- README: concise product story, implemented features, two payment journeys, grounded AI architecture,
  deterministic engine, verified Shopping-adjusted example, startup, evidence and future concept.
- RUNNING: exact Node 22/npm/curl/Python 3 requirements; credential roles; app-only/combined/separate
  startup; ports; account selection; safe isolated workspaces; tests and troubleshooting. The old
  Shop launcher's printed instructions are explicitly labeled historical without changing scripts.
- `docs/TEAM_ACCEPTANCE_REVIEW.md`: nontechnical acceptance checklist, priorities and ready-to-send
  English message with the actual PR URL. No message was sent on the owner's behalf.
- `docs/DEVPOST_SUBMISSION.md`: project name, tagline, 62-word summary, 118-word elevator pitch,
  895-word full description, 174-word PayPal section, 123-word architecture section, 93-word future
  vision, verified stack, suggested repository description, real repo/PR URLs and unavailable-video label.
- Current historical documentation in STEP7B_ACCEPTANCE, DEMO_RELIABILITY_PHASE_2,
  OPTIMIZATION_ROADMAP and IMPLEMENTATION_STATUS has provider IDs redacted; the evidence facts,
  amounts and original private ledgers remain intact. Implementation status also records Step 9.

No deployment, native PayPal integration, approved financing, bank integration, business metrics or
teammate approval was invented. Independent final Claude GO is owner-reported; historical Sandbox
captures are clearly separated from the final deterministic/mock validation.

## Verification and publication hygiene

- Approved implementation: 324 tests passed, zero failed; TypeScript and production build passed.
- Fresh isolated `git archive` installation: `npm ci`, typecheck, all 324 tests and build passed;
  credentials were excluded from the child environment and the temporary copy was removed.
- Documentation release: full 324-test suite, TypeScript, production build and whitespace passed.
- Application, engine, payment, merchant, tests, scripts, dependencies and CI files are byte-identical
  to the approved implementation. All release changes are Markdown documentation.
- Required AppShell, both Vision files and Step 8.5/8.6/8.7 regression files are tracked.
- Four protected original/acceptance ledger SHA-256 hashes match the pre-release values.
- History scan examined 599 unique blobs; credential patterns found no matches. Exact matching
  against three local secret values also found no historical exposure. This is scoped evidence,
  not a guarantee that every possible secret format was detected.
- No tracked runtime ledger, private artifact, non-template environment file, key, node_modules,
  build output, temporary probe or sensitive screenshot was found. MIT code license and Inter's
  font license remain intact. Existing `.gitignore` already excludes the local files; no change needed.
- README/setup/checklist local links resolve; current Markdown contains no absolute personal machine
  paths or raw provider payment IDs. Preserved historical revisions may contain non-credential
  Sandbox identifiers. No Git history was rewritten.
- Repository description edit returned HTTP 404; existing generic description is unchanged. The
  suggested replacement is saved for a repository administrator to apply.
- Repository visibility remains **private**. Publication here means pushing the authorized review
  branch, not changing repository visibility or deploying a public application.

Private verification logs and hash records remain outside Git in `../artifacts/step-9/`.
No actual payment, workspace reset, recording or Devpost submission occurred during this release.

## Final remote handoff

The final published SHA is verified against local HEAD and the PR head after the handoff commit.
CI status is checked on that final head; the exact result is reported in the owner-facing handoff.
PR #3 remains open and unmerged, with teammate acceptance requested. No reviewer username was
invented or assigned without an intended reviewer list.

## Remaining human actions

1. Teammate product acceptance/code review; resolve any concrete submission blockers.
2. Owner-authorized PR approval/merge through the existing integration workflow.
3. Repository administrator makes the code repository public as required by the official rules, and may
   apply the suggested description. Private invitations alone are insufficient; review preserved history
   before changing visibility.
4. Prepare the final video script, record, add the actual video URL, and submit Devpost manually.

Ready for teammate acceptance and Step 9C video preparation. Final submission testing access still
requires the public-source action documented below. No recording, submission or merge occurred.

## Judge Testing Access follow-up

**Runtime verification completed; submission-access blocker remains: repository is private.**
The [official rules](https://paypalaihackathon.devpost.com/rules) allow local setup instead of hosting,
require public licensed source and free access through judging. MIT is present; private code remains
a blocker. No visibility change was made. Earlier access wording is corrected in the release docs.

### Actual isolated runtime verification

Tested a fresh archive of published release `e545792fb299e3bccc83f7df80ed9e51bce0cf76`, using
its own `npm ci`, a new blank-provider `.env` copied from the template, a whitelisted child environment
with no Gemini/PayPal secrets, unique ledger and a separate local port 3317. Owner environment files,
keys, services and financial workspaces were not modified. Financial date was fixed at Nov 12, 2026.
This was a running Next.js application, not only a build check.

| Feature | Actual result without Gemini or PayPal credentials |
| --- | --- |
| Runtime/provider config | Server starts; config reports `ai:false`, `paypal:false`, `simulation:true`. |
| Dashboard | UI and HTTP API work; 45 daily balances; checking $3,500, minimum $1,720, delayed-income $1,540, capacity $90. |
| Goals | UI and API work; clean Alex dates Mar 14 / Apr 13 / Apr 13, 2027; Shopping-adjusted investing becomes Mar 14 before purchase. |
| Money Planning | Rendered planning overview and dated commitments; readiness and planning APIs work. |
| Budget What-if | UI/API preview of Shopping $90 → $30 shows capacity $90 → $122; complete ledger bytes and financial snapshot unchanged by API preview. |
| Budget application | Explicit UI and API application work in separate temporary workspaces; checking stays $3,500; minimum $1,738, stress $1,572, capacity $122. |
| Shop analysis | UI/API Explore works; $900 full-price minimum $838, stress $672, red risk; goal dates Mar 14 / Apr 13 / Apr 13. No provider request is needed. |
| Fallback explanations | Money and purchase endpoints return `source:template`; Money UI labels deterministic explanation and displays source-backed values. |
| Free-text Ask RiskPilot | Without a key, API returns 503 with an explicit Gemini-not-configured message; guided page questions remain usable. This path does not promise template free-text answers. |
| Goal drafting | AI draft requires Gemini; manual goal creation/editing remains available. |
| Vision | HTTP and rendered standalone concept work without keys, with future-concept labeling. |
| Payment/state integrity | Zero orders, zero purchases in the probe workspace; analysis does not mutate its financial snapshot. No capture/simulation-save action was invoked. |

Browser interaction independently confirmed Money preview, deterministic explanation, explicit
application, resulting $122 capacity, projected Goals, Shop impact and Vision. A screenshot and exact
HTTP results remain private in `../artifacts/step-9-access/`, outside source. A temporary shared-
dependency attempt was discarded; the reported successful run used a real isolated `npm ci`.

### Launchers and credentials

No launcher checks for Gemini. `npm run dev` is the verified credential-free financial entry point.
`npm run demo` and `npm run demo:shop` intentionally check PayPal configuration. A read-only Shop
launcher check against the no-key runtime exits 1 with: “PayPal Sandbox is not configured.” This is
not a Gemini failure and requires no source/configuration correction; the three modes are now explicit.

### Gemini availability and free access

Source `lib/ai.ts` and `.env.example` use `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.6-flash`.
The existing REST integration calls standard `generateContent` and sends the key in a server-side
header. Google's [model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash) lists this
stable model with structured output support. [Pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.6-flash)
lists free-tier standard input/output. No model was changed, no paid-only dependency introduced, and
no new live Gemini call or judge-account eligibility is claimed.

README Mode 2 links [AI Studio keys](https://aistudio.google.com/apikey), Google's
[key setup](https://ai.google.dev/gemini-api/docs/api-key) and
[project rate limits](https://ai.google.dev/gemini-api/docs/rate-limits). Judges create/select their
own eligible project/key, retain the configured model in ignored `.env`, and restart the app. Some
projects require verification; quota and regional/account eligibility can limit live testing. The
financial mode needs neither payment details nor a Gemini key.

### PayPal Sandbox and remaining access actions

README Mode 3 documents the free Sandbox setup from [PayPal REST setup](https://developer.paypal.com/api/rest/)
and [test accounts](https://developer.paypal.com/tools/sandbox/accounts/): a Sandbox REST app/business
seller, matching `PAYPAL_CLIENT_ID` / `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, server-only
`PAYPAL_CLIENT_SECRET`, and a separate Personal buyer whose password stays in the provider login.
It documents the Sandbox API base, local 3100/3200 origins, bridge-key handling, combined startup and
the distinct Shop Pay Now versus Northstar Continue/review/final-confirm journeys. Gemini is optional
for both. No actual provider checkout or capture was initiated during this verification.

All advertised categories of functionality have a documented path without mandatory paid
subscriptions for eligible free provider accounts. Mode 1 is immediately credential-free; live AI and
provider checkout require eligible credentials and available quotas. This is not a guarantee of
unrestricted access for every judge. The owner must make the source public and, if account/region/
quota restrictions prevent testing, arrange a no-charge hosted test environment with server-held
keys and dedicated test login details delivered privately in submission instructions. Never publish
personal API keys, client secrets, buyer passwords, signing secrets or private environment files.

Only documentation changed. Core implementation, model configuration and financial behavior remain
identical to the approved freeze. Final release metadata and CI are reported in the owner handoff.
