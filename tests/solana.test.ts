import { describe, expect, it, vi } from 'vitest';
import { Keypair, Transaction, SystemProgram, type TransactionResponse } from '@solana/web3.js';
import { assertDepositMessage, SolanaPayments } from '../server/solana';
import type { Loan } from '../server/store';

function fixture() {
  const payer = Keypair.generate();
  const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58() })
    .add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 3 }));
  const response = { meta: { err: null }, transaction: { message: tx.compileMessage() } } as TransactionResponse;
  return { response, expected: tx.serializeMessage().toString('base64') };
}
describe('on-chain verification', () => {
  it.each([1_000_000, 2_000_000, 5_000_000, 3_000_000])('binds deposit and refund to the snapshotted %i atomic units', async amount => {
    const treasury = Keypair.generate(); const payer = Keypair.generate();
    const adapter = new SolanaPayments('http://localhost:8899', treasury);
    vi.spyOn(adapter, 'assertDevnet').mockResolvedValue();
    vi.spyOn(adapter.connection, 'getLatestBlockhash').mockResolvedValue({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 123 });
    const loan: Loan = { id: 'test-loan', cupId: 'LOOP-001', payer: payer.publicKey.toBase58(), mode: 'devnet', status: 'borrowed', depositAtomic: amount, borrowedAt: new Date().toISOString(), returnedAt: null, borrowLocation: 'cafe', returnLocation: null, depositSignature: null, refundSignature: null, depositMessage: null, transaction: null, refundRaw: null };
    const deposit = Transaction.from(Buffer.from((await adapter.prepareDeposit(loan)).transaction, 'base64'));
    const refund = Transaction.from(Buffer.from((await adapter.prepareRefund(loan)).raw, 'base64'));
    expect(deposit.instructions[1].data.readBigUInt64LE(1)).toBe(BigInt(amount));
    expect(refund.instructions[1].data.readBigUInt64LE(1)).toBe(BigInt(amount));
    expect(refund.instructions[1].keys[2].pubkey).toEqual(deposit.instructions[1].keys[0].pubkey);
  });
  it('accepts only the exact stored message', () => {
    const { response, expected } = fixture();
    expect(() => assertDepositMessage(expected, response)).not.toThrow();
    expect(() => assertDepositMessage(fixture().expected, response)).toThrow('does not belong');
  });
  it('rejects missing, failed and unbound payments', () => {
    const { response, expected } = fixture();
    expect(() => assertDepositMessage(expected, null)).toThrow('not yet confirmed');
    expect(() => assertDepositMessage(null, response)).toThrow('does not belong');
    response.meta!.err = { InstructionError: [0, 'InvalidArgument'] };
    expect(() => assertDepositMessage(expected, response)).toThrow('failed');
  });
  it('rejects a non-Devnet RPC before any transaction is constructed', async () => {
    const adapter = new SolanaPayments('http://localhost:8899', Keypair.generate());
    vi.spyOn(adapter.connection, 'getGenesisHash').mockResolvedValue('mainnet-hash');
    await expect(adapter.assertDevnet()).rejects.toThrow('exclusively permits Solana Devnet');
  });
});
