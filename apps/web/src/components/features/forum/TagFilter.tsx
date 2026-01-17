'use client';

import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { Trophy, Target, HelpCircle, FileText, FolderOpen, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { ForumPostTag } from '@/types/forum';

const TAGS: { value: ForumPostTag | null; labelKey: string; icon: typeof Trophy }[] = [
  { value: null, labelKey: 'tagAll', icon: FolderOpen },
  { value: 'COMPETITION', labelKey: 'tagCompetition', icon: Trophy },
  { value: 'ACTIVITY', labelKey: 'tagActivity', icon: Target },
  { value: 'QUESTION', labelKey: 'tagQuestion', icon: HelpCircle },
  { value: 'SHARING', labelKey: 'tagSharing', icon: FileText },
];

interface TagFilterProps {
  value: ForumPostTag | null;
  onChange: (value: ForumPostTag | null) => void;
  showTeamOnly: boolean;
  onTeamOnlyChange: (value: boolean) => void;
}

export function TagFilter({ value, onChange, showTeamOnly, onTeamOnlyChange }: TagFilterProps) {
  const t = useTranslations('forum');

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex items-center gap-2 pb-2">
        {TAGS.map((tag) => {
          const Icon = tag.icon;
          const isActive = tag.value === value;

          return (
            <motion.button
              key={tag.value || 'all'}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(tag.value)}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {t(tag.labelKey)}
            </motion.button>
          );
        })}

        <div className="h-6 w-px bg-border mx-2" />

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onTeamOnlyChange(!showTeamOnly)}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all',
            showTeamOnly
              ? 'bg-emerald-500 text-white shadow-md'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Users className="h-4 w-4" />
          {t('teamOnly')}
        </motion.button>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
