# Dependency Security

How we keep third-party CVEs out — so high-severity advisories don't get patched
ad-hoc, over and over. Dependency security is **ongoing maintenance**, not a
one-time fix; the goal here is a consistent, enforced _process_.

## The gate (enforced)

- **Not `pnpm audit` anymore.** npmjs.org retired the classic audit REST
  endpoints (`/-/npm/v1/security/audits{,/quick}` → 410, "use the bulk
  advisory endpoint instead"). pnpm's fix for this lives in v11
  (pnpm/pnpm#11268), but v11 requires Node ≥22.13 — this repo pins Node 20.x
  deliberately (see `docs/ANTI_CHURN_PLAYBOOK.md`), so we didn't chase that
  major bump just to unbreak an audit command.
- **`scripts/check-dependency-audit.ts`** runs instead: `osv-scanner` (Google's
  OSV.dev-backed scanner) reads `pnpm-lock.yaml` directly — no npm registry
  API involved at all — and the script fails on any unignored HIGH/CRITICAL
  finding. Both **CI** (`.github/workflows/ci.yml`, after a pinned-binary
  `osv-scanner` install) **and pre-push** run this script and hard-fail
  (`|| exit 1`) — this is the line of defense that must never be softened,
  in either place.
- **`check-audit-gate.ts`** (`pnpm lint:audit-gate`, in `lint:all`) asserts the
  gate stays hard on both layers: the CI step isn't softened (no `|| true`, no
  `continue-on-error: true`), and `check-dependency-audit.ts` itself hasn't been
  quietly edited to drop the HIGH/CRITICAL check or its exit code. It protects
  the gate, not the deps.

## Lockfile-unchanged is not "no new CVE"

A HIGH advisory can land against a version we already resolved. `pnpm-lock.yaml`
does not have to change for the tree to become vulnerable. Push/PR CI only
runs when someone pushes, and this default branch has gone days without a
push.

`.github/workflows/osv-audit-scheduled.yml` runs the **same**
`tsx scripts/check-dependency-audit.ts` on a daily cron (`workflow_dispatch`
as well). It must not use `continue-on-error`, `|| true`, or `pnpm audit`.
The first cron firing is not part of merge-time DoD; the YAML + script path

- hard fail is.

## A clean lockfile is not a clean image

The gates above read `pnpm-lock.yaml`. CI's `Docker Build` job runs Trivy against
the **built API image**, which is a different artifact and can contain packages
the lockfile never resolved.

`apps/api/Dockerfile` builds it with `pnpm deploy --legacy`, and that links the
**workspace root's `dependencies`** into the deployed app. Seven frontend
packages living in the root therefore shipped inside the NestJS image;
`@sentry/nextjs` peer-depends on `next`, which vendors its own copies of `tar`
and `brace-expansion` under `dist/compiled/`. Trivy flagged CRITICAL/HIGH CVEs
in code the API can never load, and no `pnpm.overrides` could reach them —
they are pre-bundled inside the `next` package. Removing the root deps took the
image's `node_modules` from 972 MB to 466 MB and cleared all three findings.

`pnpm lint:dep-pins` now fails if the root declares any runtime `dependencies`
(and if `pnpm.overrides` grows duplicate keys, which a merge can introduce
silently — JSON keeps the last one, so the effective pin follows line order).
When a Trivy image finding names a package that is not in the lockfile at that
version, look for a vendored copy inside some dependency's `dist/compiled/`
before reaching for an ignore entry.

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
3. Re-run `pnpm install` + `tsx scripts/check-dependency-audit.ts` until clean
   (requires `osv-scanner` on PATH — `brew install osv-scanner` locally).
4. Add a brief comment on the override if the reason isn't obvious.

Current runtime floor includes `urllib@<=2.44.0 → 2.44.1` for
`GHSA-hq3h-g68c-hp78`; `ali-oss` is the transitive consumer. The patched release
stops credential-bearing request headers from crossing origins on redirects.

## When an override genuinely can't be applied (`auditConfig.ignoreGhsas`)

Last resort, **not** a substitute for an override. Only when ALL of:

- the advisory is **not exploitable in our usage** (e.g. a dev-server-only or
  Windows-only flaw in a dep we only use at build/test time), AND
- a `pnpm.overrides` pin **cannot be applied**. Two ways that happens:
  - it **does not take effect** (a real pnpm resolution bug — prove it: range +
    exact + `--force` all leave the vulnerable version resolved), or
  - it takes effect and **provably breaks consumers**, with no patched release
    on the affected major line. Prove this one too: paste the failure, don't
    assert it. `verify-gate` does not run `lint:api|web|mobile`, so a toolchain
    break can pass every check you thought to run and still fail at pre-push.

Then ignore the single GHSA in `pnpm.auditConfig.ignoreGhsas` (NOT `ignoreCves`,
NOT a `--audit-level` relaxation — the CI gate stays hard for every other high;
`check-audit-gate.ts` still passes because it guards the gate command, not this
list). Each entry MUST be documented here with the reason + a removal trigger.

**Two scanners read the lockfile, so an exemption needs TWO entries.** CI's
`Security Scan` job runs **Trivy** (`trivy fs .`) over `pnpm-lock.yaml` as well,
and Trivy does not read `pnpm.auditConfig` — it reads **`.trivyignore`**, keyed
by **CVE id**, not GHSA. An exemption recorded in only one place leaves the
other job red, which reads as "the fix didn't work" rather than "the exemption
is half-registered". Add both, cross-reference them in the comment, and remove
them together. (`brace-expansion` is the worked example: `GHSA-mh99-v99m-4gvg`
in `ignoreGhsas`, `CVE-2026-14257` in `.trivyignore`.)

| GHSA                                         | Package                           | Why ignored                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Remove when                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GHSA-fx2h-pf6j-xcff`                        | `vite` (8.0.x)                    | Windows-only `server.fs.deny` **dev-server** bypass. `vite` here is a **test-only** transitive of `vitest`/`@vitejs/plugin-react`; the vite dev server is never run (web app builds with Next.js). pnpm 10.22 won't apply a `vite` override to this peer-contextualized transitive (range + exact + `--force` all keep 8.0.8).                                                                                                                                                                                                                                                                                                              | `vitest`/`@vitejs/plugin-react` bump their `vite` to ≥8.0.16, or pnpm fixes the override resolution — then drop this entry and confirm `tsx scripts/check-dependency-audit.ts` stays green.                                                                                                                                                             |
| `GHSA-5p2g-fcmc-qvqq`, `GHSA-w3rx-r6r6-pgpr` | `image-size` (1.2.1)              | Infinite loops in the JXL/HEIF and ICNS parsers (DoS). **No fixed release exists on any line**: both advisories are `introduced: 0 … last_affected: 2.0.2`, and 2.0.2 is what npm serves as `latest` (`legacy` is our 1.2.1) — so an override has nothing to point at. Sole consumer is `metro@0.83.3`, the React Native bundler: it reads image dimensions from the repo's own asset files at **build** time, and never runs in a deployed service. The malicious-image input this needs does not exist on that path.                                                                                                                      | image-size publishes a release above 2.0.2 — then pin `image-size` to it, drop both entries, and confirm `tsx scripts/check-dependency-audit.ts` stays green.                                                                                                                                                                                           |
| `GHSA-mh99-v99m-4gvg`                        | `brace-expansion` (1.1.16, 2.1.2) | DoS via unbounded brace expansion (OOM). **No patched release exists on either line** — 1.1.16 and 2.1.2 are the newest 1.x/2.x publishes; the fix ships only in 5.0.8. Forcing everything to `>=5.0.8` resolves cleanly and then **breaks the toolchain**: 5.x drops the callable CJS default export, so `minimatch@3.1.5` (under eslint 9) throws `TypeError: expand is not a function` during glob expansion and all three `lint:*` scripts die. 1.x/2.x arrive only via `minimatch@3`/`minimatch@9`, whose patterns come from our own configs — never attacker input — so the DoS is not reachable. 5.x consumers stay pinned to 5.0.8. | `minimatch@3`/`@9` consumers (eslint 9's internals, `@sentry/node`) move to `minimatch@10+`, which uses `@isaacs/brace-expansion` (already overridden ≥5.0.1) — or 1.x/2.x get a backport. Then drop this entry, remove the `brace-expansion@^1`/`@^2` overrides, and confirm both `check-dependency-audit.ts` AND `pnpm --filter api lint` stay green. |
| `GHSA-jmr9-qjv8-65gv`                        | `extract-zip` (2.0.1)             | Symlink-target path traversal. GitHub lists every published version (`<=2.0.1`) as affected and no patched release. The only consumer is Puppeteer's browser installer; it downloads vendor-controlled browser archives during local/CI setup and is not present in the API production image or exposed to user-supplied ZIP files.                                                                                                                                                                                                                                                                                                         | `extract-zip` publishes a patched release, or Puppeteer replaces it. Then pin/upgrade, remove this GHSA and `CVE-2026-56876` from `.trivyignore`, and confirm both dependency scanners stay green.                                                                                                                                                      |

## Version pinning (One-Version Rule)

Beyond CVE fixes, some packages cause **version thrash** — weeks of flip-flopping
on which major to allow (the `zod` 3-vs-4 saga: #111 → #419 → #424 → #434). Two
majors of one package resolvable at once is a _diamond dependency_. The decision
for contested packages is recorded in
[ADR-0021](adr/0021-dependency-version-pinning.md) and enforced by
**`pnpm lint:dep-pins`** (`scripts/check-dep-pins.ts`, in `lint:all` + pre-push):

- `zod` — app on **3** (`"zod": "3.25.76"`); **4** allowed _only_ as knip's
  isolated dev dependency (`"knip>zod"`). A third major, or an app-level bump,
  fails the guard with an actionable message.
- To change a pin: edit `scripts/check-dep-pins.ts` **and** ADR-0021 in the same
  PR. The lockfile is downstream of a recorded decision, not the source of truth.
- Every external GitHub Action is also fixed to an immutable 40-character commit
  SHA. Floating tags and branches fail the same gate; the readable release label
  is kept in a YAML comment beside the SHA.

Do **not** "clean up" the lockfile with a blanket `pnpm dedupe` — it's a large,
risky resolution change (the "passes CI, fails on Vercel" class). Guard the
contested packages, not the whole tree.

## Dependabot

`.github/dependabot.yml` opens weekly npm + GitHub-Actions update PRs. **Major
bumps are intentionally ignored** (they need manual migration). When a high CVE
only has a fix in a major version, handle it manually: upgrade + migrate in a
dedicated PR, or apply a scoped override as a stopgap and open a follow-up.

## Production image provenance

The production workflow reads the pushed Artifact Registry image digest,
generates a keyless GitHub build-provenance attestation, and immediately verifies
the repository, signer workflow, source commit, and digest. Database migrations
and Cloud Run deployment then use `IMAGE@sha256:...`, never the mutable short-SHA
or `latest` tag. A missing or mismatched attestation fails before a new Revision
is created. This complements the CycloneDX SBOM and Trivy image scan: the SBOM
describes contents, while signed provenance binds the deployed bytes to the
reviewed source and workflow.

## Moderate / low

Tracked, not gated (gating them would flap as new advisories publish). Sweep them
periodically during dependency upgrades; don't let the moderate count grow
unbounded.

## Rule of thumb

A high CVE is never "fixed" by silencing the gate. Patch the dep (or override it)
and keep the gate hard — `check-audit-gate.ts` makes sure it stays that way.
