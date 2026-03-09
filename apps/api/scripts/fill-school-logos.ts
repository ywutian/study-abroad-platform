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

const prisma = new PrismaClient();

const GOOGLE_FAVICON_BASE = 'https://www.google.com/s2/favicons';
const LOGO_DEV_BASE = 'https://img.logo.dev';
const LOGO_DEV_SIZE = 256;
const FAVICON_SIZE = 256;
const DELAY_MS = 200;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

type LogoSource = 'logo.dev' | 'favicon';

function extractDomain(website: string | null | undefined): string | null {
  if (!website || typeof website !== 'string') return null;
  const trimmed = website.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(
      trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
    );
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost'))
      return null;
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

function buildLogoUrl(
  domain: string,
  source: LogoSource,
  token?: string,
): string {
  if (source === 'logo.dev' && token) {
    return `${LOGO_DEV_BASE}/${domain}?token=${token}&size=${LOGO_DEV_SIZE}`;
  }
  return `${GOOGLE_FAVICON_BASE}?domain=${domain}&sz=${FAVICON_SIZE}`;
}

async function updateWithRetry(
  id: string,
  logoUrl: string,
  dryRun: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (dryRun) return { ok: true };
  let lastError: string | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await prisma.school.update({
        where: { id },
        data: { logoUrl },
      });
      return { ok: true };
    } catch (e) {
      lastError = (e as Error).message;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  return { ok: false, error: lastError };
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => !a.startsWith('--'));
  const limit = Math.min(Math.max(1, parseInt(limitArg || '100', 10)), 2000);
  const overwrite = args.includes('--overwrite');
  const dryRun = args.includes('--dry-run');
  const forceSource = args
    .find((a) => a.startsWith('--source='))
    ?.split('=')[1] as LogoSource | undefined;

  const logoDevToken = process.env.LOGO_DEV_TOKEN;
  const source: LogoSource =
    forceSource === 'favicon'
      ? 'favicon'
      : logoDevToken
        ? 'logo.dev'
        : 'favicon';

  const where = overwrite
    ? { website: { not: null } }
    : { website: { not: null }, logoUrl: null };

  const schools = await prisma.school.findMany({
    where,
    select: { id: true, name: true, website: true },
    take: limit,
  });

  const sourceLabel =
    source === 'logo.dev' ? 'Logo.dev (高清)' : 'Google Favicon';
  console.log(
    `\n📷 填充学校 Logo（来源: ${sourceLabel}）\n` +
      `   条件: ${overwrite ? '有 website 即处理' : '有 website 且无 logoUrl'}\n` +
      `   数量: 最多 ${limit} 所，本次 ${schools.length} 所` +
      `${dryRun ? '\n   ⚠️  --dry-run: 仅打印，不写入数据库' : ''}\n`,
  );

  let filled = 0;
  let skipped = 0;
  let failed = 0;

  for (const school of schools) {
    const domain = extractDomain(school.website);
    if (!domain) {
      console.log(`   ⏭️  ${school.name}: 无法解析域名`);
      skipped++;
      continue;
    }

    const logoUrl = buildLogoUrl(domain, source, logoDevToken);
    const { ok, error } = await updateWithRetry(school.id, logoUrl, dryRun);
    if (ok) {
      filled++;
      console.log(
        `   ${dryRun ? '🔍' : '✅'} ${school.name} → ${domain}${dryRun ? ' (dry-run)' : ''}`,
      );
    } else {
      console.error(`   ❌ ${school.name}: ${error ?? 'unknown'}`);
      failed++;
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(
    `\n📊 完成: 成功 ${filled} 所, 跳过(无域名) ${skipped} 所, 失败 ${failed} 所` +
      `${dryRun ? ' (dry-run 未写入)' : ''}\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
