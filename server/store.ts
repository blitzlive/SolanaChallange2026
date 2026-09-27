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
    // Recover any interrupted demo loans from reserved to borrowed
    this.db.exec(`UPDATE loans SET status = 'borrowed', body = json_set(body, '$.status', 'borrowed')
      WHERE status = 'reserved' AND json_extract(body, '$.mode') = 'demo';`);

    // Seed realistic MVP loans for primary demo user if database is new and not in unit tests
    if (path !== ':memory:' && !process.env.VITEST && process.env.NODE_ENV !== 'test') {
      try {
        const row = this.db.prepare('SELECT COUNT(*) as count FROM loans').get() as { count: number | bigint } | undefined;
      if (Number(row?.count ?? 0) === 0) {
        const alex = 'demo-11111111-1111-4111-8111-111111111111';
        const now = Date.now();
        const initialCompleted: Loan = {
          id: '11111111-c001-4111-8111-111111111111',
          cupId: 'LOOP-002',
          payer: alex,
          status: 'returned',
          mode: 'demo',
          depositAtomic: 2_000_000,
          borrowedAt: new Date(now - 86400000).toISOString(),
          returnedAt: new Date(now - 72000000).toISOString(),
          borrowLocation: 'cafe',
          returnLocation: 'festival',
          depositSignature: '3ZVWU4vcWPUNcajdo2gmFmuCjzdFX8pvER9BJiiPYdo61ShEncBHkkkutSnxvnhtwJZmnekVJkCHLSW8rMEJvbB3',
          refundSignature: '3cdPKh1fYNT2Aq2cyCGzPuocxWgvfArwt8hgLY8rA6TETwQ3VrmBXcpkhocJfZnRFZLtUkjNrTHxtPMy2RGRj53G',
          depositMessage: null,
          transaction: null,
          refundRaw: null,
        };
        const initialActive: Loan = {
          id: '22222222-c002-4222-8222-222222222222',
          cupId: 'LOOP-001',
          payer: alex,
          status: 'borrowed',
          mode: 'demo',
          depositAtomic: 1_000_000,
          borrowedAt: new Date(now - 7200000).toISOString(),
          returnedAt: null,
          borrowLocation: 'cafe',
          returnLocation: null,
          depositSignature: '29yr591qtjPeNENtyi2bZp6rW6QpUfH44hWf8NPwAm1tAmNSAX7qoihLhSnwVLf5NAkgP8NjBPZgXeRAs9r4FXX2',
          refundSignature: null,
          depositMessage: null,
          transaction: null,
          refundRaw: null,
        };
        this.insert(initialCompleted);
        this.insert(initialActive);
      }
    } catch {
      // Do not block store initialization if seeding encounters an existing constraint
    }
  }
}
  get(id: string): Loan | undefined {
    const row = this.db.prepare('SELECT body FROM loans WHERE id = ?').get(id);
    return row ? JSON.parse(String(row.body)) as Loan : undefined;
  }
  active(cupId: string, fallbackPrefix = false): Loan | undefined {
    let row = this.db.prepare("SELECT body FROM loans WHERE cup_id = ? AND status != 'returned'").get(cupId);
    if (!row && fallbackPrefix && cupId.length === 8) {
      row = this.db.prepare("SELECT body FROM loans WHERE cup_id LIKE ? AND status != 'returned' ORDER BY rowid DESC LIMIT 1").get(`${cupId}%`);
    }
    return row ? JSON.parse(String(row.body)) as Loan : undefined;
  }
  insert(loan: Loan) {
    this.db.prepare('INSERT INTO loans VALUES (?, ?, ?, ?, ?)').run(loan.id, loan.cupId, loan.status, loan.depositSignature, JSON.stringify(loan));
  }
  save(loan: Loan) {
    try {
      this.db.prepare('UPDATE loans SET status = ?, deposit_signature = ?, body = ? WHERE id = ?')
        .run(loan.status, loan.depositSignature, JSON.stringify(loan), loan.id);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (loan.mode === 'demo' && String(error?.message).includes('UNIQUE constraint failed: loans.deposit_signature')) {
        this.db.prepare('UPDATE loans SET status = ?, deposit_signature = ?, body = ? WHERE id = ?')
          .run(loan.status, `${loan.depositSignature}#${loan.id}`, JSON.stringify(loan), loan.id);
      } else {
        throw err;
      }
    }
  }
  removeUnprepared(id: string) {
    this.db.prepare("DELETE FROM loans WHERE id = ? AND status = 'reserved' AND json_extract(body, '$.transaction') IS NULL").run(id);
  }
  cups(): Cup[] {
    return [
      { id: 'LOOP-001', name: 'Coffee To-Go Cup', size: '300 ml · with lid', color: 'green' },
      { id: 'LOOP-002', name: 'Festival Cup', size: '500 ml · reusable', color: 'orange' },
      { id: 'LOOP-003', name: 'Lunch Bowl', size: '800 ml · leakproof lid', color: 'purple' },
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
      const entries: DemoWallet['history'] = [{
        receiptId: loan.id,
        cupId: loan.cupId,
        kind: 'deposit',
        amountAtomic: loan.depositAtomic,
        at: loan.borrowedAt,
        signature: loan.depositSignature,
      }];
      if (loan.status === 'returned' && loan.returnedAt) {
        entries.push({
          receiptId: loan.id,
          cupId: loan.cupId,
          kind: 'refund',
          amountAtomic: loan.depositAtomic,
          at: loan.returnedAt,
          signature: loan.refundSignature,
        });
      }
      return entries;
    });
    history.sort((a, b) => b.at.localeCompare(a.at) || (a.kind === b.kind ? 0 : a.kind === 'refund' ? -1 : 1));
    const publicId = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);
    const catalog = this.cups();
    return {
      userId: `USER-${publicId(payer)}`,
      loans: loans.sort((a, b) => b.borrowedAt.localeCompare(a.borrowedAt)).map(loan => {
        const baseId = loan.cupId.slice(0, 8);
        return {
          loanId: `LOAN-${publicId(loan.id)}`, cupId: loan.cupId,
          name: catalog.find(cup => cup.id === baseId)?.name ?? loan.cupId,
          status: loan.status, depositAtomic: loan.depositAtomic, borrowedAt: loan.borrowedAt,
          returnedAt: loan.returnedAt, borrowLocation: loan.borrowLocation, returnLocation: loan.returnLocation,
          depositSignature: loan.depositSignature, refundSignature: loan.refundSignature,
        };
      }),
      initialAtomic: DEMO_INITIAL_ATOMIC, availableAtomic: DEMO_INITIAL_ATOMIC - heldAtomic, heldAtomic, history,
    };
  }

  activeLoans(): Loan[] {
    const rows = this.db.prepare("SELECT body FROM loans WHERE status != 'returned' ORDER BY json_extract(body, '$.borrowedAt') DESC").all();
    return rows.map(r => JSON.parse(String(r.body)) as Loan);
  }
  close() { this.db.close(); }
}
export function receipt(loan: Loan): Receipt {
  const { depositMessage: _message, transaction: _transaction, refundRaw: _raw, ...publicReceipt } = loan;
  return publicReceipt;
}
