use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct TokenInfo {
    pub owner: Pubkey,

    pub mint: Pubkey,

    #[max_len(32)]
    pub token_name: String,

    #[max_len(8)] 
    pub token_symbol: String,

    #[max_len(200)]
    pub token_uri: String,

    pub max_supply: u64,

    pub total_supply: u64
}