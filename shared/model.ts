import { z } from 'zod';

export const DEPOSIT_ATOMIC = 3_000_000;
export const locations = [
  { id: 'cafe', name: 'Café Morgenrot', detail: 'Kaffee & gute Kreisläufe', kind: 'Café' },
  { id: 'festival', name: 'Wiesenklang Festival', detail: 'Rückgabestation am Eingang', kind: 'Festival' },
] as const;
export const cupIdSchema = z.string().trim().toUpperCase().regex(/^LOOP-00[1-3]$/, 'Bitte LOOP-001, LOOP-002 oder LOOP-003 eingeben.');
export const locationSchema = z.enum(['cafe', 'festival']);
export const borrowSchema = z.object({ cupId: cupIdSchema, location: locationSchema, payer: z.string().min(10).max(80) }).strict();
export const confirmSchema = z.object({ signature: z.string().min(16).max(100) }).strict();
export const returnSchema = z.object({ location: locationSchema, physicallyReceived: z.literal(true) }).strict();
export const loanIdSchema = z.uuid();
export type LocationId = z.infer<typeof locationSchema>;
export type Mode = 'demo' | 'devnet';
export type Status = 'reserved' | 'borrowed' | 'refund_pending' | 'returned';
export interface Cup { id: string; name: string; size: string; color: string; status: Status | 'available' }
export interface Receipt {
  id: string; cupId: string; payer: string; status: Status; mode: Mode;
  borrowedAt: string; returnedAt: string | null; borrowLocation: LocationId;
  returnLocation: LocationId | null; depositSignature: string | null; refundSignature: string | null;
}
export interface PublicConfig { mode: Mode; deposit: number; cups: Cup[]; locations: typeof locations }
export interface BorrowResult { receipt: Receipt; transaction?: string }
