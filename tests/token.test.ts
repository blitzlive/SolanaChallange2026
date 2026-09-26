import { expect, it } from 'vitest';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM, TOKEN_PROGRAM, createTokenAccount, tokenAccount, transferTokens } from '../server/token';
import { USDC_MINT } from '../server/solana';

// Public fixtures cross-checked with @solana/spl-token 0.4.15 before removing
// its vulnerable native bigint dependency. No private keys are required here.
const payer = new PublicKey('AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9');
const owner = new PublicKey('9hSR6S7WPtxmTojgo6GG3k4yDPecgJY292j7xrsUGWBu');
it('derives canonical token accounts', () => {
  expect(tokenAccount(USDC_MINT, payer).toBase58()).toBe('H1AviagU5Y17z77v1F9qZPJ9kCbCsL4ewiZABNfGYoRs');
  expect(tokenAccount(USDC_MINT, owner).toBase58()).toBe('GzpVTWkyGGfBXRaprnrhV3JtGj3TT52z5w2CrEJsTfjm');
});
it('encodes TransferChecked with integer amount, decimals and owner signature', () => {
  const instruction = transferTokens(payer, owner, USDC_MINT, 3_000_000n, 6);
  expect(instruction.programId).toEqual(TOKEN_PROGRAM);
  expect(instruction.data.toString('hex')).toBe('0cc0c62d000000000006');
  expect(instruction.keys).toEqual([
    { pubkey: tokenAccount(USDC_MINT, payer), isSigner: false, isWritable: true },
    { pubkey: USDC_MINT, isSigner: false, isWritable: false },
    { pubkey: tokenAccount(USDC_MINT, owner), isSigner: false, isWritable: true },
    { pubkey: payer, isSigner: true, isWritable: false },
  ]);
});
it('encodes idempotent recipient account creation', () => {
  const instruction = createTokenAccount(payer, owner, USDC_MINT);
  expect(instruction.programId).toEqual(ASSOCIATED_TOKEN_PROGRAM);
  expect(instruction.data).toEqual(Buffer.from([1]));
  expect(instruction.keys.map(k => k.pubkey)).toEqual([payer, tokenAccount(USDC_MINT, owner), owner, USDC_MINT, SystemProgram.programId, TOKEN_PROGRAM]);
  expect(instruction.keys[0]).toMatchObject({ isSigner: true, isWritable: true });
});
it('rejects malformed token amounts and decimals', () => {
  expect(() => transferTokens(payer, owner, USDC_MINT, -1n, 6)).toThrow();
  expect(() => transferTokens(payer, owner, USDC_MINT, 3n, 256)).toThrow();
});
