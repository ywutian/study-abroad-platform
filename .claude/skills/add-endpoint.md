---
name: add-endpoint
description: Add a REST endpoint to an existing NestJS module with DTO, throttle, and Swagger
---

# Add REST Endpoint

Add a new endpoint to an existing backend module following all project conventions.

## Arguments

The user should provide: `{module-name}` and the endpoint details (method, path, purpose).

## Step 1: Read Context

1. Read the module's `BRIEF.md` to understand its purpose
2. Read the existing controller to understand current endpoints and patterns
3. Read the existing service to understand available methods
4. Check if the module has existing DTOs in `dto/`

## Step 2: Create DTO (if needed)

For POST/PUT/PATCH endpoints, create a DTO class in `dto/`:

```typescript
import { IsString, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class {ActionName}Dto {
  @ApiProperty({ description: '...' })
  @IsString()
  @MaxLength(200)
  field: string;
}
```

- Export from `dto/index.ts`
- Use Prisma enums for enum fields (`import { MyEnum } from '@prisma/client'`)
- All `@IsString()` fields MUST have `@MaxLength()`
- Array fields: `@IsArray()` + `@IsString({ each: true })`

## Step 3: Add Service Method

Add the business logic method to `{name}.service.ts`:
- Use Prisma selects from `common/constants/prisma-selects.ts` where applicable
- Extract new select constants to `*.constants.ts` if needed
- Throw NestJS exceptions (`NotFoundException`, `BadRequestException`) — never `throw new Error()`

## Step 4: Add Controller Endpoint

Add to `{name}.controller.ts`:
- Correct HTTP method decorator (`@Get()`, `@Post()`, etc.)
- Auth: `@Public()` for public, `@Roles(Role.ADMIN)` for admin-only
- Rate limit: `@ThrottleRelaxed()` for reads, `@ThrottleAI()` for AI, `@ThrottleSensitive()` for auth
- Swagger: `@ApiOperation({ summary: '...' })` + `@ApiResponse()`
- Param validation: `@Param('id', ParseUUIDPipe)` for UUID params

## Step 5: Add Tests

Add test case(s) to `{name}.controller.spec.ts` and `{name}.service.spec.ts`:
- Mock PrismaService with the relevant model methods
- Test the happy path at minimum
- Test error cases (not found, validation failure) for service methods

## Step 6: Update Route Constants (if frontend-consumed)

If the endpoint will be called from frontend or mobile:
1. Add route to `packages/shared/src/constants/api-routes.ts`
2. Build shared: `pnpm --filter @study-abroad/shared build`

## Step 7: Verify

```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter api test -- --testPathPattern={name}
```

## Rules

- Never inline `@Body() body: { ... }` — always use DTO class
- Response goes through TransformInterceptor — never manually build `{ success, data }`
- Check BRIEF.md and update if new endpoint changes the module's scope significantly
