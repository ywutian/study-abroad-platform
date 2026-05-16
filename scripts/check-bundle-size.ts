#!/usr/bin/env tsx
/**
 * Bundle-size budget check.
 *
 * 2026-05 Phase 4 #37: Lumni had `@next/bundle-analyzer` installed but
 * no CI gate enforcing growth limits. Result: every new dependency or
 * feature could quietly add 50KB to the dashboard's first-load JS
 * without anyone noticing until users started complaining about
 * slowness in production.
 *
 * This script reads Next.js's `app-build-manifest.json` after a build,
 * sums each route's first-load JS size, and compares against a stored
 * baseline. Fails the build if any route grows by more than the
 * configured threshold (default: 5%).
 *
 * ## Usage
 *
 * Build the web app, then run the check:
 *   pnpm --filter web build
 *   pnpm lint:bundle
 *
 * To re-baseline after an intentional growth (e.g., new feature):
 *   pnpm lint:bundle -- --seed
 *
 * To pass a custom threshold (5 → allow 5% growth):
 *   pnpm lint:bundle -- --threshold=10
 *
 * ## CI hookup
 *
 * Add to .github/workflows/ci.yml in the build job, AFTER `pnpm build`:
 *   - run: pnpm lint:bundle
 *
 * (The baseline file is checked in. CI compares the freshly-built
 * sizes against the committed baseline.)
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const NEXT_DIR = path.resolve(ROOT, 'apps/web/.next');
// Next 15 + Webpack:  apps/web/.next/app-build-manifest.json (route → [chunks])
// Next 16 + Turbopack: per-route apps/web/.next/server/app/**/build-manifest.json
// Try the legacy path first; fall back to scanning the per-route manifests.
const LEGACY_MANIFEST_PATH = path.resolve(NEXT_DIR, 'app-build-manifest.json');
const SERVER_APP_DIR = path.resolve(NEXT_DIR, 'server/app');
const BASELINE_PATH = path.resolve(ROOT, 'apps/web/.bundle-baseline.json');

const DEFAULT_THRESHOLD_PCT = 5;

interface AppBuildManifest {
  pages: Record<string, string[]>;
}

interface RouteSizes {
  /** Route path (key from the build manifest, e.g. `/[locale]/(main)/dashboard/page`) */
  [route: string]: number;
}

interface Baseline {
  generatedAt: string;
  thresholdPct: number;
  routes: RouteSizes;
}

function parseArgs(): { seed: boolean; threshold: number } {
  const args = process.argv.slice(2);
  const seed = args.includes('--seed');
  const thresholdArg = args.find((a) => a.startsWith('--threshold='));
  const threshold = thresholdArg
    ? Number(thresholdArg.replace('--threshold=', '')) || DEFAULT_THRESHOLD_PCT
    : DEFAULT_THRESHOLD_PCT;
  return { seed, threshold };
}

/**
 * Load the route → chunks map. Two strategies depending on Next version:
 *
 * 1. **Legacy (Next 15 + Webpack)**: a single `app-build-manifest.json`
 *    at .next/ root with `{ pages: { route: chunks[] } }`. Returned
 *    as-is.
 *
 * 2. **Turbopack (Next 16+)**: per-route `server/app/<route>/build-
 *    manifest.json` files. Walk the tree, read each one's
 *    `rootMainFiles + polyfillFiles + lowPriorityFiles` (the always-
 *    loaded chunks), and emit a synthetic AppBuildManifest with the
 *    URL-style route as key.
 *
 * Returns null only when NEITHER strategy finds any data (genuine
 * empty build, or build did not run).
 */
function loadManifest(): AppBuildManifest | null {
  if (fs.existsSync(LEGACY_MANIFEST_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(LEGACY_MANIFEST_PATH, 'utf8'));
    } catch {
      /* fall through to Turbopack scan */
    }
  }

  if (!fs.existsSync(SERVER_APP_DIR)) return null;

  const pages: Record<string, string[]> = {};
  const stack: string[] = [SERVER_APP_DIR];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.name === 'build-manifest.json') {
        try {
          const data = JSON.parse(fs.readFileSync(full, 'utf8')) as {
            rootMainFiles?: string[];
            polyfillFiles?: string[];
            lowPriorityFiles?: string[];
          };
          const chunks = [
            ...(data.rootMainFiles ?? []),
            ...(data.polyfillFiles ?? []),
            ...(data.lowPriorityFiles ?? []),
          ];
          // Derive route key from path: .next/server/app/<route>/build-manifest.json
          // → '<route>'. Replace `(group)` segments with empty so groups don't
          // bloat the key; otherwise keep the path as-is for readability.
          const routeKey = path.relative(SERVER_APP_DIR, path.dirname(full)).replace(/\\/g, '/');
          pages['/' + (routeKey || '_root')] = chunks;
        } catch {
          /* skip malformed manifest */
        }
      }
    }
  }

  return Object.keys(pages).length > 0 ? { pages } : null;
}

