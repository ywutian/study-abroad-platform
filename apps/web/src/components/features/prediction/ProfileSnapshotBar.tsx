'use client';

import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Award, BookOpenCheck, GraduationCap, SlidersHorizontal, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ProfileSnapshotBarProps {
  profile?: Record<string, unknown> | null;
  completeness?: number;
  hasProfileGaps: boolean;
  firstMissingLabel?: string;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function arrayCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function getTestScore(profile?: Record<string, unknown> | null) {
  if (!profile) return null;
  const sat = firstNumber(profile.sat, profile.satScore, profile.bestSatScore);
  if (sat) return { label: 'SAT', value: String(Math.round(sat)) };
  const act = firstNumber(profile.act, profile.actScore, profile.bestActScore);
  if (act) return { label: 'ACT', value: String(Math.round(act)) };

  const scores = Array.isArray(profile.testScores) ? profile.testScores : [];
  for (const rawScore of scores) {
    if (!rawScore || typeof rawScore !== 'object') continue;
    const score = rawScore as Record<string, unknown>;
    const type = String(score.type ?? score.testType ?? '').toUpperCase();
    const value = firstNumber(score.score, score.totalScore, score.compositeScore);
    if (type && value) return { label: type, value: String(Math.round(value)) };
  }

  if (profile.applyingTestOptional) {
    return { label: 'Test', value: 'Optional' };
  }
  return null;
}

function getLanguageScore(profile?: Record<string, unknown> | null) {
  if (!profile) return null;
  const toefl = firstNumber(profile.toefl, profile.toeflScore);
  if (toefl) return { label: 'TOEFL', value: String(Math.round(toefl)) };
  const ielts = firstNumber(profile.ielts, profile.ieltsScore);
  if (ielts) return { label: 'IELTS', value: ielts.toFixed(1).replace(/\.0$/, '') };

  const scores = Array.isArray(profile.languageScores) ? profile.languageScores : [];
  for (const rawScore of scores) {
    if (!rawScore || typeof rawScore !== 'object') continue;
    const score = rawScore as Record<string, unknown>;
    const type = String(score.type ?? score.testType ?? '').toUpperCase();
    const value = firstNumber(score.score, score.totalScore);
    if (type && value) return { label: type, value: String(value) };
  }
  return null;
}

export function ProfileSnapshotBar({
  profile,
  completeness,
  hasProfileGaps,
  firstMissingLabel,
}: ProfileSnapshotBarProps) {
  const t = useTranslations('prediction.profileSnapshot');
  const gpa = firstNumber(profile?.gpa, profile?.unweightedGpa, profile?.weightedGpa);
  const testScore = getTestScore(profile);
  const languageScore = getLanguageScore(profile);
  const activityCount = arrayCount(profile?.activities);
  const awardCount = arrayCount(profile?.awards);
  const advancedSignalCount =
    arrayCount(profile?.advancedCourses) +
    arrayCount(profile?.researchExperiences) +
    arrayCount(profile?.competitions);

  const statusTone: 'ready' | 'usable' | 'missing' = !hasProfileGaps
    ? 'ready'
    : completeness != null && completeness >= 60
      ? 'usable'
      : 'missing';
  const statusLabel =
    statusTone === 'ready'
      ? t('ready')
      : firstMissingLabel
        ? t('missing', { item: firstMissingLabel })
        : t('usable');

  const items = [
    {
      icon: GraduationCap,
      label: t('gpa'),
      value: gpa == null ? t('empty') : gpa.toFixed(2).replace(/\.00$/, ''),
      detail: gpa == null ? t('addGpa') : t('academicBase'),
      missing: gpa == null,
    },
    {
      icon: BookOpenCheck,
      label: testScore?.label ?? t('tests'),
      value: testScore?.value ?? t('empty'),
      detail: testScore ? t('testBase') : t('addTests'),
      missing: !testScore,
    },
    {
      icon: Award,
      label: languageScore?.label ?? t('language'),
      value: languageScore?.value ?? t('optional'),
      detail: languageScore ? t('languageBase') : t('languageOptional'),
      missing: false,
    },
    {
      icon: Trophy,
      label: t('signals'),
      value: t('signalsValue', {
        activities: activityCount,
        awards: awardCount,
        advanced: advancedSignalCount,
      }),
      detail:
        activityCount + awardCount + advancedSignalCount > 0 ? t('signalsBase') : t('addSignals'),
      missing: activityCount + awardCount + advancedSignalCount === 0,
    },
  ];

  return (
    <section className="mb-4 rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-card-bg)] px-4 py-3 shadow-[var(--theme-card-shadow)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{t('title')}</p>
            <Badge
              variant={
                statusTone === 'ready'
                  ? 'success'
                  : statusTone === 'usable'
                    ? 'warning'
                    : 'secondary'
              }
            >
              {statusLabel}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-2">
          <Link href="/profile">
            <SlidersHorizontal className="h-4 w-4" />
            {t('adjust')}
          </Link>
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={cn(
                'rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] px-3 py-2',
                item.missing && 'border-warning/25 bg-warning/5'
              )}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className={cn('h-4 w-4', item.missing ? 'text-warning' : 'text-primary')} />
                <span>{item.label}</span>
              </div>
              <p className="mt-1 text-lg font-semibold text-metric">{item.value}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{item.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
