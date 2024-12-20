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

    #[msg("Invalid expire time")]
    InvalidExpireTime,

    #[msg("Invalid task state")]
    InvalidTaskState,

    #[msg("Task expired")]
    TaskExpired,

    #[msg("Too many allowed applicants")]
    TooManyAllowedApplicants,

    #[msg("Applicant not allowed to apply for this task")]
    ApplicantNotAllowed,

    #[msg("Invalid Requester")]
    InvalidRequester,

    #[msg("Invalid Task Id")]
    InvalidTaskId,

    #[msg("Invalid Application State")]
    InvalidApplicationState,

    #[msg("Taker Num Exceeded")]
    TakerNumExceeded,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Invalid Applicant")]
    InvalidApplicant,

    #[msg("Invalid Pool Account")]
    InvalidPoolAccount,

    #[msg("Invalid Mint")]
    InvalidMint,
}
