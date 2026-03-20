'use client';

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
import { TAB_CONFIG } from './constants';

interface ProfileTabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function ProfileTabNav({ activeTab, onTabChange }: ProfileTabNavProps) {
  const t = useTranslations();
  const activeTabConfig = TAB_CONFIG.find((tab) => tab.value === activeTab);

  return (
    <div className="lg:w-64 shrink-0">
      <div className="sticky top-20">
        {/* Desktop vertical navigation */}
        <nav className="hidden lg:block space-y-1">
          {TAB_CONFIG.map((tab, index) => {
            const isActive = activeTab === tab.value;
            return (
              <motion.button
                key={tab.value}
                onClick={() => onTabChange(tab.value)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200',
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
                      ? `bg-gradient-to-br ${tab.color} text-white shadow-md`
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                </div>
                <span className="font-medium text-sm">{t(tab.labelKey)}</span>
                {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
              </motion.button>
            );
          })}
        </nav>

        {/* Mobile selector */}
        <div className="lg:hidden">
          <Select value={activeTab} onValueChange={onTabChange}>
            <SelectTrigger className="h-12">
              <div className="flex items-center gap-3">
                {activeTabConfig && (
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white',
                      activeTabConfig.color
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
