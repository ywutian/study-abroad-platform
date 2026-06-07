/**
 * Recurrence detector — "have we fixed this before?"
 *
 * Surfaces files/areas that keep getting FIXED (not merely changed), so that a
 * new fix to a hotspot triggers the close-the-loop discipline (root cause +
 * guardrail) instead of becoming patch N+1. Pairs with the `/close-the-loop`
 * skill. The signal is fix-churn (commits of type fix/perf/revert/hotfix or
 * carrying recurrence words like "again / still / regress / round N / 又 / 再次"),
 * NOT raw churn — actively-developed files churn a lot without being buggy.
 *
 * Usage:
 *   tsx scripts/check-recurrence.ts                 # analyze working-tree changes vs HEAD
 *   tsx scripts/check-recurrence.ts --staged        # analyze staged files only
 *   tsx scripts/check-recurrence.ts <path...>       # analyze specific files/globs
 *   tsx scripts/check-recurrence.ts --top[=N]       # list the repo's top fix-churn hotspots
 *   tsx scripts/check-recurrence.ts --threshold=N   # hotspot fix-churn threshold (default 3)
 *   tsx scripts/check-recurrence.ts --strict        # exit 1 if a changed file is a hotspot
 *   tsx scripts/check-recurrence.ts --json          # machine-readable output
 *
 * Advisory by default (exit 0) — it is a nudge, not a gate. Use --strict to gate.
 *
 * Known blind spots (a recurring class can hide from this per-file detector):
 *   1. No `git log --follow` — a `git mv` resets a file's fix-count, so churn
 *      before a rename is invisible (e.g. middleware.ts -> proxy.ts dropped from
 *      7 to 2). `--follow` only works for single-path queries, so a real fix
 *      needs `-M --name-status` rename-chain stitching, not a flag.
 *   2. Per-file grouping is blind to a class fixed by ADDING A NEW FILE each time
 *      (e.g. the prediction scale-error class, fixed via a new correction seed
 *      per incident — 1 commit each, so it never crosses the per-file threshold).
 *   3. Cross-file theme: a root cause fixed once in each of N files stays below
 *      the per-file threshold on every file. Cluster commit SUBJECTS by theme to
 *      catch these (and reverts / fixes mislabeled under feat|chore|refactor,
 *      which the fix-type subject regex also misses).
 */

import { execSync } from 'child_process';

// ── Config ──────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, dflt: number): number => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) || dflt : dflt;
};

const THRESHOLD = opt('threshold', 3); // fix-churn count that marks a hotspot
const MAX_COMMITS = 6000; // history scan cap (perf)
const JSON_OUT = flag('json');
const STRICT = flag('strict');
const STAGED = flag('staged');
const TOP_MODE = args.some((a) => a === '--top' || a.startsWith('--top='));
const TOP_N = opt('top', 25);

// Conventional types + words that signal a *repeat* fix rather than a feature.
const FIX_TYPE = /^(?:[0-9a-f]{7,40}\s+)?(fix|perf|revert|hotfix)\b/i;
const RECUR_WORD =
  /\b(again|still|finally|really fix|actually fix|re-?fix|regress|round\s*[0-9]|hotfix)\b|又|再次|再一次|彻底|真正|终于/i;

// Paths that churn for reasons other than bugs — excluded from --top hotspots.
const TOP_IGNORE =
  /(pnpm-lock|package-lock|yarn\.lock|\/dist\/|node_modules|\.snap$|\/migrations\/|\/seeds\/|\/messages\/(en|zh)\.json$|\/data\/|\.json$)/;

interface FileStat {
  file: string;
  total: number;
  fix: number;
  recentFixes: string[]; // most-recent fix subjects (capped)
}

// ── Git plumbing ────────────────────────────────────────────

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return '';
  }
}

/**
 * One pass over history: build file -> {total, fix, recentFixes}. A commit is a
 * "fix" if its subject is a fix/perf/revert type OR carries a recurrence word.
 */
