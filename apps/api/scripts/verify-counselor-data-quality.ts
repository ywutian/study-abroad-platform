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
const CLASSIFICATIONS_FILE = resolve(
  __dirname,
  'data-quality-classifications.json',
);

interface ClassificationEntry {
  schoolId: string;
  round: string;
  reason: string;
  classification: string;
  notes?: string;
}

function loadClassifications(): Map<string, ClassificationEntry> {
  const map = new Map<string, ClassificationEntry>();
  if (!existsSync(CLASSIFICATIONS_FILE)) return map;
  try {
    const raw = JSON.parse(readFileSync(CLASSIFICATIONS_FILE, 'utf8')) as {
      classifications?: ClassificationEntry[];
    };
    for (const entry of raw.classifications ?? []) {
      const key = `${entry.schoolId}|${entry.round}|${entry.reason}`;
      map.set(key, entry);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `Failed to read classifications file ${CLASSIFICATIONS_FILE}: ${
        (err as Error).message
      }`,
    );
  }
  return map;
}

function applyClassification(
  row: AuditRow,
  classifications: Map<string, ClassificationEntry>,
): AuditRow {
  const key = `${row.schoolId}|${row.round}|${row.reason}`;
  const entry = classifications.get(key);
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
    expectedUsSchoolCount: 240,
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
    programs: {
      rowCount: programs.length,
      aliasAudit: programMatch,
    },
    failures: failures.length,
    manualReview: manualReview.length,
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
  }
  await app.close();

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report: ${reportPath}`);
  const unreviewed = manualReview.filter(
    (row) => row.classification === 'UNREVIEWED',
  );
  if (strict && (failures.length > 0 || unreviewed.length > 0)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
