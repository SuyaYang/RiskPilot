# RiskPilot inside PayPal Sandbox checkout

**Earlier optional experiment.** The current accepted flow needs no extension:
store → PayPal Continue → RiskPilot review → confirm → store receipt.
Use [the merchant checkout walkthrough](../docs/MERCHANT_CHECKOUT.md). The extension is not loaded
or installed by `npm run demo`.

Intended flow: **independent shopping website → PayPal payment window with impact panel → original
PayPal payment button**. No RiskPilot Shop or return-to-RiskPilot review step is required.

## Build and load

From the repository root (Node 20.6+):

```bash
npm ci
npm run build:extension
```

The ready-to-load directory is `extension/dist`. In Chrome, open `chrome://extensions`, turn on
Developer mode, select **Load unpacked**, and select that directory. Loading the extension grants it
the ability to read and modify matching PayPal **Sandbox** checkout pages in this browser. Review
and accept that access yourself before loading it. Reload an already open Sandbox checkout after
installation or extension updates.

The manifest contains only two top-level content-script matches:

- `https://www.sandbox.paypal.com/pay/checkout*`
- `https://www.sandbox.paypal.com/checkoutnow*`

There is no access to live `paypal.com`, other shopping websites, login pages, cookies, browser
history, network request interception, remote services, or stored credentials. Content scripts run
in Chrome's isolated world. The code reads only order-total and payment-method DOM labels; the
manifest still grants page-level content access, so the prototype must be reviewed like an extension,
not represented as a permissionless PayPal feature. Calculation uses bundled fictional profiles;
no financial data is sent anywhere. No payment buttons are clicked or changed by the extension.

## Independent shopping website

Use the existing `.env` with matching PayPal Sandbox server/browser client IDs and server secret.
Do not publish `.env` or embed the merchant secret in the extension.

```bash
npm run merchant-demo
```

Open `http://localhost:3200`. **Northstar Electronics** is a separate local merchant demonstration,
not the RiskPilot dashboard and not an actual third-party retailer. Its $900 server-owned quote
creates a real Sandbox order. The merchant now uses `CONTINUE` and SDK `commit: false`; approval
opens RiskPilot review and requires explicit confirmation. The optional extension can demonstrate
alternate panel placement during approval, but does not replace the current confirmation flow.

The RiskPilot app on port 3100 must also run for the current merchant flow. Do not run multiple
merchant server processes against the same `data/merchant-demo.json`. The separate local ledger
persists order/capture IDs and ownership; the new signed confirmation bridge also records captures
and versioned forecasts in the RiskPilot dashboard.
An uncertain creation without an order ID fails closed for manual recovery rather than issuing a
new create request. Status lookup recovers completed captures; retries use the same capture key.

## Demonstration

1. Install the Sandbox extension and start the merchant server.
2. In Northstar Electronics, choose **Check out with PayPal Sandbox**.
3. Log in with the **Sandbox personal buyer**. Do not use a live account.
4. On PayPal's payment-method page, the extension mounts above the original payment button. If the
   page shows `$` without a currency code, select **Use USD for this Sandbox demo** first.
5. See lowest cash, cash-buffer headroom/shortfall and maximum goal delay. **Details** shows the
   Sam/Alex/Jordan fictional profile selector, income-late stress case, affected goals and dates.
6. Change the actual payment method using **PayPal's own controls**. The extension detects supported
   selections; its forecast-comparison buttons change only its own estimates, never PayPal's choice.
   Monthly terms unknown to RiskPilot default to a conservative full-price forecast. The optional
   monthly illustration assumes 12 months at 19.99% APR, not the actual PayPal loan offer.
7. Stop before PayPal's button for an extension-placement preview. In the current merchant flow,
   Continue / Review Order opens RiskPilot review. The final payment confirmation is on that page;
   the extension does not replace or skip it.
8. For unknown payment outcomes, use the merchant's **Check order status** instead of starting over.

## Validation and remaining limits

`npm test` includes real-HTML-parser fixtures for checkout totals, conflicting amounts, unsupported
currencies, installment selections, calculations, narrow manifest scope, and independent merchant
ownership/create/capture/recovery. `npm run typecheck` checks the extension and merchant TypeScript.
`npm run build:extension` bundles the same engine used by the dashboard, without provider secrets or
remote scripts. `npm run build` checks the existing web app.

**Actual extension installation, real PayPal DOM mounting, small-window layout, payment-method
changes and the complete new Sandbox merchant payment flow are not yet verified in Chrome.**
PayPal's DOM is not a stable extension API; unrecognized layouts or missing totals show unavailable
rather than invented impact. Legacy/localized checkout layouts may need additional adapters.
The prototype has no bank connection or production identity, and has not been submitted to the
Chrome Web Store. Do not describe it as PayPal-approved or universally available on real stores.

PayPal-native rollout would require a PayPal partnership/internal implementation. The extension is
the working-build route for demonstrating the desired placement independently of merchant changes.

Official references: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts),
[loading an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked),
[PayPal SDK v6](https://developer.paypal.com/sdk/js/set-up),
[hackathon functionality requirements](https://paypalaihackathon.devpost.com/rules).
