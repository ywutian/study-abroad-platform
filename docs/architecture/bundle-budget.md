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

`app-build-manifest.json` lists each route's chunks. We sum the **file sizes of every chunk file** the route references, including shared chunks. This means:

- A new dependency used by one route bloats only that route's number
- A new dependency added to a shared chunk (e.g., layout) bloats every route's number — exactly right, because every user downloads it

The script does **not** account for gzip / brotli compression. Compressed sizes are typically ~30% of raw — the 5% threshold thus tolerates ~1.5% of the wire weight, which is generous for noise tolerance.

## When to add the gate

The baseline file is **empty by default** (seeded `{}`) so the check runs in informational mode (prints top-10 route sizes, never fails). After the first seeded baseline lands, the check becomes a fail-on-regression gate.

## Related

- `apps/web/next.config.ts` configures `@next/bundle-analyzer` for interactive analysis: `ANALYZE=true pnpm --filter web build`.
- Phase 5 #41 (PR #196) introduced `next/dynamic` for 5 below-the-fold dashboard surfaces — that PR is the model for "fixing" a bundle-budget violation.
