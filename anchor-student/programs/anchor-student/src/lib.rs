use anchor_lang::prelude::*;

declare_id!("6mTYFBaTKd2oQVuYTPmkmjPF8zxsMHz7ohv97fg64nxq");

const DISCRIMINATOR: usize = 8;
const INIT_SPACE: usize = 1000;

const MIN_AGE: u8 = 1;
const MAX_AGE: u8 = 100;
const MAX_NAME_LENGTH: usize = 20;
const MAX_DESCRIPTION_LENGTH: usize = 100;
const NAME_SEED: &[u8] = b"student_info";

#[program]
pub mod anchor_student {
    use super::*;

    pub fn add_student_info(ctx: Context<AddStudentInfo>, name: String, age: u8, description: String) -> Result<()> {
        require!(name.len() <= MAX_NAME_LENGTH, StudentInfoError::NameTooLong);
        require!(age >= MIN_AGE && age <= MAX_AGE, StudentInfoError::InvalidAge);
        require!(description.len() <= MAX_DESCRIPTION_LENGTH, StudentInfoError::DescriptionTooLong);

        let student_info = &mut ctx.accounts.student_info;
        student_info.owner = *ctx.accounts.user.key;
        student_info.name = name;
        student_info.age = age;
        student_info.description = description;

        Ok(())
    }

    pub fn update_student_info(ctx: Context<UpdateStudentInfo>, name: String, age: u8, description: String) -> Result<()> {
        require!(name.len() <= MAX_NAME_LENGTH, StudentInfoError::NameTooLong);
        require!(age >= MIN_AGE && age <= MAX_AGE, StudentInfoError::InvalidAge);
        require!(description.len() <= MAX_DESCRIPTION_LENGTH, StudentInfoError::DescriptionTooLong);

        let student_info = &mut ctx.accounts.student_info;
        student_info.age = age;
        student_info.description = description;

        Ok(())
    }

    pub fn delete_student_info(ctx: Context<DeleteStudentInfo>) -> Result<()> {
        let student_info = &mut ctx.accounts.student_info;
        require!(student_info.owner == *ctx.accounts.user.key, StudentInfoError::NotOwner); 
        student_info.close(ctx.accounts.user.to_account_info());
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct AddStudentInfo<'info> {
    #[account(
        init,
        seeds = [NAME_SEED, name.as_bytes().as_ref(), user.key().as_ref()],
        bump,
        payer = user,
        space = DISCRIMINATOR + INIT_SPACE
    )]
    pub student_info: Account<'info, StudentInfo>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_name: String)]
pub struct UpdateStudentInfo<'info> {
    #[account(
        mut,
        seeds = [NAME_SEED, _name.as_bytes().as_ref(), user.key().as_ref()],
        bump,
        realloc = DISCRIMINATOR + INIT_SPACE,
        realloc::payer = user,
        realloc::zero = true,
    )]
    pub student_info: Account<'info, StudentInfo>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_name: String)]
pub struct DeleteStudentInfo<'info> {
    #[account(
        mut,
        seeds = [NAME_SEED, _name.as_bytes().as_ref(), user.key().as_ref()],
        bump,
        close = user,
    )]
    pub student_info: Account<'info, StudentInfo>,

    #[account(mut)]
    pub user: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct StudentInfo {
    pub owner: Pubkey,
    #[max_len(20)]
    pub name: String,
    pub age: u8,
    #[max_len(100)]
    pub description: String,
}

#[error_code]
enum StudentInfoError {
    #[msg("Invalid age")]
    InvalidAge,
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Description too long")]
    DescriptionTooLong,
    #[msg("Not owner")]
    NotOwner,
}
