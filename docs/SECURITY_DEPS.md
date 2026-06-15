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

## When an override genuinely can't be applied (`auditConfig.ignoreGhsas`)

Last resort, **not** a substitute for an override. Only when ALL of:

- the advisory is **not exploitable in our usage** (e.g. a dev-server-only or
  Windows-only flaw in a dep we only use at build/test time), AND
- a `pnpm.overrides` pin **does not take effect** (a real pnpm resolution bug —
  prove it: range + exact + `--force` all leave the vulnerable version resolved).

Then ignore the single GHSA in `pnpm.auditConfig.ignoreGhsas` (NOT `ignoreCves`,
NOT a `--audit-level` relaxation — the CI gate stays hard for every other high;
`check-audit-gate.ts` still passes because it guards the gate command, not this
list). Each entry MUST be documented here with the reason + a removal trigger.

| GHSA                  | Package        | Why ignored                                                                                                                                                                                                                                                                                                                    | Remove when                                                                                                                                                      |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GHSA-fx2h-pf6j-xcff` | `vite` (8.0.x) | Windows-only `server.fs.deny` **dev-server** bypass. `vite` here is a **test-only** transitive of `vitest`/`@vitejs/plugin-react`; the vite dev server is never run (web app builds with Next.js). pnpm 10.22 won't apply a `vite` override to this peer-contextualized transitive (range + exact + `--force` all keep 8.0.8). | `vitest`/`@vitejs/plugin-react` bump their `vite` to ≥8.0.16, or pnpm fixes the override resolution — then drop this entry and confirm `pnpm audit` stays green. |

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
