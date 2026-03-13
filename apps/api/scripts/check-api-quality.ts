/**
 * Backend code quality checks for the API app.
 * Catches common patterns that ESLint rules don't cover:
 *
 * 1. Inline @Body() types instead of DTO classes (error)
 * 2. AI endpoints without @Throttle decorator (warning)
 * 3. Generic throw new Error() in service files (warning)
 * 4. DTO @IsString() fields without @MaxLength() (warning)
 * 5. Service files without corresponding .spec.ts (warning, full-scan only)
 * 6. Duplicated inline Prisma select blocks in same service (warning)
 * 7. Select-to-mapper field drift in *.constants.ts (warning)
 *
 * Usage:
 *   npx tsx scripts/check-api-quality.ts           # Check all
 *   npx tsx scripts/check-api-quality.ts --staged   # Check staged files only
 */

import * as fs from 'fs';
import * as path from 'path';

const API_SRC = path.resolve(__dirname, '../src');
const isCI = !!process.env.CI;
const stagedOnly = process.argv.includes('--staged');

interface Issue {
  file: string;
  line: number;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

// ── Helpers ────────────────────────────────────────────────

function getAllFiles(dir: string, ext: string[] = ['.ts']): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'test'].includes(entry.name)) continue;
      results.push(...getAllFiles(fullPath, ext));
    } else if (ext.some((e) => entry.name.endsWith(e))) {
      results.push(fullPath);
    }
  }
  return results;
}

function getStagedFiles(): string[] {
  const { execSync } = require('child_process');
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    });
    return output
      .split('\n')
      .filter((f: string) => f.startsWith('apps/api/src/') && f.endsWith('.ts'))
      .map((f: string) => path.resolve(__dirname, '../../..', f));
  } catch {
    return [];
  }
}

function relativePath(filePath: string): string {
  return path.relative(path.resolve(__dirname, '../../..'), filePath);
}

// ── Checks ─────────────────────────────────────────────────

function checkInlineBody(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (!filePath.endsWith('.controller.ts')) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Detect @Body() followed by inline type: `@Body() body: { ... }`
    if (/@Body\(\)\s*\w+\s*[?:]?\s*\{/.test(line)) {
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-inline-body',
        message:
          'Inline @Body() type detected. Create a DTO class with class-validator decorators instead.',
        severity: 'error',
      });
    }
    // Also detect multi-line: @Body() \n body: { ... }
    if (/@Body\(\)\s*$/.test(line.trim()) && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (/^\s*\w+\s*[?:]?\s*\{/.test(nextLine)) {
        issues.push({
          file: relativePath(filePath),
          line: i + 1,
          rule: 'no-inline-body',
          message:
            'Inline @Body() type detected. Create a DTO class with class-validator decorators instead.',
          severity: 'error',
        });
      }
    }
  }
  return issues;
}

function checkUnthrottledAI(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (!filePath.endsWith('.controller.ts')) return issues;
  // Admin controllers are protected by @Roles(Role.ADMIN) — rate limiting is less critical
  if (filePath.includes('/admin/')) return issues;

  const content = lines.join('\n');
  // Only check files with AI-related routes
  if (!content.includes('/ai') && !content.includes('ai-')) return issues;

  // Find route decorators with 'ai' in the path
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Only flag @Post/@Put AI endpoints (writes that trigger LLM calls)
    // @Get AI endpoints (history, reviews list) are read-only and don't need AI throttle
    const routeMatch = line.match(
      /@(?:Post|Put)\(\s*['"`]([^'"`]*ai[^'"`]*)['"`]\s*\)/i,
    );
    if (!routeMatch) continue;

    // Look backwards and forwards for @Throttle or @ThrottleAI decorator (within 5 lines)
    let hasThrottle = false;
    for (
      let j = Math.max(0, i - 5);
      j <= Math.min(lines.length - 1, i + 3);
      j++
    ) {
      if (j === i) continue;
      if (
        /\b@Throttle|@ThrottleAI|@ThrottleSensitive|@ThrottleStrict|@SkipThrottle/.test(
          lines[j],
        )
      ) {
        hasThrottle = true;
        break;
      }
    }

    if (!hasThrottle) {
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-unthrottled-ai',
        message: `AI endpoint '${routeMatch[1]}' has no @ThrottleAI() decorator. Add rate limiting for AI endpoints.`,
        severity: 'warning',
      });
    }
  }
  return issues;
}

