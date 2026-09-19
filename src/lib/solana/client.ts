import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

/**
 * Solana RPC client for Anala.
 * Connects to Solana mainnet for PreStocks token data.
 */

export type SolanaCluster = "mainnet-beta" | "devnet" | "testnet";

export interface SolanaConfig {
  rpcUrl?: string;
  cluster?: SolanaCluster;
  commitment?: "processed" | "confirmed" | "finalized";
}

export function solanaConfigFromEnv(): SolanaConfig {
  return {
    rpcUrl: process.env.SOLANA_RPC_URL || undefined,
    cluster: (process.env.SOLANA_CLUSTER as SolanaCluster) || "mainnet-beta",
    commitment: "confirmed",
  };
}

export function getSolanaConnection(cfg: SolanaConfig = solanaConfigFromEnv()): Connection {
  const url = cfg.rpcUrl || clusterApiUrl(cfg.cluster || "mainnet-beta");
  return new Connection(url, cfg.commitment || "confirmed");
}

export async function getTokenBalance(
  connection: Connection,
  walletAddress: string,
  tokenMint: string,
): Promise<number> {
  try {
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(tokenMint);

    // Get token accounts by owner
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet, {
      mint,
    });

    if (tokenAccounts.value.length === 0) return 0;

    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return balance || 0;
  } catch (err) {
    console.error("Failed to fetch token balance:", err);
    return 0;
  }
}

export async function getAccountInfo(
  connection: Connection,
  address: string,
): Promise<{ lamports: number; solBalance: number } | null> {
  try {
    const pubkey = new PublicKey(address);
    const info = await connection.getAccountInfo(pubkey);

    if (!info) return null;

    return {
      lamports: info.lamports,
      solBalance: info.lamports / 1e9, // Convert lamports to SOL
    };
  } catch (err) {
    console.error("Failed to fetch account info:", err);
    return null;
  }
}

/**
 * Verify a Solana address is valid
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
