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
        new anchor.BN(params.rewards),
        new anchor.BN(params.expireTime)
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
      // assert.equal(taskInfoAccount.coinType.toNumber(), 0);
      assert.equal(taskInfoAccount.rewards.toNumber(), rewards);
      assert.deepEqual(taskInfoAccount.state, { open: {} });
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
      const taskAmount = 20_000_000; // 20 MAI3
      const takerNum = 5;
      const rewards = 1_000_000; // 1 MAI3
      const expireTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

      const initialMai3Balance =
        await program.provider.connection.getTokenAccountBalance(
          userMai3Account
        );

      const taskInfo = await createTask(program, {
        taskId,
        taskAmount,
        takerNum,
        coinMint: mai3Mint,
        rewards,
        expireTime,
        wallet,
        admin,
        poolAuthority,
        userCoinAccount: userMai3Account,
        poolCoinAccount: poolMai3Account,
      });

      // Verify task info
      const taskInfoAccount = await program.account.taskInfo.fetch(taskInfo);
      assert.equal(taskInfoAccount.taskId.toNumber(), taskId);
      assert.equal(taskInfoAccount.taskAmount.toNumber(), taskAmount);
      assert.equal(taskInfoAccount.takerNum.toNumber(), takerNum);
      // assert.equal(taskInfoAccount.coinType.toNumber(), 1); // MAI3
      assert.equal(taskInfoAccount.rewards.toNumber(), rewards);
      assert.deepEqual(taskInfoAccount.state, { open: {} });
      assert.ok(taskInfoAccount.requester.equals(wallet.publicKey));

      // Verify token transfer
      const finalMai3Balance =
        await program.provider.connection.getTokenAccountBalance(
          userMai3Account
        );
      const expectedMai3TransferAmount = (taskAmount + rewards) * takerNum;
      assert.equal(
        finalMai3Balance.value.amount,
        (
          parseInt(initialMai3Balance.value.amount) - expectedMai3TransferAmount
        ).toString(),
        "MAI3 not transferred correctly"
      );

      const poolMai3Balance =
        await program.provider.connection.getTokenAccountBalance(
          poolMai3Account
        );
      assert.equal(
        poolMai3Balance.value.amount,
        expectedMai3TransferAmount.toString(),
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

    it("Reject an application", async () => {
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

      // Create a new task first
      const taskId = 4; // Using a new task ID
      const taskAmount = 100_000_000;
      const takerNum = 2;
      const rewards = 50_000_000;
      const expireTime = Math.floor(Date.now() / 1000) + 86400;

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

      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          applicant.publicKey.toBuffer(),
        ],
        program.programId
      );

      // Apply for the task
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

      await program.methods
        .rejectApplication()
        .accounts({
          taskInfo: taskInfo,
          taskApplication: taskApplication,
          requester: wallet.publicKey,
        })
        .rpc();

      const taskApplicationAccount =
        await program.account.taskApplication.fetch(taskApplication);
      assert.deepEqual(taskApplicationAccount.state, { rejected: {} });
    });

    it("Should fail when non-requester tries to reject application", async () => {
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
          .rejectApplication()
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
      const taskAmount = 1_000_000;
      const takerNum = 1;
      const rewards = 0;
      const expireTime = Math.floor(Date.now() / 1000) + 86400;

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
        .applyTask(null)
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
        .applyTask(null)
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

  describe("Submit Acceptance", () => {
    it("Submit acceptance successfully", async () => {
      const {
        program,
        wallet,
        usdtMint,
        userUsdtAccount,
        poolUsdtAccount,
        mai3Mint,
        userMai3Account,
        poolMai3Account,
      } = context;

      // First create a task
      const taskId = 10;
      const taskAmount = 10_000_000; // 10 USDT
      const takerNum = 1;
      const rewards = 5_000_000; // 5 USDT
      const expireTime = Math.floor(Date.now() / 1000) + 86400;

      const taskInfo = await createTask(program, {
        taskId,
        taskAmount,
        takerNum,
        coinMint: usdtMint,
        rewards,
        expireTime,
        wallet,
        admin: context.admin,
        poolAuthority: context.poolAuthority,
        userCoinAccount: userUsdtAccount,
        poolCoinAccount: poolUsdtAccount,
      });

      // Then apply for the task
      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          wallet.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .applyTask(null)
        .accounts({
          taskInfo: taskInfo,
          taskApplication: taskApplication,
          applicant: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Approve the application
      await program.methods
        .approveApplication()
        .accounts({
          taskInfo: taskInfo,
          taskApplication: taskApplication,
          requester: wallet.publicKey,
        })
        .rpc();

      // Submit for acceptance
      await program.methods
        .submitAcceptance()
        .accounts({
          applicant: wallet.publicKey,
          taskApplication: taskApplication,
        })
        .rpc();

      // Verify the application state
      const applicationAccount = await program.account.taskApplication.fetch(
        taskApplication
      );
      assert.deepEqual(applicationAccount.state, { waitingForAcceptance: {} });
    });

    it("Cannot submit acceptance if not accepted", async () => {
      const { program, wallet, usdtMint } = context;

      // Create task and apply
      const taskId = 11;
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

      const [taskApplication] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_application"),
          taskInfo.toBuffer(),
          wallet.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .applyTask(null)
        .accounts({
          taskInfo: taskInfo,
          taskApplication: taskApplication,
          applicant: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Try to submit acceptance without being accepted first
      try {
        await program.methods
          .submitAcceptance()
          .accounts({
            applicant: wallet.publicKey,
            taskApplication: taskApplication,
          })
          .rpc();
        assert.fail("Should have failed");
      } catch (err) {
        assert.include(err.message, "InvalidApplicationState");
      }
    });
  });

  describe("Task Status Management", () => {
    it("Admin should open and close task", async () => {
      const { program, wallet, admin } = context;
      const taskId = 2;

      const [taskInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_info"),
          new anchor.BN(taskId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      // Close task first
      await program.methods
        .closeTask()
        .accounts({
          user: wallet.publicKey,
          admin: admin,
          taskInfo: taskInfo,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();

      // Verify task is closed
      let taskInfoAccount = await program.account.taskInfo.fetch(taskInfo);
      assert.deepEqual(taskInfoAccount.state, { close: {} });

      // Open task
      await program.methods
        .openTask()
        .accounts({
          user: wallet.publicKey,
          admin: admin,
          taskInfo: taskInfo,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();

      // Verify task is open
      taskInfoAccount = await program.account.taskInfo.fetch(taskInfo);
      assert.deepEqual(taskInfoAccount.state, { open: {} });
    });

    it("Should close a task", async () => {
      const { program, wallet, admin } = context;
      const taskId = 2;

      const [taskInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("task_info"),
          new anchor.BN(taskId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .closeTask()
        .accounts({
          user: wallet.publicKey,
          admin: admin,
          taskInfo: taskInfo,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();

      // Verify task state
      const taskInfoAccount = await program.account.taskInfo.fetch(taskInfo);
      assert.deepEqual(taskInfoAccount.state, { close: {} });
    });

    it("Should fail when applying for a closed task", async () => {
      const { program, applicant } = context;
      const taskId = 2;

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
          .applyTask(null)
          .accounts({
            taskInfo: taskInfo,
            taskApplication: taskApplication,
            applicant: applicant.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([applicant])
          .rpc();
        assert.fail("Should have failed when applying for a closed task");
      } catch (error) {
        assert.include(error.message, "InvalidTaskState");
      }
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

      await program.methods
        .approveApplication()
        .accounts({
          taskInfo,
          taskApplication,
          requester: wallet.publicKey,
        })
        .rpc();

      // First submit acceptance to get into WaitingForAcceptance state
      await program.methods
        .submitAcceptance()
        .accounts({
          payer: context.applicant.publicKey,
          taskApplication: taskApplication,
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

      await program.methods
        .approveApplication()
        .accounts({
          taskInfo,
          taskApplication,
          requester: wallet.publicKey,
        })
        .rpc();

      // First submit acceptance to get into WaitingForAcceptance state
      await program.methods
        .submitAcceptance()
        .accounts({
          payer: context.applicant.publicKey,
          taskApplication: taskApplication,
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
        rejectedByAcceptance: {},
      });
    });

    it("Should fail when non-requester tries to verify application", async () => {
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

      await program.methods
        .approveApplication()
        .accounts({
          taskInfo,
          taskApplication,
          requester: wallet.publicKey,
        })
        .rpc();

      // First submit acceptance to get into WaitingForAcceptance state
      await program.methods
        .submitAcceptance()
        .accounts({
          payer: context.applicant.publicKey,
          taskApplication: taskApplication,
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

    it("Should fail when verifying application not in WaitingForAcceptance state", async () => {
      const { program, wallet, applicant } = context;
      const taskId = 13;

      // Get task info PDA
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

      try {
        // Try to verify application that's not in WaitingForAcceptance state
        await program.methods
          .verifyTaskApplication(true)
          .accounts({
            taskApplication,
            taskInfo,
            user: wallet.publicKey,
          })
          .signers([wallet])
          .rpc();
        assert.fail(
          "Should have failed when verifying application not in WaitingForAcceptance state"
        );
      } catch (error) {
        assert.include(error.message, "InvalidApplicationState");
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

      // Accept application
      await program.methods
        .approveApplication()
        .accounts({
          taskInfo,
          taskApplication,
          requester: wallet.publicKey,
        })
        .signers([wallet])
        .rpc();

      // Submit acceptance
      await program.methods
        .submitAcceptance()
        .accounts({
          payer: applicant.publicKey,
          taskApplication,
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
      const applicantMai3Account = await createAssociatedTokenAccount(
        context.provider.connection,
        applicant,
        mai3Mint,
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

      // Accept application
      await program.methods
        .approveApplication()
        .accounts({
          taskInfo,
          taskApplication,
          requester: wallet.publicKey,
        })
        .signers([wallet])
        .rpc();

      // Submit acceptance
      await program.methods
        .submitAcceptance()
        .accounts({
          payer: applicant.publicKey,
          taskApplication,
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

      // Accept application
      await program.methods
        .approveApplication()
        .accounts({
          taskInfo,
          taskApplication,
          requester: wallet.publicKey,
        })
        .signers([wallet])
        .rpc();

      // Submit acceptance
      await program.methods
        .submitAcceptance()
        .accounts({
          payer: applicant.publicKey,
          taskApplication,
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
      const applicantMai3Account = await getAssociatedTokenAddressSync(
        mai3Mint,
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
