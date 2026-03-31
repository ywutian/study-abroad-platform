/**
 * G15: service-size-limit — Flag .service.ts files exceeding 1000 lines.
 *
 * Scans apps/api/src/ for NestJS service files that are too large,
 * indicating they should be decomposed into sub-services.
 * Excludes: test files, spec files.
 * Severity: warning
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');
const API_SRC = path.join(ROOT, 'apps/api/src');
const LINE_LIMIT = 1000;

function findServiceFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      results.push(...findServiceFiles(fullPath));
    } else if (entry.name.endsWith('.service.ts') && !entry.name.includes('.spec.')) {
      results.push(fullPath);
    }
  }
  return results;
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];
  const files = findServiceFiles(API_SRC);

  for (const filePath of files) {
    const relPath = filePath.replace(ROOT + '/', '');
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').length;
    if (lines > LINE_LIMIT) {
      issues.push({
        rule: 'service-size-limit',
        severity: 'warning',
        message: `${lines} lines (limit: ${LINE_LIMIT})`,
        file: relPath,
      });
    }
  }

  return issues;
}
