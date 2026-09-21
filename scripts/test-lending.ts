import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import * as fs from 'fs';

const PROGRAM_ID = new PublicKey('7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG');
const USDC_MINT = new PublicKey('7HDB5XDF1dvokyzbenQkgDpM68HWN3ACYUow3psprXiV');
const ANTHROPIC_MINT = new PublicKey('39fD6juh9ARCHR7TseVDk4QFm9oKWq7jcnpb5uwGLsc4');
const ANTHROPIC_POOL = new PublicKey('GHN8tjJQdeTxfKctkds61iQ8B1PpXpLEifqm3p8evkNE');

async function main() {
  const connection = new Connection('http://127.0.0.1:8899', 'confirmed');

  const walletPath = process.env.HOME + '/.config/solana/id.json';
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const wallet = Keypair.fromSecretKey(new Uint8Array(walletData));

  console.log('🧪 Testing Anala Lending Protocol\n');
  console.log('Wallet:', wallet.publicKey.toBase58());
  console.log('Program:', PROGRAM_ID.toBase58());
  console.log('Pool:', ANTHROPIC_POOL.toBase58());
  console.log('');

  // 1. Mint ANTHROPIC tokens to user
  console.log('1️⃣  Minting 100 ANTHROPIC tokens...');
  const userAnthropicAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    ANTHROPIC_MINT,
    wallet.publicKey
  );

  await mintTo(
    connection,
    wallet,
    ANTHROPIC_MINT,
    userAnthropicAccount.address,
    wallet,
    100 * 10 ** 9 // 100 tokens with 9 decimals
  );
  console.log('  ✓ Minted to:', userAnthropicAccount.address.toBase58());

  // 2. Deposit collateral
  console.log('\n2️⃣  Depositing 10 ANTHROPIC as collateral...');

  const [userPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_position'), ANTHROPIC_POOL.toBuffer(), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );

  const [collateralVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('collateral_vault'), ANTHROPIC_POOL.toBuffer()],
    PROGRAM_ID
  );

  // deposit_collateral discriminator
  const depositDiscriminator = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);
  const amount = Buffer.alloc(8);
  amount.writeBigUInt64LE(BigInt(10 * 10 ** 9));
  const depositData = Buffer.concat([depositDiscriminator, amount]);

  const depositKeys = [
    { pubkey: ANTHROPIC_POOL, isSigner: false, isWritable: true },
    { pubkey: userPosition, isSigner: false, isWritable: true },
    { pubkey: userAnthropicAccount.address, isSigner: false, isWritable: true },
    { pubkey: collateralVault, isSigner: false, isWritable: true },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const depositIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: depositKeys,
    data: depositData,
  });

  try {
    const depositTx = new Transaction().add(depositIx);
    const depositSig = await connection.sendTransaction(depositTx, [wallet]);
    await connection.confirmTransaction(depositSig, 'confirmed');
    console.log('  ✓ Deposited:', depositSig);
    console.log('  User Position:', userPosition.toBase58());
  } catch (err: any) {
    console.error('  ✗ Deposit failed:', err.message);
    if (err.logs) {
      console.error('  Logs:', err.logs.join('\n  '));
    }
    return;
  }

  console.log('\n✅ Lending protocol is working!');
}

main().catch(console.error);
