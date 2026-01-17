'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Flame, MessageCircle, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PostSortBy } from '@/types/forum';

const SORT_OPTIONS: { value: PostSortBy; labelKey: string; icon: typeof Clock }[] = [
  { value: 'latest', labelKey: 'sortLatest', icon: Clock },
  { value: 'popular', labelKey: 'sortPopular', icon: Flame },
  { value: 'comments', labelKey: 'sortComments', icon: MessageCircle },
  { value: 'recommended', labelKey: 'sortRecommended', icon: Sparkles },
];

interface SortTabsProps {
  value: PostSortBy;
  onChange: (value: PostSortBy) => void;
}

export function SortTabs({ value, onChange }: SortTabsProps) {
  const t = useTranslations('forum');

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as PostSortBy)}>
      <TabsList className="bg-muted/50 h-10">
        {SORT_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t(option.labelKey)}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
