/**
 * Keep high-value AI Agent documentation facts tied to the TypeScript sources
 * that define them. This intentionally checks only stable architecture facts;
 * release-specific metrics belong in dated reports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function enumBody(source, enumName) {
  const match = source.match(new RegExp(`export enum ${enumName} \\{([\\s\\S]*?)\\n\\}`));
  return match?.[1] ?? '';
}

export function extractToolEnumMembers(source) {
  return new Set(
    [...enumBody(source, 'ToolName').matchAll(/^\s*([A-Z][A-Z0-9_]+)\s*=/gm)].map(
      (match) => match[1]
    )
  );
}

export function extractToolMetadataMembers(source) {
  const start = source.indexOf('export const TOOL_METADATA =');
  const end = source.indexOf('export function getToolMetadata', start);
  const block = start >= 0 && end > start ? source.slice(start, end) : '';
  return new Set([...block.matchAll(/\[ToolName\.([A-Z][A-Z0-9_]+)\]/g)].map((match) => match[1]));
}

export function extractAgentConfigCount(source) {
  return new Set(
    [...source.matchAll(/^\s*\[AgentType\.([A-Z][A-Z0-9_]+)\]:\s*\{/gm)].map((match) => match[1])
  ).size;
}

export function findAiAgentDocFactDrift({ toolsSource, agentsSource, brief, architecture }) {
  const tools = extractToolEnumMembers(toolsSource);
  const metadata = extractToolMetadataMembers(toolsSource);
  const agentCount = extractAgentConfigCount(agentsSource);
  const toolCount = tools.size;

  const errors = [];
  const missingMetadata = [...tools].filter((member) => !metadata.has(member)).sort();
  const unknownMetadata = [...metadata].filter((member) => !tools.has(member)).sort();
  if (missingMetadata.length > 0) {
    errors.push(`ToolName missing metadata: ${missingMetadata.join(', ')}`);
  }
  if (unknownMetadata.length > 0) {
    errors.push(`metadata without ToolName: ${unknownMetadata.join(', ')}`);
  }
  if (!brief.includes(`${agentCount} Agent configs and ${toolCount}/${toolCount} tool metadata`)) {
    errors.push(
      `BRIEF must state ${agentCount} Agent configs and ${toolCount}/${toolCount} tool metadata`
    );
  }
  if (!architecture.includes(`## 2. ${agentCount} 个 Agent`)) {
    errors.push(`architecture must state ${agentCount} Agents`);
  }
  if (!architecture.includes(`## 3. 13 Tool Services / ${toolCount} Tools`)) {
    errors.push(`architecture must state 13 Tool Services / ${toolCount} Tools`);
  }

  return { agentCount, toolCount, metadataCount: metadata.size, errors };
}

export function checkCurrentRepository(root = ROOT) {
  return findAiAgentDocFactDrift({
    toolsSource: fs.readFileSync(
      path.join(root, 'apps/api/src/modules/ai-agent/config/tools.config.ts'),
      'utf8'
    ),
    agentsSource: fs.readFileSync(
      path.join(root, 'apps/api/src/modules/ai-agent/config/agents.config.ts'),
      'utf8'
    ),
    brief: fs.readFileSync(path.join(root, 'apps/api/src/modules/ai-agent/BRIEF.md'), 'utf8'),
    architecture: fs.readFileSync(path.join(root, 'docs/architecture/ai-system.md'), 'utf8'),
  });
}

function main() {
  const result = checkCurrentRepository();
  if (result.errors.length > 0) {
    console.error('\n❌ AI Agent documentation fact drift detected:\n');
    for (const error of result.errors) console.error(`   - ${error}`);
    console.error('\nUpdate source, BRIEF, and architecture facts together.\n');
    process.exit(1);
  }
  console.log(
    `✅ AI Agent docs match ${result.agentCount} Agent configs and ${result.toolCount}/${result.metadataCount} Tool metadata entries.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
