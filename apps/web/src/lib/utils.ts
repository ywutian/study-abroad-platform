import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 根据当前 locale 返回学校的主要显示名称
 * - zh: 优先显示中文名，fallback 到英文名
 * - en: 优先显示英文名，fallback 到中文名
 */
export function getSchoolName(
  school: { name?: string; nameZh?: string } | null | undefined,
  locale: string
): string {
  if (!school) return '';
  if (locale === 'zh') {
    return school.nameZh || school.name || '';
  }
  return school.name || school.nameZh || '';
}

/**
 * 根据当前 locale 返回学校的次要显示名称
 * - zh locale: 显示英文名作为副标题（中英双显）
 * - en locale: 不显示中文名（仅英文）
 * 如果主次名称相同则返回 undefined
 */
export function getSchoolSubName(
  school: { name?: string; nameZh?: string } | null | undefined,
  locale: string
): string | undefined {
  if (!school) return undefined;
  // English locale: only show English name, no Chinese secondary
  if (locale !== 'zh') return undefined;
  const primary = getSchoolName(school, locale);
  const secondary = school.name;
  if (!secondary || secondary === primary) return undefined;
  return secondary;
}
