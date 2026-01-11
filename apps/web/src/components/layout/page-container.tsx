import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /** 
   * 最大宽度，默认 'wide'
   * - 'narrow': 适合阅读内容 (max-w-4xl)
   * - 'medium': 适合表单/设置 (max-w-5xl) 
   * - 'default': 标准页面 (max-w-6xl)
   * - 'wide': 宽屏页面 (max-w-7xl)
   * - 'fluid': 流式布局 (max-w-[1600px])
   * - 'full': 全宽
   */
  maxWidth?: 'narrow' | 'medium' | 'default' | 'wide' | 'fluid' | 'full' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
}

const maxWidthClasses: Record<string, string> = {
  // 新语义化命名
  narrow: 'max-w-4xl',
  medium: 'max-w-5xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
  fluid: 'max-w-[1600px]',
  full: 'max-w-full',
  // 保持向后兼容
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

export function PageContainer({ children, className, maxWidth = 'wide' }: PageContainerProps) {
  return (
    <div className={cn(
      'mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12',
      maxWidthClasses[maxWidth],
      className
    )}>
      {children}
    </div>
  );
}









