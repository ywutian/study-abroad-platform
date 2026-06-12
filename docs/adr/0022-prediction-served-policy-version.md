# ADR-0022: Served Policy Version Tracks the Counselor Engine, Not the DB Active Row

- Status: accepted
- Date: 2026-06-12
- Decision-makers: Engineering
- Tags: prediction, policy-version, lineage, served-path, regression
- Related: [ADR-0020 No Per-Sample Calibration](0020-prediction-no-sample-calibration.md)
- See also: [docs/PREDICTION_SYSTEM.md](../PREDICTION_SYSTEM.md)

## Context

The served prediction path is counselor-only: the ML/v5 path (`prediction-ml-primary`, champion/shadow models) was deleted 2026-05-07. The deterministic counselor engine (`counselor-engine.service.ts`, `COUNSELOR_RULE_VERSION`) is the sole source of every served probability.

However, the public field `servedPolicyVersionId` — stamped on every prediction and visible on the predict / dashboard / history API — was derived from the database: `resolveServedPolicyVersionId()` returned the `id` of whatever `PredictionPolicyVersion` row carried `status = 'ACTIVE'`.

A 2026-04-23 ML-era row named `v5-ml-primary`, hand-written into the DB via the admin API, was left `ACTIVE` after the ML code was deleted. No seed or migration creates it. As a result every counselor prediction was stamped with a dead ML policy name that directly contradicted the documented counselor-only served path.

The regression hid for ~3 weeks. Two systemic gaps let it stay silent:

1. **Persistence swallowed failures.** The served label is also the FK `PredictionResult.policyVersionId`, and persistence enforces lineage integrity (it refuses to persist a non-existent policy id). When the label pointed at a row that did not exist, the write was rejected — but logged-and-returned, never reported. The drop only surfaced when an end-to-end test found the dashboard empty.
2. **The end-to-end smoke checked presence, not value.** A stale-but-present `v5-ml-primary` sailed through `if (!servedPolicyVersionId)`.

## Decision

**The served policy version is an engine identity, not mutable database state. `servedPolicyVersionId` equals the counselor engine's own `COUNSELOR_RULE_VERSION`, decoupled from the DB ACTIVE row.**

1. **`resolveServedPolicyVersionId()` returns `COUNSELOR_RULE_VERSION`** (a code constant), not a DB query. The label is structurally incapable of drifting from the engine that produced the prediction; an engine version bump carries the label along automatically.

2. **Persistence self-heals the lineage.** Because the label is also the FK, `PredictionPersistenceService.ensureCounselorPolicyVersion()` upserts the matching `PredictionPolicyVersion` row (ACTIVE) the first time a counselor prediction is saved — mirroring the existing `ensureLegacyPolicyVersion` pattern. Zero manual migration; fresh DBs and production stay self-consistent.

3. **A canonical-policy approach (Method A) was rejected.** Activating a hand-seeded counselor policy via the admin lifecycle is not viable: `activatePolicy()` requires `status === 'SHADOW'` and passage of a shadow-metrics promotion gate, and the deterministic counselor engine produces no shadow metrics. Forcing it would require a migration that writes ACTIVE directly — re-creating exactly the hand-written dirty-data situation that caused `v5-ml-primary`.

4. **The `PredictionPolicyVersion` table and its admin/shadow/workflow tooling are retained** as historical audit and scaffolding for any future policy-driven serving experiments. They simply no longer drive the served label.

5. **The systemic gaps are closed, not just the bug:**
   - Swallowed persistence failures now report to Sentry (`area`/`reason` tags) so they page instead of dying in a log.
   - The stability smoke asserts the served-label _value_ (`assertCounselorPolicy`: must track the counselor engine, never a dead `ml-primary`/`v5`/`v3` label), so a drift red-fails the CI Prediction Gate.
   - Guard unit tests pin `resolver === COUNSELOR_RULE_VERSION` and the persistence self-heal.

## Consequences

### Positive

- **The served label can never again drift from the served engine** — it is a code constant, validated by both a unit guard and an end-to-end CI guard.
- **Zero data migration for the core fix.** Decoupling is pure code; production gets a correct label immediately, regardless of any stale ACTIVE row.
- **An entire class of silent persistence drops is now visible/alertable**, not just this one bug.

### Negative

- **`servedPolicyVersionId` and the DB `policyVersionId` are the same constant for all served predictions** — the field no longer distinguishes between multiple concurrently-served policies. Correct for a counselor-only world, but must be revisited if true multi-policy serving (A/B) is reintroduced.
- **`ensureCounselorPolicyVersion` upserts on the hot persistence path** (idempotent, keyed by primary key — negligible cost, but it is a write on every save).

### Neutral

- Historical predictions persisted before this decision retained their old `policyVersionId`; a one-time data migration (PR #386) retires `v5-ml-primary` and scrubs the dead label from historical rows to NULL.
- The PolicyVersion lifecycle (create → candidate → shadow → activate → rollback) is untouched; it is dormant under counselor-only serving.

## Implementation Notes

Shipped across three PRs:

- **#385** — `resolveServedPolicyVersionId()` returns `COUNSELOR_RULE_VERSION`; `ensureCounselorPolicyVersion()` self-heal; guard tests; DTO/snapshot label fixes.
- **#386** — idempotent data migration: retire `v5-ml-primary`, scrub historical lineage to NULL.
- **#387** — enterprise guards: persistence failures report to Sentry; smoke asserts the served-label value.

Backlog (not blocking; deliberately deferred — lower ROI given the guards above):

- **Architecture lint rule** forbidding a DB-derived served label. Overlaps heavily with the resolver guard test; a narrow grep/AST rule risks false positives for marginal coverage of "someone adds a new DB-derived point elsewhere."
- **Prometheus metric** for `servedPolicyVersionId` distribution + persist-failure rate. Sentry already covers failure visibility/alerting; the prometheus service lives in `ai-agent/infrastructure/observability` and wiring it into `prediction` would cross a module boundary. Revisit if/when prediction gets first-class metrics.
