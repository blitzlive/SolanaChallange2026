# PfandLoop agent instructions

Read the workspace rules in `../.management/Codex.md` and `../.management/instructions.md` before changes. Project decisions live in `docs/architecture.md`.

- Keep the UI German and code/documentation English.
- Default to explicit demo simulation. Never silently switch to real funds or mainnet.
- The first payment adapter is custodial Devnet test USDC. Do not describe it as deployed smart-contract escrow, EURC or euros.
- Refund only to the original stored payer, only after authorized staff confirmation, and never re-sign an uncertain refund automatically.
- Preserve the unique active-loan constraint and exact finalized transaction-message verification.
- Do not print, commit or expose `.env`, treasury keys, operator tokens or private receipt IDs.
- Keep public demo data fictional and label simulation. Do not invent traction or competitor claims.
- Run `npm test` and `npm run build` after backend changes. Also run `npm run test:e2e` after flow/UI changes; inspect affected screenshots.
- Document unresolved verification and custody/recovery limitations in `docs/verification.md` and README.
