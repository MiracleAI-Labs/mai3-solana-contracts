mod errors;
mod instructions;
mod state;
mod utils;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("DSyKrLRc83jxeEUiUJdsyePRcreQ2dkXj3vdpggH8wd1");

#[program]
pub mod task_trader {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        signer: Pubkey,
        fee_receiver: Pubkey,
    ) -> Result<()> {
        msg!("Initializing...");

        instructions::initialize::initialize(ctx, signer, fee_receiver)
    }

    pub fn create_task(
        ctx: Context<CreateTask>,
        task_id: u64,
        task_amount: u64,
        taker_num: u64,
        coin_type: u64, // usdt, mai
        rewards: u64,   // mai
    ) -> Result<()> {
        msg!("Creating Task Trader...");

        instructions::create_task::create_task(
            ctx,
            task_id,
            task_amount,
            taker_num,
            coin_type,
            rewards,
        )
    }
}
