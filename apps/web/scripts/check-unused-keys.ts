/**
 * 未使用翻译 Key 检测脚本
 *
 * 提取 zh.json 中的所有 key，扫描 .tsx/.ts 源文件
 * 检查是否存在未被引用的翻译 key。
 *
 * 用法: npx tsx scripts/check-unused-keys.ts
 */

import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '../src');
const MESSAGES_DIR = path.join(SRC_DIR, 'messages');

/** 需要扫描的源码目录 */
const SCAN_DIRS = [
  path.join(SRC_DIR, 'app'),
  path.join(SRC_DIR, 'components'),
  path.join(SRC_DIR, 'hooks'),
  path.join(SRC_DIR, 'lib'),
];

/** 排除的目录/文件 */
const EXCLUDE_PATTERNS = ['node_modules', '.next', 'messages/zh.json', 'messages/en.json'];

/**
 * 已确认通过动态模式引用的 key（静态扫描无法检测到）
 * 格式: 完整 key 或前缀通配 (以 * 结尾)
 *
 * 每个条目均附注其动态引用方式和源文件位置
 */
const DYNAMIC_KEY_PATTERNS: string[] = [
  // t(`scores.${key}`) — essay-review-panel.tsx:109
  'essayAi.scores.*',
  // t(`essayTypes.${key}`) — essay-gallery/page.tsx:157
  'essayGallery.essayTypes.*',
  // t(`awardLevel${level}`) — SwipeCard.tsx:353
  'hall.swipeCard.awardLevel*',
  // t(`grade${grade}`) — SwipeCard.tsx:320
  'hall.swipeCard.grade*',
  // t(`schoolType${type}`) — SwipeCard.tsx
  'hall.swipeCard.schoolType*',
  // t(`category${cat}`) — SwipeCard.tsx
  'hall.swipeCard.category*',
  // t(`home.stories.${storyKey}.quote`) — page.tsx:432
  'home.stories.*.quote',
  // t(`...items.${key}.quote`) — (auth)/layout.tsx:115
  'auth.layout.testimonials.items.*.quote',
  // t(type.toLowerCase()) — vault/page.tsx:512
  'vault.credential',
  'vault.document',
  'vault.note',
  'vault.certificate',
  // t(`tag${tag}`) — forum components
  'forum.tag*',
  // t.raw(`plans.${planKey}.features`) — subscription/page.tsx
  'subscription.plans.*.features',
  'subscription.plans.*.period',
];

/**
 * 递归提取 JSON 对象的所有叶节点 key 路径
 */
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * 递归获取目录下所有 .tsx 和 .ts 文件
 */
function getFiles(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (EXCLUDE_PATTERNS.some((p) => fullPath.includes(p))) continue;

    if (entry.isDirectory()) {
      results.push(...getFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * 从完整 key 生成可能在代码中出现的引用模式
 *
 * 例如 key "assessment.aiActions.interpretMbti"
 * 可能通过以下方式引用：
 *   - t('assessment.aiActions.interpretMbti')  — 全局 useTranslations()
 *   - t('aiActions.interpretMbti')             — useTranslations('assessment')
 *   - t('interpretMbti')                       — useTranslations('assessment.aiActions')
 */
function getKeyVariants(fullKey: string): string[] {
  const parts = fullKey.split('.');
  const variants: string[] = [];

  // 生成所有可能的后缀（从完整 key 到最短的叶节点）
  for (let i = 0; i < parts.length; i++) {
    variants.push(parts.slice(i).join('.'));
  }

  return variants;
}

/**
 * 检查 key 是否匹配动态引用白名单
 */
function isDynamicKey(key: string): boolean {
  return DYNAMIC_KEY_PATTERNS.some((pattern) => {
    if (pattern === key) return true;
    if (pattern.endsWith('*')) {
      // 前缀通配：'hall.swipeCard.awardLevel*' 匹配 'hall.swipeCard.awardLevelINTERNATIONAL'
      const prefix = pattern.slice(0, -1);
      return key.startsWith(prefix);
    }
    if (pattern.includes('.*')) {
      // 中间通配：'home.stories.*.quote' 匹配 'home.stories.story1.quote'
      const regex = new RegExp('^' + pattern.replace(/\.\*/g, '\\.[^.]+') + '$');
      return regex.test(key);
    }
    return false;
  });
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 Checking for unused translation keys...\n');

  const zhPath = path.join(MESSAGES_DIR, 'zh.json');

  if (!fs.existsSync(zhPath)) {
    console.error('❌ zh.json not found!');
    process.exit(1);
  }

  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));
  const allKeys = extractKeys(zh);

  console.log(`📊 Total keys in zh.json: ${allKeys.length}`);

  // 收集所有源码文件内容
  const allFiles: string[] = [];
  for (const dir of SCAN_DIRS) {
    allFiles.push(...getFiles(dir));
  }

  console.log(`📁 Scanning ${allFiles.length} source files...\n`);

  // 将所有源码拼接为一个大字符串以加速搜索
  const allContent = allFiles.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');

  // 检查每个 key 是否在源码中被引用
  const unusedKeys: string[] = [];

  for (const key of allKeys) {
    // 跳过已知的动态引用 key
    if (isDynamicKey(key)) continue;

    const variants = getKeyVariants(key);
    const isUsed = variants.some((variant) => {
      // 检查常见引用模式：
      // t('key'), t("key"), t(`key`), 'key', "key"
      return (
        allContent.includes(`'${variant}'`) ||
        allContent.includes(`"${variant}"`) ||
        allContent.includes(`\`${variant}\``)
      );
    });

    if (!isUsed) {
      unusedKeys.push(key);
    }
  }

  if (unusedKeys.length === 0) {
    console.log('✅ All translation keys are referenced in source code!\n');
    process.exit(0);
  }

  // 按 namespace 分组输出
  const grouped: Record<string, string[]> = {};
  for (const key of unusedKeys) {
    const ns = key.split('.')[0];
    if (!grouped[ns]) grouped[ns] = [];
    grouped[ns].push(key);
  }

  console.log(`⚠️  Found ${unusedKeys.length} potentially unused keys:\n`);

  for (const [ns, keys] of Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  📦 ${ns} (${keys.length} keys)`);
    for (const key of keys.slice(0, 10)) {
      console.log(`     - ${key}`);
    }
    if (keys.length > 10) {
      console.log(`     ... and ${keys.length - 10} more`);
    }
    console.log('');
  }

  console.log(`💡 Total: ${unusedKeys.length} potentially unused keys`);
  console.log('   Note: Some keys may be referenced dynamically (e.g., t(`status.${value}`)).');
  console.log('   Verify manually before removing.\n');
}

main();
