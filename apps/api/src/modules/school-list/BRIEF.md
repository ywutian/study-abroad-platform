# Module: school-list

## Purpose

User's target school list management with tier categorization (REACH/TARGET/SAFETY), binding round validation, and Counselor Engine recommendations.

## Key Files

- `school-list.controller.ts` — CRUD for school list items + AI recommend endpoint
- `school-list.service.ts` — List management, round validation, AI recommendation via Counselor Engine preview
- `school-list.constants.ts` — Prisma select constants and `mapSchoolForList` mapper

## Data Model

- `SchoolListItem` — userId + schoolId (unique compound), tier, round, notes, isAIRecommended, optional sourceRecommendationId
- `SchoolRecommendationEvent` — attributable ADDED/REMOVED events linked to a recommendation
- References: PredictionResult (batch lookup), EssayPrompt (counts), SchoolDeadline (deadlines)

## Dependencies

PrismaService, CacheInvalidationService, PredictionService | AI/LLM: No direct LLM call

## Business Rules

- Binding round exclusivity: ED/ED2 and REA/SCEA are mutually exclusive
- Only one school per binding round (ED, ED2, REA, SCEA)
- Round availability validated against school's deadline data
- AI recommendations use Counselor Engine preview to classify top-100 schools into reach/target/safety (up to 5 each)
- Preview results are not persisted as PredictionResult rows and cannot overwrite formal predictions
- When a recommendationId is supplied, ownership and school membership are validated before creating an attributable ADDED event
- Duplicate school addition blocked (unique userId_schoolId constraint)
- Cache invalidated on profile change after add/update/remove

## Gotchas

- `getUserSchoolList` batch-fetches predictions, essay counts, and deadlines for all items
- Profile controller proxies target-school endpoints to this service (legacy compat)
- Application year calculated as current year +1 if month >= August
