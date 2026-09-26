# PfandLoop · SolanaChallange2026

A small reusable-container deposit prototype for cafes and festivals. German browser UI, persistent loans, cross-location returns, receipt recovery, cup QR links and an optional Solana Devnet payment adapter.

**Default: interactive simulation, no money or wallet required.** Customer deposit prices are **€1 for coffee**, **€2 for festival** and **€5 for lunch**. The demo simulates EUR balances. A small SOL equivalent uses the labelled illustrative rate **1 SOL = €100**, not a live quote or payment conversion. The optional Devnet adapter still transfers 1/2/5 **test USDC** in a custodial operator wallet; its actual test currency is shown separately. A custom escrow program is **not** implemented or deployed. This is not a mainnet payment product.

## Start

Requires Node.js 24+ and npm. From this project directory:

```powershell
npm install
npm run dev
```

Open the customer page at **http://localhost:5174/** and the business page at **http://localhost:5174/geschaeft**. These are two separate pages/profiles on the same port and database. Use `npm run dev` (not `npx run dev`). No `.env` is needed for the demo. To serve the production build locally:

```powershell
npm run build
npm start
```

One Node process serves the frontend and API. The three registered demo IDs are `LOOP-001`, `LOOP-002`, `LOOP-003`. Data persists under `.data/demo.sqlite`; Devnet uses a separate `.data/devnet.sqlite`. Do not run multiple server processes against the same database.

## Try the demo

1. Select a container at Café Morgenrot and click **Pfand hinterlegen · Demo starten**.
2. Refresh the page: the receipt is restored from its locally saved ID.
3. Open **Geschäftsseite** (also works in a separate browser). Select Wiesenklang Festival and click **Demo-Geschäft anmelden**. Enter the cup number if needed.
4. Confirm physical receipt of the container and click **Rückgabe bestätigen**.
5. The original payer receives the simulated refund. The cup is available for a new loan.

The QR button generates a real URL containing the cup ID. Scan it with the phone's normal camera; there is no in-app camera scanner. A localhost URL cannot be opened from a different device. Phone tests need a reachable HTTPS origin, matching `APP_ORIGIN`, and an appropriate server bind address. Demo staff login is deliberately public and simulated. Return endpoints still require a server-issued business session, the matching business location and explicit physical receipt. Sessions expire after eight hours, logout or server restart; refreshing the business page requires another login. Both locations are fictional. Every business accepts all three registered containers, including containers issued elsewhere. Unknown/unregistered cups are not accepted.

Click **Demo-Wallet** in the customer header. Every browser demo wallet starts with €20 of simulated funds. Deposits reduce available funds; merchant-confirmed returns release the original amount. The dialog shows a stable public user ID, balance, held deposits, every loan (including returned cups and repeat loans), dates, issue/return sites and payment/refund history. Filter by **Alle Ausleihen** or **Noch offen**; **CSV exportieren** downloads the full history regardless of the filter. CSV uses UTF-8 with BOM and semicolons for German spreadsheets. It excludes private wallet/receipt capabilities. Data is persisted in SQLite; CSV is an export, not an alternative ledger. Refresh/reopen the wallet after a business return to update its status.

The private random demo identity stays in browser storage; clearing storage creates a new identity. The displayed `USER-…` ID cannot authorize wallet access. These are MVP demo profiles, not production authentication or real blockchain-wallet history. No deposits or refunds move real funds.

Amounts are stored on each loan. Existing loans from the original 3-USDC version keep their original integer refund amount; only new loans use the 1/2/5 pricing. Demo presentation is now simulated EUR; Devnet receipts retain their actual test-USDC currency. Do not reset the database to apply new prices. Festival selection preserves the small orange cup icon; the large left [AI-generated festival artwork](docs/festival-artwork.md) now uses cream, sage and forest green to match the coffee design.

## Optional Devnet setup

```powershell
npm run setup:devnet
```

This explicit setup command creates a new test-only operator key and random staff token in ignored `.env`. It refuses to overwrite an existing `.env` and only prints the public address. Review Windows file permissions; never share/commit `.env` or use a treasury containing real funds.

