# RiskPilot submission materials

## Project name

RiskPilot

## Tagline

Financial intelligence at the moment of PayPal payment.

## Short project summary

RiskPilot brings financial context to PayPal checkout. Users explore cash flow, protect a buffer, adjust supported planning assumptions and see how a purchase could affect savings goals before paying. Two PayPal Sandbox journeys connect that review to verified capture and an updated outlook. A deterministic TypeScript engine owns the financial calculations; Gemini organizes grounded explanations, with deterministic fallback when AI is unavailable.

## Elevator pitch

A price tag tells you what a purchase costs, but not what it changes. RiskPilot connects financial planning to the moment of PayPal payment. Users review upcoming bills, a delayed-paycheck scenario and savings goals, then compare buying today, waiting until after income or exploring educational installment schedules. They can improve supported spending assumptions and see the effect before deciding. Our TypeScript engine calculates the financial facts; Gemini makes those facts easier to understand without controlling money. The experience works both inside RiskPilot Shop and through an independent Northstar merchant, with distinct PayPal confirmation flows and verified capture updating the outlook once. The result is a working Sandbox prototype of payment as an informed decision, built around user choice.

## Full Devpost project description

### Inspiration

A checkout page can tell you exactly what a laptop costs. It rarely tells you what buying it could mean for next week's bills, an emergency reserve or a trip you have been saving for. Even a purchase that looks affordable today can become difficult if a paycheck arrives late.

We wanted to bring personalized financial context into the moment when that decision is actually made. RiskPilot turns payment from an isolated transaction into a financially informed decision. PayPal is central to that experience: the review connects directly to checkout, and a verified payment connects back to the user's updated financial outlook.

### What it does

RiskPilot helps users understand financial health, discover spending patterns, improve a plan and explore a purchase before choosing whether to pay. Dashboard shows a cash-flow forecast, upcoming obligations, a protected buffer and available-to-allocate capacity. Goals shows contribution priorities and estimated completion dates. Money combines fictional spending history, budget suggestions, explicit application of supported category changes and conservative income planning.

In our fictional Alex demo, checking starts at $3,500, the minimum projected cash is $1,720 and available-to-allocate capacity is $90. Applying a Shopping budget change from $90 to $30 per month raises the projected minimum to $1,738 and capacity to $122, without increasing checking cash.

From that adjusted plan, buying a $900 laptop today produces a minimum of $838 and a delayed-income minimum of $672. Waiting until after payday improves the normal minimum to $1,334.54, but the late-income check still matters. The immediate purchase leaves Japan Trip's March 14 and Emergency Fund's April 13 estimates unchanged, while Start investing moves from March 14 to April 13, 2027. Capacity becomes zero. Those different effects make the trade-off concrete.

Users can also compare educational Pay in 4 and Pay Monthly schedules, wait or skip. These are simulations, not approved financing. After an equivalent full-price Sandbox capture, the updated forecast agrees with the immediate-purchase preview under unchanged assumptions.

### How we built it

We built the interface with Next.js, React and TypeScript, with local JSON persistence for the demo and a separate Node.js Northstar storefront. The deterministic engine calculates 45-day cash flow, seven-day delayed-income stress, cash-buffer risk, goal contributions and completion estimates. Longer payment schedules extend affordability checks through their final payment while keeping the visible chart at 45 days.

Category changes replace explicitly covered spending assumptions rather than adding another expense. Additional planned income is treated conservatively. Only timing-compatible income replacements become authoritative; unsupported timing changes remain planning-only and retain the original modeled salary.

Our principle is: **Deterministic engine for financial truth. Generative AI for personalized understanding.** Gemini receives server-generated evidence to organize grounded explanations. Purchase and Money reviews use approved fact IDs rendered as server-authored statements. Invalid or unavailable AI falls back to deterministic explanations. AI neither sets payment amounts nor authorizes purchases.

We implemented two PayPal Sandbox journeys. In RiskPilot Shop, users explore impact first, then make their final confirmation in PayPal. At Northstar, PayPal buyer approval leads to a signed RiskPilot review; capture happens only after explicit Confirm and Pay. Server verification connects each completed capture to one purchase record and one saved forecast.

### Challenges we ran into

The hardest problems were about consistency, not generating more persuasive text. A purchase cost must not be counted twice alongside the buffer shortfall it causes. A hypothetical immediate purchase must agree with the completed financial state. Future payments must consume existing cash headroom once, with remaining costs assigned to the right contribution periods.

Income planning also required clear boundaries: a proposed schedule is not proof of a raise, a new payday or guaranteed cash. We protected current assessments against stale financial inputs, kept explanations tied to current evidence and preserved the difference between PayPal approval and capture in two distinct confirmation flows. These safeguards support the prototype without claiming to solve every production payment or reconciliation problem.

