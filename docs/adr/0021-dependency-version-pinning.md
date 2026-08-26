# ADR-0021: Dependency Version Pinning & Build-Environment Parity (One-Version Rule)

- Status: accepted
- Date: 2026-06-21
- Decision-makers: Product owner
- Tags: deps, build, ci, governance, anti-churn

## Context

A cluster of commits over ~6 weeks kept re-fixing the same dependency/build
problem, flip-flopping on a decision instead of converging:

- `zod` was pinned to **3** to fix a Vercel build type error (#111), then knip
  crashed on `zod/mini` so the dead-code gate was restored (#419), then knip was
  pinned to v5 specifically to **purge zod 4 from the lockfile** (#424), then zod
  4 was **allowed back** as an isolated knip dependency (#434). The HEAD commit
  before this ADR was _still_ removing a redundant, env-divergent Vercel
  type-check.

Two versions of one package resolvable at once is a **diamond dependency** — the
exact failure mode Google's _One-Version Rule_ describes: "if there are two
versions present, eventually someone will try to build a project that depends on
both… and will select a random one at runtime."
(<https://opensource.google/documentation/reference/thirdparty/oneversion>,
[SWE at Google ch.21](https://abseil.io/resources/swe-book/html/ch21.html).)

A second, related root cause: **build-environment divergence**. `pnpm`'s
`--frozen-lockfile` is the default in CI but **not** locally, so a local
`pnpm install` can silently mutate `pnpm-lock.yaml`; the drift only surfaces when
Vercel/CI rejects it. And `engines.node` was a loose `">=20"` while every real
environment (CI `NODE_VERSION=20`, `node:20-alpine` Docker images, local Node 20)
runs Node 20 — leaving Vercel free to build on a _different_ major within the
range.

This back-and-forth was never a hard technical problem. It was an
**unrecorded decision** that got relitigated each time someone hit a symptom.
This ADR records the decision and its invariants so it stops recurring. See also
`docs/ANTI_CHURN_PLAYBOOK.md`.

## Decision

1. **One-Version Rule for contested packages.** A package that has caused
   version thrash gets exactly one _intended_ set of major versions, encoded in
   `pnpm.overrides` and enforced by `pnpm lint:dep-pins`
   (`scripts/check-dep-pins.ts`, in `lint:all` + pre-push).

2. **`zod` is deliberately split, and that split is locked:**
   - The app and all runtime/test code use **zod 3** (`"zod": "3.25.76"` override).
   - **zod 4** is allowed **only** as knip's isolated dev-tool dependency
     (`"knip>zod": "^4.1.11"`). knip never touches app runtime, so the two majors
     never meet in a shipped artifact.
   - This is a settled trade-off. **Do not** add a third zod major, and **do not**
     migrate the app to zod 4, without superseding this ADR. ("Disagree and
     commit": challenge with data _before_ the decision; once recorded, don't
     pick at it without new evidence — e.g. a deliberate, whole-app zod 4
     migration.)

3. **Node is pinned to the 20 line everywhere.** `engines.node: "20.x"` in the
   root, `apps/web`, and `apps/api` `package.json`; `.nvmrc` = `20` for local
   parity; `node:20-alpine` in Docker; `NODE_VERSION: '20'` in CI. `apps/web`
   carries its own `engines` because Vercel reads the web project's
   `package.json`, not the monorepo root.

4. **The lockfile is verified frozen in every environment**, including locally.
   Pre-push runs `pnpm install --frozen-lockfile` (Step 0) so a drifted lockfile
   fails _before_ the push, the same way CI and Vercel fail.

5. **GitHub Actions use immutable commits.** Every external `uses:` reference
   is pinned to a 40-character commit SHA; the release label remains as a YAML
   comment for review context. `pnpm lint:dep-pins` scans every workflow and
   rejects branches, tags, and floating refs such as `master`. Dependabot may
   propose SHA updates, but a release workflow never changes upstream code
   without a repository commit and review.

6. **No blanket `pnpm dedupe`.** The lockfile currently has ~30 dedup-able
   transitive duplicates. Running `pnpm dedupe` to "clean" them is itself a large,
   risky resolution change — precisely the kind of broad dependency churn that
   causes "passes CI, fails on Vercel." We guard the _contested_ packages
   (`lint:dep-pins`), not the whole tree. A blanket dedupe, if ever wanted, is its
   own scoped, separately-reviewed PR — never bundled into unrelated work.

## Consequences

- **Positive** — the zod decision is recorded once and enforced fail-closed; a
  new zod major (or an accidental app-level bump) fails `lint:dep-pins` with an
  actionable message instead of silently re-resolving and breaking a deploy weeks
  later.
- **Positive** — local == CI == Vercel == Docker on Node 20 and on lockfile
  state. The "passes locally, fails on Vercel" class is closed at the pre-push
  boundary.
- **Positive** — third-party workflow code is immutable for a given repository
  commit, including image scanners and deployment authentication actions.
- **Neutral** — a legitimate version change now requires editing
  `scripts/check-dep-pins.ts` _and_ this ADR in the same PR. That friction is the
  point: version changes become explicit and reviewed.
- **Negative** — `lint:dep-pins` only covers packages we've explicitly listed; a
  brand-new contested dependency isn't guarded until someone adds it. The guard
  is a ratchet on known pain, not a universal solver.

## Validation

- `pnpm lint:dep-pins` passes on the intended state (`zod {3,4}`) and was
  proven to fail when the expected major set is violated (negative test, 2026-06-21).
- The same command rejects every external workflow action whose ref is not an
  exact 40-character commit SHA (added 2026-08-25).
- `pnpm install --frozen-lockfile` passes on the committed lockfile.
- `engines.node` change is warn-only (`.npmrc` has no `engine-strict`), so it
  cannot block installs on a contributor's machine — it only steers Vercel/CI.
