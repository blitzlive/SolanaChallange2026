# Verification and security notes

## Verified locally on 2026-09-26

### Customer/business profiles, EUR presentation and full history

- 36 unit/API/payment tests passed. New coverage verifies both return endpoints reject unauthenticated customers, merchant session location binding/logout/expiry, every merchant accepting every registered cup from another issue site, repeat-loan persistence across database reopen, history isolation and CSV escaping/capability exclusion.
- `npm run build` passed, including strict TypeScript checks.
- All 6 Edge browser tests passed. Added a separate browser business account accepting a customer's cup, logout, repeat borrowing, full history/current-loan filtering, downloaded CSV content and labelled SOL estimate. Existing QR, pricing, refunds, reload, error/retry and 375/768/1024/1440px checks remain covered.
- Opened and inspected desktop customer, business login, confirmed return, wallet and mobile festival screenshots. No observed overlap or horizontal overflow. Active festival artwork loads at 1536 × 1024; small selector icons remain intact.
- No live rate/network dependency added: the SOL display explicitly uses an illustrative 1 SOL = EUR 100 rate. Currency changes affect demo presentation only; Devnet still uses labelled test USDC. Live FX, real SOL settlement, authenticated real-wallet history and production staff accounts remain unimplemented.
- No live Devnet transfer was performed. Existing original-payer, exact-message and uncertain-refund safeguards remain covered by local tests. Public demo login is simulated; Devnet business profiles share the existing operator credential. Eight-hour sessions live only in server/page memory and require login after restart/refresh.

### Per-container pricing / demo wallet / festival update

- 31 server/payment tests passed, including 1/2/5-USDC pricing, historical 3-USDC migration, repeatable migration, original-amount refunds, demo-wallet balance/history isolation and exact token instructions for each price and legacy amount.
- Production build and strict TypeScript check passed.
- All 5 Edge browser tests passed: coffee/festival/lunch prices and receipts, wallet opening/closing, available balance changes and refunds, wallet persistence after reload, error/retry, QR and responsive layouts at 375/768/1024/1440px.
- Wallet screenshots at desktop/mobile and the festival mobile screenshot were opened and inspected; no observed clipping or horizontal overflow. The generated festival image loads successfully from the local project asset.
- Running local API on port 5174 returns 1,000,000 / 2,000,000 / 5,000,000 atomic units for the three containers. Existing loan data is preserved.

### Initial bootstrap baseline

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
- The source remote is `https://github.com/blitzlive/SolanaChallange2026.git`. No public app deployment is configured.

## Reproduction

Run `npm test`, `npm run build`, `npm run test:e2e`. Use online `npm audit`; this environment's offline npm mode can misleadingly report zero findings without a fresh registry check. E2E databases/screenshots are isolated under ignored `.data/` and `test-results/`; they do not consume the main demo inventory.
