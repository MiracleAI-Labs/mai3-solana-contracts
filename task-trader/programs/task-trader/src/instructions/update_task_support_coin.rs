use crate::{
    errors::TaskTraderError,
    state::{admin::Admin, support_coin::SupportCoin},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateTaskSupportCoin<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [b"admin"],
        bump,
        constraint = admin.signer == *payer.key @ TaskTraderError::Unauthorized
    )]
    pub admin: Account<'info, Admin>,

    #[account(
        init_if_needed,
        seeds = [b"support_coin"],
        bump,
        payer = payer,
        space = SupportCoin::INIT_SPACE
    )]
    pub support_coin: Account<'info, SupportCoin>,

    pub system_program: Program<'info, System>,
}

pub fn update_task_support_coin(
    ctx: Context<UpdateTaskSupportCoin>,
    coin_mints: Vec<Pubkey>,
) -> Result<()> {
    msg!("Updating task support coin...");

    ctx.accounts.support_coin.coin_mints = coin_mints;

    Ok(())
}
