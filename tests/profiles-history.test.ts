import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import request from 'supertest';
import { createApp } from '../server/app';
import { LoanService } from '../server/service';
import { Store } from '../server/store';
import { walletCsv } from '../server/wallet-csv';

const stores: Store[] = [];
function setup() {
  const store = new Store(); stores.push(store);
  const service = new LoanService(store, 'demo');
  return { store, service, app: createApp(service, { origin: 'http://localhost:5174' }) };
}
afterEach(() => { vi.restoreAllMocks(); stores.splice(0).forEach(store => store.close()); });

it('requires a merchant session for both return endpoints, binds its location and revokes on logout', async () => {
  const { app, service } = setup();
  const payer = `demo-${randomUUID()}`;
  const loan = await service.borrow({ cupId: 'LOOP-001', payer, location: 'cafe' });
  for (const path of ['/api/returns/LOOP-001', `/api/loans/${loan.receipt.id}/refund`]) {
    expect((await request(app).post(path).send({ location: 'festival', physicallyReceived: true })).status).toBe(401);
    expect((await request(app).post(path).set('Authorization', `Bearer ${payer}`).send({ location: 'festival', physicallyReceived: true })).status).toBe(401);
  }
  const session = await request(app).post('/api/merchant/session').send({ location: 'festival' });
  const auth = `Bearer ${session.body.token}`;
  expect((await request(app).post('/api/returns/LOOP-001').set('Authorization', auth).send({ location: 'cafe', physicallyReceived: true })).status).toBe(403);
  const returned = await request(app).post('/api/returns/LOOP-001').set('Authorization', auth).send({ location: 'festival', physicallyReceived: true });
  expect(returned.status).toBe(200);
  expect(returned.body).toMatchObject({ payer, borrowLocation: 'cafe', returnLocation: 'festival', status: 'returned', depositAtomic: 1_000_000 });
  expect((await request(app).post('/api/merchant/logout').set('Authorization', auth).send({})).status).toBe(200);
  expect((await request(app).post(`/api/loans/${loan.receipt.id}/refund`).set('Authorization', auth).send({ location: 'festival', physicallyReceived: true })).status).toBe(401);
});

it('expires merchant sessions after eight hours', async () => {
  const { app } = setup();
  const session = await request(app).post('/api/merchant/session').send({ location: 'cafe' });
  vi.spyOn(Date, 'now').mockReturnValue(session.body.expiresAt + 1);
  expect((await request(app).post('/api/returns/LOOP-001').set('Authorization', `Bearer ${session.body.token}`).send({ location: 'cafe', physicallyReceived: true })).status).toBe(401);
});

it('each merchant accepts every registered container issued elsewhere', async () => {
  const { app, service } = setup();
  for (const location of ['cafe', 'festival']) {
    const session = await request(app).post('/api/merchant/session').send({ location });
    for (const cupId of ['LOOP-001', 'LOOP-002', 'LOOP-003']) {
      await service.borrow({ cupId, payer: `demo-${randomUUID()}`, location: location === 'cafe' ? 'festival' : 'cafe' });
      const result = await request(app).post(`/api/returns/${cupId}`).set('Authorization', `Bearer ${session.body.token}`).send({ location, physicallyReceived: true });
      expect(result.status).toBe(200); expect(result.body.returnLocation).toBe(location);
    }
  }
});

it('retains repeat loans across restart and exports only the authorized user without private capabilities', async () => {
  mkdirSync('.data/tests', { recursive: true });
  const file = `.data/tests/${randomUUID()}.sqlite`;
  const store = new Store(file);
  const service = new LoanService(store, 'demo');
  const payer = `demo-${randomUUID()}`;
  const first = await service.borrow({ cupId: 'LOOP-001', payer, location: 'cafe' });
  await service.returnCup('LOOP-001', 'festival');
  await service.borrow({ cupId: 'LOOP-001', payer, location: 'festival' });
  await service.borrow({ cupId: 'LOOP-002', payer: `demo-${randomUUID()}`, location: 'cafe' });
  const userId = store.demoWallet(payer).userId;
  store.close();
  const reopened = new Store(file); stores.push(reopened);
  const app = createApp(new LoanService(reopened, 'demo'), { origin: 'http://localhost:5174' });
  const wallet = await request(app).get('/api/demo-wallet').set('Authorization', `Bearer ${payer}`);
  expect(wallet.body.userId).toBe(userId);
  expect(wallet.body.loans).toHaveLength(2);
  expect(wallet.body.loans.map((loan: { status: string }) => loan.status).sort()).toEqual(['borrowed', 'returned']);
  expect((await request(app).get('/api/demo-wallet/export.csv')).status).toBe(401);
  const csv = await request(app).get('/api/demo-wallet/export.csv').set('Authorization', `Bearer ${payer}`);
  expect(csv.status).toBe(200); expect(csv.headers['content-type']).toContain('text/csv');
  expect(csv.text).toContain(userId); expect(csv.text).toContain('Wiesenklang Festival');
  expect(csv.text.match(/LOOP-001/g)).toHaveLength(2);
  expect(csv.text).not.toContain('LOOP-002'); expect(csv.text).not.toContain(payer); expect(csv.text).not.toContain(first.receipt.id);
  const other = await request(app).get('/api/demo-wallet/export.csv').set('Authorization', `Bearer demo-${randomUUID()}`);
  expect(other.text).not.toContain('LOOP-001');
  expect((await request(app).get('/api/demo-wallet').set('Authorization', `Bearer ${userId}`)).status).toBe(401);
});

it('escapes CSV quotes and neutralizes spreadsheet formulas', async () => {
  const { store, service } = setup(); const payer = `demo-${randomUUID()}`;
  await service.borrow({ cupId: 'LOOP-001', payer, location: 'cafe' });
  const wallet = store.demoWallet(payer); wallet.loans[0].name = '=HYPERLINK("bad")';
  expect(walletCsv(wallet)).toContain('"\'=HYPERLINK(""bad"")"');
});
