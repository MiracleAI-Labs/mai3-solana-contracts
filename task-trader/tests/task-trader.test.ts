import * as anchor from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { assert } from "chai";
import { getTestContext } from "./setup";
import { TaskTrader } from "../target/types/task_trader";

describe("Task Trader", () => {
  let context: Awaited<ReturnType<typeof getTestContext>>;

  before(async () => {
    context = await getTestContext();
  });

  async function createTask(
    program: anchor.Program<TaskTrader>,
    params: {
      taskId: number;
      taskAmount: number;
      takerNum: number;
      coinMint: PublicKey;
      rewards: number;
      expireTime: number;
      wallet: Keypair;
      admin: PublicKey;
      poolAuthority: PublicKey;
      userCoinAccount: PublicKey;
      poolCoinAccount: PublicKey;
    }
  ) {
    const [taskInfo] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("task_info"),
        new anchor.BN(params.taskId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [supportCoin] = PublicKey.findProgramAddressSync(
      [Buffer.from("support_coin")],
      program.programId
    );

    await program.methods
      .createTask(
        new anchor.BN(params.taskId),
        new anchor.BN(params.taskAmount),
        new anchor.BN(params.takerNum),
        params.coinMint,
        new anchor.BN(params.rewards)
      )
      .accounts({
        user: params.wallet.publicKey,
        admin: params.admin,
        poolAuthority: params.poolAuthority,
        taskInfo: taskInfo,
        coinMint: params.coinMint,
        userCoinAccount: params.userCoinAccount,
        poolCoinAccount: params.poolCoinAccount,
        supportCoin: supportCoin,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        feeReceiver: params.wallet.publicKey,
      })
      .signers([params.wallet])
      .rpc();

    return taskInfo;
  }

  describe("Admin", () => {
    it("Initialize admin account", async () => {
      const { program, admin, wallet, applicant } = context;

      const adminAccount = await program.account.admin.fetch(admin);
      assert.ok(adminAccount.signer.equals(wallet.publicKey));
      assert.ok(adminAccount.feeReceiver.equals(wallet.publicKey));

      const updateAdmin = async function (
        publicKey: PublicKey,
        signer: Keypair,
        fee_ratio: number
      ) {
        return program.methods
          .updateAdmin(publicKey, publicKey, new anchor.BN(fee_ratio))
          .accounts({
            payer: signer.publicKey,
            admin: admin,
          })
          .signers([signer])
          .rpc();
      };
      try {
        await updateAdmin(applicant.publicKey, applicant, 1);
        assert.fail("Should have failed when update admin for non-admin");
      } catch (error) {
        assert.include(error.message, "Unauthorized");
      }

      await updateAdmin(applicant.publicKey, wallet, 1);

      const adminAccount2 = await program.account.admin.fetch(admin);
      assert.ok(adminAccount2.signer.equals(applicant.publicKey));
      assert.ok(adminAccount2.feeReceiver.equals(applicant.publicKey));

      await updateAdmin(wallet.publicKey, applicant, 1);
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

  describe("Support Coin Management", () => {
    it("Should update task support coins successfully", async () => {
      const { program, wallet, admin, usdtMint, mai3Mint } = context;

      const [supportCoinPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("support_coin")],
        program.programId
      );

      // Create some test mint addresses
      const coinMints = [usdtMint, mai3Mint];

      // Update support coins
      await program.methods
        .updateTaskSupportCoin(coinMints)
        .accounts({
          payer: wallet.publicKey,
          admin: admin,
          supportCoin: supportCoinPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();

      // Verify the update
      const supportCoinAccount = await program.account.supportCoin.fetch(
        supportCoinPDA
      );
      assert.equal(supportCoinAccount.coinMints.length, coinMints.length);
      supportCoinAccount.coinMints.forEach((mint, index) => {
        assert.isTrue(
          mint.equals(coinMints[index]),
          `Mint at index ${index} does not match`
        );
      });
    });

    it("Should fail when non-admin tries to update support coins", async () => {
      const { program, applicant, admin } = context;

      const [supportCoinPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("support_coin")],
        program.programId
      );

      // Create test mint addresses
      const testMint1 = Keypair.generate().publicKey;
      const coinMints = [testMint1];

      try {
        // Try to update support coins with non-admin account
        await program.methods
          .updateTaskSupportCoin(coinMints)
          .accounts({
            payer: applicant.publicKey,
            admin: admin,
            supportCoin: supportCoinPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([applicant])
          .rpc();

        assert.fail(
          "Should have failed when non-admin tries to update support coins"
        );
      } catch (error) {
        assert.include(error.message, "Unauthorized");
      }
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
      const taskAmount = 10_000_000; // 10 USDT
      const takerNum = 10;
      const rewards = 5_000_000; // 5 USDT
      const expireTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

      const initialUsdtBalance =
        await program.provider.connection.getTokenAccountBalance(
          userUsdtAccount
        );

      const taskInfo = await createTask(program, {
        taskId,
        taskAmount,
        takerNum,
        coinMint: usdtMint,
        rewards,
        expireTime,
        wallet,
        admin,
        poolAuthority,
        userCoinAccount: userUsdtAccount,
        poolCoinAccount: poolUsdtAccount,
      });

      // Verify task info
      const taskInfoAccount = await program.account.taskInfo.fetch(taskInfo);
      assert.equal(taskInfoAccount.taskId.toNumber(), taskId);
      assert.equal(taskInfoAccount.taskAmount.toNumber(), taskAmount);
      assert.equal(taskInfoAccount.takerNum.toNumber(), takerNum);
      assert.ok(taskInfoAccount.coinMint.equals(usdtMint));
      assert.equal(taskInfoAccount.rewards.toNumber(), rewards);
      assert.ok(taskInfoAccount.requester.equals(wallet.publicKey));

      // Verify token transfer
      const finalUsdtBalance =
        await program.provider.connection.getTokenAccountBalance(
          userUsdtAccount
        );
      const expectedTransferAmount = (taskAmount + rewards) * takerNum;
      assert.equal(
        finalUsdtBalance.value.amount,
        (
          parseInt(initialUsdtBalance.value.amount) - expectedTransferAmount
        ).toString(),
        "USDT not transferred correctly"
      );

      const poolUsdtBalance =
        await program.provider.connection.getTokenAccountBalance(
          poolUsdtAccount
        );
      assert.equal(
        poolUsdtBalance.value.amount,
        expectedTransferAmount.toString(),
        "Pool USDT balance incorrect"
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
        .applyTask(null)
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
    });
  });

  describe("Task Application Verification", () => {
    it("Should verify and accept task application successfully", async () => {
      const { program, wallet, usdtMint } = context;

      // Get task info PDA
      const taskId = 12;
      const taskInfo = await createTask(program, {
        taskId,
        taskAmount: 1_000_000,
        takerNum: 1,
        coinMint: usdtMint,
        rewards: 0,
        expireTime: Math.floor(Date.now() / 1000) + 86400,
        wallet,
        admin: context.admin,
        poolAuthority: context.poolAuthority,
        userCoinAccount: context.userUsdtAccount,
        poolCoinAccount: context.poolUsdtAccount,
      });

      // Get task application PDA
      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          context.applicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .applyTask(null)
        .accounts({
          taskInfo: taskInfo,
          taskApplication: taskApplication,
          applicant: context.applicant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([context.applicant])
        .rpc();

      // Now verify and accept the task application
      await program.methods
        .verifyTaskApplication(true)
        .accounts({
          taskApplication,
          taskInfo,
          user: wallet.publicKey,
        })
        .signers([wallet])
        .rpc();

      // Verify the application state
      const applicationData = await program.account.taskApplication.fetch(
        taskApplication
      );
      assert.deepEqual(applicationData.state, {
        acceptedByAcceptance: {},
      });
    });

    it("Should verify and reject task application successfully", async () => {
      const { program, wallet, usdtMint } = context;

      // Get task info PDA
      const taskId = 13;
      const taskInfo = await createTask(program, {
        taskId,
        taskAmount: 1_000_000,
        takerNum: 1,
        coinMint: usdtMint,
        rewards: 0,
        expireTime: Math.floor(Date.now() / 1000) + 86400,
        wallet,
        admin: context.admin,
        poolAuthority: context.poolAuthority,
        userCoinAccount: context.userUsdtAccount,
        poolCoinAccount: context.poolUsdtAccount,
      });

      // Get task application PDA
      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          context.applicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .applyTask(null)
        .accounts({
          taskInfo: taskInfo,
          taskApplication: taskApplication,
          applicant: context.applicant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([context.applicant])
        .rpc();

      // Now verify and accept the task application
      await program.methods
        .verifyTaskApplication(false)
        .accounts({
          taskApplication,
          taskInfo,
          user: wallet.publicKey,
        })
        .signers([wallet])
        .rpc();

      // Verify the application state
      const applicationData = await program.account.taskApplication.fetch(
        taskApplication
      );
      assert.deepEqual(applicationData.state, {
        applied: {},
      });
    });

    it("Should fail when non-admin tries to verify application", async () => {
      const { program, wallet, usdtMint } = context;

      // Get task info PDA
      const taskId = 14;
      const taskInfo = await createTask(program, {
        taskId,
        taskAmount: 1_000_000,
        takerNum: 1,
        coinMint: usdtMint,
        rewards: 0,
        expireTime: Math.floor(Date.now() / 1000) + 86400,
        wallet,
        admin: context.admin,
        poolAuthority: context.poolAuthority,
        userCoinAccount: context.userUsdtAccount,
        poolCoinAccount: context.poolUsdtAccount,
      });

      // Get task application PDA
      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          context.applicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .applyTask(null)
        .accounts({
          taskInfo: taskInfo,
          taskApplication: taskApplication,
          applicant: context.applicant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([context.applicant])
        .rpc();

      // Now verify and accept the task application
      try {
        await program.methods
          .verifyTaskApplication(false)
          .accounts({
            taskApplication,
            taskInfo,
            user: context.applicant.publicKey,
          })
          .signers([context.applicant])
          .rpc();
        assert.fail(
          "Should have failed when non-requester tries to verify application"
        );
      } catch (error) {
        assert.include(error.message, "InvalidRequester");
      }
    });
  });

  describe("Withdraw", () => {
    it("Should withdraw USDT successfully", async () => {
      const {
        program,
        applicant,
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
      const taskId = 20;

      // Create task first
      const taskInfo = await createTask(program, {
        taskId,
        taskAmount: 1000,
        takerNum: 1,
        coinMint: usdtMint,
        rewards: 100,
        expireTime: Math.floor(Date.now() / 1000) + 3600,
        wallet,
        admin,
        poolAuthority,
        userCoinAccount: userUsdtAccount,
        poolCoinAccount: poolUsdtAccount,
      });

      // Get task application PDA
      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          applicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      // Apply for task
      await program.methods
        .applyTask(null)
        .accounts({
          taskInfo,
          taskApplication,
          applicant: applicant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([applicant])
        .rpc();

      await program.methods
        .verifyTaskApplication(true)
        .accounts({
          taskApplication,
          taskInfo,
          user: wallet.publicKey,
        })
        .signers([wallet])
        .rpc();

      // Get applicant's USDT balance before withdrawal

      const applicantUsdtAccount = await createAssociatedTokenAccount(
        context.provider.connection,
        applicant,
        usdtMint,
        applicant.publicKey,
        { commitment: "confirmed" },
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const beforeBalance =
        await context.provider.connection.getTokenAccountBalance(
          applicantUsdtAccount
        );

      // Withdraw
      await program.methods
        .withdraw()
        .accounts({
          user: applicant.publicKey,
          taskApplication: taskApplication,
          taskInfo: taskInfo,
          poolAuthority: poolAuthority,
          coinMint: usdtMint,
          userCoinAccount: applicantUsdtAccount,
          inviter: null,
          inviterCoinAccount: null,
          poolCoinAccount: poolUsdtAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          admin: admin,
          feeReceiver: wallet.publicKey,
          feeReceiverCoinAccount: userUsdtAccount,
        })
        .signers([applicant])
        .rpc();

      // Verify application state changed to Withdrawed
      const applicationAfter = await program.account.taskApplication.fetch(
        taskApplication
      );
      assert.deepEqual(applicationAfter.state, {
        withdrawed: {},
      });

      const adminAccount = await program.account.admin.fetch(admin);

      // Verify token transfer
      const afterBalance =
        await context.provider.connection.getTokenAccountBalance(
          applicantUsdtAccount
        );
      assert.equal(
        parseInt(afterBalance.value.amount) +
          (1000 * parseInt(adminAccount.feeRatio.toString())) / 1000 -
          parseInt(beforeBalance.value.amount),
        1000
      );
    });

    it("Should withdraw USDT with inviter successfully", async () => {
      const {
        program,
        applicant,
        wallet,
        usdtMint,
        admin,
        userUsdtAccount,
        poolAuthority,
        poolUsdtAccount,
      } = context;

      // Create a new keypair for inviter
      const inviter = anchor.web3.Keypair.generate();
      await context.provider.connection.requestAirdrop(
        inviter.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      );

      // Create task info PDA
      const taskId = 30;
      // Create task first
      const [taskInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_info"),
          new anchor.BN(taskId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      // Create task application PDA
      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          applicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      const applicantUsdtAccount = await getAssociatedTokenAddressSync(
        usdtMint,
        applicant.publicKey,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const inviterUsdtAccount = await getAssociatedTokenAddressSync(
        usdtMint,
        inviter.publicKey,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Create task with rewards for inviter
      await createTask(program, {
        taskId: taskId,
        taskAmount: 100,
        takerNum: 1,
        coinMint: usdtMint,
        rewards: 10, // Set rewards for inviter
        expireTime: Math.floor(Date.now() / 1000) + 3600,
        wallet: wallet,
        admin: admin,
        poolAuthority: poolAuthority,
        userCoinAccount: userUsdtAccount,
        poolCoinAccount: poolUsdtAccount,
      });

      // Apply for task
      await program.methods
        .applyTask(inviter.publicKey)
        .accounts({
          taskInfo,
          taskApplication,
          applicant: applicant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([applicant])
        .rpc();

      await program.methods
        .verifyTaskApplication(true)
        .accounts({
          taskApplication,
          taskInfo,
          user: wallet.publicKey,
        })
        .signers([wallet])
        .rpc();

      // Get balances before withdraw
      const beforeApplicantBalance =
        await context.provider.connection.getTokenAccountBalance(
          applicantUsdtAccount
        );

      // Withdraw
      await program.methods
        .withdraw()
        .accounts({
          user: applicant.publicKey,
          taskApplication: taskApplication,
          taskInfo: taskInfo,
          poolAuthority: poolAuthority,
          coinMint: usdtMint,
          userCoinAccount: applicantUsdtAccount,
          inviter: inviter.publicKey,
          inviterCoinAccount: inviterUsdtAccount,
          poolCoinAccount: poolUsdtAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          admin: admin,
          feeReceiver: wallet.publicKey,
          feeReceiverCoinAccount: userUsdtAccount,
        })
        .signers([applicant])
        .rpc();

      const adminAccount = await program.account.admin.fetch(admin);

      // Check balances after withdraw
      const afterApplicantBalance =
        await context.provider.connection.getTokenAccountBalance(
          applicantUsdtAccount
        );
      const afterInviterBalance =
        await context.provider.connection.getTokenAccountBalance(
          inviterUsdtAccount
        );

      // Verify applicant received task amount
      assert.equal(
        parseInt(afterApplicantBalance.value.amount) +
          parseInt(
            `${(100 * parseInt(adminAccount.feeRatio.toString())) / 1000}`
          ) -
          parseInt(beforeApplicantBalance.value.amount),
        100
      );

      // Verify inviter received rewards
      assert.equal(parseInt(afterInviterBalance.value.amount), 10);
    });

    it("Should fail when application state is not AcceptedByAcceptance", async () => {
      const {
        program,
        applicant,
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
      const taskId = 21;

      // Create task first
      const taskInfo = await createTask(program, {
        taskId,
        taskAmount: 1000,
        takerNum: 1,
        coinMint: usdtMint,
        rewards: 100,
        expireTime: Math.floor(Date.now() / 1000) + 3600,
        wallet,
        admin,
        poolAuthority,
        userCoinAccount: userUsdtAccount,
        poolCoinAccount: poolUsdtAccount,
      });

      // Get task application PDA
      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          applicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      // Apply for task
      await program.methods
        .applyTask(null)
        .accounts({
          taskInfo,
          taskApplication,
          applicant: applicant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([applicant])
        .rpc();

      // Get applicant's USDT balance before withdrawal
      const applicantUsdtAccount = await getAssociatedTokenAddressSync(
        usdtMint,
        applicant.publicKey,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      try {
        // Try to withdraw without acceptance
        await program.methods
          .withdraw()
          .accounts({
            user: applicant.publicKey,
            taskApplication: taskApplication,
            taskInfo: taskInfo,
            poolAuthority: poolAuthority,
            coinMint: usdtMint,
            userCoinAccount: applicantUsdtAccount,
            inviter: null,
            inviterCoinAccount: null,
            poolCoinAccount: poolUsdtAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            admin: admin,
            feeReceiver: wallet.publicKey,
            feeReceiverCoinAccount: userUsdtAccount,
          })
          .signers([applicant])
          .rpc();
        assert.fail(
          "Should have failed when application state is not AcceptedByAcceptance"
        );
      } catch (error) {
        assert.include(error.message, "InvalidApplicationState");
      }
    });

    it("Should fail when wrong applicant tries to withdraw", async () => {
      const {
        program,
        applicant,
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
      const taskId = 21;

      // Create task first
      const [taskInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_info"),
          new anchor.BN(taskId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      // Get task application PDA
      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          applicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .verifyTaskApplication(true)
        .accounts({
          taskApplication,
          taskInfo,
          user: wallet.publicKey,
        })
        .signers([wallet])
        .rpc();

      try {
        // Try to withdraw without acceptance
        await program.methods
          .withdraw()
          .accounts({
            user: wallet.publicKey,
            taskApplication: taskApplication,
            taskInfo: taskInfo,
            poolAuthority: poolAuthority,
            coinMint: usdtMint,
            userCoinAccount: userUsdtAccount,
            inviter: null,
            inviterCoinAccount: null,
            poolCoinAccount: poolUsdtAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            admin: admin,
            feeReceiver: wallet.publicKey,
            feeReceiverCoinAccount: userUsdtAccount,
          })
          .rpc();
        assert.fail(
          "Should have failed when application state is not AcceptedByAcceptance"
        );
      } catch (error) {
        assert.include(error.message, "InvalidApplicant");
      }
    });
  });
});
