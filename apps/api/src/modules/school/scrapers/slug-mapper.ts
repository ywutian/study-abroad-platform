/**
 * 学校名称 → URL slug 映射工具
 *
 * 将学校名称转换为各数据源的 URL slug 格式
 * 支持手动 override（存储在 metadata.slugs 中）
 */

/**
 * 手动映射表: 名称不规则的学校
 * key = 标准化校名 (lowercase), value = { site: slug }
 */
const MANUAL_SLUGS: Record<string, Record<string, string>> = {
  'massachusetts institute of technology': {
    bigfuture: 'massachusetts-institute-of-technology-mit',
    appily: 'massachusetts-institute-of-technology',
  },
  'california institute of technology': {
    bigfuture: 'california-institute-of-technology',
    appily: 'california-institute-of-technology',
  },
  'university of california-los angeles': {
    bigfuture: 'university-of-california-los-angeles',
    appily: 'university-of-california-los-angeles',
  },
  'university of california-berkeley': {
    bigfuture: 'university-of-california-berkeley',
    appily: 'university-of-california-berkeley',
  },
  'carnegie mellon university': {
    bigfuture: 'carnegie-mellon-university',
    appily: 'carnegie-mellon-university',
  },
};

/**
 * 将学校名称转换为 URL slug
 *
 * 规则:
 * 1. 先检查 metadata.slugs[site] (用户/管理员手动设置)
 * 2. 再检查 MANUAL_SLUGS 硬编码表
 * 3. 最后自动生成: lowercase → 替换空格和特殊字符为 -
 */
export function getSlug(
  schoolName: string,
  site: 'bigfuture' | 'appily',
  metadata?: Record<string, unknown> | null,
): string {
  // 1. metadata override
  if (metadata?.slugs) {
    const slugs = metadata.slugs as Record<string, string>;
    if (slugs[site]) return slugs[site];
  }

  // 2. Manual lookup
  const nameKey = schoolName.toLowerCase().trim();
  const manual = MANUAL_SLUGS[nameKey];
  if (manual?.[site]) return manual[site];

  // 3. Auto-generate
  return nameKey
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric
    .replace(/\s+/g, '-') // spaces → hyphens
    .replace(/-+/g, '-') // collapse hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens
}

/**
 * BigFuture 特殊处理: 有些学校名与 slug 不同
 * BigFuture URL: https://bigfuture.collegeboard.org/colleges/{slug}
 *
 * BigFuture 的 slug 通常是 college 名 (不含 "University" 等后缀的场景少见)
 * 但通常保持完整名称的 slug 化版本
 */
export function getBigFutureSlug(
  schoolName: string,
  metadata?: Record<string, unknown> | null,
): string {
  return getSlug(schoolName, 'bigfuture', metadata);
}

/**
 * Appily URL: https://www.appily.com/colleges/{slug}
 */
export function getAppilySlug(
  schoolName: string,
  metadata?: Record<string, unknown> | null,
): string {
  return getSlug(schoolName, 'appily', metadata);
}
