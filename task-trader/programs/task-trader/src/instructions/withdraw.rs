use crate::{
    errors::TaskTraderError,
    state::{
        admin::Admin,
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
        seeds = [b"admin"],
        bump
    )]
    pub admin: Account<'info, Admin>,

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

    /// CHECK: This is not dangerous
    #[account(
        constraint = fee_receiver.key() == admin.fee_receiver @ TaskTraderError::InvalidFeeReceiverAccount
    )]
    pub fee_receiver: AccountInfo<'info>,

    #[account(
        mut,
        constraint = fee_receiver_coin_account.owner == fee_receiver.key() @ TaskTraderError::InvalidFeeReceiverAccount,
        constraint = fee_receiver_coin_account.mint == coin_mint.key() @ TaskTraderError::InvalidMint,
    )]
    pub fee_receiver_coin_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
    let task_info = &ctx.accounts.task_info;
    let task_application = &ctx.accounts.task_application;
    let seeds = &[b"pool_authority".as_ref(), &[ctx.bumps.pool_authority]];

    // Calculate fee for task amount (0.1%) with safe math
    let task_fee = task_info
        .task_amount
        .checked_mul(ctx.accounts.admin.fee_ratio)
        .and_then(|product| product.checked_div(1000))
        .ok_or(TaskTraderError::NumericalOverflow)?;
    let task_amount_after_fee = task_info
        .task_amount
        .checked_sub(task_fee)
        .ok_or(TaskTraderError::NumericalOverflow)?;

    // Calculate total fee including potential rewards fee
    let mut total_fee = task_fee;
    let mut rewards_after_fee = 0;

    if task_application.inviter != Pubkey::default() && task_info.rewards > 0 {
        if let Some(inviter_account) = &ctx.accounts.inviter_coin_account {
            if let Some(inviter) = &ctx.accounts.inviter {
                if inviter.key() != inviter_account.owner
                    || inviter.key() != task_application.inviter
                {
                    return Err(TaskTraderError::InvalidInviter.into());
                }
                // Calculate fee for rewards (0.1%) with safe math
                let rewards_fee = task_info
                    .rewards
                    .checked_div(1000)
                    .and_then(|rewards_fee| rewards_fee.checked_mul(1))
                    .ok_or(TaskTraderError::NumericalOverflow)?;
                total_fee = total_fee
                    .checked_add(rewards_fee)
                    .ok_or(TaskTraderError::NumericalOverflow)?;
                rewards_after_fee = task_info
                    .rewards
                    .checked_sub(rewards_fee)
                    .ok_or(TaskTraderError::NumericalOverflow)?;
            }
        }
    } else if task_info.rewards > 0 {
        total_fee = total_fee
            .checked_add(task_info.rewards)
            .ok_or(TaskTraderError::NumericalOverflow)?;
    }

    // Transfer total fee to fee receiver
    if total_fee > 0 {
        token_utils::transfer_token_with_singer(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.pool_coin_account.to_account_info(),
            ctx.accounts.fee_receiver_coin_account.to_account_info(),
            ctx.accounts.pool_authority.to_account_info(),
            total_fee,
            Some(&[seeds]),
        )?;
    }

    // Transfer remaining amount to user
    token_utils::transfer_token_with_singer(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.pool_coin_account.to_account_info(),
        ctx.accounts.user_coin_account.to_account_info(),
        ctx.accounts.pool_authority.to_account_info(),
        task_amount_after_fee,
        Some(&[seeds]),
    )?;

    // Transfer remaining rewards to inviter if applicable
    if rewards_after_fee > 0 {
        if let Some(inviter_account) = &ctx.accounts.inviter_coin_account {
            token_utils::transfer_token_with_singer(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.pool_coin_account.to_account_info(),
                inviter_account.to_account_info(),
                ctx.accounts.pool_authority.to_account_info(),
                rewards_after_fee,
                Some(&[seeds]),
            )?;
        }
    }

    let task_application = &mut ctx.accounts.task_application;
    task_application.state = ApplicationState::Withdrawed;

    Ok(())
}
