/**
 * G7: controller-auth-coverage — Ensure sensitive controllers have auth decorators.
 *
 * Checks that every route method in admin/vault/settings controllers
 * has @Roles() or @Public() explicitly declared (either on method or class level).
 *
 * Exemptions:
 * - Health controllers (@Public is expected)
 * - Methods already covered by class-level @Roles decorator
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const API_SRC = path.resolve(__dirname, '../../apps/api/src');

const SENSITIVE_CONTROLLER_FILES = [
  /admin.*\.controller\.ts$/,
  /vault.*\.controller\.ts$/,
  /settings.*\.controller\.ts$/,
];

const ROUTE_DECORATOR = /@(Get|Post|Put|Delete|Patch)\(/;
const AUTH_DECORATOR = /(@Roles|@Public)\(/;

function getAllControllers(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'test'].includes(entry.name)) continue;
      results.push(...getAllControllers(fullPath));
    } else if (entry.name.endsWith('.controller.ts') && !entry.name.includes('.spec.')) {
      results.push(fullPath);
    }
  }
  return results;
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];
  const controllers = getAllControllers(API_SRC);

  for (const filePath of controllers) {
    const relativePath = path.relative(path.resolve(__dirname, '../../'), filePath);
    const fileName = path.basename(filePath);

    // Only check sensitive controllers
    const isSensitive = SENSITIVE_CONTROLLER_FILES.some((p) => p.test(fileName));
    if (!isSensitive) continue;

    // Skip health
    if (fileName.includes('health')) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Check class-level auth decorator
    const classDeclarationIndex = lines.findIndex((l) => /class\s/.test(l));
    const classHeader = lines.slice(0, classDeclarationIndex + 1).join('\n');
    const hasClassLevelAuth = AUTH_DECORATOR.test(classHeader);

    if (hasClassLevelAuth) continue; // Class-level auth covers all methods

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!ROUTE_DECORATOR.test(line)) continue;

      // Look backwards up to 8 lines for auth decorator
      const decoratorBlock = lines.slice(Math.max(0, i - 8), i + 1).join('\n');
      if (AUTH_DECORATOR.test(decoratorBlock)) continue;

      issues.push({
        rule: 'controller-auth-coverage',
        severity: 'error',
        message: `Route method without @Roles() or @Public() in ${fileName}`,
        file: relativePath,
        line: i + 1,
      });
    }
  }

  return issues;
}
