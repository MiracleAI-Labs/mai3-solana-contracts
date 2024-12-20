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
} from "@solana/spl-token";
import { assert } from "chai";
import { getTestContext } from "./setup";

describe("Task Trader", () => {
  let context: Awaited<ReturnType<typeof getTestContext>>;

  before(async () => {
    context = await getTestContext();
  });

  async function createTask(
    program: anchor.Program<any>,
    params: {
      taskId: number;
      taskAmount: number;
      takerNum: number;
      coinType: number; // 0 for USDT, 1 for MAI3
      rewards: number;
      expireTime: number;
      wallet: Keypair;
      admin: PublicKey;
      poolAuthority: PublicKey;
      usdtMint: PublicKey;
      mai3Mint: PublicKey;
      userUsdtAccount: PublicKey;
      userMai3Account: PublicKey;
      poolUsdtAccount: PublicKey;
      poolMai3Account: PublicKey;
    }
  ) {
    const [taskInfo] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("task_info"),
        new anchor.BN(params.taskId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .createTask(
        new anchor.BN(params.taskId),
        new anchor.BN(params.taskAmount),
        new anchor.BN(params.takerNum),
        new anchor.BN(params.coinType),
        new anchor.BN(params.rewards),
        new anchor.BN(params.expireTime)
      )
      .accounts({
        user: params.wallet.publicKey,
        admin: params.admin,
        poolAuthority: params.poolAuthority,
        taskInfo: taskInfo,
        usdtMint: params.usdtMint,
        mai3Mint: params.mai3Mint,
        userUsdtAccount: params.userUsdtAccount,
        userMai3Account: params.userMai3Account,
        poolUsdtAccount: params.poolUsdtAccount,
        poolMai3Account: params.poolMai3Account,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
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
        signer: Keypair
      ) {
        return program.methods
          .updateAdmin(publicKey, publicKey)
          .accounts({
            payer: signer.publicKey,
            admin: admin,
            system_program: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([signer])
          .rpc();
      };
      try {
        await updateAdmin(applicant.publicKey, applicant);
        assert.fail("Should have failed when update admin for non-admin");
      } catch (error) {
        assert.include(error.message, "Unauthorized");
      }

      await updateAdmin(applicant.publicKey, wallet);

      const adminAccount2 = await program.account.admin.fetch(admin);
      assert.ok(adminAccount2.signer.equals(applicant.publicKey));
      assert.ok(adminAccount2.feeReceiver.equals(applicant.publicKey));

      await updateAdmin(wallet.publicKey, applicant);
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
        coinType: 0, // USDT
        rewards,
        expireTime,
        wallet,
        admin,
        poolAuthority,
        usdtMint,
        mai3Mint,
        userUsdtAccount,
        userMai3Account,
        poolUsdtAccount,
        poolMai3Account,
      });

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
        coinType: 1, // MAI3
        rewards,
        expireTime,
        wallet,
        admin,
        poolAuthority,
        usdtMint,
        mai3Mint,
        userUsdtAccount,
        userMai3Account,
        poolUsdtAccount,
        poolMai3Account,
      });

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
        coinType: 0,
        rewards,
        expireTime,
        wallet,
        admin,
        poolAuthority,
        usdtMint,
        mai3Mint,
        userUsdtAccount,
        userMai3Account,
        poolUsdtAccount,
        poolMai3Account,
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
        .applyTask()
        .accounts({
          taskInfo: taskInfo,
          taskApplication: taskApplication,
          applicant: applicant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([applicant])
        .rpc();

      // Reject the application
      await program.methods
        .rejectApplication()
        .accounts({
          taskInfo: taskInfo,
          taskApplication: taskApplication,
          requester: wallet.publicKey,
        })
        .signers([wallet])
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
        coinType: 0,
        rewards,
        expireTime,
        wallet,
        admin,
        poolAuthority,
        usdtMint,
        mai3Mint,
        userUsdtAccount,
        userMai3Account,
        poolUsdtAccount,
        poolMai3Account,
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
        coinType: 0, // USDT
        rewards,
        expireTime,
        wallet,
        admin: context.admin,
        poolAuthority: context.poolAuthority,
        usdtMint,
        mai3Mint,
        userUsdtAccount,
        userMai3Account,
        poolUsdtAccount,
        poolMai3Account,
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
        .applyTask()
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
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Verify the application state
      const applicationAccount = await program.account.taskApplication.fetch(
        taskApplication
      );
      assert.deepEqual(applicationAccount.state, { waitingForAcceptance: {} });
    });

    it("Cannot submit acceptance if not accepted", async () => {
      const { program, wallet } = context;

      // Create task and apply
      const taskId = 11;
      const taskInfo = await createTask(program, {
        taskId,
        taskAmount: 1_000_000,
        takerNum: 1,
        coinType: 0,
        rewards: 0,
        expireTime: Math.floor(Date.now() / 1000) + 86400,
        wallet,
        admin: context.admin,
        poolAuthority: context.poolAuthority,
        usdtMint: context.usdtMint,
        mai3Mint: context.mai3Mint,
        userUsdtAccount: context.userUsdtAccount,
        userMai3Account: context.userMai3Account,
        poolUsdtAccount: context.poolUsdtAccount,
        poolMai3Account: context.poolMai3Account,
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
        .applyTask()
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
            systemProgram: SystemProgram.programId,
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
          .applyTask()
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
});
