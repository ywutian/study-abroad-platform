/**
 * G4: user-data-isolation — Detect Prisma queries missing userId filter in AI agent code.
 *
 * Scope: ai-agent/memory/ + ai-agent/core/
 * Severity: error (multi-tenant data isolation guard)
 *
 * A query passes if its context window contains `userId`, OR one of these
 * governance annotations (each documents WHY a direct userId filter is absent):
 *   // governance: userId validated   — raw query whose SQL filters userId
 *   // governance: parent-scoped      — scoped by a user-owned parent entity or
 *                                       a caller that validates userId
 *   // governance: admin-scope        — cross-user by design, endpoint-gated by
 *                                       @Roles(ADMIN)
 *   // governance: system-scope       — global/non-user data (e.g. routing table)
 *   // governance: batch-operation    — system maintenance batch over all users
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');

const SCAN_DIRS = [
  path.join(ROOT, 'apps/api/src/modules/ai-agent/memory'),
  path.join(ROOT, 'apps/api/src/modules/ai-agent/core'),
];

// Prisma query methods that should include userId filtering
const PRISMA_METHODS = [
  'findMany',
  'findFirst',
  'findUnique',
  'findFirstOrThrow',
  'findUniqueOrThrow',
  'create',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
  'count',
  'aggregate',
];

const PRISMA_PATTERN = new RegExp(`this\\.prisma\\.\\w+\\.(${PRISMA_METHODS.join('|')})\\(`);

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

  for (const dir of SCAN_DIRS) {
    for (const filePath of getAllTsFiles(dir)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comment-only lines (JSDoc, inline comments)
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          continue;
        }

        // Check for Prisma ORM calls
        if (PRISMA_PATTERN.test(line)) {
          // Look back 5 lines + ahead 10 lines for userId or governance annotations
          const contextWindow = lines
            .slice(Math.max(0, i - 5), Math.min(i + 10, lines.length))
            .join('\n');
          if (
            !contextWindow.includes('userId') &&
            !contextWindow.includes('// governance: batch-operation') &&
            !contextWindow.includes('// governance: system-scope') &&
            !contextWindow.includes('// governance: parent-scoped') &&
            !contextWindow.includes('// governance: admin-scope')
          ) {
            issues.push({
              rule: 'user-data-isolation',
              severity: 'error',
              message: `Prisma query without userId filter — potential multi-tenant data leak`,
              file: filePath,
              line: i + 1,
            });
          }
        }

        // Check for raw queries without userId governance comment
        if (line.includes('$queryRaw') || line.includes('$executeRaw')) {
          const contextWindow = lines
            .slice(Math.max(0, i - 5), Math.min(i + 5, lines.length))
            .join('\n');
          if (
            !contextWindow.includes('userId') &&
            !contextWindow.includes('// governance: userId validated') &&
            !contextWindow.includes('// governance: batch-operation') &&
            !contextWindow.includes('// governance: system-scope') &&
            !contextWindow.includes('// governance: parent-scoped') &&
            !contextWindow.includes('// governance: admin-scope')
          ) {
            issues.push({
              rule: 'user-data-isolation',
              severity: 'error',
              message: `Raw query without userId filter or governance annotation`,
              file: filePath,
              line: i + 1,
            });
          }
        }
      }
    }
  }

  return issues;
}
