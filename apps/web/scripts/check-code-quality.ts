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
 * 8. Tooltip used without TooltipProvider (runtime crash)
 * 9. DS semantic aliases bypassing the shared --ds-* namespace
 * 10. Undefined --ds-* references in web source
 * 11. Custom CSS Grid template (grid-cols-[...]) without min-w-0
 *     on the grid container itself (PR #214/#215/#217 root cause)
 *
 * Usage:
 *   npx tsx scripts/check-code-quality.ts           # Check all
 *   npx tsx scripts/check-code-quality.ts --staged   # Check staged files only
 */

import * as fs from 'fs';
import * as path from 'path';

const WEB_SRC = path.resolve(__dirname, '../src');
const SHARED_TOKENS_FILE = path.resolve(__dirname, '../../../packages/shared/src/design/tokens.ts');
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

function getAllFiles(dir: string, ext: string[] = ['.tsx', '.ts', '.css']): string[] {
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
        (f: string) =>
          f.startsWith('apps/web/src/') &&
          (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css'))
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

function isCachePolicyIgnored(lines: string[], index: number): boolean {
  return index > 0 && lines[index - 1].includes('@cache-policy-ignore-next-line');
}

const FORBIDDEN_SHADOW_PATTERNS = [
  /shadow-\[[^\]]*oklch\([^)]*[ _]0\.(?:1\d|[2-9]\d?)[^)]*\)[^\]]*\]/,
  /box-shadow:\s*[^;]*oklch\([^)]*[ _]0\.(?:1\d|[2-9]\d?)[^)]*\)/,
  /shadow-(primary|blue|cyan|violet|indigo|purple|pink|amber)-\d+\/\d+/,
];

const AI_SAAS_GRADIENT_PATTERNS = [
  /bg-gradient-to-[a-z]+\s+from-(blue|cyan|violet|purple|indigo|teal)-\d+.*(?:via-(blue|cyan|violet|purple|indigo|teal)-\d+.*)?to-(cyan|teal|violet|purple|indigo|blue)-\d+/,
  /bg-elegant-aurora|landing-hero-orb|aurora-bg/,
];

const TEXT_GRADIENT_PATTERNS = [
  /bg-clip-text.*bg-gradient|bg-gradient.*bg-clip-text/,
  /text-transparent.*bg-gradient|bg-gradient.*text-transparent/,
  /-webkit-background-clip:\s*text/,
];

const UI_SERIF_PATTERNS = [/font-serif\b/, /--font-serif\b/, /--font-heading\b/];
const ARBITRARY_RADIUS_PATTERNS = [
  /rounded-\[(?!(?:var\(|inherit\]))[^\]]+\]/,
  /border-radius:(?!\s*var\()\s*[^;]+;/,
];
// no-decorative-rotate — DS v2.1 §装饰规则禁止非必要装饰性旋转。
// Matches `transform: rotate(Xdeg)` for small decorative tilts (1-44deg or -44 to -1deg).
// Does NOT match: 0deg (identity), 90/180/360 (spinners/flips), rotate3d, rotateY/Z.
const DECORATIVE_ROTATE_PATTERNS = [
  /transform:\s*[^;]*\brotate\(\s*-?(?:[1-9]|[1-3]\d|4[0-4])(?:\.\d+)?\s*deg\b/,
];
const DS_ALIAS_NAMES = [
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--border',
  '--border-strong',
  '--input',
  '--ring',
  '--success',
  '--warning',
  '--destructive',
  '--info',
  '--info-surface',
] as const;
const DS_ALIAS_BYPASS_PATTERN = new RegExp(
  `(${DS_ALIAS_NAMES.map((name) => name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\s*:\\s*(?:oklch|rgb|rgba|hsl|hsla|#)`,
  'i'
);
const DS_VAR_REFERENCE_PATTERN = /var\((--ds-[a-z-]+)\)/g;
const DS_VAR_DEFINITION_PATTERN = /['"`](--ds-[a-z-]+)['"`]\s*:/g;

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

function getDefinedDsTokens(): Set<string> {
  if (!fs.existsSync(SHARED_TOKENS_FILE)) return new Set();
  const content = fs.readFileSync(SHARED_TOKENS_FILE, 'utf8');
  return new Set([...content.matchAll(DS_VAR_DEFINITION_PATTERN)].map((match) => match[1]));
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

function checkTooltipWithoutProvider(filePath: string, content: string): Issue[] {
  const issues: Issue[] = [];
  if (!filePath.endsWith('.tsx')) return issues;
  // Skip the tooltip component definition itself
  if (filePath.includes('components/ui/tooltip.tsx')) return issues;

  // File imports Tooltip but not TooltipProvider
  const importsTooltip =
    /import\s+\{[^}]*\bTooltip\b[^}]*\}\s+from\s+['"]@\/components\/ui\/tooltip['"]/.test(content);
  if (!importsTooltip) return issues;

  const importsProvider =
    /import\s+\{[^}]*\bTooltipProvider\b[^}]*\}\s+from\s+['"]@\/components\/ui\/tooltip['"]/.test(
      content
    );
  if (importsProvider) return issues;

  // Find the line with the import
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes('Tooltip') &&
      lines[i].includes('from') &&
      lines[i].includes('@/components/ui/tooltip')
    ) {
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-tooltip-without-provider',
        message:
          'Imports Tooltip but not TooltipProvider — will crash at runtime. Add TooltipProvider wrapper.',
        severity: 'error',
      });
      break;
    }
  }
  return issues;
}

