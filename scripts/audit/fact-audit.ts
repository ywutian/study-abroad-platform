import { PrismaClient, Prisma } from '@prisma/client';
import {
  OFFICIAL_SCHOOL_TRUTH_OVERRIDES,
  UC_SYSTEM_SCHOOL_NAMES,
} from './data/curated-school-truths';
import { loadApiEnv, monthDayString, normalizeMonthDay, normalizeWhitespace } from './utils';
import type {
  AgentAuditNote,
  AgentFinding,
  FactAuditArtifact,
  FactDriftRow,
  SchoolTruthRecord,
} from './types';

type ScopeSchool = {
  id: string;
  name: string;
  usNewsRank: number | null;
  scorecardId: string | null;
  acceptanceRate: Prisma.Decimal | null;
  sat25: number | null;
  sat75: number | null;
  act25: number | null;
  act75: number | null;
  testOptional: boolean | null;
  needBlindInternational: boolean;
  metadata: Prisma.JsonValue | null;
  deadlines: Array<{
    round: string;
    year: number;
    applicationDeadline: Date;
  }>;
};

function normalizeSchoolName(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/university/g, 'u')
    .replace(/college/g, 'c')
    .replace(/massachusetts institute of technology/g, 'mit')
    .replace(/, /g, ' ')
    .replace(/\./g, '');
}

function findLocalSchool(scopeSchools: ScopeSchool[], schoolName: string): ScopeSchool | null {
  const normalizedTarget = normalizeSchoolName(schoolName);
  return (
    scopeSchools.find((school) => normalizeSchoolName(school.name) === normalizedTarget) ??
    scopeSchools.find(
      (school) =>
        normalizeSchoolName(school.name).includes(normalizedTarget) ||
        normalizedTarget.includes(normalizeSchoolName(school.name))
    ) ??
    null
  );
}

function mapSchoolTestingPolicy(school: ScopeSchool): string {
  if (school.testOptional === true) return 'OPTIONAL';
  if (school.testOptional === false) return 'REQUIRED';
  return 'UNKNOWN';
}

function mapAnalysisRuntimeTestingPolicy(school: ScopeSchool): string {
  if (UC_SYSTEM_SCHOOL_NAMES.includes(school.name as (typeof UC_SYSTEM_SCHOOL_NAMES)[number])) {
    return 'BLIND';
  }
  return mapSchoolTestingPolicy(school);
}

function mapIntlAidPolicy(school: ScopeSchool): string {
  return school.needBlindInternational ? 'NEED_BLIND' : 'NEED_AWARE';
}

function metadataDeadlines(school: ScopeSchool): Record<string, string | null | undefined> {
  if (!school.metadata || typeof school.metadata !== 'object' || Array.isArray(school.metadata)) {
    return {};
  }
  const metadata = school.metadata as Record<string, unknown>;
  if (
    !metadata.deadlines ||
    typeof metadata.deadlines !== 'object' ||
    Array.isArray(metadata.deadlines)
  ) {
    return {};
  }
  return metadata.deadlines as Record<string, string | null | undefined>;
}

function localStandardDeadline(school: ScopeSchool): string | null {
  const rd = school.deadlines
    .filter((deadline) => deadline.round === 'RD')
    .sort((left, right) => right.year - left.year)[0];
  if (rd) return monthDayString(rd.applicationDeadline);

  const metadata = metadataDeadlines(school);
  const fallback = metadata.rd ?? metadata.regular ?? metadata.regularDecision;
  return fallback ? normalizeWhitespace(fallback) : null;
}

function localEarlyDeadlinePolicy(school: ScopeSchool): string | null {
  const early = school.deadlines
    .filter((deadline) => ['REA', 'SCEA', 'EA', 'ED', 'ED2', 'UC'].includes(deadline.round))
    .sort(
      (left, right) =>
        right.year - left.year ||
        left.applicationDeadline.getTime() - right.applicationDeadline.getTime()
    )[0];
  if (early) return `${early.round}: ${monthDayString(early.applicationDeadline)}`;

  const metadata = metadataDeadlines(school);
  const keys = ['rea', 'scea', 'ea', 'ed', 'ed1', 'ed2', 'uc'];
  for (const key of keys) {
    if (metadata[key]) return `${key.toUpperCase()}: ${normalizeWhitespace(metadata[key])}`;
  }
  return null;
}

function compareField(
  schoolName: string,
  surface: FactDriftRow['surface'],
  field: FactDriftRow['field'],
  expected: string | number | null | undefined,
  actual: string | number | null,
  sourceUrl: string,
  note?: string
): FactDriftRow | null {
  if (expected == null) return null;

  if (typeof expected === 'string' && field.toLowerCase().includes('deadline')) {
    const expectedNorm = normalizeMonthDay(expected);
    const actualNorm = normalizeMonthDay(typeof actual === 'string' ? actual : null);
    return {
      schoolName,
      surface,
      field,
      expected,
      actual,
      status:
        actual == null
          ? 'missing_local'
          : expectedNorm && actualNorm.includes(expectedNorm)
            ? 'match'
            : 'mismatch',
      sourceUrl,
      note,
    };
  }

  return {
    schoolName,
    surface,
    field,
    expected,
    actual,
    status:
      actual == null ? 'missing_local' : String(actual) === String(expected) ? 'match' : 'mismatch',
    sourceUrl,
    note,
  };
}

