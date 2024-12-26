use {
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::AssociatedToken,
        token::{Mint, Token, TokenAccount},
    },
};

use crate::{
    errors::TaskTraderError,
    state::{admin::Admin, support_coin::SupportCoin, task_info::TaskInfo},
    utils::token_utils,
};

#[derive(Accounts)]
#[instruction(task_id: u64)]
pub struct CreateTask<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"admin"],
        bump
    )]
    pub admin: Account<'info, Admin>,

    /// CHECK: This is not dangerous
    #[account(
        seeds = [b"pool_authority"],
        bump,
        constraint = pool_authority.key() == Pubkey::find_program_address(&[b"pool_authority"], &crate::ID).0
    )]
    pub pool_authority: AccountInfo<'info>,

    #[account(
        init,
        payer = user,
        space = TaskInfo::INIT_SPACE,
        seeds = [b"task_info", task_id.to_le_bytes().as_ref()],
        bump
    )]
    pub task_info: Account<'info, TaskInfo>,

    pub coin_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = coin_mint,
        associated_token::authority = user,
    )]
    pub user_coin_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = coin_mint,
        associated_token::authority = pool_authority,
    )]
    pub pool_coin_account: Box<Account<'info, TokenAccount>>,

    #[account(
        seeds = [b"support_coin"],
        bump,
    )]
    pub support_coin: Account<'info, SupportCoin>,

    /// CHECK: This is not dangerous
    #[account(
        constraint = fee_receiver.key() == admin.fee_receiver @ TaskTraderError::Unauthorized
    )]
    pub fee_receiver: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = coin_mint,
        associated_token::authority = fee_receiver,
    )]
    pub fee_receiver_coin_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_task(
    ctx: Context<CreateTask>,
    task_id: u64,
    task_amount: u64,
    taker_num: u64,
    coin_mint: Pubkey,
    rewards: u64,
) -> Result<()> {
    msg!("Creating task...");

    if task_amount == 0 || taker_num == 0 {
        return Err(TaskTraderError::InvalidAmount.into());
    }
    if !ctx.accounts.support_coin.coin_mints.contains(&coin_mint) {
        return Err(TaskTraderError::InvalidCoinMint.into());
    }

    token_utils::transfer_token(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.user_coin_account.to_account_info(),
        ctx.accounts.pool_coin_account.to_account_info(),
        ctx.accounts.user.to_account_info(),
        (task_amount + rewards) * taker_num,
    )?;

    // Initialize task info
    let task_info = &mut ctx.accounts.task_info;
    task_info.task_id = task_id;
    task_info.task_amount = task_amount;
    task_info.taker_num = taker_num;
    task_info.coin_mint = coin_mint;
    task_info.rewards = rewards;
    task_info.requester = ctx.accounts.user.key();

    Ok(())
}
