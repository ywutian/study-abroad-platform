/**
 * Backend code quality checks for the API app.
 * Catches common patterns that ESLint rules don't cover:
 *
 * 1. Inline @Body() types instead of DTO classes (error)
 * 2. AI endpoints without @Throttle decorator (warning)
 * 3. Generic throw new Error() in service files (warning)
 * 4. DTO @IsString() fields without @MaxLength() (warning)
 * 5. Service files without corresponding .spec.ts (error for NEW services in
 *    --staged/pre-commit; warning for the existing backlog on full-scan)
 * 6. Duplicated inline Prisma select blocks in same service (warning)
 * 7. Select-to-mapper field drift in *.constants.ts (warning)
 * 8. Raw redis.getClient() bypassing metrics/circuit-breaker (error)
 * 9. Hardcoded Redis TTL instead of REDIS_TTL.* constant (error)
 * 10. setInterval polling Redis on a fixed <30s cadence — #274 (error)
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

/** Newly-ADDED staged files (diff-filter=A) — used so no-missing-test only
 *  blocks brand-new services at pre-commit, not edits to the existing backlog. */
function getAddedStagedFiles(): Set<string> {
  const { execSync } = require('child_process');
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=A', {
      encoding: 'utf8',
    });
    return new Set<string>(
      output
        .split('\n')
        .filter(
          (f: string) => f.startsWith('apps/api/src/') && f.endsWith('.ts'),
        )
        .map((f: string) => path.resolve(__dirname, '../../..', f)),
    );
  } catch {
    return new Set<string>();
  }
}

const addedStagedFiles = stagedOnly ? getAddedStagedFiles() : new Set<string>();

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

/**
 * no-magic-arraysize: a numeric @ArrayMaxSize literal on a user-facing DTO array
 * field should be a named shared constant (SSOT in packages/shared) so the cap is
 * single-sourced with the client and cannot silently drift — the root cause of the
 * #396/#397 silent-400 bug class (prediction 10 vs timeline 50; recommendation /
 * team caps the frontend could exceed with no guard). Enum-bounded arrays are
 * skipped (the enum already bounds them). Suppress a deliberate fixed-set cap with
 * // @arraysize-literal-allowed. Error for NEW code (staged), warning for the
 * existing backlog (full-scan) — same ratchet as no-missing-test.
 */
function checkMagicArraySize(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  // Scan request DTOs: *.dto.ts anywhere, PLUS any *.ts directly under a /dto/
  // directory so class definitions in dto/index.ts barrels are not invisible
  // (e.g. hall VerifiedDashboardQueryDto.schoolIds lived in a barrel and slipped
  // the old `.dto.ts`-only filter). Skip *.spec.ts.
  const isDtoFile =
    filePath.endsWith('.dto.ts') || /\/dto\/[^/]+\.ts$/.test(filePath);
  if (!isDtoFile || filePath.endsWith('.spec.ts')) return issues;
  // Admin / bulk-import / batch-moderation endpoints have their own batch UIs +
  // high caps and are not user-curated lists — literals are fine there.
  if (filePath.includes('/modules/admin/')) return issues;
  const base = filePath.split('/').pop() ?? '';
  if (/(^|[-.])(batch|bulk)/.test(base)) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//')) continue;
    // Only a numeric literal cap — a named-constant reference is the desired state.
    if (!/@ArrayMaxSize\(\s*\d/.test(line)) continue;
    if (hasIgnoreTag(lines, i, '@arraysize-literal-allowed')) continue;

    // Skip enum-bounded arrays: @IsEnum(..., { each: true }) or
    // @IsIn([...fixed set], { each: true }) already bound each element to a small
    // fixed value set, so a numeric cap is a deliberate fixed-set bound, not a
    // user-curated free-form list.
    let isEnumBounded = false;
    for (
      let j = Math.max(0, i - 5);
      j <= Math.min(lines.length - 1, i + 5);
      j++
    ) {
      if (/@IsEnum\b/.test(lines[j]) || /@IsIn\b/.test(lines[j])) {
        isEnumBounded = true;
        break;
      }
    }
    if (isEnumBounded) continue;

    issues.push({
      file: relativePath(filePath),
      line: i + 1,
      rule: 'no-magic-arraysize',
      message:
        'Numeric @ArrayMaxSize literal on a user-facing DTO array. Use a named shared cap constant (packages/shared) so it is single-sourced with the client and cannot silently drift (the #396/#397 silent-400 class). Suppress a deliberate fixed-set cap with // @arraysize-literal-allowed.',
      severity: stagedOnly ? 'error' : 'warning',
    });
  }
  return issues;
}

