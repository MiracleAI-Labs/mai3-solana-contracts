use {
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::AssociatedToken,
        token::{Mint, Token, TokenAccount},
    },
};

use crate::{
    errors::TaskTraderError,
    state::{
        admin::Admin,
        task_info::{TaskInfo, TaskState},
    },
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
        init_if_needed,
        payer = user,
        associated_token::mint = usdt_mint,
        associated_token::authority = pool_authority,
    )]
    pub pool_usdt_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mai3_mint,
        associated_token::authority = pool_authority,
    )]
    pub pool_mai3_account: Box<Account<'info, TokenAccount>>,

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
    coin_type: u64, // usdt, mai
    rewards: u64,   // mai
    expire_time: i64,
) -> Result<()> {
    msg!("Creating task...");

    if task_amount == 0 || taker_num == 0 {
        return Err(TaskTraderError::InvalidAmount.into());
    }
    if task_amount % taker_num != 0 {
        return Err(TaskTraderError::InvalidDivision.into());
    }
    if coin_type > 1 {
        return Err(TaskTraderError::InvalidCoinType.into());
    }
    let current_time = Clock::get()?.unix_timestamp;
    require!(
        expire_time > current_time,
        TaskTraderError::InvalidExpireTime
    );

    // Initialize task info
    let task_info = &mut ctx.accounts.task_info;
    task_info.task_id = task_id;
    task_info.task_amount = task_amount;
    task_info.taker_num = taker_num;
    task_info.amount_per_task = task_amount / taker_num;
    task_info.coin_type = coin_type;
    task_info.rewards = rewards;
    task_info.expire_time = expire_time;
    task_info.state = TaskState::Open;
    task_info.approved_num = 0;
    task_info.requester = ctx.accounts.user.key();

    if coin_type == 0 {
        token_utils::transfer_token(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.user_usdt_account.to_account_info(),
            ctx.accounts.pool_usdt_account.to_account_info(),
            ctx.accounts.user.to_account_info(),
            task_amount,
            None,
        )?;
    } else {
        token_utils::transfer_token(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.user_mai3_account.to_account_info(),
            ctx.accounts.pool_mai3_account.to_account_info(),
            ctx.accounts.user.to_account_info(),
            task_amount,
            None,
        )?;
    }
    Ok(())
}
