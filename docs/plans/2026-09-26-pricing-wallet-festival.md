# Per-container deposits, demo wallet and festival artwork

**Goal:** Coffee 1 USDC, festival 2 USDC, lunch 5 USDC; usable demo wallet; distinct festival illustration and party photo.

1. Centralize deposit amounts in shared catalog. Snapshot integer atomic amount on every new loan; migrate historical loans without an amount to their original 3 USDC. Refund the snapshot, never the current catalog price.
2. Derive demo-wallet balance (20 simulated USDC minus outstanding deposits) and deposit/refund history from persisted loans. Use the browser's random demo identity as a bearer capability on a demo-only endpoint. Do not expose arbitrary real-wallet history.
3. Add accessible wallet dialog with loading/error/empty/history states and refresh. Reuse the existing browser demo identity; preserve previously saved receipts.
4. Generate and save a local festival product photo via built-in image generation. Update the existing native cup art to a lidless festival tumbler with a music motif; display the party image when festival is selected, including on mobile.
5. Update amounts throughout UI/API/Devnet transactions and receipts. Test all prices, historical migration, exact refund amount, wallet isolation/history/reload, and responsive artwork/dialog behavior.
6. Update documentation, run tests/build/browser suite and inspect screenshots. No mainnet work or unrelated files.
