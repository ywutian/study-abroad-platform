import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCloudSqlRunJobPlan,
  buildCloudSqlRuntimeCheckScript,
  reasonCodeForRuntimeExitCode,
  resolveRuntimeServiceAccount,
} from './verify-cloud-sql-backup-pitr-via-run-job.mjs';

test('maps runtime task exit codes to stable sanitized reasons', () => {
  assert.equal(reasonCodeForRuntimeExitCode(20), 'cloud_sql_metadata_unavailable');
  assert.equal(reasonCodeForRuntimeExitCode('20'), 'cloud_sql_metadata_unavailable');
  assert.equal(reasonCodeForRuntimeExitCode(32), 'point_in_time_recovery_disabled');
  assert.equal(reasonCodeForRuntimeExitCode(36), 'latest_backup_too_old');
  assert.equal(reasonCodeForRuntimeExitCode(127), 'cloud_run_read_only_check_failed');
  assert.equal(reasonCodeForRuntimeExitCode(undefined), 'cloud_run_read_only_check_failed');
});

test('uses an explicit production service identity when one is configured', () => {
  assert.equal(
    resolveRuntimeServiceAccount('runtime@study-abroad-prod-2025.iam.gserviceaccount.com', ''),
    'runtime@study-abroad-prod-2025.iam.gserviceaccount.com'
  );
});

test('resolves the Cloud Run default Compute identity when the service omits one', () => {
  assert.equal(
    resolveRuntimeServiceAccount('', '123456789012'),
    '123456789012-compute@developer.gserviceaccount.com'
  );
  assert.throws(() => resolveRuntimeServiceAccount('', 'unsafe-project-number'));
});

test('builds a bounded read-only Cloud Run Job using the production service identity', () => {
  const plan = buildCloudSqlRunJobPlan({
    project: 'study-abroad-prod-2025',
    region: 'us-central1',
    instance: 'study-abroad-prod-2025:us-central1:study-abroad-db',
    runtimeServiceAccount: 'runtime@study-abroad-prod-2025.iam.gserviceaccount.com',
    job: 'study-abroad-cloudsql-backup-check',
  });
  assert.equal(plan.normalizedInstance, 'study-abroad-db');
  assert.ok(plan.deployArgs.includes('--max-retries=0'));
  assert.ok(plan.deployArgs.includes('--task-timeout=120s'));
  assert.ok(plan.deployArgs.some((arg) => arg.includes('@sha256:')));
  assert.ok(
    plan.deployArgs.includes(
      '--service-account=runtime@study-abroad-prod-2025.iam.gserviceaccount.com'
    )
  );
  assert.ok(plan.executeArgs.includes('--wait'));
  assert.ok(plan.taskExitCodeArgs('check-123').includes('--execution=check-123'));
  assert.ok(
    plan.taskExitCodeArgs('check-123').includes('--format=value(lastAttemptResult.exitCode)')
  );
});

test('runtime check enforces state, backup, PITR, success, and a 36 hour freshness window', () => {
  const script = buildCloudSqlRuntimeCheckScript();
  assert.match(script, /state.*RUNNABLE/s);
  assert.match(script, /backup_enabled.*true/s);
  assert.match(script, /pitr_enabled.*true/s);
  assert.match(script, /latest_status.*SUCCESSFUL/s);
  assert.match(script, /age_seconds.*129600/s);
  assert.match(script, /exit 20/);
  assert.match(script, /exit 36/);
  assert.doesNotMatch(script, /delete|restore|update|patch/i);
});

test('rejects unsafe resource names and a cross-project connection name', () => {
  const base = {
    project: 'study-abroad-prod-2025',
    region: 'us-central1',
    instance: 'study-abroad-db',
    runtimeServiceAccount: 'runtime@study-abroad-prod-2025.iam.gserviceaccount.com',
    job: 'study-abroad-cloudsql-backup-check',
  };
  assert.throws(() => buildCloudSqlRunJobPlan({ ...base, job: 'unsafe;job' }));
  assert.throws(() =>
    buildCloudSqlRunJobPlan({
      ...base,
      instance: 'other-project:us-central1:study-abroad-db',
    })
  );
});
