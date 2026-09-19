import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnalaLending } from "../target/types/anala_lending";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

describe("anala-lending", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnalaLending as Program<AnalaLending>;

  let collateralMint: PublicKey;
  let borrowMint: PublicKey;
  let lendingPool: PublicKey;
  let collateralVault: PublicKey;
  let borrowVault: PublicKey;
  let userTokenAccount: PublicKey;
  let userBorrowAccount: PublicKey;
  let userPosition: PublicKey;

  const authority = provider.wallet.publicKey;
  const user = Keypair.generate();

  before(async () => {
    // Airdrop SOL to user
    const signature = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Create collateral mint (PreStocks token)
    collateralMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      authority,
      null,
      6
    );

    // Create borrow mint (USDC)
    borrowMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      authority,
      null,
      6
    );

    // Create user token accounts
    userTokenAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      collateralMint,
      user.publicKey
    );

    userBorrowAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      borrowMint,
      user.publicKey
    );

    // Mint some tokens to user (10 PreStocks tokens)
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      collateralMint,
      userTokenAccount,
      authority,
      10_000000 // 10 tokens with 6 decimals
    );
  });

  it("Initializes lending pool", async () => {
    [lendingPool] = PublicKey.findProgramAddressSync(
      [Buffer.from("lending_pool"), collateralMint.toBuffer()],
      program.programId
    );

    [collateralVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("collateral_vault"), lendingPool.toBuffer()],
      program.programId
    );

    [borrowVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("borrow_vault"), lendingPool.toBuffer()],
      program.programId
    );

    const ltvBps = 5200; // 52% LTV (from Anala AI)
    const interestRateBps = 500; // 5% APY

    await program.methods
      .initializePool(ltvBps, interestRateBps)
      .accounts({
        lendingPool,
        collateralMint,
        borrowMint,
        collateralVault,
        borrowVault,
        authority,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const poolAccount = await program.account.lendingPool.fetch(lendingPool);
    assert.equal(poolAccount.ltvRatio, ltvBps);
    assert.equal(poolAccount.interestRate, interestRateBps);
    assert.equal(poolAccount.totalCollateral.toNumber(), 0);
    assert.equal(poolAccount.totalBorrowed.toNumber(), 0);
  });

  it("Deposits collateral", async () => {
    [userPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_position"), lendingPool.toBuffer(), user.publicKey.toBuffer()],
      program.programId
    );

    const depositAmount = new anchor.BN(5_000000); // 5 tokens

    await program.methods
      .depositCollateral(depositAmount)
      .accounts({
        lendingPool,
        userPosition,
        collateralVault,
        userTokenAccount,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    const position = await program.account.userPosition.fetch(userPosition);
    assert.equal(position.collateralAmount.toNumber(), depositAmount.toNumber());
    assert.equal(position.borrowedAmount.toNumber(), 0);

    const poolAccount = await program.account.lendingPool.fetch(lendingPool);
    assert.equal(poolAccount.totalCollateral.toNumber(), depositAmount.toNumber());
  });

  it("Borrows against collateral", async () => {
    // Mint USDC to borrow vault first (simulating liquidity)
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      borrowMint,
      borrowVault,
      authority,
      10_000_000000 // 10,000 USDC
    );

    // User has 5 tokens @ $1000 = $5000 collateral
    // LTV 52% = max borrow $2600
    const borrowAmount = new anchor.BN(2_000_000000); // $2000

    await program.methods
      .borrow(borrowAmount)
      .accounts({
        lendingPool,
        userPosition,
        borrowVault,
        userBorrowAccount,
        user: user.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    const position = await program.account.userPosition.fetch(userPosition);
    assert.equal(position.borrowedAmount.toNumber(), borrowAmount.toNumber());

    const poolAccount = await program.account.lendingPool.fetch(lendingPool);
    assert.equal(poolAccount.totalBorrowed.toNumber(), borrowAmount.toNumber());
  });

  it("Repays borrowed amount", async () => {
    const repayAmount = new anchor.BN(2_000_000000);

    await program.methods
      .repay(repayAmount)
      .accounts({
        lendingPool,
        userPosition,
        borrowVault,
        userBorrowAccount,
        user: user.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    const position = await program.account.userPosition.fetch(userPosition);
    assert.equal(position.borrowedAmount.toNumber(), 0);

    const poolAccount = await program.account.lendingPool.fetch(lendingPool);
    assert.equal(poolAccount.totalBorrowed.toNumber(), 0);
  });

  it("Withdraws collateral", async () => {
    const withdrawAmount = new anchor.BN(5_000000);

    await program.methods
      .withdrawCollateral(withdrawAmount)
      .accounts({
        lendingPool,
        userPosition,
        collateralVault,
        userTokenAccount,
        user: user.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    const position = await program.account.userPosition.fetch(userPosition);
    assert.equal(position.collateralAmount.toNumber(), 0);

    const poolAccount = await program.account.lendingPool.fetch(lendingPool);
    assert.equal(poolAccount.totalCollateral.toNumber(), 0);
  });

  it("Updates LTV ratio (admin only)", async () => {
    const newLtvBps = 6200; // 62% (improved risk score)

    await program.methods
      .updateLtv(newLtvBps)
      .accounts({
        lendingPool,
        authority,
      })
      .rpc();

    const poolAccount = await program.account.lendingPool.fetch(lendingPool);
    assert.equal(poolAccount.ltvRatio, newLtvBps);
  });
});
