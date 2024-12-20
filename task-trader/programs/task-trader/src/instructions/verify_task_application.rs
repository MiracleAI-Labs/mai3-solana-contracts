use crate::{
    errors::TaskTraderError,
    state::task_application::{ApplicationState, TaskApplication},
    state::task_info::TaskInfo,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct VerifyTaskApplication<'info> {
    #[account(
        mut,
        constraint = task_application.state == ApplicationState::WaitingForAcceptance @ TaskTraderError::InvalidApplicationState,)]
    pub task_application: Account<'info, TaskApplication>,
    #[account(
        constraint = task_info.task_id == task_application.task_id @ TaskTraderError::InvalidTaskId,
        constraint = task_info.requester == user.key() @ TaskTraderError::InvalidRequester,
    )]
    pub task_info: Account<'info, TaskInfo>,
    pub user: Signer<'info>,
}

pub fn verify_task_application(
    ctx: Context<VerifyTaskApplication>,
    is_accepted: bool,
) -> Result<()> {
    let task_application = &mut ctx.accounts.task_application;

    task_application.state = if is_accepted {
        ApplicationState::AcceptedByAcceptance
    } else {
        ApplicationState::RejectedByAcceptance
    };

    Ok(())
}
