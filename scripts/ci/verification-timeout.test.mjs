import assert from 'node:assert/strict';
import test from 'node:test';
import { verificationTimeoutMs } from './verification-timeout.mjs';

test('verification watchdog keeps default and permits a bounded local override', () => {
  assert.equal(verificationTimeoutMs({}), 120_000);
  for (const value of [120_000, 600_000, 900_000, 3_600_000]) {
    assert.equal(verificationTimeoutMs({ VERIFY_GATE_TIMEOUT_MS: String(value) }), value);
  }
});
test('CI ignores local watchdog overrides', () => {
  for (const CI of ['true', '1']) {
    assert.equal(verificationTimeoutMs({ CI, VERIFY_GATE_TIMEOUT_MS: '600000' }), 120_000);
  }
});
test('invalid or unbounded watchdog values fail closed', () => {
  for (const value of [
    '',
    '0',
    '-1',
    '119999',
    '3600001',
    'Infinity',
    '1e6',
    '600000.5',
    ' 600000',
  ]) {
    assert.throws(() => verificationTimeoutMs({ VERIFY_GATE_TIMEOUT_MS: value }));
  }
});
