use {
    anchor_lang::prelude::*,
    anchor_lang::solana_program::{
        keccak::hashv as keccak,
        secp256k1_recover::secp256k1_recover,
        system_instruction,
    },
    anchor_spl::{
        associated_token::AssociatedToken,
        token::{mint_to, Mint, MintTo, Token, TokenAccount},
    },
};

use crate::state::{sbt_info::SbtInfo, admin::Admin};
use crate::errors::*;

#[derive(Accounts)]
pub struct SbtMint<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut, seeds = [b"admin"], bump)]
    pub admin: Account<'info, Admin>,

    #[account(
        mut,
        seeds = [b"mint"],
        bump
    )]
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

pub fn mint_sbt_token_free(
    ctx: Context<SbtMint>,
    name: String,
    photo: String,
    twitter_id: String,
    discord_id: String,
    telegram_id: String,
    score: u64,
    signature: [u8; 64],
    recovery_id: u8
) -> Result<()> {
    validate_and_verify(&ctx, &name, &photo, &twitter_id, &discord_id, &telegram_id, score, signature, recovery_id, true)?;

    let sbt_info = &mut ctx.accounts.sbt_info;
    update_sbt_info_fields(sbt_info, name, photo, twitter_id, discord_id, telegram_id, score);
    sbt_info.sol_fee = 0;
    sbt_info.minted = true;

    mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint_account.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.mint_account.to_account_info(),
            },
        ),
        1,
    )?;

    Ok(())
}

pub fn mint_sbt_token_paid(
    ctx: Context<SbtMint>,
    name: String,
    photo: String,
    twitter_id: String,
    discord_id: String,
    telegram_id: String,
    score: u64,
    signature: [u8; 64],
    recovery_id: u8
) -> Result<()> {
    validate_and_verify(&ctx, &name, &photo, &twitter_id, &discord_id, &telegram_id, score, signature, recovery_id, true)?;

    let transfer_amount = 100_000_000; // 0.1 SOL
    anchor_lang::solana_program::program::invoke(
        &system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &ctx.accounts.admin.fee_account,
            transfer_amount,
        ),
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.admin.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    let sbt_info = &mut ctx.accounts.sbt_info;
    update_sbt_info_fields(sbt_info, name, photo, twitter_id, discord_id, telegram_id, score);
    sbt_info.sol_fee = transfer_amount;
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
        1,
    )?;

    Ok(())
}

pub fn update_sbt_info(
    ctx: Context<SbtMint>,
    name: String,
    photo: String,
    twitter_id: String,
    discord_id: String,
    telegram_id: String,
    score: u64,
    signature: [u8; 64],
    recovery_id: u8
) -> Result<()> {
    validate_and_verify(&ctx, &name, &photo, &twitter_id, &discord_id, &telegram_id, score, signature, recovery_id, false)?;
    update_sbt_info_fields(&mut ctx.accounts.sbt_info, name, photo, twitter_id, discord_id, telegram_id, score);
    Ok(())
}

fn validate_and_verify(
    ctx: &Context<SbtMint>,
    name: &str,
    photo: &str,
    twitter_id: &str,
    discord_id: &str,
    telegram_id: &str,
    score: u64,
    signature: [u8; 64],
    recovery_id: u8,
    check_minted: bool,
) -> Result<()> {
    if check_minted {
        require!(!ctx.accounts.sbt_info.minted, SbtMinterError::AlreadyMinted);
    } else {
        require!(ctx.accounts.sbt_info.minted, SbtMinterError::NotMinted);
    }

    if name.len() > 50 || photo.len() > 200 || twitter_id.len() > 50 || 
       discord_id.len() > 50 || telegram_id.len() > 50 {
        return err!(SbtMinterError::InvalidLength);
    }

    let msg_hash = keccak(&[
        name.as_ref(), photo.as_ref(), twitter_id.as_ref(),
        discord_id.as_ref(), telegram_id.as_ref(), score.to_le_bytes().as_ref()
    ]);
    
    let pk = secp256k1_recover(msg_hash.as_ref(), recovery_id, &signature)
        .map_err(|_| SbtMinterError::InvalidSignature)?;
    let recovered_key = Pubkey::new_from_array(keccak(&[pk.0.as_ref()]).0);
    require!(recovered_key == ctx.accounts.admin.signer, SbtMinterError::InvalidSigner);

    Ok(())
}

fn update_sbt_info_fields(
    sbt_info: &mut Account<SbtInfo>,
    name: String,
    photo: String,
    twitter_id: String,
    discord_id: String,
    telegram_id: String,
    score: u64,
) {
    sbt_info.name = name;
    sbt_info.photo = photo;
    sbt_info.twitter_id = twitter_id;
    sbt_info.discord_id = discord_id;
    sbt_info.telegram_id = telegram_id;
    sbt_info.score = score;
}
