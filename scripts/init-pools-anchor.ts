import { AnchorProvider, Program, Wallet, web3 } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';

const PROGRAM_ID = new PublicKey('7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG');
const USDC_MINT = new PublicKey('7HDB5XDF1dvokyzbenQkgDpM68HWN3ACYUow3psprXiV');

// PreStocks mints
const ANTHROPIC_MINT = new PublicKey('39fD6juh9ARCHR7TseVDk4QFm9oKWq7jcnpb5uwGLsc4');
const OPENAI_MINT = new PublicKey('EEYiwFymCcrGYuwSAtf6P9RZzRAGbVcc1nxTbpLCPvyj');
const SPACEX_MINT = new PublicKey('HLJRVyDxqUrRvMqqVs4niCtmz4ge32Hg7PoPnbTienwS');

const pools = [
  { name: 'ANTHROPIC', mint: ANTHROPIC_MINT, ltvBps: 5170, interestBps: 500 },
  { name: 'OPENAI', mint: OPENAI_MINT, ltvBps: 4750, interestBps: 500 },
  { name: 'SPACEX', mint: SPACEX_MINT, ltvBps: 4580, interestBps: 500 },
];

// Minimal IDL with just initialize_pool
const IDL = {
  address: '7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG',
  metadata: {
    name: 'anala_lending',
    version: '0.1.0',
    spec: '0.1.0',
  },
  instructions: [
    {
      name: 'initializePool',
      discriminator: [95, 180, 10, 172, 84, 174, 232, 40],
      accounts: [
        { name: 'lendingPool', isMut: true, isSigner: false },
        { name: 'collateralMint', isMut: false, isSigner: false },
        { name: 'borrowMint', isMut: false, isSigner: false },
        { name: 'collateralVault', isMut: true, isSigner: false },
        { name: 'borrowVault', isMut: true, isSigner: false },
        { name: 'authority', isMut: true, isSigner: true },
        { name: 'systemProgram', isMut: false, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
        { name: 'rent', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'ltvBasisPoints', type: 'u16' },
        { name: 'interestRateBps', type: 'u16' },
      ],
    },
  ],
  types: [],
};

async function main() {
  const connection = new Connection('http://127.0.0.1:8899', 'confirmed');

  const walletPath = process.env.HOME + '/.config/solana/id.json';
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const wallet = Keypair.fromSecretKey(new Uint8Array(walletData));

  const provider = new AnchorProvider(
    connection,
    new Wallet(wallet),
    { commitment: 'confirmed' }
  );

  const program = new Program(IDL as any, PROGRAM_ID, provider);

  console.log('Wallet:', wallet.publicKey.toBase58());
  console.log('Program:', PROGRAM_ID.toBase58());
  console.log('USDC Mint:', USDC_MINT.toBase58());
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

    try {
      const tx = await program.methods
        .initializePool(pool.ltvBps, pool.interestBps)
        .accounts({
          lendingPool,
          collateralMint: pool.mint,
          borrowMint: USDC_MINT,
          collateralVault,
          borrowVault,
          authority: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log(`  ✓ Pool initialized: ${tx}`);
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
