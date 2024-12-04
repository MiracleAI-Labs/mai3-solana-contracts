import * as anchor from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import type { SbtMinter } from '../target/types/sbt_minter';

describe('Create Tokens', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.CreateToken as anchor.Program<SbtMinter>;

  const metadata = {
    name: 'SBT',
    symbol: 'SBTSOL',
    uri: 'https://raw.githubusercontent.com/solana-developers/program-examples/new-examples/tokens/tokens/.assets/spl-token.json',
  };

  it('Create SBT Token!', async () => {
    // Generate new keypair to use as address for mint account.
    const mintKeypair = new Keypair();

    // SPL Token default = 9 decimals
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

  it('Mint a NFT', async () => {
    // Generate new keypair to use as address for mint account.
    const mintKeypair = new Keypair();

    const metadata = {
      name: 'Jesse',
      photo: 'https://w7.pngwing.com/pngs/153/594/png-transparent-solana-coin-sign-icon-shiny-golden-symmetric-geometrical-design.png',
      twitterID: 'https://twitter.com/solana',
      discordID: 'https://discord.com/solana',
      telegramID: 'https://t.me/solana',
    };

    // NFT default = 0 decimals
    const transactionSignature = await program.methods
      .mintSbtToken(metadata.name, metadata.photo, metadata.twitterID, metadata.discordID, metadata.telegramID)
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
});
