# PfandLoop: research and pilot pitch

Research date: 2026-09-26. Sources are starting points, not endorsements. No third-party installer was executed.

## The supplied resources

- [Solana.new](https://www.solana.new/): AI-assisted Solana building resources, skills and idea scaffolding. Direct fetching initially timed out; the indexed page was accessible. Its installation shell script was not run. Useful for subsequent program development and ecosystem integration.
- [Superteam Germany BuildStation](https://de.superteam.fun/buildstation): workshops, community, product/pitch feedback and hackathon submission support. Best next step: get a merchant and a Solana mentor to critique the live borrowing/return flow.
- [Superteam idea bank](https://superteam.fun/build/ideas): the accessible page links ideas, grants and past winners; the interactive idea listing was not exposed in the fetched page. We did not pretend to evaluate unseen entries.
- [5 Ways to Find Stronger Ideas for the Solana Hackathon](https://youtu.be/ldi-nGpDuI4): the video URL/title was reachable, but no transcript or video content was available to this research tool. No advice is attributed to the unseen video.

## Corrected assumptions

[RECUP](https://recup.de/en/) explicitly says an app is not required. [Vytal's FAQ](https://www.vytal.org/faq) also describes app-free bank-card borrowing. Therefore “competitors force everyone to install an app” is not a defensible pitch. Unverified monthly fee ranges from the initial brief are not repeated as fact.

The better hypothesis: independent operators want interoperable deposits, portable evidence and automatic repayment to the original payer, without each return location funding a separate cash payout. Solana supplies a shared payment rail and publicly verifiable receipts; blockchain does not prove that a physical object was returned.

[Solana fees](https://solana.com/docs/core/fees) include a per-signature base fee and optional priority fees, paid in SOL. Token account creation can add rent funding. The product must not promise a permanent USD fee ceiling or one-second finalized settlement. No software subscription is charged by this prototype; hosting, support, cups, cleaning, loss, SOL and on/off-ramp costs still exist.

[Circle's mint registry](https://developers.circle.com/stablecoins/usdc-contract-addresses) identifies Devnet USDC as `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. These tokens have no financial value. 3 USDC is not 3 EUR; future EURC support requires an explicit currency choice and verified mint. No exchange rate is assumed.

## Three narrow product directions

| Direction | First user | Core feature | Main uncertainty |
| --- | --- | --- | --- |
| FestivalLoop | One event, two drink stands | Return at either stand, refund original wallet | Wallet onboarding and mobile connectivity |
| CampusLoop | Two university cafes | Shared container IDs and cross-cafe returns | Why this beats existing deposit partners |
| FoodTruckLoop | A recurring street-food market | Portable bowls with shared refund handling | Cleaning and physical inventory balancing |

**Recommended first field pilot:** one campus event with two stands and 20 labelled containers. The current demo uses a fictional cafe and festival return station to illustrate the same cross-location loop. It does not claim those are live partners.

## 60-second pitch

“PfandLoop keeps the deposit attached to the borrower, not to the till. Borrow a reusable cup at one stand and return it at another. Staff confirm the cup and the deposit goes back to the original wallet. Our prototype demonstrates a shared container registry and a complete deposit lifecycle, with an optional Solana Devnet test-payment adapter. The first version uses an operator treasury; the next milestone replaces that trust with a reviewed escrow program. We start with one campus event, two stands and one working loop.”

## First users and evidence to gather

1. Interview one event organizer and two independent cafe operators. Observe their existing cash-deposit flow; do not assume reconciliation is painful.
2. Recruit through the university entrepreneurship club and the organizer's vendor network. Show the live demo and ask for a supervised test, not a subscription.
3. Measure actual checkout time, return completion, reconciliation effort and wallet-onboarding abandonment. No invented traction or CO2 savings.
4. Compare directly with cash, card terminal refunds and existing reusable-container networks. Stop or change the concept if wallet friction exceeds the operational benefit.

## Scope not yet solved

True on-chain escrow, gas sponsorship, non-crypto onboarding, EUR settlement, container logistics, cleaning, merchant balances, offline operation, permissioned merchant identities, QR cloning resistance, automated expired-intent recovery, production custody and applicable legal requirements need separate validation. No legal compliance claim is made.

Technical references: [Phantom transaction flow](https://docs.phantom.com/solana/sending-a-transaction), [SPL token transfers](https://solana.com/docs/tokens/basics/transfer-tokens).
