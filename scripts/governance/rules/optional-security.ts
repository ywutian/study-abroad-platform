/**
 * G1: optional-security — Detect @Optional() on security-critical services.
 *
 * Security services (PromptGuardService, ContentModerationService, AuditService)
 * must never be @Optional in production code. Other @Optional usages are reported as info.
 */

import { SyntaxKind } from 'ts-morph';
import { createGovernanceProject } from '../helpers/ts-morph-project';
import type { GovernanceIssue } from '../types';

const SECURITY_SERVICES = new Set([
  'PromptGuardService',
  'ContentModerationService',
  'AuditService',
]);

export function run(): GovernanceIssue[] {
  const project = createGovernanceProject();
  const issues: GovernanceIssue[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    for (const cls of sourceFile.getClasses()) {
      for (const ctor of cls.getConstructors()) {
        for (const param of ctor.getParameters()) {
          const decorators = param.getDecorators();
          const hasOptional = decorators.some((d) => d.getName() === 'Optional');
          if (!hasOptional) continue;

          const paramType = param.getType().getText();
          // Extract the simple type name (handle imports like `import("...").TypeName`)
          const simpleType = paramType.replace(/^import\(.*?\)\./, '');

          if (SECURITY_SERVICES.has(simpleType)) {
            issues.push({
              rule: 'optional-security',
              severity: 'error',
              message: `@Optional() on security-critical service ${simpleType} in ${cls.getName()}.constructor`,
              file: filePath,
              line: param.getStartLineNumber(),
            });
          } else {
            issues.push({
              rule: 'optional-security',
              severity: 'info',
              message: `@Optional() on ${simpleType} in ${cls.getName()}.constructor`,
              file: filePath,
              line: param.getStartLineNumber(),
            });
          }
        }
      }
    }
  }

  return issues;
}
