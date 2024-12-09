import { describe, it, before } from 'node:test';
import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { BankrunProvider } from 'anchor-bankrun';
import { startAnchor } from 'solana-bankrun';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import type { SbtMinter } from '../target/types/sbt_minter';
import * as helpers from "./helpers";

const IDL = require('../target/idl/sbt_minter.json');
const PROGRAM_ID = new PublicKey(IDL.address);
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

describe('Bankrun example', () => {
  let provider: BankrunProvider;
  let payer: anchor.Wallet;
  let program: anchor.Program<SbtMinter>;
  let mintKeypair: Keypair;
  let context: any;

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
    mintKeypair = new Keypair();
  });

  const metadata = {
    name: 'SBT',
    symbol: 'SBTSOL', 
    uri: 'https://raw.githubusercontent.com/miracleAI-Lab/solana-contracts-examples/refs/heads/main/metadata/sbt-token.json',
  };

  it('Create an SBT Token!', async () => {
    const transactionSignature = await program.methods
      .createSbtTokenMint(metadata.name, metadata.symbol, metadata.uri)
      .accounts({
        payer: payer.publicKey,
        mintAccount: mintKeypair.publicKey,
      })
      .signers([mintKeypair])
      .rpc();

    console.log('Success!');
    console.log(`   Mint Address: ${mintKeypair.publicKey}`);
    console.log(`   Transaction Signature: ${transactionSignature}`);
  });

  it('Mint SBTtoken to your wallet!', async () => {
    const tokenAccountATA = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      payer.publicKey
    );

    const userInfo = {
      name: 'Jesse',
      photo: 'https://w7.pngwing.com/pngs/153/594/png-transparent-solana-coin-sign-icon-shiny-golden-symmetric-geometrical-design.png',
      twitterID: 'https://twitter.com/solana',
      discordID: 'https://discord.com/solana', 
      telegramID: 'https://t.me/solana',
    };

    const transactionSignature = await program.methods
      .mintSbtToken(userInfo.name, userInfo.photo, userInfo.twitterID, userInfo.discordID, userInfo.telegramID)
      .accounts({
        mintAuthority: payer.publicKey,
        recipient: payer.publicKey,
        mintAccount: mintKeypair.publicKey,
        associatedTokenAccount: tokenAccountATA,
      })
      .rpc();

    console.log('Success!');
    console.log(`   Associated Token Account Address: ${tokenAccountATA}`);
    console.log(`   Transaction Signature: ${transactionSignature}`);

	const [userPDA] = PublicKey.findProgramAddressSync([Buffer.from('sbt_info'), payer.publicKey.toBuffer()], program.programId);
    const userInfoResponse = await program.account.sbtInfo.fetch(userPDA);
    console.log(`   User Info: ${JSON.stringify(userInfoResponse)}`);

	let unpackedAccount = await helpers.getTokenAccountInfoBR(
		context.banksClient,
		tokenAccountATA
	  );

	  console.log(`   Unpacked Account: ${Number(unpackedAccount.amount)}`);
  });
});
