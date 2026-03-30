'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, getSchoolName, getSchoolSubName } from '@/lib/utils';
import { isSafeUrl } from '@/lib/utils/url';
import { Badge } from '@/components/ui/badge';
import {
  Target,
  Plus,
  Trash2,
  Globe,
  FileText,
  PenLine,
  Filter,
  ChevronDown,
  Loader2,
  Info,
  Calendar,
  DollarSign,
  Users,
  ExternalLink,
  Mic,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useRouter } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { essayPromptRoutes } from '@study-abroad/shared';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { getDisplayRankings, RANKING_LIST_KEYS } from '@/lib/utils/ranking';
import type { TargetSchool } from './types';
import { FinancialAidComparison } from './financial-aid-comparison';

interface EssayPrompt {
  id: string;
  schoolId: string;
  type: string;
  prompt: string;
  promptZh?: string;
  wordLimit?: number;
  isRequired?: boolean;
  year?: number;
}

const ESSAY_TYPE_STYLES: Record<string, string> = {
  PERSONAL_STATEMENT: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  WHY_SCHOOL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  SUPPLEMENTAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  SHORT_ANSWER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  ACTIVITY: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  OPTIONAL: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  OTHER: 'bg-muted text-muted-foreground',
};

const INTERVIEW_FORMAT_STYLES: Record<string, string> = {
  ALUMNI: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  ADMISSIONS_OFFICER: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  INITIALVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  VERICANT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  KIRA: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  GROUP: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  OPTIONAL: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  NOT_OFFERED: 'bg-muted text-muted-foreground',
};

const ROUNDS = ['ED', 'ED2', 'EA', 'REA', 'SCEA', 'RD', 'ROLLING'] as const;
const COMMON_ROUNDS = ['ED', 'EA', 'RD', 'ROLLING'] as const;

const BINDING_ROUNDS = ['ED', 'ED2', 'REA', 'SCEA'];
const EARLY_DECISION_GROUP = ['ED', 'ED2'];
const RESTRICTIVE_EA_GROUP = ['REA', 'SCEA'];

/** Get available rounds for a school from its deadline data, fallback to common rounds */
function getSchoolAvailableRounds(school: TargetSchool): {
  rounds: string[];
  hasDeadlineData: boolean;
} {
  if (school.deadlines && school.deadlines.length > 0) {
    return { rounds: [...new Set(school.deadlines.map((d) => d.round))], hasDeadlineData: true };
  }
  return { rounds: [...COMMON_ROUNDS], hasDeadlineData: false };
}

/** Check binding round conflict, return conflicting school name or null */
function getBindingConflict(
  schools: TargetSchool[],
  round: string,
  excludeSchoolId: string,
  locale: string
): string | null {
  if (!BINDING_ROUNDS.includes(round)) return null;

  // Same binding round conflict
  const sameRound = schools.find((s) => s.id !== excludeSchoolId && s.round === round);
  if (sameRound) return getSchoolName(sameRound, locale);

  // ED/ED2 ↔ REA/SCEA cross-group conflict
  const crossGroup = EARLY_DECISION_GROUP.includes(round)
    ? RESTRICTIVE_EA_GROUP
    : RESTRICTIVE_EA_GROUP.includes(round)
      ? EARLY_DECISION_GROUP
      : [];
  const crossConflict = schools.find(
    (s) => s.id !== excludeSchoolId && crossGroup.includes(s.round || '')
  );
  if (crossConflict) return getSchoolName(crossConflict, locale);

  return null;
}