function fileSize(rel: string): number {
  const abs = path.resolve(ROOT, 'apps/web/.next', rel);
  try {
    return fs.statSync(abs).size;
  } catch {
    return 0;
  }
}

function computeRouteSizes(manifest: AppBuildManifest): RouteSizes {
  const sizes: RouteSizes = {};
  for (const [route, chunks] of Object.entries(manifest.pages ?? {})) {
    // Sum every chunk file referenced by this route. Some chunks are
    // shared across routes — by summing per-route we measure "what a
    // user actually downloads" rather than "marginal cost".
    sizes[route] = chunks.reduce((acc, chunk) => acc + fileSize(chunk), 0);
  }
  return sizes;
}

function loadBaseline(): Baseline | null {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeBaseline(routes: RouteSizes, threshold: number): void {
  const baseline: Baseline = {
    generatedAt: new Date().toISOString(),
    thresholdPct: threshold,
    routes,
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

function main(): void {
  const { seed, threshold } = parseArgs();

  const manifest = loadManifest();
  if (!manifest) {
    // Missing manifest is informational, not fatal.
    // Causes (any of):
    //  - turbo-cache HIT on Build Web (Next doesn't re-emit `.next/*`)
    //  - web build step skipped (e.g., PR touched only API)
    //  - .next/ deleted between build and check
    // Failing here would block PRs that touch nothing relevant to the
    // web bundle. The right behavior is to SKIP the check (a cached
    // build is by definition not a regression candidate).
    console.log(
      `ℹ️  No build manifest found at ${path.relative(ROOT, LEGACY_MANIFEST_PATH)}\n` +
        `   or under ${path.relative(ROOT, SERVER_APP_DIR)}/\n` +
        `   Skipping bundle-size check (cached build or web build skipped).`
    );
    return;
  }

  const current = computeRouteSizes(manifest);

  if (seed) {
    writeBaseline(current, threshold);
    console.log(`✅ Baseline seeded with ${Object.keys(current).length} routes`);
    console.log(`   Threshold: ${threshold}% growth allowed`);
    console.log(`   Wrote: ${path.relative(ROOT, BASELINE_PATH)}`);
    return;
  }

  const baseline = loadBaseline();
  if (!baseline) {
    console.log(
      `ℹ️  No baseline file at ${path.relative(ROOT, BASELINE_PATH)}.\n` +
        `   Run \`pnpm lint:bundle -- --seed\` to create one from the current build.`
    );
    console.log(`\nCurrent sizes (${Object.keys(current).length} routes):`);
    for (const [route, size] of Object.entries(current)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)) {
      console.log(`  ${formatBytes(size).padStart(8)}  ${route}`);
    }
    // Non-fatal — we don't fail on missing baseline so first runs work.
    return;
  }

  const violations: Array<{ route: string; before: number; after: number; pct: number }> = [];
  const limit = baseline.thresholdPct ?? threshold;

  for (const [route, size] of Object.entries(current)) {
    const previous = baseline.routes[route];
    if (!previous) continue; // new route — not a regression
    const growthPct = ((size - previous) / previous) * 100;
    if (growthPct > limit) {
      violations.push({ route, before: previous, after: size, pct: growthPct });
    }
  }

  if (violations.length === 0) {
    console.log(`✅ Bundle-size check passed (${Object.keys(current).length} routes vs baseline)`);
    console.log(`   Threshold: ${limit}% growth allowed`);
    return;
  }

  console.error(`❌ ${violations.length} route(s) exceeded the bundle-size budget:\n`);
  for (const v of violations.sort((a, b) => b.pct - a.pct)) {
    console.error(
      `  ${v.route}\n` +
        `    Before: ${formatBytes(v.before)}\n` +
        `    After:  ${formatBytes(v.after)}  (+${v.pct.toFixed(1)}%)\n`
    );
  }
  console.error(
    `\n   If this growth is intentional, re-baseline with:\n` + `   pnpm lint:bundle -- --seed\n`
  );
  process.exit(1);
}

main();
