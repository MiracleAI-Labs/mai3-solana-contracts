use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)] // automatically calculate the space required for the struct
pub struct TaskInfo {
    pub task_id: u64, 
    pub task_amount: u64,
    pub taker_num: u64,
    pub amount_per_task: u64,
    pub coin_type: u64, // usdt, mai
    pub rewards: u64,  // mai
    pub state: u64,
    pub requester: Pubkey,
}

impl TaskInfo {
    pub const INIT_SPACE: usize = 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 32;
}
