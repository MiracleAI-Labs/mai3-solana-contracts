import { describe, it, before } from 'node:test';
import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { BankrunProvider } from 'anchor-bankrun';
import { startAnchor } from 'solana-bankrun';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import type { SbtMinter } from '../target/types/sbt_minter';
import * as helpers from "./helpers";
import { BN } from 'bn.js';

const IDL = require('../target/idl/sbt_minter.json');
const PROGRAM_ID = new PublicKey(IDL.address);
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

describe('Bankrun example', () => {
  let provider: BankrunProvider;
  let payer: anchor.Wallet;
  let program: anchor.Program<SbtMinter>;
  let signerKeypair: Keypair;
  let feeAccountKeypair: Keypair;
  let recipientKeypair: Keypair;
  let context: any;

  let mintAccount: PublicKey;
  let tokenAccount: PublicKey;
  const metadata = {
    name: 'SBT',
    symbol: 'SBTSOL', 
    uri: 'https://raw.githubusercontent.com/miracleAI-Lab/solana-contracts-examples/refs/heads/main/metadata/sbt-token.json',
  };

  before(async () => {
    context = await startAnchor(
      '',
      [
        { name: 'sbt_minter', programId: PROGRAM_ID },
        { name: 'token_metadata', programId: METADATA_PROGRAM_ID },
      ],
      [],
    );
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    payer = provider.wallet as anchor.Wallet;
    program = new anchor.Program(IDL, provider);
    signerKeypair = new Keypair();
    feeAccountKeypair = new Keypair();
    recipientKeypair = new Keypair();

    mintAccount = PublicKey.findProgramAddressSync(
      [Buffer.from('mint'), payer.publicKey.toBuffer()],
      program.programId
    )[0];
  
    tokenAccount = getAssociatedTokenAddressSync(
      mintAccount,
      payer.publicKey
    );
  
    console.log(`   Mint Account Address: ${mintAccount}`);
    console.log(`   Associated Token Account Address: ${tokenAccount}`);
  });

  it('Create an SBT Token!', async () => {
    const transactionSignature = await program.methods
      .createSbtTokenMint(metadata.name, metadata.symbol, metadata.uri, signerKeypair.publicKey, feeAccountKeypair.publicKey)
      .accounts({
        payer: payer.publicKey,
      })
      .rpc();

    console.log('Success!');
    console.log(`   Transaction Signature: ${transactionSignature}`);
  });

  it('Mint SBTtoken to your wallet!', async () => {
    const userInfo = {
      name: 'Jesse',
      photo: 'https://w7.pngwing.com/pngs/153/594/png-transparent-solana-coin-sign-icon-shiny-golden-symmetric-geometrical-design.png',
      twitterID: 'https://twitter.com/solana',
      discordID: 'https://discord.com/solana', 
      telegramID: 'https://t.me/solana',
    };

    const recoveryId = 1;
    const signature = "9420631befee142ab90d0057c97d76dca4404ec6f5af7c599d56bd035d5b652d26838f4e0e0da446e3f424b69dff7310589d516b89c13fb85f681c209e6ba04e";
    const signatureArray = Buffer.from(signature, 'hex');

    const transactionSignature = await program.methods
      .mintSbtTokenFree(
        userInfo.name, 
        userInfo.photo, 
        userInfo.twitterID, 
        userInfo.discordID, 
        userInfo.telegramID, 
        new BN(20),
        Array.from(signatureArray),
        recoveryId
      ).accounts({
        payer: payer.publicKey,
      })
      .rpc();

    console.log('Success!');
    console.log(`   Transaction Signature: ${transactionSignature}`);

    const [userPDA] = PublicKey.findProgramAddressSync([Buffer.from('sbt_info'), payer.publicKey.toBuffer()], program.programId);
    const userInfoResponse = await program.account.sbtInfo.fetch(userPDA);
    console.log(`   User Info: ${JSON.stringify(userInfoResponse)}`);

    let unpackedAccount = await helpers.getTokenAccountInfoBR(
      context.banksClient,
      tokenAccount
    );

    console.log(`   Unpacked Account: ${Number(unpackedAccount.amount)}`);
  });
});
