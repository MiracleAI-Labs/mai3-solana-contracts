use anchor_lang::prelude::*;

#[account]
pub struct Admin {
    pub signer: Pubkey,
    pub fee_receiver: Pubkey,
}

impl Admin {
    pub const INIT_SPACE: usize = 8 + 32 + 32;
}