function checkGenericThrow(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (!filePath.endsWith('.service.ts')) return issues;
  // Exempt startup/config services that intentionally crash the process
  const exemptFiles = [
    'encryption.service.ts',
    'config-validator.service.ts',
    'prisma.service.ts',
  ];
  if (exemptFiles.some((f) => filePath.endsWith(f))) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//')) continue;

    if (/throw\s+new\s+Error\(/.test(line)) {
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-generic-throw',
        message:
          'Use NestJS exceptions (BadRequestException, NotFoundException, etc.) instead of generic Error.',
        severity: 'warning',
      });
    }
  }
  return issues;
}

function checkMissingMaxLength(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (!filePath.endsWith('.dto.ts')) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//')) continue;

    // Find @IsString() decorator
    if (!/@IsString\b/.test(line)) continue;

    // Check surrounding lines (5 before, 5 after) for @MaxLength
    let hasMaxLength = false;
    // Also check if the field has inherent-length validators that make @MaxLength redundant
    let hasInherentLimit = false;
    for (
      let j = Math.max(0, i - 5);
      j <= Math.min(lines.length - 1, i + 5);
      j++
    ) {
      if (/@MaxLength\b/.test(lines[j])) {
        hasMaxLength = true;
        break;
      }
      if (
        /@Is(?:Email|Url|UUID|Enum|Boolean|Number|Int|Date)\b/.test(lines[j])
      ) {
        hasInherentLimit = true;
      }
      // @Matches with a regex pattern already constrains the format/length
      if (/@Matches\b/.test(lines[j])) {
        hasInherentLimit = true;
      }
    }

    if (!hasMaxLength && !hasInherentLimit) {
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-missing-maxlength',
        message:
          '@IsString() field without @MaxLength(). Add @MaxLength() to prevent oversized input.',
        severity: 'warning',
      });
    }
  }
  return issues;
}

function checkMissingTest(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (!filePath.endsWith('.service.ts')) return issues;
  // Skip in staged mode — this check is for full-scan only
  if (stagedOnly) return issues;
  // Exempt infrastructure/utility files
  if (filePath.includes('/common/')) return issues;
  // Exempt tiny files (< 50 lines)
  if (lines.length < 50) return issues;
  // Exempt index files
  if (filePath.endsWith('index.ts')) return issues;

  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, '.ts');
  const specFile = path.join(dir, `${baseName}.spec.ts`);
  const testDir = path.join(dir, '__tests__');
  const testFile = path.join(testDir, `${baseName}.spec.ts`);

  if (!fs.existsSync(specFile) && !fs.existsSync(testFile)) {
    issues.push({
      file: relativePath(filePath),
      line: 1,
      rule: 'no-missing-test',
      message: `Service has no corresponding .spec.ts test file.`,
      severity: 'warning',
    });
  }
  return issues;
}

// Files exempt from select-related rules
const SELECT_EXEMPT_PATHS = [
  'ai-agent/tools/',
  'admin/',
  'school-data.service.ts',
  'school-scraper.service.ts',
  'urban-institute-data.service.ts',
  'data-sync.scheduler.ts',
];

function isSelectExempt(filePath: string): boolean {
  return SELECT_EXEMPT_PATHS.some((p) => filePath.includes(p));
}

/**
 * Rule 6: no-duplicated-select
 * Detects identical inline select blocks appearing 2+ times in same service file.
 * These should be extracted to *.constants.ts.
 */
function checkDuplicatedSelect(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (!filePath.endsWith('.service.ts')) return issues;
  if (filePath.endsWith('.spec.ts')) return issues;
  if (isSelectExempt(filePath)) return issues;

  const content = lines.join('\n');
  // Skip files that already use extracted SELECT constants (good practice)
  if (content.includes('_SELECT') && content.includes('as const satisfies'))
    return issues;
  // Skip files that import SELECT constants from constants files
  if (/import\s.*_SELECT.*from.*\.constants/.test(content)) return issues;
  // Skip files that define their own constants at file level (e.g., chat.service.ts)
  if (/^const\s+\w+_SELECT\s*=/m.test(content)) return issues;
  if (/^const\s+\w+(?:Include|Select)\s*=/m.test(content)) return issues;

  // Extract select blocks: `select: { field: true, ... }`
  // Use a simple approach: find `select: {` and capture field names until `}`
  const selectRegex = /select:\s*\{([^{}]*)\}/g;
  const blocks: Array<{ key: string; line: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = selectRegex.exec(content)) !== null) {
    const body = match[1];
    // Extract field names (words before `: true`)
    const fields = [...body.matchAll(/(\w+):\s*true/g)]
      .map((m) => m[1])
      .sort()
      .join(',');
    // Skip single-field selects (e.g., `select: { id: true }`)
    if (fields.split(',').length <= 2) continue;
    // Calculate line number
    const lineNum = content.substring(0, match.index).split('\n').length;
    blocks.push({ key: fields, line: lineNum });
  }

  // Find duplicates
  const seen = new Map<string, number>();
  for (const { key, line } of blocks) {
    if (seen.has(key)) {
      issues.push({
        file: relativePath(filePath),
        line,
        rule: 'no-duplicated-select',
        message: `Duplicate select block (first at line ${seen.get(key)}). Extract to *.constants.ts`,
        severity: 'warning',
      });
    } else {
      seen.set(key, line);
    }
  }
  return issues;
}

