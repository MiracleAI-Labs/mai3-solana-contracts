use crate::state::task_application::TaskApplication;
use crate::state::task_info::TaskInfo;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ApplyTask<'info> {
    #[account(mut)]
    pub task_info: Account<'info, TaskInfo>,

    #[account(
        init,
        payer = applicant,
        space = TaskApplication::INIT_SPACE,
        seeds = [
            b"task_application",
            task_info.key().as_ref(),
            applicant.key().as_ref(),
        ],
        bump
    )]
    pub task_application: Account<'info, TaskApplication>,

    #[account(mut)]
    pub applicant: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn apply_task(ctx: Context<ApplyTask>, inviter: Option<Pubkey>) -> Result<()> {
    let task_info = &ctx.accounts.task_info;
    let task_application = &mut ctx.accounts.task_application;
    let applicant_key = ctx.accounts.applicant.key();
    task_application.task_id = task_info.task_id;
    task_application.applicant = applicant_key;
    if let Some(inviter) = inviter {
        if inviter != applicant_key {
            task_application.inviter = inviter;
        }
    }
    Ok(())
}
