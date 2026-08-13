'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DATA_SOURCE_LABELS, type SchoolFieldSource } from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconFrame, InlineIcon } from '@/components/ui/icon-frame';
import { Separator } from '@/components/ui/separator';
import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  Globe2,
  GraduationCap,
  Info,
  Shield,
  ShieldCheck,
  TrendingUp,
  Utensils,
  UsersRound,
} from 'lucide-react';
import {
  getSchoolFieldSource,
  isOfficialFieldSource,
  isPublicFieldSource,
  isSupplementalFieldSource,
} from '@/components/features/schools/school-display-utils';
import { TrustBadge } from '@/components/features/schools/TrustBadge';
import { SchoolCommunityRatingCard } from './school-community-rating-card';
import { SchoolRankingsPanel } from './school-rankings-panel';
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
  hint,
}: {
  label: string;
  value: ReactNode;
  bar?: number;
  source?: SchoolFieldSource;
  sourceUrl?: string | null;
  hint?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2 text-right">
          {bar != null && <PercentBar value={bar} />}
          <span className="font-semibold">{value}</span>
          {source && <TrustBadge source={source} sourceUrl={sourceUrl} />}
        </div>
      </div>
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
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

type CampusLifeDataDepth = 'rich' | 'partial' | 'thin';
type CampusLifeDimensionKey = 'safety' | 'life' | 'diningHousing';
type CampusLifeGradeTone = 'strong' | 'good' | 'mixed' | 'limited';

type CampusLifeEvidenceRow = {
  id: string;
  label: string;
  value: ReactNode;
  source?: SchoolFieldSource;
  sourceUrl?: string | null;
  dimension?: CampusLifeDimensionKey | 'overall';
  usedForRecommendation?: boolean;
};

type CampusLifeSourceSummary = {
  key: string;
  label: string;
  count: number;
};

type CampusLifeDimension = {
  key: CampusLifeDimensionKey;
  title: string;
  icon: LucideIcon;
  grade?: string;
  gradeTone?: CampusLifeGradeTone;
  gradeLabel: string;
  explanation: string;
  evidence: CampusLifeEvidenceRow[];
};

type CampusLifeInsight = {
  dataDepth: CampusLifeDataDepth;
  headline: string;
  dimensions: CampusLifeDimension[];
  caveats: string[];
  evidenceRows: CampusLifeEvidenceRow[];
  hasAnyData: boolean;
};

function normalizeGrade(grade?: string | null): string | undefined {
  const normalized = grade?.trim();
  return normalized || undefined;
}

function getGradeTone(grade?: string): CampusLifeGradeTone | undefined {
  if (!grade) return undefined;
  if (grade === 'A+' || grade === 'A' || grade === 'A-') return 'strong';
  if (grade === 'B+' || grade === 'B') return 'good';
  if (grade === 'B-' || grade === 'C+' || grade === 'C') return 'mixed';
  return 'limited';
}

function joinReadableList(values: string[], locale: string): string {
  if (values.length === 0) return '';
  const formatter = new Intl.ListFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'short',
    type: 'conjunction',
  });
  return formatter.format(values);
}

