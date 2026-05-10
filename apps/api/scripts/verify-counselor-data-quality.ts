#!/usr/bin/env -S ts-node --transpile-only
/**
 * Data QA gate for all sources consumed by counselor-v2.
 *
 * Writes verification-report/phase-c/counselor-data-quality.json by default, or
 * verification-report/launch/data-quality.json with --launch. Rows in `failures`
 * block ship; rows in `manualReview` must be classified before launch.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { PredictionTransformerService } from '../src/modules/prediction/prediction-transformer.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { resolveMajorToCip } from '@study-abroad/shared/scoring';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = resolve(REPO_ROOT, 'verification-report', 'phase-c');
const EXPECTED_US_SCHOOL_COUNT = 240;
const MANUAL_REVIEW_FILE = 'manual-review.json';
const CLASSIFICATIONS_FILE = resolve(
  __dirname,
  'data-quality-classifications.json',
);

interface ClassificationEntry {
  schoolId: string;
  schoolName?: string;
  round: string;
  reason: string;
  classification: string;
  notes?: string;
}

interface ClassificationLookup {
  byId: Map<string, ClassificationEntry>;
  byName: Map<string, ClassificationEntry>;
}

function classificationIdKey(
  schoolId: unknown,
  round: unknown,
  reason: unknown,
): string | null {
  if (
    typeof schoolId !== 'string' ||
    typeof round !== 'string' ||
    typeof reason !== 'string'
  ) {
    return null;
  }
  return `${schoolId}|${round}|${reason}`;
}

function classificationNameKey(
  schoolName: unknown,
  round: unknown,
  reason: unknown,
): string | null {
  if (
    typeof schoolName !== 'string' ||
    typeof round !== 'string' ||
    typeof reason !== 'string'
  ) {
    return null;
  }
  return `${schoolName.trim().toLowerCase()}|${round}|${reason}`;
}

function loadClassifications(): ClassificationLookup {
  const lookup: ClassificationLookup = {
    byId: new Map<string, ClassificationEntry>(),
    byName: new Map<string, ClassificationEntry>(),
  };
  if (!existsSync(CLASSIFICATIONS_FILE)) return lookup;
  try {
    const raw = JSON.parse(readFileSync(CLASSIFICATIONS_FILE, 'utf8')) as {
      classifications?: ClassificationEntry[];
    };
    for (const entry of raw.classifications ?? []) {
      const idKey = classificationIdKey(
        entry.schoolId,
        entry.round,
        entry.reason,
      );
      if (idKey) {
        lookup.byId.set(idKey, entry);
      }

      const nameKey = classificationNameKey(
        entry.schoolName,
        entry.round,
        entry.reason,
      );
      if (nameKey) {
        lookup.byName.set(nameKey, entry);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `Failed to read classifications file ${CLASSIFICATIONS_FILE}: ${
        (err as Error).message
      }`,
    );
  }
  return lookup;
}

function applyClassification(
  row: AuditRow,
  classifications: ClassificationLookup,
): AuditRow {
  const idKey = classificationIdKey(row.schoolId, row.round, row.reason);
  const nameKey = classificationNameKey(row.schoolName, row.round, row.reason);
  const entry =
    (idKey ? classifications.byId.get(idKey) : undefined) ??
    (nameKey ? classifications.byName.get(nameKey) : undefined);
  if (!entry) return row;
  return {
    ...row,
    classification: entry.classification,
    classificationNotes: entry.notes,
  };
}
const CANONICAL_GPA_BANDS = [
  '<3.00',
  '3.00-3.24',
  '3.25-3.49',
  '3.50-3.74',
  '3.75-4.00',
] as const;
const COMMON_MAJOR_ALIASES = [
  'CS',
  'Comp Sci',
  'Computer Science',
  'Engineering',
  'Business',
  'Economics',
  'Biology',
  'Psychology',
  'Data Science',
  'Political Science',
];

type AuditRow = Record<string, unknown>;

const SAT_ACT_PLACEHOLDER_PATTERNS = [
  {
    reason: 'sat_act_placeholder_1080_1320',
    matches: (school: any) =>
      asNumber(school.sat25) === 1080 && asNumber(school.sat75) === 1320,
  },
  {
    reason: 'act_placeholder_21_29',
    matches: (school: any) =>
      asNumber(school.act25) === 21 && asNumber(school.act75) === 29,
  },
];

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRate(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed == null || parsed <= 0) return null;
  const normalized = parsed > 1 ? parsed / 100 : parsed;
  return normalized > 0 && normalized < 1 ? normalized : null;
}

function readGpaBand(
  raw: Record<string, unknown>,
  band: string,
): number | null {
  const aliases: Record<string, string[]> = {
    '<3.00': ['<3.00', '<3.0', 'lt3', 'lt3.00', 'below3', 'below_3_00'],
    '3.00-3.24': ['3.00-3.24', '3.0-3.24', '3.00_3.24', '3_00_3_24'],
    '3.25-3.49': ['3.25-3.49', '3.25_3.49', '3_25_3_49'],
    '3.50-3.74': ['3.50-3.74', '3.5-3.74', '3.50_3.74', '3_50_3_74'],
    '3.75-4.00': ['3.75-4.00', '3.75-4.0', '3.75_4.00', '3_75_4_00'],
  };
  for (const key of aliases[band] ?? [band]) {
    const value = asNumber(raw[key]);
    if (value != null) return value;
  }
  return null;
}

function auditGpaDistribution(school: any): AuditRow | null {
  if (!school.gpaDistribution) return null;
  if (
    typeof school.gpaDistribution !== 'object' ||
    Array.isArray(school.gpaDistribution)
  ) {
    return {
      schoolId: school.id,
      schoolName: school.name,
      reason: 'gpa_distribution_not_object',
    };
  }
  const values = CANONICAL_GPA_BANDS.map((band) =>
    readGpaBand(school.gpaDistribution as Record<string, unknown>, band),
  );
  if (values.some((value) => value == null || value < 0)) {
    return {
      schoolId: school.id,
      schoolName: school.name,
      reason: 'missing_or_negative_canonical_band',
      values,
    };
  }
  const numericValues = values as number[];
  const rawSum = numericValues.reduce((sum, value) => sum + value, 0);
  const sum = rawSum > 2 ? rawSum / 100 : rawSum;
  if (sum < 0.95 || sum > 1.05) {
    return {
      schoolId: school.id,
      schoolName: school.name,
      reason: 'gpa_distribution_sum_out_of_range',
      sum,
      values,
    };
  }
  return null;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)];
}

function readExistingManualReview(reportDir: string): {
  rows: AuditRow[];
  failures: AuditRow[];
} {
  const path = join(reportDir, MANUAL_REVIEW_FILE);
  if (!existsSync(path)) return { rows: [], failures: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
      rows?: AuditRow[];
      failures?: AuditRow[];
    };
    return {
      rows: parsed.rows ?? [],
      failures: parsed.failures ?? [],
    };
  } catch {
    return { rows: [], failures: [] };
  }
}

function writeManualReviewReport(
  reportDir: string,
  rows: AuditRow[],
  failures: AuditRow[],
) {
  const unreviewed = rows.filter((row) => row.classification === 'UNREVIEWED');
  const dataFixRequired = rows.filter(
    (row) => row.classification === 'DATA_FIX_REQUIRED',
  );
  writeFileSync(
    join(reportDir, MANUAL_REVIEW_FILE),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: rows.length,
        reviewedCount: rows.length - unreviewed.length,
        unreviewedCount: unreviewed.length,
        dataFixRequiredCount: dataFixRequired.length,
        failureCount: failures.length,
        rows,
        unreviewed,
        dataFixRequired,
        failures,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const reportDir = process.argv.includes('--launch')
    ? resolve(REPO_ROOT, 'verification-report', 'launch')
    : REPORT_DIR;
  mkdirSync(reportDir, { recursive: true });
  const strict = process.argv.includes('--strict');

  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    {
      logger: ['error', 'warn'],
    },
  );
  const prisma = app.get(PrismaService);
  const transformer = app.get(PredictionTransformerService);

  const schools = await prisma.school.findMany({
    where: { country: 'US' },
    orderBy: { name: 'asc' },
  });
  const schoolIds = schools.map((school) => school.id);
  const failures: AuditRow[] = [];
  const manualReview: AuditRow[] = [];
  const classifications = loadClassifications();

  if (schools.length !== EXPECTED_US_SCHOOL_COUNT) {
    failures.push({
      source: 'data-quality',
      reason: 'unexpected_us_school_count',
      expected: EXPECTED_US_SCHOOL_COUNT,
      actual: schools.length,
    });
  }

  const tierCounts = new Map<number, number>();
  for (const school of schools) {
    const input = transformer.schoolToInput(school as any);
    const tier =
      (await prisma.schoolCdsAdmitBand.count({
        where: { schoolId: school.id },
      })) > 0
        ? 1
        : input.sat25 != null && input.sat75 != null
          ? 2
          : input.acceptanceRate != null
            ? 3
            : 4;
    tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1);
    if (tier === 4) {
      failures.push({
        schoolId: school.id,
        schoolName: school.name,
        reason: 'unexpected_tier_4_us_school',
      });
    }
  }

  const gpaInvalid = schools
    .map(auditGpaDistribution)
    .filter((row): row is AuditRow => row != null);
  failures.push(...gpaInvalid);

  const acceptanceInvalid = schools.flatMap((school) => {
    const rate = normalizeRate(school.acceptanceRate);
    return school.acceptanceRate == null || rate
      ? []
      : [
          {
            schoolId: school.id,
            schoolName: school.name,
            reason: 'acceptance_rate_impossible',
            acceptanceRate: String(school.acceptanceRate),
          },
        ];
  });
  failures.push(...acceptanceInvalid);

  const roundRatios: number[] = [];
  for (const school of schools) {
    const overall = normalizeRate(school.acceptanceRate);
    if (!overall) continue;
    for (const [field, label] of [
      ['edAcceptanceRate', 'ED'],
      ['eaAcceptanceRate', 'EA'],
    ] as const) {
      const roundRate = normalizeRate(school[field]);
      if (!roundRate) continue;
      const ratio = roundRate / overall;
      roundRatios.push(ratio);
      if (roundRate < overall) {
        manualReview.push(
          applyClassification(
            {
              schoolId: school.id,
              schoolName: school.name,
              reason: 'round_rate_below_overall',
              round: label,
              overall,
              roundRate,
              ratio,
              classification: 'UNREVIEWED',
            },
            classifications,
          ),
        );
      }
      if (ratio > 3.5) {
        manualReview.push(
          applyClassification(
            {
              schoolId: school.id,
              schoolName: school.name,
              reason: 'round_rate_ratio_above_cap',
              round: label,
              overall,
              roundRate,
              ratio,
              classification: 'UNREVIEWED',
            },
            classifications,
          ),
        );
      }
    }
  }

  const actInvalid = schools.flatMap((school) => {
    const act25 = asNumber(school.act25);
    const act75 = asNumber(school.act75);
    if (act25 == null || act75 == null) return [];
    if (act25 <= act75 && act25 >= 1 && act75 <= 36) return [];
    return [
      {
        schoolId: school.id,
        schoolName: school.name,
        reason: 'act_band_invalid',
        act25,
        act75,
      },
    ];
  });
  failures.push(...actInvalid);

  const placeholderRows: AuditRow[] = [];
  for (const school of schools) {
    for (const pattern of SAT_ACT_PLACEHOLDER_PATTERNS) {
      if (!pattern.matches(school)) continue;
      placeholderRows.push(
        applyClassification(
          {
            source: 'data-quality',
            schoolId: school.id,
            schoolName: school.name,
            reason: pattern.reason,
            round: 'SAT_ACT',
            sat25: school.sat25,
            sat75: school.sat75,
            act25: school.act25,
            act75: school.act75,
            testingPolicy: school.testingPolicy,
            institutionType: school.institutionType,
            classification: 'UNREVIEWED',
          },
          classifications,
        ),
      );
    }
  }
  manualReview.push(...placeholderRows);

  const programs = await prisma.schoolProgram.findMany({
    where: { schoolId: { in: schoolIds } },
    select: { schoolId: true, cipCode: true, programName: true },
  });
  const programByCip = new Map<string, Set<string>>();
  for (const program of programs) {
    const set = programByCip.get(program.cipCode) ?? new Set<string>();
    set.add(program.schoolId);
    programByCip.set(program.cipCode, set);
  }
  const programMatch = COMMON_MAJOR_ALIASES.map((alias) => {
    const cip = resolveMajorToCip(alias);
    const cipMatches = cip ? (programByCip.get(cip)?.size ?? 0) : 0;
    const fuzzyMatches = new Set(
      programs
        .filter((program) =>
          program.programName.toLowerCase().includes(alias.toLowerCase()),
        )
        .map((program) => program.schoolId),
    );
    return {
      alias,
      cip,
      cipMatches,
      fuzzyFallbackMatches: Math.max(0, fuzzyMatches.size - cipMatches),
      neutralFallback: schools.length - Math.max(cipMatches, fuzzyMatches.size),
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    schoolCount: schools.length,
    expectedUsSchoolCount: EXPECTED_US_SCHOOL_COUNT,
    tierDistribution: Object.fromEntries([...tierCounts.entries()].sort()),
    gpaDistribution: {
      coverage: schools.filter((school) => school.gpaDistribution != null)
        .length,
      invalidCount: gpaInvalid.length,
    },
    rounds: {
      coverage: schools.filter(
        (school) =>
          school.edAcceptanceRate != null || school.eaAcceptanceRate != null,
      ).length,
      ratioP50: percentile(roundRatios, 50),
      ratioP95: percentile(roundRatios, 95),
      ratioMax: roundRatios.length ? Math.max(...roundRatios) : null,
    },
    act: {
      coverage: schools.filter(
        (school) => school.act25 != null && school.act75 != null,
      ).length,
      invalidCount: actInvalid.length,
    },
    satActPlaceholder: {
      patterns: SAT_ACT_PLACEHOLDER_PATTERNS.map((pattern) => pattern.reason),
      manualReviewCount: placeholderRows.length,
    },
    programs: {
      rowCount: programs.length,
      aliasAudit: programMatch,
    },
    failures: failures.length,
    manualReview: manualReview.length,
    unreviewedManualReview: manualReview.filter(
      (row) => row.classification === 'UNREVIEWED',
    ).length,
    dataFixRequiredManualReview: manualReview.filter(
      (row) => row.classification === 'DATA_FIX_REQUIRED',
    ).length,
  };

  const report = {
    summary,
    failures,
    manualReview,
    samples: {
      actHeavySchools: schools
        .filter((school) => school.act25 != null && school.act75 != null)
        .slice(0, 12)
        .map((school) => ({
          schoolId: school.id,
          schoolName: school.name,
          act25: school.act25,
          act75: school.act75,
          sat25: school.sat25,
          sat75: school.sat75,
        })),
    },
  };
  const reportPath = join(
    reportDir,
    process.argv.includes('--launch')
      ? 'data-quality.json'
      : 'counselor-data-quality.json',
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  if (process.argv.includes('--launch')) {
    writeFileSync(
      join(reportDir, 'counselor-data-quality.json'),
      JSON.stringify(report, null, 2),
    );
    const existingManualReview = readExistingManualReview(reportDir);
    const nonDataQualityRows = existingManualReview.rows.filter(
      (row) => row.source !== 'data-quality',
    );
    const nonDataQualityFailures = existingManualReview.failures.filter(
      (row) => row.source !== 'data-quality',
    );
    writeManualReviewReport(
      reportDir,
      [
        ...nonDataQualityRows,
        ...manualReview.map((row) => ({
          source: row.source ?? 'data-quality',
          ...row,
        })),
      ],
      [
        ...nonDataQualityFailures,
        ...failures.map((row) => ({
          source: row.source ?? 'data-quality',
          ...row,
        })),
      ],
    );
  }
  await app.close();

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report: ${reportPath}`);
  const unreviewed = manualReview.filter(
    (row) => row.classification === 'UNREVIEWED',
  );
  const dataFixRequired = manualReview.filter(
    (row) => row.classification === 'DATA_FIX_REQUIRED',
  );
  if (
    strict &&
    (failures.length > 0 || unreviewed.length > 0 || dataFixRequired.length > 0)
  ) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
