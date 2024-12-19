use crate::errors::TaskTraderError;
use crate::state::task_application::{ApplicationState, TaskApplication};
use crate::state::task_info::TaskInfo;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ApproveApplication<'info> {
    #[account(
        mut,
        constraint = task_info.requester == requester.key() @ TaskTraderError::InvalidRequester,
        constraint = task_info.approved_num < task_info.taker_num @ TaskTraderError::TakerNumExceeded,
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

pub fn approve_application(ctx: Context<ApproveApplication>) -> Result<()> {
    let task_info = &mut ctx.accounts.task_info;
    let task_application = &mut ctx.accounts.task_application;
    task_application.state = ApplicationState::Accepted;
    task_info.approved_num += 1;
    Ok(())
}
