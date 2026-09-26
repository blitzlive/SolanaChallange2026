# PfandLoop: reusable containers, one shared deposit loop

PfandLoop is a reusable-container deposit MVP for cafes, buffets and festivals. Customers borrow at one participating business and return at another. Staff confirm physical receipt, and the deposit returns to the original payer. A customer wallet shows every past and current loan, with a CSV export for a portable overview.

## Our response to the Solana challenge

**Our proposal is to connect a familiar everyday action—returning a reusable cup—to a shared digital payment flow.** The deposit follows the borrower across participating businesses instead of requiring the original checkout location to handle the return.

The exact challenge brief and judging criteria are not included in this repository. This section presents the project's contribution based on the current product brief; it does not claim compliance with an unverified track or official rubric.

| Question | PfandLoop's answer |
| --- | --- |
| What problem are we exploring? | How independent locations can share a deposit-and-return workflow with clear repayment records. Merchant demand and operational savings still need field validation. |
| Who benefits? | Customers returning cups or bowls, staff receiving them, and organizers coordinating several stands. |
| What does the MVP demonstrate? | Borrowing, persistent deposits, merchant-confirmed returns across locations, original-payer refunds and a complete customer loan history. |
| Where does Solana fit? | The optional Devnet adapter prepares and verifies test-token deposits and refunds through a common operator treasury. Transaction signatures provide independently inspectable payment evidence. |
| What remains off-chain? | Container registration, loan state, customer demo history and merchant authorization. Staff—not a QR code or blockchain—verify physical return. |
| What would a first pilot test? | One event with two stands: return completion, staff effort, customer onboarding and reconciliation, compared with existing cash/card processes. |

The intended benefit is interoperability between locations, not a claim that existing reuse systems require an app or that blockchain is necessary for every deposit. The demo works without blockchain; a pilot must establish whether shared wallet-based settlement adds enough value to justify onboarding and custody costs.

## Run the app

Install Node.js 24 or newer and npm, then run:

```sh
git clone https://github.com/blitzlive/SolanaChallange2026.git
cd SolanaChallange2026
npm install
npm run dev
```

Open the two pages on the same server:

- **Customer:** `http://localhost:5174/`
- **Business:** `http://localhost:5174/geschaeft`

No wallet, credentials or real money are needed for the default demo. Its customer balance starts with **20 simulated euros**. All locations and activity created for demonstration are fictional.

## Customer walkthrough

1. Choose a container: coffee cup `LOOP-001` (€1), festival cup `LOOP-002` (€2) or lunch bowl `LOOP-003` (€5).
2. Select the issue location and click **Pfand hinterlegen · Demo starten**. The app records the loan and holds its simulated deposit.
3. Open **Demo-Wallet**. It shows your public user ID, available balance, deposits held and every container loan, including previous returns and repeated loans of the same container.
4. Switch between **Alle Ausleihen** and **Noch offen**, or use **CSV exportieren** to download the complete history with dates, locations and status. SQLite is the persistent database; CSV is a read-only export.
5. Hand the container to a participating business. A customer cannot confirm their own return from the customer page.
6. After staff confirmation, reopen the wallet or select **Guthaben aktualisieren**. The deposit is released and the returned loan remains in the history.

The demo identity stays in the current browser. Clearing browser storage creates a different profile. The displayed user ID is not a login credential. The complete wallet history and CSV are demo features; authenticated history for real Solana wallets is not implemented.

## Business walkthrough

1. Open **Geschäftsseite**, including from a separate browser if desired.
2. Select a business and click **Demo-Geschäft anmelden**. Demo sign-in is deliberately public and simulated.
3. Enter the returned container's number. Every participating business accepts every registered pilot container, regardless of where it was issued. Unknown containers must be registered before they can participate.
4. Physically inspect and receive the container, then tick **Ich habe den richtigen Behälter physisch entgegengenommen.**
5. Click **Rückgabe bestätigen**. The backend requires a valid business session, binds the return to that business, and refunds the original stored payer and deposit amount.
6. Use **Abmelden** when finished. Sessions expire after eight hours or server restart; reloading the business page also requires signing in again.