### Accomplishments that we're proud of

We completed a working merchant-integrated Sandbox journey and a separate RiskPilot Shop flow, connecting planning, purchase analysis, verified payment and updated projections. Historical acceptance includes two provider-confirmed Sandbox captures: a $900 Northstar purchase and a $249 Shop purchase, using test funds rather than production money.

The approved implementation has 324 passing automated tests, successful TypeScript validation and a production build. Financial reference scenarios were independently reproduced, security and payment behavior were checked with deterministic mocks, and the owner received a final independent GO audit. The historical captures predate the last financial correction; final validation did not execute another live capture. We also built a standalone Vision page that communicates the next product opportunity honestly.

### What we learned

Financial AI is most useful when it helps people understand trustworthy calculations. Payment approval and capture must stay distinct, and financial consistency matters more than attractive numbers. A purchase can affect goals differently; an unchanged completion date does not erase a cash-buffer warning. Users need visible trade-offs and meaningful choice, rather than a simplistic yes or no.

### What's next for RiskPilot

We want to explore deeper PayPal ecosystem integration, subject to platform capabilities and permissions, alongside permissioned financial data, production authentication, real-account reconciliation and more complete income and expense models. Our Vision concept imagines reasons to return to PayPal not only to pay, but also to plan. Better trust, engagement and checkout decisions are hypotheses we would evaluate with users, not outcomes we have already measured.

## PayPal integration description

PayPal connects RiskPilot's financial review to an actual payment lifecycle in Sandbox. Users can explore impact without starting a transaction, then choose whether to proceed.

RiskPilot Shop evaluates the purchase first. Its PayPal Checkout uses PAY_NOW and commit:true, so the buyer's final confirmation happens in PayPal. A current, unchanged assessment needs no redundant RiskPilot confirmation. The independent Northstar merchant instead creates a server-priced order using CONTINUE and commit:false. Buyer approval leads to a signed RiskPilot impact review; payment is captured only after the user explicitly selects Confirm and Pay.

Both journeys verify ownership, financial freshness, assessment expiry, amount and currency on the server. Capture verification and same-order recovery create one economic purchase record and one saved forecast. Historical acceptance includes a $900 Northstar capture and a $249 Shop capture in Sandbox; no production money was used. Those captures predate the final financial correction, which was tested with deterministic probes and mocks. Educational installment comparisons do not enable or approve PayPal financing. PayPal is the bridge between understanding the consequences and completing the chosen purchase.

## Technical architecture summary

RiskPilot uses Next.js, React and TypeScript for Dashboard, Goals, Money, Shop and purchase review, plus an independent Node.js HTTP merchant storefront. A deterministic TypeScript engine calculates 45-day cash flow, delayed-income stress, protected cash capacity, goal contributions and purchase scenarios. Longer installment schedules extend existing safety evaluation without extending the visible chart. Local JSON persistence stores isolated fictional workspaces, planning assumptions, purchases and immutable capture snapshots. Gemini receives server-generated evidence to organize financial explanations, with validation and deterministic fallback. It does not control balances or payments. The PayPal JavaScript SDK and Orders v2 API support the two Sandbox journeys; server verification, signed merchant handoffs, freshness checks and idempotent recording connect completed capture to an updated forecast. Banking feeds and production authentication are future work.

## Future vision

RiskPilot's standalone Vision page imagines financial intelligence closer to the PayPal experience: understand your position, explore a purchase and make a payment with useful context. A deeper integration would depend on PayPal platform capabilities and permissions. Future work includes permissioned financial data, production identity, real-account reconciliation and more comprehensive income and expense modeling. We would test whether this gives people more reasons to return to PayPal to plan as well as pay, and whether it improves trust or decision quality. These are product hypotheses; the concept is not an implemented native PayPal integration.

## Built With

Next.js, React, TypeScript, Node.js, Google Gemini API, PayPal JavaScript SDK, PayPal Orders v2 API, HTML, CSS, JSON, npm, node:test, tsx

## GitHub repository description

RiskPilot brings financial context to PayPal checkout with deterministic cash-flow and goal projections, grounded AI explanations, and verified Sandbox payments.

## Project links

- Repository: https://github.com/SuyaYang/RiskPilot
- Release branch: https://github.com/SuyaYang/RiskPilot/tree/cynthia
- Review PR: Pending creation; replace only with the verified PR URL.
- Demo video: **Not yet available — final recording has not been made.**
- Repository access: currently private; judge access or an owner-approved visibility change remains necessary.
