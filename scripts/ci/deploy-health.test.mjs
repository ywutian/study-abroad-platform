import assert from 'node:assert/strict';
import test from 'node:test';
import { extractCanaryUrl } from './cloud-run-canary-url.mjs';
import { evaluateDeployHealth } from './validate-deploy-health.mjs';

test('extracts Cloud Run canary URL from tagged traffic', () => {
  const url = extractCanaryUrl({
    status: {
      traffic: [
        { percent: 100, url: 'https://main.example.com' },
        { tag: 'canary', url: 'https://canary.example.com' },
      ],
    },
  });

  assert.equal(url, 'https://canary.example.com');
});

test('returns empty string when canary URL is missing', () => {
  const url = extractCanaryUrl({ status: { traffic: [{ percent: 100 }] } });

  assert.equal(url, '');
});

test('passes deploy health when only Redis is degraded', () => {
  const result = evaluateDeployHealth({
    httpStatus: 200,
    body: {
      success: true,
      data: {
        status: 'degraded',
        checks: {
          database: { status: 'ok', latencyMs: 7 },
          redis: { status: 'degraded', message: 'Redis not connected' },
        },
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.databaseStatus, 'ok');
  assert.equal(result.redisStatus, 'degraded');
  assert.equal(result.warnings.length, 2);
});

test('fails deploy health when database is degraded', () => {
  const result = evaluateDeployHealth({
    httpStatus: 200,
    body: {
      data: {
        status: 'degraded',
        checks: {
          database: { status: 'degraded', message: 'Slow response' },
          redis: { status: 'ok' },
        },
      },
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['Database check is degraded, expected ok']);
});

test('fails deploy health when HTTP status is not 200', () => {
  const result = evaluateDeployHealth({
    httpStatus: 503,
    body: {
      data: {
        status: 'error',
        checks: {
          database: { status: 'error' },
        },
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0], 'HTTP status is 503, expected 200');
});
