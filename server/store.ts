import { DatabaseSync } from 'node:sqlite';
import type { Cup, Receipt } from '../shared/model';

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
    ].map(cup => ({ ...cup, status: this.active(cup.id)?.status ?? 'available' }));
  }
  close() { this.db.close(); }
}
export function receipt(loan: Loan): Receipt {
  const { depositMessage: _message, transaction: _transaction, refundRaw: _raw, ...publicReceipt } = loan;
  return publicReceipt;
}
