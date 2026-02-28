/**
 * 翻译语言错误检测脚本
 *
 * 检查 zh.json 中是否包含纯英文翻译值（应为中文），
 * 以及 en.json 中是否包含中文翻译值（应为英文）。
 *
 * 这是第四道 i18n 防线，捕获 "key 存在但翻译语言不对" 的问题。
 *
 * 用法: npx tsx scripts/check-wrong-language.ts
 */

import fs from 'fs';
import path from 'path';

const MESSAGES_DIR = path.resolve(__dirname, '../src/messages');

/** 中文字符检测 */
const CHINESE_CHAR_RE = /[\u4e00-\u9fff]/;

/** 纯英文检测（仅含 ASCII 字母、数字、标点和空格） */
const PURE_ENGLISH_RE = /^[a-zA-Z0-9\s\-_.,!?;:'"()[\]{}<>/@#$%^&*+=|\\~`]+$/;

/**
 * 豁免 key 模式 — 这些 key 的值允许跨语言
 * 例如品牌名、缩写、技术术语等
 */
const EXEMPT_KEY_PATTERNS = [
  /\.brand$/, // 品牌名
  /\.appName$/, // 应用名称
  /\.siteName$/, // 站点名称
  /\.copyright$/, // 版权信息（可能含英文）
  /\.url$/, // URL
  /[Ee]mail$/, // 邮箱 (email, contactEmail, etc.)
  /\.code$/, // 代码片段
  /\.format$/, // 日期/数字格式
  /\.unit$/, // 单位
  /\.placeholder$/, // 占位符可能含混合语言
  /\.keywords\./, // 搜索关键字允许混合语言
];

/**
 * 豁免值模式 — 这些值被视为合法跨语言内容
 */
const EXEMPT_VALUE_PATTERNS = [
  /^[A-Z]{2,}$/, // 纯缩写: GPA, SAT, TOEFL
  /^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/, // 专有名词: "Common App"
  /^\d/, // 以数字开头
  /^https?:\/\//, // URL
  /^[^a-zA-Z]*$/, // 不含字母（纯符号/数字）
  /^\{[^}]+\}$/, // ICU 变量占位: {count}
  /\{[^}]+\}.*\{[^}]+\}/, // 包含多个 ICU 变量的格式字符串
  /^\[TODO\]/, // 待翻译占位符
  /^N\/A$/, // N/A
];

/** 常见英文专有名词（在中文翻译中可接受） */
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
  'GCSE',
  'US News',
  'QS',
  'THE',
  'ARWU',
  'MIT',
  'CMU',
  'UCLA',
  'USC',
  'NYU',
  'UCB',
  'UIUC',
  'Stanford',
  'Harvard',
  'Yale',
  'Princeton',
  'Columbia',
  'CommonApp',
  'Common App',
  'Coalition',
  'AI',
  'PDF',
  'URL',
  'MBTI',
  'Holland',
  'RIASEC',
  'CSS',
  'HTML',
  'Markdown',
  'Google',
  'GitHub',
  'Microsoft',
  'Apple',
  'SSR',
  'SSG',
  'ISR',
  'API',
  'REST',
  'GraphQL',
  'JSON',
  'TypeScript',
  'JavaScript',
  'React',
  'Next.js',
  'Top',
  'Need-Blind',
  'Need-Aware',
  'PIQ',
  'UC',
  'EE',
  'CS',
  'SCS',
  'ECE',
  'ME',
  'MS',
  'PhD',
]);

/**
 * 豁免 key — 这些具体 key 的值允许为英文
 * 通常是学校名、人名、学位等
 */
const EXEMPT_KEYS = new Set([
  // 推荐人/校友学校名，通常保留英文
  'auth.layout.testimonials.items.0.school',
  'auth.layout.testimonials.items.1.school',
  'auth.layout.testimonials.items.2.school',
  'auth.layout.testimonials.items.3.school',
  'auth.layout.testimonials.items.4.school',
]);

interface WrongLangIssue {
  locale: string;
  key: string;
  value: string;
  issue: string;
}

/**
 * 递归提取 JSON 所有叶节点的 key-value
 */
function extractLeaves(obj: Record<string, unknown>, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of extractLeaves(value as Record<string, unknown>, fullKey)) {
        result.set(k, v);
      }
    } else if (typeof value === 'string') {
      result.set(fullKey, value);
    }
  }

  return result;
}

