/**
 * Initialize lending pools for PreStocks tokens
 * Usage: npx tsx scripts/initialize-pool.ts <collateral_mint> <ltv_bps> <interest_bps>
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import * as os from 'os';

const PROGRAM_ID = new PublicKey('7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG');
const USDC_MINT = new PublicKey('7HDB5XDF1dvokyzbenQkgDpM68HWN3ACYUow3psprXiV');

// Instruction discriminators (first 8 bytes of SHA256("global:initialize_pool"))
const INITIALIZE_POOL_DISCRIMINATOR = Buffer.from([95, 180, 10, 172, 84, 174, 232, 40]);

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: npx tsx initialize-pool.ts <collateral_mint> <ltv_bps> <interest_bps>');
    console.error('Example: npx tsx initialize-pool.ts 9fWW...Pu6r 5170 500');
    process.exit(1);
  }

  const collateralMint = new PublicKey(args[0]);
  const ltvBps = parseInt(args[1]);
  const interestBps = parseInt(args[2]);

  console.log('Initializing Lending Pool');
  console.log('========================');
  console.log(`Collateral Mint: ${collateralMint.toBase58()}`);
  console.log(`LTV: ${(ltvBps / 100).toFixed(1)}%`);
  console.log(`Interest Rate: ${(interestBps / 100).toFixed(1)}%`);
  console.log('');

  // Connect to local validator
  const connection = new Connection('http://127.0.0.1:8899', 'confirmed');

  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );

  console.log(`Authority: ${walletKeypair.publicKey.toBase58()}`);

  // Derive PDAs
  const [lendingPool] = PublicKey.findProgramAddressSync(
    [Buffer.from('lending_pool'), collateralMint.toBuffer()],
    PROGRAM_ID
  );

  const [collateralVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('collateral_vault'), lendingPool.toBuffer()],
    PROGRAM_ID
  );

  const [borrowVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('borrow_vault'), lendingPool.toBuffer()],
    PROGRAM_ID
  );

  console.log(`Lending Pool PDA: ${lendingPool.toBase58()}`);
  console.log(`Collateral Vault: ${collateralVault.toBase58()}`);
  console.log(`Borrow Vault: ${borrowVault.toBase58()}`);
  console.log('');

  // Build instruction data: discriminator + ltv_bps (u16 LE) + interest_bps (u16 LE)
  const data = Buffer.alloc(8 + 2 + 2);
  INITIALIZE_POOL_DISCRIMINATOR.copy(data, 0);
  data.writeUInt16LE(ltvBps, 8);
  data.writeUInt16LE(interestBps, 10);

  // Build instruction
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: lendingPool, isSigner: false, isWritable: true },
      { pubkey: collateralMint, isSigner: false, isWritable: false },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: collateralVault, isSigner: false, isWritable: true },
      { pubkey: borrowVault, isSigner: false, isWritable: true },
      { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  // Send transaction
  console.log('Sending transaction...');
  const tx = new Transaction().add(ix);
  const signature = await connection.sendTransaction(tx, [walletKeypair], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log(`Transaction sent: ${signature}`);
  console.log('Waiting for confirmation...');

  await connection.confirmTransaction(signature, 'confirmed');

  console.log('✅ Pool initialized successfully!');
  console.log('');
  console.log('Pool Details:');
  console.log(`  Address: ${lendingPool.toBase58()}`);
  console.log(`  Collateral: ${collateralMint.toBase58()}`);
  console.log(`  Borrow: ${USDC_MINT.toBase58()}`);
  console.log(`  LTV: ${(ltvBps / 100).toFixed(1)}%`);
  console.log(`  Interest: ${(interestBps / 100).toFixed(1)}%`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
