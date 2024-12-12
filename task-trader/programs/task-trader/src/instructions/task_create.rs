use {
    anchor_lang::prelude::*,
    anchor_spl::{
        metadata::{
            create_metadata_accounts_v3, mpl_token_metadata::types::DataV2,
            CreateMetadataAccountsV3, Metadata,
        },
        token::{self, Mint, Transfer, Token},
    },
};

use crate::errors::*;
use crate::utils::*;
use crate::state::{task_info::TaskInfo, admin::Admin};

#[derive(Accounts)]
pub struct CreateTask<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = Admin::INIT_SPACE,
        seeds = [b"admin"],
        bump
    )]
    pub admin: Account<'info, Admin>,

    #[account(
        mut,
        seeds = [b"pool_authority"],
        bump,
    )]
    pub pool_authority: AccountInfo<'info>,

    #[account(
        init,
        payer = user,
        space = TaskInfo::INIT_SPACE,
        seeds = [b"task", task_id.to_le_bytes().as_ref()],
        bump
    )]
    pub task_info: Account<'info, TaskInfo>,

    #[account(
        init,
        payer = user,
        mint::decimals = 0,
        mint::authority = usdt_mint.key(),
        mint::freeze_authority = usdt_mint.key(),
    )]
    pub usdt_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = user,
        mint::decimals = 0,
        mint::authority = mai3_mint.key(),
        mint::freeze_authority = mai3_mint.key(),
    )]
    pub mai3_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = usdt_mint,
        associated_token::authority = user,
    )]
    pub user_usdt_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mai3_mint,
        associated_token::authority = user,
    )]
    pub user_mai3_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = usdt_mint,
        associated_token::authority = pool_authority,
    )]
    pub pool_usdt_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mai3_mint,
        associated_token::authority = pool_authority,
    )]
    pub pool_mai3_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_task(
    ctx: Context<CreateTask>, 
    task_id: u64, 
    task_amount: u64,
    taker_num: u64,
    coin_type: u64, // usdt, mai
    rewards: u64,  // mai
) -> Result<()> {
    msg!("Creating task...");
    
    ctx.accounts.task_info.task_id = task_id;
    ctx.accounts.task_info.task_amount = task_amount;
    ctx.accounts.task_info.taker_num = taker_num;
    ctx.accounts.task_info.amount_per_task = task_amount / taker_num;
    ctx.accounts.task_info.coin_type = coin_type;
    ctx.accounts.task_info.rewards = rewards;
    ctx.accounts.task_info.state = 0;
    ctx.accounts.task_info.requester = ctx.accounts.user.key();

    if coin_type == 0 {
        token_utils::transfer_token(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.user_usdt_account.to_account_info(),
            ctx.accounts.pool_usdt_account.to_account_info(),
            ctx.accounts.user.to_account_info(),
            task_amount,
        )?;
    } else {
        token_utils::transfer_token(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.user_mai3_account.to_account_info(),
            ctx.accounts.pool_mai3_account.to_account_info(),
            ctx.accounts.user.to_account_info(),
            task_amount,
        )?;
    }

    Ok(())
}