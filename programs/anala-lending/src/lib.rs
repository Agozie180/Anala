use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("11111111111111111111111111111111");

#[program]
pub mod anala_lending {
    use super::*;

    /// Initialize a lending pool for a PreStocks token
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        ltv_basis_points: u16,
        interest_rate_bps: u16,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.lending_pool;
        pool.authority = ctx.accounts.authority.key();
        pool.collateral_mint = ctx.accounts.collateral_mint.key();
        pool.collateral_vault = ctx.accounts.collateral_vault.key();
        pool.borrow_mint = ctx.accounts.borrow_mint.key();
        pool.borrow_vault = ctx.accounts.borrow_vault.key();
        pool.total_collateral = 0;
        pool.total_borrowed = 0;
        pool.ltv_ratio = ltv_basis_points;
        pool.interest_rate = interest_rate_bps;
        pool.bump = ctx.bumps.lending_pool;

        msg!("Lending pool initialized with LTV: {}%", ltv_basis_points / 100);
        Ok(())
    }

    /// Deposit PreStocks tokens as collateral
    pub fn deposit_collateral(
        ctx: Context<DepositCollateral>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Transfer tokens from user to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.collateral_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Update position
        let position = &mut ctx.accounts.user_position;
        if position.owner == Pubkey::default() {
            position.owner = ctx.accounts.user.key();
            position.pool = ctx.accounts.lending_pool.key();
            position.collateral_amount = 0;
            position.borrowed_amount = 0;
            position.borrowed_at = 0;
            position.last_interest_update = Clock::get()?.unix_timestamp;
            position.bump = ctx.bumps.user_position;
        }
        position.collateral_amount = position.collateral_amount.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        // Update pool
        let pool = &mut ctx.accounts.lending_pool;
        pool.total_collateral = pool.total_collateral.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        msg!("Deposited {} tokens as collateral", amount);
        Ok(())
    }

    /// Borrow USDC against collateral
    pub fn borrow(
        ctx: Context<Borrow>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let position = &mut ctx.accounts.user_position;
        let pool = &ctx.accounts.lending_pool;

        require!(position.collateral_amount > 0, ErrorCode::NoCollateral);

        // Calculate max borrow (simplified: assumes 1:1 token price = $1000)
        // In production, would use oracle price feed
        let collateral_value = position.collateral_amount.checked_mul(1000)
            .ok_or(ErrorCode::Overflow)?;
        let max_borrow = collateral_value.checked_mul(pool.ltv_ratio as u64)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::Overflow)?;

        let new_borrowed = position.borrowed_amount.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        require!(new_borrowed <= max_borrow, ErrorCode::ExceedsLTV);

        // Transfer USDC from vault to user
        let seeds = &[
            b"lending_pool",
            pool.collateral_mint.as_ref(),
            &[pool.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.borrow_vault.to_account_info(),
            to: ctx.accounts.user_borrow_account.to_account_info(),
            authority: ctx.accounts.lending_pool.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        // Update position
        position.borrowed_amount = new_borrowed;
        if position.borrowed_at == 0 {
            position.borrowed_at = Clock::get()?.unix_timestamp;
        }

        // Update pool
        let pool = &mut ctx.accounts.lending_pool;
        pool.total_borrowed = pool.total_borrowed.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        msg!("Borrowed {} USDC", amount);
        Ok(())
    }

    /// Repay borrowed USDC
    pub fn repay(
        ctx: Context<Repay>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let position = &mut ctx.accounts.user_position;
        require!(position.borrowed_amount > 0, ErrorCode::NothingToRepay);

        let repay_amount = amount.min(position.borrowed_amount);

        // Transfer USDC from user to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_borrow_account.to_account_info(),
            to: ctx.accounts.borrow_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, repay_amount)?;

        // Update position
        position.borrowed_amount = position.borrowed_amount.checked_sub(repay_amount)
            .ok_or(ErrorCode::Underflow)?;
        position.last_interest_update = Clock::get()?.unix_timestamp;

        // Update pool
        let pool = &mut ctx.accounts.lending_pool;
        pool.total_borrowed = pool.total_borrowed.checked_sub(repay_amount)
            .ok_or(ErrorCode::Underflow)?;

        msg!("Repaid {} USDC", repay_amount);
        Ok(())
    }

    /// Withdraw collateral (requires full repayment)
    pub fn withdraw_collateral(
        ctx: Context<WithdrawCollateral>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let position = &mut ctx.accounts.user_position;
        require!(position.borrowed_amount == 0, ErrorCode::OutstandingDebt);
        require!(amount <= position.collateral_amount, ErrorCode::InsufficientCollateral);

        let pool = &ctx.accounts.lending_pool;

        // Transfer tokens from vault to user
        let seeds = &[
            b"lending_pool",
            pool.collateral_mint.as_ref(),
            &[pool.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.collateral_vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.lending_pool.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        // Update position
        position.collateral_amount = position.collateral_amount.checked_sub(amount)
            .ok_or(ErrorCode::Underflow)?;

        // Update pool
        let pool = &mut ctx.accounts.lending_pool;
        pool.total_collateral = pool.total_collateral.checked_sub(amount)
            .ok_or(ErrorCode::Underflow)?;

        msg!("Withdrew {} tokens", amount);
        Ok(())
    }

    /// Update LTV ratio (admin only, based on Anala risk assessment)
    pub fn update_ltv(
        ctx: Context<UpdateLTV>,
        new_ltv_bps: u16,
    ) -> Result<()> {
        require!(new_ltv_bps >= 3000 && new_ltv_bps <= 7500, ErrorCode::InvalidLTV);

        let pool = &mut ctx.accounts.lending_pool;
        let old_ltv = pool.ltv_ratio;
        pool.ltv_ratio = new_ltv_bps;

        msg!("Updated LTV from {}% to {}%", old_ltv / 100, new_ltv_bps / 100);
        Ok(())
    }
}

// Account contexts

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + LendingPool::LEN,
        seeds = [b"lending_pool", collateral_mint.key().as_ref()],
        bump
    )]
    pub lending_pool: Account<'info, LendingPool>,

    pub collateral_mint: Account<'info, token::Mint>,
    pub borrow_mint: Account<'info, token::Mint>,

    #[account(
        init,
        payer = authority,
        token::mint = collateral_mint,
        token::authority = lending_pool,
        seeds = [b"collateral_vault", lending_pool.key().as_ref()],
        bump
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = authority,
        token::mint = borrow_mint,
        token::authority = lending_pool,
        seeds = [b"borrow_vault", lending_pool.key().as_ref()],
        bump
    )]
    pub borrow_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(mut)]
    pub lending_pool: Account<'info, LendingPool>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserPosition::LEN,
        seeds = [b"user_position", lending_pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        mut,
        constraint = collateral_vault.key() == lending_pool.collateral_vault
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Borrow<'info> {
    #[account(mut)]
    pub lending_pool: Account<'info, LendingPool>,

    #[account(
        mut,
        seeds = [b"user_position", lending_pool.key().as_ref(), user.key().as_ref()],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        mut,
        constraint = borrow_vault.key() == lending_pool.borrow_vault
    )]
    pub borrow_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_borrow_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Repay<'info> {
    #[account(mut)]
    pub lending_pool: Account<'info, LendingPool>,

    #[account(
        mut,
        seeds = [b"user_position", lending_pool.key().as_ref(), user.key().as_ref()],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        mut,
        constraint = borrow_vault.key() == lending_pool.borrow_vault
    )]
    pub borrow_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_borrow_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawCollateral<'info> {
    #[account(mut)]
    pub lending_pool: Account<'info, LendingPool>,

    #[account(
        mut,
        seeds = [b"user_position", lending_pool.key().as_ref(), user.key().as_ref()],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        mut,
        constraint = collateral_vault.key() == lending_pool.collateral_vault
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateLTV<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub lending_pool: Account<'info, LendingPool>,

    pub authority: Signer<'info>,
}

