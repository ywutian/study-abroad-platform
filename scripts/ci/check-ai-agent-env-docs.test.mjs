import assert from 'node:assert/strict';
import test from 'node:test';
import { checkCurrentRepository, findAiAgentEnvDrift } from '../check-ai-agent-env-docs.mjs';

test('current repository documents and deploys every validated AI Agent setting', () => {
  const result = checkCurrentRepository();
  assert.ok(result.validated.length > 0);
  assert.deepEqual(result.missingFromTemplate, []);
  assert.deepEqual(result.missingFromProductionDeploy, []);
});

test('reports a validated setting omitted from documentation and production', () => {
  const result = findAiAgentEnvDrift({
    schemaText: `
      AI_AGENT_HARNESS_V1: z.enum(['true', 'false']),
      AI_AGENT_NEW_BOUNDARY: z.string(),
    `,
    templateText: 'AI_AGENT_HARNESS_V1=false\n',
    workflowText: '--set-env-vars=AI_AGENT_HARNESS_V1=true',
  });

  assert.deepEqual(result.missingFromTemplate, ['AI_AGENT_NEW_BOUNDARY']);
  assert.deepEqual(result.missingFromProductionDeploy, ['AI_AGENT_NEW_BOUNDARY']);
});

test('ignores runtime metric names because only Zod settings are configuration', () => {
  const result = findAiAgentEnvDrift({
    schemaText: `AI_AGENT_HARNESS_V1: z.string()`,
    templateText: `
AI_AGENT_HARNESS_V1=false
AI_AGENT_CONTEXT_COMPRESSION_FALLBACK=metric-only
`,
    workflowText: 'AI_AGENT_HARNESS_V1=true',
  });

  assert.deepEqual(result.validated, ['AI_AGENT_HARNESS_V1']);
  assert.deepEqual(result.missingFromTemplate, []);
  assert.deepEqual(result.missingFromProductionDeploy, []);
});
