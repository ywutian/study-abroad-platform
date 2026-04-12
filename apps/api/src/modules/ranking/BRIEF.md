# Module: ranking

## Purpose

Custom school ranking calculator that lets users weight factors (US News rank, acceptance rate, tuition, avg salary) to generate personalized school rankings.

## Key Files

- `ranking.controller.ts` — Calculate, save, list, delete custom rankings
- `ranking.service.ts` — Weighted scoring algorithm with min-max normalization

## Data Model

- `CustomRanking` — Saved ranking with userId, name, weights (JSON), isPublic flag

## Dependencies

SchoolService (for school metrics), PrismaService | AI/LLM: No

## Business Rules

- Calculate endpoint is @Public() — anyone can compute rankings without auth
- Weights are normalized to sum to 100 before scoring
- Lower rank/acceptance/tuition = better; higher salary = better (inverted scoring)
- Scores rescaled to 0-100 range (top school = 100)
- Public rankings limited to 50 most recent

## Gotchas

- `CalculateRankingDto` and `SaveRankingDto` are inline interfaces, not DTO classes (violates no-inline-body rule)
- Delete checks ownership but throws NotFoundException (not ForbiddenException) for non-owner
- Uses `@ThrottleRelaxed()` at controller level
