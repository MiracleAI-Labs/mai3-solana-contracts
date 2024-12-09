use anchor_lang::prelude::*;

#[error_code]
pub enum TokenMinterError {
    #[msg("Invalid authority")]
    InvalidAuthority,

    #[msg("Supply exceeded")]
    SupplyExceeded,
}   