# 0019 Testing Policy As First-Class School Data

Date: 2026-04-20

## Context

The 2026-04-19 governance audit showed that school testing policy was implemented as a fallback heuristic instead of a first-class fact:

- runtime code inferred `BLIND` for UC schools from a hardcoded name list
- most consumers still read `testOptional` directly
- school facts governance could detect drift, but not block it with a deterministic assertion

This made the system fragile in exactly the wrong place. We had override logic, but the source of truth still lived in ad hoc runtime code instead of the School domain model.

## Decision

We are promoting `School.testingPolicy` to the canonical testing-policy fact with the enum:

- `REQUIRED`
- `OPTIONAL`
- `BLIND`
- `UNKNOWN`

We keep `testOptional` for one compatibility cycle only. During that period:

- all new writes normalize both `testingPolicy` and legacy `testOptional`
- all new reads must prefer `testingPolicy`
- legacy `testOptional` is treated as a compatibility surface, not a source of truth

We also add deterministic governance protection:

- `verify-school-facts.ts` asserts known-good school facts against the database
- CI runs that script on every relevant PR
- UC campuses are hard-asserted as `BLIND`

## Consequences

Positive:

- runtime policy logic no longer depends on UC name heuristics
- school detail, analysis, recommendations, and agent tools all read from the same fact
- regressions become CI failures instead of audit findings

Costs:

- we temporarily maintain both `testingPolicy` and `testOptional`
- some nuanced real-world policies, such as test-flexible programs, are compressed into the current enum model and may need a future extension

## Migration Plan

1. Add `School.testingPolicy` to Prisma schema with a backfill from `testOptional`.
2. Hard override UC campuses to `BLIND`.
3. Update runtime consumers to read `testingPolicy`.
4. Keep `testOptional` as a derived compatibility field for one release cycle.
5. Remove `testOptional` after downstream consumers are fully migrated.

## Validation

- migration backfills existing rows and can be applied safely in staging/dev
- `verify-school-facts.ts` blocks policy regressions for UC, Ivy, MIT, and Stanford anchors
- application analysis and school tools regression tests assert `BLIND` for UC and preserve legacy compatibility behavior
