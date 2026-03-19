'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import type { Essay } from '@/types/essay';

interface EssayListSidebarProps {
  essays: Essay[] | undefined;
  isLoading: boolean;
  selectedEssayId: string | null;
  onSelect: (essay: Essay) => void;
  getWordCount: (text: string) => number;
}

export function EssayListSidebar({
  essays,
  isLoading,
  selectedEssayId,
  onSelect,
  getWordCount,
}: EssayListSidebarProps) {
  const t = useTranslations();
  const fmt = useFormatter();

  return (
    <div className="lg:col-span-1">
      <Card className="overflow-hidden">
        <div className="h-1 bg-destructive" />
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10">
              <FileText className="h-4 w-4 text-rose-500" />
            </div>
            <CardTitle className="text-lg">{t('essays.list')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState variant="card" count={3} />
          ) : essays && essays.length > 0 ? (
            <ScrollArea className="h-[500px] pr-2">
              <div className="space-y-2">
                {essays.map((essay, index) => (
                  <motion.div
                    key={essay.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'cursor-pointer rounded-xl border p-4 transition-all duration-200',
                      'hover:border-rose-500/40 hover:bg-rose-500/5 hover:shadow-sm',
                      selectedEssayId === essay.id && 'border-rose-500 bg-rose-500/5 shadow-sm'
                    )}
                    onClick={() => onSelect(essay)}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h4 className="font-semibold line-clamp-1">{essay.title}</h4>
                      <Badge variant="info" className="shrink-0">
                        {essay.wordCount || getWordCount(essay.content)} {t('common.words')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {essay.prompt || essay.content.slice(0, 100)}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {fmt.dateTime(new Date(essay.updatedAt), 'medium')}
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <EmptyState
              icon={<FileText className="h-12 w-12" />}
              title={t('essays.empty.title')}
              description={t('essays.empty.description')}
              className="py-8"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
