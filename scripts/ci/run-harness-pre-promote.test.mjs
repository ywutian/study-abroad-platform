import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runPrePromotionAcceptance } from './run-harness-pre-promote.mjs';

const env = {
  HARNESS_API_BASE: 'https://synthetic.example/api/v1',
  HARNESS_ADMIN_PASSWORD: 'synthetic-not-a-secret',
  HARNESS_EXPECTED_REVISION: 'synthetic-revision',
};
for (const [runner, validator, expected] of [
  [0, 0, 0],
  [1, 0, 1],
  [0, 1, 1],
  [null, 0, 1],
  [0, null, 1],
]) {
  test(`pre-promote gate requires runner=${runner} AND validator=${validator}`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'harness-pre-promote-test-'));
    const calls = [];
    try {
      const result = runPrePromotionAcceptance({
        env,
        directory,
        spawn: (_node, args, options) => {
          calls.push({ args, options });
          return {
            status: calls.length === 1 ? runner : validator,
            stdout: '{}\n',
            stderr: 'untrusted upstream text',
          };
        },
      });
      assert.equal(result, expected);
      assert.deepEqual(calls[0].args, [
        '--import',
        'tsx',
        'apps/api/scripts/ai-agent-harness-acceptance.ts',
        '--production',
      ]);
      assert.equal(calls[1].options.env.HARNESS_EVIDENCE_INPUT, `${directory}/runner.jsonl`);
      assert.equal(calls[0].options.timeout, 600000);
      assert.equal(
        JSON.parse(readFileSync(`${directory}/harness-acceptance.json`, 'utf8')).pass,
        false
      );
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
}
test('missing protected configuration never starts a runner', () => {
  const directory = mkdtempSync(join(tmpdir(), 'harness-pre-promote-test-'));
  try {
    assert.equal(
      runPrePromotionAcceptance({
        env: {},
        directory,
        spawn: () => {
          throw Error('must not spawn');
        },
      }),
      2
    );
  } finally {
    rmSync(directory, { recursive: true });
  }
});
test('CI validates isolated revision before 100% and keeps post-promote gate and rollback', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const before = workflow.indexOf('- name: Run Harness acceptance before traffic promotion');
  const promote = workflow.indexOf('- name: Promote canary to full traffic');
  const after = workflow.indexOf('- name: Run Harness production acceptance after 100% promotion');
  assert.ok(before > 0 && before < promote && promote < after);
  assert.match(workflow.slice(before, promote), /steps.canary-smoke.outputs.canary_url/);
  assert.match(workflow.slice(before, promote), /steps.deploy-canary.outputs.revision/);
  assert.doesNotMatch(workflow.slice(before, promote), /continue-on-error/);
  assert.match(workflow.slice(after), /- name: Rollback on failure/);
});
