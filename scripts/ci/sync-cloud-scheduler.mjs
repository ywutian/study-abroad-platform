/**
 * Provisions one Cloud Scheduler job per entry in `.github/cron-jobs.json`,
 * pointing at `POST <service>/api/v1/internal/cron/<name>/run`.
 *
 * This is the production half of `CRON_DRIVER=http` (see
 * apps/api/src/common/cron/schedule-driver.ts): in prod no `@Cron` timer ever
 * registers — Cloud Scheduler firing an HTTP request is what makes a schedule
 * run, with CPU guaranteed for the request and single-flight by construction.
 *
 * Idempotent: creates missing jobs, updates existing ones, deletes any
 * `api-cron-*` job no longer in the manifest. Never touches jobs outside the
 * `api-cron-` prefix. Runs on every prod deploy (ci.yml), so manual edits in
 * the console are overwritten — the manifest is the single source of truth.
 *
 * Env: GCP_PROJECT_ID, GCP_REGION, CRON_TARGET_URL, CRON_SECRET.
 *
 * One-time GCP setup (documented in docs/DEPLOY_CONFIG.md):
 *   gcloud services enable cloudscheduler.googleapis.com
 *   roles/cloudscheduler.admin on the deploy service account
 *   Secret Manager secret `cron-secret` (also mounted as CRON_SECRET on the service)
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PREFIX = 'api-cron-';

const PROJECT = process.env.GCP_PROJECT_ID;
const LOCATION = process.env.GCP_REGION;
const TARGET_URL = process.env.CRON_TARGET_URL;
const SECRET = process.env.CRON_SECRET;
for (const [name, value] of Object.entries({
  GCP_PROJECT_ID: PROJECT,
  GCP_REGION: LOCATION,
  CRON_TARGET_URL: TARGET_URL,
  CRON_SECRET: SECRET,
})) {
  if (!value) {
    console.error(`❌ sync-cloud-scheduler: missing env ${name}`);
    process.exit(1);
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.github', 'cron-jobs.json'), 'utf8'));

function gcloud(args, { json = false } = {}) {
  // execFileSync (not shell) so the secret never appears in a shell string;
  // stdio piped so it never appears in the step log either.
  const out = execFileSync('gcloud', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return json ? JSON.parse(out || '[]') : out;
}

let existing;
try {
  existing = gcloud(
    [
      'scheduler',
      'jobs',
      'list',
      `--location=${LOCATION}`,
      `--project=${PROJECT}`,
      '--format=json',
    ],
    { json: true }
  );
} catch (err) {
  console.error(
    '❌ Could not list Cloud Scheduler jobs. If this is the first run, check the one-time setup in docs/DEPLOY_CONFIG.md ' +
      '(cloudscheduler.googleapis.com enabled + roles/cloudscheduler.admin on the deploy service account).'
  );
  console.error(String(err.stderr ?? err.message).slice(0, 1000));
  process.exit(1);
}

const existingIds = new Set(
  existing.map((job) => job.name.split('/').pop()).filter((id) => id.startsWith(PREFIX))
);

let created = 0;
let updated = 0;
let deleted = 0;

for (const job of manifest.jobs) {
  const id = `${PREFIX}${job.name}`;
  const isUpdate = existingIds.has(id);
  const args = [
    'scheduler',
    'jobs',
    isUpdate ? 'update' : 'create',
    'http',
    id,
    `--location=${LOCATION}`,
    `--project=${PROJECT}`,
    `--schedule=${job.schedule}`,
    `--time-zone=${job.timeZone ?? 'Etc/UTC'}`,
    `--uri=${TARGET_URL}/api/v1/internal/cron/${job.name}/run`,
    '--http-method=POST',
    // The request IS the job: the API answers only after the run completes, so
    // the deadline must cover the whole run. 1740s stays under both Cloud
    // Scheduler's 30m HTTP maximum and Cloud Run's --timeout=1800.
    '--attempt-deadline=1740s',
    '--max-retry-attempts=1',
    '--min-backoff=300s',
    `--${isUpdate ? 'update-headers' : 'headers'}=x-cron-secret=${SECRET}`,
    '--quiet',
  ];
  try {
    gcloud(args);
    isUpdate ? updated++ : created++;
  } catch (err) {
    console.error(`❌ Failed to ${isUpdate ? 'update' : 'create'} scheduler job ${id}`);
    console.error(String(err.stderr ?? err.message).slice(0, 1000));
    process.exit(1);
  }
}

const desiredIds = new Set(manifest.jobs.map((job) => `${PREFIX}${job.name}`));
for (const id of existingIds) {
  if (desiredIds.has(id)) continue;
  try {
    gcloud([
      'scheduler',
      'jobs',
      'delete',
      id,
      `--location=${LOCATION}`,
      `--project=${PROJECT}`,
      '--quiet',
    ]);
    deleted++;
  } catch (err) {
    console.error(`❌ Failed to delete stale scheduler job ${id}`);
    console.error(String(err.stderr ?? err.message).slice(0, 1000));
    process.exit(1);
  }
}

console.log(
  `✅ Cloud Scheduler in sync: ${manifest.jobs.length} jobs (${created} created, ${updated} updated, ${deleted} pruned)`
);