function buildStats(): Map<string, FileStat> {
  const SEP = '__CTL__';
  const raw = git(`log --no-merges -n ${MAX_COMMITS} --name-only --pretty=format:'${SEP}%h %s'`);
  const stats = new Map<string, FileStat>();
  if (!raw) return stats;

  let curIsFix = false;
  let curSubject = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith(SEP)) {
      const header = line.slice(SEP.length);
      curSubject = header.replace(/^[0-9a-f]{7,40}\s+/i, '');
      curIsFix = FIX_TYPE.test(header) || RECUR_WORD.test(header);
      continue;
    }
    const file = line.trim();
    if (!file) continue;
    let s = stats.get(file);
    if (!s) {
      s = { file, total: 0, fix: 0, recentFixes: [] };
      stats.set(file, s);
    }
    s.total += 1;
    if (curIsFix) {
      s.fix += 1;
      if (s.recentFixes.length < 5) s.recentFixes.push(curSubject);
    }
  }
  return stats;
}

function changedFiles(): string[] {
  const out = STAGED
    ? git('diff --cached --name-only --diff-filter=ACM')
    : git('diff --name-only HEAD');
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => /\.(ts|tsx|js|jsx|prisma|sql)$/.test(f));
}

// ── Render ──────────────────────────────────────────────────

function main() {
  const stats = buildStats();
  if (stats.size === 0) {
    console.log('check-recurrence: no git history available (shallow clone?). Skipping.');
    process.exit(0);
  }

  // --top: the repo's recurring-bug map.
  if (TOP_MODE) {
    const top = [...stats.values()]
      .filter((s) => !TOP_IGNORE.test(s.file) && s.fix >= 2)
      .sort((a, b) => b.fix - a.fix)
      .slice(0, TOP_N);
    if (JSON_OUT) {
      console.log(JSON.stringify(top, null, 2));
      process.exit(0);
    }
    console.log(`\n🔁 Top ${top.length} fix-churn hotspots (fixed ≥2×):\n`);
    for (const s of top) {
      const mark = s.fix >= THRESHOLD ? '🔴' : '🟡';
      console.log(`${mark} ${s.fix}× fixes / ${s.total} commits  ${s.file}`);
      if (s.recentFixes[0]) console.log(`      last: ${s.recentFixes[0]}`);
    }
    console.log(
      `\nA 🔴 hotspot fixed ≥${THRESHOLD}× is a recurring class — the next fix should run /close-the-loop (add a guardrail), not patch N+1.\n`
    );
    process.exit(0);
  }

  // Default / explicit-paths / --staged: assess the relevant file set.
  const targets =
    args.filter((a) => !a.startsWith('--')).length > 0
      ? args.filter((a) => !a.startsWith('--'))
      : changedFiles();

  if (targets.length === 0) {
    console.log(
      'check-recurrence: no changed code files to assess. (Use --top for the hotspot map.)'
    );
    process.exit(0);
  }

  const assessed = targets
    .map((f) => stats.get(f) ?? { file: f, total: 0, fix: 0, recentFixes: [] })
    .sort((a, b) => b.fix - a.fix);
  const hotspots = assessed.filter((s) => s.fix >= THRESHOLD);

  if (JSON_OUT) {
    console.log(JSON.stringify({ threshold: THRESHOLD, hotspots, assessed }, null, 2));
    process.exit(STRICT && hotspots.length > 0 ? 1 : 0);
  }

  if (hotspots.length === 0) {
    console.log(
      `✅ check-recurrence: none of the ${assessed.length} changed file(s) is a fix-hotspot (≥${THRESHOLD}× fixes). A normal fix is fine.`
    );
    process.exit(0);
  }

  console.log(
    `\n🔁 ${hotspots.length} of your changed file(s) keep getting fixed — this is likely a RECURRING bug class:\n`
  );
  for (const s of hotspots) {
    console.log(`🔴 ${s.file} — fixed ${s.fix}× before (${s.total} total commits)`);
    for (const subj of s.recentFixes.slice(0, 3)) console.log(`      • ${subj}`);
  }
  console.log(
    [
      '',
      'Before calling this fix done, run the /close-the-loop discipline:',
      '  1. Name the structural root cause (no SSOT / no enforcement / blind spot / no abstraction).',
      '  2. Add a GUARDRAIL that makes recurrence impossible — lint rule / test-or-invariant /',
      '     abstraction-or-SSOT / type-level. Docs alone do NOT close a loop.',
      '  3. Clear existing violations to 0 so the rule can be error-level.',
      '  4. PROVE the guardrail fires (introduce a violation → it’s caught → revert).',
      '',
      'A patch fixes today; a guardrail fixes forever.',
      '',
    ].join('\n')
  );

  process.exit(STRICT ? 1 : 0);
}

main();
