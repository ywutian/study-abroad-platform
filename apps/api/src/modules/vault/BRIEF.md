# Module: vault

## Purpose

Encrypted credential/document storage (password manager) with AES-256 encryption, import/export, and password generation.

## Key Files

- `vault.controller.ts` — CRUD, stats, generate password, export (with password re-confirmation), import
- `vault.service.ts` — Encrypted CRUD, bulk operations, statistics
- `encryption.service.ts` — AES-256 encrypt/decrypt with per-user key derivation

## Data Model

- `VaultItem` — userId, type (PASSWORD/CREDENTIAL/DOCUMENT/NOTE/API_KEY/OTHER), title, encryptedData, iv, category, tags, icon

## Dependencies

EncryptionService, AuthorizationService, UserService (for password verification on export) | AI/LLM: No

## Business Rules

- Data encrypted at rest using AES-256 with user-specific key derivation
- Export requires password re-confirmation (bcrypt compare against stored hash)
- List endpoint returns items WITHOUT decrypted data; detail endpoint decrypts
- Password generator supports length 8-64 characters
- Import validates type against enum; skips invalid types with warning log
- Delete all is a bulk operation with @ThrottleStrict()

## Gotchas

- `@ThrottleSensitive()` on write ops, `@ThrottleStrict()` on export/deleteAll, `@ThrottleRelaxed()` on reads
- Ownership verified via `AuthorizationService.verifyOwnership()` pattern
- Encryption key derived from VAULT_ENCRYPTION_KEY env var + userId
- `toVaultItemDto` strips encryptedData/iv from list responses
