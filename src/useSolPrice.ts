import { useEffect, useState } from 'react';
import { FALLBACK_EUR_PER_SOL } from '../shared/model';
import { request } from './api';

interface PriceState {
  priceEur: number;
  isLive: boolean;
  loading: boolean;
  lastUpdated: number;
}

let globalState: PriceState = {
  priceEur: FALLBACK_EUR_PER_SOL,
  isLive: false,
  loading: true,
  lastUpdated: 0,
};

const listeners = new Set<(state: PriceState) => void>();

function notify() {
  for (const listener of listeners) {
    listener(globalState);
  }
}

async function fetchLivePrice() {
  try {
    const data = await request<{ priceEur: number; isLive: boolean }>('/solana-price');
    if (data?.priceEur && data.priceEur > 0) {
      globalState = {
        priceEur: data.priceEur,
        isLive: data.isLive ?? true,
        loading: false,
        lastUpdated: Date.now(),
      };
      notify();
      return;
    }
  } catch {
    // If backend endpoint is busy or offline, try direct Coinbase spot price
    try {
      const res = await fetch('https://api.coinbase.com/v2/prices/SOL-EUR/spot', {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: { amount?: string } };
        const amount = Number.parseFloat(body.data?.amount ?? '');
        if (Number.isFinite(amount) && amount > 0) {
          globalState = {
            priceEur: Math.round(amount * 100) / 100,
            isLive: true,
            loading: false,
            lastUpdated: Date.now(),
          };
          notify();
          return;
        }
      }
    } catch {
      // Offline fallback
    }
  }

  globalState = {
    ...globalState,
    loading: false,
  };
  notify();
}

// Initial fetch
void fetchLivePrice();

// Polling timer every 30 seconds
if (typeof window !== 'undefined') {
  setInterval(() => {
    void fetchLivePrice();
  }, 30_000);
}

export function useSolPrice(initialEurPrice?: number) {
  const [state, setState] = useState<PriceState>(() => ({
    ...globalState,
    priceEur: initialEurPrice ?? globalState.priceEur,
  }));

  useEffect(() => {
    listeners.add(setState);
    if (Date.now() - globalState.lastUpdated > 15_000) {
      void fetchLivePrice();
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}
