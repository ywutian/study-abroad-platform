/**
 * Coverage-threshold ratchet.
 *
 * The recurring "fix(ci): lower coverage thresholds" loop (≥3 times, always
 * downward) silently eroded the test floor. This check makes the floor a
 * one-way ratchet: each app's configured jest/vitest coverageThreshold must be
 * >= the committed baseline in scripts/coverage-thresholds.baseline.json.
 *
 * Raising thresholds is free. LOWERING one now requires editing the baseline in
 * the same PR — converting a silent regression into an explicit, reviewed change.
 *
 * Usage:
 *   tsx scripts/check-coverage-ratchet.ts            # verify config >= baseline
 *   tsx scripts/check-coverage-ratchet.ts --update   # write current config INTO the
 *                                                     # baseline (only-up; refuses to lower)
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(ROOT, 'scripts/coverage-thresholds.baseline.json');
const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;
type Metric = (typeof METRICS)[number];
type Thresholds = Record<Metric, number>;

const UPDATE = process.argv.includes('--update');

const TARGETS: { app: string; file: string }[] = [
  { app: 'api', file: 'apps/api/package.json' },
  { app: 'mobile', file: 'apps/mobile/jest.config.js' },
  { app: 'web', file: 'apps/web/vitest.config.ts' },
  { app: 'shared', file: 'packages/shared/vitest.config.ts' },
];

/**
 * Extract the 4 coverage metrics from a config file. Looks inside the
 * `coverageThreshold` (jest) or `thresholds` (vitest) block so we don't pick up
 * unrelated numbers. Regex-based so it works for JSON, JS and TS configs alike.
 */
function readThresholds(file: string): Thresholds | null {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return null;
  const text = fs.readFileSync(abs, 'utf8');
  // Scope to a window after the threshold keyword (the 4 metrics always sit
  // within a few lines of it). Tolerates JSON ("coverageThreshold":), JS and TS
  // styles + nested (jest `global: {}`) and flat (vitest) shapes alike.
  const kw = text.search(/(?:coverageThreshold|thresholds)"?\s*:/);
  const scope = kw >= 0 ? text.slice(kw, kw + 300) : text;
  const out = {} as Thresholds;
  for (const m of METRICS) {
    const hit = scope.match(new RegExp(`\\b${m}"?\\s*:\\s*(\\d+(?:\\.\\d+)?)`));
    if (!hit) return null;
    out[m] = Number(hit[1]);
  }
  return out;
}

/**
 * A threshold CI never evaluates is not a floor.
 *
 * This ratchet guarded four apps' numbers. CI ran three of them: `packages/shared`
 * had 21 test files, the repo's HIGHEST floor (90/80/95/90), and no step in the
 * Unit Tests job at all — found 2026-08-06. The number was protected from being
 * lowered and never once checked.
 *
 * Two ways a floor stops being enforced, both silent, both now errors here:
 *
 *   - no CI step runs that app's tests at all (shared's case);
 *   - a step runs them WITHOUT `--coverage`, which is the only thing that makes
 *     vitest/jest evaluate the threshold block. web lost this once already —
 *     ci.yml still carries the comment saying `--coverage` is "REQUIRED, not a
 *     nicety". A comment is not a guard.
 *
 * `--passWithNoTests` is rejected for the same reason: a run that finds zero
 * tests exits 0 and no threshold is ever computed. It is legitimate in
 * verify-gate.ts (affected-only, local), which is why only CI is inspected.
 */
function checkCiEnforcesThresholds(errors: string[]): void {
  const ciPath = path.join(ROOT, '.github/workflows/ci.yml');
  if (!fs.existsSync(ciPath)) {
    errors.push('.github/workflows/ci.yml not found — cannot confirm any floor is enforced');
    return;
  }
  const ci = fs.readFileSync(ciPath, 'utf8');
  const runLines = ci.split('\n').filter((l) => /^\s*run:/.test(l) && /\b(jest|vitest)\b/.test(l));

  const FILTERS: Record<string, RegExp> = {
    api: /--filter\s+api\b/,
    web: /--filter\s+web\b/,
    mobile: /--filter\s+study-abroad-mobile\b/,
    shared: /--filter\s+@study-abroad\/shared\b/,
  };

  for (const [app, filter] of Object.entries(FILTERS)) {
    // e2e runs use a separate jest config and compute no coverage; a unit step
    // is one that asks for coverage, so match on that rather than excluding
    // configs by name.
    const steps = runLines.filter((l) => filter.test(l) && !/jest-e2e/.test(l));
    if (steps.length === 0) {
      errors.push(
        `${app}: no CI step runs its tests, so its coverage floor in ` +
          `coverage-thresholds.baseline.json is guarded but never evaluated. ` +
          `Add a step to the Unit Tests job.`
      );
      continue;
    }
    if (!steps.some((l) => l.includes('--coverage'))) {
      errors.push(
        `${app}: its CI test step does not pass --coverage, and the threshold block ` +
          `is only evaluated on a coverage run — the floor is inert.`
      );
    }
    const soft = steps.find((l) => l.includes('--passWithNoTests'));
    if (soft) {
      errors.push(
        `${app}: CI test step passes --passWithNoTests, so a run that finds zero tests ` +
          `exits 0 and no threshold is ever computed: ${soft.trim()}`
      );
    }
  }
}

function main() {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Record<string, Thresholds>;
  const errors: string[] = [];
  const updated: Record<string, Thresholds> = {};
  checkCiEnforcesThresholds(errors);

  for (const { app, file } of TARGETS) {
    const current = readThresholds(file);
    if (!current) {
      errors.push(`${app}: could not parse coverage thresholds from ${file}`);
      continue;
    }
    const base = baseline[app];
    if (!base) {
      errors.push(`${app}: no baseline entry — add one to coverage-thresholds.baseline.json`);
      continue;
    }
    for (const m of METRICS) {
      if (current[m] < base[m]) {
        errors.push(
          `${app}.${m}: configured ${current[m]} is BELOW baseline ${base[m]} (${file}). ` +
            `Lowering the floor must be explicit — update the baseline in this PR if intentional.`
        );
      }
    }
    // --update keeps the higher of current vs baseline (never lowers).
    updated[app] = METRICS.reduce((acc, m) => {
      acc[m] = Math.max(current[m], base[m]);
      return acc;
    }, {} as Thresholds);
  }

  if (UPDATE) {
    if (errors.some((e) => e.includes('could not parse') || e.includes('no baseline'))) {
      console.error('❌ Cannot --update: ' + errors.join('; '));
      process.exit(1);
    }
    // Carry over every `_`-prefixed key, not just `_comment` — per-app notes
    // record WHY a floor moved, and dropping them on --update would re-create
    // the silent-drift problem this baseline exists to prevent.
    const notes = Object.fromEntries(Object.entries(baseline).filter(([k]) => k.startsWith('_')));
    const out = { ...notes, ...updated };
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(out, null, 2) + '\n');
    console.log('✅ Coverage baseline updated (only-up).');
    process.exit(0);
  }

  if (errors.length > 0) {
    console.error('\n❌ Coverage ratchet failed:\n');
    for (const e of errors) console.error('   ' + e);
    console.error(
      '\nThe coverage floor is one-way. Add tests to raise it; never silently lower it.\n'
    );
    process.exit(1);
  }

  console.log('✅ Coverage thresholds hold the line (all apps >= baseline).');
}

main();