function checkForbiddenShadows(filePath: string, lines: string[]): Issue[] {
  return scanPatternRule(
    filePath,
    lines,
    FORBIDDEN_SHADOW_PATTERNS,
    'no-forbidden-shadow',
    'Colored glow shadow detected. Use neutral DS shadows (`--shadow-card` / `--shadow-elevated`) instead.',
    'error'
  );
}

function checkAiSaasGradient(filePath: string, lines: string[]): Issue[] {
  return scanPatternRule(
    filePath,
    lines,
    AI_SAAS_GRADIENT_PATTERNS,
    'no-ai-saas-gradient',
    'AI SaaS gradient / aurora pattern detected. Use solid surfaces or low-contrast texture instead.',
    'error'
  );
}

function checkTextGradientClip(filePath: string, lines: string[]): Issue[] {
  return scanPatternRule(
    filePath,
    lines,
    TEXT_GRADIENT_PATTERNS,
    'no-text-gradient-clip',
    'Text gradient clipping detected. Use solid text colors and semantic emphasis instead.',
    'warning'
  );
}

function checkUIFontSerif(filePath: string, lines: string[]): Issue[] {
  return scanPatternRule(
    filePath,
    lines,
    UI_SERIF_PATTERNS,
    'no-font-serif-ui',
    'UI surface is using serif typography. Keep page chrome on the shared sans stack unless explicitly allowlisted.',
    'warning'
  );
}

function checkArbitraryRadius(filePath: string, lines: string[]): Issue[] {
  return scanPatternRule(
    filePath,
    lines,
    ARBITRARY_RADIUS_PATTERNS,
    'no-arbitrary-radius',
    'Arbitrary radius detected. Use design-system radius tiers instead of magic values.',
    'warning'
  );
}

function checkDecorativeRotate(filePath: string, lines: string[]): Issue[] {
  // Skip non-CSS files — rotate in .tsx usually comes from Framer Motion interactive rotations (allowed)
  if (!filePath.endsWith('.css')) return [];
  return scanPatternRule(
    filePath,
    lines,
    DECORATIVE_ROTATE_PATTERNS,
    'no-decorative-rotate',
    'Decorative rotate(Xdeg) detected. DS v2.1 §装饰规则 forbids non-essential rotation. Use clean translate / scale / opacity.',
    'warning'
  );
}

function checkDsVarBypass(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line) || isDesignSystemIgnored(lines, i)) continue;

    if (DS_ALIAS_BYPASS_PATTERN.test(line)) {
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-ds-var-bypass',
        message:
          'DS semantic alias is assigned a literal color value. Route semantic aliases through var(--ds-*) instead.',
        severity: 'error',
      });
    }
  }

  return issues;
}

