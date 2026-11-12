# HTTPS Sandbox deployment

The repository includes an optional two-service `render.yaml`: RiskPilot review and the
independent Northstar merchant. It creates **paid services and persistent disks** only when
explicitly imported into Render. No services are provisioned by a GitHub push; automatic deploys
are disabled. This remains a fictional-data, single-instance Sandbox demo, not production banking.

## Configure before testing

1. Connect this private GitHub repository to your Render account and select the `cynthia` branch.
   Review the proposed plan/disk costs before creating the Blueprint. Use your assigned public
   HTTPS domains; service names in the YAML do not guarantee domain availability.
2. Set `APP_ORIGIN` and `RISKPILOT_ORIGIN` on RiskPilot to its exact HTTPS origin. Set
   `RISKPILOT_ORIGIN` on Northstar to that same origin. Set `MERCHANT_ORIGIN` on both to Northstar's
   exact HTTPS origin. Never include a path/query or a trailing slash in environment values.
3. Set `MERCHANT_BRIDGE_ALLOWED_ORIGINS` on both to those two exact origins, comma-separated.
   Unlisted HTTPS, public HTTP, credentials, paths and wildcard origins are rejected. Redirects
   come from server configuration, not the browser's Host/Forwarded headers or return parameters.
4. The Blueprint generates `MERCHANT_BRIDGE_SECRET` on RiskPilot and references it from Northstar.
   A manual deployment must install the **same** 32+ character secret on both. Public deployments
   cannot fall back to independently generated local key files. Keep secrets in Render settings.
5. Configure Sandbox PayPal client ID/secret on both services (the same demo merchant app is
   sufficient), and `GEMINI_API_KEY` on RiskPilot. `gemini-3.6-flash` is the verified default;
   model availability is account-specific. No browser-facing Gemini key is used.
6. Keep one instance per service. RiskPilot writes `/var/data/demo-v2.json`; Northstar writes
   `/var/data/merchant-demo.json` on its separate disk. These disks preserve ledgers across deploys;
   they are not shared disks. Do not reset verified capture records or copy an active lock file.
   A crash can require reconciling a stale writer lock after verifying the recorded process exited.
7. `DEMO_TODAY=2026-11-10` pins fictional forecasts only; PayPal and signed tickets use real time.
   `DEMO_SEED_ENABLED=true` enables the explicit fictional demo simulation/reset controls, not real
   account operations. Disable this flag if those controls are unwanted on a public demo.

## Webhook and acceptance

After both HTTPS sites are running, register RiskPilot's `/api/webhooks/paypal` in the Sandbox
app and set its `PAYPAL_WEBHOOK_ID` on RiskPilot. Subscribe to capture COMPLETED, PENDING,
DECLINED, REFUNDED and REVERSED (see RUNNING.md). Validate actual provider signature delivery;
a fixture test does not prove a publicly reachable listener or successful provider registration.

Run store → PayPal Continue → RiskPilot review → explicit Confirm and pay → store receipt.
Check the provider capture once, the saved snapshot and duplicate confirmation. Test Alex's
post-purchase goal baseline and Jordan's explicit waiting recommendation. Test Gemini questions,
AI goal drafts and template fallback on provider failure. Restart each service and confirm the
same receipt/ledger remains readable; do not create another capture to test restart recovery.

Actual Render provisioning, public webhook registration/delivery and public browser acceptance
require the Render account, assigned HTTPS origins and provider setup. They are separate from
committing this configuration and passing local mocked integration tests.

References: [Blueprint spec](https://render.com/docs/blueprint-spec),
[persistent disks](https://render.com/docs/disks),
[Gemini models](https://aistudio.google.com/docs/models).
