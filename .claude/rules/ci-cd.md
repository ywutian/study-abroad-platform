---
description: "CI/CD pipeline, Git conventions, and deployment rules"
globs: [".github/**", "*.sh", ".husky/**", "scripts/**"]
---

# CI/CD & Git Rules

## GitHub Actions

- `ci.yml` (push/PR): detect-changes -> lint/typecheck/test/e2e/security (parallel) -> build -> docker/deploy-gcp
  - Affected-only via `dorny/paths-filter`; push to main runs all
  - Security: Trivy (CVE) + gitleaks (secrets) + Semgrep (SAST) + pnpm audit
  - Migration safety: `check-migration-safety.ts` in E2E job
- `deploy-staging.yml` (auto on develop): Staging with reduced resources
- `preview.yml` (PR): API preview via Cloud Run tagged revision (`--no-traffic --tag=pr-{N}`)
- `preview-cleanup.yml` (PR close): Remove traffic tag

## Commit Convention (commitlint)

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

## Git Hooks (Husky)

### Pre-commit (~5-10s)
1. Prettier + ESLint on staged `.ts/.tsx`
2. gitleaks secret scan (if installed)
3. i18n checks (when `apps/web/src/` changed)
4. Frontend quality checks (15 rules, when `apps/web/src/` changed)
5. Backend quality checks (12 rules, when `apps/api/src/` changed)

### Pre-push (~20-50s)
1. Prisma generate (ensures client matches schema)
2. Smart verification gate (`verify-gate.ts`) — typecheck, tests, lint:routes, lint:i18n
3. Root guardrails (`lint:coverage-ratchet` + `lint:audit-gate` + `lint:deploy-drift`)
4. Migration safety (conditional — only if `prisma/migrations/` changed)
5. Dependency audit (`pnpm audit --audit-level=high`)

## CI <-> Local Check Mapping

| CI Job | Local Command | Common Failures |
|--------|---------------|----------------|
| Lint | pre-commit + `pnpm lint:all` | i18n wrong-language, missing dark: variants |
| Type Check | pre-push + `tsc --noEmit` | Missing Prisma generate, wrong enum types |
| Unit Tests | pre-push + `pnpm test` | Missing mock models, Zustand selector mock |
| E2E Tests | `pnpm test:e2e` | Renamed routes not updated in e2e specs |
| Secret Scan | pre-commit (gitleaks) | Accidental API keys |
| Migration Safety | pre-push | NOT NULL without DEFAULT |
| Route Check | pre-push + `pnpm lint:routes` | Client path not matching `@Controller()` |

## Quick Check Commands

```bash
pnpm lint:all              # ESLint + quality + i18n + routes + integration
pnpm lint:routes           # API route consistency
pnpm lint:integration      # Cross-layer (18 rules)
pnpm prepush               # Typecheck + tests (same as hook)
pnpm check                 # lint:all + test (full CI equiv)
pnpm lint:dead-code        # Knip unused files/exports/deps
npx tsx scripts/verify-gate.ts --staged  # Per-commit verification
npx tsx scripts/check-migration-safety.ts --new-only  # Migration check
```

## Deep Dive

- Troubleshooting guide: `docs/TROUBLESHOOTING.md`
- Deployment strategy: `docs/DEPLOYMENT_STRATEGY.md`
