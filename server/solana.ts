import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, type TransactionResponse } from '@solana/web3.js';
import { createTokenAccount, transferTokens } from './token';
import bs58 from 'bs58';
import { DEPOSIT_ATOMIC } from '../shared/model';
import { AppError, type Payments } from './service';
import type { Loan } from './store';

export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export function assertDepositMessage(expected: string | null, tx: TransactionResponse | null) {
  if (!tx) throw new AppError(409, 'Zahlung noch nicht final bestätigt. Bitte erneut prüfen.');
  if (!tx.meta || tx.meta.err !== null) throw new AppError(422, 'Die Blockchain-Zahlung ist fehlgeschlagen.');
  if (!expected || Buffer.from(tx.transaction.message.serialize()).toString('base64') !== expected)
    throw new AppError(422, 'Diese Transaktion gehört nicht zu diesem Pfandbeleg.');
}
export class SolanaPayments implements Payments {
  readonly connection: Connection;
  constructor(rpc: string, private treasury: Keypair) {
    this.connection = new Connection(rpc, { commitment: 'finalized', disableRetryOnRateLimit: true });
  }
  async assertDevnet() {
    if (await this.connection.getGenesisHash() !== DEVNET_GENESIS)
      throw new AppError(503, 'Dieser Prototyp erlaubt ausschließlich Solana Devnet.');
  }
  private transfer(from: PublicKey, to: PublicKey, payer: PublicKey, memo: string) {
    return new Transaction().add(
      createTokenAccount(payer, to, USDC_MINT),
      transferTokens(from, to, USDC_MINT, BigInt(DEPOSIT_ATOMIC), 6),
      new TransactionInstruction({ programId: MEMO, keys: [], data: Buffer.from(memo) }),
    );
  }
  async prepareDeposit(loan: Loan) {
    await this.assertDevnet();
    let payer: PublicKey;
    try { payer = new PublicKey(loan.payer); } catch { throw new AppError(400, 'Ungültige Solana-Wallet-Adresse.'); }
    if (!PublicKey.isOnCurve(payer.toBytes()) || payer.equals(this.treasury.publicKey))
      throw new AppError(400, 'Bitte eine eigene Kunden-Wallet verwenden.');
    const tx = this.transfer(payer, this.treasury.publicKey, payer, `PfandLoop:deposit:${loan.id}`);
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
    const tx = this.transfer(this.treasury.publicKey, new PublicKey(loan.payer), this.treasury.publicKey, `PfandLoop:refund:${loan.id}`);
    tx.feePayer = this.treasury.publicKey;
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    tx.sign(this.treasury);
    return { raw: tx.serialize().toString('base64'), signature: bs58.encode(tx.signature!) };
  }
  async settleRefund(raw: string, signature: string) {
    await this.assertDevnet();
    const status = (await this.connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new AppError(409, 'Rückzahlung fehlgeschlagen. Betreiber muss den gespeicherten Vorgang prüfen.');
    if (status?.confirmationStatus === 'finalized') return true;
    if (status) return false;
    const tx = Transaction.from(Buffer.from(raw, 'base64'));
    const valid = await this.connection.isBlockhashValid(tx.recentBlockhash!);
    if (!valid.value) throw new AppError(409, 'Rückzahlung abgelaufen oder unklar. Betreiberprüfung nötig; keine zweite Zahlung erzeugt.');
    await this.connection.sendRawTransaction(Buffer.from(raw, 'base64'), { maxRetries: 2, preflightCommitment: 'finalized' });
    return false;
  }
}
