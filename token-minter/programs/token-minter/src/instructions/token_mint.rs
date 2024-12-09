use {
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::AssociatedToken,
        token::{mint_to, Mint, MintTo, Token, TokenAccount},
    },
};

use crate::TokenInfo;
use crate::errors::*;

#[derive(Accounts)]
pub struct TokenMint<'info> {
    #[account(mut)]
    pub mint_authority: Signer<'info>,

    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    #[account(mut)]
    pub mint_account: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"token_info", mint_account.key().as_ref()],
        bump,
    )]
    pub token_info_pda: Account<'info, TokenInfo>,

    #[account(
        init_if_needed,
        payer = mint_authority,
        associated_token::mint = mint_account,
        associated_token::authority = recipient,
    )]
    pub token_account_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn mint(ctx: Context<TokenMint>, amount: u64) -> Result<()> {
    let token_info = &mut ctx.accounts.token_info_pda;
    require!(token_info.owner == ctx.accounts.mint_authority.key(), TokenMinterError::InvalidAuthority);
    require!(token_info.total_supply + amount <= token_info.max_supply, TokenMinterError::SupplyExceeded);

    token_info.total_supply = token_info.total_supply + amount;

    mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint_account.to_account_info(),
                to: ctx.accounts.token_account_ata.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
        ),
        amount,
    )?;

    Ok(())
}