/**
 * no-uncapped-array: a user-facing request DTO array field (@IsArray()) with NO
 * @ArrayMaxSize lets a user POST an arbitrarily large array — DoS / payload bloat /
 * silent downstream failure. The sibling of no-magic-arraysize: that rule makes
 * existing caps SSOT constants; this one ensures the cap EXISTS at all. Found by the
 * 2026-06 unbounded-array sweep (the angle every prior @ArrayMaxSize-keyed audit was
 * blind to). Add @ArrayMaxSize(<shared cap constant>), or suppress a deliberate
 * uncapped field with // @arraysize-uncapped-allowed (e.g. an admin endpoint living
 * inside a feature module, which the /modules/admin/ skip can't see). Enum-bounded
 * arrays are NOT skipped — @IsEnum({each}) bounds the element VALUE set, not the
 * array LENGTH (repeated values still overflow). error on staged / warning on
 * full-scan — same ratchet as no-magic-arraysize.
 */
function checkUncappedArray(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  const isDtoFile =
    filePath.endsWith('.dto.ts') || /\/dto\/[^/]+\.ts$/.test(filePath);
  if (!isDtoFile || filePath.endsWith('.spec.ts')) return issues;
  if (filePath.includes('/modules/admin/')) return issues;
  // The distillation subtree is an internal ML teacher/ingestion pipeline mounted
  // at @Controller('admin/predictions/distillation') @Roles(ADMIN) — never a
  // user-submitted request, analogous to the /modules/admin/ skip above.
  if (filePath.includes('/distillation/')) return issues;
  const base = filePath.split('/').pop() ?? '';
  if (/(^|[-.])(batch|bulk)/.test(base)) return issues;

  // A class property declaration: `name: Type;` / `name?: Type = x;` ending in `;`
  // (object-literal keys inside @ApiProperty end in `,`, so they are excluded).
  const isPropDecl = (raw: string): boolean => {
    const t = raw.trim();
    return /^[\w]+[?!]?\s*[:!][^;]*;\s*$/.test(t) && !t.startsWith('@');
  };

  for (let i = 0; i < lines.length; i++) {
    if (!/@IsArray\s*\(/.test(lines[i])) continue;
    if (lines[i].trim().startsWith('//')) continue;

    // The property this decorator block belongs to (first prop decl below).
    let propLine = -1;
    for (let j = i + 1; j < Math.min(lines.length, i + 18); j++) {
      if (isPropDecl(lines[j])) {
        propLine = j;
        break;
      }
    }
    if (propLine === -1) continue;

    // The block start: walk up to just after the previous property declaration.
    let start = i;
    for (let j = i - 1; j >= 0 && j >= i - 18; j--) {
      if (isPropDecl(lines[j])) break;
      start = j;
    }

    let hasCap = false;
    let ignore = false;
    for (let j = start; j <= propLine; j++) {
      if (/@ArrayMaxSize\s*\(/.test(lines[j])) hasCap = true;
      if (lines[j].includes('@arraysize-uncapped-allowed')) ignore = true;
    }
    if (hasCap || ignore) continue;

    issues.push({
      file: relativePath(filePath),
      line: i + 1,
      rule: 'no-uncapped-array',
      message:
        'User-facing DTO array field (@IsArray) with no @ArrayMaxSize — a user can POST an unbounded array (DoS / payload bloat / silent 400, the #396/#397/#398 class). Add @ArrayMaxSize(<shared cap constant>), or suppress a deliberate uncapped field (e.g. admin-gated inside a feature module) with // @arraysize-uncapped-allowed.',
      severity: stagedOnly ? 'error' : 'warning',
    });
  }
  return issues;
}

function checkMissingTest(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (!filePath.endsWith('.service.ts')) return issues;
  // Staged mode (pre-commit): only enforce on NEWLY ADDED services — editing an
  // existing untested service (the backlog) must not be blocked. Full-scan (CI)
  // reports the whole backlog as a warning.
  if (stagedOnly && !addedStagedFiles.has(filePath)) return issues;
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
      // Error for a NEW service at pre-commit (staged); warning for the existing
      // backlog at full-scan so CI isn't blocked by it.
      message: stagedOnly
        ? `New service has no .spec.ts — add a sibling test (or __tests__/${baseName}.spec.ts).`
        : `Service has no corresponding .spec.ts test file.`,
      severity: stagedOnly ? 'error' : 'warning',
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

// ── Cache / Redis governance (added 2026-06) ───────────────

/** True when the current line (trailing comment) or the preceding line carries the tag. */
function hasIgnoreTag(lines: string[], idx: number, tag: string): boolean {
  // Tag may be inline on the decorator line, OR anywhere in the contiguous
  // comment block immediately above it — so a multi-line justification works and
  // the tag need not sit on the single line directly above the decorator. Stops
  // at the first non-comment line, so a tag can't leak across an unrelated
  // decorator.
  if ((lines[idx] ?? '').includes(tag)) return true;
  for (let j = idx - 1; j >= 0; j--) {
    const line = (lines[j] ?? '').trim();
    const isComment =
      line.startsWith('//') || line.startsWith('*') || line.startsWith('/*');
    if (!isComment) break;
    if (line.includes(tag)) return true;
  }
  return false;
}

/**
 * Collect the text BETWEEN the outer parens of a call whose opening `(` is at
 * `lines[startIdx][openCol]`, tracking paren depth across up to 40 lines.
 */
function gatherParenText(
  lines: string[],
  startIdx: number,
  openCol: number,
): string {
  let depth = 0;
  let text = '';
  const end = Math.min(lines.length, startIdx + 40);
  for (let i = startIdx; i < end; i++) {
    const seg = i === startIdx ? lines[i].slice(openCol) : lines[i];
    for (let c = 0; c < seg.length; c++) {
      const ch = seg[c];
      if (ch === '(') {
        depth++;
        if (depth === 1) continue; // skip the outer open paren itself
      } else if (ch === ')') {
        depth--;
        if (depth === 0) return text;
      }
      if (depth >= 1) text += ch;
    }
    if (depth >= 1) text += '\n';
  }
  return text;
}

// Rule 8: raw redis.getClient() bypasses metrics + circuit breaker (#274 blind spot).
// Rule 12: a cache read that JSON.parses without saying what survived.
//
// JSON.parse returns `any`, so `return raw ? JSON.parse(raw) : null` silently
// satisfies whatever the method declares — including a Prisma model whose
// DateTime fields are strings by the time they come back out of Redis. That is
// how the profile-import crash (f0e5511b) and two latent siblings shipped:
// every one of them read a cache and claimed a type it no longer had.
//
// Scoped to files that actually touch Redis, and only to `return` positions,
// because that is where the unchecked value escapes into a declared type. An
// intermediate `const x = JSON.parse(...)` that gets validated before it is
// returned is fine and is not flagged.
function checkUnassertedCacheParse(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (filePath.endsWith('.spec.ts')) return issues;
  const source = lines.join('\n');
  if (!/redis|Redis/.test(source)) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
    if (!/JSON\.parse\s*\(/.test(line)) continue;
    // Only the escaping position: a return, or a callback inside one.
    if (!/\breturn\b/.test(line)) continue;
    if (/\bas\s+[A-Z]|\bas\s+unknown|satisfies\s+/.test(line)) continue;
    if (hasIgnoreTag(lines, i, '@cache-parse-allowed')) continue;

    issues.push({
      file: relativePath(filePath),
      line: i + 1,
      rule: 'no-unasserted-cache-parse',
      message:
        "JSON.parse returns `any` and will silently satisfy this method's declared return type. A cached Prisma model has ISO strings where the type promises Dates (see f0e5511b). Assert the parsed shape, or rehydrate it. Suppress with // @cache-parse-allowed.",
      severity: 'error',
    });
  }
  return issues;
}

function checkRawRedisGetClient(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (filePath.endsWith('.spec.ts')) return issues;
  // The canonical client lives here; getClient() is its legitimate accessor.
  if (filePath.includes('common/redis/')) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//')) continue;
    if (hasIgnoreTag(lines, i, '@redis-raw-allowed')) continue;
    if (/\.getClient\s*\(\s*\)/.test(line)) {
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-raw-redis-getclient',
        message:
          'Raw redis.getClient() bypasses metrics + circuit breaker (the #274 blind spot). Use a RedisService method or redis.withClient(). Suppress with // @redis-raw-allowed.',
        severity: 'error',
      });
    }
  }
  return issues;
}

