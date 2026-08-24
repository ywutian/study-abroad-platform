import assert from 'node:assert/strict';
import test from 'node:test';
import { validateHarnessEvidence } from './validate-harness-acceptance-evidence.mjs';

const scenarios = [
  'declarative_skills_boundary',
  'skill_version_pinning',
  'memory_disabled',
  'context_compression',
  'context_compression_fallback',
  'approval_disconnect_recovery',
  'budget_exhaustion',
  'cleanup',
];

function fixture(extra = {}) {
  return scenarios
    .map((scenario) =>
      JSON.stringify({
        utc: '2026-08-24T00:00:00.000Z',
        revision: 'api-001',
        scenario,
        pass: true,
        reasonCode: 'OK',
        ...extra,
      })
    )
    .join('\n');
}

test('rejects any field outside the strict evidence allowlist', () => {
  const result = validateHarnessEvidence({
    text: fixture({ accessToken: 'must-not-be-accepted' }),
    expectedRevision: 'api-001',
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.includes('line_1_unsafe_fields'), true);
});

test('accepts every current production scenario with bounded numeric evidence', () => {
  const result = validateHarnessEvidence({
    text: fixture({
      autoPublishEnabled: true,
      memoriesBefore: 0,
      memoriesAfter: 0,
      entitiesBefore: 0,
      entitiesAfter: 0,
      alertPersisted: true,
      alertAcknowledged: true,
    }),
    expectedRevision: 'api-001',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('rejects a failed scenario and revision mismatch', () => {
  const records = fixture()
    .split('\n')
    .map((line) => JSON.parse(line));
  records[0].revision = 'api-old';
  records[6].pass = false;
  const text = records.map((record) => JSON.stringify(record)).join('\n');
  const result = validateHarnessEvidence({ text, expectedRevision: 'api-001' });
  assert.equal(result.ok, false);
  assert.equal(result.errors.includes('line_1_revision_mismatch'), true);
  assert.equal(result.errors.includes('scenario_budget_exhaustion_failed'), true);
});
