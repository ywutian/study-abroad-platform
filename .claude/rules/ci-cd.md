---
description: 'CI/CD pipeline, Git conventions, and deployment rules'
globs: ['.github/**', '*.sh', '.husky/**', 'scripts/**']
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
5. Dependency audit — `scripts/check-dependency-audit.ts` (osv-scanner reads the lockfile
   directly). **Not `pnpm audit`** — don't use `pnpm audit` output to predict whether the gate
   passes. Fix via the narrowest possible root `pnpm.overrides`; see `docs/SECURITY_DEPS.md`

## CI <-> Local Check Mapping

| CI Job           | Local Command                 | Common Failures                                                                                        |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Lint             | pre-commit + `pnpm lint:all`  | i18n wrong-language, missing dark: variants. ⚠️ **`lint:all` writes to your working tree** — see below |
| Type Check       | pre-push + `tsc --noEmit`     | Missing Prisma generate, wrong enum types                                                              |
| Unit Tests       | pre-push + `pnpm test`        | Missing mock models, Zustand selector mock                                                             |
| E2E Tests        | `pnpm test:e2e`               | Renamed routes not updated in e2e specs                                                                |
| Secret Scan      | pre-commit (gitleaks)         | Accidental API keys                                                                                    |
| Migration Safety | pre-push                      | NOT NULL without DEFAULT                                                                               |
| Route Check      | pre-push + `pnpm lint:routes` | Client path not matching `@Controller()`                                                               |

### ⚠️ `pnpm lint` mutates your working tree

api's lint is `eslint --fix`. Two consequences:

1. **Look at `git status` before and after** running `lint` / `lint:all` / `check`. It edits files.
   Staging "everything that changed" after a lint run is how unrelated churn ends up in a PR.
2. It needs a **generated Prisma client**. `pnpm install` does not create one. Without it,
   `@typescript-eslint`'s type-aware rules see degraded types and `no-unnecessary-type-assertion`
   strips assertions that are actually required (`{} as Record<string, number>` → `{}`).
   Measured on a clean checkout: **41 → 111 typecheck errors, 31 files silently corrupted.**
   Guarded now by `turbo.json` (`lint: dependsOn: ["db:generate"]`) and a `prisma generate` step
   in CI's lint job — CI calls `pnpm --filter api lint` **directly, bypassing turbo**, so the
   turbo declaration alone does not cover it.

**Why CI never went red on this**: `Lint` and `Type Check` are separate jobs with separate fresh
checkouts. The tree Lint corrupts is thrown away before anything typechecks it.

⇒ **Generalisation: any check that runs with `--fix` or otherwise writes files needs an answer to
"who verifies what it wrote?" CI job isolation hides working-tree pollution by construction.**

## Adding a root-level static route (`/theme.css`, `/sw.js`, `/robots.txt` …)

`proxy.ts` locale-redirects anything its matcher matches. A root asset that gets 307'd to
`/{locale}/asset` 404s — that is the 2026-06 service-worker pinning incident. **Three places, all
required:**

1. `apps/web/src/proxy.ts` — add the path (or its extension) to the matcher's negative lookahead
2. `apps/web/src/proxy.matcher.test.ts` — add it to the "does NOT match" list.
   List the **pathname only**; Next matches on pathname, so a `?v=hash` suffix would break the
   test's literal-regex model
3. `.github/workflows/ci.yml` → step **"Assert root public assets bypass proxy"** — a hardcoded
   path list that runs against the real server. The unit test guards the regex; this guards reality

**Assert the content-type, not just the status.** A 307 to `/{locale}/asset` still answers **200**
with an HTML body, so a status-only check passes while the asset is broken.

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
