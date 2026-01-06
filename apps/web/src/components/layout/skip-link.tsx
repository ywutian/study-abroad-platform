'use client';

/**
 * Skip Links 组件
 * 
 * 为键盘用户和屏幕阅读器用户提供快速跳转到主要内容的功能
 */

import { useTranslations } from 'next-intl';

interface SkipLinkProps {
  mainId?: string;
  navId?: string;
}

export function SkipLinks({ mainId = 'main-content', navId = 'main-nav' }: SkipLinkProps) {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href={`#${mainId}`}
        className="fixed top-4 left-4 z-[9999] bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium
                   focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                   transition-transform duration-200 -translate-y-full focus:translate-y-0"
      >
        跳转到主要内容
      </a>
      <a
        href={`#${navId}`}
        className="fixed top-4 left-40 z-[9999] bg-secondary text-secondary-foreground px-4 py-2 rounded-md font-medium
                   focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                   transition-transform duration-200 -translate-y-full focus:translate-y-0"
      >
        跳转到导航
      </a>
    </div>
  );
}

/**
 * 主内容区域包装器
 * 
 * 自动添加 id 和无障碍属性
 */
interface MainContentProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export function MainContent({ children, id = 'main-content', className }: MainContentProps) {
  return (
    <main
      id={id}
      role="main"
      tabIndex={-1}
      className={`outline-none ${className || ''}`}
      aria-label="主要内容"
    >
      {children}
    </main>
  );
}


