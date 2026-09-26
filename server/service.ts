import { randomUUID } from 'node:crypto';
import { borrowSchema, DEPOSITS_ATOMIC, type BorrowResult, type LocationId, type Mode } from '../shared/model';
import { receipt, Store, type Loan } from './store';

export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface Payments {
  prepareDeposit(loan: Loan): Promise<{ transaction: string; message: string }>;
  verifyDeposit(loan: Loan, signature: string): Promise<void>;
  prepareRefund(loan: Loan): Promise<{ raw: string; signature: string }>;
  settleRefund(raw: string, signature: string): Promise<boolean>;
}
export class LoanService {
  private busy = new Set<string>();
  constructor(readonly store: Store, readonly mode: Mode, private payments?: Payments) {
    if (mode === 'devnet' && !payments) throw new Error('Devnet requires a payment adapter.');
  }
  get(id: string) {
    const loan = this.store.get(id);
    if (!loan) throw new AppError(404, 'Dieser Beleg wurde nicht gefunden.');
    return loan;
  }
  private async lock<T>(key: string, work: () => Promise<T>): Promise<T> {
    if (this.busy.has(key)) throw new AppError(409, 'Wird gerade verarbeitet. Bitte gleich erneut prüfen.');
    this.busy.add(key);
    try { return await work(); } finally { this.busy.delete(key); }
  }
  async borrow(input: unknown): Promise<BorrowResult> {
    const data = borrowSchema.parse(input);
    return this.lock(data.cupId, async () => {
      if (this.store.active(data.cupId)) throw new AppError(409, 'Dieser Behälter ist bereits reserviert oder ausgeliehen.');
      const depositAtomic = DEPOSITS_ATOMIC[data.cupId];
      if (this.mode === 'demo' && this.store.demoWallet(data.payer).availableAtomic < depositAtomic)
        throw new AppError(409, 'Dein Demo-Guthaben reicht nicht aus. Gib zuerst einen Behälter zurück.');
      const loan: Loan = {
        id: randomUUID(), cupId: data.cupId, payer: data.payer, mode: this.mode, status: 'reserved',
        depositAtomic,
        borrowedAt: new Date().toISOString(), returnedAt: null, borrowLocation: data.location,
        returnLocation: null, depositSignature: null, refundSignature: null,
        depositMessage: null, transaction: null, refundRaw: null,
      };
      this.store.insert(loan);
      if (this.mode === 'demo') {
        loan.status = 'borrowed';
        this.store.save(loan);
      } else {
        try {
          const prepared = await this.payments!.prepareDeposit(loan);
          loan.transaction = prepared.transaction;
          loan.depositMessage = prepared.message;
          this.store.save(loan);
        } catch (error) {
          this.store.removeUnprepared(loan.id);
          throw error;
        }
      }
      return { receipt: receipt(loan), ...(loan.transaction ? { transaction: loan.transaction } : {}) };
    });
  }
  async confirm(id: string, signature: string) {
    return this.lock(id, async () => {
      const loan = this.get(id);
      if (loan.status !== 'reserved') {
        if (loan.depositSignature === signature) return receipt(loan);
        throw new AppError(409, 'Für diesen Beleg ist keine neue Zahlung vorgesehen.');
      }
      if (this.mode !== 'devnet') throw new AppError(409, 'Demo-Zahlungen brauchen keine Blockchain-Bestätigung.');
      await this.payments!.verifyDeposit(loan, signature);
      loan.depositSignature = signature;
      loan.status = 'borrowed';
      this.store.save(loan);
      return receipt(loan);
    });
  }
  async returnCup(cupId: string, location: LocationId) {
    const active = this.store.active(cupId);
    if (!active) throw new AppError(409, 'Für diesen Behälter gibt es kein offenes Pfand.');
    return this.refund(active.id, location);
  }
  async refund(id: string, location: LocationId) {
    return this.lock(id, async () => {
      const loan = this.get(id);
      if (loan.status === 'returned') return receipt(loan);
      if (loan.status === 'reserved') throw new AppError(409, 'Das Pfand ist noch nicht bestätigt. Keine Rückzahlung möglich.');
      if (this.mode === 'demo') {
        loan.returnLocation = location;
        loan.status = 'returned';
      } else {
        if (!loan.refundRaw) {
          const prepared = await this.payments!.prepareRefund(loan);
          loan.refundRaw = prepared.raw;
          loan.refundSignature = prepared.signature;
          loan.returnLocation = location;
          loan.status = 'refund_pending';
          this.store.save(loan); // Persist before the first network send.
        }
        const settled = await this.payments!.settleRefund(loan.refundRaw, loan.refundSignature!);
        if (settled) loan.status = 'returned';
      }
      if (loan.status === 'returned') loan.returnedAt = new Date().toISOString();
      this.store.save(loan);
      return receipt(loan);
    });
  }
}
