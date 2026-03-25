/**
 * Migration Safety Check
 *
 * Scans Prisma migration SQL files for dangerous operations that could cause
 * downtime in production (exclusive locks, data loss, etc.).
 *
 * Usage:
 *   npx tsx scripts/check-migration-safety.ts              # Check all migrations
 *   npx tsx scripts/check-migration-safety.ts --new-only   # Only check uncommitted migrations
 *
 * Integrated into CI E2E job (runs after migration drift check).
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const MIGRATIONS_DIR = path.resolve(__dirname, '../apps/api/prisma/migrations');

interface Violation {
  file: string;
  line: number;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  suggestion: string;
}

const RULES: Array<{
  name: string;
  severity: 'error' | 'warning';
  pattern: RegExp;
  message: string;
  suggestion: string;
  /** If provided, no violation when this pattern also matches the same line */
  exemption?: RegExp;
}> = [
  {
    name: 'not-null-without-default',
    severity: 'error',
    pattern: /ADD\s+COLUMN\s+".+"\s+\S+\s+NOT\s+NULL(?!\s+DEFAULT)/i,
    message: 'Adding NOT NULL column without DEFAULT requires full table rewrite and blocks reads.',
    suggestion:
      'Add a DEFAULT value, or make the column nullable first, backfill, then add NOT NULL.',
  },
  {
    name: 'set-not-null',
    severity: 'warning',
    pattern: /ALTER\s+COLUMN\s+".+"\s+SET\s+NOT\s+NULL/i,
    message:
      'SET NOT NULL requires a full table scan to validate existing rows. Can be slow on large tables.',
    suggestion: 'Add a CHECK constraint with NOT VALID first, then VALIDATE CONSTRAINT separately.',
  },
  {
    name: 'create-index-not-concurrent',
    severity: 'warning',
    pattern: /CREATE\s+(?:UNIQUE\s+)?INDEX(?!\s+CONCURRENTLY)/i,
    message: 'CREATE INDEX without CONCURRENTLY takes an exclusive lock, blocking writes.',
    suggestion:
      'Use CREATE INDEX CONCURRENTLY. Note: Prisma does not support this natively — use a raw SQL migration.',
    exemption: /CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY/i,
  },
  {
    name: 'drop-table',
    severity: 'warning',
    pattern: /DROP\s+TABLE/i,
    message: 'Dropping a table permanently deletes all data.',
    suggestion:
      'Consider renaming the table first (soft-delete), verify no consumers, then drop in a follow-up migration.',
  },
  {
    name: 'drop-column',
    severity: 'warning',
    pattern: /ALTER\s+TABLE\s+".+"\s+DROP\s+COLUMN/i,
    message: 'Dropping a column permanently deletes data. Ensure no code references this column.',
    suggestion:
      'Deploy code changes that stop reading the column first, then drop it in a subsequent migration.',
  },
  {
    name: 'rename-column',
    severity: 'warning',
    pattern: /ALTER\s+TABLE\s+".+"\s+RENAME\s+COLUMN/i,
    message: 'Renaming a column breaks all code that references the old name.',
    suggestion: 'Add a new column, migrate data, update code, then drop the old column.',
  },
  {
    name: 'alter-column-type',
    severity: 'warning',
    pattern: /ALTER\s+COLUMN\s+".+"\s+(SET\s+DATA\s+)?TYPE/i,
    message: 'Changing column type may require a full table rewrite depending on the conversion.',
    suggestion: 'For large tables, add a new column with the target type, backfill, then swap.',
  },
];

function findMigrationFiles(newOnly: boolean): string[] {
  const files: string[] = [];

  if (newOnly) {
    try {
      const output = execSync('git diff --name-only HEAD', {
        encoding: 'utf-8',
        cwd: path.resolve(__dirname, '..'),
      });
      return output
        .split('\n')
        .filter((f) => f.startsWith('apps/api/prisma/migrations/') && f.endsWith('.sql'))
        .map((f) => path.resolve(__dirname, '..', f));
    } catch {
      // Fallback to checking all
      console.log('⚠️  Could not detect new migrations via git, checking all.');
    }
  }

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  const dirs = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dir of dirs) {
    const sqlPath = path.join(MIGRATIONS_DIR, dir, 'migration.sql');
    if (fs.existsSync(sqlPath)) {
      files.push(sqlPath);
    }
  }

  return files;
}

function checkFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = path.relative(path.resolve(__dirname, '..'), filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip comments and empty lines
    if (line.startsWith('--') || line === '') continue;

    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        // Check exemption
        if (rule.exemption && rule.exemption.test(line)) continue;

        violations.push({
          file: relPath,
          line: i + 1,
          rule: rule.name,
          severity: rule.severity,
          message: rule.message,
          suggestion: rule.suggestion,
        });
      }
    }
  }

  return violations;
}

// ── Main ──────────────────────────────────────────────────
const newOnly = process.argv.includes('--new-only');
const files = findMigrationFiles(newOnly);

if (files.length === 0) {
  console.log('✅ No migration files to check.');
  process.exit(0);
}

console.log(`🔍 Checking ${files.length} migration file(s)${newOnly ? ' (new only)' : ''}...\n`);

let errors = 0;
let warnings = 0;

for (const file of files) {
  const violations = checkFile(file);

  for (const v of violations) {
    const icon = v.severity === 'error' ? '❌' : '⚠️';
    console.log(`${icon} ${v.file}:${v.line} [${v.rule}]`);
    console.log(`   ${v.message}`);
    console.log(`   💡 ${v.suggestion}`);
    console.log('');

    if (v.severity === 'error') errors++;
    else warnings++;
  }
}

if (errors === 0 && warnings === 0) {
  console.log('✅ All migration files passed safety checks.');
} else {
  console.log(`\n📊 Results: ${errors} error(s), ${warnings} warning(s)`);
}

if (errors > 0) {
  console.log('\n❌ Migration safety check failed. Fix errors before deploying.');
  process.exit(1);
}

if (warnings > 0) {
  console.log('\n⚠️  Warnings found. Please review before deploying to production.');
}
