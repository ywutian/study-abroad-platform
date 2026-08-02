'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import type {
  AIAnalysisResult,
  ProfileReadinessAction,
  ProfileReadinessItem,
  ProfileReadinessV1,
} from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  ArrowRight,
  Award,
  ClipboardCheck,
  Lightbulb,
  GraduationCap,
  BarChart,
  TrendingUp,
  PenTool,
  ClipboardList,
  FileText,
  ListChecks,
  School,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { VerificationStatusCard } from '@/components/features';
import type { ProfileData } from './types';

interface ProfileActionBarProps {
  completeness: number;
  profile: ProfileData | undefined;
  readiness?: ProfileReadinessV1;
  onOpenResumeExport: () => void;
  onSetActiveTab: (tab: string) => void;
}

type ReadinessSignal = {
  id: 'gpa' | 'scores' | 'activities' | 'awards' | 'major';
  label: string;
  impact: string;
  complete: boolean;
  tab: string;
  icon: LucideIcon;
};

function getReadinessSignals(
  t: ReturnType<typeof useTranslations>,
  profile: ProfileData | undefined
): ReadinessSignal[] {
  return [
    {
      id: 'gpa',
      label: t('profile.gpa'),
      impact: t('profile.readiness.highImpact'),
      complete: Boolean(
        profile?.gpa ||
        profile?.semesterGpas?.length ||
        profile?.gpa9 ||
        profile?.gpa10 ||
        profile?.gpa11 ||
        profile?.gpa12
      ),
      tab: 'gpa',
      icon: GraduationCap,
    },
    {
      id: 'scores',
      label: t('profile.testScores'),
      impact: t('profile.readiness.highImpact'),
      complete: Boolean(profile?.testScores?.length || profile?.applyingTestOptional),
      tab: 'scores',
      icon: BarChart,
    },
    {
      id: 'activities',
      label: t('profile.activities'),
      impact: t('profile.readiness.mediumImpact'),
      complete: (profile?.activities?.length ?? 0) > 0,
      tab: 'activities',
      icon: ListChecks,
    },
    {
      id: 'awards',
      label: t('profile.awards'),
      impact: t('profile.readiness.mediumImpact'),
      complete: (profile?.awards?.length ?? 0) > 0,
      tab: 'awards',
      icon: Award,
    },
    {
      id: 'major',
      label: t('profile.fields.targetMajor'),
      impact: t('profile.readiness.recommendationImpact'),
      complete: Boolean(profile?.targetMajor || profile?.intendedMajor),
      tab: 'basic',
      icon: Lightbulb,
    },
  ];
}

