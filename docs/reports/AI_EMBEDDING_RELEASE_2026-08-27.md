# Embedding release closure — 2026-08-27

Status: implementation and targeted verification complete; production release pending.

## Scope

- Keep the existing OpenAI-compatible Embedding endpoint and `text-embedding-3-small`, 1536 dimensions.
- Do not change chat models, credentials, IAM, database schema, or historical vectors.
- Validate API/cache vectors, model identity in the response, complete batch index mapping, and float32 storage compatibility.
- Use provider/model/dimension/input-scoped `emb:v2:` cache keys; do not consume legacy entries.
- Bound fetch and body reads to 15 seconds per attempt, reject redirects, redact errors, preserve valid cache hits on partial failure.
- Redact memory/vector SQL diagnostics in the existing Prisma query logger, including parameter values; retain unrelated query diagnostics.
- Bind pgvector parameters as JSON array text, and atomically clear an obsolete vector when content changes but re-embedding fails.

## Acceptance and privacy

The existing production runner now requires `embedding_memory` in addition to its
previous scenarios. The ADMIN + AI_CONFIG endpoint is gated by both Harness and
acceptance flags. It accepts only two distinct, live synthetic accounts matching
the fixed Harness email pattern. It never accepts a provider URL, model, prompt,
or executable code from the caller.

Server-owned fixtures verify single/batch vectors, cache consistency, positive
semantic ordering, actual pgvector storage, paraphrase recall, tenant isolation,
FTS fallback, and fixture cleanup. The fallback uses a request-local missing-key
adapter with the existing memory implementation; it does not alter global state.
The runner separately cleans its second synthetic account. Every required
boolean is checked by the artifact validator; aggregate `pass=true` alone is
insufficient. Raw vectors, user IDs, content, credentials, and upstream responses
are excluded from evidence.

## Evidence so far

| Check                                                 | Result                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Existing endpoint, single synthetic input             | HTTP 200; 1 × 1536 valid values; 1622 ms                                                             |
| Existing endpoint, batch synthetic input              | HTTP 200; 2 × 1536 valid values; 944 ms                                                              |
| Real provider + temporary pgvector                    | All checks true; 11224 ms; fixture/account cleanup passed                                            |
| Real pgvector integration with deterministic provider | 2/2, including stale-vector clearing and cross-user update denial                                    |
| Targeted Embedding/Memory/Admin/runner tests          | 10 suites / 94 tests passed                                                                          |
| Strict acceptance artifact validator                  | 14/14 passed                                                                                         |
| Earlier AI Agent regression pass                      | 93 suites / 930 tests passed, before final extra negative controls                                   |
| Complete repository verification                      | `pnpm check` passed; API 343 suites / 4528 tests, all workspace test tasks passed; 36/36 gate proofs |
| CI helper scripts                                     | 76/76 passed                                                                                         |
| TypeScript                                            | Full API noEmit and build-project checks passed                                                      |
| PR/main CI and production acceptance                  | Not yet run                                                                                          |

Initial failures are retained: an incorrectly shaped parameterized test, a
Response mock type error, and an actual PostgreSQL `bigint[]` → `vector` cast
failure. The latter prompted the parameter-binding correction, not a weaker
fixture. A subsequent real-provider/database run passed.

Full regression also found an older chat/Embedding credential-isolation test
using an invalid two-dimensional response. Its fixture now satisfies the real
1536-dimensional model/index contract while preserving every credential and URL
isolation assertion. A test-only double cast was replaced with Nest dependency
injection to preserve the type-safety ratchet. Neither gate was weakened.

Final compatibility review retained the old failed-embedding update behavior:
importance is clamped to [0, 1] and an empty category leaves the existing category
unchanged, while clearing the stale vector atomically. Four new unit cases cover
importance boundaries; the real-database regression also asserts category and
importance. The targeted memory/acceptance run passed 19/19 tests.

## Release criteria

An additional real-provider probe measured positive cosine 0.4763 versus negative
0.1661; the positive vector component was 0.3334, above the product's default
combined-score threshold 0.3. Production acceptance uses that default threshold,
without lowering it for synthetic fixtures.

Use existing CI only: all checks → no-traffic revision → strict acceptance →
100% traffic → strict acceptance again → independent alert monitor → health,
Cron/Scheduler, backup/PITR, and retained rollback revision.

Pre-release production baseline is `study-abroad-api-01006-xev` at 100%; retain it
as this release's rollback target. No new production revision is claimed here.

## Limits

These are engineering and small synthetic retrieval checks, not a measurement
of real-user retrieval accuracy or school-admission prediction accuracy.
No model/provider switch or historical re-embedding is authorized by this work.

The parameterized vector representation and cosine-distance interpretation were
cross-checked against the [official pgvector storage/query documentation](https://github.com/pgvector/pgvector#storing).
