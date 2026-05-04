'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Award,
  CheckCircle2,
  Sparkles,
  Zap,
  GraduationCap,
  BarChart,
  TrendingUp,
  PenTool,
  ClipboardList,
  FileText,
  ListChecks,
  School,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { Link } from '@/lib/i18n/navigation';
import { VerificationStatusCard, PointsOverview, AIErrorBoundary } from '@/components/features';
import type { ProfileData } from './types';

const ProfileAIAnalysis = dynamic(
  () => import('@/components/features').then((m) => ({ default: m.ProfileAIAnalysis })),
  { ssr: false }
);

interface ProfileHeaderProps {
  completeness: number;
  profile: ProfileData | undefined;
  onOpenResumeExport: () => void;
  onSetActiveTab: (tab: string) => void;
}

export function ProfileHeader({
  completeness,
  profile,
  onOpenResumeExport: _onOpenResumeExport,
  onSetActiveTab,
}: ProfileHeaderProps) {
  const t = useTranslations();
  const readinessSignals = [
    {
      id: 'gpa',
      label: t('profile.gpa'),
      impact: t('profile.readiness.highImpact'),
      complete: Boolean(profile?.gpa || profile?.semesterGpas?.length),
      tab: 'gpa',
      icon: GraduationCap,
    },
    {
      id: 'scores',
      label: t('profile.testScores'),
      impact: t('profile.readiness.highImpact'),
      complete: (profile?.testScores?.length ?? 0) > 0,
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
      icon: Sparkles,
    },
  ];
  const completedSignals = readinessSignals.filter((item) => item.complete).length;
  const recommendedFixes = readinessSignals.filter((item) => !item.complete).slice(0, 3);
  const primaryActions = [
    {
      type: 'tab' as const,
      value: recommendedFixes[0]?.tab ?? 'targets',
      icon: recommendedFixes[0]?.icon ?? School,
      label: recommendedFixes[0]
        ? t('profile.readiness.fixSignal', { signal: recommendedFixes[0].label })
        : t('profile.readiness.reviewTargets'),
    },
    {
      type: 'link' as const,
      value: '/prediction',
      icon: TrendingUp,
      label: t('profile.nextSteps.prediction'),
    },
    {
      type: 'link' as const,
      value: '/essays',
      icon: PenTool,
      label: t('profile.nextSteps.essays'),
    },
  ];

  return (
    <div className="mb-8">
      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{t('profile.readiness.title')}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {completedSignals}/{readinessSignals.length} {t('profile.readiness.signals')}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-3xl font-semibold tabular-nums">{completeness}%</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {completeness < 100
                        ? t('profile.completenessHint')
                        : t('profile.completenessComplete')}
                    </p>
                  </div>
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <Progress value={completeness} className="mt-4 h-2" />
              </div>
              <div className="grid min-w-[260px] gap-2">
                {readinessSignals.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSetActiveTab(item.tab)}
                      className="flex min-h-10 items-center justify-between gap-3 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] px-3 py-2 text-left transition hover:border-primary/40"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">{item.label}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {item.impact}
                        </span>
                        {item.complete ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-warning" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid h-full gap-4 p-5">
            <div>
              <h3 className="text-sm font-semibold">{t('profile.readiness.recommendedFixes')}</h3>
              <div className="mt-3 grid gap-2">
                {recommendedFixes.length > 0 ? (
                  recommendedFixes.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSetActiveTab(item.tab)}
                        className="flex min-h-10 items-start gap-3 rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-control-bg)] p-3 text-left transition hover:border-primary/40"
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {t('profile.readiness.fixSignal', { signal: item.label })}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                            {item.impact}
                          </span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[var(--theme-radius-card)] border bg-success/10 p-3 text-sm text-success">
                    {t('profile.readiness.allSet')}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">{t('profile.readiness.primaryActions')}</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                {primaryActions.map((item) => {
                  const Icon = item.icon;
                  const content = (
                    <>
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{item.label}</span>
                    </>
                  );
                  return item.type === 'link' ? (
                    <Button key={item.value} asChild variant="outline" className="justify-start">
                      <Link href={item.value}>{content}</Link>
                    </Button>
                  ) : (
                    <Button
                      key={item.value}
                      type="button"
                      variant="outline"
                      className="justify-start"
                      onClick={() => onSetActiveTab(item.value)}
                    >
                      {content}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Analysis */}
      {completeness >= 30 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-6"
        >
          <AIErrorBoundary feature="profile-analysis">
            <ProfileAIAnalysis compact />
          </AIErrorBoundary>
        </motion.div>
      )}

      {/* Secondary workflow shortcuts */}
      {completeness >= 30 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6"
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
      )}

      {/* Points & Verification cards */}
      {profile && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <PointsOverview compact />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <VerificationStatusCard userId={profile.userId} compact />
          </motion.div>
        </div>
      )}

      {/* Quick Start prompt for new users */}
      {completeness < 30 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <Card className="overflow-hidden border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg">
                  <Zap className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-primary">{t('profile.quickStart.title')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('profile.quickStart.description')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSetActiveTab('gpa')}
                    className="gap-1.5"
                  >
                    <GraduationCap className="h-4 w-4" />
                    {t('profile.quickStart.fillGpa')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onSetActiveTab('scores')}
                    className="gap-1.5 bg-primary hover:opacity-90"
                  >
                    <BarChart className="h-4 w-4" />
                    {t('profile.quickStart.fillScore')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