1. Fund the printed **operator** address with Devnet SOL for refund network/account fees using the [Solana faucet](https://faucet.solana.com/).
2. Use a separate **customer** Phantom wallet. Enable testnet mode / select Solana Devnet. Obtain Devnet SOL and enough test USDC for the chosen cup (1 coffee / 2 festival / 5 lunch) from the [Circle faucet](https://faucet.circle.com/). Do not use mainnet USDC.
3. Restart `npm run dev`. The header must say **SOLANA DEVNET**. The backend rejects RPCs with a non-Devnet genesis hash.
4. Borrow and approve the wallet transaction. If necessary, copy its signature from Phantom into the receipt and choose **Zahlung prüfen** after finalization. Sending a transaction is not enough to mark a deposit paid.
5. On `/geschaeft`, the operator selects a business and enters `MERCHANT_TOKEN` from local `.env` to log in. Confirm the physical container and submit. Choose **Rückzahlung prüfen** until the saved transaction is finalized (confirm physical receipt again on each attempt). The entire original deposit returns to the original wallet; network fees are separate. The shared operator credential authorizes both pilot business profiles; individual staff credentials are not implemented.

The customer pays deposit fees and, if needed, creation of the treasury's token account. The operator pays refund fees and recipient account creation if necessary. Devnet faucet/rate limits and wallet compatibility can affect the flow. Current wallet integration targets the injected Phantom provider; other wallets and mobile deep links are not implemented.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PAYMENT_MODE` | `demo` | `demo` or `devnet`; no mainnet mode |
| `PORT` | `5174` | HTTP port |
| `HOST` | `127.0.0.1` | Loopback; `0.0.0.0` only for intentional network access |
| `APP_ORIGIN` | `http://localhost:5174` | Exact allowed browser origin for mutations |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Server-only Devnet RPC |
| `TREASURY_SECRET_KEY` | unset | JSON array of 64 bytes; required for Devnet |
| `MERCHANT_TOKEN` | unset | At least 32 characters; required for Devnet return authorization |
| `DATA_DIR` | `.data` | Private persistent database directory |

## Routes

| Route | Purpose |
| --- | --- |
| `/`, `/?cup=LOOP-001` | Customer page, wallet/history and cup links |
| `/geschaeft`, `/geschaeft?cup=LOOP-001` | Business login and physical return confirmation |
| `GET /api/config` | Mode, public inventory, fictional locations |
| `GET /api/demo-wallet` | Demo-only balance/history for the `Authorization: Bearer demo-UUID` capability |
| `GET /api/demo-wallet/export.csv` | Authenticated full loan-history export for that same demo capability |
| `POST /api/merchant/session` | Validated location; Devnet operator bearer credential required; returns an eight-hour session |
| `POST /api/merchant/logout` | Revoke the supplied merchant session |
| `POST /api/loans` | Reserve a cup; simulate payment or prepare a Devnet transaction |
| `GET /api/loans/:id` | Receipt recovery by unguessable receipt ID |
| `POST /api/loans/:id/confirm` | Verify finalized deposit against stored exact transaction message |
| `POST /api/returns/:cupId` | Staff-authorized return of current loan |
| `POST /api/loans/:id/refund` | Idempotent staff-authorized retry of a specific refund |

## Checks

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit
```

Browser tests use installed Microsoft Edge (`msedge`) and start an isolated production server on port 5175 with a separate database. For another platform, change the Playwright channel and install the desired browser. Screenshots and traces go to ignored `test-results/`. See [verification](docs/verification.md) for actual results and remaining limitations.

## Operational limits

- Single-process pilot, not a high-availability service. Back up the SQLite database and operator credentials separately. Loan UUIDs are private receipt capabilities; do not publish them.
- A QR identifies a container but does not prove physical return. Staff confirmation is the trust boundary.
- Pending or expired deposits remain reserved. Pending refunds retain their original signed transaction; the service never generates a second payment just because an RPC request timed out. An expired transaction or lost signature requires manual operator reconciliation. This intentionally conservative behavior needs an automated recovery job before a public pilot.
- No per-merchant financial ledger, inventory balancing, production identity system or physical cup verification is included. Demo merchant login is public; do not expose it as real staff authentication. Business session tokens remain in page memory, not local storage.
- The SOL estimate is an offline illustration, not a current exchange rate. No SOL payment adapter or live quote provider is implemented.
- The service stores wallet addresses and operational events. It does not collect names, emails or bank details. Blockchain transfers are public.
- No service subscription is charged by the prototype. Infrastructure, token-account rent, network fees, logistics and support still have costs.

## Project documents

- [Architecture and decisions](docs/architecture.md)
- [Implementation plan](docs/plans/2026-09-26-pfandloop.md)
- [Resource review, ideas and pilot pitch](docs/research-and-pitch.md)
- [Verification and security notes](docs/verification.md)

This is a standalone local Git repository. No GitHub remote or public deployment has been created.