const REDIS_TTL_METHODS =
  /this\.redis(?:\?)?\.(setNXStrict|setNX|setJSON|set|pexpire|expire)\s*\(/;

// Rule 9: hardcoded numeric TTL passed to a RedisService write method.
function checkHardcodedRedisTtl(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (filePath.endsWith('.spec.ts')) return issues;
  if (filePath.endsWith('redis-ttl.constants.ts')) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//')) continue;
    if (hasIgnoreTag(lines, i, '@redis-ttl-allowed')) continue;
    const m = REDIS_TTL_METHODS.exec(line);
    if (!m) continue;
    const openCol = m.index + m[0].length - 1; // the '(' position
    const args = gatherParenText(lines, i, openCol).trim();
    // The TTL is the trailing argument; flag a bare numeric literal there.
    if (/,\s*\d[\d_]*(\s*\*\s*\d[\d_]*)*\s*$/.test(args)) {
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-hardcoded-redis-ttl',
        message:
          'Hardcoded TTL on a Redis write — use REDIS_TTL.* from common/redis/redis-ttl.constants (single source of truth). Suppress with // @redis-ttl-allowed.',
        severity: 'error',
      });
    }
  }
  return issues;
}

const REDIS_OP_TOKEN =
  /this\.redis(?:\?)?\.|\.getClient\s*\(|\.withClient\s*\(/;

// Rule 10: setInterval polling Redis on a fixed <30s cadence — the #274 quota-burn
// pattern. Use setTimeout-reschedule with idle backoff instead.
function checkRedisPollWithoutBackoff(
  filePath: string,
  lines: string[],
): Issue[] {
  const issues: Issue[] = [];
  if (filePath.endsWith('.spec.ts')) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//')) continue;
    if (hasIgnoreTag(lines, i, '@redis-poll-allowed')) continue;
    const idx = line.indexOf('setInterval(');
    if (idx === -1) continue;
    const openCol = idx + 'setInterval'.length; // points at '('
    const args = gatherParenText(lines, i, openCol);
    // Interval is the trailing numeric argument.
    const m = args.trim().match(/,\s*(\d[\d_]*)\s*$/);
    if (!m) continue; // dynamic interval (variable) — not the static-burn pattern
    const intervalMs = Number(m[1].replace(/_/g, ''));
    if (!Number.isFinite(intervalMs) || intervalMs >= 30_000) continue;
    if (!REDIS_OP_TOKEN.test(args)) continue; // callback doesn't touch Redis inline
    issues.push({
      file: relativePath(filePath),
      line: i + 1,
      rule: 'no-redis-poll-without-backoff',
      message:
        'setInterval polls Redis on a fixed <30s cadence (the #274 quota-burn pattern). Use setTimeout-reschedule with idle backoff. Suppress with // @redis-poll-allowed.',
      severity: 'error',
    });
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
      ...checkMagicArraySize(filePath, lines),
      ...checkUncappedArray(filePath, lines),
      ...checkMissingTest(filePath, lines),
      ...checkDuplicatedSelect(filePath, lines),
      ...checkSelectMappingDrift(filePath, lines),
      ...checkRawRedisGetClient(filePath, lines),
      ...checkHardcodedRedisTtl(filePath, lines),
      ...checkRedisPollWithoutBackoff(filePath, lines),
      ...checkUnassertedCacheParse(filePath, lines),
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
