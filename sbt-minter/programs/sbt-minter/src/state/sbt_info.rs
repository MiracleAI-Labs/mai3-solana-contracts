use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)] // automatically calculate the space required for the struct
pub struct SbtInfo {
    #[max_len(50)] // set a max length for the string
    pub name: String, // 4 bytes + 50 bytes
    #[max_len(200)] // set a max length for the string
    pub photo: String, // 4 bytes + 50 bytes
    #[max_len(50)] // set a max length for the string
    pub twitterID: String, // 4 bytes + 50 bytes
    #[max_len(50)]
    pub discordID: String, // 4 bytes + 50 bytes
    #[max_len(50)]
    pub telegramID: String, // 4 bytes + 50 bytes
}
