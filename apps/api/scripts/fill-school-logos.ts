/**
 * 根据学校官网域名填充 logoUrl
 *
 * 优先使用 Logo.dev（高清品牌 logo），如果没有 LOGO_DEV_TOKEN 则回退到 Google Favicon。
 * 仅处理「有 website、无 logoUrl」的学校；可选 --overwrite 强制覆盖已有 logo。
 *
 * 用法:
 *   cd apps/api && pnpm run fill-logos [limit]
 *   pnpm run fill-logos 200 --overwrite
 *   pnpm run fill-logos 100 --dry-run       # 仅打印，不写库
 *   pnpm run fill-logos 100 --source=favicon # 强制用 Google Favicon
 *
 * 环境: 需有 DATABASE_URL；如使用 Logo.dev 需有 LOGO_DEV_TOKEN
 */

import { PrismaClient } from '@prisma/client';
import {
  backfillSchoolLogos,
  type LogoBackfillSource,
} from './lib/school-logo-backfill';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => !a.startsWith('--'));
  const limit = Math.min(Math.max(1, parseInt(limitArg || '100', 10)), 2000);
  const overwrite = args.includes('--overwrite');
  const dryRun = args.includes('--dry-run');
  const forceSource = args
    .find((a) => a.startsWith('--source='))
    ?.split('=')[1] as LogoBackfillSource | undefined;

  const logoDevToken = process.env.LOGO_DEV_TOKEN;
  const source: LogoBackfillSource =
    forceSource === 'favicon'
      ? 'favicon'
      : logoDevToken
        ? 'logo.dev'
        : 'favicon';

  const sourceLabel =
    source === 'logo.dev' ? 'Logo.dev (高清)' : 'Google Favicon';
  console.log(
    `\n📷 填充学校 Logo（来源: ${sourceLabel}）\n` +
      `   条件: ${overwrite ? '有 website 即处理' : '有 website 且无 logoUrl'}\n` +
      `${dryRun ? '\n   ⚠️  --dry-run: 仅打印，不写入数据库' : ''}\n`,
  );

  const result = await backfillSchoolLogos({
    prisma,
    limit,
    dryRun,
    overwrite,
    source,
    logoDevToken,
  });

  console.log(
    `\n📊 完成: 成功 ${result.filled} 所, 跳过 ${result.skipped} 所, 失败 ${result.failed} 所` +
      `${dryRun ? ' (dry-run 未写入)' : ''}\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
