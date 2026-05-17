/**
 * Deprecated brand-term checker.
 *
 * After the 校友广场 / Alumni Square rebrand (Hall refactor Stage 8), several
 * legacy names must never reappear in shipped UI strings. This script greps
 * the web + mobile source trees and fails the build on any hit.
 *
 * Canonical names live in docs/BRAND_GUIDELINE.md.
 *
 * Usage:
 *   npx tsx scripts/check-deprecated-terms.ts            # scan everything
 *   npx tsx scripts/check-deprecated-terms.ts --staged   # staged files only
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(__dirname, '..');

// Directories scanned in full-scan mode.
const SCAN_DIRS = [
  path.join(ROOT, 'apps/web/src'),
  path.join(ROOT, 'apps/mobile/src'),
];

// Only text-ish source files are inspected.
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);

// Deprecated term -> canonical replacement (shown in the failure hint).
const DEPRECATED_TERMS: Array<{ term: string; use: string }> = [
  { term: '功能大厅', use: '校友广场' },
  { term: 'Feature Hall', use: 'Alumni Square' },
  { term: '锐评模式', use: '同伴反馈' },
  { term: '认证排行', use: '认证录取榜' },
];

interface Hit {
  file: string;
  line: number;
  term: string;
  use: string;
  text: string;
}

/** Resolve the list of files to scan. */
function collectFiles(stagedOnly: boolean): string[] {
  if (stagedOnly) {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
      .filter(
        (f) =>
          (f.startsWith('apps/web/src/') ||
            f.startsWith('apps/mobile/src/')) &&
          SCAN_EXT.has(path.extname(f)),
      )
      .map((f) => path.join(ROOT, f))
      .filter((f) => fs.existsSync(f));
  }

  const files: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        walk(full);
      } else if (SCAN_EXT.has(path.extname(entry.name))) {
        files.push(full);
      }
    }
  };
  SCAN_DIRS.forEach(walk);
  return files;
}

function scanFile(file: string): Hit[] {
  const hits: Hit[] = [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, idx) => {
    for (const { term, use } of DEPRECATED_TERMS) {
      if (text.includes(term)) {
        hits.push({
          file: path.relative(ROOT, file),
          line: idx + 1,
          term,
          use,
          text: text.trim(),
        });
      }
    }
  });
  return hits;
}

function main() {
  const stagedOnly = process.argv.includes('--staged');
  const files = collectFiles(stagedOnly);

  console.log(
    `🏷️  Checking ${files.length} file(s) for deprecated brand terms${
      stagedOnly ? ' (staged)' : ''
    }...`,
  );

  const hits = files.flatMap(scanFile);

  if (hits.length === 0) {
    console.log('✅ No deprecated brand terms found.');
    process.exit(0);
  }

  console.error(`\n❌ Found ${hits.length} deprecated brand term(s):\n`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}`);
    console.error(`    "${h.term}" → use "${h.use}"`);
    console.error(`    ${h.text}\n`);
  }
  console.error('See docs/BRAND_GUIDELINE.md for the canonical term table.');
  process.exit(1);
}

main();
