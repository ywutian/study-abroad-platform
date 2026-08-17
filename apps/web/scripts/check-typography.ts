/**
 * Typography 规范检测脚本
 *
 * 检测项:
 *   1. 禁止任意字号值（如 Npx / Nrem / Nem），排除颜色变量引用
 *   2. CardTitle 字号覆盖警告: CardTitle 上显式使用 text-* 覆盖默认值
 *   3. h1 标签裸用 Tailwind 字号: 不使用 Typography token 而使用散落的 text-2xl 等
 *
 * 用法: npx tsx scripts/check-typography.ts
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SRC_DIR = path.resolve(__dirname, '../src');
const stagedOnly = process.argv.includes('--staged');

/** 扫描目录 */
const SCAN_DIRS = [path.join(SRC_DIR, 'app'), path.join(SRC_DIR, 'components')];

/** 豁免文件 */
const EXEMPT_FILES = [
  'typography.tsx', // Typography 组件自身
  'page-header.tsx', // PageHeader 组件
  'globals.css', // 样式定义
  'tailwind.config', // 配置文件
];

/** Typography token 类名（允许使用） */
const TYPOGRAPHY_TOKENS = [
  'text-display',
  'text-title-lg',
  'text-title',
  'text-subtitle',
  'text-body-lg',
  'text-body',
  'text-body-sm',
  'text-label',
  'text-caption',
  'text-overline',
  'text-2xs',
  'text-metric',
  'text-metric-lg',
];

/** 散落的 Tailwind 文本尺寸类 */
const RAW_TAILWIND_TEXT_SIZES = [
  'text-xs',
  'text-sm',
  'text-base',
  'text-lg',
  'text-xl',
  'text-2xl',
  'text-3xl',
  'text-4xl',
  'text-5xl',
  'text-6xl',
  'text-7xl',
  'text-8xl',
  'text-9xl',
];

// ─── 检测结果收集 ─────────────────────────────────────────────

interface Issue {
  file: string;
  line: number;
  type: 'error' | 'warning';
  rule: string;
  message: string;
  code: string;
}

const issues: Issue[] = [];

// ─── 工具函数 ────────────────────────────────────────────────

function getAllTsxFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      files.push(...getAllTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    });
    return output
      .split('\n')
      .filter(
        (file) =>
          file.startsWith('apps/web/src/') && (file.endsWith('.tsx') || file.endsWith('.ts'))
      )
      .map((file) => path.resolve(__dirname, '../../..', file));
  } catch {
    return [];
  }
}

function isExemptFile(filePath: string): boolean {
  return EXEMPT_FILES.some((exempt) => filePath.includes(exempt));
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

// ─── 规则 1: 禁止任意字号 ───────────────────────────────────

/** 匹配任意字号值（如 10px, 1.5rem）但排除颜色变量引用 */
const ARBITRARY_SIZE_REGEX = /text-\[(\d+(\.\d+)?(px|rem|em))\]/g;

function checkArbitraryFontSizes(filePath: string, lines: string[]): void {
  lines.forEach((line, idx) => {
    if (isCommentLine(line)) return;

    let match: RegExpExecArray | null;
    ARBITRARY_SIZE_REGEX.lastIndex = 0;
    while ((match = ARBITRARY_SIZE_REGEX.exec(line)) !== null) {
      issues.push({
        file: filePath,
        line: idx + 1,
        type: 'error',
        rule: 'no-arbitrary-font-size',
        message: `禁止使用任意字号 \`${match[0]}\`，请使用 Typography token (如 text-2xs, text-caption, text-body 等)`,
        code: line.trim(),
      });
    }
  });
}

// ─── 规则 2: CardTitle 字号覆盖警告 ────────────────────────

const CARD_TITLE_SIZE_REGEX = /CardTitle\s+className=.*?(text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl))/;

