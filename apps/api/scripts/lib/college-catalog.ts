import { SCHOOL_ALIASES } from '../../prisma/seed-aliases';
import { NEED_BLIND_INTL_NAME_NORMS } from '../../prisma/seed-intl-schools';
import { INTL_STUDENT_PCT } from '../../prisma/seed-intl-rates';
import { RANKING_ENRICHMENTS } from '../../prisma/seed-rankings';
import { ADDITIONAL_SCHOOLS } from '../seed-more-schools';
import { EXPANDED_SCHOOLS } from '../seed-more-schools-expanded';
import { MORE_US_SCHOOLS } from '../seed-more-us-schools';
import { FINAL_SCHOOLS } from '../seed-final-schools';
import { TOP_100_APPLICATION_DATA } from '../seed-top100';
import { TOP_100_ADMISSIONS } from '../seed-top100-admissions';
import {
  UC_SCHOOLS,
  SUPPLEMENTAL_DESCRIPTION_SCHOOLS,
} from '../seed-uc-schools';
import { US_SCHOOLS_141_200 } from '../seed-us-schools-141-200';
import { deepMergeRecords } from '../../src/modules/school/school-provenance.helpers';
import { SeedSchoolData, normalizeSchoolName } from './seed-helpers';

function pickFirst<T>(
  current: T | undefined,
  incoming: T | undefined,
): T | undefined {
  return current ?? incoming;
}

function pickLongerText(
  current?: string,
  incoming?: string,
): string | undefined {
  const currentValue = current?.trim();
  const incomingValue = incoming?.trim();

  if (!currentValue) return incomingValue || undefined;
  if (!incomingValue) return currentValue;

  return incomingValue.length > currentValue.length
    ? incomingValue
    : currentValue;
}

function mergeAliases(
  current?: string[],
  incoming?: string[],
): string[] | undefined {
  const merged = [...(current ?? []), ...(incoming ?? [])]
    .map((alias) => alias.trim())
    .filter(Boolean);

  return merged.length > 0 ? Array.from(new Set(merged)) : undefined;
}

function mergeMetadata(
  current?: Record<string, unknown>,
  incoming?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!current && !incoming) return undefined;
  return deepMergeRecords(current ?? {}, incoming ?? {});
}

const CURATED_ALIAS_MAP = new Map(
  Object.entries(SCHOOL_ALIASES).map(([name, aliases]) => [
    normalizeSchoolName(name),
    aliases,
  ]),
);

const NEED_BLIND_INTL_SET = new Set(
  NEED_BLIND_INTL_NAME_NORMS.map((nameNorm) => normalizeSchoolName(nameNorm)),
);

const INTL_STUDENT_PCT_MAP = new Map(
  Object.entries(INTL_STUDENT_PCT).map(([nameNorm, pct]) => [
    normalizeSchoolName(nameNorm),
    pct,
  ]),
);

const INTL_ACCEPTANCE_RATE_MAP = new Map(
  RANKING_ENRICHMENTS.map((school) => [
    normalizeSchoolName(school.name),
    school.intlRate,
  ]),
);

function applyCuratedCollegeEnrichment(school: SeedSchoolData): SeedSchoolData {
  const nameNorm = normalizeSchoolName(school.name);
  const rankingIntlRate = INTL_ACCEPTANCE_RATE_MAP.get(nameNorm);
  const intlStudentPct = INTL_STUDENT_PCT_MAP.get(nameNorm);
  const metadataEnrichment: Record<string, unknown> = {};

  if (rankingIntlRate != null) {
    metadataEnrichment.lastRankingUpdate = '2025';
  }

  return {
    ...school,
    aliases: mergeAliases(school.aliases, CURATED_ALIAS_MAP.get(nameNorm)),
    needBlindInternational:
      school.needBlindInternational === true ||
      NEED_BLIND_INTL_SET.has(nameNorm)
        ? true
        : school.needBlindInternational,
    intlAcceptanceRate: pickFirst(school.intlAcceptanceRate, rankingIntlRate),
    intlStudentPct: pickFirst(school.intlStudentPct, intlStudentPct),
    metadata:
      Object.keys(metadataEnrichment).length > 0
        ? mergeMetadata(school.metadata, metadataEnrichment)
        : school.metadata,
  };
}

