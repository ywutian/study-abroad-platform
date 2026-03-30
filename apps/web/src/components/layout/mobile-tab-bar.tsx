'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/lib/i18n/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Home, BookOpen, Target, User } from 'lucide-react';
import { useHydrated } from '@/hooks/use-hydration';
import { useOnboardingProgress } from '@/hooks/use-onboarding-progress';

interface TabItem {
  href: string;
  icon: React.ElementType;
  labelKey: string;
  matchPaths?: string[];
}

const tabs: TabItem[] = [
  {
    href: '/dashboard',
    icon: Home,
    labelKey: 'home',
    matchPaths: ['/dashboard', '/'],
  },
  {
    href: '/cases',
    icon: BookOpen,
    labelKey: 'cases',
    matchPaths: ['/cases'],
  },
  {
    href: '/prediction',
    icon: Target,
    labelKey: 'prediction',
    matchPaths: ['/prediction'],
  },
  {
    href: '/profile',
    icon: User,
    labelKey: 'profile',
    matchPaths: ['/profile'],
  },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const t = useTranslations('nav.mobile');

  // 企业级 Hydration 安全方案：使用 useSyncExternalStore
  const isHydrated = useHydrated();
  const { completeness, showIndicator } = useOnboardingProgress();

  // 检查当前路径是否匹配
  const isActive = (tab: TabItem) => {
    const normalizedPath = pathname.replace(/^\/(zh|en)/, '');
    return tab.matchPaths?.some((p) => normalizedPath === p || normalizedPath.startsWith(p + '/'));
  };

  // SSR 时不渲染（避免 framer-motion layoutId 导致 hydration mismatch）
  if (!isHydrated) return null;

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-background/95 backdrop-blur-lg border-t',
        'pb-[env(safe-area-inset-bottom)]',
        'md:hidden' // 只在移动端显示
      )}
    >
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex flex-col items-center justify-center flex-1 h-full',
                'transition-colors duration-200',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {/* 活跃指示器 */}
              {active && (
                <motion.div
                  layoutId="mobile-tab-indicator"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}

              {/* 图标 */}
              <motion.div
                animate={active ? { scale: 1.1 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="relative"
              >
                <Icon className={cn('h-5 w-5 mb-1 transition-all', active && 'stroke-[2.5px]')} />
                {tab.href === '/profile' && showIndicator && (
                  <svg className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5" viewBox="0 0 16 16">
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-muted-foreground/20"
                    />
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-primary"
                      strokeDasharray={`${(completeness / 100) * 37.7} 37.7`}
                      strokeLinecap="round"
                      transform="rotate(-90 8 8)"
                    />
                  </svg>
                )}
              </motion.div>

              {/* 标签 */}
              <span className={cn('text-2xs font-medium', active && 'font-semibold')}>
                {t(tab.labelKey)}
              </span>

              {/* 点击效果 */}
              <div className="absolute inset-0 active:bg-primary/5 rounded-lg transition-colors" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
