import { describe, expect, it, vi } from 'vitest';
import { Keypair, Transaction, SystemProgram, type TransactionResponse } from '@solana/web3.js';
import { assertDepositMessage, SolanaPayments } from '../server/solana';

function fixture() {
  const payer = Keypair.generate();
  const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58() })
    .add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 3 }));
  const response = { meta: { err: null }, transaction: { message: tx.compileMessage() } } as TransactionResponse;
  return { response, expected: tx.serializeMessage().toString('base64') };
}
describe('on-chain verification', () => {
  it('accepts only the exact stored message', () => {
    const { response, expected } = fixture();
    expect(() => assertDepositMessage(expected, response)).not.toThrow();
    expect(() => assertDepositMessage(fixture().expected, response)).toThrow('gehört nicht');
  });
  it('rejects missing, failed and unbound payments', () => {
    const { response, expected } = fixture();
    expect(() => assertDepositMessage(expected, null)).toThrow('noch nicht');
    expect(() => assertDepositMessage(null, response)).toThrow('gehört nicht');
    response.meta!.err = { InstructionError: [0, 'InvalidArgument'] };
    expect(() => assertDepositMessage(expected, response)).toThrow('fehlgeschlagen');
  });
  it('rejects a non-Devnet RPC before any transaction is constructed', async () => {
    const adapter = new SolanaPayments('http://localhost:8899', Keypair.generate());
    vi.spyOn(adapter.connection, 'getGenesisHash').mockResolvedValue('mainnet-hash');
    await expect(adapter.assertDevnet()).rejects.toThrow('ausschließlich Solana Devnet');
  });
});
