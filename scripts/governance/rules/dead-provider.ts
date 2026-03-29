/**
 * G5: dead-provider — Detect providers in ai-agent.module.ts that are never injected anywhere.
 *
 * Only checks ai-agent.module.ts providers array.
 * Excludes: Gateway, Guard, Middleware, Controller, exports, useFactory/useClass/useValue, @Cron.
 * Severity: warning
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');

// Service names that are not directly injected but serve special purposes
const EXCLUDED_SUFFIXES = ['Gateway', 'Guard', 'Middleware', 'Controller'];

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      results.push(...getAllTsFiles(fullPath));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.e2e-spec.ts')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];

  const modulePath = path.join(ROOT, 'apps/api/src/modules/ai-agent/ai-agent.module.ts');
  const moduleContent = fs.readFileSync(modulePath, 'utf-8');

  // Extract provider names from the providers array
  // Match simple class names (not { provide: ..., useValue: ... } patterns)
  const providersMatch = moduleContent.match(/providers:\s*\[([\s\S]*?)\]/);
  if (!providersMatch) return issues;

  const providersBlock = providersMatch[1];

  // Extract simple provider names (not object patterns like { provide: ... })
  const providerNames: string[] = [];
  for (const line of providersBlock.split('\n')) {
    const trimmed = line.trim().replace(/,\s*$/, '');
    // Skip empty lines, comments, and object provider definitions
    if (
      !trimmed ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('}')
    ) {
      continue;
    }
    // Simple class name
    if (/^[A-Z][a-zA-Z]+$/.test(trimmed)) {
      providerNames.push(trimmed);
    }
  }

  // Check each provider for exclusion criteria
  const exportMatch = moduleContent.match(/exports:\s*\[([\s\S]*?)\]/);
  const exportBlock = exportMatch ? exportMatch[1] : '';

  for (const name of providerNames) {
    // Skip excluded suffixes
    if (EXCLUDED_SUFFIXES.some((s) => name.endsWith(s))) continue;

    // Skip if in exports
    if (exportBlock.includes(name)) continue;

    // Search all non-spec ts files in ai-agent for injection (constructor param or @Inject)
    const aiAgentDir = path.join(ROOT, 'apps/api/src/modules/ai-agent');
    const allFiles = getAllTsFiles(aiAgentDir);

    let isInjected = false;
    for (const filePath of allFiles) {
      if (filePath === modulePath) continue; // Skip module file itself

      const content = fs.readFileSync(filePath, 'utf-8');
      // Check for constructor injection or @Inject
      if (
        content.includes(`private ${name.charAt(0).toLowerCase() + name.slice(1)}`) ||
        content.includes(`private readonly ${name.charAt(0).toLowerCase() + name.slice(1)}`) ||
        content.includes(name) // Referenced anywhere
      ) {
        isInjected = true;
        break;
      }
    }

    // Also check if it has @Cron decorator
    if (!isInjected) {
      for (const filePath of allFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes(`class ${name}`) && content.includes('@Cron')) {
          isInjected = true;
          break;
        }
      }
    }

    if (!isInjected) {
      issues.push({
        rule: 'dead-provider',
        severity: 'warning',
        message: `Provider '${name}' in ai-agent.module.ts is not injected by any service in the module`,
        file: modulePath,
      });
    }
  }

  return issues;
}