// 2026-05 PR 3 (follow-up to #214/#215/#217):
// Custom CSS Grid templates that use bespoke pixel/minmax column
// definitions (e.g. `grid-cols-[360px_1fr_320px]`,
// `lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)_minmax(260px,320px)]`)
// MUST set `min-w-0` on the grid container itself. CSS Grid defaults
// each item's `min-width` to `auto`, which refuses to shrink below the
// intrinsic content width. Without min-w-0 on the container, a long
// child can push the container past its allotted parent width,
// cascading through every ancestor and ultimately past the viewport.
//
// We allow the standard `grid-cols-N` shorthand (no custom template)
// because those don't trigger the auto-min-width pathology in the
// same way (Tailwind's defaults pair them with safe child sizing).
//
// Severity = warning (not error) so existing pages with long-tail
// false positives don't block CI immediately; the rule will be
// upgraded to error once the codebase is clean.
const CUSTOM_GRID_TEMPLATE_PATTERN = /(?:lg:|xl:|2xl:|md:|sm:)?grid-cols-\[[^\]]+\]/;

function checkGridMinW(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (!filePath.endsWith('.tsx')) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;
    if (!CUSTOM_GRID_TEMPLATE_PATTERN.test(line)) continue;

    // Look for `min-w-0` on the SAME line (where the className lives).
    // We tolerate `lg:min-w-0` / `md:min-w-0` too — same idea, just
    // breakpoint-scoped. Also tolerate explicit `min-w-` with any
    // value (e.g. `min-w-full`).
    if (/\bmin-w-(?:0|full|\[[^\]]+\])\b/.test(line)) continue;

    issues.push({
      file: relativePath(filePath),
      line: i + 1,
      rule: 'no-missing-min-w-in-grid-container',
      message:
        'Custom CSS Grid template without `min-w-0` on the grid container — long content in any cell can push the container past its parent width (see PR #214/#215/#217). Add `min-w-0` to the same className.',
      severity: 'warning',
    });
  }
  return issues;
}

function checkUndefinedDsVar(
  filePath: string,
  lines: string[],
  definedDsTokens: Set<string>
): Issue[] {
  const issues: Issue[] = [];
  const seenInFile = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line) || isDesignSystemIgnored(lines, i)) continue;

    for (const match of line.matchAll(DS_VAR_REFERENCE_PATTERN)) {
      const token = match[1];
      if (definedDsTokens.has(token) || seenInFile.has(token)) continue;
      seenInFile.add(token);
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-undefined-ds-var',
        message: `References ${token}, but it is not defined in the shared token source.`,
        severity: 'error',
      });
    }
  }

  return issues;
}

// ── Cache-policy / query-key rules (unified caching layer — see lib/query/) ──

/**
 * First-segment domain strings that have a `qk` builder and represent a LIST.
 * An inline `queryKey: ['<domain>', …]` for one of these should route through the
 * `qk` factory instead, so keys + invalidations can't drift apart.
 */
const QK_LIST_DOMAINS = [
  'cases',
  'schools',
  'school-lists',
  'social-relations',
  'social-overview',
  'recommended-users',
  'notifications',
  'notifications-unread-count',
  'ranking',
  'teams',
  'forum',
];

// The factory itself, tests, and type defs may hold inline keys legitimately.
const CACHE_POLICY_EXEMPT_FILES = ['/lib/query/', '/hooks/use-list-query', '.test.', '.spec.'];

// Signals that a query (or its surrounding block) is a paginated/searchable list.
const LIST_SIGNAL_PATTERN =
  /useInfiniteQuery|useListQuery|usePaginatedQuery|keepPreviousData|placeholderData|pageSize|\bpage\b|\bsearch\b|\bfilters\b/;

/** (a) Inline list query key instead of the `qk` factory. */
function checkInlineListQueryKey(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (isExempt(filePath, CACHE_POLICY_EXEMPT_FILES)) return issues;
  const domainAlt = QK_LIST_DOMAINS.map((d) => d.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join(
    '|'
  );
  const pattern = new RegExp(`queryKey:\\s*\\[\\s*['"\`](${domainAlt})['"\`]`);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line) || isCachePolicyIgnored(lines, i)) continue;
    const m = line.match(pattern);
    if (m) {
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-inline-list-query-key',
        message: `Inline list query key ['${m[1]}', …] — use the \`qk\` factory (import { qk } from '@/lib/query') so keys + invalidations stay consistent. Suppress with // @cache-policy-ignore-next-line.`,
        // PROMOTED to error 2026-06: web inline-key worklist cleared to 0.
        severity: 'error',
      });
    }
  }
  return issues;
}

