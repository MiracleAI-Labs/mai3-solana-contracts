use crate::{
    errors::TaskTraderError,
    state::task_application::{ApplicationState, TaskApplication},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SubmitAcceptance<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        constraint = task_application.applicant == payer.key() @ TaskTraderError::Unauthorized,
        constraint = (task_application.state == ApplicationState::Accepted || task_application.state == ApplicationState::RejectedByAcceptance) @ TaskTraderError::InvalidApplicationState,
    )]
    pub task_application: Account<'info, TaskApplication>,

    pub system_program: Program<'info, System>,
}

pub fn submit_acceptance(ctx: Context<SubmitAcceptance>) -> Result<()> {
    let task_application = &mut ctx.accounts.task_application;
    task_application.state = ApplicationState::WaitingForAcceptance;
    Ok(())
}
