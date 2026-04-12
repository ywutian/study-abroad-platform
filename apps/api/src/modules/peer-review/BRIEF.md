# Module: peer-review

## Purpose

Mutual peer review system: verified users request and submit structured reviews of each other's application profiles.

## Key Files

- `peer-review.controller.ts` — Request review, submit review, get my reviews, get user rating
- `peer-review.service.ts` — Review lifecycle: request → pending → submitted, rating aggregation

## Data Model

PeerReview (reviewerId, revieweeId, status: PENDING/SUBMITTED/EXPIRED, rating, content, category). References: User (both reviewer and reviewee via USER_SUMMARY_SELECT).

## Dependencies

PrismaService | AI/LLM: No

## Business Rules

- Both request and submit require `Role.VERIFIED` or `Role.ADMIN`
- Cannot review yourself (explicit self-review check)
- Both parties must be verified users
- Status flow: PENDING → SUBMITTED (or EXPIRED)
- User rating is aggregated from all received reviews

## Gotchas

- Uses `USER_SUMMARY_SELECT` from shared Prisma selects for consistent user display
- Guarded by both `JwtAuthGuard` and `RolesGuard` (double guard stack)
- No throttle decorator — relies on global throttle only
