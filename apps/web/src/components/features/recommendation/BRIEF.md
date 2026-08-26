# Feature: Recommendation

## Purpose

AI recommendation result display components. Admission probability and tier are rendered from the Counselor Engine contract; historical individual Case comparisons are not part of this feature.

## Patterns

- Components consume `RecommendedSchool` from `@study-abroad/shared`.
- Do not add historical individual Case comparisons to recommendation cards.
- Recommendation-origin actions carry recommendationId so backend metrics remain attributable.
