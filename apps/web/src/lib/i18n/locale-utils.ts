/**
 * 集中式 locale 工具函数
 *
 * 所有 locale → BCP-47 映射和 locale 感知的数据选择逻辑
 * 都应在此文件中集中管理，而不是散落在各个组件中。
 *
 * 添加新语言时只需修改本文件的映射表，无需改动任何组件。
 */

import { type Locale } from './config';

// ============================================
// BCP-47 locale 映射
// ============================================

/**
 * 应用 locale → BCP-47 完整 locale 标签的映射
 *
 * 用于需要 BCP-47 格式的场景（如第三方库、PDF 生成等）。
 * 注意：大多数场景应优先使用 useFormatter() 而非此函数。
 */
const BCP47_MAP: Record<Locale, string> = {
  zh: 'zh-CN',
  en: 'en-US',
};

export function toBcp47(locale: string): string {
  return BCP47_MAP[locale as Locale] ?? locale;
}

// ============================================
// 本地化名称选择
// ============================================

/**
 * 根据 locale 选择本地化名称
 *
 * 通用工具函数，适用于任何有 nameZh + name 模式的数据。
 * 例如：schoolNameZh / schoolName, categoryNameZh / categoryName 等。
 *
 * @param localizedName - 本地化名称 (如 nameZh)
 * @param originalName  - 原始名称 (如 name, 通常为英文)
 * @param locale        - 当前 locale
 * @returns 根据 locale 优先级选择的名称
 */
export function getLocalizedName(
  localizedName: string | undefined | null,
  originalName: string | undefined | null,
  locale: string
): string {
  if (locale === 'zh') {
    return localizedName || originalName || '';
  }
  return originalName || localizedName || '';
}

/**
 * 判断是否应显示次要名称（用于双语显示场景）
 *
 * 规则：
 * - zh locale: 如果有英文名且与主名称不同，返回英文名（实现中英双显）
 * - 其他 locale: 不显示次要名称
 */
export function getSecondaryName(
  localizedName: string | undefined | null,
  originalName: string | undefined | null,
  locale: string
): string | undefined {
  if (locale !== 'zh') return undefined;
  const primary = localizedName || originalName || '';
  if (!originalName || originalName === primary) return undefined;
  return originalName;
}
