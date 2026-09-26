import { z } from 'zod';

export const DEPOSITS_ATOMIC: Readonly<Record<string, number>> = { 'LOOP-001': 1_000_000, 'LOOP-002': 2_000_000, 'LOOP-003': 5_000_000 };
export const DEMO_INITIAL_ATOMIC = 20_000_000;
export const formatUsdc = (atomic: number) => (atomic / 1_000_000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatEuro = (atomic: number) => `${formatUsdc(atomic)} €`;
// Illustrative offline MVP rate, never a market quote or settlement rate.
export const EXAMPLE_EUR_PER_SOL = 100;
export const formatSolEstimate = (atomic: number) => (atomic / 1_000_000 / EXAMPLE_EUR_PER_SOL).toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
export const demoWalletIdSchema = z.string().refine(value => value.startsWith('demo-') && z.uuid().safeParse(value.slice(5)).success, 'Ungültige Demo-Wallet.');
export const locations = [
  { id: 'cafe', name: 'Café Morgenrot', detail: 'Kaffee & gute Kreisläufe', kind: 'Café' },
  { id: 'festival', name: 'Wiesenklang Festival', detail: 'Rückgabestation am Eingang', kind: 'Festival' },
] as const;
export const cupIdSchema = z.string().trim().toUpperCase().regex(/^LOOP-00[1-3]$/, 'Bitte LOOP-001, LOOP-002 oder LOOP-003 eingeben.');
export const locationSchema = z.enum(['cafe', 'festival']);
export const merchantLoginSchema = z.object({ location: locationSchema }).strict();
export interface MerchantSession { token: string; location: LocationId; expiresAt: number }
export const borrowSchema = z.object({ cupId: cupIdSchema, location: locationSchema, payer: z.string().min(10).max(80) }).strict();
export const confirmSchema = z.object({ signature: z.string().min(16).max(100) }).strict();
export const returnSchema = z.object({ location: locationSchema, physicallyReceived: z.literal(true) }).strict();
export const loanIdSchema = z.uuid();
export type LocationId = z.infer<typeof locationSchema>;
export type Mode = 'demo' | 'devnet';
export type Status = 'reserved' | 'borrowed' | 'refund_pending' | 'returned';
export interface Cup { id: string; name: string; size: string; color: string; depositAtomic: number; activeDepositAtomic: number | null; status: Status | 'available' }
export interface Receipt {
  id: string; cupId: string; payer: string; status: Status; mode: Mode; depositAtomic: number;
  borrowedAt: string; returnedAt: string | null; borrowLocation: LocationId;
  returnLocation: LocationId | null; depositSignature: string | null; refundSignature: string | null;
}
export interface PublicConfig { mode: Mode; cups: Cup[]; locations: typeof locations }
export interface BorrowResult { receipt: Receipt; transaction?: string }
export interface DemoWallet {
  userId: string;
  loans: WalletLoan[];
  initialAtomic: number; availableAtomic: number; heldAtomic: number;
  history: { receiptId: string; cupId: string; kind: 'deposit' | 'refund'; amountAtomic: number; at: string }[];
}
export interface WalletLoan {
  loanId: string; cupId: string; name: string; status: Status; depositAtomic: number;
  borrowedAt: string; returnedAt: string | null; borrowLocation: LocationId; returnLocation: LocationId | null;
}
