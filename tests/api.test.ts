import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { Store } from '../server/store';
import { LoanService, type Payments } from '../server/service';

const stores: Store[] = [];
function setup(mode: 'demo' | 'devnet' = 'demo') {
  const store = new Store(); stores.push(store);
  const payments: Payments = { prepareDeposit: vi.fn(async () => ({ transaction: 'test', message: 'test' })), verifyDeposit: vi.fn(), prepareRefund: vi.fn(), settleRefund: vi.fn() };
  return createApp(new LoanService(store, mode, payments), { origin: 'http://localhost:5174', merchantToken: 'test-only-auth-fixture-not-a-real-key', production: true });
}
afterEach(() => stores.splice(0).forEach(s => s.close()));
async function login(app: ReturnType<typeof createApp>, key?: string) {
  const result = await request(app).post('/api/merchant/session').set('Authorization', key ? `Bearer ${key}` : '').send({ location: 'festival' });
  expect(result.status).toBe(201);
  return `Bearer ${result.body.token}`;
}
describe('API boundaries', () => {
  it('rejects unknown cups, injected fields and invalid amounts', async () => {
    const app = setup();
    for (const body of [{ cupId: "' OR 1=1", location: 'cafe', payer: 'demo-payer-123' }, { cupId: 'LOOP-001', location: 'cafe', payer: 'demo-payer-123', amount: 1 }])
      expect((await request(app).post('/api/loans').send(body)).status).toBe(400);
  });
  it('requires physical-return confirmation and rejects arbitrary refund recipients', async () => {
    const app = setup();
    await request(app).post('/api/loans').send({ cupId: 'LOOP-001', location: 'cafe', payer: 'demo-payer-123' });
    const authorization = await login(app);
    expect((await request(app).post('/api/returns/LOOP-001').set('Authorization', authorization).send({ location: 'festival', physicallyReceived: false })).status).toBe(400);
    expect((await request(app).post('/api/returns/LOOP-001').set('Authorization', authorization).send({ location: 'festival', physicallyReceived: true, payer: 'attacker' })).status).toBe(400);
  });
  it('requires operator credentials for Devnet returns', async () => {
    const app = setup('devnet');
    expect((await request(app).post('/api/returns/LOOP-001').send({ location: 'festival', physicallyReceived: true })).status).toBe(401);
    expect((await request(app).post('/api/returns/LOOP-001').set('Authorization', 'Bearer wrong').send({ location: 'festival', physicallyReceived: true })).status).toBe(401);
    expect((await request(app).post('/api/merchant/session').send({ location: 'festival' })).status).toBe(401);
    expect((await request(app).post('/api/merchant/session').set('Authorization', 'Bearer wrong').send({ location: 'festival' })).status).toBe(401);
    const authorization = await login(app, 'test-only-auth-fixture-not-a-real-key');
    expect((await request(app).post('/api/returns/LOOP-001').set('Authorization', authorization).send({ location: 'festival', physicallyReceived: true })).status).toBe(409);
  });
  it('rejects cross-origin mutations and non-JSON posts', async () => {
    const app = setup();
    expect((await request(app).post('/api/loans').set('Origin', 'https://untrusted.example').send({})).status).toBe(403);
    expect((await request(app).post('/api/loans').type('form').send('cupId=LOOP-001')).status).toBe(415);
  });
  it('keeps public inventory free of wallet addresses and serves security headers', async () => {
    const app = setup();
    await request(app).post('/api/loans').send({ cupId: 'LOOP-001', location: 'cafe', payer: 'demo-private-payer' });
    const res = await request(app).get('/api/config');
    expect(JSON.stringify(res.body)).not.toContain('demo-private-payer');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });
  it('returns and replays an identical refund receipt without creating a second refund', async () => {
    const app = setup();
    const loan = await request(app).post('/api/loans').send({ cupId: 'LOOP-001', location: 'cafe', payer: 'demo-payer-123' });
    const path = `/api/loans/${loan.body.receipt.id}/refund`;
    const authorization = await login(app);
    const first = await request(app).post(path).set('Authorization', authorization).send({ location: 'festival', physicallyReceived: true });
    const second = await request(app).post(path).set('Authorization', authorization).send({ location: 'festival', physicallyReceived: true });
    expect(first.status).toBe(200); expect(second.body).toEqual(first.body);
  });
});
