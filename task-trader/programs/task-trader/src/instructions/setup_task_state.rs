use crate::errors::TaskTraderError;
use crate::state::{
    admin::Admin,
    task_info::{TaskInfo, TaskState},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SetupTaskState<'info> {
    #[account(mut)]
    pub task_info: Account<'info, TaskInfo>,
    pub user: Signer<'info>,
    #[account(
        constraint = admin.signer == user.key() @ TaskTraderError::InvalidSigner
    )]
    pub admin: Option<Account<'info, Admin>>,
}

pub fn open_task(ctx: Context<SetupTaskState>) -> Result<()> {
    return set_task_state(ctx, TaskState::Open);
}

pub fn close_task(ctx: Context<SetupTaskState>) -> Result<()> {
    return set_task_state(ctx, TaskState::Close);
}

fn set_task_state(ctx: Context<SetupTaskState>, state: TaskState) -> Result<()> {
    let task_info = &mut ctx.accounts.task_info;
    let user = &ctx.accounts.user;

    // Check if the user is either the task creator or an admin
    if task_info.requester != user.key() && ctx.accounts.admin.is_none() {
        return Err(TaskTraderError::InvalidSigner.into());
    }

    task_info.state = state;

    msg!("Task state set successfully");
    Ok(())
}
