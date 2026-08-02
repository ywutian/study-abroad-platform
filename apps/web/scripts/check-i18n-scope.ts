/**
 * i18n 分域护栏
 *
 * 根 layout 的 NextIntlClientProvider 不再下发 `admin` 字典（省 zh 26.5% /
 * en 24.9%），只有 `/admin/*` 的 layout 会补回来。代价是：一旦有人在域外
 * 引用 `admin.*` 的 key，**编译期和单测都不会报错**，线上直接把原始 key
 * 路径显示给用户。
 *
 * 本脚本静态封住这个口子：扫描全部源码，域外引用分域 namespace 即失败。
 *
 * 之所以能静态判定：全仓 `useTranslations()` 的 namespace 参数无一是变量，
 * 动态 key 也全部带静态前缀。key 级别不可判定，所以只在 namespace 级别管。
 *
 * 用法: npx tsx scripts/check-i18n-scope.ts
 */

import fs from 'fs';
import path from 'path';
import { ADMIN_ONLY_NAMESPACES } from '../src/lib/i18n/message-scope';

const SRC_DIR = path.resolve(__dirname, '../src');

/** 允许引用分域 namespace 的目录（相对 src/），即 admin provider 覆盖到的子树 */
const SCOPED_ROOTS = [
  'app/[locale]/(main)/admin/',
  'components/features/admin/',
  'lib/i18n/', // SSOT 自己
];

/** 一行里出现这个注释即豁免（例：导航配置需要列出后台入口标题） */
const SUPPRESS = '@i18n-scope-allowed';

interface Violation {
  file: string;
  line: number;
  namespace: string;
  text: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function isScoped(relPath: string): boolean {
  return SCOPED_ROOTS.some((root) => relPath.startsWith(root));
}

/**
 * 必须跟踪 `t` 绑定到哪个 namespace，否则全是误报：
 * `useTranslations('ui.command')` 之后的 `t('admin')` 解析成 `ui.command.admin`，
 * 跟顶层 `admin` 毫无关系。只有两种情况是真的够到顶层分域 namespace ——
 *
 *   1. 直接绑定：useTranslations('admin…') / getTranslations('admin…')
 *   2. 无参绑定后用全路径：const t = useTranslations(); t('admin.…') / t(`admin.${x}`)
 */
function findDirectBinding(line: string, ns: string): boolean {
  return new RegExp(`\\b(?:use|get)Translations\\(\\s*['"\`]${ns}(?:\\.[^'"\`]*)?['"\`]`).test(
    line
  );
}

/** 收集本文件里所有「无参绑定」的标识符：const t = useTranslations() */
function collectRootBindings(content: string): string[] {
  const ids = new Set<string>();
  const re =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    ids.add(m[1]);
  }
  return [...ids];
}

function usesScopedKeyViaRoot(line: string, ids: string[], ns: string): boolean {
  return ids.some((id) =>
    new RegExp(`\\b${id}\\(\\s*(?:['"\`]${ns}\\.|\`${ns}\\.\\$\\{)`).test(line)
  );
}

function main(): void {
  const files = walk(SRC_DIR);
  const violations: Violation[] = [];

  for (const file of files) {
    const rel = path.relative(SRC_DIR, file).split(path.sep).join('/');
    if (isScoped(rel)) continue;

    const content = fs.readFileSync(file, 'utf8');
    const rootBindings = collectRootBindings(content);

    content.split('\n').forEach((line, i) => {
      if (line.includes(SUPPRESS)) return;

      for (const ns of ADMIN_ONLY_NAMESPACES) {
        if (findDirectBinding(line, ns) || usesScopedKeyViaRoot(line, rootBindings, ns)) {
          violations.push({ file: rel, line: i + 1, namespace: ns, text: line.trim() });
        }
      }
    });
  }

  console.log(`\n🔍 i18n 分域检查 — 分域 namespace: ${ADMIN_ONLY_NAMESPACES.join(', ')}`);
  console.log(`   扫描 ${files.length} 个文件，豁免目录 ${SCOPED_ROOTS.length} 个\n`);

  if (violations.length === 0) {
    console.log('✅ 域外无分域 namespace 引用\n');
    return;
  }

  console.log(`❌ 域外引用了分域 namespace (${violations.length}):\n`);
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    [${v.namespace}] ${v.text}\n`);
  }
  console.log(
    `💡 这些位置在生产环境会显示原始 key 路径。\n` +
      `   要么改用非分域 namespace，要么把该目录加进 SCOPED_ROOTS 并\n` +
      `   确认它只在 /admin/* 下渲染；确属误报加 // ${SUPPRESS}\n`
  );
  process.exit(1);
}

main();
