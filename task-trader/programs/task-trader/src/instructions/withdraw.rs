use crate::{
    errors::TaskTraderError,
    state::{
        task_application::{ApplicationState, TaskApplication},
        task_info::TaskInfo,
    },
    utils::token_utils,
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = task_application.state == ApplicationState::AcceptedByAcceptance @ TaskTraderError::InvalidApplicationState,
        constraint = task_application.applicant == user.key() @ TaskTraderError::InvalidApplicant,
    )]
    pub task_application: Account<'info, TaskApplication>,

    #[account(
        mut,
        constraint = task_info.task_id == task_application.task_id @ TaskTraderError::InvalidTaskId,
    )]
    pub task_info: Account<'info, TaskInfo>,

    /// CHECK: This is not dangerous
    #[account(
        seeds = [b"pool_authority"],
        bump,
        constraint = pool_authority.key() == Pubkey::find_program_address(&[b"pool_authority"], &crate::ID).0
    )]
    pub pool_authority: AccountInfo<'info>,

    #[account(
        mut,
        constraint = coin_mint.key() == task_info.coin_mint @ TaskTraderError::InvalidMint,
    )]
    pub coin_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = coin_mint,
        associated_token::authority = user,
    )]
    pub user_coin_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is not dangerous
    #[account(mut)]
    pub inviter: Option<AccountInfo<'info>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = coin_mint,
        associated_token::authority = inviter,
    )]
    pub inviter_coin_account: Option<Box<Account<'info, TokenAccount>>>,

    #[account(
        mut,
        constraint = pool_coin_account.owner == pool_authority.key() @ TaskTraderError::InvalidPoolAccount,
        constraint = pool_coin_account.mint == coin_mint.key() @ TaskTraderError::InvalidMint,
    )]
    pub pool_coin_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
    let task_info = &ctx.accounts.task_info;
    let task_application = &ctx.accounts.task_application;
    let seeds = &[b"pool_authority".as_ref(), &[ctx.bumps.pool_authority]];

    token_utils::transfer_token_with_singer(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.pool_coin_account.to_account_info(),
        ctx.accounts.user_coin_account.to_account_info(),
        ctx.accounts.pool_authority.to_account_info(),
        task_info.task_amount,
        Some(&[seeds]),
    )?;

    if task_application.inviter != Pubkey::default() {
        if let Some(inviter_account) = &ctx.accounts.inviter_coin_account {
            if task_info.rewards > 0 {
                if let Some(inviter) = &ctx.accounts.inviter {
                    if inviter.key() != inviter_account.owner
                        || inviter.key() != task_application.inviter
                    {
                        return Err(TaskTraderError::InvalidInviter.into());
                    }
                }
                token_utils::transfer_token_with_singer(
                    ctx.accounts.token_program.to_account_info(),
                    ctx.accounts.pool_coin_account.to_account_info(),
                    inviter_account.to_account_info(),
                    ctx.accounts.pool_authority.to_account_info(),
                    task_info.rewards,
                    Some(&[seeds]),
                )?;
            }
        }
    }

    let task_application = &mut ctx.accounts.task_application;
    task_application.state = ApplicationState::Withdrawed;

    Ok(())
}