export function ProfileActionBar({
  completeness,
  profile,
  readiness,
  onOpenResumeExport,
  onSetActiveTab,
}: ProfileActionBarProps) {
  const t = useTranslations();
  const readinessSignals = getReadinessSignals(t, profile);
  const nextMissing = readinessSignals.find((item) => !item.complete);
  const starterActions = readinessSignals
    .filter((item) => ['gpa', 'scores', 'activities'].includes(item.id) && !item.complete)
    .slice(0, 2);
  const effectiveReadiness =
    readiness?.overall && readiness.workflowReadiness ? readiness : undefined;
  const overallReadiness = effectiveReadiness?.overall;
  const summary = overallReadiness?.blockers?.length
    ? t('profile.readiness.commandSummaryBlocked', {
        count: overallReadiness.blockers.length,
      })
    : overallReadiness?.warnings?.length
      ? t('profile.readiness.commandSummaryAttention', {
          count: overallReadiness.warnings.length,
        })
      : completeness >= 60
        ? t('profile.actionBar.readyForAnalysis')
        : nextMissing
          ? t('profile.actionBar.nextStep', { signal: nextMissing.label })
          : t('profile.readiness.allSet');
  const PrimaryIcon = nextMissing?.icon ?? ClipboardCheck;
  const score = overallReadiness?.score ?? completeness;
  const primaryAction = overallReadiness?.nextActions?.[0];

  return (
    <Card className="mb-5 overflow-hidden border-primary/20 bg-primary/5">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--theme-radius-card)] bg-primary text-primary-foreground shadow-sm">
              <PrimaryIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t('profile.readiness.title')}</Badge>
                <span className="text-xl font-semibold tabular-nums">{score}%</span>
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{summary}</p>
              <Progress value={score} className="mt-2 h-1.5 max-w-md" />
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {primaryAction && (
              <ReadinessActionButton
                action={primaryAction}
                onSetActiveTab={onSetActiveTab}
                primary
              />
            )}

            {overallReadiness?.nextActions?.slice(1, 3).map((action) => (
              <ReadinessActionButton
                key={action.key}
                action={action}
                onSetActiveTab={onSetActiveTab}
              />
            ))}

            {!effectiveReadiness && (
              <>
                {completeness < 30 &&
                  starterActions.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.id}
                        type="button"
                        size="sm"
                        variant={index === 0 ? 'default' : 'outline'}
                        onClick={() => onSetActiveTab(item.tab)}
                        className="gap-1.5"
                      >
                        <Icon className="h-4 w-4" />
                        {t('profile.actionBar.completeSignal', { signal: item.label })}
                      </Button>
                    );
                  })}

                {completeness < 30 && starterActions.length === 0 && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onSetActiveTab(nextMissing?.tab ?? 'targets')}
                    className="gap-1.5"
                  >
                    <School className="h-4 w-4" />
                    {t('profile.readiness.reviewTargets')}
                  </Button>
                )}

                {completeness >= 30 && completeness < 60 && (
                  <>
                    {nextMissing && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onSetActiveTab(nextMissing.tab)}
                        className="gap-1.5"
                      >
                        <nextMissing.icon className="h-4 w-4" />
                        {t('profile.actionBar.completeSignal', { signal: nextMissing.label })}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onSetActiveTab('targets')}
                      className="gap-1.5"
                    >
                      <School className="h-4 w-4" />
                      {t('profile.readiness.reviewTargets')}
                    </Button>
                  </>
                )}
              </>
            )}

            {!effectiveReadiness && completeness >= 60 && (
              <>
                <Button asChild size="sm" className="gap-1.5">
                  <Link href="/uncommon-app">
                    <ClipboardCheck className="h-4 w-4" />
                    {t('profile.nextSteps.applicationHub')}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link href="/prediction">
                    <TrendingUp className="h-4 w-4" />
                    {t('profile.nextSteps.prediction')}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenResumeExport}
                  className="gap-1.5"
                >
                  <FileText className="h-4 w-4" />
                  {t('profile.exportResume')}
                </Button>
              </>
            )}
          </div>
        </div>

        {effectiveReadiness && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {effectiveReadiness.workflowReadiness.items.slice(0, 4).map((item) => (
              <ReadinessStatusEntry key={item.key} item={item} onSetActiveTab={onSetActiveTab} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReadinessStatusEntry({
  item,
  onSetActiveTab,
}: {
  item: ProfileReadinessItem;
  onSetActiveTab: (tab: string) => void;
}) {
  const t = useTranslations();
  const className =
    'block min-h-16 rounded-[var(--theme-radius-card)] border bg-background/70 p-3 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t(item.labelKey)}</span>
        <Badge variant={item.status === 'ready' ? 'secondary' : 'outline'} className="text-2xs">
          {item.score}%
        </Badge>
      </div>
      <p className="mt-1 text-sm font-semibold">{t(`profile.readiness.status.${item.status}`)}</p>
    </>
  );

  if (item.targetTab) {
    return (
      <button type="button" onClick={() => onSetActiveTab(item.targetTab!)} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  );
}

function ReadinessActionButton({
  action,
  onSetActiveTab,
  primary = false,
}: {
  action: ProfileReadinessAction;
  onSetActiveTab: (tab: string) => void;
  primary?: boolean;
}) {
  const t = useTranslations();
  const content = (
    <>
      <ArrowRight className="h-4 w-4" />
      {t(action.labelKey)}
    </>
  );

  if (action.targetTab) {
    return (
      <Button
        type="button"
        size="sm"
        variant={primary ? 'default' : 'outline'}
        onClick={() => onSetActiveTab(action.targetTab!)}
        className="gap-1.5"
      >
        {content}
      </Button>
    );
  }

  return (
    <Button asChild size="sm" variant={primary ? 'default' : 'outline'} className="gap-1.5">
      <Link href={action.href}>{content}</Link>
    </Button>
  );
}

interface ProfileSecondaryWorkflowsProps {
  completeness: number;
  profile: ProfileData | undefined;
}

export function ProfileSecondaryWorkflows({
  completeness,
  profile,
}: ProfileSecondaryWorkflowsProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const cachedAnalysis =
    queryClient.getQueryData<AIAnalysisResult>(['profile-ai-analysis']) ?? null;

  if (completeness < 60) {
    return null;
  }

  return (
    <div className="mt-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <ApplicationStrategyEntryCard analysis={cachedAnalysis} />
      </motion.div>

      <div className="mt-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h3 className="text-sm font-semibold mb-3">{t('profile.nextSteps.title')}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { href: '/prediction', icon: TrendingUp, label: t('profile.nextSteps.prediction') },
              { href: '/essays', icon: PenTool, label: t('profile.nextSteps.essays') },
              {
                href: '/assessment',
                icon: ClipboardList,
                label: t('profile.nextSteps.assessment'),
              },
              { href: '/resume', icon: FileText, label: t('profile.nextSteps.resume') },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-3 transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>

      {profile && (
        <div className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <VerificationStatusCard userId={profile.userId} compact />
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ApplicationStrategyEntryCard({ analysis }: { analysis: AIAnalysisResult | null }) {
  const t = useTranslations();
  const nextActions = analysis?.nextActions?.length
    ? analysis.nextActions
    : (analysis?.actionPlan?.now ?? []);

  return (
    <Card className="border-primary/20">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--theme-radius-card)] bg-primary/10 text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">
                  {t('profile.applicationStrategy.title')}
                </h3>
                <Badge variant={analysis ? 'secondary' : 'outline'}>
                  {analysis
                    ? t(`applicationAnalysis.freshness.${analysis.status ?? 'fresh'}`)
                    : t('profile.applicationStrategy.manualBadge')}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {analysis?.overallVerdict ??
                  analysis?.portfolioSummary?.verdict ??
                  t('profile.applicationStrategy.description')}
              </p>
              {nextActions.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextActions.slice(0, 2).map((action, index) => (
                    <Badge key={`${action}-${index}`} variant="outline" className="max-w-full">
                      <span className="truncate">{action}</span>
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/uncommon-app">
              {t('profile.applicationStrategy.open')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
