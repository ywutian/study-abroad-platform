# Module: settings

## Purpose

Global system settings (key-value store) with Redis caching, admin CRUD, and 40+ predefined keys covering points, subscriptions, AI quotas, and notifications.

## Key Files

- `settings.controller.ts` — Get/set single or batch settings, filter by category (admin only)
- `settings.service.ts` — KV store with Redis cache (5 min TTL), typed getters, defaults

## Data Model

- `SystemSetting` — key (unique), value (string), description, category

## Dependencies

PrismaService, RedisService | AI/LLM: No

## Business Rules

- All endpoints require ADMIN role
- Settings have hardcoded defaults; DB values override defaults
- `getTyped<T>()` parses string values to boolean/number/object based on default type
- Key aliases supported (e.g., `SUBSCRIPTION_PRO_PRICE` maps to `subscription_pro_price`)
- Categories: general, notification, points, subscription, ai_quota
- Cache invalidated on every set() call

## Gotchas

- `SETTING_KEYS` constants exported and used across modules (PointsConfig, Subscription, etc.)
- `initializeDefaults()` only creates missing keys — does not overwrite existing values
- `setMany()` is sequential (not transactional) — partial failures possible
- `delete()` reverts to default value (swallows P2025 not-found error)
