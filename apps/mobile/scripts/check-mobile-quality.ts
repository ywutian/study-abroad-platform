/**
 * Code quality checks for the mobile app.
 * Catches common React Native issues that ESLint rules don't cover:
 *
 * 1. Dynamic style interpolation in style props (should use theme vars)
 * 2. Hardcoded colors in StyleSheet.create (should use useColors() theme)
 * 3. console.log/error in production code (exclude test files)
 * 4. Component files exceeding 500 lines
 * 5. Mobile theme adapter drifting from shared canonical tokens
 *
 * Usage:
 *   npx tsx scripts/check-mobile-quality.ts           # Check all
 *   npx tsx scripts/check-mobile-quality.ts --staged   # Check staged files only
 */

import * as fs from 'fs';
import * as path from 'path';

const MOBILE_SRC = path.resolve(__dirname, '../src');
const isCI = !!process.env.CI;
const stagedOnly = process.argv.includes('--staged');

// ── Types ──────────────────────────────────────────────────

interface Issue {
  file: string;
  line: number;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

// ── Config ─────────────────────────────────────────────────

// Dynamic style interpolation: template literals inside style props
const DYNAMIC_STYLE_PATTERNS = [
  // Template literal color in style: backgroundColor: `${color}`
  /style\s*=\s*\{[^}]*`[^`]*\$\{/,
  // Template literal in StyleSheet value: color: `${something}`
  /:\s*`[^`]*\$\{[^}]*\}[^`]*`/,
];

const DYNAMIC_STYLE_EXEMPT_FILES = ['.test.', '.spec.', '__tests__/', 'scripts/'];

// Hardcoded color patterns: hex, rgb(), rgba() in StyleSheet or style objects
const HARDCODED_COLOR_PATTERNS = [
  // Hex colors: #fff, #000, #1a2b3c, #1a2b3cff
  /(?:color|backgroundColor|borderColor|shadowColor|tintColor)\s*:\s*['"]#[0-9a-fA-F]{3,8}['"]/,
  // rgb/rgba colors
  /(?:color|backgroundColor|borderColor|shadowColor|tintColor)\s*:\s*['"]rgba?\(/,
];

const HARDCODED_COLOR_EXEMPT_FILES = [
  '.test.',
  '.spec.',
  '__tests__/',
  'scripts/',
  'theme.ts',
  'colors.ts',
  'constants.ts',
];

const LINEAR_GRADIENT_PATTERNS = [
  /<LinearGradient\b/,
  /from ['"]expo-linear-gradient['"]/,
  /from "expo-linear-gradient"/,
];

const LEGACY_GRADIENT_PATTERNS = [
  /gradients\.(primary|primarySoft|primaryDark|hero|heroDark|success|warning|error|info|rose|violet|amber|emerald|meshPrimary|meshSuccess|meshWarm)/,
];

const LARGE_ELEVATION_PATTERN = /\belevation\s*:\s*(?:[3-9]|\d{2,})/;
const HARDCODED_STATUS_PATTERN =
  /(backgroundColor|borderColor|color)\s*:\s*colors\.(success|warning|error|info)/;
const SHARED_THEME_DRIFT_PATTERN =
  /\b(primary|primaryForeground|background|foreground|card|border|muted|accent|success|warning|error|info|surfaceMuted|surfaceSubtle|infoSurface)\s*:\s*['"][^'"]+['"]/;

const CONSOLE_PATTERN = /\bconsole\.(log|error|warn)\b/;
const CONSOLE_EXEMPT_FILES = ['.test.', '.spec.', '__tests__/', 'scripts/', '__mocks__/'];

const FILE_LINE_LIMIT = 500;
const FILE_SIZE_EXEMPT = ['.test.', '.spec.', '__tests__/', 'scripts/', 'locales/'];

// ── Helpers ────────────────────────────────────────────────

function getAllFiles(dir: string, ext: string[] = ['.tsx', '.ts']): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.expo', '__tests__'].includes(entry.name)) continue;
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
      .filter(
        (f: string) => f.startsWith('apps/mobile/src/') && (f.endsWith('.tsx') || f.endsWith('.ts'))
      )
      .map((f: string) => path.resolve(__dirname, '../../..', f));
  } catch {
    return [];
  }
}

function relativePath(filePath: string): string {
  return path.relative(path.resolve(__dirname, '../../..'), filePath);
}

function isExempt(filePath: string, exemptList: string[]): boolean {
  return exemptList.some((p) => filePath.includes(p));
}

// ── Checks ─────────────────────────────────────────────────

function checkDynamicStyles(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (isExempt(filePath, DYNAMIC_STYLE_EXEMPT_FILES)) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    for (const pattern of DYNAMIC_STYLE_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          file: relativePath(filePath),
          line: i + 1,
          rule: 'no-dynamic-style',
          message:
            'Dynamic style interpolation detected. Use useColors() theme values instead of template literals.',
          severity: 'warning',
        });
        break;
      }
    }
  }
  return issues;
}

