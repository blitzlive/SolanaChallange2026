# PfandLoop Architecture

## MVP: Together for our environment

PfandLoop is an open, Solana-powered reusable container deposit system designed for instant, cross-merchant micro-settlements. Customers access their personal **Customer Dashboard** (protected by User Login) to monitor their active cups, deposits, and transaction history. Participating merchants access the dedicated **Merchant Station** (`/geschaeft`, protected by Merchant Login) to issue cups to customers (by Member/User ID, with future QR scan support) and confirm physical cup returns with automated deposit refunds.

```mermaid
flowchart TD
  subgraph Auth ["Separate Authentication Gates"]
    UserGate["User Login Mask (/)\nCredentials: user-demo / 123456"]
    MerchantGate["Merchant Login Mask (/geschaeft)\nCredentials: demo / 123456"]
  end

  subgraph Customer ["Customer Portal (/)"]
    UserGate --> Dashboard["Customer Dashboard\nWallet & Active Containers"]
    Dashboard --> MemberCard["Digital Membership Card\nUser ID / QR code"]
    Dashboard --> UniversalNotice["Universal Return Notice\nAccepted across all partner stores"]
  end

  subgraph Merchant ["Merchant Station (/geschaeft)"]
    MerchantGate --> Station["Station Workspace\nFiltered by Location Type"]
    Station --> IssueTab["Cup Issuance (Ausgabe)\nLocation-Restricted & Infinite Instance Generation\nMulti-cup / Multi-user issuance"]
    Station --> ReturnTab["Cup Return (Rücknahme)\nPhysical receipt verification\nAutomated refund"]
  end

  subgraph ValidationRules ["Location-Based Cup Constraints"]
    CafeRule["Café Morgenrot: Coffee Cups & Lunch Bowls ONLY (No Festival Cups)"]
    FestivalRule["Wiesenklang Festival: Festival Cups ONLY (No Coffee/Bowls)"]
    ReturnRule["Universal Return: Any store accepts any cup"]
  end

  subgraph Engine ["Backend API & Core Engine"]
    API["Express API + Zod Validation\nRate-limiting & security headers"]
    Service["Loan State Machine\nReserve -> Borrowed -> Refund -> Returned"]
    DB[("SQLite Database\nInfinite Cup Instances, Loans & Wallets")]
  end

  subgraph Settlement ["Settlement & Blockchain Layer"]
    MVPStore["MVP Wallet Ledger\nInstant credit/debit"]
    ProofOfIdentity["Solana Blockchain Proof-of-Identity\nMemo program / Explorer verification (Mainnet Beta)"]
    MainnetSolana["Solana Mainnet Beta\nOn-chain transaction verification"]
  end

  Dashboard --> API
  Station --> API
  API --> ValidationRules
  ValidationRules --> Service
  Service --> DB
  Service --> MVPStore
  Service --> ProofOfIdentity
  ProofOfIdentity --> MainnetSolana
```

### Key Architectural Updates:
1. **Two Distinct Views & Login Masks**:
   - **User View (`/`)**: Requires customer login (`user-demo` / `123456`). Leads to the personal wallet dashboard.
   - **Merchant View (`/geschaeft`)**: Requires merchant staff login (`demo` / `123456`). Leads to container issuance & returns.
2. **Location-Based Container Issuance Constraints**:
   - **Café (Café Morgenrot)**: Can ONLY issue Coffee cups (`LOOP-001`) and Lunch Bowls (`LOOP-003`). Issuing Festival cups is strictly prohibited.
   - **Festival (Wiesenklang Festival)**: Can ONLY issue Festival cups (`LOOP-002`). Issuing Coffee cups or Bowls is strictly prohibited.
   - **Returns**: Any participating location can accept and refund any registered cup.
3. **Infinite Cup Issuance with Unique Instance & Transaction IDs**:
   - Stores can issue an unlimited number of containers.
   - Each container issuance generates a unique container instance / serial number and transaction ID.
   - Supports issuing multiple cups to different users simultaneously.
4. **On-Chain Solana 'Proof of Identity' on Mainnet Beta**:
   - Every deposit and refund transaction is anchored to the Solana blockchain with a cryptographically verifiable 'Proof of Identity' on Solana Mainnet Beta.
   - Transactions are verifiable directly on Solana Explorer (`cluster=mainnet-beta`).
5. **Realistic Solana Exchange Rate**: Offline reference price set to **1 SOL ≈ €145.00**.



Build a reusable-container deposit pilot for independent cafes and festival stands. The first vertical slice is borrow -> payment -> staff-verified return -> refund to the original payer. Two fictional locations and three registered containers make the demo reproducible. The user explicitly requested implementation; this document records the working assumptions for that first iteration.

