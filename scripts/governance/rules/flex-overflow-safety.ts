/**
 * G13: flex-overflow-safety — Detect flex containers with justify-between that
 * lack overflow protection on variable-width children.
 *
 * When a flex container uses justify-between, the variable-width child (usually
 * text) needs min-w-0 or overflow-hidden to prevent overflow. Without it, long
 * text can push the layout wider than the viewport.
 *
 * Severity: warning (not all matches are true positives, but flags for review)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');
const WEB_SRC = path.join(ROOT, 'apps/web/src');

// Files to exclude (UI primitives that are used correctly)
const EXCLUDED_PATTERNS = ['/components/ui/', '.spec.', '.test.', 'node_modules'];

function getAllTsxFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      results.push(...getAllTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx')) {
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
    if (EXCLUDED_PATTERNS.some((p) => relPath.includes(p))) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect: flex + justify-between on same element
      if (line.includes('justify-between') && line.includes('flex') && line.includes('className')) {
        // Look at the next 10 lines for child elements
        const block = lines.slice(i, Math.min(i + 12, lines.length)).join('\n');

        // Check if any child has min-w-0 or overflow-hidden or truncate
        const hasProtection =
          block.includes('min-w-0') ||
          block.includes('overflow-hidden') ||
          block.includes('overflow-x-hidden') ||
          block.includes('truncate') ||
          block.includes('line-clamp');

        if (!hasProtection) {
          issues.push({
            rule: 'flex-overflow-safety',
            severity: 'warning',
            message:
              'flex + justify-between without min-w-0/overflow-hidden/truncate on children — risk of text overflow on narrow screens',
            file: relPath,
            line: i + 1,
          });
        }
      }
    }
  }

  return issues;
}
