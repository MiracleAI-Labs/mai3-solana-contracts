use crate::state::admin::Admin;
use anchor_lang::prelude::*;
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = Admin::INIT_SPACE,
        seeds = [b"admin"],
        bump
    )]
    pub admin: Account<'info, Admin>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize(ctx: Context<Initialize>, signer: Pubkey, fee_receiver: Pubkey) -> Result<()> {
    msg!("Initalizing...");

    ctx.accounts.admin.signer = signer;
    ctx.accounts.admin.fee_receiver = fee_receiver;

    Ok(())
}
