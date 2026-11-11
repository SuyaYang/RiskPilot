# Fixed demo accounts and checkout access

Updated November 10, 2026. This supersedes the earlier in-account **Demo profile** selector instructions.

## Presentation sequence

Use the existing Northstar merchant on `http://localhost:3200`. Merchant checkout creates its server-priced order, opens PayPal buyer approval, then automatically opens the signed RiskPilot review before capture. The buyer can explicitly confirm, reopen the same order to change PayPal funding, or cancel back to Northstar. Chat/Copilot interaction and visiting RiskPilot Shop are optional, never prerequisites for merchant checkout. Unintegrated external merchants are not automatically intercepted.

RiskPilot `/shop` remains the independent proactive exploration flow: users can assess scenarios/What-if without PayPal approval or an order/payment. The checkout membership gate applies to order-scoped review detail; it does not remove proactive exploration.

## Demo identities

Open `/login` from the account link. Enter a fictional email:

| Email | Fixed financial profile | Checkout access |
| --- | --- | --- |
| `alex@riskpilot.demo` | Alex | Premium demo: concise summary plus expandable scenarios/What-if |
| `jordan@riskpilot.demo` | Jordan | Basic demo: concise summary and all essential risk/payment controls |

The legacy Sam fixture is retained as `sam@riskpilot.demo` (Premium demo) for existing workspace/payment compatibility; it is not shown as an in-account financial-scenario selector.

An explicit account cookie determines both the profile and fixed demo entitlement. The old persona selector is removed; `/api/personas` returns only the current account's single profile and rejects persona-switch writes. An old `rp_persona` cookie is used only when there is no explicit account cookie, preserving existing saved order ownership. Once an account is selected, changing the retired persona cookie cannot switch that account's profile. Re-entering the same account uses the same state in its existing browser workspace.

**These are fictional account-entry and membership demonstrations, not production authentication, real subscriptions or billing.** There are no passwords or charges. Browser workspace isolation remains; fictional account state is not synchronized between different browsers. A real account system and verified server billing entitlements are still future work. RiskPilot demo identity is separate from the PayPal Sandbox buyer identity.

## Basic versus Premium checkout

Basic buyers see one concise AI/template explanation, purchase amount, critical current/stress buffer risk, goal-warning count, payment status, explicit confirmation and available change-method/cancel controls. Warnings and funding disclosures are never paywalled. Detailed scenario options/timing/forecast curves are removed from the Basic order-review payload; only the full-price critical assessment remains. Detailed order insight requests and personalized order analysis are rejected server-side. Basic payment, status lookup, recovery and cancellation have no Premium requirement.

Premium buyers can expand scenario comparisons, cash-flow detail and supported future-date What-if. Hypothetical scenarios do not select PayPal funding or establish actual eligibility/loan terms. Profile explanations use confirmed facts when available; otherwise the concise standard explanation remains available.

## Payment button fix

The black PayPal continuation button and SDK Pay Later element now occupy explicit grid cells, avoiding inline-baseline offset. Both desktop controls have equal width and 48px height; mobile stacks them with a 12px gap. Their existing eligibility checks, SDK callbacks, approval redirect and server capture paths are unchanged.

## Verification

- **135 tests pass**, TypeScript and production build pass.
- New API regressions cover fixed identity despite a conflicting legacy cookie, one returned profile, rejected persona-switch/entitlement-injection writes, repeat sign-in persistence, Basic critical-risk payload, forbidden detailed endpoints, Premium scenarios, cross-account ownership, and Basic simulation recording exactly once.
- Browser sign-in verified Jordan → fixed Jordan/Basic dashboard, then Alex → fixed Alex/Premium dashboard. No in-account profile selector is present. Basic review showed the concise summary and essential controls without detailed scenarios; Premium expanded four payment scenarios.
- Actual PayPal SDK rendering on the main demo: both desktop buttons measured identical top coordinates and 48px height, including the internal Pay Later button. At 390px, controls stacked at equal width/height with no document overflow. Screenshots are in the parent workspace as `payment-buttons-aligned-desktop.jpg` and `payment-buttons-aligned-mobile.jpg`.
- Browser account/review checks used an isolated ledger with provider credentials disabled. No browser confirmation/capture was performed. The payment-button check did not start PayPal approval or create a payment order; it only assessed a purchase and inspected available controls. Existing real Sandbox payment records were preserved.
