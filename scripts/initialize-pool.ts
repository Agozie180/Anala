#!/usr/bin/env tsx
/**
 * Initialize lending pool for a PreStocks token
 */

import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { IDL } from '../src/lib/defi/idl';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: tsx scripts/initialize-pool.ts <COLLATERAL_MINT> <LTV_BPS> <INTEREST_BPS>');
    console.error('Example: tsx scripts/initialize-pool.ts ANTHRoPiC... 5170 500');
    process.exit(1);
  }

  const collateralMint = new PublicKey(args[0]);
  const ltvBps = parseInt(args[1]);
  const interestBps = parseInt(args[2]);

  console.log('Initializing Lending Pool');
  console.log('========================');
  console.log(`Collateral Mint: ${collateralMint.toBase58()}`);
  console.log(`LTV: ${ltvBps / 100}%`);
  console.log(`Interest Rate: ${interestBps / 100}%`);
  console.log('');

  // Load wallet
  const walletPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );

  // Setup connection
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const wallet = {
    publicKey: walletKeypair.publicKey,
    signTransaction: async (tx: any) => {
      tx.partialSign(walletKeypair);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => {
      return txs.map(tx => {
        tx.partialSign(walletKeypair);
        return tx;
      });
    },
  };

  const provider = new AnchorProvider(connection, wallet as any, {
    commitment: 'confirmed',
  });

  // Load program
  const programId = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID || '11111111111111111111111111111111');
  const program = new Program(IDL as any, programId, provider);

  // Derive PDAs
  const [lendingPool] = PublicKey.findProgramAddressSync(
    [Buffer.from('lending_pool'), collateralMint.toBuffer()],
    programId
  );

  const [collateralVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('collateral_vault'), lendingPool.toBuffer()],
    programId
  );

  const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

  const [borrowVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('borrow_vault'), lendingPool.toBuffer()],
    programId
  );

  console.log('Derived Accounts:');
  console.log(`Lending Pool: ${lendingPool.toBase58()}`);
  console.log(`Collateral Vault: ${collateralVault.toBase58()}`);
  console.log(`Borrow Vault: ${borrowVault.toBase58()}`);
  console.log('');

  // Initialize pool
  console.log('Sending transaction...');
  const tx = await program.methods
    .initializePool(ltvBps, interestBps)
    .accounts({
      lendingPool,
      collateralMint,
      borrowMint: usdcMint,
      collateralVault,
      borrowVault,
      authority: walletKeypair.publicKey,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  console.log('✅ Pool initialized!');
  console.log(`Transaction: ${tx}`);
  console.log('');
  console.log('Pool Details:');
  console.log(`Address: ${lendingPool.toBase58()}`);
  console.log(`LTV Ratio: ${ltvBps / 100}%`);
  console.log(`Interest Rate: ${interestBps / 100}% APY`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
