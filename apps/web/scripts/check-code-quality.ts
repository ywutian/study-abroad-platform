/**
 * Code quality checks for the web app.
 * Catches common issues that ESLint rules don't cover:
 *
 * 1. Dynamic Tailwind class interpolation (purged in production)
 * 2. Hardcoded slate colors without dark: variants
 * 3. Hardcoded gray colors without dark: variants
 * 4. Pages exceeding line limit (500) without _components/ split
 * 5. console.log/error in production code (except error boundaries)
 * 6. Pages missing sibling loading.tsx skeleton
 * 7. Route groups missing error.tsx boundary
 *
 * Usage:
 *   npx tsx scripts/check-code-quality.ts           # Check all
 *   npx tsx scripts/check-code-quality.ts --staged   # Check staged files only
 */

import * as fs from 'fs';
import * as path from 'path';

const WEB_SRC = path.resolve(__dirname, '../src');
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

const DYNAMIC_CLASS_PATTERNS = [
  // Template literal color interpolation: `bg-${color}-500`
  /`[^`]*\$\{[^}]+\}[^`]*-(?:50|100|200|300|400|500|600|700|800|900|950)/,
  // Template literal responsive interpolation: `text-${size}`
  /`(?:text|bg|border|ring|shadow)-\$\{/,
  // Template literal with sm:/md:/lg: prefix interpolation
  /`(?:sm|md|lg|xl|2xl):\$\{/,
];

const DYNAMIC_CLASS_SAFE_PATTERNS = [
  // Reading from a constant object is safe: typeColors[type], tab.color (full class strings)
  /\$\{[a-zA-Z_]+\[[a-zA-Z_]+\]/, // obj[key] pattern
  /\$\{[a-zA-Z_]+\.[a-zA-Z_]+\}/, // obj.prop pattern — only if the object contains full classes
];

// Files exempt from dynamic class checks (they use full class strings from constants)
const DYNAMIC_CLASS_EXEMPT_FILES = [
  'vault-create-dialog.tsx',
  'vault-sidebar.tsx',
  'onboarding-guide.tsx',
  'activity-form.tsx',
  'subscription/page.tsx',
];

// Slate colors that likely need dark: variants
const HARDCODED_SLATE_PATTERNS = [
  /(?<!dark:)\bbg-slate-(?:800|900)\b(?!.*dark:)/,
  /(?<!dark:)\btext-slate-(?:300|400)\b(?!.*dark:)/,
];

// Exempt from slate color checks
const SLATE_EXEMPT_FILES = ['globals.css', 'tailwind.config', '.test.', '.spec.', 'loading.tsx'];

// Gray colors without dark: variant (common dark mode issue)
const HARDCODED_GRAY_PATTERNS = [
  /(?<!dark:)\bbg-gray-(?:50|100|200)\b(?!.*dark:)/,
  /(?<!dark:)\btext-gray-(?:500|600|700|900)\b(?!.*dark:)/,
  /(?<!dark:)\bborder-gray-(?:100|200|300)\b(?!.*dark:)/,
];

const GRAY_EXEMPT_FILES = ['globals.css', 'tailwind.config', '.test.', '.spec.', 'loading.tsx'];

const PAGE_LINE_LIMIT = 500;

const CONSOLE_PATTERN = /\bconsole\.(log|error|warn)\b/;
const CONSOLE_EXEMPT_FILES = [
  'error.tsx',
  'error-boundary',
  '.test.',
  '.spec.',
  'scripts/',
  'check-',
  'lib/env.ts',
];

// Pages exempt from missing loading.tsx check
const LOADING_EXEMPT_PATHS = [
  '/(auth)/', // Auth group shares a single loading.tsx
  '/privacy/',
  '/terms/',
  '/about/',
  '/not-found',
  '/_components/',
];

// The app root where error.tsx search stops
const APP_ROOT_MARKER = 'app/[locale]';

// ── Helpers ────────────────────────────────────────────────

function getAllFiles(dir: string, ext: string[] = ['.tsx', '.ts']): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'scripts'].includes(entry.name)) continue;
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
        (f: string) => f.startsWith('apps/web/src/') && (f.endsWith('.tsx') || f.endsWith('.ts'))
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

function checkDynamicClasses(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (isExempt(filePath, DYNAMIC_CLASS_EXEMPT_FILES)) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
    // Only check lines that are likely CSS class contexts (not React key props, etc.)
    if (
      !line.includes('className') &&
      !line.includes('class') &&
      !line.includes('cn(') &&
      !line.includes('clsx(')
    )
      continue;

    for (const pattern of DYNAMIC_CLASS_PATTERNS) {
      if (pattern.test(line)) {
        // Check if it's a safe pattern (reading from constant object)
        const isSafe = DYNAMIC_CLASS_SAFE_PATTERNS.some((sp) => sp.test(line));
        if (!isSafe) {
          issues.push({
            file: relativePath(filePath),
            line: i + 1,
            rule: 'no-dynamic-tailwind',
            message: `Dynamic Tailwind class interpolation will be purged in production. Use a static class map instead.`,
            severity: 'error',
          });
        }
        break; // One issue per line
      }
    }
  }
  return issues;
}

function checkHardcodedSlate(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (isExempt(filePath, SLATE_EXEMPT_FILES)) return issues;
  // Only check .tsx files (UI components)
  if (!filePath.endsWith('.tsx')) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    for (const pattern of HARDCODED_SLATE_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          file: relativePath(filePath),
          line: i + 1,
          rule: 'no-hardcoded-dark-bg',
          message: `Hardcoded slate color without dark: variant. Use CSS variables (bg-background, text-muted-foreground) or add dark: variant.`,
          severity: 'warning',
        });
        break;
      }
    }
  }
  return issues;
}

function checkHardcodedGray(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (isExempt(filePath, GRAY_EXEMPT_FILES)) return issues;
  if (!filePath.endsWith('.tsx')) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    for (const pattern of HARDCODED_GRAY_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          file: relativePath(filePath),
          line: i + 1,
          rule: 'no-hardcoded-gray',
          message: `Hardcoded gray color without dark: variant. Use semantic classes (bg-muted, text-muted-foreground, border-border) or add dark: variant.`,
          severity: 'warning',
        });
        break;
      }
    }
  }
  return issues;
}

function checkPageSize(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  // Only check page.tsx files
  if (!filePath.endsWith('page.tsx')) return issues;

  if (lines.length > PAGE_LINE_LIMIT) {
    // Check if _components/ directory exists
    const dir = path.dirname(filePath);
    const componentsDir = path.join(dir, '_components');
    if (!fs.existsSync(componentsDir)) {
      issues.push({
        file: relativePath(filePath),
        line: 1,
        rule: 'page-size-limit',
        message: `Page has ${lines.length} lines (limit: ${PAGE_LINE_LIMIT}). Split into thin page.tsx + _components/ directory.`,
        severity: 'warning',
      });
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
      // Allow console in development conditionals
      if (line.includes('NODE_ENV') || line.includes('development')) continue;
      // Allow console.warn (useful for deprecation notices)
      if (/console\.warn/.test(line) && !/console\.(log|error)/.test(line)) continue;

      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-console-in-prod',
        message: `console.log/error in production code. Use toast for user-facing errors, remove for debug logs.`,
        severity: 'warning',
      });
    }
  }
  return issues;
}

function checkMissingLoading(filePath: string): Issue[] {
  const issues: Issue[] = [];
  if (!filePath.endsWith('page.tsx')) return issues;
  if (LOADING_EXEMPT_PATHS.some((p) => filePath.includes(p))) return issues;

  const dir = path.dirname(filePath);
  const loadingFile = path.join(dir, 'loading.tsx');
  if (!fs.existsSync(loadingFile)) {
    issues.push({
      file: relativePath(filePath),
      line: 1,
      rule: 'no-missing-loading',
      message: `Page has no sibling loading.tsx. Add a Skeleton loading state for better UX.`,
      severity: 'warning',
    });
  }
  return issues;
}

function checkMissingErrorBoundary(filePath: string): Issue[] {
  const issues: Issue[] = [];
  if (!filePath.endsWith('page.tsx')) return issues;
  if (LOADING_EXEMPT_PATHS.some((p) => filePath.includes(p))) return issues;

  // Walk up directory tree looking for error.tsx (up to the app/ directory)
  let dir = path.dirname(filePath);
  let found = false;
  while (dir.includes('src/app')) {
    if (fs.existsSync(path.join(dir, 'error.tsx'))) {
      found = true;
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }

  if (!found) {
    issues.push({
      file: relativePath(filePath),
      line: 1,
      rule: 'no-missing-error-boundary',
      message: `No error.tsx found in this route or any parent. Add an error boundary for graceful error handling.`,
      severity: 'warning',
    });
  }
  return issues;
}

// ── Main ───────────────────────────────────────────────────

function main() {
  const files = stagedOnly ? getStagedFiles() : getAllFiles(WEB_SRC);

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
      ...checkDynamicClasses(filePath, lines),
      ...checkHardcodedSlate(filePath, lines),
      ...checkHardcodedGray(filePath, lines),
      ...checkPageSize(filePath, lines),
      ...checkConsole(filePath, lines),
      ...checkMissingLoading(filePath),
      ...checkMissingErrorBoundary(filePath)
    );
  }

  const errors = allIssues.filter((i) => i.severity === 'error');
  const warnings = allIssues.filter((i) => i.severity === 'warning');

  if (allIssues.length === 0) {
    console.log('✅ Code quality checks passed!');
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

  // Exit with error if there are blocking issues
  if (errors.length > 0 || isCI) {
    process.exit(errors.length > 0 ? 1 : 0);
  }
}

main();
