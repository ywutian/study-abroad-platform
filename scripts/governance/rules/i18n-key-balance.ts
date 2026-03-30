/**
 * G6: i18n-key-balance — Verify en.json and zh.json have matching key counts.
 *
 * Counts leaf keys in both locale files and flags a mismatch.
 * Severity: error (missing translations break the UI)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');
const EN_PATH = path.join(ROOT, 'apps/web/src/messages/en.json');
const ZH_PATH = path.join(ROOT, 'apps/web/src/messages/zh.json');

function countLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...countLeafKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];

  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf-8'));
  const zh = JSON.parse(fs.readFileSync(ZH_PATH, 'utf-8'));

  const enKeys = countLeafKeys(en);
  const zhKeys = countLeafKeys(zh);

  if (enKeys.length !== zhKeys.length) {
    issues.push({
      rule: 'i18n-key-balance',
      severity: 'error',
      message: `i18n key count mismatch: en.json has ${enKeys.length} keys, zh.json has ${zhKeys.length} keys (diff: ${Math.abs(enKeys.length - zhKeys.length)})`,
      file: EN_PATH,
    });
  }

  // Find keys in en but not in zh
  const zhSet = new Set(zhKeys);
  const missingInZh = enKeys.filter((k) => !zhSet.has(k));
  for (const key of missingInZh.slice(0, 5)) {
    issues.push({
      rule: 'i18n-key-balance',
      severity: 'error',
      message: `Key "${key}" exists in en.json but missing in zh.json`,
      file: ZH_PATH,
    });
  }

  // Find keys in zh but not in en
  const enSet = new Set(enKeys);
  const missingInEn = zhKeys.filter((k) => !enSet.has(k));
  for (const key of missingInEn.slice(0, 5)) {
    issues.push({
      rule: 'i18n-key-balance',
      severity: 'error',
      message: `Key "${key}" exists in zh.json but missing in en.json`,
      file: EN_PATH,
    });
  }

  return issues;
}
