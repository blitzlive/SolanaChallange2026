import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';

// Standard SPL Token instructions only (not Token-2022 or multisig).
// Layout: https://solana.com/docs/tokens/basics/transfer-tokens
export const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

export function tokenAccount(mint: PublicKey, owner: PublicKey) {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM)[0];
}
export function createTokenAccount(payer: PublicKey, owner: PublicKey, mint: PublicKey) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM,
    data: Buffer.from([1]), // CreateIdempotent
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: tokenAccount(mint, owner), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    ],
  });
}
export function transferTokens(owner: PublicKey, to: PublicKey, mint: PublicKey, amount: bigint, decimals: number) {
  if (amount <= 0n || amount > 0xffffffffffffffffn || !Number.isInteger(decimals) || decimals < 0 || decimals > 255)
    throw new Error('Invalid token transfer amount or decimals.');
  const data = Buffer.alloc(10);
  data[0] = 12; // TransferChecked
  data.writeBigUInt64LE(amount, 1);
  data[9] = decimals;
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM, data,
    keys: [
      { pubkey: tokenAccount(mint, owner), isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: tokenAccount(mint, to), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
  });
}
