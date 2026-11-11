# Fixed fictional demo accounts

The final purchase-experience specification supersedes the earlier Basic/Premium demonstration.
All account tiers, checkout locks, detailed-analysis restrictions and upgrade prompts are removed.

Use `/login` to enter `alex@riskpilot.demo` or `jordan@riskpilot.demo`. Each identity maps to one
fixed financial situation in its browser workspace. The legacy Sam identity remains available as
`sam@riskpilot.demo` for existing payment ownership. There is no in-account financial persona
selector. Re-entering an account retains that workspace's data.

Every account receives the full merchant purchase review, charts, supported scenario comparisons,
What-if and AI explanations/fallback. Proactive exploration is payment-free for everyone.
Smart Recheck depends on verified prior purchase assessment, never account tier or a toggle.

These are fictional demo identities, not production authentication. No passwords, billing or real
subscriptions are implemented. Workspace/account cookies keep demo state scoped; state is not
synchronized across browsers. RiskPilot identity is separate from PayPal's Sandbox buyer sign-in.

The PayPal continuation and Pay Later SDK buttons retain equal 48px sizing on desktop and stack on
mobile. Eligibility, approval, final capture and recovery remain unchanged.

See [final purchase journeys and 147-test verification](FINAL_PURCHASE_EXPERIENCE.md).
