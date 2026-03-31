/**
 * G14: component-size-limit — Flag .tsx components exceeding 500 lines.
 *
 * Scans apps/web/src/ for .tsx files that are too large, indicating
 * they should be split into sub-components.
 * Excludes: test files, _components subdirectories (already extracted).
 * Severity: warning
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');
const WEB_SRC = path.join(ROOT, 'apps/web/src');
const LINE_LIMIT = 500;

const EXCLUDED_PATTERNS = ['/__tests__/', '.test.', '.spec.', '/messages/', 'globals.css'];

function findTsxFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      results.push(...findTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];
  const files = findTsxFiles(WEB_SRC);

  for (const filePath of files) {
    const relPath = filePath.replace(ROOT + '/', '');
    if (EXCLUDED_PATTERNS.some((p) => relPath.includes(p))) continue;

    const lines = fs.readFileSync(filePath, 'utf8').split('\n').length;
    if (lines > LINE_LIMIT) {
      issues.push({
        rule: 'component-size-limit',
        severity: 'warning',
        message: `${lines} lines (limit: ${LINE_LIMIT})`,
        file: relPath,
      });
    }
  }

  return issues;
}
