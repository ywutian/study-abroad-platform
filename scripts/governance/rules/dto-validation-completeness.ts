/**
 * G8: dto-validation-completeness — Check DTO field decorator coverage.
 *
 * Extends beyond the basic @IsString + @MaxLength check in check-api-quality.ts.
 * Checks:
 * - Fields named *email* should have @IsEmail()
 * - Fields with enum types should have @IsEnum()
 * - Fields named *id/*Id (non-primary) should have @IsUUID() or @IsString()
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const API_SRC = path.resolve(__dirname, '../../apps/api/src');

function getAllDtoFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'test'].includes(entry.name)) continue;
      results.push(...getAllDtoFiles(fullPath));
    } else if (entry.name.endsWith('.dto.ts') && !entry.name.includes('.spec.')) {
      results.push(fullPath);
    }
  }
  return results;
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];
  const dtoFiles = getAllDtoFiles(API_SRC);

  for (const filePath of dtoFiles) {
    const relativePath = path.relative(path.resolve(__dirname, '../../'), filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip decorators, imports, comments, empty lines
      if (
        line.startsWith('@') ||
        line.startsWith('import') ||
        line.startsWith('//') ||
        line.startsWith('*') ||
        line.startsWith('/*') ||
        line.startsWith('export class') ||
        line === '' ||
        line === '{' ||
        line === '}'
      ) {
        continue;
      }

      // Match field declarations like: email: string; or userId?: string;
      const fieldMatch = line.match(/^(\w+)\??:\s*(.+?);/);
      if (!fieldMatch) continue;

      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2].trim();

      // Look backwards for decorators on this field (up to 10 lines)
      const decoratorBlock = lines.slice(Math.max(0, i - 10), i).join('\n');

      // Rule 1: email fields should have @IsEmail
      if (/email/i.test(fieldName) && fieldType.includes('string')) {
        if (!decoratorBlock.includes('@IsEmail')) {
          issues.push({
            rule: 'dto-validation-completeness',
            severity: 'warning',
            message: `Field "${fieldName}" looks like an email but lacks @IsEmail()`,
            file: relativePath,
            line: i + 1,
          });
        }
      }

      // Rule 2: enum fields should have @IsEnum
      if (
        /Enum|Status|Role|Type|Tier|Level|Category|Visibility|Result/i.test(fieldType) &&
        !fieldType.includes('string') &&
        !fieldType.includes('number') &&
        !fieldType.includes('boolean')
      ) {
        if (!decoratorBlock.includes('@IsEnum')) {
          issues.push({
            rule: 'dto-validation-completeness',
            severity: 'warning',
            message: `Field "${fieldName}" has enum type "${fieldType}" but lacks @IsEnum()`,
            file: relativePath,
            line: i + 1,
          });
        }
      }

      // Rule 3: id fields should have @IsUUID or @IsString
      if (/Id$/.test(fieldName) && fieldName !== 'id' && fieldType.includes('string')) {
        if (!decoratorBlock.includes('@IsUUID') && !decoratorBlock.includes('@IsString')) {
          issues.push({
            rule: 'dto-validation-completeness',
            severity: 'warning',
            message: `Field "${fieldName}" looks like an ID but lacks @IsUUID() or @IsString()`,
            file: relativePath,
            line: i + 1,
          });
        }
      }
    }
  }

  return issues;
}
