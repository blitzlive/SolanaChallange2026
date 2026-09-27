import type { PublicConfig, BorrowResult, Receipt } from '../shared/model';
import { demoWalletIdSchema } from '../shared/model';

export async function request<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Connection failed. Please try again.');
  return data as T;
}
export const getConfig = () => request<PublicConfig>('/config');
export const getReceipt = (id: string) => request<BorrowResult>(`/loans/${encodeURIComponent(id)}`);
export const confirmPayment = (id: string, signature: string) => request<Receipt>(`/loans/${id}/confirm`, { signature });
export const getActiveLoans = () => request<Receipt[]>('/loans/active');

export function readSaved<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(`pfandloop:${key}`) ?? 'null') as T | null; }
  catch { return null; }
}
export function save(key: string, value: unknown) {
  try { localStorage.setItem(`pfandloop:${key}`, JSON.stringify(value)); }
  catch { /* The visible receipt remains usable when browser storage is unavailable. */ }
}

let inMemoryDemoId: string | undefined;
export function getDemoIdentity() {
  const stored = demoWalletIdSchema.safeParse(readSaved<string>('demo-wallet'));
  const id = stored.success ? stored.data : inMemoryDemoId ?? 'demo-11111111-1111-4111-8111-111111111111';
  inMemoryDemoId = id;
  save('demo-wallet', id);
  return id;
}

export function setDemoIdentity(id: string) {
  inMemoryDemoId = id;
  save('demo-wallet', id);
  return id;
}

