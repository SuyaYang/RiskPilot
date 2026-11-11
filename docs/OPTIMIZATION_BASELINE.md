# Optimization roadmap baseline

Recorded November 10, 2026 before this sequential commit pass.

- Repository: Next.js 15 / React 19, deterministic TypeScript financial engine, single-instance JSON ledger, existing Gemini adapter and signed Northstar merchant bridge. No new framework or production architecture is required.
- Starting commit: `3815e5c`. Its existing automated suite has 85 passing tests.
- The working tree already contained prior Phase 1–4 implementations and two-flow acceptance work: 131 tests passed, TypeScript passed, and earlier production build evidence was recorded. These changes were uncommitted. This pass preserves and separates them into dependency-complete phase commits; it does not discard existing work.
- Gaps found: mobile merchant confirmation followed optional analysis; the default AI overview was hidden when no profile preference was confirmed. The UI pass moves confirmation before detailed analysis and exposes one concise grounded explanation.
- Flow A: `/shop` assessment uses `/api/decisions`, with no payment creation during exploration. Flow B: Northstar creates/approves an order and automatically opens signed RiskPilot review, without a prior Shop visit. Both call the existing assessment engine.
- Existing Phase 2 documentation records an actual Sandbox capture and matching provider/merchant/RiskPilot ledgers. This pass will distinguish fixture checks from any new live-provider evidence.
- `.env`, payment ledgers, external services and real-money behavior remain outside source commits. Temporary validation uses isolated ledgers and disabled provider credentials.

Each phase is validated before committing. Both flows are release gates throughout.
