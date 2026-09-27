import { z } from 'zod';

export const DEPOSITS_ATOMIC: Readonly<Record<string, number>> = { 'LOOP-001': 1_000_000, 'LOOP-002': 2_000_000, 'LOOP-003': 5_000_000 };
export const DEMO_INITIAL_ATOMIC = 20_000_000;
export const MVP_INITIAL_ATOMIC = DEMO_INITIAL_ATOMIC;

export const formatUsdc = (atomic: number) => (atomic / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatEuro = (atomic: number) => `€${formatUsdc(atomic)}`;

// Reference Solana market rate fallback (Updated with live feed)
export const FALLBACK_EUR_PER_SOL = 108.65;
export const EXAMPLE_EUR_PER_SOL = FALLBACK_EUR_PER_SOL;
export const formatSolEstimate = (atomic: number, eurPerSol = FALLBACK_EUR_PER_SOL) =>
  (atomic / 1_000_000 / (eurPerSol > 0 ? eurPerSol : FALLBACK_EUR_PER_SOL)).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export const demoWalletIdSchema = z.string().refine(
  value => (value.startsWith('demo-') || value.startsWith('mvp-')) && z.uuid().safeParse(value.slice(5)).success,
  'Invalid MVP wallet ID.',
);

export interface MvpUser {
  id: string;
  name: string;
  username: string;
}

export const MVP_USERS: readonly MvpUser[] = [
  { id: 'demo-11111111-1111-4111-8111-111111111111', name: 'Alex Green', username: 'alex.sol' },
  { id: 'demo-22222222-2222-4222-8222-222222222222', name: 'Sam River', username: 'sam.sol' },
  { id: 'demo-33333333-3333-4333-8333-333333333333', name: 'Taylor Swiftcup', username: 'taylor.sol' },
] as const;

export const locations = [
  { id: 'cafe', name: 'Café Morgenrot', detail: 'Artisan Coffee & Sustainable Loops', kind: 'Café' },
  { id: 'festival', name: 'Wiesenklang Festival', detail: 'Return Station Main Entrance', kind: 'Festival' },
] as const;

export const cupIdSchema = z.string().trim().toUpperCase().regex(/^LOOP-00[1-3](-[A-Z0-9]+)?$/, 'Please enter a valid container ID (e.g. LOOP-001, LOOP-002-A101).');
export const locationSchema = z.enum(['cafe', 'festival']);
export type LocationId = z.infer<typeof locationSchema>;

export const LOCATION_ALLOWED_CUPS: Record<LocationId, readonly string[]> = {
  cafe: ['LOOP-001', 'LOOP-003'],
  festival: ['LOOP-002'],
} as const;

export function getBaseCupId(cupId: string): 'LOOP-001' | 'LOOP-002' | 'LOOP-003' {
  return cupId.slice(0, 8) as 'LOOP-001' | 'LOOP-002' | 'LOOP-003';
}

export function getCupDeposit(cupId: string): number {
  const base = getBaseCupId(cupId);
  return DEPOSITS_ATOMIC[base] ?? 1_000_000;
}

export function isCupAllowedForLocation(cupId: string, location: LocationId): boolean {
  const base = getBaseCupId(cupId);
  const allowed = LOCATION_ALLOWED_CUPS[location];
  return allowed ? allowed.includes(base) : true;
}

export const DEMO_CREDENTIALS = {
  user: { username: 'user-demo', password: '123456' },
  merchant: { username: 'demo', password: '123456' },
} as const;

export const userLoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
}).strict();

export interface UserSession {
  token: string;
  user: MvpUser;
  expiresAt: number;
}

export const merchantLoginSchema = z.object({
  location: locationSchema,
  username: z.string().optional(),
  password: z.string().optional(),
}).strict();
export interface MerchantSession { token: string; location: LocationId; expiresAt: number }
export const borrowSchema = z.object({ cupId: cupIdSchema, location: locationSchema, payer: z.string().min(10).max(80) }).strict();
export const confirmSchema = z.object({ signature: z.string().min(16).max(100) }).strict();
export const returnSchema = z.object({
  location: locationSchema,
  physicallyReceived: z.literal(true),
  userId: z.string().min(3).max(80).optional(),
}).strict();
export const loanIdSchema = z.uuid();
export type Mode = 'demo' | 'devnet';
export type Status = 'reserved' | 'borrowed' | 'refund_pending' | 'returned';
export interface Cup { id: string; name: string; size: string; color: string; depositAtomic: number; activeDepositAtomic: number | null; status: Status | 'available'; activePayer?: string | null }
export interface Receipt {
  id: string; cupId: string; payer: string; status: Status; mode: Mode; depositAtomic: number;
  borrowedAt: string; returnedAt: string | null; borrowLocation: LocationId;
  returnLocation: LocationId | null; depositSignature: string | null; refundSignature: string | null;
}
export interface PublicConfig {
  mode: Mode;
  cups: Cup[];
  locations: typeof locations;
  users: readonly MvpUser[];
  solPriceEur?: number;
  solPriceLive?: boolean;
}
export interface BorrowResult { receipt: Receipt; transaction?: string }
export interface DemoWallet {
  userId: string;
  loans: WalletLoan[];
  initialAtomic: number; availableAtomic: number; heldAtomic: number;
  history: { receiptId: string; cupId: string; kind: 'deposit' | 'refund'; amountAtomic: number; at: string; signature?: string | null }[];
}
export type MvpWallet = DemoWallet;
export interface WalletLoan {
  loanId: string; cupId: string; name: string; status: Status; depositAtomic: number;
  borrowedAt: string; returnedAt: string | null; borrowLocation: LocationId; returnLocation: LocationId | null;
  depositSignature?: string | null; refundSignature?: string | null;
}


