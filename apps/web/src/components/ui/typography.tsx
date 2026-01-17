import * as React from 'react';
import { cn } from '@/lib/utils';

/* ================================================================
 * 企业级排版组件
 *
 * 基于 globals.css 中的设计 token（.text-display ~ .text-caption），
 * 提供语义化的 Heading / Text 组件，保证全站排版一致性。
 *
 * 排版阶梯:
 *   Display    38-46px  700  Landing hero
 *   Title LG   30-38px  700  营销页标题
 *   Title      24-30px  600  应用页标题
 *   Subtitle   24px     600  Section heading
 *   Body LG    20px     400  Lead paragraph
 *   Body       16px     400  默认正文
 *   Body SM    14px     400  次要文本
 *   Caption    12px     400  提示/时间戳
 *   Overline   12px     500  分类标签 (uppercase)
 * ================================================================ */

// ── Heading ─────────────────────────────────────────────────────

const HEADING_LEVEL_STYLES: Record<number, string> = {
  1: 'text-title', // 24-30px, font-weight 600
  2: 'text-subtitle', // 24px, font-weight 600
  3: 'text-body-lg font-semibold', // 20px
  4: 'text-body font-semibold', // 16px
  5: 'text-body-sm font-semibold', // 14px
  6: 'text-caption font-semibold', // 12px
};

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** 标题层级 (1-6)，决定默认字号和渲染标签 */
  level?: HeadingLevel;
  /** 覆盖渲染标签（如 level=1 但渲染为 h2） */
  as?: HeadingTag;
  /** 使用展示级超大字号（仅 level=1 时有效） */
  display?: boolean;
  /** 使用加大标题字号（仅 level=1 时有效） */
  titleLg?: boolean;
}

function Heading({
  level = 1,
  as,
  display = false,
  titleLg = false,
  className,
  ...props
}: HeadingProps) {
  const Tag = as || (`h${level}` as HeadingTag);

  let baseStyle = HEADING_LEVEL_STYLES[level] || HEADING_LEVEL_STYLES[1];
  if (level === 1 && display) baseStyle = 'text-display';
  if (level === 1 && titleLg) baseStyle = 'text-title-lg';

  return <Tag className={cn(baseStyle, className)} {...props} />;
}

// ── Text ────────────────────────────────────────────────────────

const TEXT_VARIANT_STYLES: Record<string, string> = {
  lg: 'text-body-lg',
  default: 'text-body',
  sm: 'text-body-sm',
  caption: 'text-caption',
  overline: 'text-overline',
};

type TextVariant = keyof typeof TEXT_VARIANT_STYLES;

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  /** 文本变体 */
  variant?: TextVariant;
  /** 覆盖渲染标签（默认: p / caption/overline 为 span） */
  as?: React.ElementType;
  /** 使用 muted-foreground 颜色 */
  muted?: boolean;
}

function Text({ variant = 'default', as, muted = false, className, ...props }: TextProps) {
  const isInline = variant === 'caption' || variant === 'overline';
  const Tag = as || (isInline ? 'span' : 'p');

  return (
    <Tag
      className={cn(
        TEXT_VARIANT_STYLES[variant] || TEXT_VARIANT_STYLES.default,
        muted && 'text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

export { Heading, Text };
export type { HeadingProps, HeadingLevel, TextProps, TextVariant };
