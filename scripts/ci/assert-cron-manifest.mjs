/**
 * Post-deploy closure check for the http cron driver: asserts the LIVE
 * registry (`GET /internal/cron`, discovered from the deployed code's @Cron
 * decorators at boot) matches `.github/cron-jobs.json` (extracted from source
 * by scripts/check-cron-manifest.ts) — name, schedule and timeZone, both
 * directions.
 *
 * This is what makes the two independent derivations (runtime discovery vs
 * lint-time AST) unable to drift apart unnoticed: any mismatch fails the
 * deploy right after traffic switch, while rollback is one step away. It also
 * proves end-to-end that CRON_SECRET is mounted and accepted — the exact
 * misconfiguration that would otherwise silently 401 every scheduled job.
 *
 * Env: CRON_TARGET_URL, CRON_SECRET.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TARGET_URL = process.env.CRON_TARGET_URL;
const SECRET = process.env.CRON_SECRET;
if (!TARGET_URL || !SECRET) {
  console.error('❌ assert-cron-manifest: missing env CRON_TARGET_URL / CRON_SECRET');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.github', 'cron-jobs.json'), 'utf8'));

const response = await fetch(`${TARGET_URL}/api/v1/internal/cron`, {
  headers: { 'x-cron-secret': SECRET },
  signal: AbortSignal.timeout(15_000),
});
if (!response.ok) {
  console.error(
    `❌ GET /internal/cron answered ${response.status} — with a valid secret this must be 200. ` +
      `A 401 means CRON_SECRET on the service and the cron-secret used by Cloud Scheduler have diverged; ` +
      `until that is fixed EVERY scheduled job is silently off.`
  );
  process.exit(1);
}
const body = await response.json();
const live = new Map((body?.data?.jobs ?? []).map((job) => [job.name, job]));

const problems = [];
for (const job of manifest.jobs) {
  const found = live.get(job.name);
  if (!found) {
    problems.push(`manifest job "${job.name}" is NOT in the live registry`);
    continue;
  }
  if (found.cronExpression !== job.schedule) {
    problems.push(
      `"${job.name}" schedule drift: live "${found.cronExpression}" vs manifest "${job.schedule}"`
    );
  }
  if ((found.timeZone ?? null) !== (job.timeZone ?? null)) {
    problems.push(
      `"${job.name}" timeZone drift: live "${found.timeZone}" vs manifest "${job.timeZone}"`
    );
  }
}
for (const name of live.keys()) {
  if (!manifest.jobs.some((job) => job.name === name)) {
    problems.push(`live job "${name}" is missing from the manifest — it will never be scheduled`);
  }
}

if (problems.length > 0) {
  console.error(`❌ Live cron registry does not match .github/cron-jobs.json:`);
  for (const problem of problems) console.error(`   - ${problem}`);
  console.error('   Regenerate with: pnpm lint:cron-manifest --update');
  process.exit(1);
}
console.log(`✅ Live cron registry matches manifest (${manifest.jobs.length} jobs)`);
