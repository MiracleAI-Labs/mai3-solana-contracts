import * as anchor from "@coral-xyz/anchor";
import { Account, unpackAccount } from "@solana/spl-token";
import { AccountInfoBytes, BanksClient } from "solana-bankrun";

/**
 * Helper fn to fetch a token account with bankrun.
 * It was needed bc the BR provider.connection.getTokenAccountBalance was buggy.
 * Notice that it is necessary to mangle the AccountInfoBytes type to match
 * the expected AccountInfo<Buffer> interface in unpackAccount.
 */
export const getTokenAccountInfoBR = async (
  banksClient: BanksClient,
  tokenAccount: anchor.web3.PublicKey
): Promise<Account> => {
  let packedAccount: AccountInfoBytes = await banksClient.getAccount(
    tokenAccount
  );

  let packedAccountBuffer: anchor.web3.AccountInfo<Buffer> = {
    ...packedAccount,
    data: Buffer.from(packedAccount.data),
  };

  return unpackAccount(tokenAccount, packedAccountBuffer);
};