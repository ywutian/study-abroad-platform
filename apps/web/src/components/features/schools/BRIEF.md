# Feature: Schools

## Purpose

School search, filtering, recommendation display, and school list management.

## Components

- AdvancedSchoolFilter — multi-criteria filter (rank, acceptance rate, location, etc.)
- FloatingAddButton — FAB for adding schools to user's list
- IndexIndicators — visual indicators for school ranking/index
- SchoolLogo — school logo with fallback
- SchoolRecommendation — displays AI school recommendations (reach/target/safety tiers)

## Data Flow

- API: `GET /schools`, `GET /recommendations`
- Types: SchoolInfo, RecommendationItem, RecommendationResponse (local types file)
- Recommendations include probability, highlights, recommended majors, summer programs

## Patterns

- `school-display-utils.ts` — formatting helpers for ranks, rates, names (with tests)
- `school-filters.ts` — filter logic extracted from UI (with tests)
- Reach/target/safety tier categorization aligns with prediction feature
