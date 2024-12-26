use anchor_lang::prelude::*;
#[account]
pub struct TaskInfo {
    pub task_id: u64,
    pub task_amount: u64,
    pub taker_num: u64,
    pub coin_mint: Pubkey,
    pub rewards: u64,
    pub requester: Pubkey,
}

impl TaskInfo {
    pub const INIT_SPACE: usize = 8 + 8 + 8 + 32 + 8 + 8 + 8 + 32;
}