/**
 * Rule 7: no-select-mapping-drift
 * Detects fields in *_SELECT constants that aren't referenced in the corresponding
 * mapper function in the same *.constants.ts file.
 */
function checkSelectMappingDrift(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (!filePath.endsWith('.constants.ts')) return issues;

  const content = lines.join('\n');

  // Find *_SELECT constants and their fields
  const selectConstRegex =
    /const\s+(\w+_SELECT)\s*=\s*\{([\s\S]*?)\}\s*as\s+const/g;
  let selectMatch: RegExpExecArray | null;

  while ((selectMatch = selectConstRegex.exec(content)) !== null) {
    const constName = selectMatch[1];
    const selectBody = selectMatch[2];
    // Extract fields (skip spread patterns like `...SCHOOL_BASIC_SELECT`)
    const fields = [...selectBody.matchAll(/^\s*(\w+):\s*true/gm)].map(
      (m) => m[1],
    );
    if (fields.length === 0) continue;

    // Find the closest matching mapper function by naming convention:
    // SCHOOL_LIST_SCHOOL_SELECT → mapSchoolForList / mapSchoolList
    // Only check the FIRST mapper in the file (primary mapper)
    const mapperRegex = /function\s+(map\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g;
    // Only check the first mapper that appears after this SELECT constant
    const mapperMatch = mapperRegex.exec(content);
    if (mapperMatch && mapperMatch.index > selectMatch.index) {
      const mapperName = mapperMatch[1];
      const mapperBody = mapperMatch[2];

      for (const field of fields) {
        if (field === 'id') continue; // id is always implicitly used
        if (field === 'aliases') continue; // aliases used for matching, not response
        // Check if field is referenced in mapper (e.g., `.fieldName` or `field:`)
        if (
          !mapperBody.includes(`.${field}`) &&
          !mapperBody.includes(`${field}:`)
        ) {
          const lineNum = content
            .substring(0, selectMatch.index)
            .split('\n').length;
          issues.push({
            file: relativePath(filePath),
            line: lineNum,
            rule: 'no-select-mapping-drift',
            message: `Field '${field}' in ${constName} but not referenced in ${mapperName}()`,
            severity: 'warning',
          });
        }
      }
    }
    // If SELECT constant has no mapper, that's acceptable (not all constants need mappers)
    // Reset regex for next SELECT constant
    mapperRegex.lastIndex = 0;
  }
  return issues;
}

// ── Main ───────────────────────────────────────────────────

function main() {
  const files = stagedOnly ? getStagedFiles() : getAllFiles(API_SRC);

  if (files.length === 0) {
    console.log('No files to check.');
    process.exit(0);
  }

  const allIssues: Issue[] = [];

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    allIssues.push(
      ...checkInlineBody(filePath, lines),
      ...checkUnthrottledAI(filePath, lines),
      ...checkGenericThrow(filePath, lines),
      ...checkMissingMaxLength(filePath, lines),
      ...checkMissingTest(filePath, lines),
      ...checkDuplicatedSelect(filePath, lines),
      ...checkSelectMappingDrift(filePath, lines),
    );
  }

  const errors = allIssues.filter((i) => i.severity === 'error');
  const warnings = allIssues.filter((i) => i.severity === 'warning');

  if (allIssues.length === 0) {
    console.log('✅ API quality checks passed!');
    process.exit(0);
  }

  // Group by rule
  const byRule = new Map<string, Issue[]>();
  for (const issue of allIssues) {
    const list = byRule.get(issue.rule) || [];
    list.push(issue);
    byRule.set(issue.rule, list);
  }

  console.log('');
  for (const [rule, issues] of byRule) {
    const icon = issues[0].severity === 'error' ? '❌' : '⚠️';
    console.log(
      `${icon} ${rule} (${issues.length} issue${issues.length > 1 ? 's' : ''}):`,
    );
    for (const issue of issues.slice(0, 10)) {
      console.log(`   ${issue.file}:${issue.line} — ${issue.message}`);
    }
    if (issues.length > 10) {
      console.log(`   ... and ${issues.length - 10} more`);
    }
    console.log('');
  }

  console.log(
    `Total: ${errors.length} error(s), ${warnings.length} warning(s)`,
  );
  console.log('');

  if (errors.length > 0 || isCI) {
    process.exit(errors.length > 0 ? 1 : 0);
  }
}

main();
