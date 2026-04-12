# Module: subscription

## Purpose

Subscription plan management (FREE/PRO/PREMIUM) with payment processing, webhook handling, billing history, and dynamic pricing from admin settings.

## Key Files

- `subscription.controller.ts` — Plans, subscribe, cancel, billing history, webhook
- `subscription.service.ts` — Plan pricing, payment flow, webhook processing
- `payment-admin.controller.ts` — Admin payment management endpoints

## Data Model

- `Payment` — userId, transactionId, plan, period, amount, status (PENDING/SUCCESS/FAILED/REFUNDED), idempotencyKey
- User.role used as subscription tier proxy (USER=free, VERIFIED=paid, ADMIN=premium)

## Dependencies

SettingsService (dynamic pricing), ConfigService, EmailService (optional) | AI/LLM: No

## Business Rules

- Plan prices read from SystemSetting (admin-configurable), falling back to shared constants
- Yearly discount multiplier also admin-configurable
- Payment gateway is currently **simulated** (always succeeds after 500ms delay)
- Webhook signature verified via HMAC-SHA256 (WEBHOOK_SECRET required in production)
- Webhook idempotency: checks `metadata.webhookEventId` to prevent duplicate processing
- Subscription cancel downgrades role to USER
- All paid users get VERIFIED role regardless of PRO/PREMIUM tier

## Gotchas

- Payment processing is a stub — production requires real gateway integration
- Subscription tier is derived from `user.role`, not a separate subscription model
- `@ThrottleSensitive()` on controller; webhook uses `@ThrottleRelaxed()` + `@Public()`
- Plan definitions in `@study-abroad/shared` — Chinese names/features hardcoded in service
