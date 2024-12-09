use {
    anchor_lang::prelude::*,
    anchor_spl::{
        metadata::{
            create_metadata_accounts_v3, mpl_token_metadata::types::DataV2,
            CreateMetadataAccountsV3, Metadata,
        },
        token::{Mint, Token},
    },
};

use crate::TokenInfo;

#[derive(Accounts)]
pub struct CreateTokenMint<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Validate address by deriving pda
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), mint_account.key().as_ref()],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata_account: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = payer.key(),
    )]
    pub mint_account: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        space = 8 + TokenInfo::INIT_SPACE,
        seeds = [b"token_info", mint_account.key().as_ref()],
        bump,
    )]
    pub token_info_pda: Account<'info, TokenInfo>,

    pub token_metadata_program: Program<'info, Metadata>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_token_mint(ctx: Context<CreateTokenMint>, token_name: String, token_symbol: String, token_uri: String, max_supply: u64) -> Result<()> {
    let token_info = &mut ctx.accounts.token_info_pda;
    token_info.owner = ctx.accounts.payer.key();
    token_info.mint = ctx.accounts.mint_account.key();
    token_info.max_supply = max_supply;
    token_info.total_supply = 0;
    token_info.token_name = token_name.clone();
    token_info.token_symbol = token_symbol.clone();
    token_info.token_uri = token_uri.clone();

    create_metadata_accounts_v3(
        CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.mint_account.to_account_info(), 
                mint_authority: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.payer.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
        ),
        DataV2 {
            name: token_name,
            symbol: token_symbol,
            uri: token_uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        false,
        true,
        None,
    )?;
    Ok(())
}