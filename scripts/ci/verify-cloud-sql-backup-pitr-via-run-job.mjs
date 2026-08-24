import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { normalizeCloudSqlInstanceReference } from './verify-cloud-sql-backup-pitr.mjs';

const RESOURCE_NAME_PATTERN = /^[a-z][a-z0-9-]{0,61}[a-z0-9]$|^[a-z]$/;
const REGION_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const SERVICE_ACCOUNT_PATTERN = /^[a-z0-9-]+@[a-z0-9.-]+\.iam\.gserviceaccount\.com$/;
const CLOUD_SDK_IMAGE =
  'gcr.io/google.com/cloudsdktool/google-cloud-cli:568.0.0-stable@sha256:bfd990926dc584ef463e5ebb1d2960a0c6e8b96e089ecfad12b84935f0bc8f6d';

function runGcloud(args, options = {}) {
  return execFileSync('gcloud', args, {
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
}

export function buildCloudSqlRuntimeCheckScript() {
  return `set -euo pipefail
state="$(gcloud sql instances describe "$INSTANCE_ID" --project="$PROJECT_ID" --format='value(state)')"
backup_enabled="$(gcloud sql instances describe "$INSTANCE_ID" --project="$PROJECT_ID" --format='value(settings.backupConfiguration.enabled)')"
pitr_enabled="$(gcloud sql instances describe "$INSTANCE_ID" --project="$PROJECT_ID" --format='value(settings.backupConfiguration.pointInTimeRecoveryEnabled)')"
latest="$(gcloud sql backups list --instance="$INSTANCE_ID" --project="$PROJECT_ID" --limit=1 --sort-by='~endTime' --format='value(status,endTime,startTime)')"
IFS=$'\\t' read -r latest_status latest_end latest_start <<< "$latest"
latest_time="$latest_end"
test -n "$latest_time" || latest_time="$latest_start"
test "$state" = RUNNABLE
test "$backup_enabled" = True -o "$backup_enabled" = true
test "$pitr_enabled" = True -o "$pitr_enabled" = true
test "$latest_status" = SUCCESSFUL -o "$latest_status" = COMPLETED
test -n "$latest_time"
now_epoch="$(date -u +%s)"
latest_epoch="$(date -u -d "$latest_time" +%s)"
age_seconds="$((now_epoch-latest_epoch))"
test "$age_seconds" -ge -300
test "$age_seconds" -le 129600
printf 'CLOUD_SQL_BACKUP_CHECK_V1 pass=true\\n'`;
}

export function buildCloudSqlRunJobPlan({ project, region, instance, runtimeServiceAccount, job }) {
  const normalizedInstance = normalizeCloudSqlInstanceReference(instance, project);
  if (!REGION_PATTERN.test(region)) throw new Error('invalid_cloud_run_region');
  if (!RESOURCE_NAME_PATTERN.test(job)) throw new Error('invalid_cloud_run_job_name');
  if (!SERVICE_ACCOUNT_PATTERN.test(runtimeServiceAccount)) {
    throw new Error('invalid_cloud_run_service_identity');
  }
  const checkScript = buildCloudSqlRuntimeCheckScript();
  return {
    normalizedInstance,
    deployArgs: [
      'run',
      'jobs',
      'deploy',
      job,
      `--project=${project}`,
      `--region=${region}`,
      `--image=${CLOUD_SDK_IMAGE}`,
      `--service-account=${runtimeServiceAccount}`,
      '--command=bash',
      `--args=-ceu,${checkScript}`,
      `--set-env-vars=PROJECT_ID=${project},INSTANCE_ID=${normalizedInstance}`,
      '--max-retries=0',
      '--task-timeout=120s',
      '--quiet',
    ],
    executeArgs: [
      'run',
      'jobs',
      'execute',
      job,
      `--project=${project}`,
      `--region=${region}`,
      '--wait',
      '--quiet',
    ],
    latestExecutionArgs: [
      'run',
      'jobs',
      'executions',
      'list',
      `--job=${job}`,
      `--project=${project}`,
      `--region=${region}`,
      '--limit=1',
      '--sort-by=~metadata.creationTimestamp',
      '--format=value(metadata.name)',
    ],
  };
}

function parseArgs(argv) {
  const args = {};
  const accepted = new Set([
    '--instance',
    '--project',
    '--region',
    '--service',
    '--job',
    '--output',
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (accepted.has(key)) {
      args[key.slice(2)] = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const job = args.job ?? 'study-abroad-cloudsql-backup-check';
  const output = args.output ?? 'cloud-sql-backup-pitr-evidence.json';
  let normalizedInstance = null;
  try {
    if (!args.instance || !args.project || !args.region || !args.service) {
      throw new Error('missing_cloud_sql_runtime_check_argument');
    }
    const runtimeServiceAccount = runGcloud([
      'run',
      'services',
      'describe',
      args.service,
      `--project=${args.project}`,
      `--region=${args.region}`,
      '--format=value(spec.template.spec.serviceAccountName)',
    ]).trim();
    const plan = buildCloudSqlRunJobPlan({
      project: args.project,
      region: args.region,
      instance: args.instance,
      runtimeServiceAccount,
      job,
    });
    normalizedInstance = plan.normalizedInstance;
    runGcloud(plan.deployArgs, { inherit: true });
    runGcloud(plan.executeArgs, { inherit: true });
    const execution = runGcloud(plan.latestExecutionArgs).trim().split('\n')[0];
    if (!execution) throw new Error('cloud_run_execution_not_found');
    const evidence = {
      schemaVersion: 'cloud-sql-backup-pitr-v1',
      checkedAt: new Date().toISOString(),
      instance: { name: normalizedInstance, project: args.project },
      backup: {
        enabled: true,
        pointInTimeRecoveryEnabled: true,
        latest: { status: 'VERIFIED_RECENT' },
      },
      verification: {
        method: 'cloud_run_service_identity',
        job,
        execution,
      },
      pass: true,
      reasonCodes: [],
    };
    fs.writeFileSync(output, `${JSON.stringify(evidence)}\n`, { encoding: 'utf8', mode: 0o600 });
    console.log(`Cloud SQL backup/PITR runtime verification passed via ${job}`);
  } catch (error) {
    fs.writeFileSync(
      output,
      `${JSON.stringify({
        schemaVersion: 'cloud-sql-backup-pitr-v1',
        checkedAt: new Date().toISOString(),
        instance: { name: normalizedInstance ?? 'invalid', project: args.project ?? 'invalid' },
        pass: false,
        reasonCodes: ['cloud_run_read_only_check_failed'],
      })}\n`,
      { encoding: 'utf8', mode: 0o600 }
    );
    console.error(
      `::error::Cloud SQL runtime verification failed: ${error instanceof Error ? error.message : 'unknown_error'}`
    );
    process.exit(1);
  }
}
