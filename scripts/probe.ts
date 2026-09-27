/** One-off: compute discriminators + probe on-chain reality of all 3 pools. */
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getMint, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';

const RPC = 'http://127.0.0.1:8899';
const PROGRAM_ID = new PublicKey('7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG');
const USDC = new PublicKey('7HDB5XDF1dvokyzbenQkgDpM68HWN3ACYUow3psprXiV');

const TOKENS: Record<string, string> = {
  ANTHROPIC: '39fD6juh9ARCHR7TseVDk4QFm9oKWq7jcnpb5uwGLsc4',
  OPENAI: 'EEYiwFymCcrGYuwSAtf6P9RZzRAGbVcc1nxTbpLCPvyj',
  SPACEX: 'HLJRVyDxqUrRvMqqVs4niCtmz4ge32Hg7PoPnbTienwS',
};

function disc(name: string) {
  return Array.from(crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8));
}

async function main() {
  console.log('=== DISCRIMINATORS (hardcode these) ===');
  for (const n of ['deposit_collateral', 'borrow', 'repay', 'withdraw_collateral', 'initialize_pool']) {
    console.log(`  ${n.padEnd(20)} [${disc(n).join(',')}]`);
  }

  const conn = new Connection(RPC, 'confirmed');
  const walletPath = os.homedir() + '/.config/solana/id.json';
  const authority = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))).publicKey;
  console.log('\n=== local authority (faucet signer) ===\n  ' + authority.toBase58());

  const usdcMint = await getMint(conn, USDC).catch(() => null);
  console.log('\n=== USDC mint ===');
  console.log('  decimals:', usdcMint?.decimals, ' mintAuthority:', usdcMint?.mintAuthority?.toBase58());

  for (const [name, mintStr] of Object.entries(TOKENS)) {
    console.log(`\n=== ${name} ===`);
    const mint = new PublicKey(mintStr);
    const m = await getMint(conn, mint).catch((e) => { console.log('  mint MISSING:', e.message); return null; });
    if (m) console.log(`  mint decimals=${m.decimals} authority=${m.mintAuthority?.toBase58()} authIsLocal=${m.mintAuthority?.equals(authority)}`);

    const [pool] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), mint.toBuffer()], PROGRAM_ID);
    const [cVault] = PublicKey.findProgramAddressSync([Buffer.from('collateral_vault'), pool.toBuffer()], PROGRAM_ID);
    const [bVault] = PublicKey.findProgramAddressSync([Buffer.from('borrow_vault'), pool.toBuffer()], PROGRAM_ID);
    console.log('  pool  :', pool.toBase58());
    const poolInfo = await conn.getAccountInfo(pool);
    console.log('  pool initialized:', !!poolInfo, poolInfo ? `(owner=${poolInfo.owner.equals(PROGRAM_ID) ? 'PROGRAM' : poolInfo.owner.toBase58()}, ${poolInfo.data.length}b)` : '');
    const cv = await getAccount(conn, cVault).catch(() => null);
    const bv = await getAccount(conn, bVault).catch(() => null);
    console.log('  collateral_vault:', cVault.toBase58(), cv ? `bal=${cv.amount}` : '(missing)');
    console.log('  borrow_vault    :', bVault.toBase58(), bv ? `USDC bal=${bv.amount}` : '(missing)');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
