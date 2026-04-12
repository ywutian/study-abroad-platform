# Module: school

## Purpose

College/university data management with multi-source enrichment (College Scorecard, Urban Institute, BigFuture, Appily), community ratings, and admin data pipeline.

## Key Files

- `school.controller.ts` — Public search/detail, admin CRUD, data sync/scrape, community ratings, logo fill
- `school.service.ts` — Search with advanced filters, Redis caching, data quality report, relevance scoring
- `school-data.service.ts` — College Scorecard API sync
- `urban-institute-data.service.ts` — IPEDS data sync
- `school-scraper.service.ts` — Website scraping for essays/deadlines
- `school-data-merger.ts` — Multi-source data merge with field provenance tracking
- `school-community-rating.service.ts` — User ratings (safety, life, food) with admin moderation
- `school-logo.service.ts` — Logo.dev domain-based logo fill
- `high-school.controller.ts` — High school data management

## Data Model

- `School` — 50+ fields (name, rank, acceptance rate, SAT/ACT, tuition, etc.) with metadata JSON for provenance
- `SchoolMetric` — Yearly metrics history
- `SchoolDeadline` — Application deadlines by round/year
- `SchoolCommunityRating` — User-submitted ratings per school
- `SchoolRanking` — External ranking sources

## Dependencies

Redis, PrismaService, AuditLogService, SchoolListService, CacheInvalidation | AI/LLM: No

## Business Rules

- School list cached 5 min, detail cached 1 hour, metrics cached 24 hours
- Search uses alias matching (case-insensitive) + relevance scoring (alias > startsWith > contains + rank bonus)
- Field provenance tracks source (MANUAL_ADMIN, COLLEGE_SCORECARD, etc.) and timestamp
- Data quality report analyzes 20+ key fields for coverage
- UC school IDs endpoint supports one-click UC prediction
- Community ratings require min threshold to display publicly

## Gotchas

- `acceptanceRate` and `graduationRate` clamped via `clampPercentRate()` on every output
- `metadata.provenance` tracks which data source set each field — admin updates overwrite provenance
- Name normalization via `nameNorm` column for dedup (auto-set on create/update)
- Admin endpoints nested under `/schools/admin/*` within the same controller
