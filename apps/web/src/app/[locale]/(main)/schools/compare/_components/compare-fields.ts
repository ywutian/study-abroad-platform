import type { useTranslations } from 'next-intl';
import { formatAcceptanceRate } from '@/lib/utils';
import type { CompareField } from './types';

// Field grouping for category headers
export const CATEGORY_FIELDS: Record<string, string[]> = {
  rankings: ['usNewsRank', 'qsRank'],
  admissions: ['acceptanceRate', 'intlAcceptanceRate', 'hasEarlyDecision', 'testingPolicy'],
  testScores: ['satAvg', 'satRange', 'actAvg', 'toeflMin'],
  cost: [
    'tuition',
    'averageNetPrice',
    'averageAidPackage',
    'percentNeedMet',
    'needBlindInternational',
  ],
  outcomes: ['avgSalary', 'graduationRate', 'retentionRate'],
  campus: ['studentCount', 'studentFacultyRatio', 'intlStudentPct'],
};

export function buildFields(
  t: ReturnType<typeof useTranslations>,
  testingPolicyT: ReturnType<typeof useTranslations>
): CompareField[] {
  const pct = (_v: number | string | null | undefined) => {
    if (_v == null) return '-';
    const n = typeof _v === 'string' ? parseFloat(_v) : _v;
    if (Number.isNaN(n)) return '-';
    return `${(n * 100).toFixed(1)}%`;
  };

  const rawPct = (_v: number | string | null | undefined) => {
    if (_v == null) return '-';
    const n = typeof _v === 'string' ? parseFloat(_v) : _v;
    if (Number.isNaN(n)) return '-';
    return `${n.toFixed(1)}%`;
  };

  const rank = (_v: number | string | null | undefined) => {
    if (_v == null) return '-';
    return `#${_v}`;
  };

  const num = (
    _v: number | string | null | undefined,
    f: Parameters<CompareField['format']>[1]
  ) => {
    if (_v == null) return '-';
    const n = typeof _v === 'string' ? parseFloat(_v) : _v;
    if (Number.isNaN(n)) return '-';
    return f.number(n, 'standard');
  };

  const currency = (
    _v: number | string | null | undefined,
    f: Parameters<CompareField['format']>[1]
  ) => {
    if (_v == null) return '-';
    const n = typeof _v === 'string' ? parseFloat(_v) : _v;
    if (Number.isNaN(n)) return '-';
    return f.number(n, 'currency');
  };

  const bool = (_v: number | string | null | undefined) => {
    if (_v == null) return '-';
    return _v ? t('yes') : t('no');
  };

  const ratio = (_v: number | string | null | undefined) => {
    if (_v == null) return '-';
    return `${_v}:1`;
  };

  return [
    // Rankings
    {
      key: 'usNewsRank',
      labelKey: 'fields.usNewsRank',
      getValue: (s) => s.usNewsRank,
      format: rank,
      best: 'lower',
    },
    {
      key: 'qsRank',
      labelKey: 'fields.qsRank',
      getValue: (s) => s.qsRank,
      format: rank,
      best: 'lower',
    },
    // Admissions
    {
      key: 'acceptanceRate',
      labelKey: 'fields.acceptanceRate',
      getValue: (s) => s.acceptanceRate,
      format: (_v) => formatAcceptanceRate(_v as number | null),
      best: 'lower',
    },
    {
      key: 'intlAcceptanceRate',
      labelKey: 'fields.intlAcceptanceRate',
      getValue: (s) => s.intlAcceptanceRate,
      format: (_v) => formatAcceptanceRate(_v as number | null),
      best: 'lower',
    },
    {
      key: 'hasEarlyDecision',
      labelKey: 'fields.hasEarlyDecision',
      getValue: (s) => s.hasEarlyDecision as unknown as number,
      format: bool,
      best: 'higher',
    },
    {
      key: 'testingPolicy',
      labelKey: 'fields.testingPolicy',
      getValue: (s) => s.testingPolicy,
      format: (_v) => (typeof _v === 'string' && _v.length > 0 ? testingPolicyT(_v as never) : '-'),
      best: 'higher',
    },
    // Test Scores
    {
      key: 'satAvg',
      labelKey: 'fields.satAvg',
      getValue: (s) => s.satAvg,
      format: num,
      best: 'higher',
    },
    {
      key: 'satRange',
      labelKey: 'fields.satRange',
      getValue: (s) => (s.sat25 != null && s.sat75 != null ? `${s.sat25}-${s.sat75}` : null),
      format: (_v) => (_v == null ? '-' : String(_v)),
      best: 'higher',
    },
    {
      key: 'actAvg',
      labelKey: 'fields.actAvg',
      getValue: (s) => s.actAvg,
      format: num,
      best: 'higher',
    },
    {
      key: 'toeflMin',
      labelKey: 'fields.toeflMin',
      getValue: (s) => s.metadata?.requirements?.toeflMin,
      format: num,
      best: 'lower',
    },
    // Cost
    {
      key: 'tuition',
      labelKey: 'fields.tuition',
      getValue: (s) => s.tuition,
      format: currency,
      best: 'lower',
    },
    {
      key: 'averageNetPrice',
      labelKey: 'fields.averageNetPrice',
      getValue: (s) => s.averageNetPrice,
      format: currency,
      best: 'lower',
    },
    {
      key: 'averageAidPackage',
      labelKey: 'fields.averageAidPackage',
      getValue: (s) => s.averageAidPackage,
      format: currency,
      best: 'higher',
    },
    {
      key: 'percentNeedMet',
      labelKey: 'fields.percentNeedMet',
      getValue: (s) => s.percentNeedMet,
      format: rawPct,
      best: 'higher',
    },
    {
      key: 'needBlindInternational',
      labelKey: 'fields.needBlindInternational',
      getValue: (s) => s.needBlindInternational as unknown as number,
      format: bool,
      best: 'higher',
    },
    // Outcomes
    {
      key: 'avgSalary',
      labelKey: 'fields.avgSalary',
      getValue: (s) => s.avgSalary,
      format: currency,
      best: 'higher',
    },
    {
      key: 'graduationRate',
      labelKey: 'fields.graduationRate',
      getValue: (s) => s.graduationRate,
      format: pct,
      best: 'higher',
    },
    {
      key: 'retentionRate',
      labelKey: 'fields.retentionRate',
      getValue: (s) => s.retentionRate,
      format: pct,
      best: 'higher',
    },
    // Campus
    {
      key: 'studentCount',
      labelKey: 'fields.studentCount',
      getValue: (s) => s.studentCount,
      format: num,
      best: 'higher',
    },
    {
      key: 'studentFacultyRatio',
      labelKey: 'fields.studentFacultyRatio',
      getValue: (s) => s.studentFacultyRatio,
      format: ratio,
      best: 'lower',
    },
    {
      key: 'intlStudentPct',
      labelKey: 'fields.intlStudentPct',
      getValue: (s) => s.intlStudentPct,
      format: rawPct,
      best: 'higher',
    },
  ];
}
