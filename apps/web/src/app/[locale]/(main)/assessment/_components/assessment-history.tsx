'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardCheck, Compass, ChevronRight, Loader2, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssessmentResult } from './assessment-constants';

interface AssessmentHistoryProps {
  history: AssessmentResult[] | undefined;
  isLoading?: boolean;
  onViewResult: (result: AssessmentResult) => void;
  onStartAssessment: () => void;
}

type Filter = 'ALL' | 'MBTI' | 'HOLLAND';

export function AssessmentHistory({
  history,
  isLoading,
  onViewResult,
  onStartAssessment,
}: AssessmentHistoryProps) {
  const t = useTranslations('assessment');
  const format = useFormatter();
  const [filter, setFilter] = useState<Filter>('ALL');

  const filteredHistory = useMemo(() => {
    const items = history ?? [];
    if (filter === 'ALL') return items;
    return items.filter((result) => result.type === filter);
  }, [filter, history]);

  if (isLoading) {
    return (
      <Card className="flex h-72 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-12 text-center">
          <Trophy className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="font-semibold">{t('noHistory')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('noHistoryHint')}</p>
          <Button className="mt-4" onClick={onStartAssessment}>
            {t('startAssessment')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['ALL', 'MBTI', 'HOLLAND'] as const).map((item) => (
          <Button
            key={item}
            size="sm"
            variant={filter === item ? 'default' : 'outline'}
            onClick={() => setFilter(item)}
          >
            {item === 'ALL' ? t('historyFilters.all') : item}
          </Button>
        ))}
      </div>

      <ScrollArea className="h-[620px] pr-3">
        <div className="space-y-3">
          {filteredHistory.map((result, index) => {
            const isMbti = result.type === 'MBTI';
            const code = result.mbtiResult?.type || result.hollandResult?.codes;
            const title = isMbti ? t('testTypes.mbti') : t('testTypes.holland');
            const description =
              result.mbtiResult?.titleZh || result.hollandResult?.typesZh?.join(' · ');

            return (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => onViewResult(result)}
                >
                  <CardContent className="grid min-w-0 gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        className={cn(
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white',
                          isMbti
                            ? 'bg-violet-500 dark:bg-violet-600'
                            : 'bg-emerald-500 dark:bg-emerald-600'
                        )}
                      >
                        {isMbti ? (
                          <ClipboardCheck className="h-6 w-6" />
                        ) : (
                          <Compass className="h-6 w-6" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold">{title}</h4>
                          {code ? <Badge variant="secondary">{code}</Badge> : null}
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {description || t('viewResult')}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('completedAt')}:{' '}
                          {format.dateTime(new Date(result.completedAt), 'medium')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="hidden h-5 w-5 text-muted-foreground sm:block" />
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
