import type { Transaction, PublicKey } from '@solana/web3.js';

interface Phantom {
  isPhantom?: boolean;
  publicKey: PublicKey | null;
  connect(): Promise<{ publicKey: PublicKey }>;
  signAndSendTransaction(transaction: Transaction): Promise<{ signature: string }>;
}
declare global { interface Window { phantom?: { solana?: Phantom } } }

export async function connectWallet() {
  const provider = window.phantom?.solana;
  if (!provider?.isPhantom) throw new Error('Phantom wallet not found. Please install the Phantom browser extension or open this page in Phantom mobile browser, and set network to Devnet.');
  const { publicKey } = await provider.connect();
  return publicKey.toBase58();
}
export async function pay(transaction: string, expectedPayer: string) {
  const provider = window.phantom?.solana;
  if (!provider || provider.publicKey?.toBase58() !== expectedPayer)
    throw new Error('Please connect the original payer wallet.');
  const { Transaction } = await import('@solana/web3.js');
  const { Buffer } = await import('buffer');
  const decoded = Transaction.from(Buffer.from(transaction, 'base64'));
  return (await provider.signAndSendTransaction(decoded)).signature;
}
