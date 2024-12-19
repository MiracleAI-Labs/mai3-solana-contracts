import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TaskTrader } from "../target/types/task_trader";
import {
  PublicKey,
  Keypair,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  createAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("task-trader", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.task_trader as Program<TaskTrader>;
  const wallet = (provider.wallet as anchor.Wallet).payer;
  let admin: PublicKey;
  let poolAuthority: PublicKey;
  let usdtMint: PublicKey;
  let mai3Mint: PublicKey;
  let userUsdtAccount: PublicKey;
  let userMai3Account: PublicKey;
  let poolUsdtAccount: PublicKey;
  let poolMai3Account: PublicKey;

  before(async () => {
    [admin] = PublicKey.findProgramAddressSync(
      [Buffer.from("admin")],
      program.programId
    );
    [poolAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_authority")],
      program.programId
    );

    // Create USDT mint
    const usdtMintKeypair = Keypair.generate();
    usdtMint = usdtMintKeypair.publicKey;
    await createMint(
      provider.connection,
      wallet,
      wallet.publicKey,
      wallet.publicKey,
      6,
      usdtMintKeypair
    );

    // Create MAI3 mint
    const mai3MintKeypair = Keypair.generate();
    mai3Mint = mai3MintKeypair.publicKey;
    await createMint(
      provider.connection,
      wallet,
      wallet.publicKey,
      wallet.publicKey,
      6,
      mai3MintKeypair
    );

    userUsdtAccount = await createAssociatedTokenAccount(
      provider.connection,
      wallet,
      usdtMint,
      wallet.publicKey,
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    userMai3Account = await createAssociatedTokenAccount(
      provider.connection,
      wallet,
      mai3Mint,
      wallet.publicKey,
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    poolUsdtAccount = await anchor.utils.token.associatedAddress({
      mint: usdtMint,
      owner: poolAuthority,
    });

    poolMai3Account = await anchor.utils.token.associatedAddress({
      mint: mai3Mint,
      owner: poolAuthority,
    });

    // Mint tokens to user accounts
    await mintTo(
      provider.connection,
      wallet,
      usdtMint,
      userUsdtAccount,
      wallet.publicKey,
      1000000000 // 1000 USDT
    );

    await mintTo(
      provider.connection,
      wallet,
      mai3Mint,
      userMai3Account,
      wallet.publicKey,
      1000000000 // 1000 MAI3
    );

    await program.methods
      .initialize(wallet.publicKey, wallet.publicKey)
      .accounts({
        payer: wallet.publicKey,
        admin: admin,
        system_program: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();
  });

  it("Initialize admin account", async () => {
    const adminAccount = await program.account.admin.fetch(admin);
    assert.ok(adminAccount.signer.equals(wallet.publicKey));
    assert.ok(adminAccount.feeReceiver.equals(wallet.publicKey));
  });

  it("Verify token balances after minting", async () => {
    const usdtBalance = await provider.connection.getTokenAccountBalance(
      userUsdtAccount
    );
    const mai3Balance = await provider.connection.getTokenAccountBalance(
      userMai3Account
    );
    assert.equal(
      usdtBalance.value.amount,
      "1000000000",
      "USDT balance should be 1000000000"
    );
    assert.equal(
      mai3Balance.value.amount,
      "1000000000",
      "MAI3 balance should be 1000000000"
    );
    assert.equal(usdtBalance.value.decimals, 6, "USDT decimals should be 6");
    assert.equal(mai3Balance.value.decimals, 6, "MAI3 decimals should be 6");
  });

  it("Create a task with USDT", async () => {
    const taskId = 1;
    const taskAmount = 100_000_000; // 100 USDT
    const takerNum = 10;
    const rewards = 50_000_000; // 50 MAI3

    // task_info is a PDA
    const [taskInfo] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("task_info"),
        new anchor.BN(taskId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Get user's initial USDT balance
    const initialUsdtBalance = await provider.connection.getTokenAccountBalance(
      userUsdtAccount
    );
    const initialMai3Balance = await provider.connection.getTokenAccountBalance(
      userMai3Account
    );

    try {
      await program.methods
        .createTask(
          new anchor.BN(taskId),
          new anchor.BN(taskAmount),
          new anchor.BN(takerNum),
          new anchor.BN(0), // 0 for USDT
          new anchor.BN(rewards)
        )
        .accounts({
          user: wallet.publicKey,
          admin: admin,
          poolAuthority: poolAuthority,
          taskInfo: taskInfo,
          usdtMint: usdtMint,
          mai3Mint: mai3Mint,
          userUsdtAccount: userUsdtAccount,
          userMai3Account: userMai3Account,
          poolUsdtAccount: poolUsdtAccount,
          poolMai3Account: poolMai3Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([wallet])
        .rpc();
    } catch (error) {
      console.error("Error details:", error);
      throw error;
    }

    // Verify task info
    const taskInfoAccount = await program.account.taskInfo.fetch(taskInfo);
    assert.equal(taskInfoAccount.taskId.toNumber(), taskId);
    assert.equal(taskInfoAccount.taskAmount.toNumber(), taskAmount);
    assert.equal(taskInfoAccount.takerNum.toNumber(), takerNum);
    assert.equal(
      taskInfoAccount.amountPerTask.toNumber(),
      taskAmount / takerNum
    );
    assert.equal(taskInfoAccount.coinType.toNumber(), 0);
    assert.equal(taskInfoAccount.rewards.toNumber(), rewards);
    assert.equal(taskInfoAccount.state.toNumber(), 0);
    assert.ok(taskInfoAccount.requester.equals(wallet.publicKey));

    // // Verify token transfer
    const finalUsdtBalance = await provider.connection.getTokenAccountBalance(
      userUsdtAccount
    );
    assert.equal(
      finalUsdtBalance.value.amount,
      (parseInt(initialUsdtBalance.value.amount) - taskAmount).toString(),
      "USDT not transferred correctly"
    );

    const poolUsdtBalance = await provider.connection.getTokenAccountBalance(
      poolUsdtAccount
    );
    assert.equal(
      poolUsdtBalance.value.amount,
      taskAmount.toString(),
      "Pool USDT balance incorrect"
    );
  });

  it("Create a task with MAI3", async () => {
    const taskId = 2;
    const taskAmount = 200_000_000; // 200 MAI3
    const takerNum = 5;
    const rewards = 100_000_000; // 100 USDT

    // task_info is a PDA
    const [taskInfo] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("task_info"),
        new anchor.BN(taskId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Get user's initial MAI3 balance
    const initialMai3Balance = await provider.connection.getTokenAccountBalance(
      userMai3Account
    );
    const initialUsdtBalance = await provider.connection.getTokenAccountBalance(
      userUsdtAccount
    );

    try {
      await program.methods
        .createTask(
          new anchor.BN(taskId),
          new anchor.BN(taskAmount),
          new anchor.BN(takerNum),
          new anchor.BN(1), // 1 for MAI3
          new anchor.BN(rewards)
        )
        .accounts({
          user: wallet.publicKey,
          admin: admin,
          poolAuthority: poolAuthority,
          taskInfo: taskInfo,
          usdtMint: usdtMint,
          mai3Mint: mai3Mint,
          userUsdtAccount: userUsdtAccount,
          userMai3Account: userMai3Account,
          poolUsdtAccount: poolUsdtAccount,
          poolMai3Account: poolMai3Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([wallet])
        .rpc();
    } catch (error) {
      console.error("Error details:", error);
      throw error;
    }

    // Verify task info
    const taskInfoAccount = await program.account.taskInfo.fetch(taskInfo);
    assert.equal(taskInfoAccount.taskId.toNumber(), taskId);
    assert.equal(taskInfoAccount.taskAmount.toNumber(), taskAmount);
    assert.equal(taskInfoAccount.takerNum.toNumber(), takerNum);
    assert.equal(
      taskInfoAccount.amountPerTask.toNumber(),
      taskAmount / takerNum
    );
    assert.equal(taskInfoAccount.coinType.toNumber(), 1); // MAI3
    assert.equal(taskInfoAccount.rewards.toNumber(), rewards);
    assert.equal(taskInfoAccount.state.toNumber(), 0);
    assert.ok(taskInfoAccount.requester.equals(wallet.publicKey));

    // Verify token transfer
    const finalMai3Balance = await provider.connection.getTokenAccountBalance(
      userMai3Account
    );
    assert.equal(
      finalMai3Balance.value.amount,
      (parseInt(initialMai3Balance.value.amount) - taskAmount).toString(),
      "MAI3 not transferred correctly"
    );

    const poolMai3Balance = await provider.connection.getTokenAccountBalance(
      poolMai3Account
    );
    assert.equal(
      poolMai3Balance.value.amount,
      taskAmount.toString(),
      "Pool MAI3 balance incorrect"
    );
  });
});
