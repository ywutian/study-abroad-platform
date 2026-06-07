'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileClock,
  GraduationCap,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type {
  AssessmentDraftSummary,
  AssessmentResult,
  AssessmentSummary,
  AssessmentKind,
} from './assessment-constants';
import { HOLLAND_COLORS, HOLLAND_ICONS } from './assessment-constants';

interface AssessmentIntroProps {
  summary?: AssessmentSummary;
  isLoading?: boolean;
  onStartTest: (type: AssessmentKind, mode?: 'fresh' | 'continue') => void;
  onViewResult: (result: AssessmentResult) => void;
  onOpenInsights: () => void;
}

const TOTAL_QUESTIONS: Record<'MBTI' | 'HOLLAND', number> = {
  MBTI: 48,
  HOLLAND: 30,
};

function getDraftPercent(draft?: AssessmentDraftSummary) {
  if (!draft) return 0;
  return Math.min(100, Math.round((draft.answerCount / TOTAL_QUESTIONS[draft.type]) * 100));
}

function getResultCode(result?: AssessmentResult) {
  return result?.mbtiResult?.type || result?.hollandResult?.codes;
}

export function AssessmentIntro({
  summary,
  isLoading,
  onStartTest,
  onViewResult,
  onOpenInsights,
}: AssessmentIntroProps) {
  const t = useTranslations('assessment');
  const format = useFormatter();

  const latestMbti = summary?.latestMbti;
  const latestHolland = summary?.latestHolland;
  const mbtiDraft = summary?.drafts.find((draft) => draft.type === 'MBTI');
  const hollandDraft = summary?.drafts.find((draft) => draft.type === 'HOLLAND');
  const completedCount = Number(Boolean(latestMbti)) + Number(Boolean(latestHolland));
  const completion = Math.round((completedCount / 2) * 100);

  const tests = [
    {
      type: 'mbti' as const,
      apiType: 'MBTI' as const,
      title: t('mbti.title'),
      description: t('mbti.description'),
      intro: t('mbti.intro'),
      icon: ClipboardCheck,
      accent: 'bg-violet-500 dark:bg-violet-600',
      border: 'border-violet-500/25',
      result: latestMbti,
      draft: mbtiDraft,
      tags: ['INTJ', 'ENFP', 'ISTJ', 'ENTP'],
    },
    {
      type: 'holland' as const,
      apiType: 'HOLLAND' as const,
      title: t('holland.title'),
      description: t('holland.description'),
      intro: t('holland.intro'),
      icon: Compass,
      accent: 'bg-emerald-500 dark:bg-emerald-600',
      border: 'border-emerald-500/25',
      result: latestHolland,
      draft: hollandDraft,
      tags: ['R', 'I', 'A', 'S', 'E', 'C'],
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-[color:var(--theme-card-bg)]">
        <CardContent className="grid min-w-0 gap-5 p-5 lg:grid-cols-[1fr_320px] lg:items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                {t('overview.badge')}
              </Badge>
              {summary?.historyCount ? (
                <Badge variant="secondary">
                  {t('overview.historyCount', { count: summary.historyCount })}
                </Badge>
              ) : null}
            </div>
            <div>
              <h2 className="text-subtitle">{t('overview.title')}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {t('overview.description')}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatusTile
                icon={CheckCircle2}
                label={t('overview.completed')}
                value={`${completedCount}/2`}
                tone={completedCount === 2 ? 'success' : 'muted'}
              />
              <StatusTile
                icon={FileClock}
                label={t('overview.drafts')}
                value={String(summary?.drafts.length ?? 0)}
                tone={summary?.drafts.length ? 'warning' : 'muted'}
              />
              <StatusTile
                icon={GraduationCap}
                label={t('overview.majors')}
                value={String(summary?.majorSuggestions.length ?? 0)}
                tone={summary?.majorSuggestions.length ? 'info' : 'muted'}
              />
            </div>
          </div>
          <div className="rounded-[var(--theme-radius-card)] border border-border bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-medium">{t('overview.completion')}</span>
              <span className="text-muted-foreground">{completion}%</span>
            </div>
            <Progress value={completion} className="h-2.5" />
            <div className="mt-4 space-y-2 text-sm">
              {summary?.majorSuggestions.slice(0, 4).map((item) => (
                <div key={item.major} className="flex items-center justify-between gap-3">
                  <span className="truncate">{item.major}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.sources.join(' + ')}
                  </span>
                </div>
              ))}
              {!summary?.majorSuggestions.length && !isLoading ? (
                <p className="text-sm text-muted-foreground">{t('overview.noMajors')}</p>
              ) : null}
            </div>
            <Button
              className="mt-4 w-full gap-2"
              variant={completedCount === 2 ? 'default' : 'outline'}
              onClick={onOpenInsights}
              disabled={!completedCount}
            >
              <Lightbulb className="h-4 w-4" />
              {t('overview.openInsights')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {tests.map((test, index) => {
          const Icon = test.icon;
          const code = getResultCode(test.result);
          const draftPercent = getDraftPercent(test.draft);
          return (
            <motion.div
              key={test.type}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
            >
              <Card className={cn('h-full border-2', test.border)}>
                <div className={cn('h-1.5', test.accent)} />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white',
                          test.accent
                        )}
                      >
                        <Icon className="h-6 w-6" />
                      </span>
                      <div>
                        <CardTitle className="text-xl">{test.title}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{test.description}</p>
                      </div>
                    </div>
                    {code ? (
                      <Badge variant="success" className="shrink-0">
                        {code}
                      </Badge>
                    ) : test.draft ? (
                      <Badge variant="warning" className="shrink-0">
                        {t('overview.inProgress')}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-5">
                  <p className="text-sm leading-6 text-muted-foreground">{test.intro}</p>

                  {test.draft ? (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium">{t('overview.savedDraft')}</span>
                        <span className="text-muted-foreground">
                          {format.dateTime(new Date(test.draft.updatedAt), 'short')}
                        </span>
                      </div>
                      <Progress value={draftPercent} className="h-2" />
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('overview.draftProgress', {
                          answered: test.draft.answerCount,
                          total: TOTAL_QUESTIONS[test.apiType],
                        })}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {test.type === 'holland'
                      ? test.tags.map((type) => {
                          const HollandIcon = HOLLAND_ICONS[type];
                          return (
                            <Badge
                              key={type}
                              className={cn('gap-1 text-white', HOLLAND_COLORS[type])}
                            >
                              <HollandIcon className="h-3 w-3" />
                              {type}
                            </Badge>
                          );
                        })
                      : test.tags.map((type) => (
                          <Badge
                            key={type}
                            variant="secondary"
                            className="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200"
                          >
                            {type}
                          </Badge>
                        ))}
                  </div>

                  <div className="mt-auto grid gap-2 sm:grid-cols-2">
                    {test.draft ? (
                      <Button className="gap-2" onClick={() => onStartTest(test.type, 'continue')}>
                        {t('overview.continue')}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button className="gap-2" onClick={() => onStartTest(test.type, 'fresh')}>
                        {code ? t('overview.retake') : t('overview.start')}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                    {test.result ? (
                      <Button variant="outline" onClick={() => onViewResult(test.result!)}>
                        {t('viewResult')}
                      </Button>
                    ) : test.draft ? (
                      <Button variant="outline" onClick={() => onStartTest(test.type, 'fresh')}>
                        {t('overview.restart')}
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => onStartTest(test.type, 'fresh')}>
                        {t('overview.previewFlow')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'info' | 'muted';
}) {
  const toneClass = {
    success: 'border-success/25 bg-success/10 text-success',
    warning: 'border-warning/25 bg-warning/10 text-warning',
    info: 'border-primary/25 bg-primary/10 text-primary',
    muted: 'border-border bg-muted/30 text-muted-foreground',
  }[tone];

  return (
    <div className={cn('rounded-lg border p-3', toneClass)}>
      <div className="flex items-center gap-2 text-xs">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