function checkHardcodedColors(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (isExempt(filePath, HARDCODED_COLOR_EXEMPT_FILES)) return issues;
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    for (const pattern of HARDCODED_COLOR_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          file: relativePath(filePath),
          line: i + 1,
          rule: 'no-hardcoded-color',
          message: 'Hardcoded color in style. Use useColors() theme for dynamic theming support.',
          severity: 'warning',
        });
        break;
      }
    }
  }
  return issues;
}

function checkConsole(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (isExempt(filePath, CONSOLE_EXEMPT_FILES)) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//')) continue;

    if (CONSOLE_PATTERN.test(line)) {
      if (line.includes('NODE_ENV') || line.includes('__DEV__')) continue;
      if (/console\.warn/.test(line) && !/console\.(log|error)/.test(line)) continue;

      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-console-in-prod',
        message: 'console.log/error in production code. Remove debug logs or guard with __DEV__.',
        severity: 'warning',
      });
    }
  }
  return issues;
}

function checkFileSize(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (isExempt(filePath, FILE_SIZE_EXEMPT)) return issues;

  if (lines.length > FILE_LINE_LIMIT) {
    issues.push({
      file: relativePath(filePath),
      line: 1,
      rule: 'file-size-limit',
      message: `File has ${lines.length} lines (limit: ${FILE_LINE_LIMIT}). Consider splitting into smaller components.`,
      severity: 'warning',
    });
  }
  return issues;
}

function checkLinearGradientHero(filePath: string, lines: string[]): Issue[] {
  return scanPatternRule(
    filePath,
    lines,
    LINEAR_GRADIENT_PATTERNS,
    'no-linear-gradient-hero',
    'Page-level LinearGradient detected. Use neutral surfaces unless the file is explicitly allowlisted.',
    'warning'
  );
}

function checkLegacyGradientPalette(filePath: string, lines: string[]): Issue[] {
  return scanPatternRule(
    filePath,
    lines,
    LEGACY_GRADIENT_PATTERNS,
    'no-legacy-gradient-palette',
    'Legacy decorative gradient token detected. Use the restricted allowlist gradients only.',
    'warning'
  );
}

function checkLargeElevation(filePath: string, lines: string[]): Issue[] {
  return scanPatternRule(
    filePath,
    lines,
    [LARGE_ELEVATION_PATTERN],
    'no-large-elevation',
    'Large elevation detected. Limit page chrome to DS card / elevated shadows.',
    'warning'
  );
}

function checkHardcodedStatusColor(filePath: string, lines: string[]): Issue[] {
  return scanPatternRule(
    filePath,
    lines,
    [HARDCODED_STATUS_PATTERN],
    'no-page-chrome-hardcoded-status-color',
    'Direct status color usage detected. Route through shared semantic status primitives instead.',
    'warning'
  );
}

function checkSharedTokenDrift(filePath: string, lines: string[]): Issue[] {
  if (!filePath.endsWith('src/utils/theme.ts')) return [];

  return scanPatternRule(
    filePath,
    lines,
    [SHARED_THEME_DRIFT_PATTERN],
    'no-shared-token-drift',
    'Mobile theme adapter is hand-writing a canonical DS color. Consume the shared token source instead.',
    'error'
  );
}

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('{/*')
  );
}

function isDesignSystemIgnored(lines: string[], index: number): boolean {
  return index > 0 && lines[index - 1].includes('@design-system-ignore-next-line');
}

function scanPatternRule(
  filePath: string,
  lines: string[],
  patterns: RegExp[],
  rule: string,
  message: string,
  severity: Issue['severity']
): Issue[] {
  const issues: Issue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line) || isDesignSystemIgnored(lines, i)) continue;
    if (patterns.some((pattern) => pattern.test(line))) {
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule,
        message,
        severity,
      });
    }
  }

  return issues;
}

// ── Main ───────────────────────────────────────────────────

function main() {
  const files = stagedOnly ? getStagedFiles() : getAllFiles(MOBILE_SRC);

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
      ...checkDynamicStyles(filePath, lines),
      ...checkHardcodedColors(filePath, lines),
      ...checkLinearGradientHero(filePath, lines),
      ...checkLegacyGradientPalette(filePath, lines),
      ...checkLargeElevation(filePath, lines),
      ...checkHardcodedStatusColor(filePath, lines),
      ...checkSharedTokenDrift(filePath, lines),
      ...checkConsole(filePath, lines),
      ...checkFileSize(filePath, lines)
    );
  }

  const errors = allIssues.filter((i) => i.severity === 'error');
  const warnings = allIssues.filter((i) => i.severity === 'warning');

  if (allIssues.length === 0) {
    console.log('✅ Mobile code quality checks passed!');
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
    console.log(`${icon} ${rule} (${issues.length} issue${issues.length > 1 ? 's' : ''}):`);
    for (const issue of issues.slice(0, 10)) {
      console.log(`   ${issue.file}:${issue.line} — ${issue.message}`);
    }
    if (issues.length > 10) {
      console.log(`   ... and ${issues.length - 10} more`);
    }
    console.log('');
  }

  console.log(`Total: ${errors.length} error(s), ${warnings.length} warning(s)`);
  console.log('');

  if (errors.length > 0 || isCI) {
    process.exit(errors.length > 0 ? 1 : 0);
  }
}

main();
