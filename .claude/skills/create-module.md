---
name: create-module
description: Scaffold a new NestJS backend module following project conventions
---

# Create Backend Module

Scaffold a new backend module at `apps/api/src/modules/{name}/` following all project conventions.

## Arguments

The user should provide: `{module-name}` (kebab-case, e.g., `scholarship`)

## Step 1: Validate

- Confirm module doesn't already exist: `ls apps/api/src/modules/{name}`
- Confirm the name is kebab-case
- Ask the user for a one-line purpose if not provided

## Step 2: Generate Files

Create the following files:

### `{name}.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { {PascalName}Controller } from './{name}.controller';
import { {PascalName}Service } from './{name}.service';

@Module({
  controllers: [{PascalName}Controller],
  providers: [{PascalName}Service],
  exports: [{PascalName}Service],
})
export class {PascalName}Module {}
```

### `{name}.controller.ts`
- Import `@Controller('{name}')` with proper route
- Add `@ApiTags('{PascalName}')` for Swagger
- Inject `{PascalName}Service`
- Add one example GET endpoint with `@Public()` or `@Roles()` as appropriate
- Use `@ThrottleRelaxed()` for reads, `@ThrottleAI()` for AI endpoints

### `{name}.service.ts`
- Inject `PrismaService` if DB-backed
- Add one example method matching the controller endpoint

### `{name}.controller.spec.ts` and `{name}.service.spec.ts`
- Jest test stubs with proper PrismaService mock
- Include `describe` block with at least one `it('should be defined')` test

### `dto/index.ts`
- Empty barrel export (ready for DTOs)

### `BRIEF.md`
```markdown
# {PascalName} Module

## Purpose
{one-line purpose from user}

## Key Files
- `{name}.controller.ts` — REST endpoints
- `{name}.service.ts` — Business logic
- `dto/` — Request/response DTOs

## Patterns
- Follows standard CRUD pattern
- Uses shared Prisma selects from `common/constants/prisma-selects.ts`
```

## Step 3: Wire Up

1. Import `{PascalName}Module` in `apps/api/src/app.module.ts`
2. Add to the `imports` array

## Step 4: Verify

```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter api test -- --testPathPattern={name}
```

## Rules

- DTO fields use Prisma enum types, not `string`
- All string DTO fields have `@MaxLength()`
- Never inline `@Body()` types
- Controller uses shared API route constants from `packages/shared/src/constants/api-routes.ts` if the route is used by frontend
- BRIEF.md must be under 40 lines