function buildLocalSnapshotTruth(school: ScopeSchool): SchoolTruthRecord {
  return {
    schoolId: school.id,
    schoolName: school.name,
    facts: {
      acceptanceRate: school.acceptanceRate == null ? null : Number(school.acceptanceRate),
      sat25: school.sat25,
      sat75: school.sat75,
      act25: school.act25,
      act75: school.act75,
    },
    sourceUrl: school.scorecardId
      ? `https://collegescorecard.ed.gov/school/?${school.scorecardId}`
      : 'https://collegescorecard.ed.gov/',
    retrievedAt: new Date().toISOString().slice(0, 10),
    sourceType: 'local_college_scorecard_snapshot',
    confidence: 'medium',
    scope: 'top50-plus-uc',
  };
}

export async function runFactAudit(): Promise<{
  artifact: FactAuditArtifact;
  note: AgentAuditNote;
}> {
  loadApiEnv();
  const prisma = new PrismaClient();

  try {
    const scopeSchools = await prisma.school.findMany({
      where: {
        OR: [{ usNewsRank: { lte: 50 } }, { name: { in: [...UC_SYSTEM_SCHOOL_NAMES] } }],
      },
      orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        usNewsRank: true,
        scorecardId: true,
        acceptanceRate: true,
        sat25: true,
        sat75: true,
        act25: true,
        act75: true,
        testOptional: true,
        needBlindInternational: true,
        metadata: true,
        deadlines: {
          select: {
            round: true,
            year: true,
            applicationDeadline: true,
          },
        },
      },
    });

    const truthset: SchoolTruthRecord[] = scopeSchools.map(buildLocalSnapshotTruth);
    const diffTable: FactDriftRow[] = [];

    for (const override of OFFICIAL_SCHOOL_TRUTH_OVERRIDES) {
      const localSchool = findLocalSchool(scopeSchools, override.schoolName);
      truthset.push({
        ...override,
        schoolId: localSchool?.id ?? null,
      });

      if (!localSchool) {
        diffTable.push({
          schoolName: override.schoolName,
          surface: 'school_record',
          field: 'testingPolicy',
          expected: override.facts.testingPolicy ?? null,
          actual: null,
          status: 'missing_local',
          sourceUrl: override.sourceUrl,
          note: 'School missing from local Top 50 + UC scope dataset',
        });
        continue;
      }

      const comparisons = [
        compareField(
          localSchool.name,
          'school_record',
          'standardDeadline',
          override.facts.standardDeadline,
          localStandardDeadline(localSchool),
          override.sourceUrl
        ),
        compareField(
          localSchool.name,
          'school_record',
          'earlyDeadlinePolicy',
          override.facts.earlyDeadlinePolicy,
          localEarlyDeadlinePolicy(localSchool),
          override.sourceUrl
        ),
        compareField(
          localSchool.name,
          'school_record',
          'testingPolicy',
          override.facts.testingPolicy,
          mapSchoolTestingPolicy(localSchool),
          override.sourceUrl
        ),
        compareField(
          localSchool.name,
          'analysis_runtime',
          'testingPolicy',
          override.facts.testingPolicy,
          mapAnalysisRuntimeTestingPolicy(localSchool),
          override.sourceUrl,
          'analysis runtime applies UC-specific BLIND override before falling back to School.testOptional'
        ),
        compareField(
          localSchool.name,
          'school_record',
          'intlAidPolicy',
          override.facts.intlAidPolicy,
          mapIntlAidPolicy(localSchool),
          override.sourceUrl
        ),
      ].filter((item): item is FactDriftRow => Boolean(item));

      diffTable.push(...comparisons);
    }

    const scoredRows = diffTable.filter(
      (row) => row.status === 'match' || row.status === 'mismatch'
    );
    const matches = scoredRows.filter((row) => row.status === 'match').length;
    const schoolLevelMismatchCount = new Set(
      diffTable.filter((row) => row.status === 'mismatch').map((row) => row.schoolName)
    ).size;

    const findings: AgentFinding[] = diffTable
      .filter((row) => row.status === 'mismatch')
      .slice(0, 10)
      .map((row) => ({
        agent: 'Fact Auditor',
        severity: row.field === 'testingPolicy' ? 'P1' : 'P2',
        category: 'fact_drift',
        summary: `${row.schoolName} ${row.field} mismatches official source`,
        evidence: `Expected ${String(row.expected)} but local ${row.surface} currently resolves to ${String(row.actual)}.`,
        affectedSurface: `${row.surface}:${row.field}`,
        file:
          row.surface === 'analysis_runtime'
            ? `${process.cwd()}/apps/api/src/modules/profile/profile-application-analysis.service.ts`
            : `${process.cwd()}/apps/api/prisma/seed.ts`,
        line: null,
      }));

    return {
      artifact: {
        scopeSchoolCount: scopeSchools.length,
        officialTruthCoverageCount: OFFICIAL_SCHOOL_TRUTH_OVERRIDES.filter((override) =>
          Boolean(findLocalSchool(scopeSchools, override.schoolName))
        ).length,
        fieldLevelAccuracy: scoredRows.length > 0 ? matches / scoredRows.length : null,
        schoolLevelMismatchCount,
        diffTable,
        truthset,
      },
      note: {
        agent: 'Fact Auditor',
        summary:
          'Official-source truth currently covers high-risk deadline, testing-policy, and international-aid fields; UC testing semantics already drift across local surfaces.',
        findings,
        notes: [
          'Numeric acceptance and test-range values in school_truthset.json are local College Scorecard snapshot records, not freshly pulled during this run.',
          'Field-level accuracy only scores official-source-backed comparisons, not the numeric snapshot records.',
        ],
      },
    };
  } finally {
    await prisma.$disconnect();
  }
}
