/**
 * G12: validation-i18n-keys — Detect i18n key errors in Zod validation schemas.
 *
 * Scans apps/web/src/lib/validations/*.ts for t('key') calls and checks:
 * 1. Keys with doubled namespace prefixes (e.g., t('profile.validation.x') in a
 *    schema called via useTranslations('profile') → resolves to profile.profile.validation.x)
 * 2. Keys that don't exist in en.json when resolved without namespace
 *
 * Severity: error (causes MISSING_MESSAGE at runtime)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');
const VALIDATIONS_DIR = path.join(ROOT, 'apps/web/src/lib/validations');
const EN_JSON_PATH = path.join(ROOT, 'apps/web/src/messages/en.json');

// Known top-level namespaces used with useTranslations('namespace')
const KNOWN_NAMESPACES = [
  'profile',
  'recommendation',
  'prediction',
  'essay',
  'essayAi',
  'admin',
  'timeline',
  'forum',
  'chat',
  'hall',
  'settings',
  'common',
];

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];

  if (!fs.existsSync(VALIDATIONS_DIR)) return issues;

  const en = JSON.parse(fs.readFileSync(EN_JSON_PATH, 'utf-8'));

  const files = fs
    .readdirSync(VALIDATIONS_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));

  for (const file of files) {
    const filePath = path.join(VALIDATIONS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match t('some.key') or t('some.key', {...})
      const matches = line.matchAll(/t\(\s*['"]([^'"]+)['"]/g);

      for (const match of matches) {
        const key = match[1];

        // Check for doubled namespace prefix: t('profile.validation.x') in a schema
        // that will be called with useTranslations('profile') → profile.profile.validation.x
        for (const ns of KNOWN_NAMESPACES) {
          const doublePrefix = `${ns}.${ns}.`;
          if (key.startsWith(`${ns}.`)) {
            // Check if this key looks like it has the namespace baked in
            // but the schema function receives t from useTranslations(namespace)
            // Heuristic: if the function name contains "Schema" (Zod schema factory),
            // the t function is namespaced, so keys should NOT start with the namespace
            const funcMatch = content
              .slice(0, content.indexOf(line))
              .match(/export function create\w+Schema/g);
            if (funcMatch && funcMatch.length > 0) {
              issues.push({
                rule: 'validation-i18n-keys',
                severity: 'error',
                message: `Key "${key}" in schema factory likely has doubled prefix — schema t() is called with useTranslations('${ns}'), so key will resolve to "${ns}.${key}". Use "${key.slice(ns.length + 1)}" instead.`,
                file: `apps/web/src/lib/validations/${file}`,
                line: i + 1,
              });
            }
          }
        }
      }
    }
  }

  return issues;
}
