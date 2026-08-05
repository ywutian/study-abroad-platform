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

// The guard is the ONLY thing between the internet and 29 jobs, one of which
// is irreversible hard deletion — and detaching it (`@UseGuards` deleted) left
// every unit test green during review. So prove refusal against the real
// deployed service before trusting anything else it says.
const unauthenticated = await fetch(`${TARGET_URL}/api/v1/internal/cron`, {
  signal: AbortSignal.timeout(15_000),
});
if (unauthenticated.status !== 401) {
  console.error(
    `❌ GET /internal/cron WITHOUT a secret answered ${unauthenticated.status}, expected 401. ` +
      `The cron dispatcher is exposed — it can trigger any scheduled job, including account purge.`
  );
  process.exit(1);
}

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
const payload = body?.data ?? {};
const live = new Map((payload.jobs ?? []).map((job) => [job.name, job]));

// The driver itself. `--set-env-vars` REPLACES the whole set, so CRON_DRIVER
// can fall out of the deploy line silently — and every other check here would
// still pass while prod ran BOTH starved in-process timers and Cloud
// Scheduler, i.e. #553 restored with no red anywhere.
if (payload.driver !== 'http') {
  console.error(
    `❌ Live service reports cron driver "${payload.driver}", expected "http". ` +
      `CRON_DRIVER is missing from the deploy's --set-env-vars, so in-process @Cron timers ` +
      `are running on a CPU-throttled service — the exact failure this driver removes.`
  );
  process.exit(1);
}
if (payload.inProcessTimers !== 0) {
  console.error(
    `❌ Live service has ${payload.inProcessTimers} in-process cron timer(s) registered; expected 0 under the http driver.`
  );
  process.exit(1);
}

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
console.log(
  `✅ Live cron registry matches manifest (${manifest.jobs.length} jobs), driver=http, 0 in-process timers, dispatcher refuses unauthenticated callers`
);
