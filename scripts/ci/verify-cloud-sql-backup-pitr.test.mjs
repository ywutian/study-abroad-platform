import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateCloudSqlEvidence,
  normalizeCloudSqlEvidence,
} from './verify-cloud-sql-backup-pitr.mjs';

test('normalizes only auditable Cloud SQL backup/PITR fields', () => {
  const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const evidence = normalizeCloudSqlEvidence({
    instance: 'study-abroad-db',
    project: 'study-abroad-prod-2025',
    description: {
      name: 'study-abroad-db',
      region: 'us-central1',
      state: 'RUNNABLE',
      databaseVersion: 'POSTGRES_16',
      settings: {
        backupConfiguration: {
          enabled: true,
          pointInTimeRecoveryEnabled: true,
          transactionLogRetentionDays: 7,
          backupRetentionSettings: { retainedBackups: 7 },
          startTime: '03:00',
        },
        sensitive: 'never-copy',
      },
      credentials: 'never-copy',
    },
    backups: [
      {
        id: '42',
        status: 'SUCCESSFUL',
        type: 'AUTOMATED',
        startTime: recent,
        endTime: recent,
        database: 'never-copy',
      },
    ],
  });
  assert.equal(evidence.backup.enabled, true);
  assert.equal(evidence.backup.pointInTimeRecoveryEnabled, true);
  assert.equal(evidence.backup.latest.id, '42');
  assert.equal('credentials' in evidence, false);
  assert.equal(evaluateCloudSqlEvidence(evidence).ok, true);
});

test('fails when PITR or the latest backup is unavailable', () => {
  const result = evaluateCloudSqlEvidence({
    checkedAt: new Date().toISOString(),
    instance: { state: 'RUNNABLE' },
    backup: {
      enabled: true,
      pointInTimeRecoveryEnabled: false,
      latest: {
        status: 'FAILED',
        endTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
    },
  });
  assert.deepEqual(result.errors, [
    'point_in_time_recovery_disabled',
    'latest_backup_not_successful',
  ]);
});

test('selects the newest successful backup independent of CLI ordering', () => {
  const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const recentTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const evidence = normalizeCloudSqlEvidence({
    instance: 'study-abroad-db',
    project: 'study-abroad-prod-2025',
    description: {
      state: 'RUNNABLE',
      settings: {
        backupConfiguration: {
          enabled: true,
          pointInTimeRecoveryEnabled: true,
        },
      },
    },
    backups: [
      { id: 'old', status: 'SUCCESSFUL', endTime: oldTime },
      { id: 'new', status: 'SUCCESSFUL', endTime: recentTime },
    ],
  });
  assert.equal(evidence.backup.latest.id, 'new');
  assert.equal(evaluateCloudSqlEvidence(evidence).ok, true);
});
