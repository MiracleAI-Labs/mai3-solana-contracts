use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)] // automatically calculate the space required for the struct
pub struct Admin {
    pub signer: Pubkey,
    pub feeAccount: Pubkey,
}

impl Admin {
    pub const INIT_SPACE: usize = 8 + 32;
}