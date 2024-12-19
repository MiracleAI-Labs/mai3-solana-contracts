use anchor_lang::prelude::*;

#[error_code]
pub enum TaskTraderError {
    #[msg("Custom error message")]
    CustomError,

    #[msg("Invalid length")]
    InvalidLength,

    #[msg("Invalid signature")]
    InvalidSignature,

    #[msg("Invalid signer")]
    InvalidSigner,

    #[msg("Already minted")]
    AlreadyMinted,

    #[msg("Not minted")]
    NotMinted,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Invalid division")]
    InvalidDivision,

    #[msg("Invalid coin type")]
    InvalidCoinType,
}