- German, mobile-first browser interface; browser-local customer profile and explicit merchant login; no installation.
- Demo mode works immediately without wallets, secrets or internet. It is visibly simulated and never presented as a blockchain transaction.
- Optional Solana **Devnet only** integration uses 1 test USDC for coffee, 2 for festival and 5 for lunch, not EUR or EURC. Users need Phantom and test SOL for network fees/account creation.
- The first adapter uses a custodial operator wallet, **not a deployed escrow smart contract**. No real funds, mainnet, legal compliance or production readiness is claimed.
- Pilot scale: one Node process, SQLite on local disk, tens of simultaneous users. Expected local API latency below 300 ms; blockchain confirmations are asynchronous and not promised within one second.
- Operator maintains the service and funds test refunds/fees. Wallet addresses are pseudonymous, not anonymous. No names, emails or banking details are collected.
- Persistent states survive restarts; transactions with uncertain outcomes remain pending rather than triggering a second payout.

## Components

```mermaid
flowchart LR
  Guest[Guest: cup QR / number] --> UI[React + TypeScript browser]
  Staff[Staff: return + operator token] --> UI
  UI --> API[Express API + Zod validation]
  API --> Service[Loan state machine]
  Service --> DB[(SQLite: cups, loans, payment intents)]
  Service --> Demo[Explicit simulation adapter]
  Service --> Chain[Solana Devnet adapter]
  UI --> Wallet[Phantom: deposit signature]
  Wallet --> RPC[Solana Devnet]
  Chain --> RPC
  Chain --> Treasury[Operator test-USDC wallet]
```

## State and payment boundaries

`available -> reserved -> borrowed -> refund_pending -> returned`.
Only one active loan per cup (SQLite partial unique index). Deposits are defined in integer atomic USDC units in the shared catalog: coffee 1,000,000; festival 2,000,000; lunch 5,000,000. Each loan snapshots its amount; historical loans without an amount migrate to the original 3,000,000 units. Refunds always use that snapshot. The server builds a transaction with a unique loan memo and stores the exact message. A submitted signature is accepted only after a successful finalized Devnet transaction with that exact message. This binds payer, mint, amount, destination, memo and blockhash together and blocks receipt substitution/replay. Store the signature uniquely.

Returns require an unexpired, location-bound merchant session and an explicit physical-receipt checkbox. Devnet session creation requires the operator bearer token. The destination is always read from the original loan, never supplied by the return caller. Prepare and persist the signed refund before sending it. Retries send the same signed bytes, never a newly signed payment. An expired/failed ambiguous refund requires operator investigation; automatic transaction replacement is deliberately excluded from this slice.

Demo simulates transitions in the same database without real keys or network calls. Different database files isolate demo and Devnet. Demo staff access is deliberately public and labelled; bind the server to loopback by default.

The demo wallet starts with 20 simulated EUR and derives its available balance, held deposits and full loan/payment history from persisted loans. Its random browser-local `demo-UUID` is a bearer capability for the demo-only wallet and CSV endpoints; no real wallet history is exposed. Returning a loan releases its original deposit exactly once. Public user/loan display IDs derive from SHA-256 and do not authorize access. CSV is escaped, formula-neutralized and omits bearer capabilities. No separate mutable balance ledger or external transfers are introduced.

## Security

Validate request bodies and environment with Zod. Parameterize SQLite queries. Use request size limits, same-origin mutation checks, rate limits and security headers. Keep private keys and operator token server-only in ignored `.env`. Do not expose RPC credentials to the client. Reject non-Devnet genesis hashes before constructing blockchain transactions. No public endpoint enumerates payer addresses; the random loan UUID acts as a receipt capability. Only opaque status is shown for occupied cups. Staff authentication uses constant-time comparison; never log tokens, keys or request bodies.

Physical return is a trust boundary: a printed QR code proves container identity, not physical possession. Authorized staff verify the object. QR cloning and dishonest staff need operational controls or stronger tags before a public pilot.

## Design contract

Cream paper background, ink-green typography, forest-green primary actions and a restrained lime accent. Editorial serif headlines with system sans-serif controls. A cup illustration is drawn as a small original SVG, not downloaded artwork. Two workspaces: borrow and return. The main action remains visible at phone width, labels are explicit, minimum 44px touch targets, focus outlines, live errors and success receipts. Include loading, empty, reserved, borrowed, wallet-missing, rejected-payment and pending-refund states. Respect reduced motion; avoid fabricated environmental statistics.

## Decisions

| Decision | Alternatives | Reason |
| --- | --- | --- |
| React/Vite + Express/SQLite | Next.js; browser-only mock | One small local process, real persistent workflow and testable server boundaries |
| Demo default + opt-in Devnet | Wallet required at first launch | Pitch is usable immediately while real network work remains explicit |
| Custodial test treasury for first slice | Custom Anchor escrow | No deployed contract/toolchain exists yet; avoid misrepresenting custody |
| Test USDC | EURC; SOL deposit | Stablecoin flow, official test mint; never conflate USD and EUR |
| Staff-authorized returns | Public QR-triggered refunds | Copied QR cannot authorize a payout |

## Next milestone

Deploy/test a token escrow program with per-loan PDA vaults, merchant authority, replay protection, refund-to-original-owner and explicit closure/rent rules. Then wallet-standard/mobile integration, sponsored fees, staff identities, reconciliation/recovery jobs, audit and pilot validation. No mainnet release until these are reviewed.
