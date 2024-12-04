use {
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::AssociatedToken,
        token::{mint_to, Mint, MintTo, Token, TokenAccount},
    },
};

use crate::SbtInfo;
use crate::errors::*;

#[derive(Accounts)]
pub struct SbtMint<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub mint_account: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint_account,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(init, payer = payer, space = 1000, seeds = [b"sbt_info", payer.key().as_ref()], bump)]
    pub sbt_info: Account<'info, SbtInfo>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn mint_sbt_token(ctx: Context<SbtMint>, name: String, photo: String, twitterID: String, discordID: String, telegramID: String) -> Result<()> {
    if name.len() > 50 || photo.len() > 200 || twitterID.len() > 50 || discordID.len() > 50 || telegramID.len() > 50 {
        return err!(SbtMinterError::InvalidLength);
    }

    let sbt_info = &mut ctx.accounts.sbt_info;
    sbt_info.name = name;
    sbt_info.photo = photo;
    sbt_info.twitterID = twitterID;
    sbt_info.discordID = discordID;
    sbt_info.telegramID = telegramID;

    mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint_account.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        1,
    )?;

    Ok(())
}