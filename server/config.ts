import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PAYMENT_MODE: z.enum(['demo', 'devnet']).default('demo'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(5174),
  HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
  APP_ORIGIN: z.url().default('http://localhost:5174'),
  SOLANA_RPC_URL: z.url().default('https://api.devnet.solana.com'),
  TREASURY_SECRET_KEY: z.string().optional(),
  MERCHANT_TOKEN: z.string().optional(),
  DATA_DIR: z.string().default('.data'),
}).superRefine((env, ctx) => {
  if (env.PAYMENT_MODE === 'devnet') {
    if (!env.MERCHANT_TOKEN || env.MERCHANT_TOKEN.length < 32)
      ctx.addIssue({ code: 'custom', path: ['MERCHANT_TOKEN'], message: 'Devnet requires a merchant token of at least 32 characters.' });
    if (!env.TREASURY_SECRET_KEY)
      ctx.addIssue({ code: 'custom', path: ['TREASURY_SECRET_KEY'], message: 'Devnet requires a test-only treasury key.' });
  }
});
export function readConfig() {
  const result = schema.safeParse(process.env);
  if (!result.success) throw new Error(result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n'));
  return result.data;
}
