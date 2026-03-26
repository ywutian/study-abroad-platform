/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useTranslations, useLocale } from 'next-intl';
import { DATA_SOURCE_LABELS } from '@study-abroad/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FileText, Sparkles, CheckCircle, Clock, PenLine, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

import type { SchoolDetail, EssayPrompt } from './types';
import { getSourceUrl } from './source-utils';

interface SchoolAcademicsTabProps {
  school: SchoolDetail;
  essayPrompts: (EssayPrompt | { id: number; prompt: string; year: number })[];
}

export function SchoolAcademicsTab({
  school,
  essayPrompts: _essayPrompts,
}: SchoolAcademicsTabProps) {
  const t = useTranslations();
  const tc = useTranslations('common');
  const locale = useLocale();

  const requirements = school.metadata?.requirements || {};
  const provenance = school.metadata?.provenance as
    | Record<string, { source: string; at: string }>
    | undefined;
  const localeKey = locale === 'zh' ? 'zh' : 'en';
  const getSource = (field: string) =>
    provenance?.[field] ? DATA_SOURCE_LABELS[provenance[field].source]?.[localeKey] : undefined;

  const renderSourceLabel = (field: string) => {
    const label = getSource(field);
    if (!label) return null;
    const url = getSourceUrl(provenance?.[field]?.source || '', school);
    return url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground hover:text-primary hover:underline inline-flex items-center gap-0.5"
      >
        {label}
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    ) : (
      <div className="text-xs text-muted-foreground">{label}</div>
    );
  };

  const getCompetitionLevel = (rate: number | undefined) => {
    if (!rate) return t('school.difficulty.medium');
    if (rate < 10) return t('school.difficulty.veryHigh');
    if (rate < 20) return t('school.difficulty.high');
    if (rate < 40) return t('school.difficulty.moderatelyHigh');
    return t('school.difficulty.medium');
  };

  const getAiSuggestion = (rate: number | undefined) => {
    if (!rate) return t('school.aiSuggestion.default');
    if (rate < 10) return t('school.aiSuggestion.veryLow');
    if (rate < 20) return t('school.aiSuggestion.low');
    return t('school.aiSuggestion.moderate');
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('school.requirements.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">
              {t('school.requirements.applicationType')}
            </span>
            <Badge>{school.metadata?.applicationType?.toUpperCase() || 'RD'}</Badge>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t('school.requirements.essayCount')}</span>
            <div className="text-right">
              <span className="font-semibold">
                {school.metadata?.essayCount || tc('notAvailable')}
              </span>
              {renderSourceLabel('essayCount')}
            </div>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t('school.requirements.applicationFee')}</span>
            <span className="font-semibold">
              {requirements.applicationFee ? `$${requirements.applicationFee}` : 'N/A'}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t('school.requirements.toeflMin')}</span>
            <div className="text-right">
              <span className="font-semibold">{requirements.toeflMin || tc('notAvailable')}</span>
              {renderSourceLabel('toeflMin')}
            </div>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t('school.requirements.ieltsMin')}</span>
            <div className="text-right">
              <span className="font-semibold">{requirements.ieltsMin || tc('notAvailable')}</span>
              {renderSourceLabel('ieltsMin')}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('school.difficultyAnalysis')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">{t('school.competitionLevel')}</span>
              <span className="text-sm font-medium">
                {getCompetitionLevel(
                  school.acceptanceRate ? Number(school.acceptanceRate) : undefined
                )}
              </span>
            </div>
            <Progress
              value={school.acceptanceRate ? 100 - Number(school.acceptanceRate) : 50}
              className="h-2"
            />
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('school.aiSuggestion.title')}
            </h4>
            <p className="text-sm text-muted-foreground">
              {getAiSuggestion(school.acceptanceRate ? Number(school.acceptanceRate) : undefined)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface SchoolEssaysTabProps {
  school: SchoolDetail;
  essayPrompts: (EssayPrompt | { id: number; prompt: string; year: number })[];
}

export function SchoolEssaysTab({ school, essayPrompts }: SchoolEssaysTabProps) {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      {/* Essay stats */}
      {essayPrompts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-primary/10 border-violet-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{essayPrompts.length}</p>
                  <p className="text-sm text-muted-foreground">{t('school.essays.totalCount')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-success/10 border-emerald-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 dark:bg-emerald-500/10">
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {essayPrompts.filter((e: any) => e.isRequired !== false).length}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('school.essays.required')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-warning/10 border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 dark:bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {essayPrompts.filter((e: any) => e.isRequired === false).length}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('school.essays.optional')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Essay list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('school.essays.title')}
          </CardTitle>
          <CardDescription>
            {school.metadata?.applicationCycle || '2025-2026'} {t('school.deadlines.cycle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {essayPrompts.length > 0 ? (
            <div className="space-y-4">
              {essayPrompts.map((essay: any, index: number) => (
                <motion.div
                  key={essay.id || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative overflow-hidden rounded-xl border bg-card p-5 hover:shadow-md transition-all"
                >
                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        'font-medium',
                        essay.type === 'WHY_SCHOOL' &&
                          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                        essay.type === 'SUPPLEMENTAL' &&
                          'bg-primary/10 text-primary border-violet-500/20',
                        essay.type === 'SHORT_ANSWER' &&
                          'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
                        essay.type === 'ACTIVITY' &&
                          'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      )}
                    >
                      {essay.type || 'SUPPLEMENTAL'}
                    </Badge>
                    {essay.isRequired !== false ? (
                      <Badge
                        variant="default"
                        className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                      >
                        {t('school.essays.requiredTag')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t('school.essays.optionalTag')}</Badge>
                    )}
                    {essay.wordLimit && (
                      <Badge variant="outline" className="gap-1">
                        <span className="font-mono">{essay.wordLimit}</span>{' '}
                        {t('school.essays.words')}
                      </Badge>
                    )}
                    {essay.changeType === 'NEW' && (
                      <Badge
                        variant="outline"
                        className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      >
                        {t('school.essays.newTag')}
                      </Badge>
                    )}
                    {essay.changeType === 'MODIFIED' && (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      >
                        {t('school.essays.modifiedTag')}
                      </Badge>
                    )}
                  </div>

                  {/* English prompt */}
                  <p className="text-sm leading-relaxed text-foreground mb-3">{essay.prompt}</p>

                  {/* Chinese translation */}
                  {essay.promptZh && (
                    <div className="bg-muted/50 rounded-lg p-3 mb-3">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {essay.promptZh}
                      </p>
                    </div>
                  )}

                  {/* AI writing tips */}
                  {essay.aiTips && (
                    <div className="bg-warning/10 rounded-lg p-3 border border-amber-500/20">
                      <div className="flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                            {t('school.essays.aiTips')}
                          </p>
                          <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
                            {essay.aiTips}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Category tag */}
                  {essay.aiCategory && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t('school.essays.category')}:
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {essay.aiCategory}
                      </Badge>
                    </div>
                  )}

                  {/* Start Writing CTA — only for DB verified prompts (string id) */}
                  {typeof essay.id === 'string' && (
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5" asChild>
                      <Link href={`/essays?schoolId=${school.id}&promptId=${essay.id}`}>
                        <PenLine className="h-3.5 w-3.5" />
                        {t('school.essays.startWriting')}
                      </Link>
                    </Button>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">{t('school.essays.noData')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('school.essays.updateHint')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
