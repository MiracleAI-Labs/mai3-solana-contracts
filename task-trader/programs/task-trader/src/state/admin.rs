use anchor_lang::prelude::*;

#[account]
pub struct Admin {
    pub signer: Pubkey,
    pub fee_receiver: Pubkey,
    pub fee_ratio: u64,
}

impl Admin {
    pub const INIT_SPACE: usize = 8 + 32 + 32 + 8;
}
