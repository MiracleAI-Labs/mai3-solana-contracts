use {
    anchor_lang::prelude::*,
    anchor_lang::solana_program::keccak::hashv as keccak,
    anchor_lang::solana_program::secp256k1_recover::secp256k1_recover,
    anchor_spl::{
        associated_token::AssociatedToken,
        token::{mint_to, Mint, MintTo, Token, TokenAccount},
    },
};

use crate::state::sbt_info::SbtInfo;
use crate::state::admin::Admin;
use crate::errors::*;

#[derive(Accounts)]
pub struct SbtMint<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"admin"],
        bump
    )]
    pub admin: Account<'info, Admin>,

    #[account(mut)]
    pub mint_account: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint_account,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(
        init, 
        payer = payer, 
        space = 8 + SbtInfo::INIT_SPACE, 
        seeds = [b"sbt_info", payer.key().as_ref()], 
        bump
    )]
    pub sbt_info: Account<'info, SbtInfo>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn mint_sbt_token(
    ctx: Context<SbtMint>,
    name: String, 
    photo: String, 
    twitterID: String, 
    discordID: String, 
    telegramID: String,
    signature: [u8; 64],
    recovery_id: u8
) -> Result<()> {
    require!(ctx.accounts.sbt_info.minted == false, SbtMinterError::AlreadyMinted);

    if name.len() > 50 || photo.len() > 200 || twitterID.len() > 50 || discordID.len() > 50 || telegramID.len() > 50 {
        return err!(SbtMinterError::InvalidLength);
    }

    let msg_hash = keccak(&[name.as_ref(), photo.as_ref(), twitterID.as_ref(), discordID.as_ref(), telegramID.as_ref()]);
    let pk = secp256k1_recover(msg_hash.as_ref(), recovery_id, signature.as_ref())
        .map_err(|_e| SbtMinterError::InvalidSignature)?;
    require!(keccak(&[pk.0.as_ref()]).0 == ctx.accounts.admin.signer, SbtMinterError::InvalidSigner);

    let sbt_info = &mut ctx.accounts.sbt_info;
    sbt_info.name = name;
    sbt_info.photo = photo;
    sbt_info.twitterID = twitterID;
    sbt_info.discordID = discordID;
    sbt_info.telegramID = telegramID;
    sbt_info.minted = true;

    mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint_account.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        5,
    )?;

    Ok(())
}