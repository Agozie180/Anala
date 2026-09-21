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
import * as crypto from 'crypto';

const PROGRAM_ID = new PublicKey('7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG');
const USDC_MINT = new PublicKey('7HDB5XDF1dvokyzbenQkgDpM68HWN3ACYUow3psprXiV');

const ANTHROPIC_MINT = new PublicKey('39fD6juh9ARCHR7TseVDk4QFm9oKWq7jcnpb5uwGLsc4');
const OPENAI_MINT = new PublicKey('EEYiwFymCcrGYuwSAtf6P9RZzRAGbVcc1nxTbpLCPvyj');
const SPACEX_MINT = new PublicKey('HLJRVyDxqUrRvMqqVs4niCtmz4ge32Hg7PoPnbTienwS');

const pools = [
  { name: 'ANTHROPIC', mint: ANTHROPIC_MINT, ltvBps: 5170, interestBps: 500 },
  { name: 'OPENAI', mint: OPENAI_MINT, ltvBps: 4750, interestBps: 500 },
  { name: 'SPACEX', mint: SPACEX_MINT, ltvBps: 4580, interestBps: 500 },
];

// Calculate correct Anchor discriminator
function getDiscriminator(instructionName: string): Buffer {
  const hash = crypto.createHash('sha256')
    .update(`global:${instructionName}`)
    .digest();
  return hash.slice(0, 8);
}

async function main() {
  const connection = new Connection('http://127.0.0.1:8899', 'confirmed');

  const walletPath = process.env.HOME + '/.config/solana/id.json';
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const wallet = Keypair.fromSecretKey(new Uint8Array(walletData));

  console.log('Wallet:', wallet.publicKey.toBase58());
  console.log('Program:', PROGRAM_ID.toBase58());
  console.log('USDC Mint:', USDC_MINT.toBase58());
  console.log('');

  const discriminator = getDiscriminator('initialize_pool');
  console.log('Discriminator:', Array.from(discriminator));
  console.log('');

  for (const pool of pools) {
    console.log(`\nInitializing ${pool.name} pool...`);
    console.log(`  Collateral: ${pool.mint.toBase58()}`);
    console.log(`  LTV: ${pool.ltvBps} bps (${pool.ltvBps / 100}%)`);
    console.log(`  Interest: ${pool.interestBps} bps (${pool.interestBps / 100}%)`);

    const [lendingPool] = PublicKey.findProgramAddressSync(
      [Buffer.from('lending_pool'), pool.mint.toBuffer()],
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

    const ltvBuffer = Buffer.alloc(2);
    ltvBuffer.writeUInt16LE(pool.ltvBps);
    const interestBuffer = Buffer.alloc(2);
    interestBuffer.writeUInt16LE(pool.interestBps);
    const data = Buffer.concat([discriminator, ltvBuffer, interestBuffer]);

    const keys = [
      { pubkey: lendingPool, isSigner: false, isWritable: true },
      { pubkey: pool.mint, isSigner: false, isWritable: false },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: collateralVault, isSigner: false, isWritable: true },
      { pubkey: borrowVault, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys,
      data,
    });

    const tx = new Transaction().add(ix);

    try {
      const sig = await connection.sendTransaction(tx, [wallet], {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction(sig, 'confirmed');
      console.log(`  ✓ Pool initialized: ${sig}`);
      console.log(`  Pool PDA: ${lendingPool.toBase58()}`);
    } catch (err: any) {
      console.error(`  ✗ Failed:`, err.message);
      if (err.logs) {
        console.error('  Logs:', err.logs.join('\n  '));
      }
    }
  }

  console.log('\n✓ All pools initialized');
}

main().catch(console.error);
