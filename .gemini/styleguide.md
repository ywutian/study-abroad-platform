# Study-Abroad-Platform Code Review Guidelines

## Backend Rules

- All @Body() parameters must use DTO classes with class-validator decorators, never inline types
- String DTO fields must have @MaxLength() decorator
- AI routes (calling LLM APIs) must have @ThrottleAI() rate limiting decorator
- Never use `throw new Error()` in service files; use NestJS exceptions (BadRequestException, NotFoundException, etc.)
- Sensitive endpoints must have @Roles(Role.ADMIN) guard
- Always use extractJsonFromLlm() from common/utils/llm-json.util for parsing LLM JSON responses, never regex
- Prisma select blocks must use shared constants from common/constants/prisma-selects.ts, not inline objects
- Response mapping must use mapper functions, not inline object construction
- Every service file should have a corresponding .spec.ts test file

## Frontend Rules

- Tailwind classes must be static, never interpolated with template literals like `bg-${color}-500` (purged in production)
- Hardcoded Tailwind colors (bg-emerald-50, text-blue-600) must include a dark: variant
- Prefer CSS variables: text-foreground, bg-background, bg-card, bg-muted, text-muted-foreground, border-border
- Never use bg-slate-800/900 or text-white for page backgrounds; use bg-background and text-foreground
- All pages need a sibling loading.tsx file with Skeleton components
- No console.log in production code
- Tooltip components must be wrapped in TooltipProvider
- Use PageHeader + PageContainer pattern on all feature pages
- No hardcoded user-facing strings; use next-intl t() function with keys in messages/{en,zh}.json

## Database Rules

- New Prisma model fields must be nullable or have defaults to avoid downtime during migration
- Schema changes require migration files (`db:migrate`), never use `db:push` for production
- New nullable fields in frontend rendering: never use `|| 'specific_enum_value'` as default (misleads users when data is null)
- When adding/changing Prisma model fields, check all consumers (services, admin UI, frontend, mobile) that read/write the model

## Security Rules

- JWT access tokens stored in-memory only (Zustand store), never in localStorage
- Refresh tokens must be in httpOnly cookies, inaccessible to JavaScript
- Rate limiting required: @ThrottleAI() for LLM endpoints, @ThrottleSensitive() for auth, @ThrottleStrict() for vault
- Always validate user ownership (userId filter) before returning data in queries
- Never use $queryRaw with string interpolation; use parameterized queries or Prisma client methods

## i18n Rules

- en.json and zh.json keys must stay in sync
- No wrong-language content in locale files (e.g., Chinese text in en.json)
- All user-visible text must use i18n keys, not hardcoded strings

## Architecture Rules

- API routes must use shared constants from packages/shared/src/constants/api-routes.ts
- Module imports must follow dependency rules: never import services directly without importing the module
- LLMService, ResilienceService, TokenTrackerService are globally provided; do not re-register them
