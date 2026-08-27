import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
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
test('inspection describes the effective dedicated chat model and binding', () => {
  const result = describeRevision({
    spec: {
      containers: [
        {
          env: [
            { name: 'OPENAI_MODEL', value: 'gpt-4o-mini' },
            { name: 'OPENAI_BASE_URL', value: 'https://api.openai.com/v1' },
            { name: 'OPENAI_CHAT_MODEL', value: 'gpt-5.4' },
            { name: 'OPENAI_CHAT_BASE_URL', value: 'https://claude-relay.liziqiao.com/openai/v1' },
            {
              name: 'OPENAI_CHAT_API_KEY',
              valueFrom: { secretKeyRef: { name: 'private-reference' } },
            },
          ],
        },
      ],
    },
  });
  assert.equal(result.model, 'gpt-5.4');
  assert.equal(result.endpoint, 'https://claude-relay.liziqiao.com/openai/v1');
  assert.equal(result.providerSecretBound, true);
  assert.doesNotMatch(JSON.stringify(result), /private-reference/);
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
test('inspection overrides the deploy default and unknown endpoint paths are not emitted', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /inputs.deploy == true && inputs.inspect_release != true/);
  const output = describeRevision({
    spec: {
      containers: [
        { env: [{ name: 'OPENAI_BASE_URL', value: 'https://example.invalid/private-value' }] },
      ],
    },
  });
  assert.equal(output.endpoint, 'other_https_endpoint');
  assert.doesNotMatch(JSON.stringify(output), /private-value/);
});

test('inspection finds DEFAULT-severity Nest provider failures without broadening service scope', () => {
  let query;
  const result = inspectAgentRelease({
    project: 'synthetic',
    region: 'us-central1',
    run: (_bin, args) => {
      if (args[0] !== 'logging') return { status: 0, stdout: '{"status":{}}' };
      query = args[2];
      const coversDefault =
        query.includes('textPayload:"OpenAI API error"') &&
        query.includes('jsonPayload.message:"LLM stream failed"');
      return {
        status: 0,
        stdout: JSON.stringify(
          coversDefault
            ? [
                { severity: 'DEFAULT', textPayload: 'OpenAI API error 401: private-value' },
                {
                  severity: 'DEFAULT',
                  jsonPayload: {
                    message: 'LLM stream failed: Authentication failed: 401 private-value',
                  },
                },
              ]
            : []
        ),
      };
    },
  });
  assert.equal(result.logInspection, 'PASS');
  assert.deepEqual(result.providerErrors, { AUTHENTICATION: 2 });
  assert.match(
    query,
    /^resource.type="cloud_run_revision" AND resource.labels.service_name="study-abroad-api" AND \(severity>=ERROR OR /
  );
  assert.ok(query.endsWith(')'));
  assert.doesNotMatch(JSON.stringify(result), /private-value/);
});
