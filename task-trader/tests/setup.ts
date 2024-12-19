import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TaskTrader } from "../target/types/task_trader";
import {
  PublicKey,
  Keypair,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
} from "@solana/spl-token";

export interface TestContext {
  provider: anchor.AnchorProvider;
  program: Program<TaskTrader>;
  wallet: Keypair;
  admin: PublicKey;
  poolAuthority: PublicKey;
  usdtMint: PublicKey;
  mai3Mint: PublicKey;
  userUsdtAccount: PublicKey;
  userMai3Account: PublicKey;
  poolUsdtAccount: PublicKey;
  poolMai3Account: PublicKey;
  applicant: Keypair;
}

let context: TestContext | null = null;

export async function getTestContext(): Promise<TestContext> {
  if (context) {
    return context;
  }

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.task_trader as Program<TaskTrader>;
  const wallet = (provider.wallet as anchor.Wallet).payer;

  // Generate PDAs
  const [admin] = PublicKey.findProgramAddressSync(
    [Buffer.from("admin")],
    program.programId
  );
  const [poolAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_authority")],
    program.programId
  );

  // Create test applicant
  const applicant = Keypair.generate();
  const airdropSignature = await provider.connection.requestAirdrop(
    applicant.publicKey,
    1000000000
  );
  await provider.connection.confirmTransaction({
    signature: airdropSignature,
    blockhash: (await provider.connection.getLatestBlockhash()).blockhash,
    lastValidBlockHeight: (
      await provider.connection.getLatestBlockhash()
    ).lastValidBlockHeight,
  });

  // Create USDT mint
  const usdtMintKeypair = Keypair.generate();
  const usdtMint = usdtMintKeypair.publicKey;
  await createMint(
    provider.connection,
    wallet,
    wallet.publicKey,
    wallet.publicKey,
    6,
    usdtMintKeypair
  );

  // Create MAI3 mint
  const mai3MintKeypair = Keypair.generate();
  const mai3Mint = mai3MintKeypair.publicKey;
  await createMint(
    provider.connection,
    wallet,
    wallet.publicKey,
    wallet.publicKey,
    6,
    mai3MintKeypair
  );

  // Create token accounts
  const userUsdtAccount = await createAssociatedTokenAccount(
    provider.connection,
    wallet,
    usdtMint,
    wallet.publicKey,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const userMai3Account = await createAssociatedTokenAccount(
    provider.connection,
    wallet,
    mai3Mint,
    wallet.publicKey,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const poolUsdtAccount = await anchor.utils.token.associatedAddress({
    mint: usdtMint,
    owner: poolAuthority,
  });

  const poolMai3Account = await anchor.utils.token.associatedAddress({
    mint: mai3Mint,
    owner: poolAuthority,
  });

  // Mint initial tokens
  await mintTo(
    provider.connection,
    wallet,
    usdtMint,
    userUsdtAccount,
    wallet.publicKey,
    1000000000 // 1000 USDT
  );

  await mintTo(
    provider.connection,
    wallet,
    mai3Mint,
    userMai3Account,
    wallet.publicKey,
    1000000000 // 1000 MAI3
  );

  // Initialize admin
  await program.methods
    .initialize(wallet.publicKey, wallet.publicKey)
    .accounts({
      payer: wallet.publicKey,
      admin: admin,
      system_program: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  context = {
    provider,
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
  };

  return context;
}
