'use client';

import { useRef, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TAB_CONFIG, TAB_ICON_ACTIVE_CLASSES } from './constants';

interface ProfileTabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabErrors?: Record<string, number>;
}

export function ProfileTabNav({ activeTab, onTabChange, tabErrors }: ProfileTabNavProps) {
  const t = useTranslations();
  const activeTabConfig = TAB_CONFIG.find((tab) => tab.value === activeTab);
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
                {tabErrors?.[tab.value] ? (
                  <span
                    className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-medium px-1"
                    aria-label={t('profile.tabErrorsAria', { count: tabErrors[tab.value] })}
                  >
                    {tabErrors[tab.value]}
                  </span>
                ) : isActive ? (
                  <ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />
                ) : null}
              </motion.button>
            );
          })}
        </nav>

        {/* Mobile selector */}
        <div className="lg:hidden">
          <Select value={activeTab} onValueChange={onTabChange}>
            <SelectTrigger className="h-12" aria-label={t('profile.title')}>
              <div className="flex items-center gap-3">
                {activeTabConfig && (
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      TAB_ICON_ACTIVE_CLASSES[activeTabConfig.value] ||
                        'bg-primary text-primary-foreground'
                    )}
                  >
                    <activeTabConfig.icon className="h-4 w-4" />
                  </div>
                )}
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {TAB_CONFIG.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>
                  <span className="flex items-center gap-2">
                    <tab.icon className="h-4 w-4" />
                    {t(tab.labelKey)}
                    {tabErrors?.[tab.value] ? (
                      <span
                        className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-2xs font-medium px-1"
                        aria-label={t('profile.tabErrorsAria', { count: tabErrors[tab.value] })}
                      >
                        {tabErrors[tab.value]}
                      </span>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
