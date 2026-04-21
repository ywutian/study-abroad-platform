/**
 * Hardcoded English Detection Script (i18n Layer 5)
 *
 * Scans .tsx files for user-visible English strings not wrapped in t() calls.
 * Produces a report to guide AI-assisted or manual i18n audit.
 *
 * Usage:
 *   npx tsx scripts/check-hardcoded-english.ts                  # Full scan
 *   npx tsx scripts/check-hardcoded-english.ts --staged          # Staged files only
 *   npx tsx scripts/check-hardcoded-english.ts --path admin      # Filter by path
 */

import * as fs from 'fs';
import * as path from 'path';

const WEB_SRC = path.resolve(__dirname, '../src');
const stagedOnly = process.argv.includes('--staged');
const pathFilter = (() => {
  const idx = process.argv.indexOf('--path');
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

// ── Types ──────────────────────────────────────────────────

interface Issue {
  file: string;
  line: number;
  rule: string;
  content: string;
  confidence: 'high' | 'medium' | 'low';
}

// ── Exemption Config ───────────────────────────────────────

/** Files to skip entirely */
const EXEMPT_FILES = [
  'loading.tsx',
  '.spec.ts',
  '.spec.tsx',
  '.test.ts',
  '.test.tsx',
  'messages/en.json',
  'messages/zh.json',
  'globals.css',
  'types.ts',
  'types/index.ts',
  'i18n.d.ts',
  'constants.ts',
  'lib/constants.ts',
  'scripts/',
  'check-',
  'proxy.ts',
];

/** Line patterns to skip — these are never user-visible text */
const EXEMPT_LINE_PATTERNS = [
  /^\s*\/\//, // Single-line comments
  /^\s*\*/, // Multi-line comment body
  /^\s*\/\*/, // Multi-line comment start
  /^\s*\{\/\*/, // JSX comment
  /^\s*import\s/, // Import statements
  /^\s*export\s+(type|interface)\b/, // Type exports
  /^\s*console\./, // Console calls
  /className[=:]/, // CSS class strings
  /queryKey/, // React Query keys
  /mutationFn/, // Mutation functions
  /apiClient\./, // API calls
  /queryFn/, // Query functions
  /\.get\(["'`]\//, // API path: .get('/api/...')
  /\.post\(["'`]\//, // API path: .post('/api/...')
  /\.put\(["'`]\//, // API path: .put('/api/...')
  /\.delete\(["'`]\//, // API path: .delete('/api/...')
  /^\s*const\s+\w+\s*[:=]/, // Variable declarations (usually not user text)
  /^\s*type\s+/, // Type definitions
  /^\s*interface\s+/, // Interface definitions
  /^\s*function\s+/, // Function definitions
  /^\s*return\s/, // Return statements (ambiguous)
  /key=\{/, // React key prop
  /\.includes\(/, // String operations
  /\.startsWith\(/, // String operations
  /\.endsWith\(/, // String operations
  /\.match\(/, // Regex operations
  /\.replace\(/, // String operations
  /\.split\(/, // String operations
  /throw new/, // Error throws
  /process\.env/, // Environment variables
  /useQuery\(/, // Hook calls
  /useMutation\(/, // Hook calls
  /useState\(/, // Hook calls
  /useEffect\(/, // Hook calls
  /useMemo\(/, // Hook calls
  /useCallback\(/, // Hook calls
  /useRef\(/, // Hook calls
];

/** HTML/JSX attributes that should NOT be flagged */
const NON_TRANSLATABLE_ATTRS = [
  'variant',
  'size',
  'type',
  'name',
  'id',
  'href',
  'src',
  'value',
  'key',
  'className',
  'onClick',
  'onChange',
  'onSubmit',
  'onBlur',
  'onFocus',
  'onKeyDown',
  'onKeyUp',
  'role',
  'tabIndex',
  'method',
  'action',
  'target',
  'rel',
  'data-',
  'asChild',
  'side',
  'align',
  'colSpan',
  'rows',
  'cols',
  'min',
  'max',
  'step',
  'accept',
  'autoComplete',
  'disabled',
  'required',
  'checked',
  'selected',
  'open',
  'defaultValue',
  'defaultOpen',
  'delayDuration',
];

/** Translatable attributes — these SHOULD be localized */
const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'alt', 'description', 'label'];

/** Strings that look like code/technical tokens, not user text */
const TECHNICAL_PATTERNS = [
  /^[A-Z_]{2,}$/, // ALL_CAPS constants (US, CN, INTL_CN)
  /^[a-z][a-zA-Z]+$/, // camelCase identifiers
  /^[a-z]+-[a-z]+/, // kebab-case (CSS-like)
  /^[\d.]+$/, // Numbers only
  /^https?:\/\//, // URLs
  /^\/[a-z]/, // Paths starting with /
  /^[a-z]+\.[a-z]+/, // Dotted identifiers (e.g., module.name)
  /^#[0-9a-fA-F]+$/, // Hex colors
  /^e\.g\.\s/, // Example prefix
  /^rgb/, // RGB colors
  /^hsl/, // HSL colors
  /^\d+px$/, // Pixel values
  /^\d+%$/, // Percentage values
  /^[A-Z]{1,2}\d+$/, // Short codes (T5, L1, etc.)
];

/** Known proper nouns and abbreviations that don't need translation */
const PROPER_NOUNS = new Set([
  'GPA',
  'SAT',
  'ACT',
  'TOEFL',
  'IELTS',
  'GRE',
  'GMAT',
  'AP',
  'IB',
  'A-Level',
  'JSON',
  'CSV',
  'PDF',
  'AI',
  'API',
  'URL',
  'UI',
  'UX',
  'MIT',
  'CMU',
  'UCLA',
  'MBTI',
  'Holland',
  'RIASEC',
  'OAuth',
  'JWT',
  'NestJS',
  'React',
  'Next.js',
  'TypeScript',
  'Prisma',
  'Redis',
  'PostgreSQL',
  'Tailwind',
  'CSS',
  'HTML',
  'WebSocket',
  'Socket.IO',
  'Niche',
  'CommonApp',
  'Coalition',
  'QS',
  'THE',
  'US News',
  'BC',
  'PGA',
  'VCE',
  'DSE',
  'ED',
  'ED II',
  'EA',
  'RD',
  'REA',
]);

// ── Helpers ────────────────────────────────────────────────

function getAllFiles(dir: string, ext: string[] = ['.tsx']): string[] {
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
      .filter((f: string) => f.startsWith('apps/web/src/') && f.endsWith('.tsx'))
      .map((f: string) => path.resolve(__dirname, '../../..', f));
  } catch {
    return [];
  }
}

function relativePath(filePath: string): string {
  return path.relative(WEB_SRC, filePath);
}

function isExempt(filePath: string): boolean {
  return EXEMPT_FILES.some((p) => filePath.includes(p));
}

function isExemptLine(line: string): boolean {
  return EXEMPT_LINE_PATTERNS.some((p) => p.test(line));
}

function isTechnical(text: string): boolean {
  const trimmed = text.trim();
  if (PROPER_NOUNS.has(trimmed)) return true;
  return TECHNICAL_PATTERNS.some((p) => p.test(trimmed));
}

function hasUseTranslations(content: string): boolean {
  return content.includes('useTranslations');
}

// ── Detection Rules ────────────────────────────────────────

/**
 * Rule 1: JSX text content — multi-word English text between tags
 * Matches: >Some English Text<
 * Ignores: >{variable}<, >{t('key')}<
 */
function checkJsxText(line: string, lineNum: number): Issue | null {
  // Match text content in JSX (between > and <, not starting with {)
  const matches = line.matchAll(/>\s*([A-Z][a-zA-Z]*(?:\s+[a-zA-Z,.'·:!?()]+)+)\s*</g);
  for (const match of matches) {
    const text = match[1].trim();
    if (isTechnical(text)) continue;
    if (text.length < 3) continue;
    // Skip if it looks like it's already using t()
    if (line.includes('{t(') || line.includes('{t.')) continue;

    return {
      file: '',
      line: lineNum,
      rule: 'jsx-text',
      content: text.substring(0, 80),
      confidence: 'high',
    };
  }
  return null;
}

/**
 * Rule 2: Translatable JSX props with hardcoded strings
 * Matches: placeholder="Search by name..."
 * Ignores: placeholder={t('key')}
 */
function checkTranslatableProp(line: string, lineNum: number): Issue | null {
  for (const attr of TRANSLATABLE_ATTRS) {
    // Match attr="literal string" (not attr={expression})
    const regex = new RegExp(`${attr}=["']([A-Z][^"']{2,})["']`);
    const match = line.match(regex);
    if (match) {
      const text = match[1];
      if (isTechnical(text)) continue;
      return {
        file: '',
        line: lineNum,
        rule: 'translatable-prop',
        content: `${attr}="${text.substring(0, 60)}"`,
        confidence: 'high',
      };
    }
  }
  return null;
}

/**
 * Rule 3: Toast/notification messages with literal strings
 * Matches: toast.success('School updated')
 * Ignores: toast.success(t('key'))
 */
function checkToastMessage(line: string, lineNum: number): Issue | null {
  const match = line.match(/toast\.(success|error|info|warning)\(\s*["'`]([^"'`]+)["'`]/);
  if (match) {
    const text = match[2];
    if (text.length < 3 || isTechnical(text)) return null;
    return {
      file: '',
      line: lineNum,
      rule: 'toast-message',
      content: `toast.${match[1]}("${text.substring(0, 60)}")`,
      confidence: 'high',
    };
  }
  return null;
}

/**
 * Rule 4: Single-word JSX labels (capitalized, ≥3 chars)
 * Matches: <Badge>Unevaluated</Badge>, <TableHead>Name</TableHead>
 * Lower confidence — may be legitimate component names or enum values
 */
function checkJsxLabel(line: string, lineNum: number): Issue | null {
  // Skip TS generic type annotations like Promise<void>, Array<T>, Map<K,V>
  if (/\b(Promise|Array|Map|Set|Record|Partial|Readonly|Pick|Omit)\s*</.test(line)) return null;
  // Skip lines that look like TS type declarations
  if (/:\s*[A-Z]\w*\s*</.test(line)) return null;
  const match = line.match(/>\s*([A-Z][a-z]{2,})\s*</);
  if (match) {
    const text = match[1];
    if (isTechnical(text)) return null;
    if (PROPER_NOUNS.has(text)) return null;
    // Skip if already wrapped in t()
    if (line.includes('{t(') || line.includes('{t.')) return null;
    // Skip non-translatable attr values on the same line
    for (const attr of NON_TRANSLATABLE_ATTRS) {
      if (line.includes(`${attr}=`)) return null;
    }

    return {
      file: '',
      line: lineNum,
      rule: 'jsx-label',
      content: text,
      confidence: 'medium',
    };
  }
  return null;
}

// ── File Checker ────────────────────────────────────────────

function checkFile(filePath: string): Issue[] {
  const issues: Issue[] = [];
  if (isExempt(filePath)) return issues;

  const content = fs.readFileSync(filePath, 'utf-8');
  // File-level opt-out: allows intentionally-English files (e.g. root error boundary).
  if (content.includes('@i18n-skip-file')) return issues;
  const lines = content.split('\n');
  const relPath = relativePath(filePath);
  const usesTranslations = hasUseTranslations(content);

  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Track block comments
    if (line.includes('/*')) inBlockComment = true;
    if (line.includes('*/')) {
      inBlockComment = false;
      continue;
    }
    if (inBlockComment) continue;

    // Skip exempt lines
    if (isExemptLine(line)) continue;

    // Inline opt-out: @i18n-skip on same line, or on any of the 3 preceding lines
    // (covers JSX comments placed above multi-line elements like <Input ...>).
    if (line.includes('@i18n-skip')) continue;
    if (
      (i > 0 && lines[i - 1].includes('@i18n-skip')) ||
      (i > 1 && lines[i - 2].includes('@i18n-skip')) ||
      (i > 2 && lines[i - 3].includes('@i18n-skip'))
    )
      continue;

    // Skip lines that are clearly using i18n already
    if (
      line.includes('{t(') ||
      line.includes('{t.') ||
      line.includes("t('") ||
      line.includes('t("')
    )
      continue;

    // Run detection rules
    const checks = [
      checkJsxText(line, lineNum),
      checkTranslatableProp(line, lineNum),
      checkToastMessage(line, lineNum),
      checkJsxLabel(line, lineNum),
    ];

    for (const issue of checks) {
      if (issue) {
        issue.file = relPath;
        // Boost confidence if file doesn't use translations at all
        if (!usesTranslations && issue.confidence === 'medium') {
          issue.confidence = 'high';
        }
        issues.push(issue);
        break; // One issue per line max
      }
    }
  }

  return issues;
}

// ── Main ───────────────────────────────────────────────────

function main() {
  let files = stagedOnly ? getStagedFiles() : getAllFiles(WEB_SRC);

  // Apply path filter
  if (pathFilter) {
    files = files.filter((f) => f.includes(pathFilter));
  }

  if (files.length === 0) {
    console.log('No .tsx files to check.');
    process.exit(0);
  }

  console.log(`\n🔍 Scanning ${files.length} .tsx files for hardcoded English...\n`);

  const allIssues: Issue[] = [];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    allIssues.push(...checkFile(file));
  }

  if (allIssues.length === 0) {
    console.log('✅ No hardcoded English strings detected!\n');
    process.exit(0);
  }

  // Group by file
  const byFile = new Map<string, Issue[]>();
  for (const issue of allIssues) {
    const list = byFile.get(issue.file) || [];
    list.push(issue);
    byFile.set(issue.file, list);
  }

  // Sort: files without useTranslations first
  const sortedFiles = [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b));

  const highCount = allIssues.filter((i) => i.confidence === 'high').length;
  const medCount = allIssues.filter((i) => i.confidence === 'medium').length;

  console.log(
    `⚠️  Found ${allIssues.length} potential hardcoded English strings in ${byFile.size} files:`
  );
  console.log(`   (${highCount} high confidence, ${medCount} medium confidence)\n`);

  for (const [file, issues] of sortedFiles) {
    console.log(`  📄 ${file} (${issues.length} issues)`);
    for (const issue of issues) {
      const conf = issue.confidence === 'high' ? 'HIGH' : 'MED ';
      console.log(
        `     L${String(issue.line).padStart(4)}  [${issue.rule.padEnd(17)}]  ${conf}  ${issue.content}`
      );
    }
    console.log('');
  }

  // Summary by rule
  const byRule = new Map<string, number>();
  for (const issue of allIssues) {
    byRule.set(issue.rule, (byRule.get(issue.rule) || 0) + 1);
  }
  console.log('📊 By rule:');
  for (const [rule, count] of byRule) {
    console.log(`   ${rule}: ${count}`);
  }

  console.log(`\n💡 Total: ${allIssues.length} issues in ${byFile.size} files.`);
  console.log('   Use the i18n audit skill (scripts/i18n-audit-skill.md) for AI-guided fixes.\n');

  // Exit non-zero in staged mode so pre-commit can gate new regressions.
  // Full-repo scans stay advisory to avoid blocking on pre-existing tech debt.
  if (stagedOnly && allIssues.some((i) => i.confidence === 'high')) {
    process.exit(1);
  }
}

main();
