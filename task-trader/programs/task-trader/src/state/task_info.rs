use anchor_lang::prelude::*;

#[derive(Clone, Copy, Debug, PartialEq, AnchorSerialize, AnchorDeserialize)]
pub enum TaskState {
    Open = 0,  // 开启
    Close = 1, // 关闭
}

#[account]
pub struct TaskInfo {
    pub task_id: u64,
    pub task_amount: u64,
    pub taker_num: u64,
    pub approved_num: u64,
    pub amount_per_task: u64,
    pub coin_type: u64, // usdt, mai
    pub rewards: u64,   // mai
    pub expire_time: i64,
    pub state: TaskState,
    pub requester: Pubkey,
}

impl TaskInfo {
    pub const INIT_SPACE: usize = 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 32 + 1;
}
