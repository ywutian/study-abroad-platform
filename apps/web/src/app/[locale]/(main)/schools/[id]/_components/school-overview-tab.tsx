'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { SchoolFieldSource } from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar, ClipboardList, Globe2, GraduationCap, Shield, TrendingUp } from 'lucide-react';
import {
  getSchoolFieldSource,
  isOfficialFieldSource,
  isPublicFieldSource,
  isSupplementalFieldSource,
} from '@/components/features/schools/school-display-utils';
import { TrustBadge } from '@/components/features/schools/TrustBadge';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { SchoolCommunityRatingCard } from './school-community-rating-card';
import type { SchoolDetail } from './types';
import { getSourceUrl } from './source-utils';

interface SchoolOverviewTabProps {
  school: SchoolDetail;
}

function PercentBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

function StatRow({
  label,
  value,
  bar,
  source,
  sourceUrl,
}: {
  label: string;
  value: ReactNode;
  bar?: number;
  source?: SchoolFieldSource;
  sourceUrl?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 text-right">
        {bar != null && <PercentBar value={bar} />}
        <span className="font-semibold">{value}</span>
        {source && <TrustBadge source={source} sourceUrl={sourceUrl} />}
      </div>
    </div>
  );
}

function EmptyCardState({ message }: { message: string }) {
  return <p className="py-6 text-sm text-muted-foreground">{message}</p>;
}

type DeadlineKey = 'rea' | 'ea' | 'ed' | 'ed2' | 'rd';
type DeadlineMap = Partial<Record<DeadlineKey, string>>;
type DeadlineRow = {
  key: DeadlineKey;
  applicationDeadline: string;
  decisionDate?: string;
  financialAidDeadline?: string;
  applicationFee?: number | null;
};

const DEADLINE_KEYS: DeadlineKey[] = ['rea', 'ea', 'ed', 'ed2', 'rd'];

function normalizeDeadlineRound(round?: string | null): DeadlineKey | undefined {
  const normalized = round?.toLowerCase().replace(/[\s_-]/g, '');
  if (!normalized) return undefined;

  if (normalized === 'rea' || normalized === 'restrictiveearlyaction') return 'rea';
  if (normalized === 'ea' || normalized === 'earlyaction') return 'ea';
  if (normalized === 'ed' || normalized === 'earlydecision') return 'ed';
  if (normalized === 'ed2' || normalized === 'edii' || normalized === 'earlydecision2') {
    return 'ed2';
  }
  if (normalized === 'rd' || normalized === 'regular' || normalized === 'regulardecision') {
    return 'rd';
  }

  return undefined;
}