/**
 * 从值中移除已知专有名词，返回清理后的文本
 */
function removeProperNouns(text: string): string {
  let cleaned = text;
  for (const noun of PROPER_NOUNS) {
    cleaned = cleaned.replaceAll(noun, '');
  }
  return cleaned.trim();
}

/**
 * 检查 zh.json 中不应出现的纯英文值
 */
function checkZhForEnglish(zhLeaves: Map<string, string>): WrongLangIssue[] {
  const issues: WrongLangIssue[] = [];

  for (const [key, value] of zhLeaves) {
    // 跳过短值（<= 2 字符）
    if (value.length <= 2) continue;

    // 跳过豁免 key（模式匹配）
    if (EXEMPT_KEY_PATTERNS.some((p) => p.test(key))) continue;

    // 跳过豁免 key（精确匹配）
    if (EXEMPT_KEYS.has(key)) continue;

    // 跳过豁免值
    if (EXEMPT_VALUE_PATTERNS.some((p) => p.test(value))) continue;

    // 移除专有名词后检查
    const cleaned = removeProperNouns(value);

    // 如果清理后为空或很短，说明值主要由专有名词组成
    if (cleaned.length <= 2) continue;

    // 核心检查：中文翻译文件中不应有纯英文值（包含 3+ 个英文字母且无中文字符）
    if (
      PURE_ENGLISH_RE.test(cleaned) &&
      !CHINESE_CHAR_RE.test(value) &&
      /[a-zA-Z]{3,}/.test(cleaned)
    ) {
      issues.push({
        locale: 'zh.json',
        key,
        value: value.substring(0, 80),
        issue: 'Chinese translation file contains pure English value',
      });
    }
  }

  return issues;
}

/**
 * 检查 en.json 中不应出现的中文值
 */
function checkEnForChinese(enLeaves: Map<string, string>): WrongLangIssue[] {
  const issues: WrongLangIssue[] = [];

  for (const [key, value] of enLeaves) {
    // 跳过豁免 key（模式匹配）
    if (EXEMPT_KEY_PATTERNS.some((p) => p.test(key))) continue;

    // 跳过豁免 key（精确匹配）
    if (EXEMPT_KEYS.has(key)) continue;

    // 核心检查：英文翻译文件中不应有中文字符
    if (CHINESE_CHAR_RE.test(value)) {
      issues.push({
        locale: 'en.json',
        key,
        value: value.substring(0, 80),
        issue: 'English translation file contains Chinese characters',
      });
    }
  }

  return issues;
}

function main() {
  console.log('🔤 Checking for wrong-language translations...\n');

  const zhPath = path.join(MESSAGES_DIR, 'zh.json');
  const enPath = path.join(MESSAGES_DIR, 'en.json');

  if (!fs.existsSync(zhPath) || !fs.existsSync(enPath)) {
    console.error('❌ Translation files not found!');
    process.exit(1);
  }

  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));
  const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

  const zhLeaves = extractLeaves(zh);
  const enLeaves = extractLeaves(en);

  console.log(`📊 zh.json: ${zhLeaves.size} leaf values`);
  console.log(`📊 en.json: ${enLeaves.size} leaf values\n`);

  const issues: WrongLangIssue[] = [...checkZhForEnglish(zhLeaves), ...checkEnForChinese(enLeaves)];

  if (issues.length === 0) {
    console.log('✅ All translations are in the correct language!\n');
    process.exit(0);
  }

  // 按 locale 分组输出
  const zhIssues = issues.filter((i) => i.locale === 'zh.json');
  const enIssues = issues.filter((i) => i.locale === 'en.json');

  if (zhIssues.length > 0) {
    console.log(
      `⚠️  zh.json: ${zhIssues.length} values appear to be English (should be Chinese):\n`
    );
    for (const issue of zhIssues) {
      console.log(`  ${issue.key}: "${issue.value}"`);
    }
    console.log('');
  }

  if (enIssues.length > 0) {
    console.log(
      `⚠️  en.json: ${enIssues.length} values appear to be Chinese (should be English):\n`
    );
    for (const issue of enIssues) {
      console.log(`  ${issue.key}: "${issue.value}"`);
    }
    console.log('');
  }

  console.log(`💡 Total: ${issues.length} wrong-language translations`);
  console.log('   Fix by replacing values with correct language translations.\n');

  // 始终以非零退出码退出
  process.exit(1);
}

main();
