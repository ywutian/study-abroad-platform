import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { normalizeCloudSqlInstanceReference } from './verify-cloud-sql-backup-pitr.mjs';

const RESOURCE_NAME_PATTERN = /^[a-z][a-z0-9-]{0,61}[a-z0-9]$|^[a-z]$/;
const REGION_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const SERVICE_ACCOUNT_PATTERN = /^[a-z0-9-]+@(?:[a-z0-9.-]+\.iam|developer)\.gserviceaccount\.com$/;
const PROJECT_NUMBER_PATTERN = /^\d{6,20}$/;
const RUNTIME_EXIT_REASONS = new Map([
  [20, 'cloud_sql_metadata_unavailable'],
  [21, 'cloud_sql_backups_unavailable'],
  [30, 'instance_not_runnable'],
  [31, 'automated_backup_disabled'],
  [32, 'point_in_time_recovery_disabled'],
  [33, 'latest_backup_not_successful'],
  [34, 'latest_backup_timestamp_missing'],
  [35, 'latest_backup_timestamp_in_future'],
  [36, 'latest_backup_too_old'],
]);
const CLOUD_SDK_IMAGE =
  'gcr.io/google.com/cloudsdktool/google-cloud-cli:568.0.0-stable@sha256:bfd990926dc584ef463e5ebb1d2960a0c6e8b96e089ecfad12b84935f0bc8f6d';

function runGcloud(args, options = {}) {
  return execFileSync('gcloud', args, {
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
}

export function resolveRuntimeServiceAccount(explicitServiceAccount, projectNumber) {
  const normalizedExplicitServiceAccount = explicitServiceAccount.trim();
  if (normalizedExplicitServiceAccount) return normalizedExplicitServiceAccount;
  const normalizedProjectNumber = projectNumber.trim();
  if (!PROJECT_NUMBER_PATTERN.test(normalizedProjectNumber)) {
    throw new Error('invalid_cloud_run_project_number');
  }
  return `${normalizedProjectNumber}-compute@developer.gserviceaccount.com`;
}

export function reasonCodeForRuntimeExitCode(exitCode) {
  return RUNTIME_EXIT_REASONS.get(Number(exitCode)) ?? 'cloud_run_read_only_check_failed';
}

export function findRuntimeTaskExitCode(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const exitCode = findRuntimeTaskExitCode(item);
      if (exitCode !== undefined) return exitCode;
    }
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  for (const [key, item] of Object.entries(value)) {
    if (key === 'exitCode' && Number.isFinite(Number(item))) return Number(item);
    const exitCode = findRuntimeTaskExitCode(item);
    if (exitCode !== undefined) return exitCode;
  }
  return undefined;
}

export function buildCloudSqlRuntimeCheckScript() {
  return `set -euo pipefail
state="$(gcloud sql instances describe "$INSTANCE_ID" --project="$PROJECT_ID" --format='value(state)' 2>/dev/null)" || exit 20
backup_enabled="$(gcloud sql instances describe "$INSTANCE_ID" --project="$PROJECT_ID" --format='value(settings.backupConfiguration.enabled)' 2>/dev/null)" || exit 20
pitr_enabled="$(gcloud sql instances describe "$INSTANCE_ID" --project="$PROJECT_ID" --format='value(settings.backupConfiguration.pointInTimeRecoveryEnabled)' 2>/dev/null)" || exit 20
latest_status="$(gcloud sql backups list --instance="$INSTANCE_ID" --project="$PROJECT_ID" --limit=1 --sort-by='~endTime' --format='value(status)' 2>/dev/null)" || exit 21
latest_end="$(gcloud sql backups list --instance="$INSTANCE_ID" --project="$PROJECT_ID" --limit=1 --sort-by='~endTime' --format='value(endTime)' 2>/dev/null)" || exit 21
latest_start="$(gcloud sql backups list --instance="$INSTANCE_ID" --project="$PROJECT_ID" --limit=1 --sort-by='~endTime' --format='value(startTime)' 2>/dev/null)" || exit 21
latest_time="$latest_end"
test -n "$latest_time" || latest_time="$latest_start"
test "$state" = RUNNABLE || exit 30
test "$backup_enabled" = True -o "$backup_enabled" = true || exit 31
test "$pitr_enabled" = True -o "$pitr_enabled" = true || exit 32
test "$latest_status" = SUCCESSFUL -o "$latest_status" = COMPLETED || exit 33
test -n "$latest_time" || exit 34
now_epoch="$(date -u +%s)"
latest_epoch="$(date -u -d "$latest_time" +%s)" || exit 34
age_seconds="$((now_epoch-latest_epoch))"
test "$age_seconds" -ge -300 || exit 35
test "$age_seconds" -le 129600 || exit 36
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
    taskResultArgs(execution) {
      return [
        'run',
        'jobs',
        'executions',
        'tasks',
        'list',
        `--execution=${execution}`,
        `--project=${project}`,
        `--region=${region}`,
        '--format=json',
      ];
    },
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
    const explicitRuntimeServiceAccount = runGcloud([
      'run',
      'services',
      'describe',
      args.service,
      `--project=${args.project}`,
      `--region=${args.region}`,
      '--format=value(spec.template.spec.serviceAccountName)',
    ]).trim();
    const projectNumber = explicitRuntimeServiceAccount
      ? ''
      : runGcloud(['projects', 'describe', args.project, '--format=value(projectNumber)']).trim();
    const runtimeServiceAccount = resolveRuntimeServiceAccount(
      explicitRuntimeServiceAccount,
      projectNumber
    );
    const plan = buildCloudSqlRunJobPlan({
      project: args.project,
      region: args.region,
      instance: args.instance,
      runtimeServiceAccount,
      job,
    });
    normalizedInstance = plan.normalizedInstance;
    runGcloud(plan.deployArgs, { inherit: true });
    let executionFailure;
    try {
      runGcloud(plan.executeArgs, { inherit: true });
    } catch (error) {
      executionFailure = error;
    }
    const execution = runGcloud(plan.latestExecutionArgs).trim().split('\n')[0];
    if (!execution) throw new Error('cloud_run_execution_not_found');
    if (executionFailure) {
      const exitCode = findRuntimeTaskExitCode(
        JSON.parse(runGcloud(plan.taskResultArgs(execution)))
      );
      throw new Error(reasonCodeForRuntimeExitCode(exitCode));
    }
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
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';
    const reasonCode = new Set([
      ...RUNTIME_EXIT_REASONS.values(),
      'cloud_run_read_only_check_failed',
    ]).has(errorMessage)
      ? errorMessage
      : 'cloud_run_read_only_check_failed';
    fs.writeFileSync(
      output,
      `${JSON.stringify({
        schemaVersion: 'cloud-sql-backup-pitr-v1',
        checkedAt: new Date().toISOString(),
        instance: { name: normalizedInstance ?? 'invalid', project: args.project ?? 'invalid' },
        pass: false,
        reasonCodes: [reasonCode],
      })}\n`,
      { encoding: 'utf8', mode: 0o600 }
    );
    console.error(`::error::Cloud SQL runtime verification failed: ${reasonCode}`);
    process.exit(1);
  }
}
