use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG");

/// Seconds in a 365-day year, used for simple (non-compounding) interest accrual.
const SECONDS_PER_YEAR: i64 = 31_536_000;

/// Simple linear interest accrued on `borrowed` since `last_update`.
///
/// interest = borrowed * rate_bps/10_000 * elapsed_seconds/SECONDS_PER_YEAR
///
/// All intermediate math is done in u128 so a large principal cannot overflow,
/// then the (always-smaller) result is narrowed back to u64. Returns 0 when there
/// is no debt, no elapsed time, or an unset/future `last_update` timestamp.
fn accrued_interest(borrowed: u64, rate_bps: u16, last_update: i64, now: i64) -> Result<u64> {
    if borrowed == 0 || rate_bps == 0 || last_update <= 0 || now <= last_update {
        return Ok(0);
    }
    let elapsed = (now - last_update) as u128;
    let interest = (borrowed as u128)
        .checked_mul(rate_bps as u128)
        .ok_or(ErrorCode::Overflow)?
        .checked_mul(elapsed)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(10_000)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(SECONDS_PER_YEAR as u128)
        .ok_or(ErrorCode::Overflow)?;
    Ok(interest as u64)
}

#[program]
pub mod anala_lending {
    use super::*;

    /// Initialize a lending pool for a PreStocks token.
    ///
    /// `initial_price` is the collateral's price expressed in the borrow asset's
    /// base units (USDC, 6 decimals) per ONE WHOLE collateral token. It is pushed
    /// on-chain by the admin/keeper from the live PreStocks mark (these synthetic
    /// pre-IPO tokens have no third-party oracle). `collateral_decimals` is read
    /// from the mint so borrow math can scale correctly.
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        ltv_basis_points: u16,
        interest_rate_bps: u16,
        initial_price: u64,
    ) -> Result<()> {
        require!(ltv_basis_points >= 3000 && ltv_basis_points <= 7500, ErrorCode::InvalidLTV);
        require!(initial_price > 0, ErrorCode::InvalidPrice);

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
        pool.collateral_price = initial_price;
        pool.collateral_decimals = ctx.accounts.collateral_mint.decimals;

        msg!(
            "Pool init: LTV {}bps interest {}bps price {} ({} dp)",
            ltv_basis_points,
            interest_rate_bps,
            initial_price,
            pool.collateral_decimals
        );
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

    /// Borrow USDC against collateral.
    ///
    /// Borrow capacity is derived from the on-chain collateral price with correct
    /// token-decimal scaling (collateral mints use 9 dp, USDC 6 dp), so the limit
    /// reflects the real USD value of the deposit rather than a hard-coded price.
    /// Accrued simple interest is folded into the debt before the check.
    pub fn borrow(
        ctx: Context<Borrow>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let now = Clock::get()?.unix_timestamp;

        // Snapshot the immutable pool values we need for the PDA signature and the
        // borrow-capacity math, so we don't hold a &mut across the token CPI.
        let (pool_mint, pool_bump, ltv_ratio, interest_rate, price, decimals) = {
            let pool = &ctx.accounts.lending_pool;
            (
                pool.collateral_mint,
                pool.bump,
                pool.ltv_ratio,
                pool.interest_rate,
                pool.collateral_price,
                pool.collateral_decimals,
            )
        };
        require!(price > 0, ErrorCode::InvalidPrice);

        let position = &mut ctx.accounts.user_position;
        require!(position.collateral_amount > 0, ErrorCode::NoCollateral);

        // 1) Accrue interest on any existing debt.
        let interest = accrued_interest(position.borrowed_amount, interest_rate, position.last_interest_update, now)?;
        position.borrowed_amount = position.borrowed_amount.checked_add(interest)
            .ok_or(ErrorCode::Overflow)?;
        position.last_interest_update = now;

        // 2) Decimal-correct borrow capacity, computed in u128.
        //    collateral_value(USDC base units) = collateral_amount * price / 10^decimals
        let scale = 10u128.checked_pow(decimals as u32).ok_or(ErrorCode::Overflow)?;
        let collateral_value = (position.collateral_amount as u128)
            .checked_mul(price as u128).ok_or(ErrorCode::Overflow)?
            .checked_div(scale).ok_or(ErrorCode::Overflow)?;
        let max_borrow = collateral_value
            .checked_mul(ltv_ratio as u128).ok_or(ErrorCode::Overflow)?
            .checked_div(10_000).ok_or(ErrorCode::Overflow)?;

        let new_borrowed = (position.borrowed_amount as u128)
            .checked_add(amount as u128).ok_or(ErrorCode::Overflow)?;
        require!(new_borrowed <= max_borrow, ErrorCode::ExceedsLTV);

        position.borrowed_amount = new_borrowed as u64;
        if position.borrowed_at == 0 {
            position.borrowed_at = now;
        }
        // (&mut user_position ends here — its last use is above.)

        // 3) Transfer USDC from vault to user (pool PDA signs).
        let seeds = &[
            b"lending_pool".as_ref(),
            pool_mint.as_ref(),
            core::slice::from_ref(&pool_bump),
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

        // 4) Update pool totals with the accrued interest and the new principal.
        let pool = &mut ctx.accounts.lending_pool;
        pool.total_borrowed = pool.total_borrowed
            .checked_add(interest).ok_or(ErrorCode::Overflow)?
            .checked_add(amount).ok_or(ErrorCode::Overflow)?;

        msg!("Borrowed {} USDC (accrued interest {})", amount, interest);
        Ok(())
    }

    /// Repay borrowed USDC (principal + accrued interest).
    pub fn repay(
        ctx: Context<Repay>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let now = Clock::get()?.unix_timestamp;
        let interest_rate = ctx.accounts.lending_pool.interest_rate;

        let position = &mut ctx.accounts.user_position;
        require!(position.borrowed_amount > 0, ErrorCode::NothingToRepay);

        // Accrue interest first, so repayment settles interest before principal.
        let interest = accrued_interest(position.borrowed_amount, interest_rate, position.last_interest_update, now)?;
        position.borrowed_amount = position.borrowed_amount.checked_add(interest)
            .ok_or(ErrorCode::Overflow)?;
        position.last_interest_update = now;

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

        // Update pool: add the newly-accrued interest, then subtract the repayment.
        let pool = &mut ctx.accounts.lending_pool;
        pool.total_borrowed = pool.total_borrowed
            .checked_add(interest).ok_or(ErrorCode::Overflow)?
            .checked_sub(repay_amount).ok_or(ErrorCode::Underflow)?;

        msg!("Repaid {} USDC (incl. accrued interest {})", repay_amount, interest);
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
            b"lending_pool".as_ref(),
            pool.collateral_mint.as_ref(),
            core::slice::from_ref(&pool.bump),
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
        let position = &mut ctx.accounts.user_position;
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

        msg!("Updated LTV from {}bps to {}bps", old_ltv, new_ltv_bps);
        Ok(())
    }

    /// Update the on-chain collateral price (admin/keeper only).
    ///
    /// `new_price` is in USDC base units (6 dp) per ONE WHOLE collateral token,
    /// pushed from the live PreStocks mark. This is the price the borrow-capacity
    /// check reads, so it must be kept fresh by the keeper.
    pub fn update_price(
        ctx: Context<UpdatePrice>,
        new_price: u64,
    ) -> Result<()> {
        require!(new_price > 0, ErrorCode::InvalidPrice);

        let pool = &mut ctx.accounts.lending_pool;
        let old_price = pool.collateral_price;
        pool.collateral_price = new_price;

        msg!("Updated collateral price from {} to {}", old_price, new_price);
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

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
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
    // --- appended (keeps the byte offsets of every field above unchanged) ---
    /// USDC base units (6 dp) per ONE WHOLE collateral token. Admin/keeper pushed.
    pub collateral_price: u64,
    /// Decimals of the collateral mint (read at init), for borrow-capacity scaling.
    pub collateral_decimals: u8,
}

impl LendingPool {
    // 32*5 + 8 + 8 + 2 + 2 + 1 + 8 + 1
    pub const LEN: usize = 32 + 32 + 32 + 32 + 32 + 8 + 8 + 2 + 2 + 1 + 8 + 1;
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
    #[msg("Price must be greater than zero")]
    InvalidPrice,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Arithmetic underflow")]
    Underflow,
}
