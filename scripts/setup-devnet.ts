import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Keypair } from '@solana/web3.js';

// Explicit user-run provisioning. Never runs during install, build or app startup.
const treasury = Keypair.generate();
const config = [
  'PAYMENT_MODE=devnet', 'PORT=5174', 'HOST=127.0.0.1',
  'APP_ORIGIN=http://localhost:5174', 'SOLANA_RPC_URL=https://api.devnet.solana.com',
  `TREASURY_SECRET_KEY=${JSON.stringify(Array.from(treasury.secretKey))}`,
  `MERCHANT_TOKEN=${randomBytes(32).toString('hex')}`, '',
].join('\n');
try { writeFileSync('.env', config, { flag: 'wx', mode: 0o600 }); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
    console.error('An .env already exists. No files changed. Configure it manually or back it up before retrying.');
    process.exitCode = 1;
  } else { throw error; }
}
if (!process.exitCode) {
  console.log('Created ignored .env with a NEW TEST-ONLY treasury and merchant token.');
  console.log(`Public treasury address: ${treasury.publicKey.toBase58()}`);
  console.log('Fund this address with Devnet SOL for refund fees. See README.md. Never send mainnet funds.');
  console.log('The operator token is in .env; it was not printed. Review local Windows file permissions.');
}
