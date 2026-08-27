import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeRevision,
  inspectAgentRelease,
  summarizeErrors,
} from './inspect-agent-release.mjs';

test('revision projection never emits secrets, user data, environment dump or URL credentials', () => {
  const output = describeRevision({
    metadata: { name: 'synthetic-revision' },
    spec: {
      containers: [
        {
          env: [
            { name: 'OPENAI_API_KEY', value: 'private-value' },
            { name: 'JWT_SECRET', value: 'private-value' },
            {
              name: 'OPENAI_BASE_URL',
              value: 'https://user:private-value@example.invalid/v1?key=private-value',
            },
            { name: 'LLM_PROVIDER', value: 'openai' },
            { name: 'OPENAI_MODEL', value: 'gpt-5.4' },
          ],
        },
      ],
    },
  });
  assert.equal(output.endpoint, null);
  assert.equal(output.provider, 'openai');
  assert.doesNotMatch(JSON.stringify(output), /private-value|JWT_SECRET|OPENAI_API_KEY/);
});
test('upstream error payloads become only fixed categories and counts', () => {
  const output = summarizeErrors([
    { textPayload: 'OpenAI 401 private-user-and-key' },
    { textPayload: 'LLM insufficient_quota private-prompt' },
    { textPayload: 'Unrelated private data' },
  ]);
  assert.deepEqual(output, { AUTHENTICATION: 1, QUOTA: 1 });
});
test('inspection uses only describe/logging read, never secrets access or writes', () => {
  const commands = [];
  const result = inspectAgentRelease({
    project: 'synthetic',
    region: 'us-central1',
    run: (_bin, args) => {
      commands.push(args);
      const payload = args.includes('services')
        ? {
            status: {
              traffic: [{ revisionName: 'rev-1', percent: 100 }],
              latestCreatedRevisionName: 'rev-2',
            },
          }
        : args[0] === 'logging'
          ? []
          : { metadata: { name: args[3] } };
      return { status: 0, stdout: JSON.stringify(payload) };
    },
  });
  assert.equal(result.readOnly, true);
  assert.deepEqual(result.traffic, [{ revision: 'rev-1', percent: 100 }]);
  assert.equal(commands.length, 4);
  assert.ok(
    commands.every(
      (args) => args.includes('describe') || (args[0] === 'logging' && args[1] === 'read')
    )
  );
});