/** (b) A short-lived staleTime (DYNAMIC/REALTIME) on what looks like a list query. */
function checkDynamicStaleTimeOnList(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (isExempt(filePath, CACHE_POLICY_EXEMPT_FILES)) return issues;
  const WINDOW = 8;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line) || isCachePolicyIgnored(lines, i)) continue;
    if (!/staleTime:\s*STALE_TIME\.(?:DYNAMIC|REALTIME)/.test(line)) continue;
    let hasListSignal = false;
    for (let j = Math.max(0, i - WINDOW); j <= Math.min(lines.length - 1, i + WINDOW); j++) {
      if (j !== i && LIST_SIGNAL_PATTERN.test(lines[j])) {
        hasListSignal = true;
        break;
      }
    }
    if (hasListSignal) {
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'no-dynamic-staletime-on-list',
        message:
          'Short staleTime (DYNAMIC/REALTIME) on a list query causes refetch thrash. Spread a `cachePolicy` tier (reference/standard) instead. Suppress with // @cache-policy-ignore-next-line.',
        severity: 'warning',
      });
    }
  }
  return issues;
}

/** (c) A paginated/searchable query in a file that never sets keepPreviousData. */
function checkListQueryNeedsKeepPrevious(filePath: string, lines: string[]): Issue[] {
  const issues: Issue[] = [];
  if (isExempt(filePath, CACHE_POLICY_EXEMPT_FILES)) return issues;
  const content = lines.join('\n');
  // Files on the shared list hook already bake in keepPreviousData.
  if (/useListQuery|usePaginatedQuery/.test(content)) return issues;
  if (/keepPreviousData|placeholderData/.test(content)) return issues;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line) || isCachePolicyIgnored(lines, i)) continue;
    const isInfinite = /useInfiniteQuery\s*[<(]/.test(line);
    const isOffsetList =
      /useQuery\s*[<(]/.test(line) &&
      lines.slice(i, i + 15).some((l) => /pageSize|page:\s|['"]page['"]/.test(l));
    if (isInfinite || isOffsetList) {
      issues.push({
        file: relativePath(filePath),
        line: i + 1,
        rule: 'list-query-needs-keep-previous',
        message:
          'Paginated/searchable query without keepPreviousData — the list blanks to a skeleton on every page/filter change. Add `placeholderData: keepPreviousData` (or use the shared list hook). Suppress with // @cache-policy-ignore-next-line.',
        severity: 'warning',
      });
      return issues; // one finding per file is enough to flag it
    }
  }
  return issues;
}

// ── Main ───────────────────────────────────────────────────

function main() {
  const files = stagedOnly ? getStagedFiles() : getAllFiles(WEB_SRC);
  const definedDsTokens = getDefinedDsTokens();

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
      ...checkForbiddenShadows(filePath, lines),
      ...checkAiSaasGradient(filePath, lines),
      ...checkTextGradientClip(filePath, lines),
      ...checkUIFontSerif(filePath, lines),
      ...checkArbitraryRadius(filePath, lines),
      ...checkDecorativeRotate(filePath, lines),
      ...checkDsVarBypass(filePath, lines),
      ...checkUndefinedDsVar(filePath, lines, definedDsTokens),
      ...checkGridMinW(filePath, lines),
      ...checkPageSize(filePath, lines),
      ...checkConsole(filePath, lines),
      ...checkMissingLoading(filePath),
      ...checkMissingErrorBoundary(filePath),
      ...checkTooltipWithoutProvider(filePath, content),
      ...checkInlineListQueryKey(filePath, lines),
      ...checkDynamicStaleTimeOnList(filePath, lines),
      ...checkListQueryNeedsKeepPrevious(filePath, lines)
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

  // Exit with error if there are blocking issues. Fail under BOTH pre-commit
  // (--staged) AND CI — previously CI ran without --staged, so `error`-severity rules
  // never blocked there (toothless). Mirrors the mobile checker.
  if (errors.length > 0 && (stagedOnly || isCI)) {
    process.exit(1);
  }
}

main();
