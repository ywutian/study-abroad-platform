/**
 * One-way ratchet on TypeScript escape hatches.
 *
 * Every app sets `strict: true`, and then 1,076 `any`s in production code walk
 * straight through it. The rule itself can't hold the line today:
 * `apps/api/eslint.config.mjs` has `@typescript-eslint/no-explicit-any: 'off'`
 * "by design (NestJS/Prisma/Express patterns)", and api holds 957 of them.
 * web and mobile set it to 'warn', which nothing fails on.
 *
 * Flipping any of those to 'error' fails the build on ~1k pre-existing sites,
 * so nobody ever does, and the count drifts up instead. This is the same shape
 * as the coverage floor, so it gets the same answer: don't demand zero, demand
 * "not worse than yesterday". Remove an `any` → lower the ceiling; add one → red.
 *
 * Deliberately NOT an ESLint rule: the point is a per-package budget, and
 * ESLint has no concept of "957 is fine but 958 is not". `--max-warnings` is
 * per-run, not per-package, and api's lint is `eslint --fix` — it writes to the
 * working tree, so it is the wrong place to hang a measurement.
 *
 * ponytail: counts by regex, does not parse. A `: any` inside a string literal
 * or a comment counts. That's tolerable for a budget — a false positive costs
 * one baseline bump, and the alternative is a ts-morph pass over 2.5k files on
 * every lint run. Switch to ts-morph only if the noise ever hides a real rise.
 *
 * Usage:
 *   tsx scripts/check-any-ratchet.ts            # verify (CI, lint:all)
 *   tsx scripts/check-any-ratchet.ts --update   # lock in an improvement
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(ROOT, 'scripts', 'any-baseline.json');
const UPDATE = process.argv.includes('--update');

const TARGETS = [
  'apps/api',
  'apps/web',
  'apps/mobile',
  'packages/shared',
  'packages/browser-extension',
];

/** Build artefacts and vendored code are not ours to police. */
const EXCLUDED_DIR = /\/(node_modules|\.next|dist|build|\.expo|coverage|ios|android)\//;

/**
 * Test files are excluded, and that is the difference between a number people
 * act on and a number people rubber-stamp. 913 of api's `as any` hits are in
 * `.spec.ts`, nearly all of them casting a partial object into a Prisma or
 * Nest mock — a legitimate, contained pattern. Counted together with production
 * code, the total would swing on ordinary test churn and every PR would end up
 * bumping the baseline "because it's just tests". What is left is type erosion
 * on code that actually runs.
 */
const EXCLUDED_FILE = /\.(spec|test)\.tsx?:/;

const EXCLUDED = (line: string) => EXCLUDED_DIR.test(line) || EXCLUDED_FILE.test(line);

interface Counts {
  /** `: any`, `as any`, `<any>` — the explicit escapes from `strict`. */
  explicitAny: number;
  /** `@ts-ignore` / `@ts-expect-error` — suppressions of a real type error. */
  tsSuppress: number;
}

type Baseline = Record<string, Counts>;

/**
 * grep -r with a fixed pattern set. Uses execFileSync (no shell) so the
 * patterns can contain regex metacharacters without quoting games, and
 * tolerates grep's exit 1 ("no matches") which is a valid zero, not an error.
 */
function grepCount(dir: string, pattern: string): number {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return 0;
  let out = '';
  try {
    out = execFileSync('grep', ['-rnE', pattern, '--include=*.ts', '--include=*.tsx', abs], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string };
    if (e.status === 1) return 0; // grep: no matches
    throw err;
  }
  return out.split('\n').filter((l) => l.trim() && !EXCLUDED(l)).length;
}

function count(dir: string): Counts {
  return {
    explicitAny: grepCount(dir, '(:\\s*any\\b|\\bas any\\b|<any>)'),
    tsSuppress: grepCount(dir, '@ts-(ignore|expect-error)'),
  };
}

function main(): void {
  const current: Baseline = {};
  for (const t of TARGETS) current[t] = count(t);

  if (!fs.existsSync(BASELINE_FILE)) {
    if (!UPDATE) {
      console.error(
        `❌ ${path.relative(ROOT, BASELINE_FILE)} missing — run with --update to seed it.`
      );
      process.exit(1);
    }
    write(current);
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Baseline & {
    _comment?: string;
  };
  const errors: string[] = [];
  const wins: string[] = [];

  for (const t of TARGETS) {
    const base = baseline[t];
    if (!base) {
      errors.push(`\`${t}\` has no baseline entry — run --update to add it.`);
      continue;
    }
    for (const metric of ['explicitAny', 'tsSuppress'] as const) {
      const now = current[t][metric];
      if (now > base[metric]) {
        errors.push(
          `\`${t}\` ${metric}: ${base[metric]} → ${now} (+${now - base[metric]}).\n` +
            `   The floor is one-way. Type the new code, or — if the escape is genuinely\n` +
            `   unavoidable — raise the baseline in the same PR so it is reviewed, not silent.`
        );
      } else if (now < base[metric]) {
        wins.push(`${t} ${metric}: ${base[metric]} → ${now} (−${base[metric] - now})`);
      }
    }
  }

  if (UPDATE) {
    // Only-down: never let --update raise a floor, or it becomes a rubber stamp
    // for the drift it exists to stop.
    const next: Baseline = {};
    for (const t of TARGETS) {
      next[t] = {
        explicitAny: Math.min(current[t].explicitAny, baseline[t]?.explicitAny ?? Infinity),
        tsSuppress: Math.min(current[t].tsSuppress, baseline[t]?.tsSuppress ?? Infinity),
      };
    }
    write(next, baseline._comment);
    return;
  }

  if (errors.length > 0) {
    console.error('\n❌ Type-escape ratchet failed:\n');
    for (const e of errors) console.error('   ' + e + '\n');
    process.exit(1);
  }

  const total = TARGETS.reduce((n, t) => n + current[t].explicitAny, 0);
  if (wins.length > 0) {
    console.log('✅ Type-escape ratchet holds — and improved:');
    for (const w of wins) console.log(`   ${w}`);
    console.log('   Run `pnpm lint:any-ratchet --update` to lock these in.');
  } else {
    console.log(`✅ Type-escape ratchet holds (${total} explicit \`any\` across the workspace).`);
  }
}

function write(counts: Baseline, comment?: string): void {
  const out = {
    _comment:
      comment ??
      'One-way ceiling on TypeScript escape hatches per package. check-any-ratchet.ts fails when a count RISES. Lowering is free — after removing `any`s run `pnpm lint:any-ratchet --update` to lock the win. Raising requires editing this file in the same PR, which is the point: it turns silent type erosion into a reviewable diff. See the header of check-any-ratchet.ts for why this is a ratchet and not an ESLint rule.',
    ...counts,
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(
    `✅ Type-escape baseline written to ${path.relative(ROOT, BASELINE_FILE)} (only-down).`
  );
}

main();
