/**
 * G8: api-route-shared-constants — Frontend API calls should use shared route constants.
 *
 * Detects hardcoded API paths in frontend code (e.g., '/admin/reports')
 * instead of using constants from @study-abroad/shared.
 * Severity: warning
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');
const WEB_SRC = path.join(ROOT, 'apps/web/src');

// Common API path patterns that should use shared constants
const HARDCODED_PATTERNS = [
  /apiClient\.(get|post|put|patch|delete)\(\s*[`'"]\/(?!api\/)(admin|profiles|schools|predictions|recommendations|essay-ai|cases|chats|forums|users)/,
];

// Files to exclude (hooks that define the paths, test files)
const EXCLUDED_FILES = ['/hooks/', '/lib/api/', '.spec.', '.test.', '__tests__'];

function getAllTsxFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      results.push(...getAllTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];
  const files = getAllTsxFiles(WEB_SRC);

  for (const filePath of files) {
    const relPath = filePath.replace(ROOT + '/', '');

    // Skip excluded files
    if (EXCLUDED_FILES.some((exc) => relPath.includes(exc))) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Skip files that already import from shared
    if (content.includes('@study-abroad/shared')) continue;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of HARDCODED_PATTERNS) {
        if (pattern.test(line)) {
          issues.push({
            rule: 'api-route-shared-constants',
            severity: 'warning',
            message: `Hardcoded API path found — consider using @study-abroad/shared route constants`,
            file: relPath,
            line: i + 1,
          });
          break;
        }
      }
    }
  }

  return issues;
}
