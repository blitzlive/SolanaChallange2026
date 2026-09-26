# Verification and security notes

## Verified locally on 2026-09-26

- TypeScript strict typecheck passed.
- 22 unit/API tests passed: full loan lifecycle, concurrent borrowing, unconfirmed payments, failed verification, persistent state after database reopen, private receipt projection, signature uniqueness, preserved refund transaction across timeout/retry, original refund recipient, staff authorization, physical receipt requirement, input validation, cross-origin rejection and security headers.
- Production build passed with Vite 8.3.1 and React 19.3.0.
- All four Playwright/Edge browser tests passed: desktop borrow -> reload -> return at another location; mobile deep link -> invalid input -> borrow -> return; additional 768px/1024px layouts. No desktop page exceptions and no horizontal overflow at tested sizes.
- Desktop (1440px) and phone (375px) screenshots were opened and visually inspected. The UI renders the selected cup, deposit action, receipt and return flow without observed clipping.
- SPL token instruction encoding was compared byte-for-byte against `@solana/spl-token@0.4.15` in a passing test before removing that package. Fixed public-address/amount fixtures retain the derivation and encoding checks.

## Dependency assessment

An online npm audit initially found vulnerable native `bigint-buffer` via the SPL helper package, plus outdated UUID and a streaming JSON parser via the legacy web3 RPC package. The vulnerable native dependency was removed. Only the two standard token instructions this application needs are encoded using Node's built-in integer buffer APIs, with official-SDK comparison and fixed-vector tests. The nested UUID dependency is overridden to compatible CommonJS-capable v11.1.1 or newer within that major.

The remaining **three moderate audit findings** are one advisory propagated through `stream-json -> jayson -> @solana/web3.js`: [GHSA-528h-pc64-c93x](https://github.com/advisories/GHSA-528h-pc64-c93x). The reported filters have quadratic behavior on deeply nested JSON. This app uses web3's HTTP RPC client and does not expose Jayson's streaming parser/filter API. This is an exposure assessment, not a claim that the dependency is patched. A force-downgrade of the Solana SDK is not a suitable remedy. Migrate to the current Solana Kit/Wallet Standard stack or a reviewed upstream patch before production.

## Not verified / not implemented

- **No live Devnet transfer was executed.** No funded customer wallet, operator key or staff token was supplied. RPC methods are mocked in local tests. Phantom approval, actual network finality and test-token transfers still require the documented Devnet walkthrough.
- No smart-contract escrow is deployed. The optional adapter is custodial and restricted to Devnet.
- No production security audit, accessibility certification, legal assessment or live merchant pilot was performed.
- Delayed/expired deposits and ambiguous/expired refunds require manual reconciliation. The prototype prefers holding a container reservation over risking duplicate payouts.
- No GitHub remote or public deployment is configured.

## Reproduction

Run `npm test`, `npm run build`, `npm run test:e2e`. Use online `npm audit`; this environment's offline npm mode can misleadingly report zero findings without a fresh registry check. E2E databases/screenshots are isolated under ignored `.data/` and `test-results/`; they do not consume the main demo inventory.
