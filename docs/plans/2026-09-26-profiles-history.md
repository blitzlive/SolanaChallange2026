# Profiles and container history implementation plan

**Goal:** Separate customer and merchant pages, require merchant confirmation, show EUR deposits with a small SOL estimate, and retain/export every customer's loans.

**Architecture:** Extend the existing React/Express/SQLite MVP. Two routes share one origin and inventory. Short-lived merchant sessions bind returns to the selected business. Demo identities remain browser-local capabilities; public display IDs are derived separately and cannot authorize access.

**Tech stack:** Existing TypeScript, React, Zod, Express, SQLite and Playwright.

## Assumptions and decisions

- User explicitly requested implementation. Continue on the existing working tree and preserve previous uncommitted improvements.
- Local single-process pilot, tens of users, no real funds. Operator maintains backups and credentials. No new names or emails collected.
- Use two pages (`/`, `/geschaeft`) rather than separate ports to avoid unnecessary deployment/CORS complexity.
- Demo represents EUR 1/2/5. Optional test-USDC adapter stays explicitly labelled; do not relabel its actual transactions as euros.
- SOL estimate uses an explicitly labelled illustrative rate, not a claimed live quote or settlement price. No network dependency for offline demo.
- SQLite is authoritative; authenticated CSV export is a portable MVP data view, not a competing ledger.
- All participating merchants accept all registered containers. Unknown physical containers still require registration.

## Steps

1. Extend shared types, persistent loan history, non-secret user ID and escaped CSV export. Verify identity isolation and repeated loans.
2. Add expiring merchant sessions, explicit demo sign-in, location binding and logout. Verify unauthorized returns, cross-location acceptance and unchanged refund idempotency.
3. Separate customer/merchant navigation and forms; extend wallet with current/all containers, dates, sites and CSV download; show EUR and illustrative SOL clearly.
4. Replace only the large festival image with a cream/sage asset using built-in image generation; preserve cup selection icons.
5. Run unit/API tests, build and browser flow tests. Inspect desktop/mobile screenshots. Update README, architecture and verification with observed results and remaining limitations.