// Account structures

#[account]
pub struct LendingPool {
    pub authority: Pubkey,
    pub collateral_mint: Pubkey,
    pub collateral_vault: Pubkey,
    pub borrow_mint: Pubkey,
    pub borrow_vault: Pubkey,
    pub total_collateral: u64,
    pub total_borrowed: u64,
    pub ltv_ratio: u16,
    pub interest_rate: u16,
    pub bump: u8,
}

impl LendingPool {
    pub const LEN: usize = 32 + 32 + 32 + 32 + 32 + 8 + 8 + 2 + 2 + 1;
}

#[account]
pub struct UserPosition {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub collateral_amount: u64,
    pub borrowed_amount: u64,
    pub borrowed_at: i64,
    pub last_interest_update: i64,
    pub bump: u8,
}

impl UserPosition {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 8 + 8 + 1;
}

// Error codes

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("No collateral deposited")]
    NoCollateral,
    #[msg("Borrow amount exceeds LTV limit")]
    ExceedsLTV,
    #[msg("Nothing to repay")]
    NothingToRepay,
    #[msg("Outstanding debt must be repaid before withdrawal")]
    OutstandingDebt,
    #[msg("Insufficient collateral")]
    InsufficientCollateral,
    #[msg("LTV ratio must be between 30% and 75%")]
    InvalidLTV,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Arithmetic underflow")]
    Underflow,
}
