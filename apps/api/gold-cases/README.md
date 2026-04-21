# Application Analysis Gold Cases

This directory stores deterministic governance fixtures for application-analysis replay.

## Layout

- `cases/*.json`: repo-managed gold case contracts and synthetic snapshots
- `schema.ts`: shared TypeScript contracts for replay scripts
- `../scripts/generate-application-analysis-gold-cases.ts`: regenerates the committed 50-case corpus
- `../../packages/shared/src/fixtures/application-analysis-render.data.ts`: generated render fixtures used by web/mobile parity suites
- `reports/`: generated replay reports (created on demand, not committed)

## Hybrid Model

- Most cases are synthetic and committed as JSON.
- Real de-identified fixtures should use `profileSnapshotRef` and be resolved by a private fixture loader outside git.

## Current Scope

The committed corpus is the canonical governance baseline for application-analysis:

- `50` repo-managed deterministic cases
- `10` `render-smoke` fixtures used by PR-blocking web/mobile parity
- `5` `nightly-live` cases used by fixed nightly live replay
- Coverage for `ready`, `noTargetSchools`, `noPredictions`, `insufficientProfileData`
- Coverage for `BLIND`, `OPTIONAL`, `REQUIRED`, and `UNKNOWN` testing policy outputs

Regenerate the corpus with:

```bash
pnpm --filter api gold:generate
pnpm --filter api gold:fixtures
```

Avoid hand-editing large batches of JSON cases unless the product contract has changed and the generator has been updated accordingly.

## Tags

- `deterministic`: included in the PR-blocking deterministic replay corpus
- `render-smoke`: included in the PR-blocking web/mobile parity suites
- `nightly-live`: included in the fixed nightly live sample