function sourceDateLabel(source: SchoolFieldSource | undefined, locale: string): string | null {
  if (!source?.fetchedAt) return null;
  return new Date(source.fetchedAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function sourceNameLabel(source: SchoolFieldSource | undefined, locale: string): string {
  if (!source) return '';
  const localeKey = locale === 'zh' ? 'zh' : 'en';
  return DATA_SOURCE_LABELS[source.source]?.[localeKey] ?? source.source;
}

function buildSourceSummaries(
  rows: CampusLifeEvidenceRow[],
  locale: string
): CampusLifeSourceSummary[] {
  const summaries = new Map<string, CampusLifeSourceSummary>();

  for (const row of rows) {
    if (!row.source) continue;
    const key = row.source.source;
    const existing = summaries.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    summaries.set(key, {
      key,
      label: sourceNameLabel(row.source, locale),
      count: 1,
    });
  }

  return Array.from(summaries.values());
}

function CampusDimensionCard({ dimension }: { dimension: CampusLifeDimension }) {
  const toneClass =
    dimension.gradeTone === 'strong'
      ? 'border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
      : dimension.gradeTone === 'good'
        ? 'border-blue-500/25 bg-blue-500/8 text-blue-700 dark:text-blue-300'
        : dimension.gradeTone === 'mixed'
          ? 'border-amber-500/30 bg-amber-500/8 text-amber-700 dark:text-amber-300'
          : 'border-muted bg-muted/45 text-muted-foreground';

  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border bg-background/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconFrame icon={dimension.icon} tone="neutral" size="sm" />
          <div>
            <h4 className="text-sm font-semibold">{dimension.title}</h4>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {dimension.explanation}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={toneClass}>
          {dimension.grade ? `${dimension.grade} · ${dimension.gradeLabel}` : dimension.gradeLabel}
        </Badge>
      </div>

      <div className="mt-auto space-y-2">
        {dimension.evidence.slice(0, 3).map((row) => (
          <div key={row.id} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="max-w-[55%] text-right font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
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
        }
      : null,
    isPublicFieldSource(getSchoolFieldSource(school, 'tuition')) && school.tuition != null
      ? {
          label: t('school.stats.tuition'),
          value: fmtCurrency(school.tuition),
        }
      : null,
    isPublicFieldSource(getSchoolFieldSource(school, 'studentCount', 'totalEnrollment')) &&
    (school.studentCount != null || school.totalEnrollment != null)
      ? {
          label: t('school.stats.studentCount'),
          value: fmtNumber(school.studentCount ?? school.totalEnrollment),
        }
      : null,
    isPublicFieldSource(getSchoolFieldSource(school, 'graduationRate')) &&
    school.graduationRate != null
      ? {
          label: t('school.graduationRate'),
          value: fmtPercent(school.graduationRate, 0),
          bar: Number(school.graduationRate),
        }
      : null,
    isPublicFieldSource(getSchoolFieldSource(school, 'avgSalary')) && school.avgSalary != null
      ? {
          label: t('school.stats.avgSalary'),
          value: fmtCurrency(school.avgSalary),
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: ReactNode;
    bar?: number;
  }>;

  const getPublicSource = (...fields: string[]) => {
    const source = getSchoolFieldSource(school, ...fields);
    return isPublicFieldSource(source) ? source : undefined;
  };

  const formatSafetyService = (service: string) => {
    const labels: Record<string, string> = {
      '24-hour security patrol': 'securityPatrol',
      'campus police/public safety office': 'publicSafetyOffice',
      'emergency phones': 'emergencyPhones',
      'late-night transport or escort': 'lateNightEscort',
      'controlled residence access': 'controlledResidenceAccess',
      'security cameras': 'securityCameras',
    };
    const key = labels[service];
    return key ? t(`school.campusLifeOfficial.safetyServices.${key}`) : service;
  };

  const gradeLabel = (grade?: string) => {
    const tone = getGradeTone(grade);
    if (!tone) return t('school.campusLifeOfficial.gradeLabels.noGrade');
    return t(`school.campusLifeOfficial.gradeLabels.${tone}`);
  };

  const makeEvidenceRow = ({
    id,
    label,
    value,
    source,
    dimension,
    usedForRecommendation = false,
  }: {
    id: string;
    label: string;
    value: ReactNode;
    source?: SchoolFieldSource;
    dimension?: CampusLifeEvidenceRow['dimension'];
    usedForRecommendation?: boolean;
  }): CampusLifeEvidenceRow | null => {
    if (!source) return null;
    return {
      id,
      label,
      value,
      source,
      sourceUrl: getFieldSourceUrl(source, school),
      dimension,
      usedForRecommendation,
    };
  };

  const safetyGrade = normalizeGrade(school.nicheSafetyGrade);
  const safetySource = getPublicSource('nicheSafetyGrade');
  const lifeGrade = normalizeGrade(school.nicheLifeGrade);
  const lifeSource = getPublicSource('nicheLifeGrade');
  const foodGrade = normalizeGrade(school.nicheFoodGrade);
  const foodSource = getPublicSource('nicheFoodGrade');
  const overallGrade = normalizeGrade(school.nicheOverallGrade);
  const overallSource = getPublicSource('nicheOverallGrade');

  const overallGradeRow =
    overallGrade && overallSource
      ? makeEvidenceRow({
          id: 'nicheOverallGrade',
          label: t('school.campusLife.overall'),
          value: overallGrade,
          source: overallSource,
          dimension: 'overall',
          usedForRecommendation: true,
        })
      : null;

  const safetyGradeRow =
    safetyGrade && safetySource
      ? makeEvidenceRow({
          id: 'nicheSafetyGrade',
          label: t('school.campusLife.safety'),
          value: safetyGrade,
          source: safetySource,
          dimension: 'safety',
          usedForRecommendation: true,
        })
      : null;

  const lifeGradeRow =
    lifeGrade && lifeSource
      ? makeEvidenceRow({
          id: 'nicheLifeGrade',
          label: t('school.campusLife.life'),
          value: lifeGrade,
          source: lifeSource,
          dimension: 'life',
          usedForRecommendation: true,
        })
      : null;

  const foodGradeRow =
    foodGrade && foodSource
      ? makeEvidenceRow({
          id: 'nicheFoodGrade',
          label: t('school.campusLife.food'),
          value: foodGrade,
          source: foodSource,
          dimension: 'diningHousing',
          usedForRecommendation: true,
        })
      : null;

  const safetyServices =
    Array.isArray(school.campusSafetyServices) && school.campusSafetyServices.length > 0
      ? school.campusSafetyServices.map(formatSafetyService).join(locale === 'zh' ? '、' : ', ')
      : null;
  const safetyServicesRow = safetyServices
    ? makeEvidenceRow({
        id: 'campusSafetyServices',
        label: t('school.campusLifeOfficial.fields.safetyServices'),
        value: safetyServices,
        source: getPublicSource('campusSafetyServices'),
        dimension: 'safety',
      })
    : null;

  const studentOrgsRow =
    school.studentOrgsCount != null
      ? makeEvidenceRow({
          id: 'studentOrgsCount',
          label: t('school.campusLife.studentOrgs'),
          value: school.studentOrgsCount.toLocaleString(),
          source: getPublicSource('studentOrgsCount'),
          dimension: 'life',
        })
      : null;

  const livingOnCampusRow =
    school.percentLivingOnCampus != null
      ? makeEvidenceRow({
          id: 'percentLivingOnCampus',
          label: t('school.campusLifeOfficial.fields.livingOnCampus'),
          value: fmtPercent(Number(school.percentLivingOnCampus), 0),
          source: getPublicSource('percentLivingOnCampus'),
          dimension: 'life',
        })
      : null;

  const roomAndBoardRow =
    school.roomAndBoard != null
      ? makeEvidenceRow({
          id: 'roomAndBoard',
          label: t('school.financialAid.roomAndBoard'),
          value: fmtCurrency(school.roomAndBoard),
          source: getPublicSource('roomAndBoard'),
          dimension: 'diningHousing',
        })
      : null;

  const mealPlanRow =
    school.mealPlanCost != null
      ? makeEvidenceRow({
          id: 'mealPlanCost',
          label: t('school.campusLifeOfficial.fields.mealPlanCost'),
          value: fmtCurrency(school.mealPlanCost),
          source: getPublicSource('mealPlanCost'),
          dimension: 'diningHousing',
        })
      : null;

  const housingAvailabilityRow =
    school.housingAvailable != null
      ? makeEvidenceRow({
          id: 'housingAvailable',
          label: t('school.campusLifeOfficial.fields.housingAvailable'),
          value: school.housingAvailable ? tc('yes') : tc('no'),
          source: getPublicSource('housingAvailable'),
          dimension: 'diningHousing',
        })
      : null;

  const housingRequiredRow =
    school.housingRequiredYears != null
      ? makeEvidenceRow({
          id: 'housingRequiredYears',
          label: t('school.campusLifeOfficial.fields.housingRequiredYears'),
          value: t('school.campusLifeOfficial.values.years', {
            count: school.housingRequiredYears,
          }),
          source: getPublicSource('housingRequiredYears'),
          dimension: 'diningHousing',
        })
      : null;

  const evidenceRows = [
    overallGradeRow,
    safetyGradeRow,
    lifeGradeRow,
    foodGradeRow,
    safetyServicesRow,
    studentOrgsRow,
    livingOnCampusRow,
    roomAndBoardRow,
    mealPlanRow,
    housingAvailabilityRow,
    housingRequiredRow,
  ].filter(Boolean) as CampusLifeEvidenceRow[];

  const safetyEvidence = [safetyServicesRow, safetyGradeRow].filter(
    Boolean
  ) as CampusLifeEvidenceRow[];
  const lifeEvidence = [studentOrgsRow, livingOnCampusRow, lifeGradeRow].filter(
    Boolean
  ) as CampusLifeEvidenceRow[];
  const diningHousingEvidence = [
    roomAndBoardRow,
    mealPlanRow,
    housingAvailabilityRow,
    housingRequiredRow,
    foodGradeRow,
  ].filter(Boolean) as CampusLifeEvidenceRow[];

  const dimensions: CampusLifeDimension[] = [
    {
      key: 'safety',
      title: t('school.campusLifeOfficial.dimensions.safety.title'),
      icon: ShieldCheck,
      grade: safetySource ? safetyGrade : undefined,
      gradeTone: safetySource ? getGradeTone(safetyGrade) : undefined,
      gradeLabel: gradeLabel(safetySource ? safetyGrade : undefined),
      explanation: safetySource
        ? t('school.campusLifeOfficial.dimensions.safety.withGrade')
        : safetyEvidence.length > 0
          ? t('school.campusLifeOfficial.dimensions.safety.withFacts')
          : t('school.campusLifeOfficial.dimensions.safety.noData'),
      evidence: safetyEvidence,
    },
    {
      key: 'life',
      title: t('school.campusLifeOfficial.dimensions.life.title'),
      icon: UsersRound,
      grade: lifeSource ? lifeGrade : undefined,
      gradeTone: lifeSource ? getGradeTone(lifeGrade) : undefined,
      gradeLabel: gradeLabel(lifeSource ? lifeGrade : undefined),
      explanation: lifeSource
        ? t('school.campusLifeOfficial.dimensions.life.withGrade')
        : lifeEvidence.length > 0
          ? t('school.campusLifeOfficial.dimensions.life.withFacts')
          : t('school.campusLifeOfficial.dimensions.life.noData'),
      evidence: lifeEvidence,
    },
    {
      key: 'diningHousing',
      title: t('school.campusLifeOfficial.dimensions.diningHousing.title'),
      icon: Utensils,
      grade: foodSource ? foodGrade : undefined,
      gradeTone: foodSource ? getGradeTone(foodGrade) : undefined,
      gradeLabel: gradeLabel(foodSource ? foodGrade : undefined),
      explanation: foodSource
        ? t('school.campusLifeOfficial.dimensions.diningHousing.withGrade')
        : diningHousingEvidence.length > 0
          ? t('school.campusLifeOfficial.dimensions.diningHousing.withFacts')
          : t('school.campusLifeOfficial.dimensions.diningHousing.noData'),
      evidence: diningHousingEvidence,
    },
  ];

  const completeDimensions = dimensions.filter((dimension) => dimension.evidence.length > 0);
  const strongDimensions = dimensions.filter(
    (dimension) => dimension.gradeTone === 'strong' || dimension.gradeTone === 'good'
  );
  const missingDimensions = dimensions.filter((dimension) => dimension.evidence.length === 0);
  const dataDepth: CampusLifeDataDepth =
    evidenceRows.length >= 6 && completeDimensions.length === dimensions.length
      ? 'rich'
      : evidenceRows.length >= 2
        ? 'partial'
        : 'thin';

  const caveats = [
    missingDimensions.length > 0
      ? t('school.campusLifeOfficial.caveats.missingDimensions', {
          dimensions: joinReadableList(
            missingDimensions.map((dimension) => dimension.title),
            locale
          ),
        })
      : null,
    !roomAndBoardRow && !mealPlanRow ? t('school.campusLifeOfficial.caveats.costMissing') : null,
    evidenceRows.some((row) => row.usedForRecommendation) && evidenceRows.length <= 4
      ? t('school.campusLifeOfficial.caveats.gradeOnly')
      : null,
    t('school.campusLifeOfficial.caveats.fitOnly'),
  ].filter(Boolean) as string[];

  const hasCampusLifeSection = evidenceRows.length > 0;
  const campusLifeSourceSummaries = buildSourceSummaries(evidenceRows, locale);
  const campusLifeSourceSummaryLabel = joinReadableList(
    campusLifeSourceSummaries.map((source) => source.label),
    locale
  );
  const campusLifeInsight: CampusLifeInsight = {
    dataDepth,
    hasAnyData: hasCampusLifeSection,
    dimensions,
    caveats,
    evidenceRows,
    headline: !hasCampusLifeSection
      ? t('school.campusLifeOfficial.empty')
      : strongDimensions.length > 0
        ? t('school.campusLifeOfficial.headlines.withStrengths', {
            strengths: joinReadableList(
              strongDimensions.map((dimension) => dimension.title),
              locale
            ),
            caveat:
              missingDimensions.length > 0
                ? t('school.campusLifeOfficial.headlines.missingSuffix', {
                    dimensions: joinReadableList(
                      missingDimensions.map((dimension) => dimension.title),
                      locale
                    ),
                  })
                : '',
          })
        : t(`school.campusLifeOfficial.headlines.${dataDepth}`),
  };

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
          hint: t('school.international.countriesHint'),
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
    hint?: ReactNode;
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
          label: testingPolicyT(school.testingPolicy as never),
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

  const hasAnyRanking = Boolean(
    school.usNewsRank || school.qsRank || (school.rankings?.length ?? 0) > 0
  );

  const hasSupplementalSection =
    hasAnyRanking || supplementalMetricRows.length > 0 || supplementalBadges.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
        <Card className="lg:col-start-1 lg:row-start-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 ">
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

        <Card className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 ">
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

        {publishedSnapshotRows.length > 0 && (
          <Card className="lg:col-start-1 lg:row-start-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 ">
                <ClipboardList className="h-5 w-5" />
                {t('school.publishedSnapshot.title')}
              </CardTitle>
              <CardDescription>{t('school.publishedSnapshot.description')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {publishedSnapshotRows.map((row) => (
                <div key={row.label} className="rounded-lg border bg-background/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <div className="flex items-center gap-2 text-right">
                      {row.bar != null && <PercentBar value={row.bar} />}
                      <span className="whitespace-nowrap font-semibold">{row.value}</span>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2 lg:col-span-1">
                {t('school.publishedSnapshot.sourceNote')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 ">
            <Shield className="h-5 w-5" />
            {t('school.campusLifeOfficial.title')}
          </CardTitle>
          <CardDescription>{t('school.campusLifeOfficial.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/25 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <IconFrame
                  icon={campusLifeInsight.dataDepth === 'thin' ? Info : ShieldCheck}
                  tone={campusLifeInsight.hasAnyData ? 'success' : 'neutral'}
                  size="sm"
                />
                <div className="space-y-1">
                  <p className="font-medium">{campusLifeInsight.headline}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t('school.campusLifeOfficial.fitNote')}
                  </p>
                </div>
              </div>
              <Badge variant={campusLifeInsight.dataDepth === 'rich' ? 'success' : 'outline'}>
                {t(`school.campusLifeOfficial.dataDepth.${campusLifeInsight.dataDepth}`)}
              </Badge>
            </div>
          </div>

          {campusLifeInsight.hasAnyData ? (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                {campusLifeInsight.dimensions.map((dimension) => (
                  <CampusDimensionCard key={dimension.key} dimension={dimension} />
                ))}
              </div>

              {campusLifeInsight.caveats.length > 0 && (
                <div className="rounded-lg border border-dashed bg-background/35 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <InlineIcon icon={Info} size="sm" />
                    {t('school.campusLifeOfficial.boundaries')}
                  </div>
                  <ul className="space-y-1 text-sm leading-relaxed text-muted-foreground">
                    {campusLifeInsight.caveats.map((caveat) => (
                      <li key={caveat}>{caveat}</li>
                    ))}
                  </ul>
                </div>
              )}

              <details className="group rounded-lg border bg-background/40">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
                  <span className="flex min-w-0 items-center gap-2">
                    <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{t('school.campusLifeOfficial.evidence.title')}</span>
                    <Badge variant="outline">
                      {t('school.campusLifeOfficial.evidence.itemCount', {
                        count: campusLifeInsight.evidenceRows.length,
                      })}
                    </Badge>
                    {campusLifeSourceSummaryLabel ? (
                      <span className="hidden truncate text-xs font-normal text-muted-foreground md:inline">
                        {campusLifeSourceSummaryLabel}
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-3 border-t px-4 py-4">
                  {campusLifeSourceSummaryLabel ? (
                    <div className="rounded-lg border bg-muted/25 p-3 text-sm">
                      <p className="font-medium">
                        {t('school.campusLifeOfficial.evidence.summaryTitle', {
                          sources: campusLifeSourceSummaryLabel,
                        })}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {t('school.campusLifeOfficial.evidence.summaryDescription')}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {campusLifeSourceSummaries.map((source) => (
                          <Badge key={source.key} variant="secondary" className="font-normal">
                            {source.label} ·{' '}
                            {t('school.campusLifeOfficial.evidence.itemCount', {
                              count: source.count,
                            })}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {campusLifeInsight.evidenceRows.map((row, index) => (
                    <div key={row.id}>
                      {index > 0 && <Separator className="mb-3" />}
                      <div className="grid min-w-0 gap-3 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto] lg:items-center">
                        <div>
                          <p className="font-medium">{row.label}</p>
                          <p className="text-muted-foreground">{row.value}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p>
                            {t('school.campusLifeOfficial.evidence.source')}:{' '}
                            <span className="font-medium text-foreground">
                              {sourceNameLabel(row.source, locale) ||
                                t('school.campusLifeOfficial.evidence.sourceFallback')}
                            </span>
                          </p>
                          <p>
                            {t('school.campusLifeOfficial.evidence.updated')}:{' '}
                            {sourceDateLabel(row.source, locale) ?? tc('notAvailable')}
                          </p>
                          <p className="mt-1">
                            {row.usedForRecommendation
                              ? t('school.campusLifeOfficial.evidence.usedForFit')
                              : t('school.campusLifeOfficial.evidence.notUsedForFit')}
                          </p>
                        </div>
                        {row.sourceUrl ? (
                          <a
                            href={row.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 justify-self-start rounded-md border px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5 lg:justify-self-end"
                          >
                            {t('school.campusLifeOfficial.evidence.openSource')}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <EmptyCardState message={t('school.campusLifeOfficial.emptyHelp')} />
          )}
        </CardContent>
      </Card>

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)]">
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
            <CardTitle className="flex items-center gap-2 ">
              <ClipboardList className="h-5 w-5" />
              {t('school.supplemental.title')}
            </CardTitle>
            <CardDescription>{t('school.supplemental.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {hasAnyRanking && <SchoolRankingsPanel school={school} />}

            {supplementalMetricRows.length > 0 && (
              <>
                {hasAnyRanking && <Separator />}
                <div className="space-y-4">
                  {supplementalMetricRows.map((row, index) => (
                    <div key={row.label}>
                      {index > 0 && <Separator className="mb-4" />}
                      <StatRow
                        label={row.label}
                        value={row.value}
                        bar={row.bar}
                        hint={row.hint}
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
                {(hasAnyRanking || supplementalMetricRows.length > 0) && <Separator />}
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
            <CardTitle className="flex items-center gap-2 ">
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