/** Lazy-loaded essay prompts section for expanded school card */
function SchoolEssayPrompts({ schoolId }: { schoolId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const { data: prompts, isLoading } = useQuery<EssayPrompt[]>({
    queryKey: ['essay-prompts-by-school', schoolId],
    queryFn: () => apiClient.get(essayPromptRoutes.bySchool(schoolId)),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-muted-foreground">{t('common.loading')}</span>
      </div>
    );
  }

  if (!prompts?.length) {
    return (
      <p className="text-muted-foreground py-1">{t('profile.schoolSelection.noEssayPrompts')}</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {prompts.map((prompt) => (
        <div key={prompt.id} className="flex items-start gap-2 rounded-lg bg-muted/50 px-2.5 py-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                  ESSAY_TYPE_STYLES[prompt.type] || ESSAY_TYPE_STYLES.OTHER
                )}
              >
                {t(`profile.schoolSelection.essayType.${prompt.type}`, {
                  defaultValue: prompt.type,
                })}
              </span>
              {prompt.wordLimit && (
                <span className="text-[10px] text-muted-foreground">
                  {prompt.wordLimit} {t('profile.schoolSelection.words')}
                </span>
              )}
              {prompt.isRequired === false && (
                <span className="text-[10px] text-muted-foreground italic">
                  {t('profile.schoolSelection.optional')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
              {locale === 'zh' && prompt.promptZh ? prompt.promptZh : prompt.prompt}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 text-primary gap-1 px-1.5"
            onClick={() => router.push(`/essays?schoolId=${schoolId}&promptId=${prompt.id}`)}
          >
            <PenLine className="h-3 w-3" />
            <span className="text-xs">{t('profile.schoolSelection.writeEssay')}</span>
          </Button>
        </div>
      ))}
    </div>
  );
}

interface SchoolSelectionTabProps {
  targetSchools: TargetSchool[];
  defaultRound: string;
  onDefaultRoundChange: (round: string) => void;
  onOpenSchoolSelector: () => void;
  onRemoveSchool: (listItemId: string) => void;
  onUpdateRound: (listItemId: string, round: string) => void;
}

export function SchoolSelectionTab({
  targetSchools,
  defaultRound,
  onDefaultRoundChange,
  onOpenSchoolSelector,
  onRemoveSchool,
  onUpdateRound,
}: SchoolSelectionTabProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [roundFilter, setRoundFilter] = useState<string>('ALL');
  const [expandedSchoolId, setExpandedSchoolId] = useState<string | null>(null);

  const roundCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: targetSchools.length };
    for (const r of ROUNDS) {
      counts[r] = targetSchools.filter((s) => s.round === r).length;
    }
    return counts;
  }, [targetSchools]);

  const filteredSchools = useMemo(() => {
    if (roundFilter === 'ALL') return targetSchools;
    return targetSchools.filter((s) => s.round === roundFilter);
  }, [targetSchools, roundFilter]);

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-destructive" />
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-destructive" />
            {t('profile.targetSchools')}
          </CardTitle>
          <CardDescription>{t('profile.targetSchoolsDesc')}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={defaultRound} onValueChange={onDefaultRoundChange}>
            <SelectTrigger className="h-9 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_ROUNDS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={onOpenSchoolSelector} className="gap-2 bg-destructive hover:opacity-90">
            <Plus className="h-4 w-4" />
            {t('profile.actions.addSchool')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {targetSchools.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-1">
              <Filter className="h-3.5 w-3.5" />
              {t('profile.schoolSelection.roundFilter')}
            </div>
            <Select value={roundFilter} onValueChange={setRoundFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {t('profile.schoolSelection.allRounds')} ({roundCounts.ALL})
                </SelectItem>
                {ROUNDS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}{' '}
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 min-w-5 justify-center text-xs px-1.5"
                    >
                      {roundCounts[r]}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <FinancialAidComparison schools={targetSchools} />

        {filteredSchools.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredSchools.map((school, index) => (
              <motion.div
                key={school.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="group rounded-xl border p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive font-bold text-xs"
                      title={
                        getDisplayRankings(school.rankings).length > 0
                          ? `${getDisplayRankings(school.rankings)[0].source} ${RANKING_LIST_KEYS[getDisplayRankings(school.rankings)[0].list] || ''}`
                          : school.usNewsRank
                            ? 'US News'
                            : undefined
                      }
                    >
                      {getDisplayRankings(school.rankings).length > 0
                        ? `#${getDisplayRankings(school.rankings)[0].rank}`
                        : school.usNewsRank
                          ? `#${school.usNewsRank}`
                          : getSchoolName(school, locale).charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{getSchoolName(school, locale)}</p>
                        {isSafeUrl(school.website) && (
                          <a
                            href={school.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t('schoolSelector.visitWebsite', {
                              school: getSchoolName(school, locale),
                            })}
                            title={t('recommendation.visitWebsite')}
                            className="text-muted-foreground hover:text-primary shrink-0 p-1 -m-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <Globe className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {school.prediction && (
                          <span
                            className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', {
                              'bg-success/10 text-success': school.prediction.tier === 'safety',
                              'bg-primary/10 text-primary': school.prediction.tier === 'match',
                              'bg-destructive/10 text-destructive':
                                school.prediction.tier === 'reach',
                              'bg-muted text-muted-foreground': !school.prediction.tier,
                            })}
                          >
                            {Math.round(school.prediction.probability * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        {getSchoolSubName(school, locale) && (
                          <span className="text-sm text-muted-foreground truncate">
                            {getSchoolSubName(school, locale)}
                          </span>
                        )}
                        {(school.essayPromptCount ?? 0) > 0 && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <FileText className="h-3 w-3" />
                            {school.essayPromptCount}
                          </Badge>
                        )}
                        <RankingBadge
                          rankings={school.rankings}
                          usNewsRank={school.usNewsRank}
                          maxBadges={2}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(() => {
                      const availableRounds = getSchoolAvailableRounds(school);
                      return (
                        <>
                          <Select
                            value={school.round || 'RD'}
                            onValueChange={(newRound) => {
                              const conflict = getBindingConflict(
                                targetSchools,
                                newRound,
                                school.id,
                                locale
                              );
                              if (conflict) {
                                toast.error(
                                  t('profile.schoolSelection.bindingConflict', {
                                    round: newRound,
                                    school: conflict,
                                  })
                                );
                                return;
                              }
                              if (school._listItemId) {
                                onUpdateRound(school._listItemId, newRound);
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 w-[72px] text-xs font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableRounds.rounds.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!availableRounds.hasDeadlineData && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info
                                    className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0 cursor-help"
                                    aria-label={t('profile.schoolSelection.roundsNoDeadlineData')}
                                    role="img"
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs max-w-[200px]">
                                    {t('profile.schoolSelection.roundsNoDeadlineData')}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </>
                      );
                    })()}
                    {(school.essayPromptCount ?? 0) > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-primary gap-1 px-2"
                        onClick={() => router.push(`/essays?schoolId=${school.id}`)}
                      >
                        <PenLine className="h-3.5 w-3.5" />
                        <span className="text-xs">{t('profile.schoolSelection.writeEssay')}</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        if (school._listItemId) {
                          onRemoveSchool(school._listItemId);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setExpandedSchoolId(expandedSchoolId === school.id ? null : school.id)
                      }
                    >
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          expandedSchoolId === school.id && 'rotate-180'
                        )}
                      />
                    </Button>
                  </div>
                </div>

                {/* Expandable details: DDL, Interview, Financial Aid */}
                <AnimatePresence>
                  {expandedSchoolId === school.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t space-y-2 text-xs">
                        {/* Deadlines */}
                        {school.deadlines && school.deadlines.length > 0 && (
                          <div className="space-y-1">
                            <p className="font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {t('profile.schoolSelection.deadlines')}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {school.deadlines.map((dl) => {
                                const deadline = new Date(dl.applicationDeadline);
                                const daysUntil = Math.ceil(
                                  (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                                );
                                const isUrgent = daysUntil > 0 && daysUntil <= 30;
                                const isPast = daysUntil < 0;
                                const isSelected = school.round === dl.round;
                                return (
                                  <Badge
                                    key={dl.round}
                                    variant={isSelected ? 'default' : 'outline'}
                                    className={cn(
                                      'text-xs',
                                      isUrgent && !isPast && 'border-destructive text-destructive',
                                      isPast && 'opacity-50 line-through'
                                    )}
                                  >
                                    {dl.round}:{' '}
                                    {deadline.toLocaleDateString(
                                      locale === 'zh' ? 'zh-CN' : 'en-US',
                                      {
                                        month: 'short',
                                        day: 'numeric',
                                      }
                                    )}
                                    {dl.interviewRequired && (
                                      <Mic
                                        className="ml-0.5 inline h-3 w-3"
                                        aria-label={t('profile.schoolSelection.interviewRequired')}
                                      />
                                    )}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Interview info */}
                        {school.deadlines?.some((dl) => dl.interviewRequired) && (
                          <div className="space-y-1">
                            <p className="font-medium flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {t('profile.schoolSelection.interview')}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {school.deadlines
                                .filter((dl) => dl.interviewRequired)
                                .map((dl) => {
                                  const format = dl.interviewFormat || null;
                                  return (
                                    <TooltipProvider key={dl.round}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className={cn(
                                              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-help',
                                              format
                                                ? INTERVIEW_FORMAT_STYLES[format] ||
                                                    INTERVIEW_FORMAT_STYLES.ALUMNI
                                                : 'bg-muted text-muted-foreground'
                                            )}
                                          >
                                            <Mic className="h-2.5 w-2.5" />
                                            {format
                                              ? t(
                                                  `profile.schoolSelection.interviewFormat.${format}`,
                                                  { defaultValue: format }
                                                )
                                              : t('profile.schoolSelection.interviewRequired')}
                                            {dl.interviewDeadline && (
                                              <span className="opacity-70">
                                                {' · '}
                                                {new Date(dl.interviewDeadline).toLocaleDateString(
                                                  locale === 'zh' ? 'zh-CN' : 'en-US',
                                                  { month: 'short', day: 'numeric' }
                                                )}
                                              </span>
                                            )}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          <p className="text-xs">
                                            {format
                                              ? t(
                                                  `profile.schoolSelection.interviewTip.${format}`,
                                                  {
                                                    defaultValue: t(
                                                      'profile.schoolSelection.interviewRequired'
                                                    ),
                                                  }
                                                )
                                              : t('profile.schoolSelection.interviewRequired')}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {/* Financial Aid */}
                        {(school.averageAidPackage ||
                          school.averageNetPrice ||
                          school.percentNeedMet) && (
                          <div className="space-y-1">
                            <p className="font-medium flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {t('profile.schoolSelection.financialAid')}
                            </p>
                            <div className="flex flex-wrap gap-2 text-muted-foreground">
                              {school.needBlindInternational && (
                                <span className="text-success">
                                  {t('profile.schoolSelection.needBlind')} ✓
                                </span>
                              )}
                              {school.averageAidPackage && (
                                <span>
                                  {t('profile.schoolSelection.avgAid')}:{' '}
                                  {new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    maximumFractionDigits: 0,
                                  }).format(school.averageAidPackage)}
                                </span>
                              )}
                              {school.averageNetPrice && (
                                <span>
                                  {t('profile.schoolSelection.netPrice')}:{' '}
                                  {new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    maximumFractionDigits: 0,
                                  }).format(school.averageNetPrice)}
                                  /{t('profile.schoolSelection.perYear')}
                                </span>
                              )}
                              {school.percentNeedMet != null && (
                                <span>
                                  {t('profile.schoolSelection.needMet')}: {school.percentNeedMet}%
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Transfer rate */}
                        {school.transferAcceptanceRate != null && (
                          <p className="text-muted-foreground">
                            {t('schoolSelector.transferRate')}: {school.transferAcceptanceRate}%
                          </p>
                        )}

                        {/* Essay Prompts */}
                        <div className="space-y-1">
                          <p className="font-medium flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {t('profile.schoolSelection.essayRequirements')}
                          </p>
                          <SchoolEssayPrompts schoolId={school.id} />
                        </div>

                        {/* Data Sources */}
                        {(school.scorecardId || school.ipedsId) && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {school.scorecardId && (
                              <a
                                href={`https://collegescorecard.ed.gov/school/?${school.scorecardId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                College Scorecard
                              </a>
                            )}
                            {school.ipedsId && (
                              <a
                                href={`https://nces.ed.gov/ipeds/datacenter/institutionprofile.aspx?unitId=${school.ipedsId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                IPEDS
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        ) : targetSchools.length > 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-destructive/10">
              <Target className="h-8 w-8 text-destructive/50" />
            </div>
            <p className="font-medium">{t('profile.empty.noTargets')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('profile.empty.noTargetsHint')}</p>
          </div>
        )}

        <TooltipProvider>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            {t('profile.schoolSelection.dataDisclaimer')}
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="inline-flex ml-1 align-middle">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{t('schoolSelector.dataSourceInfo')}</p>
              </TooltipContent>
            </Tooltip>
          </p>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
