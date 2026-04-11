'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DATA_SOURCE_LABELS } from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Calendar,
  ClipboardList,
  ExternalLink,
  Globe2,
  GraduationCap,
  Info,
  Shield,
  TrendingUp,
} from 'lucide-react';
import {
  getSchoolFieldSource,
  getSupplementalCampusLifeGrades,
  hasVerifiedFieldSource,
} from '@/components/features/schools/school-display-utils';
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

function ProvenanceBadge({
  field,
  provenance,
  scorecardId,
  ipedsId,
}: {
  field: string;
  provenance?: Record<string, { source: string; at: string }>;
  scorecardId?: string;
  ipedsId?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const prov = provenance?.[field];
  if (!prov) return null;

  const label = DATA_SOURCE_LABELS[prov.source]?.[locale === 'zh' ? 'zh' : 'en'] ?? prov.source;
  const freshness = new Date(prov.at).toLocaleDateString(locale, {
    month: 'short',
    year: 'numeric',
  });
  const sourceUrl = getSourceUrl(prov.source, { scorecardId, ipedsId });

  if (sourceUrl) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="ml-1 inline-flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={t('school.dataSource', { source: label })}
          >
            <Info className="h-3 w-3 text-muted-foreground/60" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-auto max-w-xs p-3">
          <p className="text-xs font-medium">{t('school.dataSource', { source: label })}</p>
          <p className="text-xs text-muted-foreground">
            {t('school.updatedAt', { date: freshness })}
          </p>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t('school.viewSource')}
            <ExternalLink className="h-3 w-3" />
          </a>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="ml-1 inline-flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={t('school.dataSource', { source: label })}
        >
          <Info className="h-3 w-3 text-muted-foreground/60" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{t('school.dataSource', { source: label })}</p>
        <p className="text-xs text-muted-foreground">
          {t('school.updatedAt', { date: freshness })}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function StatRow({
  label,
  value,
  bar,
  provenanceField,
  provenance,
  scorecardId,
  ipedsId,
}: {
  label: string;
  value: ReactNode;
  bar?: number;
  provenanceField?: string;
  provenance?: Record<string, { source: string; at: string }>;
  scorecardId?: string;
  ipedsId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 text-right">
        {bar != null && <PercentBar value={bar} />}
        <span className="font-semibold">{value}</span>
        {provenanceField && provenance && (
          <ProvenanceBadge
            field={provenanceField}
            provenance={provenance}
            scorecardId={scorecardId}
            ipedsId={ipedsId}
          />
        )}
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
  const locale = useLocale();

  const deadlines = school.metadata?.deadlines || {};
  const requirements = school.metadata?.requirements || {};
  const provenance = school.metadata?.provenance;
  const supplementalCampusLife = getSupplementalCampusLifeGrades(school);

  const fmtCurrency = (value?: number | null) =>
    value != null ? `$${value.toLocaleString()}` : tc('notAvailable');

  const verifiedAcademicRows = [
    hasVerifiedFieldSource(school, 'satAvg', 'sat25', 'sat75') && {
      label: t('school.satAvg'),
      value:
        school.sat25 && school.sat75
          ? `${school.sat25}-${school.sat75}${school.satAvg ? ` (avg ${school.satAvg})` : ''}`
          : school.satAvg || requirements.satRange || tc('notAvailable'),
      provenanceField: getSchoolFieldSource(school, 'satAvg') ? 'satAvg' : undefined,
    },
    hasVerifiedFieldSource(school, 'actAvg', 'act25', 'act75') && {
      label: t('school.actAvg'),
      value:
        school.act25 && school.act75
          ? `${school.act25}-${school.act75}${school.actAvg ? ` (avg ${school.actAvg})` : ''}`
          : school.actAvg || requirements.actRange || tc('notAvailable'),
      provenanceField: getSchoolFieldSource(school, 'actAvg') ? 'actAvg' : undefined,
    },
    hasVerifiedFieldSource(school, 'graduationRate') && {
      label: t('school.graduationRate'),
      value:
        school.graduationRate != null
          ? `${Number(school.graduationRate).toFixed(0)}%`
          : tc('notAvailable'),
      bar: school.graduationRate != null ? Number(school.graduationRate) : undefined,
      provenanceField: 'graduationRate',
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: ReactNode;
    bar?: number;
    provenanceField?: string;
  }>;

  const verifiedCampusLifeRows = [
    hasVerifiedFieldSource(school, 'nicheOverallGrade') && {
      label: t('school.campusLife.overall'),
      value: school.nicheOverallGrade,
      provenanceField: 'nicheOverallGrade',
    },
    hasVerifiedFieldSource(school, 'nicheSafetyGrade') && {
      label: t('school.campusLife.safety'),
      value: school.nicheSafetyGrade,
      provenanceField: 'nicheSafetyGrade',
    },
    hasVerifiedFieldSource(school, 'nicheLifeGrade') && {
      label: t('school.campusLife.life'),
      value: school.nicheLifeGrade,
      provenanceField: 'nicheLifeGrade',
    },
    hasVerifiedFieldSource(school, 'nicheFoodGrade') && {
      label: t('school.campusLife.food'),
      value: school.nicheFoodGrade,
      provenanceField: 'nicheFoodGrade',
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: ReactNode;
    provenanceField: string;
  }>;

  const supplementalMetricRows = [
    getSchoolFieldSource(school, 'retentionRate')?.tier === 'supplemental' &&
    school.retentionRate != null
      ? {
          label: t('school.retentionRate'),
          value: `${Number(school.retentionRate).toFixed(0)}%`,
          bar: Number(school.retentionRate),
          provenanceField: 'retentionRate',
        }
      : null,
    getSchoolFieldSource(school, 'studentFacultyRatio')?.tier === 'supplemental' &&
    school.studentFacultyRatio != null
      ? {
          label: t('school.studentFacultyRatio'),
          value: `${school.studentFacultyRatio}:1`,
          provenanceField: 'studentFacultyRatio',
        }
      : null,
    getSchoolFieldSource(school, 'averageNetPrice')?.tier === 'supplemental' &&
    school.averageNetPrice != null
      ? {
          label: t('school.financialAid.netPrice'),
          value: fmtCurrency(school.averageNetPrice),
          provenanceField: 'averageNetPrice',
        }
      : null,
    getSchoolFieldSource(school, 'averageAidPackage')?.tier === 'supplemental' &&
    school.averageAidPackage != null
      ? {
          label: t('school.financialAid.aidPackage'),
          value: fmtCurrency(school.averageAidPackage),
          provenanceField: 'averageAidPackage',
        }
      : null,
    getSchoolFieldSource(school, 'percentNeedMet')?.tier === 'supplemental' &&
    school.percentNeedMet != null
      ? {
          label: t('school.financialAid.needMet'),
          value: `${Number(school.percentNeedMet).toFixed(0)}%`,
          bar: Number(school.percentNeedMet),
          provenanceField: 'percentNeedMet',
        }
      : null,
    getSchoolFieldSource(school, 'applicationFee')?.tier === 'supplemental' &&
    school.applicationFee != null
      ? {
          label: t('school.financialAid.applicationFee'),
          value: fmtCurrency(school.applicationFee),
          provenanceField: 'applicationFee',
        }
      : null,
    getSchoolFieldSource(school, 'roomAndBoard')?.tier === 'supplemental' &&
    school.roomAndBoard != null
      ? {
          label: t('school.financialAid.roomAndBoard'),
          value: fmtCurrency(school.roomAndBoard),
          provenanceField: 'roomAndBoard',
        }
      : null,
    getSchoolFieldSource(school, 'intlStudentPct')?.tier === 'supplemental' &&
    school.intlStudentPct != null
      ? {
          label: t('school.international.studentPct'),
          value: `${Number(school.intlStudentPct).toFixed(1)}%`,
          bar: Number(school.intlStudentPct),
          provenanceField: 'intlStudentPct',
        }
      : null,
    getSchoolFieldSource(school, 'intlAcceptanceRate')?.tier === 'supplemental' &&
    school.intlAcceptanceRate != null
      ? {
          label: t('school.international.acceptanceRate'),
          value: `${Number(school.intlAcceptanceRate).toFixed(1)}%`,
          bar: Number(school.intlAcceptanceRate),
          provenanceField: 'intlAcceptanceRate',
        }
      : null,
    getSchoolFieldSource(school, 'countriesRepresented')?.tier === 'supplemental' &&
    school.countriesRepresented != null
      ? {
          label: t('school.international.countries'),
          value: school.countriesRepresented.toLocaleString(),
          provenanceField: 'countriesRepresented',
        }
      : null,
    getSchoolFieldSource(school, 'salary6YrPostGrad')?.tier === 'supplemental' &&
    school.salary6YrPostGrad != null
      ? {
          label: t('school.postGrad.salary'),
          value: fmtCurrency(school.salary6YrPostGrad),
          provenanceField: 'salary6YrPostGrad',
        }
      : null,
    getSchoolFieldSource(school, 'loanDefaultRate')?.tier === 'supplemental' &&
    school.loanDefaultRate != null
      ? {
          label: t('school.postGrad.loanDefault'),
          value: `${Number(school.loanDefaultRate).toFixed(1)}%`,
          bar: Number(school.loanDefaultRate),
          provenanceField: 'loanDefaultRate',
        }
      : null,
    getSchoolFieldSource(school, 'monthlyLoanPayment')?.tier === 'supplemental' &&
    school.monthlyLoanPayment != null
      ? {
          label: t('school.postGrad.monthlyLoan'),
          value: fmtCurrency(school.monthlyLoanPayment),
          provenanceField: 'monthlyLoanPayment',
        }
      : null,
    getSchoolFieldSource(school, 'studentOrgsCount')?.tier === 'supplemental' &&
    school.studentOrgsCount != null
      ? {
          label: t('school.campusLife.studentOrgs'),
          value: school.studentOrgsCount.toLocaleString(),
          provenanceField: 'studentOrgsCount',
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: ReactNode;
    bar?: number;
    provenanceField: string;
  }>;

  const supplementalBadges = [
    getSchoolFieldSource(school, 'acceptsCommonApp')?.tier === 'supplemental' &&
    school.acceptsCommonApp
      ? t('school.applicationInfo.commonApp')
      : null,
    getSchoolFieldSource(school, 'acceptsCoalition')?.tier === 'supplemental' &&
    school.acceptsCoalition
      ? t('school.applicationInfo.coalition')
      : null,
    getSchoolFieldSource(school, 'testOptional')?.tier === 'supplemental' && school.testOptional
      ? t('school.applicationInfo.testOptional')
      : null,
    getSchoolFieldSource(school, 'needBlindInternational')?.tier === 'supplemental' &&
    school.needBlindInternational
      ? t('school.applicationInfo.needBlind')
      : null,
    getSchoolFieldSource(school, 'hasEarlyDecision')?.tier === 'supplemental' &&
    school.hasEarlyDecision
      ? t('school.applicationInfo.earlyDecision')
      : null,
    getSchoolFieldSource(school, 'feeWaiverAvailable')?.tier === 'supplemental' &&
    school.feeWaiverAvailable
      ? t('school.financialAid.feeWaiver')
      : null,
  ].filter(Boolean) as string[];

  const hasSupplementalSection =
    Boolean(school.usNewsRank || school.qsRank) ||
    supplementalCampusLife.hasGrades ||
    supplementalMetricRows.length > 0 ||
    supplementalBadges.length > 0;

  return (
    <TooltipProvider delayDuration={300}>
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
                      provenanceField={row.provenanceField}
                      provenance={provenance}
                      scorecardId={school.scorecardId}
                      ipedsId={school.ipedsId}
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
                      provenanceField={row.provenanceField}
                      provenance={provenance}
                      scorecardId={school.scorecardId}
                      ipedsId={school.ipedsId}
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
                  {school.usNewsRank != null && (
                    <StatRow
                      label={t('school.usNewsRank')}
                      value={`#${school.usNewsRank}`}
                      provenanceField="usNewsRank"
                      provenance={provenance}
                      scorecardId={school.scorecardId}
                      ipedsId={school.ipedsId}
                    />
                  )}
                  {school.qsRank != null && (
                    <StatRow
                      label={t('school.qsRank')}
                      value={`#${school.qsRank}`}
                      provenanceField="qsRank"
                      provenance={provenance}
                      scorecardId={school.scorecardId}
                      ipedsId={school.ipedsId}
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
                          provenanceField={row.provenanceField}
                          provenance={provenance}
                          scorecardId={school.scorecardId}
                          ipedsId={school.ipedsId}
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
                        <Badge key={badge} variant="outline">
                          {badge}
                        </Badge>
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
    </TooltipProvider>
  );
}
