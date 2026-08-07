import * as fs from 'fs';
import * as path from 'path';
import { runGate, withSeededViolation, expectClean, expectFired } from './harness';
import { buildFullSurfaceRegistry } from '../release-gate/full-surface-registry';

const GATE = 'check-release-runtime.ts';
const FIXTURE = 'e2e-report/__gate-proof/summary.json';
const WAIVERS = 'e2e-report/__gate-proof/waivers.json';
const ARGS = ['--environment=local', `--summary=${FIXTURE}`, '--max-age-hours=2'];

function summary(mutate: (s: Record<string, unknown>) => void = () => {}) {
  const web = buildFullSurfaceRegistry().routeInventory.web;
  const s: Record<string, unknown> = {
    schemaVersion: '1',
    mode: 'release-runtime',
    environment: 'local',
    generatedAt: new Date().toISOString(),
    evidenceRoot: path.dirname(FIXTURE),
    routeCount: web.length,
    expectedWebRouteCount: web.length,
    records: web.map((r) => ({
      surfaceId: r.surfaceId,
      route: r.pattern ?? '/',
      status: 'OK',
      releaseRuntime: { classification: { rootCause: 'gate-proof fixture' } },
    })),
  };
  mutate(s);
  return JSON.stringify(s);
}

type Rec = { surfaceId: string; status: string };

/**
 * Proof for `check-release-runtime.ts` — the gate that decides whether a build
 * with broken pages ships. It drives every web route in a local prod build and
 * this checks the resulting evidence.
 *
 * It was already the strictest gate in the repo: absent evidence fails, stale
 * evidence fails, a summary missing routes fails, an expired waiver fails. One
 * hole, found by probing on 2026-08-06:
 *
 *   --max-age-hours=2   30h-old summary  →  ❌ stale (limit 2h)
 *   --max-age-hour=2    30h-old summary  →  ✅ Release runtime gate passed.
 *
 * One missing `s`. The unrecognised flag was collected and ignored, so the 48h
 * default came back and a day-old summary passed as fresh evidence. Every
 * behaviour below is decided by a flag, which is why an ignored one is not a
 * harmless no-op here.
 *
 * The fixture is generated from the live surface registry rather than checked
 * in, so it cannot drift out of date as routes are added — and, unlike the
 * first bundle-size proof, it depends on no build having been run.
 */
export async function prove(): Promise<void> {
  fs.mkdirSync(path.join(process.cwd(), path.dirname(FIXTURE)), { recursive: true });

  // Baseline: a complete, fresh, all-OK summary passes.
  await withSeededViolation(FIXTURE, summary(), () =>
    expectClean(runGate(GATE, ARGS), 'a complete fresh summary with every route OK')
  );

  // Stale evidence is not evidence.
  await withSeededViolation(
    FIXTURE,
    summary((s) => {
      s.generatedAt = new Date(Date.now() - 30 * 3600_000).toISOString();
    }),
    () => expectFired(runGate(GATE, ARGS), 'stale')
  );

  // A typo'd flag must not silently restore a default. Passed until 2026-08-06.
  await withSeededViolation(
    FIXTURE,
    summary((s) => {
      s.generatedAt = new Date(Date.now() - 30 * 3600_000).toISOString();
    }),
    () =>
      expectFired(
        runGate(GATE, ['--environment=local', `--summary=${FIXTURE}`, '--max-age-hour=2']),
        'Unrecognised flag'
      )
  );

  // A route missing from the run is a route nobody checked.
  await withSeededViolation(
    FIXTURE,
    summary((s) => {
      (s.records as Rec[]).splice(0, 1);
    }),
    () => expectFired(runGate(GATE, ARGS), 'missing')
  );

  // A route that failed to render.
  await withSeededViolation(
    FIXTURE,
    summary((s) => {
      (s.records as Rec[])[0].status = 'BROKEN';
    }),
    () => expectFired(runGate(GATE, ARGS), 'BROKEN')
  );

  // A slow route with no waiver.
  await withSeededViolation(
    FIXTURE,
    summary((s) => {
      (s.records as Rec[])[0].status = 'SLOW_FRONTEND';
    }),
    () => expectFired(runGate(GATE, ARGS), 'unwaived')
  );

  // A waiver that has expired must fail rather than keep waiving.
  await withSeededViolation(FIXTURE, summary(), async () => {
    await withSeededViolation(
      WAIVERS,
      JSON.stringify({
        waivers: [
          { surfaceId: 'anything', status: 'SLOW_FRONTEND', expiresOn: '2020-01-01T00:00:00.000Z' },
        ],
      }),
      () => expectFired(runGate(GATE, [...ARGS, `--waivers=${WAIVERS}`]), 'expired waiver')
    );
  });
}
