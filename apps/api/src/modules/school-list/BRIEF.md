# Module: school-list

## Purpose

User's target school list management with tier categorization (REACH/TARGET/SAFETY), binding round validation, and stats-based AI recommendations.

## Key Files

- `school-list.controller.ts` — CRUD for school list items + AI recommend endpoint
- `school-list.service.ts` — List management, round validation, AI recommendation via stats scoring
- `school-list.constants.ts` — Prisma select constants and `mapSchoolForList` mapper

## Data Model

- `SchoolListItem` — userId + schoolId (unique compound), tier, round, notes, isAIRecommended
- References: PredictionResult (batch lookup), EssayPrompt (counts), SchoolDeadline (deadlines)

## Dependencies

PrismaService, CacheInvalidationService, scoring utils | AI/LLM: No (stats-based scoring only)

## Business Rules

- Binding round exclusivity: ED/ED2 and REA/SCEA are mutually exclusive
- Only one school per binding round (ED, ED2, REA, SCEA)
- Round availability validated against school's deadline data
- AI recommendations use statistical scoring to classify top-100 schools into reach/target/safety (5 each)
- Quick-match results synced to PredictionResult/Snapshot but never overwrite higher-quality models
- Duplicate school addition blocked (unique userId_schoolId constraint)
- Cache invalidated on profile change after add/update/remove

## Gotchas

- `getUserSchoolList` batch-fetches predictions, essay counts, and deadlines for all items
- Profile controller proxies target-school endpoints to this service (legacy compat)
- `syncQuickMatchToPrediction` is fire-and-forget — failures logged, not thrown
- Application year calculated as current year +1 if month >= August
