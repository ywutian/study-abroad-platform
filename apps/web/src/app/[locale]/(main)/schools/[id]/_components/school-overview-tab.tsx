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
  getSupplementalCampusLifeGrades,
  isOfficialFieldSource,
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

export function SchoolOverviewTab({ school }: SchoolOverviewTabProps) {
  const t = useTranslations();
  const tc = useTranslations('common');
  const testingPolicyT = useTranslations('applicationAnalysis.policy.testing');
  const locale = useLocale();

  const deadlines = school.metadata?.deadlines || {};
  const supplementalCampusLife = getSupplementalCampusLifeGrades(school);

  const fmtCurrency = (value?: number | null) =>
    value != null ? `$${value.toLocaleString()}` : tc('notAvailable');

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

  const verifiedCampusLifeRows = [
    isOfficialFieldSource(getSchoolFieldSource(school, 'nicheOverallGrade')) && {
      label: t('school.campusLife.overall'),
      value: school.nicheOverallGrade,
      source: getSchoolFieldSource(school, 'nicheOverallGrade'),
    },
    isOfficialFieldSource(getSchoolFieldSource(school, 'nicheSafetyGrade')) && {
      label: t('school.campusLife.safety'),
      value: school.nicheSafetyGrade,
      source: getSchoolFieldSource(school, 'nicheSafetyGrade'),
    },
    isOfficialFieldSource(getSchoolFieldSource(school, 'nicheLifeGrade')) && {
      label: t('school.campusLife.life'),
      value: school.nicheLifeGrade,
      source: getSchoolFieldSource(school, 'nicheLifeGrade'),
    },
    isOfficialFieldSource(getSchoolFieldSource(school, 'nicheFoodGrade')) && {
      label: t('school.campusLife.food'),
      value: school.nicheFoodGrade,
      source: getSchoolFieldSource(school, 'nicheFoodGrade'),
    },
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
    isSupplementalFieldSource(getSchoolFieldSource(school, 'roomAndBoard')) &&
    school.roomAndBoard != null
      ? {
          label: t('school.financialAid.roomAndBoard'),
          value: fmtCurrency(school.roomAndBoard),
          source: getSchoolFieldSource(school, 'roomAndBoard'),
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
    isSupplementalFieldSource(getSchoolFieldSource(school, 'studentOrgsCount')) &&
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
    supplementalCampusLife.hasGrades ||
    supplementalMetricRows.length > 0 ||
    supplementalBadges.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
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
                    sourceUrl={row.source ? getSourceUrl(row.source.source, school) : null}
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
            {deadlines.rea && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">REA</Badge>
                    <span>{t('school.deadlines.rea')}</span>
                  </div>
                  <span className="font-semibold">{deadlines.rea}</span>
                </div>
                <Separator />
              </>
            )}
            {deadlines.ea && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">EA</Badge>
                    <span>{t('school.deadlines.ea')}</span>
                  </div>
                  <span className="font-semibold">{deadlines.ea}</span>
                </div>
                <Separator />
              </>
            )}
            {deadlines.ed && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge>ED</Badge>
                    <span>{t('school.deadlines.ed')}</span>
                  </div>
                  <span className="font-semibold">{deadlines.ed}</span>
                </div>
                <Separator />
              </>
            )}
            {deadlines.ed2 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">ED II</Badge>
                    <span>{t('school.deadlines.ed2')}</span>
                  </div>
                  <span className="font-semibold">{deadlines.ed2}</span>
                </div>
                <Separator />
              </>
            )}
            {deadlines.rd && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">RD</Badge>
                  <span>{t('school.deadlines.rd')}</span>
                </div>
                <span className="font-semibold">{deadlines.rd}</span>
              </div>
            )}
            {Object.keys(deadlines).length === 0 && (
              <EmptyCardState message={t('school.deadlines.noData')} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              {t('school.campusLifeOfficial.title')}
            </CardTitle>
            <CardDescription>{t('school.campusLifeOfficial.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {verifiedCampusLifeRows.length > 0 ? (
              verifiedCampusLifeRows.map((row, index) => (
                <div key={row.label}>
                  {index > 0 && <Separator className="mb-4" />}
                  <StatRow
                    label={row.label}
                    value={row.value}
                    source={row.source}
                    sourceUrl={row.source ? getSourceUrl(row.source.source, school) : null}
                  />
                </div>
              ))
            ) : (
              <EmptyCardState message={t('school.campusLifeOfficial.empty')} />
            )}
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
                    sourceUrl={
                      getSchoolFieldSource(school, 'qsRank')
                        ? getSourceUrl(getSchoolFieldSource(school, 'qsRank')!.source, school)
                        : null
                    }
                  />
                )}
              </div>
            )}

            {supplementalCampusLife.hasGrades && (
              <>
                {(school.usNewsRank || school.qsRank) && <Separator />}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t('school.supplementalCampusLife')}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {supplementalCampusLife.overallGrade && (
                      <div className="text-center">
                        <Badge variant="outline" className="px-3 py-1 text-lg">
                          {supplementalCampusLife.overallGrade}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('school.campusLife.overall')}
                        </p>
                      </div>
                    )}
                    {supplementalCampusLife.safetyGrade && (
                      <div className="text-center">
                        <Badge variant="outline" className="px-3 py-1 text-lg">
                          {supplementalCampusLife.safetyGrade}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('school.campusLife.safety')}
                        </p>
                      </div>
                    )}
                    {supplementalCampusLife.lifeGrade && (
                      <div className="text-center">
                        <Badge variant="outline" className="px-3 py-1 text-lg">
                          {supplementalCampusLife.lifeGrade}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('school.campusLife.life')}
                        </p>
                      </div>
                    )}
                    {supplementalCampusLife.foodGrade && (
                      <div className="text-center">
                        <Badge variant="outline" className="px-3 py-1 text-lg">
                          {supplementalCampusLife.foodGrade}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('school.campusLife.food')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {supplementalMetricRows.length > 0 && (
              <>
                {(school.usNewsRank || school.qsRank || supplementalCampusLife.hasGrades) && (
                  <Separator />
                )}
                <div className="space-y-4">
                  {supplementalMetricRows.map((row, index) => (
                    <div key={row.label}>
                      {index > 0 && <Separator className="mb-4" />}
                      <StatRow
                        label={row.label}
                        value={row.value}
                        bar={row.bar}
                        source={row.source}
                        sourceUrl={row.source ? getSourceUrl(row.source.source, school) : null}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {supplementalBadges.length > 0 && (
              <>
                {(school.usNewsRank ||
                  school.qsRank ||
                  supplementalCampusLife.hasGrades ||
                  supplementalMetricRows.length > 0) && <Separator />}
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
                          sourceUrl={
                            badge.source ? getSourceUrl(badge.source.source, school) : null
                          }
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
