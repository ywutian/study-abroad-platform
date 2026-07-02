import { cn } from '@/lib/utils';

export type PageContainerVariant =
  'marketing' | 'entry' | 'tool' | 'ai' | 'community' | 'admin' | 'workbench';

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
   * - 'workbench-wide': 工作台超宽 (max-w-[1760px])
   * - 'full': 全宽
   */
  maxWidth?:
    | 'narrow'
    | 'medium'
    | 'default'
    | 'wide'
    | 'fluid'
    | 'workbench-wide'
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
  'workbench-wide': 'max-w-[1760px]',
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

/**
 * `extra` — variant-level classes that go AFTER `padding` + `maxWidth`
 * but BEFORE the caller's `className`. Used for variants that need
 * a fixed structural shape (e.g. `workbench` is always a flex column
 * filling the viewport height). Kept separate from `padding` so the
 * order in the final cn() is deterministic and tw-merge friendly.
 */
const variantDefaults: Record<
  PageContainerVariant,
  { maxWidth: keyof typeof maxWidthClasses; padding: string; extra?: string }
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
  /**
   * `workbench` — three-column tool surfaces like /chat (and any
   * future /inbox, /agent-console, ...).  Replaces the ad-hoc
   *   <PageContainer maxWidth="full"
   *     className="mx-auto flex w-full max-w-[1760px] flex-col
   *                lg:h-[calc(100dvh-6.5rem)]">
   * pattern that was duplicated across pages.  Why this is its own
   * variant rather than a className-override:
   *   1. `max-w-[1760px]` is workbench-specific and shouldn't be
   *      reinvented per page (or copied as a magic number).
   *   2. `flex flex-col` + `lg:h-[calc(...)]` is non-optional — a
   *      workbench page MUST be a flex column at viewport-minus-header
   *      height, otherwise the inner grid's `flex-1 min-h-0
   *      overflow-hidden` does nothing.
   *   3. The previous className-override pattern depended on tw-merge
   *      priority to override the variant's max-w-full with the
   *      caller's max-w-[1760px] — semantically backwards and
   *      brittle. Encoding it as a first-class variant removes that
   *      footgun.
   *
   * Note on `min-w-0`: the workbench wrapper itself gets `min-w-0`
   * so that an inner grid's intrinsic content can't push the
   * container past its max-width (defence-in-depth — the grid
   * itself should also use `min-w-0` cells, but this is the
   * outermost guard).
   *
   * Note on `--app-header-h`: page height uses the CSS variable
   * `--app-header-h` (defined by <Header>) with a fallback of
   * `6.5rem`. PR 3 will wire this from the actual Header component
   * so the magic number disappears entirely.
   */
  workbench: {
    maxWidth: 'workbench-wide',
    padding: 'px-4 sm:px-6 lg:px-8',
    extra: 'min-w-0 flex flex-col lg:h-[calc(100dvh-var(--app-header-h,6.5rem))]',
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
        variantConfig.extra,
        className
      )}
    >
      {children}
    </div>
  );
}
