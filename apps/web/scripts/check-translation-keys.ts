/**
 * 翻译 Key 完整性校验脚本
 *
 * 递归对比 zh.json 和 en.json 的所有 key，
 * 报告缺失、多余和空值翻译。
 *
 * 用法: npx tsx scripts/check-translation-keys.ts
 */

import fs from 'fs';
import path from 'path';

const MESSAGES_DIR = path.resolve(__dirname, '../src/messages');

interface Issue {
  type: 'missing' | 'extra' | 'empty';
  locale: string;
  key: string;
}

/**
 * 递归提取 JSON 对象的所有叶节点 key 路径
 */
function extractKeys(obj: Record<string, unknown>, prefix = ''): Map<string, unknown> {
  const keys = new Map<string, unknown>();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const nested = extractKeys(value as Record<string, unknown>, fullKey);
      for (const [k, v] of nested) {
        keys.set(k, v);
      }
    } else {
      keys.set(fullKey, value);
    }
  }

  return keys;
}

/**
 * 主函数
 */
function main() {
  console.log('🔑 Checking translation key consistency...\n');

  const zhPath = path.join(MESSAGES_DIR, 'zh.json');
  const enPath = path.join(MESSAGES_DIR, 'en.json');

  if (!fs.existsSync(zhPath) || !fs.existsSync(enPath)) {
    console.error('❌ Translation files not found!');
    process.exit(1);
  }

  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));
  const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

  const zhKeys = extractKeys(zh);
  const enKeys = extractKeys(en);

  const issues: Issue[] = [];

  // 检查 zh 有但 en 缺失的 key
  for (const [key] of zhKeys) {
    if (!enKeys.has(key)) {
      issues.push({ type: 'missing', locale: 'en.json', key });
    }
  }

  // 检查 en 有但 zh 缺失的 key
  for (const [key] of enKeys) {
    if (!zhKeys.has(key)) {
      issues.push({ type: 'missing', locale: 'zh.json', key });
    }
  }

  // 检查空值翻译
  for (const [key, value] of zhKeys) {
    if (typeof value === 'string' && value.trim() === '') {
      issues.push({ type: 'empty', locale: 'zh.json', key });
    }
  }
  for (const [key, value] of enKeys) {
    if (typeof value === 'string' && value.trim() === '') {
      issues.push({ type: 'empty', locale: 'en.json', key });
    }
  }

  // 输出结果
  console.log(`📊 zh.json: ${zhKeys.size} keys`);
  console.log(`📊 en.json: ${enKeys.size} keys\n`);

  if (issues.length === 0) {
    console.log('✅ All translation keys are consistent! No issues found.\n');
    process.exit(0);
  }

  const missing = issues.filter((i) => i.type === 'missing');
  const empty = issues.filter((i) => i.type === 'empty');

  if (missing.length > 0) {
    console.log(`⚠️  Missing keys (${missing.length}):\n`);
    for (const issue of missing) {
      console.log(`  [MISSING] ${issue.locale}: ${issue.key}`);
    }
    console.log('');
  }

  if (empty.length > 0) {
    console.log(`⚠️  Empty values (${empty.length}):\n`);
    for (const issue of empty) {
      console.log(`  [EMPTY]   ${issue.locale}: ${issue.key}`);
    }
    console.log('');
  }

  console.log(`\n💡 Total: ${missing.length} missing, ${empty.length} empty values`);
  console.log(`   Difference: ${Math.abs(zhKeys.size - enKeys.size)} keys\n`);

  // 缺失 key 始终以非零退出码退出（本地和 CI 一致）
  if (missing.length > 0) {
    process.exit(1);
  }
}

main();
