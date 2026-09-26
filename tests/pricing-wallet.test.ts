import { afterEach, expect, it } from 'vitest';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Store } from '../server/store';
import { LoanService } from '../server/service';
import { createApp } from '../server/app';

const stores: Store[] = [];
function setup() {
  const store = new Store(); stores.push(store);
  const service = new LoanService(store, 'demo');
  return { store, service, app: createApp(service, { origin: 'http://localhost:5174' }) };
}
afterEach(() => stores.splice(0).forEach(store => store.close()));

it.each([['LOOP-001', 1_000_000], ['LOOP-002', 2_000_000], ['LOOP-003', 5_000_000]])('snapshots and refunds %s at %i atomic USDC', async (cupId, amount) => {
  const { service, store } = setup();
  const payer = `demo-${randomUUID()}`;
  const loan = await service.borrow({ cupId, payer, location: 'cafe' });
  expect(loan.receipt.depositAtomic).toBe(amount);
  expect(store.demoWallet(payer).availableAtomic).toBe(20_000_000 - Number(amount));
  expect((await service.refund(loan.receipt.id, 'festival')).depositAtomic).toBe(amount);
  await service.refund(loan.receipt.id, 'festival');
  expect(store.demoWallet(payer)).toMatchObject({ availableAtomic: 20_000_000, heldAtomic: 0 });
  expect(store.demoWallet(payer).history).toHaveLength(2);
});

it('migrates historical 3-USDC loans without repricing them and is repeatable', async () => {
  mkdirSync('.data/tests', { recursive: true });
  const file = `.data/tests/${randomUUID()}.sqlite`;
  const oldStore = new Store(file);
  const payer = `demo-${randomUUID()}`;
  const loan = await new LoanService(oldStore, 'demo').borrow({ cupId: 'LOOP-001', payer, location: 'cafe' });
  oldStore.db.prepare("UPDATE loans SET body = json_remove(body, '$.depositAtomic') WHERE id = ?").run(loan.receipt.id);
  oldStore.close();
  const migrated = new Store(file); stores.push(migrated);
  expect(migrated.get(loan.receipt.id)?.depositAtomic).toBe(3_000_000);
  expect(migrated.cups()[0]).toMatchObject({ depositAtomic: 1_000_000, activeDepositAtomic: 3_000_000 });
  const service = new LoanService(migrated, 'demo');
  expect((await service.refund(loan.receipt.id, 'festival')).depositAtomic).toBe(3_000_000);
  const next = await service.borrow({ cupId: 'LOOP-001', payer, location: 'cafe' });
  const reopened = new Store(file); stores.push(reopened);
  expect(reopened.get(next.receipt.id)?.depositAtomic).toBe(1_000_000);
  expect(reopened.demoWallet(payer).availableAtomic).toBe(19_000_000);
});

it('exposes only the bearer demo identity history and reports all current prices', async () => {
  const { service, app } = setup(); const payer = `demo-${randomUUID()}`;
  await service.borrow({ cupId: 'LOOP-003', payer, location: 'cafe' });
  const mine = await request(app).get('/api/demo-wallet').set('Authorization', `Bearer ${payer}`);
  expect(mine.status).toBe(200); expect(mine.body.availableAtomic).toBe(15_000_000);
  expect(mine.body.history).toHaveLength(1);
  const other = await request(app).get('/api/demo-wallet').set('Authorization', `Bearer demo-${randomUUID()}`);
  expect(other.body.history).toEqual([]); expect(other.body.availableAtomic).toBe(20_000_000);
  expect((await request(app).get('/api/demo-wallet')).status).toBe(401);
  expect((await request(app).get('/api/demo-wallet').set('Authorization', 'Bearer not-a-demo-id')).status).toBe(401);
  const config = await request(app).get('/api/config');
  expect(config.body.cups.map((cup: { depositAtomic: number }) => cup.depositAtomic)).toEqual([1_000_000, 2_000_000, 5_000_000]);
});
