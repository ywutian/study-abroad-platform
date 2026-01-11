'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/lib/i18n/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Home,
  BookOpen,
  Target,
  User,
} from 'lucide-react';

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

  // 检查当前路径是否匹配
  const isActive = (tab: TabItem) => {
    const normalizedPath = pathname.replace(/^\/(zh|en)/, '');
    return tab.matchPaths?.some((p) => normalizedPath === p || normalizedPath.startsWith(p + '/'));
  };

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
              >
                <Icon
                  className={cn(
                    'h-5 w-5 mb-1 transition-all',
                    active && 'stroke-[2.5px]'
                  )}
                />
              </motion.div>

              {/* 标签 */}
              <span
                className={cn(
                  'text-[10px] font-medium',
                  active && 'font-semibold'
                )}
              >
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

