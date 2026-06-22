/**
 * Code-churn report — a reproducible number for "how much am I reworking
 * recently-written code" instead of a gut feeling.
 *
 * GitClear defines churn as the share of lines "reverted or updated less than
 * two weeks after being authored." We approximate that signal at the file level:
 * when a code file is edited again within CHURN_WINDOW_DAYS of its previous
 * commit, that later commit's line changes are counted as *rework* (you came
 * back and re-touched something you'd just touched). Rework ÷ total changed lines
 * = the churn rate.
 *
 * This is a proxy (file-level, not line-level blame), but it is honest about its
 * definition and is stable enough to watch as a trend. A low single-digit %
 * is healthy; a sustained rise vs your own trailing baseline is the warning
 * sign (GitClear's longitudinal baseline sat near 3-4%).
 *
 * Usage:
 *   pnpm churn:report                 # last 60 days
 *   pnpm churn:report -- --days=90    # custom window
 *   pnpm churn:report -- --top=15     # show N hottest files
 *
 * See docs/ANTI_CHURN_PLAYBOOK.md.
 */

import { execSync } from 'child_process';

const CHURN_WINDOW_DAYS = 14;
const DAY = 86_400; // seconds

const arg = (name: string, def: number): number => {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? Number(m.split('=')[1]) : def;
};
const WINDOW_DAYS = arg('days', 60);
const TOP = arg('top', 12);

// Only count real source files — i18n JSON and the lockfile are legitimately
// high-volume and would drown out the signal.
const CODE = /\.(ts|tsx|js|jsx|prisma|css)$/;
const EXCLUDE = /(^|\/)(messages|locales)\/.*\.json$|pnpm-lock\.yaml$/;

interface Commit {
  ts: number;
  files: { path: string; lines: number }[];
}

function readLog(): Commit[] {
  const raw = execSync(
    `git log --since="${WINDOW_DAYS} days ago" --numstat --pretty=format:'C|%ct'`,
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  );
  const commits: Commit[] = [];
  let cur: Commit | null = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('C|')) {
      cur = { ts: Number(line.slice(2)), files: [] };
      commits.push(cur);
    } else if (cur && line.trim()) {
      const [add, del, path] = line.split('\t');
      if (add === '-' || !path) continue; // binary
      if (!CODE.test(path) || EXCLUDE.test(path)) continue;
      cur.files.push({ path, lines: Number(add) + Number(del) });
    }
  }
  return commits;
}

function main(): void {
  const commits = readLog().sort((a, b) => a.ts - b.ts); // oldest → newest
  const lastTouched = new Map<string, number>();
  const reworkByFile = new Map<string, { rework: number; total: number; revisits: number }>();
  let totalLines = 0;
  let reworkLines = 0;

  for (const c of commits) {
    for (const f of c.files) {
      totalLines += f.lines;
      const prev = lastTouched.get(f.path);
      const stat = reworkByFile.get(f.path) ?? { rework: 0, total: 0, revisits: 0 };
      stat.total += f.lines;
      if (prev !== undefined && c.ts - prev <= CHURN_WINDOW_DAYS * DAY) {
        reworkLines += f.lines;
        stat.rework += f.lines;
        stat.revisits += 1;
      }
      reworkByFile.set(f.path, stat);
      lastTouched.set(f.path, c.ts);
    }
  }

  const rate = totalLines ? (reworkLines * 100) / totalLines : 0;
  const verdict = rate < 5 ? '🟢 healthy' : rate < 10 ? '🟡 elevated' : '🔴 high — lots of rework';

  console.log(
    `\n📊 Churn report — last ${WINDOW_DAYS} days (rework = same file re-edited within ${CHURN_WINDOW_DAYS}d)\n`
  );
  console.log(`   commits analysed : ${commits.length}`);
  console.log(`   changed lines    : ${totalLines.toLocaleString()} (code files only)`);
  console.log(`   rework lines     : ${reworkLines.toLocaleString()}`);
  console.log(`   churn rate       : ${rate.toFixed(1)}%   ${verdict}`);
  console.log(`\n   Hottest files (rework lines / revisits within ${CHURN_WINDOW_DAYS}d):`);
  [...reworkByFile.entries()]
    .filter(([, s]) => s.revisits > 0)
    .sort((a, b) => b[1].rework - a[1].rework)
    .slice(0, TOP)
    .forEach(([path, s]) =>
      console.log(
        `     ${String(s.rework).padStart(6)} lines  ·  ${s.revisits}× revisited  ·  ${path}`
      )
    );
  console.log('');
}

main();
