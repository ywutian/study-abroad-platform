# Dependency Security

How we keep third-party CVEs out — so high-severity advisories don't get patched
ad-hoc, over and over. Dependency security is **ongoing maintenance**, not a
one-time fix; the goal here is a consistent, enforced _process_.

## The gate (enforced)

- **CI hard-fails on high** — `.github/workflows/ci.yml` runs
  `pnpm audit --audit-level=high`. A `high`/`critical` advisory in the tree
  fails the build. This is the line of defense that must never be softened.
- **`check-audit-gate.ts`** (`pnpm lint:audit-gate`, in `lint:all`) asserts that
  CI audit step stays hard — no `|| true`, no `continue-on-error: true`, no
  relaxed `--audit-level`. It protects the gate, not the deps.
- **Pre-push** runs `pnpm audit` as a _warning_ (heads-up, non-blocking — a newly
  published advisory on an existing dep shouldn't block an unrelated push). CI is
  the hard gate.

## Fixing a high/critical advisory

1. Prefer a real upgrade: bump the offending package (or its parent) to a patched
   version.
2. If the fix is only in a transitive dep you don't control, pin it via
   **`pnpm.overrides`** in the root `package.json`. Use the narrowest range that
   covers the vulnerable versions, e.g.:
   ```jsonc
   "overrides": {
     "undici@>=7.0.0 <7.24.0": ">=7.24.0 <8",   // range-scoped
     "tar": ">=7.5.10"                              // floor
   }
   ```
3. Re-run `pnpm install` + `pnpm audit --audit-level=high` until clean.
4. Add a brief comment on the override if the reason isn't obvious.

## Dependabot

`.github/dependabot.yml` opens weekly npm + GitHub-Actions update PRs. **Major
bumps are intentionally ignored** (they need manual migration). When a high CVE
only has a fix in a major version, handle it manually: upgrade + migrate in a
dedicated PR, or apply a scoped override as a stopgap and open a follow-up.

## Moderate / low

Tracked, not gated (gating them would flap as new advisories publish). Sweep them
periodically during dependency upgrades; don't let the moderate count grow
unbounded.

## Rule of thumb

A high CVE is never "fixed" by silencing the gate. Patch the dep (or override it)
and keep the gate hard — `check-audit-gate.ts` makes sure it stays that way.
