import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

export type AnalaLending = {
  "address": "7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG",
  "metadata": {
    "name": "anala_lending",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "initialize_pool",
      "discriminator": [95, 180, 10, 172, 84, 174, 232, 40],
      "accounts": [
        { "name": "lending_pool", "writable": true },
        { "name": "collateral_mint" },
        { "name": "borrow_mint" },
        { "name": "collateral_vault", "writable": true },
        { "name": "borrow_vault", "writable": true },
        { "name": "authority", "writable": true, "signer": true },
        { "name": "system_program", "address": "11111111111111111111111111111111" },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { "name": "rent", "address": "SysvarRent111111111111111111111111111111111" }
      ],
      "args": [
        { "name": "ltv_basis_points", "type": "u16" },
        { "name": "interest_rate_bps", "type": "u16" }
      ]
    },
    {
      "name": "deposit_collateral",
      "discriminator": [46, 110, 180, 232, 55, 101, 73, 12],
      "accounts": [
        { "name": "lending_pool", "writable": true },
        { "name": "user_position", "writable": true },
        { "name": "collateral_vault", "writable": true },
        { "name": "user_token_account", "writable": true },
        { "name": "user", "writable": true, "signer": true },
        { "name": "system_program", "address": "11111111111111111111111111111111" },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "borrow",
      "discriminator": [228, 253, 131, 202, 207, 116, 89, 37],
      "accounts": [
        { "name": "lending_pool", "writable": true },
        { "name": "user_position", "writable": true },
        { "name": "borrow_vault", "writable": true },
        { "name": "user_borrow_account", "writable": true },
        { "name": "user", "signer": true },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "repay",
      "discriminator": [234, 103, 67, 82, 208, 234, 219, 166],
      "accounts": [
        { "name": "lending_pool", "writable": true },
        { "name": "user_position", "writable": true },
        { "name": "borrow_vault", "writable": true },
        { "name": "user_borrow_account", "writable": true },
        { "name": "user", "writable": true, "signer": true },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "withdraw_collateral",
      "discriminator": [194, 135, 183, 24, 79, 203, 129, 24],
      "accounts": [
        { "name": "lending_pool", "writable": true },
        { "name": "user_position", "writable": true },
        { "name": "collateral_vault", "writable": true },
        { "name": "user_token_account", "writable": true },
        { "name": "user", "signer": true },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "update_ltv",
      "discriminator": [167, 88, 166, 113, 227, 202, 208, 219],
      "accounts": [
        { "name": "lending_pool", "writable": true },
        { "name": "authority", "signer": true }
      ],
      "args": [
        { "name": "new_ltv_bps", "type": "u16" }
      ]
    }
  ],
  "accounts": [
    {
      "name": "LendingPool",
      "discriminator": [205, 230, 159, 227, 180, 95, 191, 28],
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "pubkey" },
          { "name": "collateral_mint", "type": "pubkey" },
          { "name": "collateral_vault", "type": "pubkey" },
          { "name": "borrow_mint", "type": "pubkey" },
          { "name": "borrow_vault", "type": "pubkey" },
          { "name": "total_collateral", "type": "u64" },
          { "name": "total_borrowed", "type": "u64" },
          { "name": "ltv_ratio", "type": "u16" },
          { "name": "interest_rate", "type": "u16" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "UserPosition",
      "discriminator": [66, 140, 250, 108, 234, 98, 174, 43],
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "owner", "type": "pubkey" },
          { "name": "pool", "type": "pubkey" },
          { "name": "collateral_amount", "type": "u64" },
          { "name": "borrowed_amount", "type": "u64" },
          { "name": "borrowed_at", "type": "i64" },
          { "name": "last_interest_update", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ],
  "errors": [
    { "code": 6000, "name": "InvalidAmount", "msg": "Amount must be greater than zero" },
    { "code": 6001, "name": "NoCollateral", "msg": "No collateral deposited" },
    { "code": 6002, "name": "ExceedsLTV", "msg": "Borrow amount exceeds LTV limit" },
    { "code": 6003, "name": "NothingToRepay", "msg": "Nothing to repay" },
    { "code": 6004, "name": "OutstandingDebt", "msg": "Outstanding debt must be repaid before withdrawal" },
    { "code": 6005, "name": "InsufficientCollateral", "msg": "Insufficient collateral" },
    { "code": 6006, "name": "InvalidLTV", "msg": "LTV ratio must be between 30% and 75%" },
    { "code": 6007, "name": "Overflow", "msg": "Arithmetic overflow" },
    { "code": 6008, "name": "Underflow", "msg": "Arithmetic underflow" }
  ],
  "types": [
    {
      "name": "LendingPool",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "pubkey" },
          { "name": "collateral_mint", "type": "pubkey" },
          { "name": "collateral_vault", "type": "pubkey" },
          { "name": "borrow_mint", "type": "pubkey" },
          { "name": "borrow_vault", "type": "pubkey" },
          { "name": "total_collateral", "type": "u64" },
          { "name": "total_borrowed", "type": "u64" },
          { "name": "ltv_ratio", "type": "u16" },
          { "name": "interest_rate", "type": "u16" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "UserPosition",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "owner", "type": "pubkey" },
          { "name": "pool", "type": "pubkey" },
          { "name": "collateral_amount", "type": "u64" },
          { "name": "borrowed_amount", "type": "u64" },
          { "name": "borrowed_at", "type": "i64" },
          { "name": "last_interest_update", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ]
};

export const IDL: AnalaLending = {
  "address": "7h6qLdbjD12HspcDc1vk8uCsf2STHGWJSkHH9FvyYNLG",
  "metadata": {
    "name": "anala_lending",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "initialize_pool",
      "discriminator": [95, 180, 10, 172, 84, 174, 232, 40],
      "accounts": [
        { "name": "lending_pool", "writable": true },
        { "name": "collateral_mint" },
        { "name": "borrow_mint" },
        { "name": "collateral_vault", "writable": true },
        { "name": "borrow_vault", "writable": true },
        { "name": "authority", "writable": true, "signer": true },
        { "name": "system_program", "address": "11111111111111111111111111111111" },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { "name": "rent", "address": "SysvarRent111111111111111111111111111111111" }
      ],
      "args": [
        { "name": "ltv_basis_points", "type": "u16" },
        { "name": "interest_rate_bps", "type": "u16" }
      ]
    },
    {
      "name": "deposit_collateral",
      "discriminator": [46, 110, 180, 232, 55, 101, 73, 12],
      "accounts": [
        { "name": "lending_pool", "writable": true },
        { "name": "user_position", "writable": true },
        { "name": "collateral_vault", "writable": true },
        { "name": "user_token_account", "writable": true },
        { "name": "user", "writable": true, "signer": true },
        { "name": "system_program", "address": "11111111111111111111111111111111" },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "borrow",
      "discriminator": [228, 253, 131, 202, 207, 116, 89, 37],
      "accounts": [
        { "name": "lending_pool", "writable": true },
        { "name": "user_position", "writable": true },
        { "name": "borrow_vault", "writable": true },
        { "name": "user_borrow_account", "writable": true },
        { "name": "user", "signer": true },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "repay",
      "discriminator": [234, 103, 67, 82, 208, 234, 219, 166],
      "accounts": [
        { "name": "lending_pool", "writable": true },
        { "name": "user_position", "writable": true },
        { "name": "borrow_vault", "writable": true },
        { "name": "user_borrow_account", "writable": true },
        { "name": "user", "writable": true, "signer": true },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "withdraw_collateral",
      "discriminator": [194, 135, 183, 24, 79, 203, 129, 24],
      "accounts": [
        { "name": "lending_pool", "writable": true },
        { "name": "user_position", "writable": true },
        { "name": "collateral_vault", "writable": true },
        { "name": "user_token_account", "writable": true },
        { "name": "user", "signer": true },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "update_ltv",
      "discriminator": [167, 88, 166, 113, 227, 202, 208, 219],
      "accounts": [
        { "name": "lending_pool", "writable": true },
        { "name": "authority", "signer": true }
      ],
      "args": [
        { "name": "new_ltv_bps", "type": "u16" }
      ]
    }
  ],
  "accounts": [
    {
      "name": "LendingPool",
      "discriminator": [205, 230, 159, 227, 180, 95, 191, 28],
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "pubkey" },
          { "name": "collateral_mint", "type": "pubkey" },
          { "name": "collateral_vault", "type": "pubkey" },
          { "name": "borrow_mint", "type": "pubkey" },
          { "name": "borrow_vault", "type": "pubkey" },
          { "name": "total_collateral", "type": "u64" },
          { "name": "total_borrowed", "type": "u64" },
          { "name": "ltv_ratio", "type": "u16" },
          { "name": "interest_rate", "type": "u16" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "UserPosition",
      "discriminator": [66, 140, 250, 108, 234, 98, 174, 43],
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "owner", "type": "pubkey" },
          { "name": "pool", "type": "pubkey" },
          { "name": "collateral_amount", "type": "u64" },
          { "name": "borrowed_amount", "type": "u64" },
          { "name": "borrowed_at", "type": "i64" },
          { "name": "last_interest_update", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ],
  "errors": [
    { "code": 6000, "name": "InvalidAmount", "msg": "Amount must be greater than zero" },
    { "code": 6001, "name": "NoCollateral", "msg": "No collateral deposited" },
    { "code": 6002, "name": "ExceedsLTV", "msg": "Borrow amount exceeds LTV limit" },
    { "code": 6003, "name": "NothingToRepay", "msg": "Nothing to repay" },
    { "code": 6004, "name": "OutstandingDebt", "msg": "Outstanding debt must be repaid before withdrawal" },
    { "code": 6005, "name": "InsufficientCollateral", "msg": "Insufficient collateral" },
    { "code": 6006, "name": "InvalidLTV", "msg": "LTV ratio must be between 30% and 75%" },
    { "code": 6007, "name": "Overflow", "msg": "Arithmetic overflow" },
    { "code": 6008, "name": "Underflow", "msg": "Arithmetic underflow" }
  ],
  "types": [
    {
      "name": "LendingPool",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "pubkey" },
          { "name": "collateral_mint", "type": "pubkey" },
          { "name": "collateral_vault", "type": "pubkey" },
          { "name": "borrow_mint", "type": "pubkey" },
          { "name": "borrow_vault", "type": "pubkey" },
          { "name": "total_collateral", "type": "u64" },
          { "name": "total_borrowed", "type": "u64" },
          { "name": "ltv_ratio", "type": "u16" },
          { "name": "interest_rate", "type": "u16" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "UserPosition",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "owner", "type": "pubkey" },
          { "name": "pool", "type": "pubkey" },
          { "name": "collateral_amount", "type": "u64" },
          { "name": "borrowed_amount", "type": "u64" },
          { "name": "borrowed_at", "type": "i64" },
          { "name": "last_interest_update", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ]
};
