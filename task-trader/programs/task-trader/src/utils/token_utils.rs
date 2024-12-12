use {
    anchor_lang::prelude::*,
    anchor_spl::token::{self, Transfer},
};

pub fn transfer_token(
    token_program: AccountInfo,
    from_account: AccountInfo,
    to_account: AccountInfo, 
    authority: AccountInfo,
    amount: u64,
) -> Result<()> {
    token::transfer(
        CpiContext::new(
            token_program,
            Transfer {
                from: from_account,
                to: to_account,
                authority: authority,
            },
        ),
        task_amount,
    )?;

    Ok(())
}

pub fn transfer_token_with_signer(
    token_program: AccountInfo,
    from_account: AccountInfo,
    to_account: AccountInfo,
    authority: AccountInfo,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    //let signer_seeds: &[&[&[u8]]] = &[&[b"task_authority", &[ctx.bumps.task_authority]]];
    token::transfer(
        CpiContext::new_with_signer(
            token_program,
            Transfer {
                from: from_account,
                to: to_account,
                authority: authority,
            },
            signer_seeds,
        ),
        task_amount,
    )?;

    Ok(())
}