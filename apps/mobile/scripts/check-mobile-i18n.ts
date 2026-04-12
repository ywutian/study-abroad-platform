/**
 * i18n consistency checks for the mobile app.
 * Compares en.json and zh.json locale files to ensure:
 *
 * 1. Key balance: both files have the same keys (deep comparison)
 * 2. Missing translations: keys present in one but not the other
 * 3. Empty values: keys with empty string values
 *
 * Locale files: apps/mobile/src/lib/i18n/locales/{en,zh}.json
 *
 * Usage:
 *   npx tsx scripts/check-mobile-i18n.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const LOCALES_DIR = path.resolve(__dirname, '../src/lib/i18n/locales');

// ── Types ──────────────────────────────────────────────────

interface Issue {
  type: 'missing' | 'empty';
  locale: string;
  key: string;
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Recursively extract all leaf key paths from a nested JSON object.
 */
function extractKeys(obj: Record<string, unknown>, prefix = ''): Map<string, unknown> {
  const keys = new Map<string, unknown>();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const nested = extractKeys(value as Record<string, unknown>, fullKey);
      for (const [k, v] of nested) {
        keys.set(k, v);
      }
    } else {
      keys.set(fullKey, value);
    }
  }

  return keys;
}

// ── Main ───────────────────────────────────────────────────

function main() {
  console.log('🌐 Checking mobile i18n consistency...\n');

  const enPath = path.join(LOCALES_DIR, 'en.json');
  const zhPath = path.join(LOCALES_DIR, 'zh.json');

  if (!fs.existsSync(enPath) || !fs.existsSync(zhPath)) {
    console.error('❌ Locale files not found!');
    console.error(`   Expected: ${enPath}`);
    console.error(`   Expected: ${zhPath}`);
    process.exit(1);
  }

  const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));

  const enKeys = extractKeys(en);
  const zhKeys = extractKeys(zh);

  const issues: Issue[] = [];

  // Keys in en.json but missing from zh.json
  for (const [key] of enKeys) {
    if (!zhKeys.has(key)) {
      issues.push({ type: 'missing', locale: 'zh.json', key });
    }
  }

  // Keys in zh.json but missing from en.json
  for (const [key] of zhKeys) {
    if (!enKeys.has(key)) {
      issues.push({ type: 'missing', locale: 'en.json', key });
    }
  }

  // Empty values in en.json
  for (const [key, value] of enKeys) {
    if (typeof value === 'string' && value.trim() === '') {
      issues.push({ type: 'empty', locale: 'en.json', key });
    }
  }

  // Empty values in zh.json
  for (const [key, value] of zhKeys) {
    if (typeof value === 'string' && value.trim() === '') {
      issues.push({ type: 'empty', locale: 'zh.json', key });
    }
  }

  // Report
  console.log(`📊 en.json: ${enKeys.size} keys`);
  console.log(`📊 zh.json: ${zhKeys.size} keys\n`);

  if (issues.length === 0) {
    console.log('✅ Mobile i18n checks passed! No issues found.\n');
    process.exit(0);
  }

  const missing = issues.filter((i) => i.type === 'missing');
  const empty = issues.filter((i) => i.type === 'empty');

  if (missing.length > 0) {
    console.log(`❌ Missing keys (${missing.length}):\n`);
    for (const issue of missing) {
      console.log(`   [MISSING] ${issue.locale}: ${issue.key}`);
    }
    console.log('');
  }

  if (empty.length > 0) {
    console.log(`⚠️  Empty values (${empty.length}):\n`);
    for (const issue of empty) {
      console.log(`   [EMPTY]   ${issue.locale}: ${issue.key}`);
    }
    console.log('');
  }

  console.log(`Total: ${missing.length} missing, ${empty.length} empty values`);
  console.log(`Key difference: ${Math.abs(enKeys.size - zhKeys.size)} keys\n`);

  // Missing keys are errors, empty values are warnings
  if (missing.length > 0) {
    process.exit(1);
  }
}

main();
