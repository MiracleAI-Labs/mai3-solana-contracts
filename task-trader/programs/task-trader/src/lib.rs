mod instructions;
mod state;
mod errors;

use anchor_lang::prelude::*;

use instructions::*;
use utils::*;
use state::*;

declare_id!("GwvQ53QTu1xz3XXYfG5m5jEqwhMBvVBudPS8TUuFYnhT");

#[program]
pub mod task_trader {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>, 
        signer: Pubkey,
        fee_receiver: Pubkey
    ) -> Result<()> {
        msg!("Initializing...");

        initialize::initalize(ctx, signer, fee_receiver);

        msg!("Initialized successfully.");

        Ok(())
    }

    pub fn create_task(
        ctx: Context<CreateTask>, 
        task_id: u64, 
        task_amount: u64,
        taker_num: u64,
        coin_type: u64, // usdt, mai
        rewards: u64,  // mai
    ) -> Result<()> {
        msg!("Creating Task Trader...");

        task_trader::create_task(ctx, task_id, task_amount, taker_num, coin_type, rewards);

        msg!("Task Trader created successfully.");

        Ok(())
    }
}