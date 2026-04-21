import { cn } from '@/lib/utils';

export type PageContainerVariant = 'marketing' | 'entry' | 'tool' | 'ai' | 'community' | 'admin';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: PageContainerVariant;
  /**
   * 最大宽度，默认依据 variant 推导
   * - 'narrow': 适合阅读内容 (max-w-4xl)
   * - 'medium': 适合表单/设置 (max-w-5xl)
   * - 'default': 标准页面 (max-w-6xl)
   * - 'wide': 宽屏页面 (max-w-7xl)
   * - 'fluid': 流式布局 (max-w-[1600px])
   * - 'full': 全宽
   */
  maxWidth?:
    | 'narrow'
    | 'medium'
    | 'default'
    | 'wide'
    | 'fluid'
    | 'full'
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl'
    | '2xl'
    | '3xl'
    | '4xl'
    | '5xl'
    | '6xl'
    | '7xl';
}

const maxWidthClasses: Record<string, string> = {
  narrow: 'max-w-4xl',
  medium: 'max-w-5xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
  fluid: 'max-w-[1600px]',
  full: 'max-w-full',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
};

const variantDefaults: Record<
  PageContainerVariant,
  { maxWidth: keyof typeof maxWidthClasses; padding: string }
> = {
  marketing: {
    maxWidth: 'wide',
    padding: 'px-4 sm:px-6 lg:px-8 xl:px-10',
  },
  entry: {
    maxWidth: 'medium',
    padding: 'px-4 sm:px-6 lg:px-8',
  },
  tool: {
    maxWidth: 'wide',
    padding: 'px-4 sm:px-6 lg:px-8 xl:px-10',
  },
  ai: {
    maxWidth: 'wide',
    padding: 'px-4 sm:px-6 lg:px-8 xl:px-10',
  },
  community: {
    maxWidth: 'wide',
    padding: 'px-4 sm:px-6 lg:px-8 xl:px-10',
  },
  admin: {
    maxWidth: 'fluid',
    padding: 'px-4 sm:px-6 lg:px-8 xl:px-12',
  },
};

export function PageContainer({
  children,
  className,
  variant = 'tool',
  maxWidth,
}: PageContainerProps) {
  const variantConfig = variantDefaults[variant];
  const resolvedMaxWidth = maxWidth ?? variantConfig.maxWidth;

  return (
    <div
      className={cn(
        'mx-auto w-full',
        variantConfig.padding,
        maxWidthClasses[resolvedMaxWidth],
        className
      )}
    >
      {children}
    </div>
  );
}
