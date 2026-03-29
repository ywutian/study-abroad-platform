/**
 * G3: config-consistency — Detect direct AGENT_CONFIGS reads outside allowed locations.
 *
 * Only agents.config.ts (definition) and config-validator.service.ts (validation) may read AGENT_CONFIGS.
 * Direct reads elsewhere cause config drift between validated and raw configs.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');

// Files allowed to reference AGENT_CONFIGS directly
const ALLOWED_FILES = new Set([
  'agents.config.ts', // definition
  'config-validator.service.ts', // validation reader
]);

// Paths/patterns excluded from scanning
const EXCLUDED_PATTERNS = [
  /scripts\/governance\//,
  /\.spec\.ts$/,
  /\.e2e-spec\.ts$/,
  /\.md$/,
  /architecture\.spec\.ts$/,
];

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];

  // Scan ai-agent module + agent-runner (which used to have direct AGENT_CONFIGS reads)
  const scanDirs = [path.join(ROOT, 'apps/api/src/modules/ai-agent')];

  for (const dir of scanDirs) {
    for (const filePath of getAllTsFiles(dir)) {
      const fileName = path.basename(filePath);
      const relPath = path.relative(ROOT, filePath);

      // Skip allowed files
      if (ALLOWED_FILES.has(fileName)) continue;

      // Skip excluded patterns
      if (EXCLUDED_PATTERNS.some((p) => p.test(relPath))) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match AGENT_CONFIGS[ (direct access pattern)
        if (/AGENT_CONFIGS\[/.test(line)) {
          // Check if it's a fallback pattern (?? AGENT_CONFIGS) — allowed
          // The ?? may be on the current line or the previous line (multi-line formatting)
          const isFallbackSameLine = /\?\?\s*AGENT_CONFIGS\[/.test(line);
          const isFallbackPrevLine = i > 0 && /\?\?\s*$/.test(lines[i - 1].trimEnd());
          if (isFallbackSameLine || isFallbackPrevLine) continue;

          issues.push({
            rule: 'config-consistency',
            severity: 'error',
            message: `Direct AGENT_CONFIGS[...] read in ${relPath}:${i + 1} — use ConfigValidatorService.getValidatedConfig() instead`,
            file: filePath,
            line: i + 1,
          });
        }
      }
    }
  }

  return issues;
}
