# AI Agent Harness Production Closure — 2026-08-24

**Last updated:** 2026-08-24  
**Scope:** OpenAI-compatible AI Agent Harness, declarative Skills, production acceptance, and recovery controls

## Contents

- [Outcome](#outcome)
- [Production acceptance](#production-acceptance)
- [Runtime and recovery evidence](#runtime-and-recovery-evidence)
- [Deterministic architecture benchmark](#deterministic-architecture-benchmark)
- [Verification inventory](#verification-inventory)
- [Deliberate exclusions](#deliberate-exclusions)
- [Durable sources](#durable-sources)

## Outcome

The existing ReWOO implementation was extended in place; no second Agent,
conversation, memory, or tool stack was introduced. Production runs the new
Harness at 100% traffic with the previous stable Cloud Run revision retained as
the rollback target.

| Item                | Evidence                                                                             |
| ------------------- | ------------------------------------------------------------------------------------ |
| Final merge         | `29afa93d293a3f15f1b1dd91d25338de99bec33d`                                           |
| Pull requests       | `#613` through `#619`                                                                |
| Production revision | `study-abroad-api-00973-xug`                                                         |
| Traffic             | 100% to the production revision; no 5%/25% traffic stages                            |
| Rollback revision   | `study-abroad-api-00965-sor`                                                         |
| Main CI             | GitHub Actions run `32795983013`, completed successfully                             |
| Provider            | `LLM_PROVIDER=openai`; OpenAI-compatible endpoint only                               |
| Harness flags       | Harness, approvals, context, acceptance, Skills, evolution, and auto-publish enabled |

The workflow first deployed a no-traffic validation revision, ran smoke and
Cron checks against that revision, then atomically moved production traffic to
100%. The historical `canary` tag is only a routing label; no user-traffic
canary stage was used.

## Production acceptance

The sanitized acceptance artifact used schema
`ai-agent-harness-acceptance-v1`. It contained no prompt, response, tool
argument, credential, conversation, memory, or personal-data body.

| Scenario                         | Result | Stable reason code                         |
| -------------------------------- | ------ | ------------------------------------------ |
| Declarative Skill boundary       | PASS   | `SKILL_BOUNDARY_AND_DEPLOYMENTS_CONFIRMED` |
| Skill version pinning            | PASS   | `RUN_SKILL_VERSION_IMMUTABLY_PINNED`       |
| Memory disabled boundary         | PASS   | `MEMORY_DISABLED_BOUNDARY_CONFIRMED`       |
| Context compression              | PASS   | `STRUCTURED_SUMMARY_PERSISTED`             |
| Compression failure fallback     | PASS   | `LAST_VALID_SUMMARY_RETAINED`              |
| Approval disconnect and recovery | PASS   | `APPROVED_SIDE_EFFECT_AT_MOST_ONCE`        |
| Budget exhaustion                | PASS   | `BUDGET_EXHAUSTION_TERMINAL`               |
| Synthetic cleanup                | PASS   | `SYNTHETIC_STATE_REMOVED`                  |

Additional assertions confirmed that all six Agent types had an active Skill,
safe declarative changes were accepted, permission expansion was rejected, the
historical public administrator credential was rejected, and auto-publish was
enabled. Cleanup deleted the synthetic Harness event, cleared the synthetic AI
state, and soft-deleted the disposable account. The independent alert monitor
then reported zero active critical, warning, or informational alerts.

## Runtime and recovery evidence

- API health: `ok`.
- PostgreSQL health: `ok`.
- Redis health: `ok`.
- Cron Registry: 33/33 jobs matched the source manifest.
- Cron driver: `http`, with zero in-process timers.
- Dispatcher: unauthenticated requests were rejected.
- Cloud Scheduler: 33 enabled jobs, zero paused jobs.
- Cloud SQL: PostgreSQL 15, `RUNNABLE`, automated backups enabled.
- Point-in-time recovery: enabled with seven days of transaction logs.
- Retained automated backups: seven; latest checked backup was successful.

The release gate verifies backup/PITR state read-only. It does not create a
restore target or restore production in place. A destructive restore drill
still requires the separate, explicitly approved procedure in
`docs/runbooks/cloud-sql-restore-drill.md`.

## Deterministic architecture benchmark

This benchmark is an eight-case, fixed synthetic architecture comparison. It
proves the intended Harness mechanisms execute; it is not evidence of real-user
answer quality or a statistically representative production experiment.

| Metric                    | Legacy ReWOO | Harness v1 |     Delta |
| ------------------------- | -----------: | ---------: | --------: |
| Passed cases              |          2/8 |        8/8 |  +6 cases |
| Task success rate         |          25% |       100% |    +75 pp |
| Tool precision            |       57.14% |       100% | +42.86 pp |
| Tool recall               |       19.05% |       100% | +80.95 pp |
| Refusal accuracy          |           0% |       100% |   +100 pp |
| Duplicate calls prevented |            0 |          1 |        +1 |
| Total modeled tokens      |        2,090 |      2,740 |      +650 |
| Modeled latency           |       196 ms |     316 ms |   +120 ms |

The Harness traded 650 modeled tokens and 120 ms of modeled latency for
supplemental planning, permission-aware refusal, unknown-tool fail-closed
behavior, distinct-argument calls, a 16-call budget, and cross-round duplicate
prevention.

## Verification inventory

- Complete AI Agent suite: 75 suites / 667 tests.
- Context-focused suites: 3 suites / 42 tests.
- Release-script tests: 24/24.
- Root gate proofs: 36/36.
- TypeScript, lint, formatting, API quality, file-size, `any`, integration,
  security, secret, SAST, dependency, SBOM, and deployment-drift checks passed.
- Main CI build, migration, no-traffic validation, direct promotion, production
  acceptance, Scheduler synchronization, and post-deploy checks passed.

## Deliberate exclusions

The release did not add Anthropic, product-facing file-system or Shell tools,
MCP, an additional Agent framework, or Bear Agent runtime/source data. Skills
remain declarative and cannot register code, expand permissions, alter the
central Tool Policy, or introduce credentials.

## Durable sources

This file is the immutable release receipt. Current architecture and operating
instructions live in:

- `docs/architecture/ai-system.md`
- `docs/AI_AGENT_SKILLS_EVOLUTION.md`
- `docs/runbooks/ai-agent-harness-acceptance.md`
- `docs/runbooks/cloud-sql-restore-drill.md`
- `docs/DEPLOY_CONFIG.md`
