import { describe, it, before } from 'node:test';
import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { BankrunProvider } from 'anchor-bankrun';
import { startAnchor } from 'solana-bankrun';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import type { SbtMinter } from '../target/types/sbt_minter';
import * as helpers from "./helpers";
import { BN } from 'bn.js';
// import bs58 from 'bs58';

const IDL = require('../target/idl/sbt_minter.json');
const PROGRAM_ID = new PublicKey(IDL.address);
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

describe('Bankrun example', () => {
  let provider: BankrunProvider;
  let payer: anchor.Wallet;
  let program: anchor.Program<SbtMinter>;
  let signerPublicKey: PublicKey;
  let feeAccountKeypair: Keypair;
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
    signerPublicKey = new PublicKey(Buffer.from('14417921a9273e30f056604d56b407155487643ab35f48e447815fb64100f77f', 'hex'));
    feeAccountKeypair = new Keypair();

    // const msg_hash_base58 = "9wQC3mWJi9d3BVuYpSH8g6ZzykTXV7wwSQemedsvP57x";
    // const msg_hash_bytes = bs58.decode(msg_hash_base58);
    // const msg_hash_hex = Buffer.from(msg_hash_bytes).toString('hex');
    // console.log(`   Signer Public Key: ${signerPublicKey}`);
    // console.log(`   msg_hash:`, msg_hash_hex);

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
      .createSbtTokenMint(metadata.name, metadata.symbol, metadata.uri, signerPublicKey, feeAccountKeypair.publicKey)
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
      twitter_id: 'https://twitter.com/solana',
      discord_id: 'https://discord.com/solana', 
      telegram_id: 'https://t.me/solana',
      score: new BN(20),
    };

    const recoveryId = 0;
    const signature = "b27ab82e590dc7fd0d760e3f8baad52595ba5a0b40c302b238487f1fe8c3bf3e5823cdd3097ccde308ec7435c5b987410e0682a8402285b3b10b584e6bf1fa50";
    const signatureArray = Buffer.from(signature, 'hex');

    const transactionSignature = await program.methods
      .mintSbtTokenFree(
        userInfo.name, 
        userInfo.photo, 
        userInfo.twitter_id, 
        userInfo.discord_id, 
        userInfo.telegram_id, 
        userInfo.score,
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
