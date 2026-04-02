# Release Gate Package: prereq-regression-demo

- registry_version: `2026-04-01.v3`
- impact_mapping_version: `2026-04-01.v1`
- environment: `pre-release`
- candidate_version: `demo-2026.04.01`

## Files

- `impact-set.json` / `impact-set.md`
- `release-gate-master.md`
- `codex-run-plan.md`
- `codex-run-config.json`
- `run-codex-audit.sh`
- `codex-runtime-result.json` / `codex-runtime-result.md` (after run)
- `human-handoff.md` (after run)
- `user-journey-audit-section.md` (after run)
- `human-task-cards/`
- gate package 会自动渲染 journey-level external prerequisites / capability gates

- gate journeys: `A1`, `A2`, `A3`, `A10`, `A11`, `C1`, `SJ-2`, `SJ-4`, `SJ-3`
- human review journeys: `A2`, `A3`, `A10`, `A11`, `SJ-2`, `SJ-3`
- suggested codex command: `pnpm exec tsx scripts/runtime-release-gate.ts --config "/Users/yitianwu/Documents/study-abroad-platform/e2e-report/releases/prereq-regression-demo/codex-run-config.json"`
