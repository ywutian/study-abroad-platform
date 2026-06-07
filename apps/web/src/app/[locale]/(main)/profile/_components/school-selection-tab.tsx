'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
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
  AlertTriangle,
  School,
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
  Lightbulb,
  MoreHorizontal,
  HelpCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useRouter } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { useAuthReady } from '@/hooks/use-auth-gated-query';
import { AgentType, essayPromptRoutes } from '@study-abroad/shared';
import { openFloatingAgentChat } from '@/components/features/agent-chat/floating-chat-bridge';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { getDisplayRankings, RANKING_LIST_KEYS } from '@/lib/utils/ranking';
import type { TargetSchool } from './types';
import { FinancialAidComparison } from './financial-aid-comparison';
import { SchoolExpandedDetails } from './school-selection/SchoolExpandedDetails';

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

const ROUNDS = ['ED', 'ED2', 'EA', 'REA', 'SCEA', 'RD', 'ROLLING'] as const;
const COMMON_ROUNDS = ['ED', 'EA', 'RD', 'ROLLING'] as const;
const ROUND_LEGEND_KEYS = ['ED', 'ED2', 'EA', 'REA', 'SCEA', 'RD', 'ROLLING'] as const;

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
  const authReady = useAuthReady();

  const { data: prompts, isLoading } = useQuery<EssayPrompt[]>({
    queryKey: ['essay-prompts-by-school', schoolId],
    queryFn: () => apiClient.get(essayPromptRoutes.bySchool(schoolId)),
    staleTime: 5 * 60 * 1000,
    enabled: authReady,
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
                  'inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-medium',
                  ESSAY_TYPE_STYLES[prompt.type] || ESSAY_TYPE_STYLES.OTHER
                )}
              >
                {t(`profile.schoolSelection.essayType.${prompt.type}`, {
                  defaultValue: prompt.type,
                })}
              </span>
              {prompt.wordLimit && (
                <span className="text-2xs text-muted-foreground">
                  {prompt.wordLimit} {t('profile.schoolSelection.words')}
                </span>
              )}
              {prompt.isRequired === false && (
                <span className="text-2xs italic text-muted-foreground">
                  {t('profile.schoolSelection.optional')}
                </span>
              )}
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
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
  const [roundLegendOpen, setRoundLegendOpen] = useState(false);

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
  const portfolioSummary = useMemo(() => {
    const tiers = targetSchools.reduce(
      (acc, school) => {
        const tier = school.prediction?.tier;
        if (tier === 'reach' || tier === 'match' || tier === 'safety') {
          acc[tier] += 1;
        } else {
          acc.unknown += 1;
        }
        return acc;
      },
      { reach: 0, match: 0, safety: 0, unknown: 0 }
    );
    const now = Date.now();
    const thirtyDays = now + 30 * 24 * 60 * 60 * 1000;
    const nextThirtyDayDeadlines = targetSchools.reduce((count, school) => {
      return (
        count +
        (school.deadlines ?? []).filter((deadline) => {
          const time = new Date(deadline.applicationDeadline).getTime();
          return Number.isFinite(time) && time >= now && time <= thirtyDays;
        }).length
      );
    }, 0);
    const bindingConflicts = targetSchools.filter(
      (school) =>
        school.round && getBindingConflict(targetSchools, school.round, school.id, locale) !== null
    ).length;
    const essayCount = targetSchools.reduce(
      (count, school) => count + (school.essayPromptCount ?? 0),
      0
    );
    return { tiers, bindingConflicts, nextThirtyDayDeadlines, essayCount };
  }, [targetSchools, locale]);

  const askAiForSchool = (school: TargetSchool) => {
    if (!school.prediction) return;
    openFloatingAgentChat({
      message: t('profile.schoolSelection.askAiPrompt', {
        schoolName: getSchoolName(school, locale),
        probability: Math.round(school.prediction.probability * 100),
      }),
      context: {
        type: 'selected-schools',
        source: 'profile_school_list',
        schools: [
          {
            id: school.id,
            name: school.name,
            nameZh: school.nameZh,
            usNewsRank: school.usNewsRank,
            acceptanceRate: school.acceptanceRate,
            prediction: {
              probability: school.prediction.probability,
              tier: school.prediction.tier as 'reach' | 'match' | 'safety' | undefined,
            },
          },
        ],
      },
      agentHint: AgentType.SCHOOL,
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-destructive" />
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5 text-destructive" />
            {t('profile.targetSchools')}
          </CardTitle>
          <CardDescription>{t('profile.targetSchoolsDesc')}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={defaultRound} onValueChange={onDefaultRoundChange}>
            <SelectTrigger
              className="h-10 w-28 text-xs sm:h-9 sm:w-24"
              aria-label={t('profile.schoolSelection.defaultRound')}
            >
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-muted-foreground sm:h-9 sm:w-9"
                  onClick={() => setRoundLegendOpen(true)}
                  aria-label={t('profile.schoolSelection.roundShowLegend')}
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{t('profile.schoolSelection.roundShowLegend')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button onClick={onOpenSchoolSelector} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('profile.actions.addSchool')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {targetSchools.length > 0 && (
          <div className="mb-4 grid gap-3 rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-control-bg)] p-4 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
            <div>
              <div className="text-sm font-semibold">
                {t('profile.schoolSelection.portfolioSummary')}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge
                  variant="outline"
                  className="border-destructive/30 bg-destructive/10 text-destructive"
                >
                  {t('dashboard.stats.reach')} {portfolioSummary.tiers.reach}
                </Badge>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {t('dashboard.stats.target')} {portfolioSummary.tiers.match}
                </Badge>
                <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                  {t('dashboard.stats.safety')} {portfolioSummary.tiers.safety}
                </Badge>
              </div>
            </div>
            <div className="rounded-[var(--theme-radius-button)] border bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('profile.schoolSelection.bindingConflicts')}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {portfolioSummary.bindingConflicts}
              </div>
            </div>
            <div className="rounded-[var(--theme-radius-button)] border bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {t('profile.schoolSelection.deadlines30Days')}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {portfolioSummary.nextThirtyDayDeadlines}
              </div>
            </div>
            <div className="rounded-[var(--theme-radius-button)] border bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                {t('profile.schoolSelection.essayCount')}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {portfolioSummary.essayCount}
              </div>
            </div>
          </div>
        )}

        {targetSchools.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-1">
              <Filter className="h-3.5 w-3.5" />
              {t('profile.schoolSelection.roundFilter')}
            </div>
            <Select value={roundFilter} onValueChange={setRoundFilter}>
              <SelectTrigger
                className="h-10 w-40 text-xs sm:h-8 sm:w-36"
                aria-label={t('profile.schoolSelection.roundFilter')}
              >
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
                key={school._listItemId ?? `${school.id}-${index}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="group rounded-xl border p-4 hover:shadow-md transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{getSchoolName(school, locale)}</p>
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
                            {t('school.prediction.personalEstimate')}{' '}
                            {Math.round(school.prediction.probability * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {getSchoolSubName(school, locale) && (
                          <span className="text-sm text-muted-foreground">
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
                  <div className="flex items-center gap-1.5 flex-wrap">
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
                            <SelectTrigger
                              className="h-10 w-20 text-xs font-medium sm:h-8 sm:w-[72px]"
                              aria-label={t('profile.schoolSelection.roundForSchool', {
                                school: getSchoolName(school, locale),
                              })}
                            >
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
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 shrink-0 text-warning hover:text-warning sm:h-8 sm:w-8"
                                    aria-label={t('profile.schoolSelection.roundsNoDeadlineData')}
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </Button>
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
                    {(school.essayPromptCount ?? 0) > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 gap-1 px-3 sm:h-8 sm:px-2"
                        onClick={() => router.push(`/essays?schoolId=${school.id}`)}
                      >
                        <PenLine className="h-3.5 w-3.5" />
                        <span className="text-xs">{t('profile.schoolSelection.writeEssay')}</span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 gap-1 px-3 sm:h-8 sm:px-2"
                        onClick={() =>
                          setExpandedSchoolId(expandedSchoolId === school.id ? null : school.id)
                        }
                      >
                        <Info className="h-3.5 w-3.5" />
                        <span className="text-xs">{t('profile.schoolSelection.viewDetails')}</span>
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 sm:h-8 sm:w-8"
                          aria-label={t('profile.schoolSelection.moreActions')}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {school.prediction && (
                          <DropdownMenuItem onClick={() => askAiForSchool(school)}>
                            <Lightbulb className="h-4 w-4" />
                            {t('profile.schoolSelection.askAi')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            setExpandedSchoolId(expandedSchoolId === school.id ? null : school.id)
                          }
                        >
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 transition-transform',
                              expandedSchoolId === school.id && 'rotate-180'
                            )}
                          />
                          {t('profile.schoolSelection.toggleDetails')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            if (school._listItemId) {
                              onRemoveSchool(school._listItemId);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('profile.actions.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <SchoolExpandedDetails
                  school={school}
                  isExpanded={expandedSchoolId === school.id}
                  essayPromptsSlot={<SchoolEssayPrompts schoolId={school.id} />}
                />
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
              <School className="h-8 w-8 text-destructive/50" />
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
                <button
                  className="inline-flex ml-1 align-middle"
                  aria-label={t('schoolSelector.dataSourceInfo')}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{t('schoolSelector.dataSourceInfo')}</p>
              </TooltipContent>
            </Tooltip>
          </p>
        </TooltipProvider>

        {/* Round legend — explains ED / ED2 / EA / REA / SCEA / RD / ROLLING */}
        <Dialog open={roundLegendOpen} onOpenChange={setRoundLegendOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('profile.schoolSelection.roundGlossaryTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {ROUND_LEGEND_KEYS.map((round) => (
                <div key={round} className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5 shrink-0 text-xs font-mono">
                    {round}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {t(`profile.schoolSelection.roundLegend.${round}`)}
                  </p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
