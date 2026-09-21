/**
 * Smart contract client for Anala Lending Protocol
 */

import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import type { AnchorWallet } from '@solana/wallet-adapter-react';

// Program ID (deployed Anala Lending program)
const PROGRAM_ID = new PublicKey('7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG');

// USDC mint on devnet
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

export interface LendingPoolData {
  authority: PublicKey;
  collateralMint: PublicKey;
  collateralVault: PublicKey;
  borrowMint: PublicKey;
  borrowVault: PublicKey;
  totalCollateral: BN;
  totalBorrowed: BN;
  ltvRatio: number;
  interestRate: number;
  bump: number;
}

export interface UserPositionData {
  owner: PublicKey;
  pool: PublicKey;
  collateralAmount: BN;
  borrowedAmount: BN;
  borrowedAt: BN;
  lastInterestUpdate: BN;
  bump: number;
}

export class LendingClient {
  constructor(
    private connection: Connection,
    private wallet: AnchorWallet,
    private program: Program
  ) {}

  /**
   * Get lending pool PDA for a collateral mint
   */
  async getLendingPoolAddress(collateralMint: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('lending_pool'), collateralMint.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Get user position PDA
   */
  async getUserPositionAddress(
    lendingPool: PublicKey,
    user: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_position'), lendingPool.toBuffer(), user.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Get collateral vault PDA
   */
  async getCollateralVaultAddress(lendingPool: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('collateral_vault'), lendingPool.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Get borrow vault PDA
   */
  async getBorrowVaultAddress(lendingPool: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('borrow_vault'), lendingPool.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Initialize a lending pool for a PreStocks token
   */
  async initializePool(
    collateralMint: PublicKey,
    ltvBasisPoints: number,
    interestRateBps: number
  ): Promise<string> {
    const [lendingPool] = await this.getLendingPoolAddress(collateralMint);
    const [collateralVault] = await this.getCollateralVaultAddress(lendingPool);
    const [borrowVault] = await this.getBorrowVaultAddress(lendingPool);

    const tx = await this.program.methods
      .initializePool(ltvBasisPoints, interestRateBps)
      .accounts({
        lendingPool,
        collateralMint,
        borrowMint: USDC_MINT,
        collateralVault,
        borrowVault,
        authority: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Deposit collateral
   */
  async depositCollateral(
    collateralMint: PublicKey,
    amount: number
  ): Promise<string> {
    const [lendingPool] = await this.getLendingPoolAddress(collateralMint);
    const [userPosition] = await this.getUserPositionAddress(
      lendingPool,
      this.wallet.publicKey
    );
    const [collateralVault] = await this.getCollateralVaultAddress(lendingPool);

    const userTokenAccount = await getAssociatedTokenAddress(
      collateralMint,
      this.wallet.publicKey
    );

    const amountBN = new BN(amount * 1_000000); // Assuming 6 decimals

    const tx = await this.program.methods
      .depositCollateral(amountBN)
      .accounts({
        lendingPool,
        userPosition,
        collateralVault,
        userTokenAccount,
        user: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Borrow USDC
   */
  async borrow(
    collateralMint: PublicKey,
    amountUsdc: number
  ): Promise<string> {
    const [lendingPool] = await this.getLendingPoolAddress(collateralMint);
    const [userPosition] = await this.getUserPositionAddress(
      lendingPool,
      this.wallet.publicKey
    );
    const [borrowVault] = await this.getBorrowVaultAddress(lendingPool);

    const userBorrowAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      this.wallet.publicKey
    );

    const amountBN = new BN(amountUsdc * 1_000000); // USDC has 6 decimals

    const tx = await this.program.methods
      .borrow(amountBN)
      .accounts({
        lendingPool,
        userPosition,
        borrowVault,
        userBorrowAccount,
        user: this.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Repay borrowed USDC
   */
  async repay(
    collateralMint: PublicKey,
    amountUsdc: number
  ): Promise<string> {
    const [lendingPool] = await this.getLendingPoolAddress(collateralMint);
    const [userPosition] = await this.getUserPositionAddress(
      lendingPool,
      this.wallet.publicKey
    );
    const [borrowVault] = await this.getBorrowVaultAddress(lendingPool);

    const userBorrowAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      this.wallet.publicKey
    );

    const amountBN = new BN(amountUsdc * 1_000000);

    const tx = await this.program.methods
      .repay(amountBN)
      .accounts({
        lendingPool,
        userPosition,
        borrowVault,
        userBorrowAccount,
        user: this.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Withdraw collateral
   */
  async withdrawCollateral(
    collateralMint: PublicKey,
    amount: number
  ): Promise<string> {
    const [lendingPool] = await this.getLendingPoolAddress(collateralMint);
    const [userPosition] = await this.getUserPositionAddress(
      lendingPool,
      this.wallet.publicKey
    );
    const [collateralVault] = await this.getCollateralVaultAddress(lendingPool);

    const userTokenAccount = await getAssociatedTokenAddress(
      collateralMint,
      this.wallet.publicKey
    );

    const amountBN = new BN(amount * 1_000000);

    const tx = await this.program.methods
      .withdrawCollateral(amountBN)
      .accounts({
        lendingPool,
        userPosition,
        collateralVault,
        userTokenAccount,
        user: this.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Update LTV ratio (admin only)
   */
  async updateLTV(
    collateralMint: PublicKey,
    newLtvBps: number
  ): Promise<string> {
    const [lendingPool] = await this.getLendingPoolAddress(collateralMint);

    const tx = await this.program.methods
      .updateLtv(newLtvBps)
      .accounts({
        lendingPool,
        authority: this.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  /**
   * Fetch lending pool data
   */
  async getLendingPool(collateralMint: PublicKey): Promise<LendingPoolData | null> {
    const [lendingPool] = await this.getLendingPoolAddress(collateralMint);

    try {
      const data = await (this.program.account as any).lendingPool.fetch(lendingPool);
      return data as LendingPoolData;
    } catch {
      return null;
    }
  }

  /**
   * Fetch user position data
   */
  async getUserPosition(
    collateralMint: PublicKey,
    user?: PublicKey
  ): Promise<UserPositionData | null> {
    const [lendingPool] = await this.getLendingPoolAddress(collateralMint);
    const [userPosition] = await this.getUserPositionAddress(
      lendingPool,
      user || this.wallet.publicKey
    );

    try {
      const data = await (this.program.account as any).userPosition.fetch(userPosition);
      return data as UserPositionData;
    } catch {
      return null;
    }
  }
}

/**
 * Create a lending client instance
 */
export function createLendingClient(
  connection: Connection,
  wallet: AnchorWallet,
  program: Program
): LendingClient {
  return new LendingClient(connection, wallet, program);
}
