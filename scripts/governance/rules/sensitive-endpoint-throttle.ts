/**
 * G6: sensitive-endpoint-throttle — Ensure sensitive endpoints have rate limiting.
 *
 * Checks that @Post/@Put/@Delete methods in admin/vault/auth controllers
 * have @Throttle*, @ThrottleSensitive, @ThrottleStrict, or @SkipThrottle decorators.
 *
 * Exemptions:
 * - @Get methods (read-only)
 * - Methods with @SkipThrottle()
 * - Health controllers
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const API_SRC = path.resolve(__dirname, '../../apps/api/src');

const SENSITIVE_CONTROLLER_PATTERNS = [/admin/i, /vault/i, /auth/i];

const THROTTLE_DECORATORS =
  /(@Throttle|@ThrottleSensitive|@ThrottleStrict|@ThrottleAI|@ThrottleRelaxed|@SkipThrottle)/;
const MUTATING_METHODS = /@(Post|Put|Delete|Patch)\(/;

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
    const isSensitive = SENSITIVE_CONTROLLER_PATTERNS.some((p) => p.test(fileName));
    if (!isSensitive) continue;

    // Skip health controllers
    if (fileName.includes('health')) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Check if controller-level throttle exists
    const hasControllerLevelThrottle = THROTTLE_DECORATORS.test(
      lines.slice(0, lines.findIndex((l) => /class\s/.test(l)) + 1).join('\n')
    );

    if (hasControllerLevelThrottle) continue; // Controller-level throttle covers all methods

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!MUTATING_METHODS.test(line)) continue;

      // Look backwards up to 5 lines for throttle decorator
      const decoratorBlock = lines.slice(Math.max(0, i - 5), i + 1).join('\n');
      if (THROTTLE_DECORATORS.test(decoratorBlock)) continue;

      issues.push({
        rule: 'sensitive-endpoint-throttle',
        severity: 'error',
        message: `Mutating endpoint without rate limiting in ${fileName}`,
        file: relativePath,
        line: i + 1,
      });
    }
  }

  return issues;
}