function formatDeadlineDate(value: string | null | undefined, locale: string): string | undefined {
  if (!value) return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function buildDeadlineMap(school: SchoolDetail, locale: string): DeadlineMap {
  const deadlines: DeadlineMap = {};
  const metadataDeadlines = school.metadata?.deadlines ?? {};

  for (const key of DEADLINE_KEYS) {
    const value = metadataDeadlines[key];
    if (typeof value === 'string' && value.trim()) {
      deadlines[key] = value.trim();
    }
  }

  for (const deadline of school.deadlines ?? []) {
    const key = normalizeDeadlineRound(deadline.round);
    const value = formatDeadlineDate(deadline.applicationDeadline, locale);
    if (key && value) {
      deadlines[key] = value;
    }
  }

  return deadlines;
}

function buildDeadlineRows(school: SchoolDetail, locale: string): DeadlineRow[] {
  const rows = new Map<DeadlineKey, DeadlineRow>();
  const metadataDeadlines = school.metadata?.deadlines ?? {};

  for (const key of DEADLINE_KEYS) {
    const value = metadataDeadlines[key];
    if (typeof value === 'string' && value.trim()) {
      rows.set(key, {
        key,
        applicationDeadline: value.trim(),
      });
    }
  }

  for (const deadline of school.deadlines ?? []) {
    const key = normalizeDeadlineRound(deadline.round);
    const applicationDeadline = formatDeadlineDate(deadline.applicationDeadline, locale);
    if (!key || !applicationDeadline) continue;

    rows.set(key, {
      key,
      applicationDeadline,
      decisionDate: formatDeadlineDate(deadline.decisionDate, locale),
      financialAidDeadline: formatDeadlineDate(deadline.financialAidDeadline, locale),
      applicationFee: deadline.applicationFee,
    });
  }

  return DEADLINE_KEYS.map((key) => rows.get(key)).filter(Boolean) as DeadlineRow[];
}

function getFieldSourceUrl(source: SchoolFieldSource | undefined, school: SchoolDetail) {
  if (!source) return null;
  return source.sourceUrl ?? getSourceUrl(source.source, school);
}

export function SchoolOverviewTab({ school }: SchoolOverviewTabProps) {
  const t = useTranslations();
  const tc = useTranslations('common');
  const testingPolicyT = useTranslations('applicationAnalysis.policy.testing');
  const locale = useLocale();

  const deadlines = buildDeadlineMap(school, locale);
  const deadlineRows = buildDeadlineRows(school, locale);

  const fmtCurrency = (value?: number | null) =>
    value != null ? `$${value.toLocaleString()}` : tc('notAvailable');

  const fmtPercent = (value?: number | null, digits = 1) =>
    value != null ? `${Number(value).toFixed(digits)}%` : tc('notAvailable');

  const fmtNumber = (value?: number | null) =>
    value != null ? value.toLocaleString() : tc('notAvailable');

  const verifiedAcademicRows = [
    isOfficialFieldSource(getSchoolFieldSource(school, 'satAvg', 'sat25', 'sat75')) && {
      label: t('school.satAvg'),
      value:
        school.sat25 && school.sat75
          ? `${school.sat25}-${school.sat75}${school.satAvg ? ` (avg ${school.satAvg})` : ''}`
          : school.satAvg || tc('notAvailable'),
      source: getSchoolFieldSource(school, 'satAvg', 'sat25', 'sat75'),
    },
    isOfficialFieldSource(getSchoolFieldSource(school, 'actAvg', 'act25', 'act75')) && {
      label: t('school.actAvg'),
      value:
        school.act25 && school.act75
          ? `${school.act25}-${school.act75}${school.actAvg ? ` (avg ${school.actAvg})` : ''}`
          : school.actAvg || tc('notAvailable'),
      source: getSchoolFieldSource(school, 'actAvg', 'act25', 'act75'),
    },
    isOfficialFieldSource(getSchoolFieldSource(school, 'graduationRate')) && {
      label: t('school.graduationRate'),
      value:
        school.graduationRate != null
          ? `${Number(school.graduationRate).toFixed(0)}%`
          : tc('notAvailable'),
      bar: school.graduationRate != null ? Number(school.graduationRate) : undefined,
      source: getSchoolFieldSource(school, 'graduationRate'),
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: ReactNode;
    bar?: number;
    source?: SchoolFieldSource;
  }>;

  const publishedSnapshotRows = [
    isPublicFieldSource(getSchoolFieldSource(school, 'acceptanceRate')) &&
    school.acceptanceRate != null
      ? {
          label: t('school.stats.acceptanceRate'),
          value: fmtPercent(school.acceptanceRate),
          source: getSchoolFieldSource(school, 'acceptanceRate'),
        }
      : null,
    isPublicFieldSource(getSchoolFieldSource(school, 'tuition')) && school.tuition != null
      ? {
          label: t('school.stats.tuition'),
          value: fmtCurrency(school.tuition),
          source: getSchoolFieldSource(school, 'tuition'),
        }
      : null,
    isPublicFieldSource(getSchoolFieldSource(school, 'studentCount', 'totalEnrollment')) &&
    (school.studentCount != null || school.totalEnrollment != null)
      ? {
          label: t('school.stats.studentCount'),
          value: fmtNumber(school.studentCount ?? school.totalEnrollment),
          source: getSchoolFieldSource(school, 'studentCount', 'totalEnrollment'),
        }
      : null,
    isPublicFieldSource(getSchoolFieldSource(school, 'graduationRate')) &&
    school.graduationRate != null
      ? {
          label: t('school.graduationRate'),
          value: fmtPercent(school.graduationRate, 0),
          bar: Number(school.graduationRate),
          source: getSchoolFieldSource(school, 'graduationRate'),
        }
      : null,
    isPublicFieldSource(getSchoolFieldSource(school, 'avgSalary')) && school.avgSalary != null
      ? {
          label: t('school.stats.avgSalary'),
          value: fmtCurrency(school.avgSalary),
          source: getSchoolFieldSource(school, 'avgSalary'),
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: ReactNode;
    bar?: number;
    source?: SchoolFieldSource;
  }>;

  const campusLifeRows = [
    isPublicFieldSource(getSchoolFieldSource(school, 'nicheOverallGrade')) &&
      school.nicheOverallGrade && {
        label: t('school.campusLife.overall'),
        value: school.nicheOverallGrade,
        source: getSchoolFieldSource(school, 'nicheOverallGrade'),
      },
    isPublicFieldSource(getSchoolFieldSource(school, 'nicheSafetyGrade')) &&
      school.nicheSafetyGrade && {
        label: t('school.campusLife.safety'),
        value: school.nicheSafetyGrade,
        source: getSchoolFieldSource(school, 'nicheSafetyGrade'),
      },
    isPublicFieldSource(getSchoolFieldSource(school, 'nicheLifeGrade')) &&
      school.nicheLifeGrade && {
        label: t('school.campusLife.life'),
        value: school.nicheLifeGrade,
        source: getSchoolFieldSource(school, 'nicheLifeGrade'),
      },
    isPublicFieldSource(getSchoolFieldSource(school, 'nicheFoodGrade')) &&
      school.nicheFoodGrade && {
        label: t('school.campusLife.food'),
        value: school.nicheFoodGrade,
        source: getSchoolFieldSource(school, 'nicheFoodGrade'),
      },
    isPublicFieldSource(getSchoolFieldSource(school, 'roomAndBoard')) && school.roomAndBoard != null
      ? {
          label: t('school.financialAid.roomAndBoard'),
          value: fmtCurrency(school.roomAndBoard),
          source: getSchoolFieldSource(school, 'roomAndBoard'),
        }
      : null,
    isPublicFieldSource(getSchoolFieldSource(school, 'studentOrgsCount')) &&
    school.studentOrgsCount != null
      ? {
          label: t('school.campusLife.studentOrgs'),
          value: school.studentOrgsCount.toLocaleString(),
          source: getSchoolFieldSource(school, 'studentOrgsCount'),
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: ReactNode;
    source: SchoolFieldSource;
  }>;

  const supplementalMetricRows = [
    isSupplementalFieldSource(getSchoolFieldSource(school, 'retentionRate')) &&
    school.retentionRate != null
      ? {
          label: t('school.retentionRate'),
          value: `${Number(school.retentionRate).toFixed(0)}%`,
          bar: Number(school.retentionRate),
          source: getSchoolFieldSource(school, 'retentionRate'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'studentFacultyRatio')) &&
    school.studentFacultyRatio != null
      ? {
          label: t('school.studentFacultyRatio'),
          value: `${school.studentFacultyRatio}:1`,
          source: getSchoolFieldSource(school, 'studentFacultyRatio'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'averageNetPrice')) &&
    school.averageNetPrice != null
      ? {
          label: t('school.financialAid.netPrice'),
          value: fmtCurrency(school.averageNetPrice),
          source: getSchoolFieldSource(school, 'averageNetPrice'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'averageAidPackage')) &&
    school.averageAidPackage != null
      ? {
          label: t('school.financialAid.aidPackage'),
          value: fmtCurrency(school.averageAidPackage),
          source: getSchoolFieldSource(school, 'averageAidPackage'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'percentNeedMet')) &&
    school.percentNeedMet != null
      ? {
          label: t('school.financialAid.needMet'),
          value: `${Number(school.percentNeedMet).toFixed(0)}%`,
          bar: Number(school.percentNeedMet),
          source: getSchoolFieldSource(school, 'percentNeedMet'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'applicationFee')) &&
    school.applicationFee != null
      ? {
          label: t('school.financialAid.applicationFee'),
          value: fmtCurrency(school.applicationFee),
          source: getSchoolFieldSource(school, 'applicationFee'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'intlStudentPct')) &&
    school.intlStudentPct != null
      ? {
          label: t('school.international.studentPct'),
          value: `${Number(school.intlStudentPct).toFixed(1)}%`,
          bar: Number(school.intlStudentPct),
          source: getSchoolFieldSource(school, 'intlStudentPct'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'intlAcceptanceRate')) &&
    school.intlAcceptanceRate != null
      ? {
          label: t('school.international.acceptanceRate'),
          value: `${Number(school.intlAcceptanceRate).toFixed(1)}%`,
          bar: Number(school.intlAcceptanceRate),
          source: getSchoolFieldSource(school, 'intlAcceptanceRate'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'countriesRepresented')) &&
    school.countriesRepresented != null
      ? {
          label: t('school.international.countries'),
          value: school.countriesRepresented.toLocaleString(),
          source: getSchoolFieldSource(school, 'countriesRepresented'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'salary6YrPostGrad')) &&
    school.salary6YrPostGrad != null
      ? {
          label: t('school.postGrad.salary'),
          value: fmtCurrency(school.salary6YrPostGrad),
          source: getSchoolFieldSource(school, 'salary6YrPostGrad'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'loanDefaultRate')) &&
    school.loanDefaultRate != null
      ? {
          label: t('school.postGrad.loanDefault'),
          value: `${Number(school.loanDefaultRate).toFixed(1)}%`,
          bar: Number(school.loanDefaultRate),
          source: getSchoolFieldSource(school, 'loanDefaultRate'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'monthlyLoanPayment')) &&
    school.monthlyLoanPayment != null
      ? {
          label: t('school.postGrad.monthlyLoan'),
          value: fmtCurrency(school.monthlyLoanPayment),
          source: getSchoolFieldSource(school, 'monthlyLoanPayment'),
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: ReactNode;
    bar?: number;
    source: SchoolFieldSource;
  }>;

  const supplementalBadges = [
    isSupplementalFieldSource(getSchoolFieldSource(school, 'acceptsCommonApp')) &&
    school.acceptsCommonApp
      ? {
          label: t('school.applicationInfo.commonApp'),
          source: getSchoolFieldSource(school, 'acceptsCommonApp'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'acceptsCoalition')) &&
    school.acceptsCoalition
      ? {
          label: t('school.applicationInfo.coalition'),
          source: getSchoolFieldSource(school, 'acceptsCoalition'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'testingPolicy')) &&
    school.testingPolicy &&
    school.testingPolicy !== 'UNKNOWN'
      ? {
          label: testingPolicyT(school.testingPolicy as any),
          source: getSchoolFieldSource(school, 'testingPolicy'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'needBlindInternational')) &&
    school.needBlindInternational
      ? {
          label: t('school.applicationInfo.needBlind'),
          source: getSchoolFieldSource(school, 'needBlindInternational'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'hasEarlyDecision')) &&
    school.hasEarlyDecision
      ? {
          label: t('school.applicationInfo.earlyDecision'),
          source: getSchoolFieldSource(school, 'hasEarlyDecision'),
        }
      : null,
    isSupplementalFieldSource(getSchoolFieldSource(school, 'feeWaiverAvailable')) &&
    school.feeWaiverAvailable
      ? {
          label: t('school.financialAid.feeWaiver'),
          source: getSchoolFieldSource(school, 'feeWaiverAvailable'),
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; source?: SchoolFieldSource }>;

  const hasSupplementalSection =
    Boolean(school.usNewsRank || school.qsRank) ||
    supplementalMetricRows.length > 0 ||
    supplementalBadges.length > 0;
  const hasCampusLifeSection = campusLifeRows.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5" />
              {t('school.officialData.title')}
            </CardTitle>
            <CardDescription>{t('school.officialData.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {verifiedAcademicRows.length > 0 ? (
              verifiedAcademicRows.map((row, index) => (
                <div key={row.label}>
                  {index > 0 && <Separator className="mb-4" />}
                  <StatRow
                    label={row.label}
                    value={row.value}
                    bar={row.bar}
                    source={row.source}
                    sourceUrl={getFieldSourceUrl(row.source, school)}
                  />
                </div>
              ))
            ) : (
              <EmptyCardState message={t('school.officialData.empty')} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              {t('school.deadlines.title')}
            </CardTitle>
            <CardDescription>
              {school.metadata?.applicationCycle || '2025-2026'} {t('school.deadlines.cycle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deadlineRows.length > 0 ? (
              deadlineRows.map((deadline, index) => (
                <div key={deadline.key}>
                  {index > 0 && <Separator className="mb-4" />}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            deadline.key === 'rea'
                              ? 'destructive'
                              : deadline.key === 'ea'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {deadline.key === 'ed2' ? 'ED II' : deadline.key.toUpperCase()}
                        </Badge>
                        <span>{t(`school.deadlines.${deadline.key}`)}</span>
                      </div>
                      <span className="font-semibold">{deadline.applicationDeadline}</span>
                    </div>
                    {(deadline.decisionDate ||
                      deadline.financialAidDeadline ||
                      deadline.applicationFee != null) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pl-12 text-sm text-muted-foreground">
                        {deadline.decisionDate && (
                          <span>
                            {t('school.deadlines.decision')}: {deadline.decisionDate}
                          </span>
                        )}
                        {deadline.financialAidDeadline && (
                          <span>
                            {t('school.deadlines.financialAid')}: {deadline.financialAidDeadline}
                          </span>
                        )}
                        {deadline.applicationFee != null && (
                          <span>
                            {t('school.financialAid.applicationFee')}:{' '}
                            {fmtCurrency(deadline.applicationFee)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : Object.keys(deadlines).length === 0 ? (
              <EmptyCardState message={t('school.deadlines.noData')} />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {publishedSnapshotRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5" />
              {t('school.publishedSnapshot.title')}
            </CardTitle>
            <CardDescription>{t('school.publishedSnapshot.description')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publishedSnapshotRows.map((row) => (
              <div key={row.label} className="rounded-lg border bg-background/40 p-4">
                <StatRow
                  label={row.label}
                  value={row.value}
                  bar={row.bar}
                  source={row.source}
                  sourceUrl={getFieldSourceUrl(row.source, school)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasCampusLifeSection ? (
        <div className="grid items-start gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                {t('school.campusLifeOfficial.title')}
              </CardTitle>
              <CardDescription>{t('school.campusLifeOfficial.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {campusLifeRows.map((row, index) => (
                <div key={row.label}>
                  {index > 0 && <Separator className="mb-4" />}
                  <StatRow
                    label={row.label}
                    value={row.value}
                    source={row.source}
                    sourceUrl={getFieldSourceUrl(row.source, school)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <SchoolCommunityRatingCard
            schoolId={school.id}
            summary={
              school.communityRatingSummary ?? {
                count: 0,
                safetyAvg: null,
                lifeAvg: null,
                foodAvg: null,
                isPublic: false,
              }
            }
          />
        </div>
      ) : (
        <SchoolCommunityRatingCard
          schoolId={school.id}
          summary={
            school.communityRatingSummary ?? {
              count: 0,
              safetyAvg: null,
              lifeAvg: null,
              foodAvg: null,
              isPublic: false,
            }
          }
        />
      )}

      {hasSupplementalSection && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5" />
              {t('school.supplemental.title')}
            </CardTitle>
            <CardDescription>{t('school.supplemental.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(school.usNewsRank || school.qsRank) && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{t('school.supplementalRanking')}</Badge>
                </div>
                {(school.rankings?.length || school.usNewsRank != null) && (
                  <div className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-muted-foreground">{t('school.usNewsRank')}</span>
                    <RankingBadge rankings={school.rankings} usNewsRank={school.usNewsRank} />
                  </div>
                )}
                {school.qsRank != null && (
                  <StatRow
                    label={t('school.qsRank')}
                    value={`#${school.qsRank}`}
                    source={getSchoolFieldSource(school, 'qsRank')}
                    sourceUrl={getFieldSourceUrl(getSchoolFieldSource(school, 'qsRank'), school)}
                  />
                )}
              </div>
            )}

            {supplementalMetricRows.length > 0 && (
              <>
                {(school.usNewsRank || school.qsRank) && <Separator />}
                <div className="space-y-4">
                  {supplementalMetricRows.map((row, index) => (
                    <div key={row.label}>
                      {index > 0 && <Separator className="mb-4" />}
                      <StatRow
                        label={row.label}
                        value={row.value}
                        bar={row.bar}
                        source={row.source}
                        sourceUrl={getFieldSourceUrl(row.source, school)}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {supplementalBadges.length > 0 && (
              <>
                {(school.usNewsRank || school.qsRank || supplementalMetricRows.length > 0) && (
                  <Separator />
                )}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t('school.supplementalBadges')}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {supplementalBadges.map((badge) => (
                      <div
                        key={badge.label}
                        className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                      >
                        <Badge variant="outline">{badge.label}</Badge>
                        <TrustBadge
                          source={badge.source}
                          sourceUrl={getFieldSourceUrl(badge.source, school)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {(school.description || school.descriptionZh) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              {t('school.about')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed text-muted-foreground">
              {locale === 'zh'
                ? school.descriptionZh || school.description
                : school.description || school.descriptionZh}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
