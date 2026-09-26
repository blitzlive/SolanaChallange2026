import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import type { Cup, Receipt } from '../shared/model';
import { DEMO_INITIAL_ATOMIC, DEPOSITS_ATOMIC, type DemoWallet } from '../shared/model';

export interface Loan extends Receipt {
  depositMessage: string | null;
  transaction: string | null;
  refundRaw: string | null;
}
export class Store {
  readonly db: DatabaseSync;
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS loans (
        id TEXT PRIMARY KEY, cup_id TEXT NOT NULL, status TEXT NOT NULL,
        deposit_signature TEXT UNIQUE, body TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_loan ON loans(cup_id) WHERE status != 'returned';`);
    // Existing signed transactions and receipts used 3 USDC before per-cup pricing.
    this.db.exec(`UPDATE loans SET body = json_set(body, '$.depositAtomic', 3000000)
      WHERE json_type(body, '$.depositAtomic') IS NULL;`);
  }
  get(id: string): Loan | undefined {
    const row = this.db.prepare('SELECT body FROM loans WHERE id = ?').get(id);
    return row ? JSON.parse(String(row.body)) as Loan : undefined;
  }
  active(cupId: string): Loan | undefined {
    const row = this.db.prepare("SELECT body FROM loans WHERE cup_id = ? AND status != 'returned'").get(cupId);
    return row ? JSON.parse(String(row.body)) as Loan : undefined;
  }
  insert(loan: Loan) {
    this.db.prepare('INSERT INTO loans VALUES (?, ?, ?, ?, ?)').run(loan.id, loan.cupId, loan.status, loan.depositSignature, JSON.stringify(loan));
  }
  save(loan: Loan) {
    this.db.prepare('UPDATE loans SET status = ?, deposit_signature = ?, body = ? WHERE id = ?')
      .run(loan.status, loan.depositSignature, JSON.stringify(loan), loan.id);
  }
  removeUnprepared(id: string) {
    this.db.prepare("DELETE FROM loans WHERE id = ? AND status = 'reserved' AND json_extract(body, '$.transaction') IS NULL").run(id);
  }
  cups(): Cup[] {
    return [
      { id: 'LOOP-001', name: 'Der Kaffeebecher', size: '300 ml · mit Deckel', color: 'green' },
      { id: 'LOOP-002', name: 'Der Festivalbecher', size: '500 ml · ohne Deckel', color: 'orange' },
      { id: 'LOOP-003', name: 'Die Lunch-Bowl', size: '800 ml · mit Deckel', color: 'purple' },
    ].map(cup => {
      const active = this.active(cup.id);
      return { ...cup, depositAtomic: DEPOSITS_ATOMIC[cup.id], activeDepositAtomic: active?.depositAtomic ?? null, status: active?.status ?? 'available' };
    });
  }
  demoWallet(payer: string): DemoWallet {
    const rows = this.db.prepare("SELECT body FROM loans WHERE json_extract(body, '$.payer') = ? AND json_extract(body, '$.mode') = 'demo'").all(payer);
    const loans = rows.map(row => JSON.parse(String(row.body)) as Loan);
    const heldAtomic = loans.filter(loan => loan.status !== 'returned' && loan.status !== 'reserved').reduce((sum, loan) => sum + loan.depositAtomic, 0);
    const history: DemoWallet['history'] = loans.flatMap(loan => {
      if (loan.status === 'reserved') return [];
      const entries: DemoWallet['history'] = [{ receiptId: loan.id, cupId: loan.cupId, kind: 'deposit', amountAtomic: loan.depositAtomic, at: loan.borrowedAt }];
      if (loan.status === 'returned' && loan.returnedAt) entries.push({ receiptId: loan.id, cupId: loan.cupId, kind: 'refund', amountAtomic: loan.depositAtomic, at: loan.returnedAt });
      return entries;
    });
    history.sort((a, b) => b.at.localeCompare(a.at) || (a.kind === b.kind ? 0 : a.kind === 'refund' ? -1 : 1));
    const publicId = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);
    const catalog = this.cups();
    return {
      userId: `USER-${publicId(payer)}`,
      loans: loans.sort((a, b) => b.borrowedAt.localeCompare(a.borrowedAt)).map(loan => ({
        loanId: `LOAN-${publicId(loan.id)}`, cupId: loan.cupId,
        name: catalog.find(cup => cup.id === loan.cupId)?.name ?? loan.cupId,
        status: loan.status, depositAtomic: loan.depositAtomic, borrowedAt: loan.borrowedAt,
        returnedAt: loan.returnedAt, borrowLocation: loan.borrowLocation, returnLocation: loan.returnLocation,
      })),
      initialAtomic: DEMO_INITIAL_ATOMIC, availableAtomic: DEMO_INITIAL_ATOMIC - heldAtomic, heldAtomic, history,
    };
  }
  close() { this.db.close(); }
}
export function receipt(loan: Loan): Receipt {
  const { depositMessage: _message, transaction: _transaction, refundRaw: _raw, ...publicReceipt } = loan;
  return publicReceipt;
}
