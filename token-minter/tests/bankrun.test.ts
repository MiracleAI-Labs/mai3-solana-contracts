import { describe, it, before } from 'node:test';
import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { BankrunProvider } from 'anchor-bankrun';
import { startAnchor } from 'solana-bankrun';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import type { TokenMinter } from '../target/types/token_minter';
import * as helpers from "./helpers";
import { BN } from '@coral-xyz/anchor';

const IDL = require('../target/idl/token_minter.json');
const PROGRAM_ID = new PublicKey(IDL.address);
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

describe('Bankrun example', () => {
  let provider: BankrunProvider;
  let payer: anchor.Wallet;
  let program: anchor.Program<TokenMinter>;
  let mintKeypair: Keypair;
  let context: any;

  before(async () => {
    context = await startAnchor(
      '',
      [
        { name: 'token_minter', programId: PROGRAM_ID },
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
    name: 'Metaverse Token',
    symbol: 'META', 
    uri: 'https://raw.githubusercontent.com/miracleAI-Lab/solana-contracts-examples/refs/heads/main/metadata/sbt-token.json',
  };

  it('Create an Token Mint!', async () => {
    const transactionSignature = await program.methods
      .createTokenMint(metadata.name, metadata.symbol, metadata.uri, new BN("1000000000000000000"))
      .accounts({
        payer: payer.publicKey,
        mintAccount: mintKeypair.publicKey,
      })
      .signers([mintKeypair])
      .rpc();

    console.log('Success!');
    console.log(`   owner: ${payer.publicKey}`);
    console.log(`   Mint Address: ${mintKeypair.publicKey}`);
    console.log(`   Transaction Signature: ${transactionSignature}`);

    const token_info_pda = PublicKey.findProgramAddressSync([Buffer.from('token_info'), mintKeypair.publicKey.toBuffer()], PROGRAM_ID);
    console.log(`   PDA: ${token_info_pda}`);
    const token_info = await program.account.tokenInfo.fetch(token_info_pda[0]);
    console.log(`   Token Info: ${JSON.stringify(token_info)}`);
  });

  it('Mint Token to your wallet!', async () => {
    const tokenAccountAta = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      payer.publicKey
    );

    const transactionSignature = await program.methods
      .mintToken(new BN("350000"))
      .accounts({
        mintAuthority: payer.publicKey,
        recipient: payer.publicKey,
        mintAccount: mintKeypair.publicKey,
        tokenAccount: tokenAccountAta,
      })
      .rpc();

    console.log('Success!');
    console.log(`   Associated Token Account Address: ${tokenAccountAta}`);
    console.log(`   Transaction Signature: ${transactionSignature}`);

	  let unpackedAccount = await helpers.getTokenAccountInfoBR(
      context.banksClient,
      tokenAccountAta
	  );

	  console.log(`   Account Balance: ${Number(unpackedAccount.amount)}`);

    const token_info_pda = PublicKey.findProgramAddressSync([Buffer.from('token_info'), mintKeypair.publicKey.toBuffer()], PROGRAM_ID);
    // console.log(`   PDA: ${token_info_pda.toString()}`);
    const token_info = await program.account.tokenInfo.fetch(token_info_pda[0]);
    console.log(`   Token Info: ${JSON.stringify(token_info)}`);
    console.log(`   Max Supply: ${token_info.maxSupply}`);
    console.log(`   Total Supply: ${token_info.totalSupply}`);

    console.log(`   owner: ${payer.publicKey}`);
    console.log(`   Mint Address: ${mintKeypair.publicKey}`);
  });
});