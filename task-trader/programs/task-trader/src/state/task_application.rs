use anchor_lang::prelude::*;

#[derive(Clone, Copy, Debug, PartialEq, AnchorSerialize, AnchorDeserialize)]
pub enum ApplicationState {
    Applied = 0,              // Applied
    Accepted = 1,             // Accepted and Paid
    Rejected = 2,             // Rejected
    WaitingForAcceptance = 3, // Waiting for Verification
    RejectedByAcceptance = 4, // Verification Failed
    AcceptedByAcceptance = 5, // Verification Passed
    Withdrawed = 6,           // Withdrawed
}

#[account]
pub struct TaskApplication {
    pub task_id: u64,
    pub applicant: Pubkey,
    pub inviter: Pubkey,
    pub apply_time: i64,
    pub state: ApplicationState,
}

impl TaskApplication {
    pub const INIT_SPACE: usize = 8 + 8 + 32 + 32 + 8 + 1;
}
