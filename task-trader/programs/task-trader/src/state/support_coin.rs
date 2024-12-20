use anchor_lang::prelude::*;

#[account]
pub struct SupportCoin {
    pub coin_mints: Vec<Pubkey>,
}

impl SupportCoin {
    pub const MAX_COINS: usize = 10;
    pub const INIT_SPACE: usize = 8 + // discriminator
        4 + // Vec length
        (32 * Self::MAX_COINS); // Space for MAX_COINS Pubkeys
}
