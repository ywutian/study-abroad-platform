'use client';

import { cn } from '@/lib/utils';

interface ResponsiveContainerProps {
  /** 子内容 */
  children: React.ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 最大宽度 */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'none';
  /** 内边距 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** 是否居中 */
  centered?: boolean;
  /** 作为 section 渲染 */
  as?: 'div' | 'section' | 'article' | 'main';
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
  none: '',
};

const paddingClasses = {
  none: '',
  sm: 'px-4 sm:px-6',
  md: 'px-4 sm:px-6 lg:px-8',
  lg: 'px-4 sm:px-8 lg:px-12',
};

export function ResponsiveContainer({
  children,
  className,
  maxWidth = 'xl',
  padding = 'md',
  centered = true,
  as: Component = 'div',
}: ResponsiveContainerProps) {
  return (
    <Component
      className={cn(
        'w-full',
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        centered && 'mx-auto',
        className
      )}
    >
      {children}
    </Component>
  );
}

// 响应式网格
interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'none' | 'sm' | 'md' | 'lg';
}

const gapClasses = {
  none: 'gap-0',
  sm: 'gap-3 sm:gap-4',
  md: 'gap-4 sm:gap-6',
  lg: 'gap-6 sm:gap-8',
};

export function ResponsiveGrid({
  children,
  className,
  cols = { default: 1, sm: 2, lg: 3 },
  gap = 'md',
}: ResponsiveGridProps) {
  const getColsClass = () => {
    const classes: string[] = ['grid'];
    
    if (cols.default) classes.push(`grid-cols-${cols.default}`);
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`);
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`);
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`);
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`);
    
    return classes.join(' ');
  };

  return (
    <div className={cn(getColsClass(), gapClasses[gap], className)}>
      {children}
    </div>
  );
}

// 响应式堆栈
interface ResponsiveStackProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
  breakpoint?: 'sm' | 'md' | 'lg';
  gap?: 'none' | 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
}

const alignClasses = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyClasses = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
};

export function ResponsiveStack({
  children,
  className,
  direction = 'col',
  breakpoint = 'md',
  gap = 'md',
  align = 'stretch',
  justify = 'start',
}: ResponsiveStackProps) {
  const getDirectionClass = () => {
    const baseDirection = direction.includes('row') ? 'flex-row' : 'flex-col';
    const responsiveDirection = direction.includes('row') ? 'flex-col' : 'flex-row';
    
    return `${responsiveDirection} ${breakpoint}:${baseDirection}`;
  };

  return (
    <div
      className={cn(
        'flex',
        getDirectionClass(),
        gapClasses[gap],
        alignClasses[align],
        justifyClasses[justify],
        className
      )}
    >
      {children}
    </div>
  );
}

// 隐藏/显示组件
interface ResponsiveShowProps {
  children: React.ReactNode;
  above?: 'sm' | 'md' | 'lg' | 'xl';
  below?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const showAboveClasses = {
  sm: 'hidden sm:block',
  md: 'hidden md:block',
  lg: 'hidden lg:block',
  xl: 'hidden xl:block',
};

const showBelowClasses = {
  sm: 'sm:hidden',
  md: 'md:hidden',
  lg: 'lg:hidden',
  xl: 'xl:hidden',
};

export function ResponsiveShow({
  children,
  above,
  below,
  className,
}: ResponsiveShowProps) {
  const visibilityClass = above
    ? showAboveClasses[above]
    : below
    ? showBelowClasses[below]
    : '';

  return <div className={cn(visibilityClass, className)}>{children}</div>;
}

// 响应式文本
interface ResponsiveTextProps {
  children: React.ReactNode;
  className?: string;
  size?: {
    default?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
    sm?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
    md?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
    lg?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  };
  as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export function ResponsiveText({
  children,
  className,
  size = { default: 'base', md: 'lg' },
  as: Component = 'p',
}: ResponsiveTextProps) {
  const getSizeClasses = () => {
    const classes: string[] = [];
    
    if (size.default) classes.push(`text-${size.default}`);
    if (size.sm) classes.push(`sm:text-${size.sm}`);
    if (size.md) classes.push(`md:text-${size.md}`);
    if (size.lg) classes.push(`lg:text-${size.lg}`);
    
    return classes.join(' ');
  };

  return (
    <Component className={cn(getSizeClasses(), className)}>
      {children}
    </Component>
  );
}
