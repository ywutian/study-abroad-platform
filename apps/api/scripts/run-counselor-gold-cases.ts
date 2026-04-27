#!/usr/bin/env tsx
/**
 * Counselor Engine Gold Cases Runner — CI gate for cold-start prediction.
 *
 * Boots a Nest application context with `CounselorEngineModule` (no HTTP /
 * controllers needed), loads every JSON file under `gold-cases/counselor/cases/`,
 * looks up each case's school by name, runs `counselorEngine.compute()`, and
 * asserts the returned probability falls inside `expectedProbabilityRange`.
 *
 * Exit codes:
 *   0 — all cases pass
 *   1 — at least one case failed (CI blocks PR merge)
 *
 * Reports written to `gold-cases/counselor/reports/<timestamp>.json` for
 * post-mortem inspection. The CI artifact upload step picks these up.
 *
 * Why an in-process script (not HTTP):
 * - 30 cases × HTTP roundtrip = ~5s of overhead with no benefit
 * - In-process boots faster + has tighter error reporting
 * - Existing `eval-teacher-blend.ts` script established the
 *   NestFactory.createApplicationContext pattern — mirroring it.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type {
  CounselorGoldCase,
  CounselorGoldReplayResult,
} from '../gold-cases/counselor/schema';
import type {
  ProfileInput,
  SchoolInput,
} from '../src/modules/prediction/prediction.prompts';

const CASES_DIR = resolve(__dirname, '..', 'gold-cases', 'counselor', 'cases');
const REPORTS_DIR = resolve(
  __dirname,
  '..',
  'gold-cases',
  'counselor',
  'reports',
);

const SLACK = 0.005; // ±0.5pp slack on probability range comparison

const MINIMAL_CDS_FIXTURE = [
  {
    schoolNameNorm: 'university of california, merced',
    gpaBand: '3.75-4.00',
    testType: 'SAT',
    testBand: '1500-1600',
    admitRate: 0.92,
    sampleCount: 500,
    cycleYear: 2024,
    source: 'gold-counselor-fixture:uc-merced:2024',
    sourceUrl: 'https://admissions.ucmerced.edu/',
  },
  {
    schoolNameNorm: 'university of california, merced',
    gpaBand: '3.75-4.00',
    testType: 'GPA_ONLY',
    testBand: 'ANY',
    admitRate: 0.88,
    sampleCount: 1200,
    cycleYear: 2024,
    source: 'gold-counselor-fixture:uc-merced:2024',
    sourceUrl: 'https://admissions.ucmerced.edu/',
  },
] as const;

function normalizeSchoolName(name: string): string {
  return name.trim().toLowerCase();
}

async function loadMinimalCdsFixture(prisma: PrismaService) {
  for (const row of MINIMAL_CDS_FIXTURE) {
    const school = await prisma.school.findUnique({
      where: { nameNorm: row.schoolNameNorm },
      select: { id: true },
    });
    if (!school) {
      console.warn(
        `⚠️  CDS fixture skipped: school not found (${row.schoolNameNorm})`,
      );
      continue;
    }

    await prisma.schoolCdsAdmitBand.upsert({
      where: {
        schoolId_gpaBand_testType_testBand_cycleYear: {
          schoolId: school.id,
          gpaBand: row.gpaBand,
          testType: row.testType,
          testBand: row.testBand,
          cycleYear: row.cycleYear,
        },
      },
      update: {
        admitRate: new Prisma.Decimal(row.admitRate),
        sampleCount: row.sampleCount,
        source: row.source,
        sourceUrl: row.sourceUrl,
      },
      create: {
        schoolId: school.id,
        gpaBand: row.gpaBand,
        testType: row.testType,
        testBand: row.testBand,
        admitRate: new Prisma.Decimal(row.admitRate),
        sampleCount: row.sampleCount,
        cycleYear: row.cycleYear,
        source: row.source,
        sourceUrl: row.sourceUrl,
      },
    });
  }
}

async function main() {
  // Load all gold cases
  const caseFiles = readdirSync(CASES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (caseFiles.length === 0) {
    console.error(`❌ No gold case files found in ${CASES_DIR}`);
    process.exit(1);
  }
  console.log(
    `Loaded ${caseFiles.length} counselor gold case(s) from ${CASES_DIR}`,
  );

  // Boot Nest application context
  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    {
      logger: ['error', 'warn'], // suppress info noise
    },
  );
  const counselor = app.get(CounselorEngineService);
  const prisma = app.get(PrismaService);
  await loadMinimalCdsFixture(prisma);

  // Look up all unique schools by stable normalized name in one query (avoids
  // per-case round-trip and avoids environment-specific cuid IDs).
  const cases: CounselorGoldCase[] = caseFiles.map((file) =>
    JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8')),
  );
  const uniqueNameNorms = Array.from(
    new Set(
      cases.map((c) => c.schoolNameNorm ?? normalizeSchoolName(c.schoolName)),
    ),
  );
  const schoolRows = await prisma.school.findMany({
    where: { nameNorm: { in: uniqueNameNorms } },
    select: {
      id: true,
      name: true,
      nameNorm: true,
      nameZh: true,
      acceptanceRate: true,
      satAvg: true,
      sat25: true,
      sat75: true,
      actAvg: true,
      act25: true,
      act75: true,
      isPrivate: true,
      state: true,
      needBlindInternational: true,
      intlAcceptanceRate: true,
    },
  });
  const schoolByNameNorm = new Map(schoolRows.map((s) => [s.nameNorm, s]));

  // Run each case
  const results: CounselorGoldReplayResult[] = [];
  for (const c of cases) {
    const schoolNameNorm =
      c.schoolNameNorm ?? normalizeSchoolName(c.schoolName);
    const school = schoolByNameNorm.get(schoolNameNorm);
    if (!school) {
      results.push({
        caseId: c.id,
        passed: false,
        probability: 0,
        expectedRange: c.expectedProbabilityRange,
        tier: 0,
        anchor: 0,
        anchorSource: 'lookup-failed',
        failureReason: `School "${c.schoolName}" not found in database. Re-run seed?`,
      });
      continue;
    }

    // Build SchoolInput from DB row (matching the shape PredictionService.schoolToInput produces)
    const schoolInput: SchoolInput & {
      acceptanceRate?: number | null;
      state?: string | null;
      isPrivate?: boolean | null;
      needBlindInternational?: boolean;
      intlAcceptanceRate?: number | null;
    } = {
      id: school.id,
      name: school.name,
      nameZh: school.nameZh ?? undefined,
      acceptanceRate: school.acceptanceRate
        ? Number(school.acceptanceRate)
        : undefined,
      satAvg: school.satAvg ?? undefined,
      sat25: school.sat25 ?? undefined,
      sat75: school.sat75 ?? undefined,
      actAvg: school.actAvg ?? undefined,
      act25: school.act25 ?? undefined,
      act75: school.act75 ?? undefined,
      isPrivate: school.isPrivate,
      state: school.state ?? undefined,
      needBlindInternational: school.needBlindInternational ?? false,
      intlAcceptanceRate: school.intlAcceptanceRate
        ? Number(school.intlAcceptanceRate)
        : undefined,
    };

    // Build ProfileInput from gold case (apply array defaults)
    const profileInput: ProfileInput = {
      ...(c.profile as Partial<ProfileInput>),
      testScores: c.profile.testScores ?? [],
      activities: c.profile.activities ?? [],
      awards: c.profile.awards ?? [],
    } as ProfileInput;

    try {
      const result = await counselor.compute(
        profileInput as ProfileInput & {
          recruitedAthlete?: boolean;
          urmStatus?: string | null;
        },
        schoolInput,
        c.applicationRound,
      );

      const [low, high] = c.expectedProbabilityRange;
      const inRange =
        result.probability >= low - SLACK && result.probability <= high + SLACK;
      const tierMatches =
        c.expectedTier == null || c.expectedTier === result.tier;

      const passed = inRange && tierMatches;
      results.push({
        caseId: c.id,
        passed,
        probability: result.probability,
        expectedRange: c.expectedProbabilityRange,
        tier: result.tier,
        anchor: result.anchor,
        anchorSource: result.anchorSource,
        failureReason: passed
          ? undefined
          : !inRange
            ? `probability ${result.probability.toFixed(4)} outside expected range [${low}, ${high}] (slack ±${SLACK})`
            : `tier ${result.tier} did not match expected ${c.expectedTier}`,
      });
    } catch (err) {
      results.push({
        caseId: c.id,
        passed: false,
        probability: 0,
        expectedRange: c.expectedProbabilityRange,
        tier: 0,
        anchor: 0,
        anchorSource: 'compute-error',
        failureReason: `compute() threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  await app.close();

  // Print summary table + write report file
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);
  console.log('');
  console.log(`========== Counselor Gold Cases Report ==========`);
  console.log(
    `Total: ${results.length}  |  Passed: ${passed}  |  Failed: ${failed.length}`,
  );
  console.log('');

  // Show all results in a table
  console.table(
    results.map((r) => ({
      case: r.caseId,
      pass: r.passed ? '✓' : '✗',
      prob: r.probability.toFixed(3),
      expected: `[${r.expectedRange[0]}, ${r.expectedRange[1]}]`,
      tier: r.tier,
      anchor: r.anchor.toFixed(3),
    })),
  );

  if (failed.length > 0) {
    console.log('');
    console.log('========== Failures ==========');
    for (const f of failed) {
      console.log(`✗ ${f.caseId}: ${f.failureReason}`);
    }
  }

  // Write JSON report
  mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = join(
    REPORTS_DIR,
    `report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalCases: results.length,
        passed,
        failed: failed.length,
        results,
      },
      null,
      2,
    ),
  );
  console.log('');
  console.log(`Report written to ${reportPath}`);

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ Gold case runner crashed:', err);
  process.exit(1);
});
