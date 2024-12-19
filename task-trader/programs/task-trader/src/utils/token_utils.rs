use {
    anchor_lang::prelude::*,
    anchor_spl::token::{self, Transfer},
};

pub fn transfer_token<'info>(
    token_program: AccountInfo<'info>,
    from_account: AccountInfo<'info>,
    to_account: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    task_amount: u64,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<()> {
    let seeds = signer_seeds.unwrap_or(&[&[]]);
    let cpi_ctx = CpiContext::new_with_signer(
        token_program,
        Transfer {
            from: from_account,
            to: to_account,
            authority: authority,
        },
        seeds,
    );

    msg!("Transferring tokens...");
    msg!("Amount: {}", task_amount);

    token::transfer(cpi_ctx, task_amount)?;
    msg!("Transfer completed");

    Ok(())
}
