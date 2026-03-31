/**
 * G16: error-boundary-coverage — Every page.tsx should have an error.tsx
 * in its directory or a parent layout group.
 *
 * Scans apps/web/src/app/ for page.tsx files and checks for error.tsx
 * at the same level or any ancestor directory up to (main)/ or (auth)/.
 * Severity: warning
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');
const APP_DIR = path.join(ROOT, 'apps/web/src/app');

// Stop searching for error.tsx above these directories
const BOUNDARY_DIRS = ['(main)', '(auth)'];

function findPageFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '_components' || entry.name === 'api')
        continue;
      results.push(...findPageFiles(fullPath));
    } else if (entry.name === 'page.tsx') {
      results.push(fullPath);
    }
  }
  return results;
}

function hasErrorBoundary(pageDir: string): boolean {
  let dir = pageDir;
  while (dir.startsWith(APP_DIR)) {
    if (fs.existsSync(path.join(dir, 'error.tsx'))) return true;
    const dirName = path.basename(dir);
    if (BOUNDARY_DIRS.includes(dirName)) break;
    dir = path.dirname(dir);
  }
  return false;
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];
  const pages = findPageFiles(APP_DIR);

  for (const pagePath of pages) {
    const relPath = pagePath.replace(ROOT + '/', '');
    const dir = path.dirname(pagePath);

    if (!hasErrorBoundary(dir)) {
      issues.push({
        rule: 'error-boundary-coverage',
        severity: 'warning',
        message: 'page.tsx without error.tsx boundary in this or parent directory',
        file: relPath,
      });
    }
  }

  return issues;
}
