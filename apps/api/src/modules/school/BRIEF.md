# Module: school

## Purpose

College/university data management with multi-source enrichment (College Scorecard, Urban Institute, BigFuture, Appily), community ratings, and admin data pipeline.

## Key Files

- `school.controller.ts` — Public search/detail, admin CRUD, data sync/scrape, community ratings, logo fill
- `school.service.ts` — Search with advanced filters, Redis caching, data quality report, relevance scoring
- `school-data.service.ts` / `urban-institute-data.service.ts` — College Scorecard + IPEDS sync
- `school-scraper.service.ts` — Website scraping for essays/deadlines
- `school-data-merger.ts` — Multi-source merge with field provenance tracking
- `school-community-rating.service.ts` — User ratings with admin moderation

## Data Model

- `School` — 50+ fields with `metadata.provenance` JSON tracking data sources
- `SchoolMetric`, `SchoolDeadline`, `SchoolCommunityRating`, `SchoolRanking`

## Business Rules

- Cache TTL: list 5min, detail 1hr, metrics 24hr
- Search: alias matching + relevance scoring (alias > startsWith > contains + rank bonus)
- Provenance tracks source (MANUAL_ADMIN, COLLEGE_SCORECARD, etc.); admin updates overwrite
- Community ratings require min threshold to display publicly

## Gotchas

- `acceptanceRate`/`graduationRate` clamped via `clampPercentRate()` on every output
- `nameNorm` column for dedup (auto-set on create/update)
- Admin endpoints nested under `/schools/admin/*` within the same controller
