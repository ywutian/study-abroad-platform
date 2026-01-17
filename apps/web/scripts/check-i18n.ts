/**
 * i18n 硬编码中文检测脚本
 *
 * 扫描 .tsx 文件中未使用翻译函数包裹的中文字符，
 * 排除注释、正则表达式、翻译文件等合法场景。
 *
 * 用法: npx tsx scripts/check-i18n.ts
 */

import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '../src');

/** 需要扫描的目录 */
const SCAN_DIRS = [path.join(SRC_DIR, 'app'), path.join(SRC_DIR, 'components')];

/** 豁免文件（不检测） */
const EXEMPT_FILES = [
  'messages/zh.json',
  'messages/en.json',
  'pdf-styles.ts',
  'i18n.d.ts',
  'error-boundary.tsx', // 错误边界组件的 fallback 文案（i18n 不可用时的兜底）
  'not-found.tsx', // 404 页面的 fallback 文案（i18n 不可用时的兜底）
];

/** 豁免行模式（匹配到则跳过该行） */
const EXEMPT_LINE_PATTERNS = [
  /^\s*\/\//, // 单行注释
  /^\s*\*/, // 多行注释中间行
  /^\s*\/\*/, // 多行注释开始
  /^\s*\{\/\*/, // JSX 注释
  /^\s*import\s/, // import 语句
  /^\s*console\./, // console 日志
  /\/[^/]*[\u4e00-\u9fff][^/]*\//, // 正则表达式中的中文
  /\.match\(/, // 正则匹配调用
  /\.test\(/, // 正则测试调用
  /\.includes\('/, // 字符串包含检测（如错误类型检测）
  /RegExp/, // 正则构造
  /typesZh/, // 数据字段引用（如 hollandResult.typesZh）
  /fieldsZh/, // 数据字段引用（如 hollandResult.fieldsZh）
  /nameZh/, // 数据字段引用（中文名字段）
  /['"]简体中文['"]/, // 语言名称（语言选择器中故意保留原始语言名称）
  /label:\s*['"]English['"]/, // 语言名称
  /device:\s*['"]/, // 设备/会话 mock 数据
  /location:\s*['"]/, // 地理位置 mock 数据
  /lastActive:\s*['"]/, // 最后活跃时间 mock 数据
];

/** 额外检测模式 — 检查对象属性中的硬编码中文（不在 JSX 中） */
const OBJECT_PROP_CHINESE_PATTERNS = [
  /label:\s*['"`].*[\u4e00-\u9fff].*['"`]/, // label: '中文...'
  /prompt:\s*['"`].*[\u4e00-\u9fff].*['"`]/, // prompt: '中文...'
  /description:\s*['"`].*[\u4e00-\u9fff].*['"`]/, // description: '中文...'
  /placeholder:\s*['"`].*[\u4e00-\u9fff].*['"`]/, // placeholder: '中文...'
  /message:\s*['"`].*[\u4e00-\u9fff].*['"`]/, // message: '中文...'
];

/** 检测 JSX 属性中的硬编码英文文本 */
const JSX_ATTR_HARDCODED_PATTERNS = [
  /title=["'][A-Z][a-z]+(\s[A-Z][a-z]+)+["']/, // title="Some Title"
  /alt=["'][A-Z][a-z]+(\s[A-Z][a-z]+)+["']/, // alt="Some Image"
  /aria-label=["'][A-Z][a-z]+(\s[A-Z][a-z]+)+["']/, // aria-label="Some Label"
];

/** 豁免的专有名词/缩写（不算硬编码） */
const EXEMPT_PROPER_NOUNS = [
  'GPA',
  'SAT',
  'ACT',
  'TOEFL',
  'IELTS',
  'GRE',
  'GMAT',
  'US News',
  'QS',
  'THE',
  'MIT',
  'CMU',
  'UCLA',
  'CommonApp',
  'Coalition',
  'PDF',
  'AI',
  'URL',
  'MBTI',
  'Holland',
  'RIASEC',
  'CSS',
  'HTML',
];

/** 中文字符检测正则 */
const CHINESE_CHAR_RE = /[\u4e00-\u9fff]/;

interface Violation {
  file: string;
  line: number;
  content: string;
}

/**
 * 递归获取目录下所有 .tsx 和 .ts 文件
 */
function getFiles(dir: string, ext: string[] = ['.tsx', '.ts']): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getFiles(fullPath, ext));
    } else if (ext.some((e) => entry.name.endsWith(e))) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * 检查字符串是否仅包含豁免的专有名词（不算硬编码）
 */
function isOnlyProperNouns(text: string): boolean {
  let cleaned = text;
  for (const noun of EXEMPT_PROPER_NOUNS) {
    cleaned = cleaned.replaceAll(noun, '');
  }
  // 如果去除专有名词后只剩标点、空格和数字，则不算硬编码
  return !/[a-zA-Z]{3,}/.test(cleaned);
}

/**
 * 检查单个文件中的硬编码中文
 */
function checkFile(filePath: string): Violation[] {
  const violations: Violation[] = [];

  // 检查是否为豁免文件
  const relativePath = path.relative(SRC_DIR, filePath);
  if (EXEMPT_FILES.some((f) => relativePath.includes(f))) {
    return violations;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // 跟踪多行注释状态
    if (line.includes('/*')) inBlockComment = true;
    if (line.includes('*/')) {
      inBlockComment = false;
      continue;
    }
    if (inBlockComment) continue;

    // 检查是否匹配豁免模式
    const isExempt = EXEMPT_LINE_PATTERNS.some((pattern) => pattern.test(line));
    if (isExempt) continue;

    // 剥离行内注释 (// ...) 后再检测中文，避免代码注释误报
    const lineWithoutInlineComment = line.replace(/\/\/[^'"]*$/, '');

    // 检查1: 硬编码中文（仅检测非注释部分）
    if (CHINESE_CHAR_RE.test(lineWithoutInlineComment)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        content: line.trim().substring(0, 120),
      });
      continue;
    }

    // 检查2: 对象属性中的硬编码中文（如 label: '深度解读...'）
    if (OBJECT_PROP_CHINESE_PATTERNS.some((pattern) => pattern.test(line))) {
      violations.push({
        file: relativePath,
        line: lineNum,
        content: `[obj-prop] ${line.trim().substring(0, 120)}`,
      });
      continue;
    }

    // 检查3: JSX 属性中的硬编码英文（如 title="Some Title"）
    const jsxAttrMatch = JSX_ATTR_HARDCODED_PATTERNS.some((pattern) => pattern.test(line));
    if (jsxAttrMatch && !isOnlyProperNouns(line)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        content: `[jsx-attr] ${line.trim().substring(0, 120)}`,
      });
    }
  }

  return violations;
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 Scanning for hardcoded Chinese text in .tsx/.ts files...\n');

  const allFiles: string[] = [];
  for (const dir of SCAN_DIRS) {
    allFiles.push(...getFiles(dir));
  }

  console.log(`📁 Found ${allFiles.length} files to scan\n`);

  const allViolations: Violation[] = [];

  for (const file of allFiles) {
    const violations = checkFile(file);
    allViolations.push(...violations);
  }

  if (allViolations.length === 0) {
    console.log('✅ No hardcoded Chinese text found! All clear.\n');
    process.exit(0);
  }

  // 按文件分组输出
  const grouped: Record<string, Violation[]> = {};
  for (const v of allViolations) {
    if (!grouped[v.file]) grouped[v.file] = [];
    grouped[v.file].push(v);
  }

  console.log(
    `⚠️  Found ${allViolations.length} potential hardcoded Chinese text in ${Object.keys(grouped).length} files:\n`
  );

  for (const [file, violations] of Object.entries(grouped)) {
    console.log(`  📄 ${file} (${violations.length} issues)`);
    for (const v of violations) {
      console.log(`     L${v.line}: ${v.content}`);
    }
    console.log('');
  }

  console.log(`\n💡 Total: ${allViolations.length} issues in ${Object.keys(grouped).length} files`);
  console.log('   Fix by wrapping Chinese text in t() calls from useTranslations()');
  console.log('   Add exemptions in scripts/check-i18n.ts if needed\n');

  // CI 模式下以非零退出码退出
  if (process.env.CI) {
    process.exit(1);
  }
}

main();
