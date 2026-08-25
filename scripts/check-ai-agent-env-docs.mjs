/**
 * Prevent validated AI Agent configuration, ENV_TEMPLATE documentation, and
 * the production Cloud Run command from drifting apart.
 *
 * Usage: node scripts/check-ai-agent-env-docs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function extractValidatedAiAgentKeys(schemaText) {
  return new Set(
    [...schemaText.matchAll(/^\s*(AI_AGENT_[A-Z0-9_]+):\s*z\./gm)].map((match) => match[1])
  );
}

export function extractTemplateAiAgentKeys(templateText) {
  return new Set([...templateText.matchAll(/^(AI_AGENT_[A-Z0-9_]+)=/gm)].map((match) => match[1]));
}

export function extractDeployedAiAgentKeys(workflowText) {
  return new Set([...workflowText.matchAll(/\b(AI_AGENT_[A-Z0-9_]+)=/g)].map((match) => match[1]));
}

export function findAiAgentEnvDrift({ schemaText, templateText, workflowText }) {
  const validated = extractValidatedAiAgentKeys(schemaText);
  const documented = extractTemplateAiAgentKeys(templateText);
  const deployed = extractDeployedAiAgentKeys(workflowText);

  return {
    validated: [...validated].sort(),
    missingFromTemplate: [...validated].filter((key) => !documented.has(key)).sort(),
    missingFromProductionDeploy: [...validated].filter((key) => !deployed.has(key)).sort(),
  };
}

export function checkCurrentRepository(root = ROOT) {
  const schemaText = fs.readFileSync(
    path.join(root, 'apps/api/src/common/config/env.validation.ts'),
    'utf8'
  );
  const templateText = fs.readFileSync(path.join(root, 'ENV_TEMPLATE.md'), 'utf8');
  const workflowText = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  return findAiAgentEnvDrift({ schemaText, templateText, workflowText });
}

function main() {
  const result = checkCurrentRepository();
  const errors = [];

  if (result.missingFromTemplate.length > 0) {
    errors.push(`ENV_TEMPLATE.md is missing: ${result.missingFromTemplate.join(', ')}`);
  }
  if (result.missingFromProductionDeploy.length > 0) {
    errors.push(
      `.github/workflows/ci.yml production deploy is missing: ${result.missingFromProductionDeploy.join(', ')}`
    );
  }

  if (errors.length > 0) {
    console.error('\n❌ AI Agent environment configuration drift detected:\n');
    for (const error of errors) console.error(`   - ${error}`);
    console.error(
      '\nUpdate the Zod schema, ENV_TEMPLATE.md, and production deploy command together.\n'
    );
    process.exit(1);
  }

  console.log(
    `✅ ${result.validated.length} validated AI_AGENT_* settings are documented and explicit in the production deploy.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
