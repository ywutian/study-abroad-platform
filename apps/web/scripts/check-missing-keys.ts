/**
 * 缺失翻译 Key 检测脚本
 *
 * 扫描源码中所有 t('key') 调用，结合 useTranslations 的命名空间，
 * 检查对应的完整 key 是否存在于 zh.json 中。
 *
 * 用法: npx tsx scripts/check-missing-keys.ts
 */

import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '../src');
const MESSAGES_DIR = path.join(SRC_DIR, 'messages');

const SCAN_DIRS = [
  path.join(SRC_DIR, 'app'),
  path.join(SRC_DIR, 'components'),
  path.join(SRC_DIR, 'hooks'),
  path.join(SRC_DIR, 'lib'),
];

interface MissingKey {
  file: string;
  line: number;
  fullKey: string;
  rawKey: string;
  namespace: string;
  varName: string;
}

interface DynamicKeyWarning {
  file: string;
  line: number;
  prefix: string;
  pattern: string;
  hasChildren: boolean;
}

/**
 * 递归提取 JSON 所有 key（叶节点 + 中间节点）
 */
function extractAllPaths(obj: Record<string, unknown>, prefix = ''): Set<string> {
  const keys = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.add(fullKey);
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const k of extractAllPaths(value as Record<string, unknown>, fullKey)) {
        keys.add(k);
      }
    }
  }
  return keys;
}

/**
 * 递归获取文件
 */
function getFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    if (fullPath.includes('messages/')) continue;
    if (entry.isDirectory()) {
      results.push(...getFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function main() {
  console.log('🔍 Checking for missing translation keys in source code...\n');

  const zhPath = path.join(MESSAGES_DIR, 'zh.json');
  if (!fs.existsSync(zhPath)) {
    console.error('❌ zh.json not found!');
    process.exit(1);
  }

  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));
  const allPaths = extractAllPaths(zh);

  console.log(`📊 Total paths in zh.json: ${allPaths.size}`);

  // Collect all source files
  const allFiles: string[] = [];
  for (const dir of SCAN_DIRS) {
    allFiles.push(...getFiles(dir));
  }

  console.log(`📁 Scanning ${allFiles.length} source files...\n`);

  const missing: MissingKey[] = [];
  const dynamicWarnings: DynamicKeyWarning[] = [];

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(SRC_DIR, filePath);
    const lines = content.split('\n');

    // Step 1: Find all useTranslations declarations
    interface TransVar {
      varName: string;
      namespace: string;
      lineNum: number;
    }
    const transVars: TransVar[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match: const t = useTranslations('namespace')
      const nsMatch = line.match(/const\s+(\w+)\s*=\s*useTranslations\(\s*['"]([^'"]+)['"]\s*\)/);
      if (nsMatch) {
        transVars.push({ varName: nsMatch[1], namespace: nsMatch[2], lineNum: i + 1 });
      }

      // Match: const t = useTranslations()
      const globalMatch = line.match(/const\s+(\w+)\s*=\s*useTranslations\(\s*\)/);
      if (globalMatch) {
        transVars.push({ varName: globalMatch[1], namespace: '', lineNum: i + 1 });
      }

      // Match: const t = await getTranslations({ locale, namespace: 'xxx' })
      const serverNsMatch = line.match(
        /const\s+(\w+)\s*=\s*await\s+getTranslations\(\s*\{\s*locale\s*,\s*namespace:\s*['"]([^'"]+)['"]/
      );
      if (serverNsMatch) {
        transVars.push({ varName: serverNsMatch[1], namespace: serverNsMatch[2], lineNum: i + 1 });
      }
    }

    if (transVars.length === 0) continue;

    // Step 2: For each translation variable, find its t('key') calls
    for (const { varName, namespace } of transVars) {
      // Escape varName for regex
      const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match varName('key') or varName("key") — static keys
        const re = new RegExp(`\\b${escaped}\\(\\s*['"]([^'"]+)['"]`, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(line)) !== null) {
          const rawKey = m[1];

          // Skip dynamic keys (template literal fragments, backtick usage, string concat)
          if (rawKey.includes('${')) continue;
          if (rawKey.endsWith('.')) continue; // partial key from string concatenation like t('prefix.' + var)

          const fullKey = namespace ? `${namespace}.${rawKey}` : rawKey;

          // Check if key exists
          if (!allPaths.has(fullKey)) {
            missing.push({
              file: relPath,
              line: i + 1,
              fullKey,
              rawKey,
              namespace,
              varName,
            });
          }
        }

        // Match dynamic keys: varName(`prefix.${var}`) — template literal patterns
        const dynRe = new RegExp(`\\b${escaped}\\(\\s*\`([^\`]*?)\\$\\{`, 'g');
        let dm: RegExpExecArray | null;
        while ((dm = dynRe.exec(line)) !== null) {
          const prefix = dm[1]; // e.g. "prediction.engine."
          if (!prefix || prefix.length < 2) continue;

          // Remove trailing dot if present
          const cleanPrefix = prefix.endsWith('.') ? prefix.slice(0, -1) : prefix;
          const fullPrefix = namespace ? `${namespace}.${cleanPrefix}` : cleanPrefix;

          // Check if the prefix has any children in the translation file
          // Support both dot-separated (prefix.child) and concatenated (prefixChild) patterns
          const hasChildren = [...allPaths].some(
            (p) =>
              p.startsWith(fullPrefix + '.') || // prefix.child pattern
              (p.startsWith(fullPrefix) && p.length > fullPrefix.length && p !== fullPrefix) // prefixChild pattern
          );

          if (!hasChildren) {
            dynamicWarnings.push({
              file: relPath,
              line: i + 1,
              prefix: fullPrefix,
              pattern: line.trim().substring(0, 100),
              hasChildren: false,
            });
          }
        }
      }
    }
  }

  // Report dynamic key warnings (non-blocking, but visible)
  if (dynamicWarnings.length > 0) {
    const uniqueWarnings = dynamicWarnings.filter(
      (w, i, arr) => arr.findIndex((x) => x.prefix === w.prefix && x.file === w.file) === i
    );
    console.log(
      `⚠️  Dynamic key warnings (${uniqueWarnings.length} prefixes with no children in zh.json):\n`
    );
    for (const w of uniqueWarnings) {
      console.log(`  📄 ${w.file}:${w.line}`);
      console.log(`     Prefix "${w.prefix}" has no matching keys in zh.json`);
      console.log(`     Pattern: ${w.pattern}\n`);
    }
  }

  if (missing.length === 0 && dynamicWarnings.length === 0) {
    console.log('✅ All translation keys used in source code exist in zh.json!\n');
    process.exit(0);
  }

  if (missing.length === 0) {
    console.log('✅ All static translation keys exist in zh.json!');
    console.log(`⚠️  ${dynamicWarnings.length} dynamic key warning(s) found (non-blocking).\n`);
    process.exit(0);
  }

  // Group by file and output
  const grouped: Record<string, MissingKey[]> = {};
  for (const m of missing) {
    if (!grouped[m.file]) grouped[m.file] = [];
    grouped[m.file].push(m);
  }

  console.log(
    `⚠️  Found ${missing.length} missing translation keys in ${Object.keys(grouped).length} files:\n`
  );

  for (const [file, items] of Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  📄 ${file} (${items.length} missing)`);
    for (const item of items) {
      const nsInfo = item.namespace ? ` (ns: "${item.namespace}", raw: "${item.rawKey}")` : '';
      console.log(`     L${item.line}: ${item.fullKey}${nsInfo}`);
    }
    console.log('');
  }

  console.log(`💡 Total: ${missing.length} missing keys`);

  // --fix 模式：自动生成占位翻译并写入 zh.json 和 en.json
  const fixMode = process.argv.includes('--fix');
  if (fixMode) {
    console.log('\n🔧 Running in --fix mode, generating placeholder translations...\n');

    const enPath = path.join(MESSAGES_DIR, 'en.json');
    const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

    function setNestedValue(obj: Record<string, unknown>, keyPath: string, value: string): boolean {
      const parts = keyPath.split('.');
      let current: Record<string, unknown> = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
          current[parts[i]] = {};
        }
        current = current[parts[i]] as Record<string, unknown>;
      }
      if (current[parts[parts.length - 1]] === undefined) {
        current[parts[parts.length - 1]] = value;
        return true;
      }
      return false;
    }

    // 去重
    const uniqueKeys = [...new Set(missing.map((m) => m.fullKey))];
    let addedZh = 0,
      addedEn = 0;

    for (const key of uniqueKeys) {
      // 从 key 名称自动生成占位文本
      const lastPart = key.split('.').pop() || key;
      const placeholder = `[TODO] ${lastPart}`;
      if (setNestedValue(zh, key, placeholder)) addedZh++;
      if (setNestedValue(en, key, placeholder)) addedEn++;
    }

    fs.writeFileSync(zhPath, JSON.stringify(zh, null, 2) + '\n');
    fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n');
    console.log(`✅ Added ${addedZh} placeholder keys to zh.json`);
    console.log(`✅ Added ${addedEn} placeholder keys to en.json`);
    console.log(
      '⚠️  Search for "[TODO]" in translation files and replace with proper translations.\n'
    );
    process.exit(0);
  }

  console.log('   Add these keys to zh.json and en.json to fix runtime errors.');
  console.log('   Or run with --fix to auto-generate placeholder translations:\n');
  console.log('     npx tsx scripts/check-missing-keys.ts --fix\n');

  // 始终以非零退出码退出（本地和 CI 一致）
  process.exit(1);
}

main();
