/**
 * Read-only: dump the live on-chain state of all three lending pools (devnet),
 * so the corrected prices/LTVs can be verified after a keeper run.
 *
 *   SOLANA_RPC_URL=https://api.devnet.solana.com npx tsx scripts/verify-pools.ts
 */
import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(
  process.env.LENDING_PROGRAM_ID || '7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG',
);

async function main() {
  const conn = new Connection(RPC, 'confirmed');
  const mints = JSON.parse(fs.readFileSync(path.join(__dirname, '.devnet-mints.json'), 'utf-8'));
  console.log('RPC    :', RPC);
  console.log('Program:', PROGRAM_ID.toBase58(), '\n');

  for (const name of ['ANTHROPIC', 'OPENAI', 'SPACEX']) {
    const mint = new PublicKey(mints[name]);
    const [pool] = PublicKey.findProgramAddressSync(
      [Buffer.from('lending_pool'), mint.toBuffer()],
      PROGRAM_ID,
    );
    const info = await conn.getAccountInfo(pool);
    if (!info) {
      console.log(name.padEnd(9), 'NOT FOUND', pool.toBase58());
      continue;
    }
    const d = info.data;
    const price = d.readBigUInt64LE(189);
    const dec = d.readUInt8(197);
    const ltv = d.readUInt16LE(184);
    const irate = d.readUInt16LE(186);
    const totalCollateral = d.readBigUInt64LE(168);
    const totalBorrowed = d.readBigUInt64LE(176);
    console.log(
      name.padEnd(9),
      'price=$' + (Number(price) / 1e6).toFixed(2).padStart(9),
      'dp=' + dec,
      'ltv=' + ltv / 100 + '%',
      'apr=' + irate / 100 + '%',
      '| collat=' + totalCollateral,
      'borrowed=' + totalBorrowed,
      '\n          pool=' + pool.toBase58(),
    );
  }
}

main().catch((e) => {
  console.error('verify-pools failed:', e.message);
  process.exit(1);
});
