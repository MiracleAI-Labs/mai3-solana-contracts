use anchor_lang::prelude::*;

#[derive(Clone, Copy, Debug, PartialEq, AnchorSerialize, AnchorDeserialize)]
pub enum ApplicationState {
    Applied = 0,              // Applied
    AcceptedByAcceptance = 1, // Verification Passed
    Withdrawed = 2,           // Withdrawed
}

#[account]
pub struct TaskApplication {
    pub task_id: u64,
    pub applicant: Pubkey,
    pub inviter: Pubkey,
    pub state: ApplicationState,
}

impl TaskApplication {
    pub const INIT_SPACE: usize = 8 + 8 + 32 + 32 + 1;
}
