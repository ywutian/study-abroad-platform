'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardCheck, Compass, ChevronRight, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssessmentResult } from './assessment-constants';

interface AssessmentHistoryProps {
  history: AssessmentResult[] | undefined;
  onViewResult: (result: AssessmentResult) => void;
  onStartAssessment: () => void;
}

export function AssessmentHistory({
  history,
  onViewResult,
  onStartAssessment,
}: AssessmentHistoryProps) {
  const t = useTranslations('assessment');
  const format = useFormatter();

  if (!history || history.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-12 text-center">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold">{t('noHistory')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('noHistoryHint')}</p>
          <Button className="mt-4" onClick={onStartAssessment}>
            {t('startAssessment')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[500px]">
        <div className="space-y-3">
          {history.map((result, index) => (
            <motion.div
              key={result.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onViewResult(result)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center text-white',
                        result.type === 'MBTI'
                          ? 'bg-violet-500 dark:bg-violet-600'
                          : 'bg-emerald-500 dark:bg-emerald-600'
                      )}
                    >
                      {result.type === 'MBTI' ? (
                        <ClipboardCheck className="h-6 w-6" />
                      ) : (
                        <Compass className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold">
                        {result.type === 'MBTI' ? t('testTypes.mbti') : t('testTypes.holland')}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {result.mbtiResult?.type || result.hollandResult?.codes}
                        {' · '}
                        {t('completedAt')}:{' '}
                        {format.dateTime(new Date(result.completedAt), 'medium')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
