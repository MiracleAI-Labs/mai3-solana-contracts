mod instructions;
mod state;
mod errors;

use anchor_lang::prelude::*;

use instructions::*;
use state::*;

declare_id!("GwvQ53QTu1xz3XXYfG5m5jEqwhMBvVBudPS8TUuFYnhT");

#[program]
pub mod sbt_minter {
    use super::*;

    pub fn create_sbt_token_mint(
        ctx: Context<CreateSbtMint>,
        token_name: String,
        token_symbol: String,
        token_uri: String,
    ) -> Result<()> {
        msg!("Creating SBT mint...");

        sbt_create::create_sbt_token_mint(ctx, token_name, token_symbol, token_uri);

        msg!("SBT mint created successfully.");

        Ok(())
    }

    pub fn mint_sbt_token(ctx: Context<SbtMint>, name: String, photo: String, twitterID: String, discordID: String, telegramID: String) -> Result<()> {
        sbt_mint::mint_sbt_token(ctx, name, photo, twitterID, discordID, telegramID);

        Ok(())
    }
}