export function mergeSeedSchoolData(
  current: SeedSchoolData,
  incoming: SeedSchoolData,
): SeedSchoolData {
  return {
    name: current.name,
    nameZh: pickFirst(current.nameZh, incoming.nameZh),
    country: pickFirst(current.country, incoming.country),
    state: pickFirst(current.state, incoming.state),
    city: pickFirst(current.city, incoming.city),
    usNewsRank: pickFirst(current.usNewsRank, incoming.usNewsRank),
    qsRank: pickFirst(current.qsRank, incoming.qsRank),
    acceptanceRate: pickFirst(current.acceptanceRate, incoming.acceptanceRate),
    tuition: pickFirst(current.tuition, incoming.tuition),
    satAvg: pickFirst(current.satAvg, incoming.satAvg),
    sat25: pickFirst(current.sat25, incoming.sat25),
    sat75: pickFirst(current.sat75, incoming.sat75),
    actAvg: pickFirst(current.actAvg, incoming.actAvg),
    act25: pickFirst(current.act25, incoming.act25),
    act75: pickFirst(current.act75, incoming.act75),
    studentCount: pickFirst(current.studentCount, incoming.studentCount),
    graduationRate: pickFirst(current.graduationRate, incoming.graduationRate),
    avgSalary: pickFirst(current.avgSalary, incoming.avgSalary),
    website: pickFirst(current.website, incoming.website),
    isPrivate: pickFirst(current.isPrivate, incoming.isPrivate),
    description: pickLongerText(current.description, incoming.description),
    descriptionZh: pickLongerText(
      current.descriptionZh,
      incoming.descriptionZh,
    ),
    aliases: mergeAliases(current.aliases, incoming.aliases),
    needBlindInternational: pickFirst(
      current.needBlindInternational,
      incoming.needBlindInternational,
    ),
    intlStudentPct: pickFirst(current.intlStudentPct, incoming.intlStudentPct),
    intlAcceptanceRate: pickFirst(
      current.intlAcceptanceRate,
      incoming.intlAcceptanceRate,
    ),
    scorecardId: pickFirst(current.scorecardId, incoming.scorecardId),
    ipedsId: pickFirst(current.ipedsId, incoming.ipedsId),
    retentionRate: pickFirst(current.retentionRate, incoming.retentionRate),
    studentFacultyRatio: pickFirst(
      current.studentFacultyRatio,
      incoming.studentFacultyRatio,
    ),
    testOptional: pickFirst(current.testOptional, incoming.testOptional),
    hasEarlyDecision: pickFirst(
      current.hasEarlyDecision,
      incoming.hasEarlyDecision,
    ),
    totalEnrollment: pickFirst(
      current.totalEnrollment,
      incoming.totalEnrollment,
    ),
    satMath25: pickFirst(current.satMath25, incoming.satMath25),
    satMath75: pickFirst(current.satMath75, incoming.satMath75),
    satReading25: pickFirst(current.satReading25, incoming.satReading25),
    satReading75: pickFirst(current.satReading75, incoming.satReading75),
    logoUrl: pickFirst(current.logoUrl, incoming.logoUrl),
    metadata: mergeMetadata(current.metadata, incoming.metadata),
  };
}

export function buildUnifiedCollegeCatalog(
  baseSchools: SeedSchoolData[],
): SeedSchoolData[] {
  const unified = new Map<string, SeedSchoolData>();
  const sources: SeedSchoolData[][] = [
    baseSchools,
    TOP_100_ADMISSIONS,
    MORE_US_SCHOOLS,
    US_SCHOOLS_141_200,
    UC_SCHOOLS,
    ADDITIONAL_SCHOOLS,
    FINAL_SCHOOLS,
    TOP_100_APPLICATION_DATA,
    SUPPLEMENTAL_DESCRIPTION_SCHOOLS,
    EXPANDED_SCHOOLS,
  ];

  for (const catalog of sources) {
    for (const school of catalog) {
      const key = normalizeSchoolName(school.name);
      const current = unified.get(key);

      if (!current) {
        unified.set(
          key,
          applyCuratedCollegeEnrichment({ country: 'US', ...school }),
        );
        continue;
      }

      unified.set(
        key,
        applyCuratedCollegeEnrichment(mergeSeedSchoolData(current, school)),
      );
    }
  }

  return Array.from(unified.values()).map(applyCuratedCollegeEnrichment);
}
