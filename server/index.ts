import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { Keypair } from '@solana/web3.js';
import { z } from 'zod';
import { readConfig } from './config';
import { createApp } from './app';
import { LoanService } from './service';
import { Store } from './store';
import { SolanaPayments } from './solana';

const env = readConfig();
const production = process.argv.includes('--production');
mkdirSync(env.DATA_DIR, { recursive: true });
const store = new Store(resolve(env.DATA_DIR, `${env.PAYMENT_MODE}.sqlite`));
let payments: SolanaPayments | undefined;
if (env.PAYMENT_MODE === 'devnet') {
  let bytes: number[];
  try { bytes = z.array(z.number().int().min(0).max(255)).length(64).parse(JSON.parse(env.TREASURY_SECRET_KEY!)); }
  catch { throw new Error('TREASURY_SECRET_KEY must be a JSON array of 64 test-wallet bytes.'); }
  payments = new SolanaPayments(env.SOLANA_RPC_URL, Keypair.fromSecretKey(Uint8Array.from(bytes)));
  await payments.assertDevnet();
}
const app = createApp(new LoanService(store, env.PAYMENT_MODE, payments), {
  origin: new URL(env.APP_ORIGIN).origin, merchantToken: env.MERCHANT_TOKEN, production,
});
if (production) {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  app.use(vite.middlewares);
  app.get('/{*path}', async (req, res, next) => {
    try { res.type('html').send(await vite.transformIndexHtml(req.originalUrl, readFileSync('index.html', 'utf8'))); }
    catch (error) { next(error); }
  });
}
app.listen(env.PORT, env.HOST, () => {
  console.log(`PfandLoop: http://localhost:${env.PORT} · ${env.PAYMENT_MODE === 'demo' ? 'SIMULATION — no real payments' : 'DEVNET — test USDC, custodial treasury'}`);
});
