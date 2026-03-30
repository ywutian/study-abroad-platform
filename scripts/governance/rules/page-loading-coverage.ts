/**
 * G7: page-loading-coverage — Every page.tsx should have a sibling loading.tsx.
 *
 * Scans apps/web/src/app/ for page.tsx files and checks for loading.tsx in the
 * same directory. Excludes admin pages (they use CardSkeleton inline).
 * Severity: warning
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');
const APP_DIR = path.join(ROOT, 'apps/web/src/app');

// Directories where loading.tsx is not expected
const EXCLUDED_DIRS = ['/admin/', '/(auth)/', '/api/'];

function findPageFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '_components') continue;
      results.push(...findPageFiles(fullPath));
    } else if (entry.name === 'page.tsx') {
      results.push(fullPath);
    }
  }
  return results;
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];
  const pages = findPageFiles(APP_DIR);

  for (const pagePath of pages) {
    const relPath = pagePath.replace(ROOT + '/', '');

    // Skip excluded directories
    if (EXCLUDED_DIRS.some((exc) => relPath.includes(exc))) continue;

    const dir = path.dirname(pagePath);
    const loadingPath = path.join(dir, 'loading.tsx');

    if (!fs.existsSync(loadingPath)) {
      issues.push({
        rule: 'page-loading-coverage',
        severity: 'warning',
        message: `page.tsx without sibling loading.tsx`,
        file: relPath,
      });
    }
  }

  return issues;
}
