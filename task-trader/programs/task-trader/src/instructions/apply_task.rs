use crate::errors::TaskTraderError;
use crate::state::task_application::TaskApplication;
use crate::state::task_info::{TaskInfo, TaskState};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ApplyTask<'info> {
    #[account(
        mut,
        constraint = task_info.state == TaskState::Open @ TaskTraderError::InvalidTaskState,
        constraint = Clock::get()?.unix_timestamp < task_info.expire_time @ TaskTraderError::TaskExpired
    )]
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

pub fn apply_task(ctx: Context<ApplyTask>) -> Result<()> {
    let task_info = &ctx.accounts.task_info;
    let task_application = &mut ctx.accounts.task_application;
    let applicant_key = ctx.accounts.applicant.key();

    task_application.task_id = task_info.task_id;
    task_application.applicant = applicant_key;
    task_application.apply_time = Clock::get()?.unix_timestamp;

    Ok(())
}
