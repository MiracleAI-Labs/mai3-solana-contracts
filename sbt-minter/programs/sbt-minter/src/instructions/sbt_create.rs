use {
    anchor_lang::prelude::*,
    anchor_spl::{
        metadata::{
            create_metadata_accounts_v3, mpl_token_metadata::types::DataV2,
            CreateMetadataAccountsV3, Metadata,
        },
        token::{Mint, Token},
    },
};

use crate::state::{sbt_info::SbtInfo, admin::Admin};
use crate::errors::*;

#[derive(Accounts)]
pub struct CreateSbtMint<'info> {
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

    /// CHECK: Validate address by deriving pda
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), mint_account.key().as_ref()],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata_account: UncheckedAccount<'info>,

    #[account(
        init,
        seeds = [b"mint"],
        bump,
        payer = payer,
        mint::decimals = 0,
        mint::authority = mint_account.key(),
        mint::freeze_authority = mint_account.key(),
    )]
    pub mint_account: Account<'info, Mint>,

    pub token_metadata_program: Program<'info, Metadata>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_sbt_token_mint(
    ctx: Context<CreateSbtMint>, 
    token_name: String, 
    token_symbol: String, 
    token_uri: String, 
    signer: Pubkey,
    fee_receiver: Pubkey
) -> Result<()> {
    msg!("Creating SBT mint...");
    
    ctx.accounts.admin.signer = signer;
    ctx.accounts.admin.fee_receiver = fee_receiver;

     // PDA signer seeds
     let signer_seeds: &[&[&[u8]]] = &[&[b"mint", &[ctx.bumps.mint_account]]];

     // Cross Program Invocation (CPI) signed by PDA
     // Invoking the create_metadata_account_v3 instruction on the token metadata program
     create_metadata_accounts_v3(
         CpiContext::new(
             ctx.accounts.token_metadata_program.to_account_info(),
             CreateMetadataAccountsV3 {
                 metadata: ctx.accounts.metadata_account.to_account_info(),
                 mint: ctx.accounts.mint_account.to_account_info(),
                 mint_authority: ctx.accounts.mint_account.to_account_info(), // PDA is mint authority
                 update_authority: ctx.accounts.mint_account.to_account_info(), // PDA is update authority
                 payer: ctx.accounts.payer.to_account_info(),
                 system_program: ctx.accounts.system_program.to_account_info(),
                 rent: ctx.accounts.rent.to_account_info(),
             },
         )
         .with_signer(signer_seeds),
         DataV2 {
             name: token_name,
             symbol: token_symbol,
             uri: token_uri,
             seller_fee_basis_points: 0,
             creators: None,
             collection: None,
             uses: None,
         },
         false, // Is mutable
         true,  // Update authority is signer
         None,  // Collection details
     )?;

    Ok(())
}