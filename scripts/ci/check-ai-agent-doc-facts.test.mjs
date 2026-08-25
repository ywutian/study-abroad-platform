import assert from 'node:assert/strict';
import test from 'node:test';
import { checkCurrentRepository, findAiAgentDocFactDrift } from '../check-ai-agent-doc-facts.mjs';

const toolsSource = `
export enum ToolName {
  READ = 'read',
  WRITE = 'write',
}
export const TOOL_METADATA = {
  [ToolName.READ]: value,
  [ToolName.WRITE]: value,
} satisfies Readonly<Record<ToolName, ToolMetadata>>;
export function getToolMetadata() {}
`;

const agentsSource = `
export const AGENT_CONFIGS = {
  [AgentType.ORCHESTRATOR]: {},
  [AgentType.ESSAY]: {},
};
`;

test('current architecture facts match Agent and tool sources', () => {
  const result = checkCurrentRepository();
  assert.equal(result.agentCount, 6);
  assert.equal(result.toolCount, 45);
  assert.equal(result.metadataCount, 45);
  assert.deepEqual(result.errors, []);
});

test('reports missing metadata and stale documentation counts', () => {
  const result = findAiAgentDocFactDrift({
    toolsSource: toolsSource.replace('  [ToolName.WRITE]: value,\n', ''),
    agentsSource,
    brief: '2 Agent configs and 1/1 tool metadata',
    architecture: '## 2. 2 个 Agent\n## 3. 13 Tool Services / 1 Tools',
  });

  assert.deepEqual(result.errors, [
    'ToolName missing metadata: WRITE',
    'BRIEF must state 2 Agent configs and 2/2 tool metadata',
    'architecture must state 13 Tool Services / 2 Tools',
  ]);
});

test('passes when source and documentation facts agree', () => {
  const result = findAiAgentDocFactDrift({
    toolsSource,
    agentsSource,
    brief: '2 Agent configs and 2/2 tool metadata',
    architecture: '## 2. 2 个 Agent\n## 3. 13 Tool Services / 2 Tools',
  });

  assert.deepEqual(result.errors, []);
});
