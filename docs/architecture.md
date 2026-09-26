# PfandLoop architecture

## September 26: profiles and history extension

Two pages share the existing origin: `/` for customers and `/geschaeft` for merchants. Merchant login creates a random, eight-hour server-memory session bound to one location. Devnet login requires the operator secret; demo login is explicitly simulated. Both return endpoints require the session and reject a mismatched location. Logout revokes it. All registered containers are accepted across locations. Refund amounts and original payers remain immutable.

```mermaid
flowchart LR
  Customer[Customer page /] --> Wallet[Private wallet + all loans + CSV]
  Business[Merchant page /geschaeft] --> Session[Login + location-bound session]
  Session --> Return[Physical return confirmation]
  Wallet --> API[Express + Zod]
  Return --> API
  API --> DB[(Shared SQLite loans)]
  API --> Adapter[Simulation / existing Devnet adapter]
```

Demo display units are simulated EUR, with 1/2/5 catalog prices; underlying integer accounting and historical snapshots remain intact. A clearly labelled illustrative EUR/SOL rate is informational only. Devnet still settles test USDC, separately labelled. A derived public user ID is not an authentication credential. Wallet history/CSV require the original demo capability and contain no bearer capability or private receipt IDs in exports. SQLite remains the source of truth and retains repeated loans of the same cup. Sessions reset on server restart; production user/staff identity management remains future work.

## Scope and assumptions

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
