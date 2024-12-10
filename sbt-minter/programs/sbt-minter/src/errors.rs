use anchor_lang::prelude::*;

#[error_code]
pub enum SbtMinterError {
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
}
