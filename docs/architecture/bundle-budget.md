# Bundle Size Budget

The web app enforces a **per-route bundle size budget** to prevent silent regressions. Every PR is checked against a committed baseline; any route whose first-load JS grows by more than the configured threshold (default **5%**) fails the build.

## How it works

1. `pnpm --filter web build` produces `apps/web/.next/app-build-manifest.json` listing each route's JS chunks.
2. `pnpm lint:bundle` reads that manifest, sums each route's chunk sizes (so it measures "what a user actually downloads"), and diffs against the committed baseline at `apps/web/.bundle-baseline.json`.
3. If any route exceeds its baseline by more than `thresholdPct`, the script exits non-zero and CI fails the PR.

## Updating the baseline

Intentional bundle growth (new feature, new dependency, etc.) should be reflected in the baseline. After your build:

```bash
pnpm --filter web build
pnpm lint:bundle -- --seed   # overwrites apps/web/.bundle-baseline.json
git add apps/web/.bundle-baseline.json
git commit -m "chore(bundle): re-baseline after <reason>"
```

Always commit baseline updates with a brief reason — the file is the source of truth for "what we accepted as the cost of feature X".

## Tuning the threshold

Default is 5% per-route growth. To run a one-off check with a stricter or looser threshold:

```bash
pnpm lint:bundle -- --threshold=10   # allow 10% growth
```

To permanently change the project default, edit `thresholdPct` in `apps/web/.bundle-baseline.json` (the check reads from the baseline file when present).

## CI Integration

Add this step to `.github/workflows/ci.yml` in the build job, **after** the `pnpm build` step:

```yaml
- name: Bundle size budget
  run: pnpm lint:bundle
```

The check is fast (just file-system reads + arithmetic) — no extra build time.

## What counts toward a route's size

The script supports **two Next.js manifest layouts**:

1. **Next 15 + Webpack** (legacy): one `app-build-manifest.json` at `.next/` root with `{ pages: { route: chunks[] } }`. Each route's size = sum of all chunk files it references.
2. **Next 16 + Turbopack** (current): per-route `server/app/<route>/build-manifest.json` files. The script walks the tree and reads each route's `rootMainFiles + polyfillFiles + lowPriorityFiles` — the **always-loaded shared chunks**.

Under Turbopack, all routes share the same root chunk set, so every route's size in the baseline reads as the same number (the shared bundle's total). This is still a meaningful gate: **a change to any shared chunk's total size triggers the check on every route at once**, which is exactly what we want for "the shared bundle just grew 8% — find out why".

What this layout doesn't catch (Turbopack): a route-specific dependency added via dynamic import that only loads on click. For per-route marginal cost, run `ANALYZE=true pnpm --filter web build` interactively.

The script does **not** account for gzip / brotli compression. Compressed sizes are typically ~30% of raw — the 5% threshold thus tolerates ~1.5% of the wire weight, which is generous for noise tolerance.

## When to add the gate

After the first seeded baseline lands in `main` (PR that seeds it commits the file), the check becomes a fail-on-regression gate on every subsequent PR's CI Build job. If a baseline is missing (deleted, never seeded, or new repo clone), the check runs in informational mode (prints top-10 route sizes, never fails) so the first PR doesn't get blocked.

## Related

- `apps/web/next.config.ts` configures `@next/bundle-analyzer` for interactive analysis: `ANALYZE=true pnpm --filter web build`.
- Phase 5 #41 (PR #196) introduced `next/dynamic` for 5 below-the-fold dashboard surfaces — that PR is the model for "fixing" a bundle-budget violation.
