/**
 * Mobile i18n checks.
 *
 * Hard failures:
 * - en/zh key imbalance
 * - empty translations
 * - statically-used t('key') missing from locale JSON
 * - wrong-language locale values
 *
 * Advisory by default, strict with MOBILE_I18N_STRICT=1:
 * - hardcoded user-visible strings
 * - default English fallbacks in t('key', 'Fallback') or defaultValue
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '../src');
const LOCALES_DIR = path.join(SRC_DIR, 'lib/i18n/locales');
const STRICT = process.env.MOBILE_I18N_STRICT === '1' || process.env.CI_STRICT_I18N === '1';

const CHINESE_RE = /[\u4e00-\u9fff]/;
const PURE_ENGLISH_RE = /^[a-zA-Z0-9\s\-_.,!?;:'"()[\]{}<>/@#$%^&*+=|\\~`]+$/;

const SCAN_DIRS = [
  path.join(SRC_DIR, 'app'),
  path.join(SRC_DIR, 'components'),
  path.join(SRC_DIR, 'screens'),
  path.join(SRC_DIR, 'hooks'),
  path.join(SRC_DIR, 'lib'),
];

const EXEMPT_FILE_PARTS = [
  '/__tests__/',
  '/lib/i18n/locales/',
  '/types/',
  '/utils/theme.ts',
  '/utils/gradients.ts',
  '/utils/glass.ts',
];

const PROPER_NOUNS = new Set([
  'Lumni',
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
  'IGCSE',
  'ED',
  'EA',
  'RD',
  'REA',
  'UC',
  'Common App',
  'CommonApp',
  'Coalition',
  'US News',
  'QS',
  'THE',
  'AI',
  'API',
  'URL',
  'PDF',
  'CSV',
  'JSON',
  'MIT',
  'CMU',
  'UCLA',
  'Top 10',
  'Top 20',
  'Top 30',
  'UC PIQ',
  'Uncommon App',
  'Markdown',
]);

const LANGUAGE_NAME_KEYS = new Set(['settings.languageZh', 'settings.languageEn']);

const WRONG_LANGUAGE_EXEMPT_KEYS = new Set([
  'essayGallery.essayTypes.uc',
  'hallOfFame.lists.itemsPlaceholder',
]);

interface Issue {
  type: string;
  file?: string;
  line?: number;
  key?: string;
  locale?: string;
  value?: string;
  content?: string;
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
}

function extractLeaves(obj: Record<string, unknown>, prefix = ''): Map<string, unknown> {
  const leaves = new Map<string, unknown>();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [childKey, childValue] of extractLeaves(
        value as Record<string, unknown>,
        fullKey
      )) {
        leaves.set(childKey, childValue);
      }
    } else {
      leaves.set(fullKey, value);
    }
  }

  return leaves;
}

function getFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      results.push(...getFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      const normalized = fullPath.replaceAll(path.sep, '/');
      if (!EXEMPT_FILE_PARTS.some((part) => normalized.includes(part))) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function removeProperNouns(text: string): string {
  let cleaned = text;
  for (const noun of PROPER_NOUNS) {
    cleaned = cleaned.replaceAll(noun, '');
  }
  return cleaned.trim();
}

function isTechnicalText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (PROPER_NOUNS.has(trimmed)) return true;
  return [
    /^[A-Z_]{2,}$/,
    /^[a-z][a-zA-Z0-9]+$/,
    /^https?:\/\//,
    /^\/[a-z0-9/_-]+$/i,
    /^[\d\s.,:%$+-]+$/,
    /^#[0-9a-f]{3,8}$/i,
    /^[A-Za-z0-9_-]{1,12}$/,
  ].some((pattern) => pattern.test(trimmed));
}

function checkKeyBalance(enKeys: Map<string, unknown>, zhKeys: Map<string, unknown>): Issue[] {
  const issues: Issue[] = [];

  for (const [key, value] of enKeys) {
    if (!zhKeys.has(key)) issues.push({ type: 'missing-key', locale: 'zh.json', key });
    if (typeof value === 'string' && value.trim() === '') {
      issues.push({ type: 'empty-value', locale: 'en.json', key });
    }
  }

  for (const [key, value] of zhKeys) {
    if (!enKeys.has(key)) issues.push({ type: 'missing-key', locale: 'en.json', key });
    if (typeof value === 'string' && value.trim() === '') {
      issues.push({ type: 'empty-value', locale: 'zh.json', key });
    }
  }

  return issues;
}

function checkWrongLanguage(enKeys: Map<string, unknown>, zhKeys: Map<string, unknown>): Issue[] {
  const issues: Issue[] = [];

  for (const [key, value] of enKeys) {
    if (LANGUAGE_NAME_KEYS.has(key)) continue;
    if (typeof value === 'string' && CHINESE_RE.test(value)) {
      issues.push({
        type: 'wrong-language',
        locale: 'en.json',
        key,
        value: value.slice(0, 100),
      });
    }
  }

  for (const [key, value] of zhKeys) {
    if (LANGUAGE_NAME_KEYS.has(key) || WRONG_LANGUAGE_EXEMPT_KEYS.has(key)) continue;
    if (typeof value !== 'string' || value.length <= 2) continue;
    const cleaned = removeProperNouns(value);
    if (cleaned.length <= 2) continue;
    if (PURE_ENGLISH_RE.test(cleaned) && /[a-zA-Z]{3,}/.test(cleaned) && !CHINESE_RE.test(value)) {
      issues.push({
        type: 'wrong-language',
        locale: 'zh.json',
        key,
        value: value.slice(0, 100),
      });
    }
  }

  return issues;
}

function checkSourceFiles(
  files: string[],
  keys: Set<string>
): { blocking: Issue[]; advisory: Issue[] } {
  const blocking: Issue[] = [];
  const advisory: Issue[] = [];

  for (const filePath of files) {
    const relPath = path.relative(SRC_DIR, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('@i18n-skip-file')) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNo = i + 1;
      if (/^\s*(\/\/|\*|\/\*|import\s|export\s+type\b|type\s|interface\s)/.test(line)) continue;
      if (line.includes('@i18n-skip')) continue;

      for (const match of line.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
        const key = match[1];
        if (!keys.has(key)) {
          blocking.push({ type: 'missing-used-key', file: relPath, line: lineNo, key });
        }
      }

      const fallbackMatch = line.match(/\bt\(\s*['"][^'"]+['"]\s*,\s*['"`]([^'"`]+)['"`]/);
      if (fallbackMatch && !isTechnicalText(fallbackMatch[1])) {
        advisory.push({
          type: 'default-fallback',
          file: relPath,
          line: lineNo,
          content: fallbackMatch[1].slice(0, 100),
        });
      }

      const defaultValueMatch = line.match(/defaultValue:\s*['"`]([^'"`]+)['"`]/);
      if (defaultValueMatch && !isTechnicalText(defaultValueMatch[1])) {
        advisory.push({
          type: 'default-fallback',
          file: relPath,
          line: lineNo,
          content: defaultValueMatch[1].slice(0, 100),
        });
      }

      if (line.includes('{t(') || line.includes(' t(') || line.includes('i18n.')) continue;
      if (
        /className=|style=|queryKey|apiClient\.|console\.|testID=|accessibilityRole=/.test(line)
      ) {
        continue;
      }

      const jsxText = line.match(/>\s*([A-Z][a-zA-Z]+(?:\s+[a-zA-Z,.'?!()/-]+)+)\s*</);
      if (jsxText && !isTechnicalText(jsxText[1])) {
        advisory.push({
          type: 'hardcoded-jsx-text',
          file: relPath,
          line: lineNo,
          content: jsxText[1].slice(0, 100),
        });
      }

      const propText = line.match(
        /\b(label|placeholder|title|accessibilityLabel)=["']([^"']{3,})["']/
      );
      if (propText && !isTechnicalText(propText[2])) {
        advisory.push({
          type: 'hardcoded-prop',
          file: relPath,
          line: lineNo,
          content: `${propText[1]}="${propText[2].slice(0, 80)}"`,
        });
      }
    }
  }

  return { blocking, advisory };
}

function printIssues(title: string, issues: Issue[]) {
  if (issues.length === 0) return;
  console.log(`${title} (${issues.length}):\n`);
  for (const issue of issues.slice(0, 120)) {
    const loc = issue.file ? `${issue.file}:${issue.line}` : issue.locale;
    const detail = issue.key ?? issue.content ?? issue.value ?? '';
    console.log(`   [${issue.type}] ${loc}: ${detail}`);
  }
  if (issues.length > 120) {
    console.log(`   ... and ${issues.length - 120} more`);
  }
  console.log('');
}

function main() {
  console.log('Checking mobile i18n...\n');

  const enPath = path.join(LOCALES_DIR, 'en.json');
  const zhPath = path.join(LOCALES_DIR, 'zh.json');

  if (!fs.existsSync(enPath) || !fs.existsSync(zhPath)) {
    console.error('Locale files not found.');
    process.exit(1);
  }

  const enKeys = extractLeaves(readJson(enPath));
  const zhKeys = extractLeaves(readJson(zhPath));
  const sourceFiles = SCAN_DIRS.flatMap(getFiles);
  const allKeys = new Set([...enKeys.keys(), ...zhKeys.keys()]);
  const sourceIssues = checkSourceFiles(sourceFiles, allKeys);

  const blocking = [
    ...checkKeyBalance(enKeys, zhKeys),
    ...checkWrongLanguage(enKeys, zhKeys),
    ...sourceIssues.blocking,
  ];
  const advisory = sourceIssues.advisory;

  console.log(`en.json: ${enKeys.size} keys`);
  console.log(`zh.json: ${zhKeys.size} keys`);
  console.log(`source files scanned: ${sourceFiles.length}\n`);

  printIssues('Blocking issues', blocking);
  printIssues(STRICT ? 'Strict advisory issues' : 'Advisory issues', advisory);

  if (blocking.length > 0 || (STRICT && advisory.length > 0)) {
    console.log(
      `Mobile i18n checks failed: ${blocking.length} blocking, ${advisory.length} advisory.`
    );
    process.exit(1);
  }

  console.log(
    advisory.length > 0
      ? `Mobile i18n checks passed with ${advisory.length} advisory item(s).`
      : 'Mobile i18n checks passed.'
  );
}

main();
