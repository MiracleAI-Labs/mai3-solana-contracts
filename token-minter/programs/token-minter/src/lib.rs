mod instructions;
mod state;
mod errors;

use anchor_lang::prelude::*;

use instructions::*;
use state::*;

declare_id!("GwvQ53QTu1xz3XXYfG5m5jEqwhMBvVBudPS8TUuFYnhT");

#[program]
pub mod token_minter {
    use super::*;

    pub fn create_token_mint(
        ctx: Context<CreateTokenMint>,
        token_name: String,
        token_symbol: String,
        token_uri: String,
        max_supply: u64
    ) -> Result<()> {
        msg!("Creating SBT mint...");

        token_create::create_token_mint(ctx, token_name, token_symbol, token_uri, max_supply);

        msg!("SBT mint created successfully.");

        Ok(())
    }

    pub fn mint_token(ctx: Context<TokenMint>, amount: u64) -> Result<()> {
        token_mint::mint(ctx, amount);

        Ok(())
    }
}