To demonstrate the open loop, borrow at **Café Morgenrot** and return at **Wiesenklang Festival**. Only one active loan can exist per container. The three catalog entries represent three individually registered containers, not unlimited stocks of each type.

## How Solana is used

The optional adapter runs on **Solana Devnet only**. Its current implementation transfers **test USDC**, not euros or native SOL deposits. The EUR catalog and the small SOL estimate are presentation features; the displayed rate **1 SOL = €100** is a labelled offline example, not a live quote or currency conversion.

```mermaid
sequenceDiagram
  participant C as Customer / Phantom
  participant A as PfandLoop API + SQLite
  participant S as Solana Devnet
  participant B as Business staff
  C->>A: Request loan for a registered container
  A->>A: Reserve container and snapshot deposit amount
  A-->>C: Prepared test-USDC deposit transaction
  C->>S: Sign and submit deposit to operator treasury
  C->>A: Submit transaction signature
  A->>S: Read finalized transaction
  A->>A: Verify exact message and mark loan borrowed
  B->>A: Authorized physical-return confirmation
  A->>A: Persist signed refund to original payer
  A->>S: Submit stored refund transaction
  A->>S: Check refund finality on subsequent confirmation
  A->>A: Mark loan returned after finalized refund
```

- **Deposits:** The backend builds a token transfer and a loan-specific memo. Phantom signs for the customer. A loan is paid only after a successful finalized transaction matches the exact stored transaction message.
- **Custody:** Test funds are held in an operator wallet. There is no deployed custom escrow smart contract or per-loan on-chain vault.
- **Returns:** Staff confirmation triggers a refund to the original stored wallet; the return caller cannot choose a different recipient or amount.
- **Retry safety:** The signed refund is persisted before submission. Retries reuse the same signed bytes; an uncertain or expired refund requires operator investigation rather than a newly signed payment.
- **SOL:** Devnet SOL pays network fees and, when necessary, token-account creation costs. It is separate from the test-USDC deposit.
- **Evidence:** Devnet receipts link transaction signatures to Solana Explorer. Container ownership, physical possession and merchant honesty are not proven by those transfers.

The application uses Solana's existing token and memo programs. The next proposed on-chain milestone is a reviewed escrow program with per-loan vaults and merchant authority, followed by recovery procedures and simpler wallet onboarding. These are future work, not current features.

## Try the optional Devnet flow

1. Stop the demo server and run `npm run setup:devnet`. This creates a test operator wallet and merchant token in ignored `.env`; it refuses to overwrite an existing configuration.
2. Fund the operator with Devnet SOL. Use a separate customer Phantom wallet with Devnet SOL and enough test USDC for the selected 1/2/5 test-token deposit.
3. Restart `npm run dev` and verify the header says **SOLANA DEVNET**.
4. Borrow a container, approve the Phantom transaction and use **Zahlung prüfen** to confirm finalization. Do not pay again while a submitted payment is pending.
5. On the business page, log in using the operator credential, receive the container and confirm the return. Use **Rückzahlung prüfen** until finalization; do not create a replacement payout for an uncertain result.

See the [README](README.md#optional-devnet-setup) for setup, faucet links, environment variables and troubleshooting boundaries. No live Devnet transfer has been verified for this submission; network and wallet interaction still require that walkthrough with funded test wallets.

## Current evidence and limits

The local verification recorded for this MVP comprises **36 unit/API/payment tests**, **6 browser tests**, a successful production build and desktop/mobile visual inspection. Coverage includes cross-location returns, merchant authorization, history isolation, CSV export and original-payer refund safeguards. See [verification notes](docs/verification.md) for the scope and reproduction commands.

The MVP has no production staff identity management, live EUR/SOL rates, real EUR settlement, mainnet deployment, deployed escrow, merchant balance settlement or automated resolution of ambiguous payments. Container transport, cleaning and QR-cloning resistance also require operational solutions. No measured adoption, environmental savings or production readiness is claimed.

**Challenge pitch:** Borrow here, return there, receive your deposit back. PfandLoop demonstrates an open reuse loop with merchant-confirmed physical returns and an optional Solana test-payment rail. The goal is to make small everyday deposits portable between independent businesses, while keeping the user experience understandable in euros.
