import { describe, it, before } from 'node:test';
import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { BankrunProvider } from 'anchor-bankrun';
import { ProgramTestContext, startAnchor, BanksClient } from 'solana-bankrun';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import type { SbtMinter } from '../target/types/sbt_minter';
import { BN } from 'bn.js';

// 常量定义
const IDL = require('../target/idl/sbt_minter.json');
const PROGRAM_ID = new PublicKey(IDL.address);
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const FREE_MINT_SBT = false;

// 测试配置
const TEST_CONFIG = {
  metadata: {
    name: 'SBT',
    symbol: 'SBTSOL',
    uri: 'https://raw.githubusercontent.com/miracleAI-Lab/solana-contracts-examples/refs/heads/main/metadata/sbt-token.json'
  },
  userInfo: {
    name: 'Jesse',
    photo: 'https://w7.pngwing.com/pngs/153/594/png-transparent-solana-coin-sign-icon-shiny-golden-symmetric-geometrical-design.png',
    twitter_id: 'https://twitter.com/solana', 
    discord_id: 'https://discord.com/solana',
    telegram_id: 'https://t.me/solana',
    score: new BN(20)
  },
  signature: {
    recoveryId: 0,
    signerPkStr: '14417921a9273e30f056604d56b407155487643ab35f48e447815fb64100f77f',
    signature: "b27ab82e590dc7fd0d760e3f8baad52595ba5a0b40c302b238487f1fe8c3bf3e5823cdd3097ccde308ec7435c5b987410e0682a8402285b3b10b584e6bf1fa50"
  }
};

describe('SBT Token 测试', () => {
  // 状态变量
  let provider: BankrunProvider;
  let payer: anchor.Wallet;
  let program: anchor.Program<SbtMinter>;
  let signerPublicKey: PublicKey;
  let feeReceiverKeypair: Keypair;
  let context: ProgramTestContext;
  let client: BanksClient;
  let mintAccount: PublicKey;
  let tokenAccount: PublicKey;

  // 测试环境初始化
  before(async () => {
    // 初始化测试上下文
    context = await startAnchor('', [
      { name: 'sbt_minter', programId: PROGRAM_ID },
      { name: 'token_metadata', programId: METADATA_PROGRAM_ID }
    ], []);

    // 设置Provider和Program
    client = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    payer = provider.wallet as anchor.Wallet;
    program = new anchor.Program(IDL, provider);

    // 初始化密钥和账户
    signerPublicKey = new PublicKey(Buffer.from(TEST_CONFIG.signature.signerPkStr, 'hex'));
    feeReceiverKeypair = new Keypair();
    console.log(`feeAccountKeypair: ${feeReceiverKeypair.publicKey}`);

    // 生成PDA账户
    mintAccount = PublicKey.findProgramAddressSync(
      [Buffer.from('mint'), payer.publicKey.toBuffer()],
      program.programId
    )[0];

    tokenAccount = getAssociatedTokenAddressSync(mintAccount, payer.publicKey);

    // 日志输出
    console.log(`   Mint Account: ${mintAccount}`);
    console.log(`   Token Account: ${tokenAccount}`);
  });

  // 创建SBT代币
  it('创建SBT代币', async () => {
    const { name, symbol, uri } = TEST_CONFIG.metadata;
    const tx = await program.methods
      .createSbtTokenMint(name, symbol, uri, signerPublicKey, feeReceiverKeypair.publicKey)
      .accounts({ payer: payer.publicKey })
      .rpc();

    console.log('创建成功!');
    console.log(`   交易签名: ${tx}`);
  });

  // 铸造SBT代币
  if (FREE_MINT_SBT) {
    it('免费铸造SBT代币', async () => {
      const signatureArray = Buffer.from(TEST_CONFIG.signature.signature, 'hex');
      const tx = await program.methods
        .mintSbtTokenFree(
          TEST_CONFIG.userInfo.name,
          TEST_CONFIG.userInfo.photo,
          TEST_CONFIG.userInfo.twitter_id,
          TEST_CONFIG.userInfo.discord_id,
          TEST_CONFIG.userInfo.telegram_id,
          TEST_CONFIG.userInfo.score,
          Array.from(signatureArray),
          TEST_CONFIG.signature.recoveryId
        )
        .accounts({ payer: payer.publicKey })
        .rpc();

      console.log('铸造成功!');
      console.log(`   交易签名: ${tx}`);

      // 获取用户信息
      const [userPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('sbt_info'), payer.publicKey.toBuffer()],
        program.programId
      );
      const userInfo = await program.account.sbtInfo.fetch(userPDA);
      console.log(`   用户信息: ${JSON.stringify(userInfo)}`);
    });
  } else {
    it('付费铸造SBT代币', async () => {
      const balanceBefore = await client.getBalance(payer.publicKey);
      console.log(`=========payer balance before: ${balanceBefore}`);

      const signatureArray = Buffer.from(TEST_CONFIG.signature.signature, 'hex');
      const tx = await program.methods
        .mintSbtTokenPaid(
          TEST_CONFIG.userInfo.name,
          TEST_CONFIG.userInfo.photo,
          TEST_CONFIG.userInfo.twitter_id,
          TEST_CONFIG.userInfo.discord_id,
          TEST_CONFIG.userInfo.telegram_id,
          TEST_CONFIG.userInfo.score,
          Array.from(signatureArray),
          TEST_CONFIG.signature.recoveryId
        )
        .accounts({ 
          payer: payer.publicKey,
          feeReceiver: feeReceiverKeypair.publicKey,
        })
        .rpc();

      console.log('铸造成功!');
      console.log(`   交易签名: ${tx}`);

      const balanceAfter = await client.getBalance(payer.publicKey);
      console.log(`=========payer balance after: ${balanceAfter}`);

      const change = balanceBefore - balanceAfter;
      console.log(`=========payer balance change: ${change}`);

      const balanceAfterFee = await client.getBalance(feeReceiverKeypair.publicKey);
      console.log(`=========feeReceiver balance: ${balanceAfterFee}`);

      // 获取用户信息
      const [userPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('sbt_info'), payer.publicKey.toBuffer()],
        program.programId
      );
      const userInfo = await program.account.sbtInfo.fetch(userPDA);
      console.log(`   用户信息: ${JSON.stringify(userInfo)}`);
    });
  }
});
