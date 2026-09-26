import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { LoanService, type Payments } from '../server/service';
import { Store, receipt } from '../server/store';

const stores: Store[] = [];
const makeStore = (path?: string) => { const store = new Store(path); stores.push(store); return store; };
afterEach(() => stores.splice(0).forEach(s => s.close()));
const input = { cupId: 'LOOP-001', location: 'cafe', payer: 'demo-original-payer' };
const adapter = (): Payments => ({
  prepareDeposit: vi.fn(async () => ({ transaction: 'unsigned', message: 'bound-message' })),
  verifyDeposit: vi.fn(async () => {}),
  prepareRefund: vi.fn(async () => ({ raw: 'signed-once', signature: 'refund-signature' })),
  settleRefund: vi.fn(async () => true),
});

describe('deposit lifecycle', () => {
  it('borrows and returns at another location; makes the cup available again', async () => {
    const store = makeStore(); const service = new LoanService(store, 'demo');
    const first = await service.borrow(input);
    expect(first.receipt.status).toBe('borrowed');
    const returned = await service.returnCup('LOOP-001', 'festival');
    expect(returned).toMatchObject({ status: 'returned', payer: input.payer, returnLocation: 'festival' });
    expect(store.cups()[0].status).toBe('available');
    expect((await service.borrow(input)).receipt.id).not.toBe(first.receipt.id);
  });
  it('rejects concurrent double-borrowing', async () => {
    const service = new LoanService(makeStore(), 'demo');
    const results = await Promise.allSettled([service.borrow(input), service.borrow(input)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('does not refund an unconfirmed deposit', async () => {
    const service = new LoanService(makeStore(), 'devnet', adapter());
    const loan = await service.borrow(input);
    await expect(service.refund(loan.receipt.id, 'festival')).rejects.toThrow('noch nicht bestätigt');
  });
  it('keeps a deposit reserved if verification rejects it', async () => {
    const payments = adapter(); vi.mocked(payments.verifyDeposit).mockRejectedValue(new Error('invalid payment'));
    const service = new LoanService(makeStore(), 'devnet', payments);
    const loan = await service.borrow(input);
    await expect(service.confirm(loan.receipt.id, 'wrong-signature')).rejects.toThrow('invalid payment');
    expect(service.get(loan.receipt.id).status).toBe('reserved');
  });
  it('persists signed refund before sending and reuses it after an uncertain send', async () => {
    const store = makeStore(); const payments = adapter();
    vi.mocked(payments.settleRefund).mockImplementationOnce(async () => {
      expect(store.active('LOOP-001')?.refundRaw).toBe('signed-once');
      throw new Error('RPC timeout');
    });
    const service = new LoanService(store, 'devnet', payments);
    const loan = await service.borrow(input);
    await service.confirm(loan.receipt.id, 'deposit-signature');
    await expect(service.refund(loan.receipt.id, 'festival')).rejects.toThrow('RPC timeout');
    const restartedService = new LoanService(store, 'devnet', payments);
    expect((await restartedService.refund(loan.receipt.id, 'festival')).status).toBe('returned');
    await restartedService.refund(loan.receipt.id, 'cafe');
    expect(payments.prepareRefund).toHaveBeenCalledTimes(1);
    expect(payments.settleRefund).toHaveBeenNthCalledWith(2, 'signed-once', 'refund-signature');
    expect(payments.prepareRefund).toHaveBeenCalledWith(expect.objectContaining({ payer: input.payer }));
  });
  it('retains pending refunds without freeing the cup', async () => {
    const payments = adapter(); vi.mocked(payments.settleRefund).mockResolvedValue(false);
    const service = new LoanService(makeStore(), 'devnet', payments);
    const loan = await service.borrow(input); await service.confirm(loan.receipt.id, 'deposit-signature');
    expect((await service.refund(loan.receipt.id, 'festival')).status).toBe('refund_pending');
    await expect(service.borrow(input)).rejects.toThrow('bereits reserviert');
  });
  it('survives closing and reopening the database', async () => {
    mkdirSync('.data/tests', { recursive: true });
    const path = `.data/tests/${randomUUID()}.sqlite`;
    const store = new Store(path); const service = new LoanService(store, 'demo');
    const loan = await service.borrow(input); store.close();
    const reopened = makeStore(path);
    expect(reopened.get(loan.receipt.id)?.payer).toBe(input.payer);
    expect(reopened.cups()[0].status).toBe('borrowed');
  });
  it('does not expose signed transactions or payment internals in receipts', async () => {
    const service = new LoanService(makeStore(), 'devnet', adapter());
    const loan = await service.borrow(input);
    expect(receipt(service.get(loan.receipt.id))).not.toHaveProperty('refundRaw');
    expect(receipt(service.get(loan.receipt.id))).not.toHaveProperty('depositMessage');
  });
  it('rejects payment replay across separate loans', async () => {
    const service = new LoanService(makeStore(), 'devnet', adapter());
    const first = await service.borrow(input); const second = await service.borrow({ ...input, cupId: 'LOOP-002' });
    await service.confirm(first.receipt.id, 'same-signature');
    await expect(service.confirm(second.receipt.id, 'same-signature')).rejects.toThrow();
    expect(service.get(second.receipt.id).status).toBe('reserved');
  });
});
