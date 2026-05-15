'use client';

import { useRef, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { TAB_CONFIG, TAB_ICON_ACTIVE_CLASSES } from './constants';

export type TabCompletionStatus = 'complete' | 'missing' | 'partial';

interface ProfileTabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabErrors?: Record<string, number>;
  tabCompletion?: Record<string, TabCompletionStatus>;
}

const TAB_COMPLETION_CLASSES: Record<TabCompletionStatus, string> = {
  complete: 'bg-success',
  partial: 'bg-warning',
  missing: 'bg-muted-foreground/35',
};

export function ProfileTabNav({
  activeTab,
  onTabChange,
  tabErrors,
  tabCompletion,
}: ProfileTabNavProps) {
  const t = useTranslations();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /** Vertical arrow-key roving focus inside the tablist. */
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const lastIndex = TAB_CONFIG.length - 1;
    let nextIndex = currentIndex;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = lastIndex;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = TAB_CONFIG[nextIndex];
    onTabChange(next.value);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="lg:w-64 shrink-0">
      <div className="sticky top-20">
        {/* Desktop vertical navigation — ARIA tablist with arrow-key navigation */}
        <nav
          aria-label={t('profile.title')}
          role="tablist"
          aria-orientation="vertical"
          className="hidden lg:block space-y-1"
        >
          {TAB_CONFIG.map((tab, index) => {
            const isActive = activeTab === tab.value;
            const completion = tabCompletion?.[tab.value];
            return (
              <motion.button
                key={tab.value}
                ref={(el: HTMLButtonElement | null) => {
                  tabRefs.current[index] = el;
                }}
                role="tab"
                aria-selected={isActive}
                aria-controls={`profile-tab-panel-${tab.value}`}
                id={`profile-tab-${tab.value}`}
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => onTabChange(tab.value)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-all',
                    isActive
                      ? TAB_ICON_ACTIVE_CLASSES[tab.value] ||
                          'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                </div>
                <span className="font-medium text-sm">{t(tab.labelKey)}</span>
                <span className="ml-auto flex items-center gap-2">
                  {tabErrors?.[tab.value] ? (
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-medium px-1"
                      aria-label={t('profile.tabErrorsAria', { count: tabErrors[tab.value] })}
                    >
                      {tabErrors[tab.value]}
                    </span>
                  ) : completion ? (
                    <span
                      className={cn('h-2.5 w-2.5 rounded-full', TAB_COMPLETION_CLASSES[completion])}
                      aria-label={t(`profile.tabStatus.${completion}`)}
                      title={t(`profile.tabStatus.${completion}`)}
                    />
                  ) : null}
                  {isActive ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : null}
                </span>
              </motion.button>
            );
          })}
        </nav>

        {/* Mobile step navigation */}
        <nav
          aria-label={t('profile.title')}
          role="tablist"
          aria-orientation="horizontal"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden"
        >
          {TAB_CONFIG.map((tab, index) => {
            const isActive = activeTab === tab.value;
            const completion = tabCompletion?.[tab.value];
            return (
              <button
                key={tab.value}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                role="tab"
                aria-selected={isActive}
                aria-controls={`profile-tab-panel-${tab.value}`}
                id={`profile-tab-${tab.value}`}
                type="button"
                onClick={() => onTabChange(tab.value)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                className={cn(
                  'relative flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--theme-radius-button)] border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'bg-background text-muted-foreground'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {t(tab.labelKey)}
                {tabErrors?.[tab.value] ? (
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-2xs text-destructive-foreground"
                    aria-label={t('profile.tabErrorsAria', { count: tabErrors[tab.value] })}
                  >
                    {tabErrors[tab.value]}
                  </span>
                ) : completion ? (
                  <span
                    className={cn('h-2.5 w-2.5 rounded-full', TAB_COMPLETION_CLASSES[completion])}
                    aria-label={t(`profile.tabStatus.${completion}`)}
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