function checkCardTitleOverrides(filePath: string, lines: string[]): void {
  lines.forEach((line, idx) => {
    if (isCommentLine(line)) return;
    if (!line.includes('CardTitle')) return;

    const match = line.match(CARD_TITLE_SIZE_REGEX);
    if (match) {
      const sizeClass = match[1];
      // text-lg 是默认值，但作为冗余也发出 warning
      const severity = sizeClass === 'text-lg' ? 'warning' : 'warning';
      const msg =
        sizeClass === 'text-lg'
          ? `CardTitle 已默认 text-lg，此处 \`${sizeClass}\` 冗余，建议移除`
          : `CardTitle 字号覆盖: \`${sizeClass}\`，默认值为 text-lg，如需不同尺寸请确认是否必要`;

      issues.push({
        file: filePath,
        line: idx + 1,
        type: severity,
        rule: 'card-title-size-override',
        message: msg,
        code: line.trim(),
      });
    }
  });
}

// ─── 规则 3: h1 裸用 Tailwind 字号 ──────────────────────────

const H1_RAW_SIZE_REGEX = /<h1\s+className=.*?(text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl))/;

function checkH1RawTailwindSizes(filePath: string, lines: string[]): void {
  lines.forEach((line, idx) => {
    if (isCommentLine(line)) return;
    if (!line.includes('<h1')) return;

    // 如果已使用 Typography token，则跳过
    const usesToken = TYPOGRAPHY_TOKENS.some((token) => line.includes(token));
    if (usesToken) return;

    const match = line.match(H1_RAW_SIZE_REGEX);
    if (match) {
      issues.push({
        file: filePath,
        line: idx + 1,
        type: 'warning',
        rule: 'h1-raw-tailwind-size',
        message: `h1 使用散落的 Tailwind 字号 \`${match[1]}\`，建议使用 Typography token (text-title / text-title-lg / text-display)`,
        code: line.trim(),
      });
    }
  });
}

// ─── 主流程 ──────────────────────────────────────────────────

function main(): void {
  console.log('🔤 Typography 规范检测...\n');

  const files: string[] = stagedOnly
    ? getStagedFiles()
    : SCAN_DIRS.flatMap((dir) => getAllTsxFiles(dir));

  let scanned = 0;
  for (const filePath of files) {
    if (isExemptFile(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    scanned++;

    checkArbitraryFontSizes(filePath, lines);
    checkCardTitleOverrides(filePath, lines);
    checkH1RawTailwindSizes(filePath, lines);
  }

  // ─── 输出报告 ──────────────────────────────────────────

  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');

  if (issues.length === 0) {
    console.log(`✅ 已扫描 ${scanned} 个文件，未发现排版规范问题\n`);
    process.exit(0);
  }

  console.log(`扫描 ${scanned} 个文件，发现 ${errors.length} 个错误，${warnings.length} 个警告:\n`);

  // 按文件分组输出
  const byFile = new Map<string, Issue[]>();
  for (const issue of issues) {
    const rel = path.relative(path.resolve(__dirname, '..'), issue.file);
    if (!byFile.has(rel)) byFile.set(rel, []);
    byFile.get(rel)!.push(issue);
  }

  for (const [file, fileIssues] of byFile) {
    console.log(`  ${file}:`);
    for (const issue of fileIssues) {
      const icon = issue.type === 'error' ? '❌' : '⚠️';
      console.log(`    ${icon} L${issue.line} [${issue.rule}] ${issue.message}`);
    }
    console.log('');
  }

  // 汇总
  console.log('─'.repeat(60));
  console.log(`总计: ${errors.length} 个错误, ${warnings.length} 个警告`);

  if (errors.length > 0 && (stagedOnly || process.argv.includes('--strict'))) {
    console.log('\n❌ Typography 检测失败（staged files 存在 error 级问题）');
    process.exit(1);
  }

  console.log('\n⚠️ Typography 检测已输出当前债务；staged files 将作为阻塞门槛。');
  process.exit(0);
}

main();
