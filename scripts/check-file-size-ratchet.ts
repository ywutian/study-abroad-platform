/**
 * One-way ratchet on oversized source files.
 *
 * 353 files are over 500 lines; 33 are over 1,500. The largest are
 * platform-data-closure-audit.ts (4,941), design/tokens.ts (4,924) and
 * application-analysis-workflow.service.ts (3,910). Nothing was stopping that
 * from growing: `page-size-limit` in apps/web/scripts/check-code-quality.ts
 * warns at 500 lines, but only for `page.tsx`, and only as a warning.
 *
 * Splitting all 353 is a refactor with real regression risk and no test to
 * catch a mistake — so this does not ask for that. It asks that the number
 * stop going up, the same bargain the coverage and type-escape ratchets make.
 *
 * ## Why overage, not a file count
 *
 * The obvious metric — "how many files exceed the limit" — punishes the exact
 * work it wants: splitting one 3,000-line file into six 600-line files takes
 * the count from 1 to 6 and turns the build red. So the metric is OVERAGE:
 *
 *     Σ max(0, lines − LIMIT)
 *
 * That 3,000-line file contributes 2,500. Split into six 600s it contributes
 * 6 × 100 = 600. Split under the limit it contributes 0. Every real
 * improvement moves it down, and only growth moves it up.
 *
 * ponytail: counts lines, not statements. A file that is 3,000 lines of data
 * literals is not the same problem as 3,000 lines of branching, and this
 * cannot tell them apart. Good enough for a budget — the alternative is
 * parsing every file on every lint run. When a data-heavy area dominates a
 * number, give it its own TARGETS entry rather than excluding it or raising a
 * ceiling — see the note on TARGETS for why apps/api is split three ways.
 *
 * Usage:
 *   tsx scripts/check-file-size-ratchet.ts            # verify (CI, lint:all)
 *   tsx scripts/check-file-size-ratchet.ts --update   # lock in an improvement
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(ROOT, 'scripts', 'file-size-baseline.json');
const UPDATE = process.argv.includes('--update');

/** Matches the 500-line convention `page-size-limit` already uses for pages. */
const LIMIT = 500;

/**
 * Split finer than "one entry per package" on purpose. Lumping apps/api
 * together produced a single 97k number in which 108 one-shot data-pipeline
 * scripts and 14 data-literal seed files drowned out the 88 service files —
 * a number nobody could act on. Separate entries keep every file under a
 * ratchet (nothing is excluded) while making each number mean one thing:
 * `apps/api/src` is request-path code, `apps/api/scripts` is operational
 * one-shots, `apps/api/prisma` is seed data. Root `scripts/` stays its own
 * entry despite the shared name — those are the lint gates and tooling, which
 * are maintained, unlike a data marathon that runs once.
 */
const TARGETS = [
  'apps/api/src',
  'apps/api/scripts',
  'apps/api/prisma',
  'apps/web/src',
  'apps/mobile/src',
  'packages/shared',
  'packages/browser-extension',
  'scripts',
];

/** Build output, vendored code and generated clients are not ours to split. */
const EXCLUDED =
  /\/(node_modules|\.next|dist|build|\.expo|coverage|ios|android|migrations|__generated__)\//;

/** Generated or data-only files: real, but not a "split this function" problem. */
const EXCLUDED_FILE = /\.(d\.ts|generated\.ts)$/;

function sourceFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  let out = '';
  try {
    out = execFileSync(
      'find',
      [abs, '-type', 'f', '(', '-name', '*.ts', '-o', '-name', '*.tsx', ')'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
  } catch {
    return [];
  }
  return out
    .split('\n')
    .filter((f) => f.trim() && !EXCLUDED.test(f) && !EXCLUDED_FILE.test(f))
    .filter((f) => !/\.(spec|test)\.tsx?$/.test(f));
}

/** Σ max(0, lines − LIMIT) across a package, plus its worst offender. */
function overage(dir: string): { overage: number; worst: string; worstLines: number } {
  let total = 0;
  let worst = '';
  let worstLines = 0;
  for (const file of sourceFiles(dir)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n').length;
    if (lines > LIMIT) total += lines - LIMIT;
    if (lines > worstLines) {
      worstLines = lines;
      worst = path.relative(ROOT, file);
    }
  }
  return { overage: total, worst, worstLines };
}

type Baseline = Record<string, number>;

function main(): void {
  const current: Record<string, ReturnType<typeof overage>> = {};
  for (const t of TARGETS) current[t] = overage(t);

  if (!fs.existsSync(BASELINE_FILE)) {
    if (!UPDATE) {
      console.error(
        `❌ ${path.relative(ROOT, BASELINE_FILE)} missing — run with --update to seed it.`
      );
      process.exit(1);
    }
    write(Object.fromEntries(TARGETS.map((t) => [t, current[t].overage])));
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Baseline & {
    _comment?: string;
  };
  const errors: string[] = [];
  const wins: string[] = [];

  for (const t of TARGETS) {
    const base = baseline[t];
    if (base === undefined) {
      errors.push(`\`${t}\` has no baseline entry — run --update to add it.`);
      continue;
    }
    const now = current[t].overage;
    if (now > base) {
      errors.push(
        `\`${t}\` overage: ${base} → ${now} (+${now - base} lines past the ${LIMIT}-line limit).\n` +
          `   Largest file: ${current[t].worst} (${current[t].worstLines} lines).\n` +
          `   Splitting a file LOWERS this number — six 600-line files score less than\n` +
          `   one 3,000-line file — so this is only red when code grew, never when it\n` +
          `   was broken up. Extract a module, or raise the baseline in the same PR.`
      );
    } else if (now < base) {
      wins.push(`${t}: ${base} → ${now} (−${base - now})`);
    }
  }

  if (UPDATE) {
    // Only-down, so --update can never rubber-stamp growth.
    const next: Baseline = {};
    for (const t of TARGETS) {
      next[t] = Math.min(current[t].overage, baseline[t] ?? Infinity);
    }
    write(next, baseline._comment);
    return;
  }

  if (errors.length > 0) {
    console.error('\n❌ File-size ratchet failed:\n');
    for (const e of errors) console.error('   ' + e + '\n');
    process.exit(1);
  }

  const total = TARGETS.reduce((n, t) => n + current[t].overage, 0);
  if (wins.length > 0) {
    console.log('✅ File-size ratchet holds — and improved:');
    for (const w of wins) console.log(`   ${w}`);
    console.log('   Run `pnpm lint:file-size --update` to lock these in.');
  } else {
    console.log(
      `✅ File-size ratchet holds (${total} lines past the ${LIMIT}-line limit workspace-wide).`
    );
  }
}

function write(counts: Baseline, comment?: string): void {
  const out = {
    _comment:
      comment ??
      `One-way ceiling on oversized source files, per package. The number is Σ max(0, lines − ${LIMIT}) — the total lines past the limit, NOT a file count, so splitting a large file always lowers it and never trips the gate. check-file-size-ratchet.ts fails when a package's number RISES. After splitting something, run \`pnpm lint:file-size --update\` to lock the win; --update never raises a floor. Raising a number requires editing this file in the same PR.`,
    ...counts,
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(
    `✅ File-size baseline written to ${path.relative(ROOT, BASELINE_FILE)} (only-down).`
  );
}

main();
