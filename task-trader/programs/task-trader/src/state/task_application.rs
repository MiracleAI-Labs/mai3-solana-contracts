use anchor_lang::prelude::*;

#[derive(Clone, Copy, Debug, PartialEq, AnchorSerialize, AnchorDeserialize)]
pub enum ApplicationState {
    Applied = 0,              // 已申请
    Accepted = 1,             // 已接受
    Rejected = 2,             // 已拒绝
    Paid = 3,                 // 已付款
    WaitingForAcceptance = 4, // 等待验收
    RejectedByAcceptance = 5, // 验收不通过
    AcceptedByAcceptance = 6, // 验收通过
}

#[account]
pub struct TaskApplication {
    pub task_id: u64,
    pub applicant: Pubkey,
    pub apply_time: i64,
    pub state: ApplicationState,
}

impl TaskApplication {
    pub const INIT_SPACE: usize = 8 + 8 + 32 + 8 + 1;
}
