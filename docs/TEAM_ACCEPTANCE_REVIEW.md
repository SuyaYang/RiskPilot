# RiskPilot teammate acceptance review

The owner reports a final independent GO audit for implementation freeze `77730d2`. Core product scope is frozen; this review checks blockers and clarity before submission. The release has 324 passing automated tests. No teammate approval is implied.

- Release branch: [cynthia](https://github.com/SuyaYang/RiskPilot/tree/cynthia)
- Review PR: [#3 — Finalize RiskPilot](https://github.com/SuyaYang/RiskPilot/pull/3).
- Setup: [RUNNING.md](../RUNNING.md). Use your own isolated browser profile and ledger paths; never experiment in the recording or accepted payment workspace.

## A. First impression

- [ ] The purpose is immediately clear: financial context at the moment of PayPal payment.
- [ ] Dashboard, Goals, Money and Shop feel visually coherent.
- [ ] Current capabilities and the future concept are easy to distinguish.

## B. Dashboard

- [ ] Sign in as fictional `alex@riskpilot.demo` in a clean workspace at `DEMO_TODAY=2026-11-12`.
- [ ] Identify $3,500 checking, $1,720 minimum cash, $1,540 delayed-income minimum and $90 available to allocate.
- [ ] Inspect upcoming income/bills and clearly fictional spending history.
- [ ] Explain why allocation capacity differs from the checking balance.

## C. Money Planning

- [ ] Preview Shopping $90 → $30/month. Before explicit application, return to Dashboard and confirm the formal state is unchanged.
- [ ] Explicitly Apply to money plan. Confirm minimum $1,738, delayed-income minimum $1,572 and capacity $122; checking remains $3,500.
- [ ] Category suggestions, planning confirmations and applied assumptions are distinguishable.
- [ ] If inspecting income, verify that unsupported replacement dates/cadence remain planning-only with original salary active. Do not assume arbitrary employment changes are supported.

## D. Goals

- [ ] Priorities, contributions and estimated completion dates are understandable.
- [ ] After the Shopping adjustment, baseline dates are Japan March 14, Emergency April 13 and investing March 14, 2027.
- [ ] For the immediate $900 purchase preview, Japan/Emergency dates hold while investing moves to April 13. The explanation does not imply that unchanged dates make the red-risk purchase safe.

## E. RiskPilot Shop

- [ ] Explore the laptop impact without starting payment. Navigation and scenario selection create no purchase.
- [ ] Compare buy now ($838 / $672, red), after payday ($1,334.54 / $672, yellow), educational Pay in 4 ($1,513 / $1,122, green) and Pay Monthly ($1,738 / $1,572, green).
- [ ] Installments are explicitly hypothetical; the monthly estimate includes modeled costs and actual checkout remains full price.
- [ ] Wait/skip/future-date comparisons do not initiate payment.
- [ ] The Shop architecture is clear: final Pay Now in PayPal, followed by verified capture; an unchanged assessment has no redundant RiskPilot confirmation.

## F. Northstar merchant journey

Read the flow or inspect it without paying: merchant checkout → Sandbox buyer approval → signed RiskPilot review → explicit Confirm and Pay → verified receipt → updated forecast.

- [ ] Understand that **approval grants permission; capture records payment**. Merchant Continue/approval alone never captures.
- [ ] The review explains amount, currency, buffer, delayed-income risk and goals before Confirm and Pay.
- [ ] Skip/Cancel and same-order recovery are understandable.
- [ ] Use the [historical sanitized acceptance](STEP7B_ACCEPTANCE.md) to review verified capture/receipt/update evidence without generating another payment.

Optional Sandbox acceptance requires **explicit human approval**, your own Sandbox personal buyer and an isolated workspace. It is not part of automatic review. Stop before the provider's final confirmation in Shop or RiskPilot's Confirm and Pay in Northstar unless separately approved. Never use the recording workspace for experimental purchases.

## G. Vision

- [ ] Open `/vision` directly.
- [ ] It is clearly a future concept, not the official PayPal app or an already implemented native integration.
- [ ] The potential PayPal ecosystem opportunity is clear without unmeasured retention/conversion claims.

## H. Feedback and approval

Report reproducible bugs, confusing interactions, unclear financial explanations, critical checkout friction, broken setup instructions and misleading claims. Include the page, viewport, date/persona, expected versus actual behavior and sanitized evidence. Do not post credentials, provider IDs or local ledgers.

Classify each item as **Submission blocker**, **Minor polish**, or **Future product suggestion**. Optional ideas do not reopen frozen feature scope.

**Would the financial review genuinely help you make a better purchase decision?**

Please leave product acceptance and code-review feedback in the PR. Request owner approval before merging; no automatic merge is authorized. Existing PR #1 remains the subsequent integration-to-main review.

## Ready-to-send team message

Hi team — RiskPilot's final implementation has passed the independent audit reported by the owner,
with 324 automated tests passing. The release is on `cynthia`; please review
https://github.com/SuyaYang/RiskPilot/pull/3 and use the checklist at
https://github.com/SuyaYang/RiskPilot/blob/cynthia/docs/TEAM_ACCEPTANCE_REVIEW.md.
Please do final product acceptance and code review in isolated test workspaces, focusing on
submission blockers, financial clarity, checkout UX and setup friction. Core scope is frozen;
label optional ideas as future suggestions. No experimental purchases in the recording workspace;
new Sandbox acceptance requires explicit human approval. Please leave your approval or blockers
in the PR and obtain owner approval before merging. Nothing has been merged automatically.
