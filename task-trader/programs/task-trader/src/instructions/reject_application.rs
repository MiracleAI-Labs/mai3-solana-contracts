use crate::errors::TaskTraderError;
use crate::state::task_application::{ApplicationState, TaskApplication};
use crate::state::task_info::TaskInfo;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RejectApplication<'info> {
    #[account(
        mut,
        constraint = task_info.requester == requester.key() @ TaskTraderError::InvalidRequester,
    )]
    pub task_info: Account<'info, TaskInfo>,

    #[account(
        mut,
        constraint = task_application.task_id == task_info.task_id @ TaskTraderError::InvalidTaskId,
        constraint = task_application.state == ApplicationState::Applied @ TaskTraderError::InvalidApplicationState,
    )]
    pub task_application: Account<'info, TaskApplication>,

    #[account(mut)]
    pub requester: Signer<'info>,
}

pub fn reject_application(ctx: Context<RejectApplication>) -> Result<()> {
    let task_application = &mut ctx.accounts.task_application;
    task_application.state = ApplicationState::Rejected;
    Ok(())
}
