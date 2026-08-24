import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function runGcloud(args) {
  return JSON.parse(
    execFileSync('gcloud', [...args, '--format=json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  );
}

export function normalizeCloudSqlEvidence({ instance, project, description, backups }) {
  const settings = description?.settings ?? {};
  const backup = settings.backupConfiguration ?? {};
  const recent = Array.isArray(backups)
    ? ([...backups].sort((left, right) => {
        const leftTime = Date.parse(left?.endTime ?? left?.startTime ?? '');
        const rightTime = Date.parse(right?.endTime ?? right?.startTime ?? '');
        return (
          (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0)
        );
      })[0] ?? null)
    : null;
  return {
    schemaVersion: 'cloud-sql-backup-pitr-v1',
    checkedAt: new Date().toISOString(),
    instance: {
      name: description?.name ?? instance,
      project,
      region: description?.region ?? null,
      databaseVersion: description?.databaseVersion ?? null,
      state: description?.state ?? null,
    },
    backup: {
      enabled: backup.enabled === true,
      pointInTimeRecoveryEnabled: backup.pointInTimeRecoveryEnabled === true,
      transactionLogRetentionDays: backup.transactionLogRetentionDays ?? null,
      retainedBackups: backup.backupRetentionSettings?.retainedBackups ?? null,
      startTime: backup.startTime ?? null,
      latest: recent
        ? {
            id: recent.id ?? null,
            status: recent.status ?? null,
            type: recent.type ?? null,
            startTime: recent.startTime ?? null,
            endTime: recent.endTime ?? null,
          }
        : null,
    },
  };
}

export function evaluateCloudSqlEvidence(evidence) {
  const errors = [];
  if (evidence.instance?.state !== 'RUNNABLE') errors.push('instance_not_runnable');
  if (evidence.backup.enabled !== true) errors.push('automated_backup_disabled');
  if (evidence.backup.pointInTimeRecoveryEnabled !== true) {
    errors.push('point_in_time_recovery_disabled');
  }
  if (!evidence.backup.latest) errors.push('no_backup_record_found');
  if (
    evidence.backup.latest &&
    !['SUCCESSFUL', 'COMPLETED'].includes(evidence.backup.latest.status)
  ) {
    errors.push('latest_backup_not_successful');
  }
  const latestTimestamp = evidence.backup.latest?.endTime ?? evidence.backup.latest?.startTime;
  const latestMs = typeof latestTimestamp === 'string' ? Date.parse(latestTimestamp) : Number.NaN;
  const checkedMs = Date.parse(evidence.checkedAt);
  if (
    !Number.isFinite(latestMs) ||
    !Number.isFinite(checkedMs) ||
    checkedMs - latestMs > 36 * 60 * 60 * 1000 ||
    latestMs > checkedMs + 5 * 60 * 1000
  ) {
    errors.push('latest_backup_outside_36h_window');
  }
  return { ok: errors.length === 0, errors };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (['--instance', '--project', '--output'].includes(key)) {
      args[key.slice(2)] = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const instance = args.instance ?? process.env.GCP_CLOUDSQL_INSTANCE;
  const project = args.project ?? process.env.GCP_PROJECT_ID;
  const output = args.output ?? 'cloud-sql-backup-pitr-evidence.json';
  if (!instance || !project) {
    console.error('Missing --instance/--project or GCP_CLOUDSQL_INSTANCE/GCP_PROJECT_ID');
    process.exit(2);
  }
  try {
    const description = runGcloud([
      'sql',
      'instances',
      'describe',
      instance,
      `--project=${project}`,
    ]);
    const backups = runGcloud([
      'sql',
      'backups',
      'list',
      `--instance=${instance}`,
      `--project=${project}`,
      '--limit=5',
    ]);
    const evidence = normalizeCloudSqlEvidence({
      instance,
      project,
      description,
      backups,
    });
    const evaluation = evaluateCloudSqlEvidence(evidence);
    fs.writeFileSync(
      output,
      `${JSON.stringify({ ...evidence, pass: evaluation.ok, reasonCodes: evaluation.errors })}\n`,
      'utf8'
    );
    if (!evaluation.ok) {
      for (const error of evaluation.errors) console.error(`::error::${error}`);
      process.exit(1);
    }
    console.log(`Cloud SQL backup/PITR verification passed for ${evidence.instance.name}`);
  } catch (error) {
    fs.writeFileSync(
      output,
      `${JSON.stringify({
        schemaVersion: 'cloud-sql-backup-pitr-v1',
        checkedAt: new Date().toISOString(),
        instance: { name: instance, project },
        pass: false,
        reasonCodes: ['gcloud_read_only_check_failed'],
      })}\n`,
      'utf8'
    );
    console.error(
      `::error::Cloud SQL read-only verification failed: ${error instanceof Error ? error.message : 'unknown_error'}`
    );
    process.exit(1);
  }
}
