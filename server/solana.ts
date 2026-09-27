import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, type TransactionResponse } from '@solana/web3.js';
import { createTokenAccount, transferTokens } from './token';
import bs58 from 'bs58';
import { AppError, type Payments } from './service';
import type { Loan } from './store';

export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export function assertDepositMessage(expected: string | null, tx: TransactionResponse | null) {
  if (!tx) throw new AppError(409, 'Payment not yet confirmed. Please verify again.');
  if (!tx.meta || tx.meta.err !== null) throw new AppError(422, 'Blockchain transaction failed.');
  if (!expected || Buffer.from(tx.transaction.message.serialize()).toString('base64') !== expected)
    throw new AppError(422, 'This transaction does not belong to this deposit receipt.');
}
export class SolanaPayments implements Payments {
  readonly connection: Connection;
  constructor(rpc: string, private treasury: Keypair) {
    this.connection = new Connection(rpc, { commitment: 'finalized', disableRetryOnRateLimit: true });
  }
  async assertDevnet() {
    if (await this.connection.getGenesisHash() !== DEVNET_GENESIS)
      throw new AppError(503, 'This prototype exclusively permits Solana Devnet.');
  }
  private transfer(from: PublicKey, to: PublicKey, payer: PublicKey, memo: string, amountAtomic: number) {
    return new Transaction().add(
      createTokenAccount(payer, to, USDC_MINT),
      transferTokens(from, to, USDC_MINT, BigInt(amountAtomic), 6),
      new TransactionInstruction({ programId: MEMO, keys: [], data: Buffer.from(memo) }),
    );
  }
  async prepareDeposit(loan: Loan) {
    await this.assertDevnet();
    let payer: PublicKey;
    try { payer = new PublicKey(loan.payer); } catch { throw new AppError(400, 'Invalid Solana wallet address.'); }
    if (!PublicKey.isOnCurve(payer.toBytes()) || payer.equals(this.treasury.publicKey))
      throw new AppError(400, 'Please use an independent customer wallet.');
    const tx = this.transfer(payer, this.treasury.publicKey, payer, `PfandLoop:deposit:${loan.id}`, loan.depositAtomic);
    tx.feePayer = payer;
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    return {
      transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'),
      message: tx.serializeMessage().toString('base64'),
    };
  }
  async verifyDeposit(loan: Loan, signature: string) {
    await this.assertDevnet();
    assertDepositMessage(loan.depositMessage, await this.connection.getTransaction(signature, { commitment: 'finalized' }));
  }
  async prepareRefund(loan: Loan) {
    await this.assertDevnet();
    const tx = this.transfer(this.treasury.publicKey, new PublicKey(loan.payer), this.treasury.publicKey, `PfandLoop:refund:${loan.id}`, loan.depositAtomic);
    tx.feePayer = this.treasury.publicKey;
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    tx.sign(this.treasury);
    return { raw: tx.serialize().toString('base64'), signature: bs58.encode(tx.signature!) };
  }
  async settleRefund(raw: string, signature: string) {
    await this.assertDevnet();
    const status = (await this.connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new AppError(409, 'Refund failed. Operator must investigate the saved transaction.');
    if (status?.confirmationStatus === 'finalized') return true;
    if (status) return false;
    const tx = Transaction.from(Buffer.from(raw, 'base64'));
    const valid = await this.connection.isBlockhashValid(tx.recentBlockhash!);
    if (!valid.value) throw new AppError(409, 'Refund expired or uncertain. Operator review required; no duplicate payment created.');
    await this.connection.sendRawTransaction(Buffer.from(raw, 'base64'), { maxRetries: 2, preflightCommitment: 'finalized' });
    return false;
  }
}
