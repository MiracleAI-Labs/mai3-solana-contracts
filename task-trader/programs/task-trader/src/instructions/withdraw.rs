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

    pub usdt_mint: Account<'info, Mint>,

    pub mai3_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = usdt_mint,
        associated_token::authority = user,
    )]
    pub user_usdt_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mai3_mint,
        associated_token::authority = user,
    )]
    pub user_mai3_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = pool_usdt_account.owner == pool_authority.key() @ TaskTraderError::InvalidPoolAccount,
        constraint = pool_usdt_account.mint == usdt_mint.key() @ TaskTraderError::InvalidMint,
    )]
    pub pool_usdt_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = pool_mai3_account.owner == pool_authority.key() @ TaskTraderError::InvalidPoolAccount,
        constraint = pool_mai3_account.mint == mai3_mint.key() @ TaskTraderError::InvalidMint,
    )]
    pub pool_mai3_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
    let task_info = &ctx.accounts.task_info;
    let seeds = &[b"pool_authority".as_ref(), &[ctx.bumps.pool_authority]];

    if task_info.coin_type == 0 {
        token_utils::transfer_token(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.pool_usdt_account.to_account_info(),
            ctx.accounts.user_usdt_account.to_account_info(),
            ctx.accounts.pool_authority.to_account_info(),
            task_info.task_amount,
            Some(&[seeds]),
        )?;
    } else {
        token_utils::transfer_token(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.pool_mai3_account.to_account_info(),
            ctx.accounts.user_mai3_account.to_account_info(),
            ctx.accounts.pool_authority.to_account_info(),
            task_info.task_amount,
            Some(&[seeds]),
        )?;
    }

    let task_application = &mut ctx.accounts.task_application;
    task_application.state = ApplicationState::Withdrawed;

    Ok(())
}
