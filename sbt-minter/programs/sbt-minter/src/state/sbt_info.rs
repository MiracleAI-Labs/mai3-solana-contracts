use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)] // automatically calculate the space required for the struct
pub struct SbtInfo {
    #[max_len(50)] // set a max length for the string
    pub name: String, // 4 bytes + 50 bytes
    #[max_len(200)] // set a max length for the string
    pub photo: String, // 4 bytes + 50 bytes
    #[max_len(50)] // set a max length for the string
    pub twitter_id: String, // 4 bytes + 50 bytes
    #[max_len(50)]
    pub discord_id: String, // 4 bytes + 50 bytes
    #[max_len(50)]
    pub telegram_id: String, // 4 bytes + 50 bytes
    pub sol_fee: u64,
    pub usd_fee: u64,
    pub mai_fee: u64,
    pub score: u64,
    pub minted: bool,
}

impl SbtInfo {
    pub const INIT_SPACE: usize = 8 + 200 + 200 + 50 + 50 + 50 + 8 + 8 + 8 + 8 + 1;
}
