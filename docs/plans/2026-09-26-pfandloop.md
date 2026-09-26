# PfandLoop Implementation Plan

**Goal:** A running, persistent two-screen deposit MVP with an explicit demo and configurable Solana Devnet test-USDC adapter.

**Architecture:** Browser -> validated API -> loan service -> SQLite/payment adapter. Keep custodial Devnet transfers clearly separated from simulated payments.

**Tech Stack:** React, Vite, TypeScript, Express, node:sqlite, Zod, Solana web3.js/SPL Token, Vitest, Playwright.

1. Create standalone local Git repository, package scripts, strict TypeScript config, ignored runtime files and environment example.
2. Implement `shared/model.ts`, `server/store.ts`, `server/service.ts`: registered cups, unique active loan, persistent receipt and transitions. Test duplicate borrowing, physical return, original-recipient binding and idempotency.
3. Implement `server/solana.ts`: Devnet guard, exact-message payment verification, persisted signed refunds, retry without double transfer. Unit-test verification boundaries independently of a live RPC.
4. Implement `server/app.ts` and `server/index.ts`: validated endpoints, operator auth, request limits, same-origin policy and Vite/static hosting. Test API behavior with Supertest.
5. Implement `src/` UI: responsive two-screen workflow, wallet integration, cup QR, receipt recovery, staff return, errors and accessible loading states.
6. Run typecheck, tests, production build and browser checks at phone/desktop sizes. Inspect screenshots and fix observed defects.
7. Write setup instructions, Devnet provisioning, resource findings, pilot pitch and honest verification limits. Inspect Git diff/status and make initial commit if Git identity is configured.

No external repository or public deployment is created without a specified target. The local repository fulfills initial project setup.
