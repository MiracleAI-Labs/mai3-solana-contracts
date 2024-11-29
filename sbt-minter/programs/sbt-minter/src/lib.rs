pub mod instructions;

use anchor_lang::prelude::*;

pub use instructions::*;

declare_id!("GwvQ53QTu1xz3XXYfG5m5jEqwhMBvVBudPS8TUuFYnhT");

#[program]
pub mod sbt_minter {
    use super::*;

    pub fn sbt_create_mint(
        ctx: Context<CreateSbtMint>,
        token_name: String,
        token_symbol: String,
        token_uri: String,
    ) -> Result<()> {
        msg!("Creating SBT mint...");

        sbt_create::create_mint(ctx, token_name, token_symbol, token_uri);

        msg!("SBT mint created successfully.");

        Ok(())
    }
}
