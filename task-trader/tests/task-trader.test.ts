import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";
import { getTestContext } from "./setup";

describe("Task Trader", () => {
  let context: Awaited<ReturnType<typeof getTestContext>>;

  before(async () => {
    context = await getTestContext();
  });

  describe("Admin", () => {
    it("Initialize admin account", async () => {
      const { program, admin, wallet } = context;

      const adminAccount = await program.account.admin.fetch(admin);
      assert.ok(adminAccount.signer.equals(wallet.publicKey));
      assert.ok(adminAccount.feeReceiver.equals(wallet.publicKey));
    });

    it("Verify initial token balances", async () => {
      const { provider, userUsdtAccount, userMai3Account } = context;

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
  });

  describe("Task Creation", () => {
    it("Create a task with USDT", async () => {
      const {
        program,
        wallet,
        admin,
        poolAuthority,
        usdtMint,
        mai3Mint,
        userUsdtAccount,
        userMai3Account,
        poolUsdtAccount,
        poolMai3Account,
      } = context;

      const taskId = 1;
      const taskAmount = 100_000_000; // 100 USDT
      const takerNum = 10;
      const rewards = 50_000_000; // 50 MAI3
      const expireTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

      const [taskInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_info"),
          new anchor.BN(taskId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const initialUsdtBalance =
        await program.provider.connection.getTokenAccountBalance(
          userUsdtAccount
        );

      await program.methods
        .createTask(
          new anchor.BN(taskId),
          new anchor.BN(taskAmount),
          new anchor.BN(takerNum),
          new anchor.BN(0), // 0 for USDT
          new anchor.BN(rewards),
          new anchor.BN(expireTime)
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
      assert.deepEqual(taskInfoAccount.state, { open: {} });
      assert.ok(taskInfoAccount.requester.equals(wallet.publicKey));

      // Verify token transfer
      const finalUsdtBalance =
        await program.provider.connection.getTokenAccountBalance(
          userUsdtAccount
        );
      assert.equal(
        finalUsdtBalance.value.amount,
        (parseInt(initialUsdtBalance.value.amount) - taskAmount).toString(),
        "USDT not transferred correctly"
      );

      const poolUsdtBalance =
        await program.provider.connection.getTokenAccountBalance(
          poolUsdtAccount
        );
      assert.equal(
        poolUsdtBalance.value.amount,
        taskAmount.toString(),
        "Pool USDT balance incorrect"
      );
    });

    it("Create a task with MAI3", async () => {
      const {
        program,
        wallet,
        admin,
        poolAuthority,
        usdtMint,
        mai3Mint,
        userUsdtAccount,
        userMai3Account,
        poolUsdtAccount,
        poolMai3Account,
      } = context;

      const taskId = 2;
      const taskAmount = 200_000_000; // 200 MAI3
      const takerNum = 5;
      const rewards = 100_000_000; // 100 USDT
      const expireTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

      const [taskInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_info"),
          new anchor.BN(taskId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const initialMai3Balance =
        await program.provider.connection.getTokenAccountBalance(
          userMai3Account
        );

      await program.methods
        .createTask(
          new anchor.BN(taskId),
          new anchor.BN(taskAmount),
          new anchor.BN(takerNum),
          new anchor.BN(1), // 1 for MAI3
          new anchor.BN(rewards),
          new anchor.BN(expireTime)
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
      assert.deepEqual(taskInfoAccount.state, { open: {} });
      assert.ok(taskInfoAccount.requester.equals(wallet.publicKey));

      // Verify token transfer
      const finalMai3Balance =
        await program.provider.connection.getTokenAccountBalance(
          userMai3Account
        );
      assert.equal(
        finalMai3Balance.value.amount,
        (parseInt(initialMai3Balance.value.amount) - taskAmount).toString(),
        "MAI3 not transferred correctly"
      );

      const poolMai3Balance =
        await program.provider.connection.getTokenAccountBalance(
          poolMai3Account
        );
      assert.equal(
        poolMai3Balance.value.amount,
        taskAmount.toString(),
        "Pool MAI3 balance incorrect"
      );
    });
  });

  describe("Task Application", () => {
    it("Apply for a task", async () => {
      const { program, applicant } = context;
      const taskId = 1;

      const [taskInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_info"),
          new anchor.BN(taskId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          applicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .applyTask()
        .accounts({
          taskInfo: taskInfo,
          taskApplication: taskApplication,
          applicant: applicant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([applicant])
        .rpc();

      const taskApplicationAccount =
        await program.account.taskApplication.fetch(taskApplication);
      assert.equal(taskApplicationAccount.taskId.toNumber(), taskId);
      assert.ok(taskApplicationAccount.applicant.equals(applicant.publicKey));
      assert.ok(taskApplicationAccount.applyTime.toNumber() > 0);
    });

    it("Approve an application", async () => {
      const { program, wallet, applicant } = context;
      const taskId = 1;

      const [taskInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_info"),
          new anchor.BN(taskId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          applicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .approveApplication()
        .accounts({
          taskInfo: taskInfo,
          taskApplication: taskApplication,
          requester: wallet.publicKey,
        })
        .rpc();

      const taskApplicationAccount =
        await program.account.taskApplication.fetch(taskApplication);
      assert.equal(taskApplicationAccount.state.accepted !== undefined, true);

      const taskInfoAccount = await program.account.taskInfo.fetch(taskInfo);
      assert.equal(taskInfoAccount.approvedNum.toNumber(), 1);
    });

    it("Should fail when non-requester tries to approve application", async () => {
      const { program, applicant } = context;
      const taskId = 1;

      const [taskInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_info"),
          new anchor.BN(taskId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          applicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .approveApplication()
          .accounts({
            taskInfo: taskInfo,
            taskApplication: taskApplication,
            requester: applicant.publicKey, // Using applicant as requester
          })
          .signers([applicant])
          .rpc();
        assert.fail("Should have failed with InvalidRequester");
      } catch (error) {
        assert.include(error.message, "InvalidRequester");
      }
    });

    it("Should fail when task has reached taker limit", async () => {
      const {
        program,
        wallet,
        admin,
        poolAuthority,
        usdtMint,
        mai3Mint,
        userUsdtAccount,
        userMai3Account,
        poolUsdtAccount,
        poolMai3Account,
        applicant,
      } = context;

      // Create a new task with small taker number
      const taskId = 3;
      const taskAmount = 100_000_000;
      const takerNum = 1;
      const rewards = 50_000_000;
      const expireTime = Math.floor(Date.now() / 1000) + 86400;

      const [taskInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_info"),
          new anchor.BN(taskId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .createTask(
          new anchor.BN(taskId),
          new anchor.BN(taskAmount),
          new anchor.BN(takerNum),
          new anchor.BN(0),
          new anchor.BN(rewards),
          new anchor.BN(expireTime)
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

      // Create and approve first application
      const [firstApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          applicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .applyTask()
        .accounts({
          taskInfo: taskInfo,
          taskApplication: firstApplication,
          applicant: applicant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([applicant])
        .rpc();

      await program.methods
        .approveApplication()
        .accounts({
          taskInfo: taskInfo,
          taskApplication: firstApplication,
          requester: wallet.publicKey,
        })
        .rpc();

      // Create second application
      const secondApplicant = anchor.web3.Keypair.generate();
      const airdropSig2 = await program.provider.connection.requestAirdrop(
        secondApplicant.publicKey,
        1000000000
      );
      await program.provider.connection.confirmTransaction({
        signature: airdropSig2,
        blockhash: (
          await program.provider.connection.getLatestBlockhash()
        ).blockhash,
        lastValidBlockHeight: (
          await program.provider.connection.getLatestBlockhash()
        ).lastValidBlockHeight,
      });

      const [secondApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          secondApplicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      // Apply with second applicant
      await program.methods
        .applyTask()
        .accounts({
          taskInfo: taskInfo,
          taskApplication: secondApplication,
          applicant: secondApplicant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([secondApplicant])
        .rpc();

      // Try to approve second application
      try {
        await program.methods
          .approveApplication()
          .accounts({
            taskInfo: taskInfo,
            taskApplication: secondApplication,
            requester: wallet.publicKey,
          })
          .rpc();
        assert.fail("Should have failed with TakerNumExceeded");
      } catch (error) {
        assert.include(error.message, "TakerNumExceeded");
      }
    });
  });
});
