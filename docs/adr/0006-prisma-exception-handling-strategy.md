# ADR-0006: Prisma Exception Handling in Global Filter

- Status: accepted
- Date: 2026-02-07
- Decision-makers: Core Team
- Tags: backend, error-handling, prisma

## Context

The global exception filter (`AllExceptionsFilter`) only handled `HttpException` and generic `Error`. Prisma ORM throws its own exception types (`PrismaClientKnownRequestError`, `PrismaClientValidationError`, `PrismaClientInitializationError`) that were caught as generic errors, resulting in:

- Unhelpful `500 Internal Server Error` for constraint violations (should be `409 Conflict`)
- Database error details leaked to clients in all environments
- No differentiation between "record not found" (404) and "database down" (503)

## Decision

Extend the global exception filter to explicitly handle Prisma exception types and map them to appropriate HTTP responses:

| Prisma Code | HTTP Status             | Error Code             | Example                       |
| ----------- | ----------------------- | ---------------------- | ----------------------------- |
| P2002       | 409 Conflict            | DUPLICATE_ENTRY        | Unique constraint violation   |
| P2025       | 404 Not Found           | NOT_FOUND              | Record not found              |
| P2003       | 400 Bad Request         | FOREIGN_KEY_ERROR      | Invalid foreign key reference |
| P2011       | 400 Bad Request         | REQUIRED_FIELD_MISSING | Null constraint violation     |
| P2000       | 400 Bad Request         | VALUE_TOO_LONG         | Value exceeds column length   |
| P1001/P1002 | 503 Service Unavailable | DATABASE_UNAVAILABLE   | Connection error              |
| P2024       | 504 Gateway Timeout     | QUERY_TIMEOUT          | Query engine timeout          |

Additional measures:

- **Production error masking**: Internal error details replaced with generic messages
- **Correlation ID injection**: Error responses include `correlationId` for tracing
- **Full logging**: Complete error details always logged (never masked in logs)

## Consequences

### Positive

- Clients receive actionable HTTP status codes and error messages
- Internal implementation details never leak in production
- Error responses are traceable via correlation IDs
- Consistent error format across all exception types

### Negative

- New Prisma error codes may need manual mapping as Prisma evolves
- Tests must account for the new error response format

### Neutral

- Prisma 5.x error codes are used; mappings may need review on major Prisma upgrades
- The filter is registered globally via `APP_FILTER`; no per-module configuration needed
