import { FALLBACK_EUR_PER_SOL } from '../shared/model';

interface CachedPrice {
  priceEur: number;
  isLive: boolean;
  updatedAt: string;
  expiresAt: number;
}

let cached: CachedPrice | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds cache

export async function getSolPriceEur(): Promise<{ priceEur: number; isLive: boolean; updatedAt: string }> {
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    return { priceEur: cached.priceEur, isLive: cached.isLive, updatedAt: cached.updatedAt };
  }

  // 1. Try Coinbase SOL-EUR spot price
  try {
    const res = await fetch('https://api.coinbase.com/v2/prices/SOL-EUR/spot', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: { amount?: string } };
      const amount = Number.parseFloat(body.data?.amount ?? '');
      if (Number.isFinite(amount) && amount > 0) {
        cached = {
          priceEur: Math.round(amount * 100) / 100,
          isLive: true,
          updatedAt: new Date().toISOString(),
          expiresAt: now + CACHE_TTL_MS,
        };
        return { priceEur: cached.priceEur, isLive: cached.isLive, updatedAt: cached.updatedAt };
      }
    }
  } catch {
    // Coinbase timed out or unavailable, try fallback
  }

  // 2. Try CoinGecko simple price
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const body = (await res.json()) as { solana?: { eur?: number } };
      const amount = body.solana?.eur;
      if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
        cached = {
          priceEur: Math.round(amount * 100) / 100,
          isLive: true,
          updatedAt: new Date().toISOString(),
          expiresAt: now + CACHE_TTL_MS,
        };
        return { priceEur: cached.priceEur, isLive: cached.isLive, updatedAt: cached.updatedAt };
      }
    }
  } catch {
    // CoinGecko unavailable
  }

  // 3. Fallback to previous cache or offline reference price
  const priceEur = cached?.priceEur ?? FALLBACK_EUR_PER_SOL;
  return {
    priceEur,
    isLive: false,
    updatedAt: cached?.updatedAt ?? new Date().toISOString(),
  };
}
