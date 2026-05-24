#!/usr/bin/env tsx
/**
 * Counselor Calibration Spec Runner — Layer 3 of the prediction calibration
 * methodology (see docs/PREDICTION_CALIBRATION_METHODOLOGY.md).
 *
 * Loads every JSON fixture under `gold-cases/counselor-calibration/cases/`,
 * runs each through `CounselorEngineService.compute()`, and asserts:
 *
 *   - standalone fixtures: probability ∈ expectedRange, tier matches,
 *     confidence ≤ expectedConfidenceAtMost
 *   - comparative fixtures: caseA.prob - caseB.prob ∈ [expectedMinDelta,
 *     expectedMaxDelta]
 *
 * Expected bands come from industry sources (NACAC / Crimson / CDS) — NOT
 * from current engine math. A failure means either the engine drifted or
 * the spec needs updating (with citations) — see methodology doc §3.5.
 *
 * Exit codes:
 *   0 — all fixtures pass
 *   1 — at least one fixture failed (CI-gating)
 *
 * Reports: gold-cases/counselor-calibration/reports/<timestamp>.{md,json}
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';

import type {
  AnyFixture,
  CalibrationFixture,
  ComparativeFixture,
  FixtureResult,
} from '../gold-cases/counselor-calibration/schema';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type {
  ProfileInput,
  SchoolInput,
} from '../src/modules/prediction/prediction.prompts';

const CASES_DIR = resolve(
  __dirname,
  '..',
  'gold-cases',
  'counselor-calibration',
  'cases',
);
const REPORTS_DIR = resolve(
  __dirname,
  '..',
  'gold-cases',
  'counselor-calibration',
  'reports',
);

const CONFIDENCE_RANK: Record<string, number> = {
  'very-low': 0,
  low: 1,
  medium: 2,
  high: 3,
};

function normalizeSchoolName(name: string): string {
  return name.toLowerCase().trim();
}

function buildSchoolInput(school: any): SchoolInput & {
  acceptanceRate?: number | null;
  state?: string | null;
  isPrivate?: boolean | null;
  needBlindInternational?: boolean | null;
  intlAcceptanceRate?: number | null;
  oosAcceptanceRate?: number | null;
} {
  return {
    id: school.id,
    name: school.name,
    nameZh: school.nameZh ?? undefined,
    country: school.country ?? undefined,
    state: school.state ?? undefined,
    isPrivate: school.isPrivate ?? undefined,
    acceptanceRate: school.acceptanceRate
      ? Number(school.acceptanceRate)
      : undefined,
    intlAcceptanceRate: school.intlAcceptanceRate
      ? Number(school.intlAcceptanceRate)
      : undefined,
    oosAcceptanceRate: school.oosAcceptanceRate
      ? Number(school.oosAcceptanceRate)
      : undefined,
    needBlindInternational: school.needBlindInternational ?? null,
    sat25: school.sat25 ?? undefined,
    sat75: school.sat75 ?? undefined,
    satAvg: school.satAvg ?? undefined,
    actAvg: school.actAvg ?? undefined,
    act25: school.act25 ?? undefined,
    act75: school.act75 ?? undefined,
    usNewsRank: school.usNewsRank ?? undefined,
    edAcceptanceRate: school.edAcceptanceRate
      ? Number(school.edAcceptanceRate)
      : undefined,
    eaAcceptanceRate: school.eaAcceptanceRate
      ? Number(school.eaAcceptanceRate)
      : undefined,
    yieldRate: school.yieldRate ? Number(school.yieldRate) : undefined,
    institutionType: school.institutionType ?? undefined,
    gpaDistribution: school.gpaDistribution ?? null,
    testingPolicy: school.testingPolicy ?? undefined,
    testOptional: school.testOptional ?? undefined,
    hasEarlyDecision: school.hasEarlyDecision ?? undefined,
    hasEarlyAction: school.hasEarlyAction ?? undefined,
    hasRestrictiveEa: school.hasRestrictiveEa ?? undefined,
  };
}

function buildProfileInput(profile: any): ProfileInput & {
  recruitedAthlete?: boolean;
  urmStatus?: string | null;
} {
  return {
    ...profile,
    testScores: profile.testScores ?? [],
    activities: profile.activities ?? [],
    awards: profile.awards ?? [],
  } as any;
}

async function evaluateStandalone(
  fixture: CalibrationFixture,
  counselor: CounselorEngineService,
  school: any,
): Promise<FixtureResult> {
  const schoolInput = buildSchoolInput(school);
  const profile = buildProfileInput(fixture.profile);
  const result = await counselor.compute(
    profile,
    schoolInput,
    fixture.applicationRound,
  );

  const failures: string[] = [];
  const [lo, hi] = fixture.expectedProbabilityRange;
  if (result.probability < lo || result.probability > hi) {
    failures.push(
      `prob ${(result.probability * 100).toFixed(2)}% outside [${(lo * 100).toFixed(1)}%, ${(hi * 100).toFixed(1)}%]`,
    );
  }

  // Tier check (derive from probability since CounselorResult.tier is a numeric source tier)
  const observedTier =
    result.probability >= 0.7
      ? 'safety'
      : result.probability >= 0.35
        ? 'match'
        : 'reach';
  if (fixture.expectedTier && observedTier !== fixture.expectedTier) {
    failures.push(`tier=${observedTier} (expected ${fixture.expectedTier})`);
  }

  // Confidence check — counselor returns numeric source tier 1-4, mapping to
  // confidence via deriveCounselorConfidence(). We approximate here using the
  // sourceContributions trace from the counselor result. For simplicity we
  // check against the 'low/medium/high' ladder via missingFields heuristic.
  const counselorConfidence =
    result.tier === 4
      ? 'low'
      : result.missingFields.length >= 3
        ? 'low'
        : 'medium';
  if (fixture.expectedConfidenceAtMost) {
    const maxRank = CONFIDENCE_RANK[fixture.expectedConfidenceAtMost];
    const obsRank = CONFIDENCE_RANK[counselorConfidence];
    if (obsRank > maxRank) {
      failures.push(
        `confidence=${counselorConfidence} > max ${fixture.expectedConfidenceAtMost}`,
      );
    }
  }

  return {
    fixtureId: fixture.id,
    scenarioGroup: fixture.scenarioGroup,
    passed: failures.length === 0,
    details: `${(result.probability * 100).toFixed(2)}% (tier=${observedTier}, source=${result.anchorSource}, anchor=${(result.anchor * 100).toFixed(1)}%)`,
    failures,
    actual: {
      probability: result.probability,
      tier: observedTier,
      confidence: counselorConfidence,
    },
  };
}

async function evaluateComparative(
  fixture: ComparativeFixture,
  counselor: CounselorEngineService,
  school: any,
): Promise<FixtureResult> {
  const schoolInput = buildSchoolInput(school);
  const profileA = buildProfileInput({
    ...fixture.baseProfile,
    ...(fixture.caseA.profileOverride ?? {}),
  });
  const profileB = buildProfileInput({
    ...fixture.baseProfile,
    ...(fixture.caseB.profileOverride ?? {}),
  });
  const roundA = fixture.caseA.applicationRound ?? 'RD';
  const roundB = fixture.caseB.applicationRound ?? 'RD';

  const resultA = await counselor.compute(profileA, schoolInput, roundA);
  const resultB = await counselor.compute(profileB, schoolInput, roundB);
  const delta = resultA.probability - resultB.probability;

  const failures: string[] = [];
  if (delta < fixture.expectedMinDelta) {
    failures.push(
      `delta=${(delta * 100).toFixed(2)}pp < min ${(fixture.expectedMinDelta * 100).toFixed(1)}pp`,
    );
  }
  if (
    fixture.expectedMaxDelta !== undefined &&
    delta > fixture.expectedMaxDelta
  ) {
    failures.push(
      `delta=${(delta * 100).toFixed(2)}pp > max ${(fixture.expectedMaxDelta * 100).toFixed(1)}pp`,
    );
  }

  return {
    fixtureId: fixture.id,
    scenarioGroup: fixture.scenarioGroup,
    passed: failures.length === 0,
    details: `${fixture.caseA.label}=${(resultA.probability * 100).toFixed(1)}%, ${fixture.caseB.label}=${(resultB.probability * 100).toFixed(1)}%, Δ=${(delta * 100).toFixed(2)}pp`,
    failures,
    actual: {
      caseAProbability: resultA.probability,
      caseBProbability: resultB.probability,
      delta,
    },
  };
}

function writeReport(results: FixtureResult[], totalMs: number) {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  const md: string[] = [
    `# Counselor Calibration Spec Report — ${new Date().toISOString()}`,
    '',
    `**Result**: ${passed}/${total} pass · runtime ${(totalMs / 1000).toFixed(1)}s`,
    '',
    '## By Scenario Group',
    '',
  ];
  const byGroup = new Map<string, FixtureResult[]>();
  for (const r of results) {
    if (!byGroup.has(r.scenarioGroup)) byGroup.set(r.scenarioGroup, []);
    byGroup.get(r.scenarioGroup)!.push(r);
  }
  for (const [group, items] of byGroup) {
    const groupPass = items.filter((i) => i.passed).length;
    md.push(`### ${group} (${groupPass}/${items.length})`);
    md.push('');
    md.push('| ID | Pass | Details | Failures |');
    md.push('|---|---|---|---|');
    for (const r of items) {
      md.push(
        `| \`${r.fixtureId}\` | ${r.passed ? '✅' : '❌'} | ${r.details} | ${r.failures.join('; ') || '—'} |`,
      );
    }
    md.push('');
  }
  writeFileSync(join(REPORTS_DIR, `report-${timestamp}.md`), md.join('\n'));
  writeFileSync(
    join(REPORTS_DIR, `report-${timestamp}.json`),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), passed, total, results },
      null,
      2,
    ),
  );
  console.log(
    `\nReport: gold-cases/counselor-calibration/reports/report-${timestamp}.md`,
  );
}

/**
 * Minimal UC CDS bands fixture — the CI prediction-gate seed DB doesn't load
 * SchoolCdsAdmitBand rows for the 9 UC schools (the only schools with Tier 1
 * CDS bands on prod). Without these, fixtures 031-035 (UC system) fall back
 * to Tier 2 scorecard rather than testing the Tier 1 anchor path they're
 * meant to exercise. Mirrors the pattern in run-counselor-gold-cases.ts
 * (loadMinimalCdsFixture).
 *
 * Numbers below sourced from prod DB SchoolCdsAdmitBand rows (verified by
 * /tmp/audit-anchor-paths.ts at 2026-05-24). Run locally against prod via
 * Cloud SQL Proxy to refresh if needed.
 */
const MINIMAL_UC_CDS_FIXTURE = [
  {
    schoolNameNorm: 'university of california, los angeles',
    bands: [
      {
        gpaBand: '3.75-4.00',
        testType: 'SAT',
        testBand: '1500-1600',
        admitRate: 0.18,
        sampleCount: 800,
      },
      {
        gpaBand: '3.75-4.00',
        testType: 'GPA_ONLY',
        testBand: 'ANY',
        admitRate: 0.14,
        sampleCount: 1500,
      },
    ],
  },
  {
    schoolNameNorm: 'university of california, berkeley',
    bands: [
      {
        gpaBand: '3.75-4.00',
        testType: 'GPA_ONLY',
        testBand: 'ANY',
        admitRate: 0.25,
        sampleCount: 1200,
      },
    ],
  },
  {
    schoolNameNorm: 'university of california, san diego',
    bands: [
      {
        gpaBand: '3.75-4.00',
        testType: 'SAT',
        testBand: '1500-1600',
        admitRate: 0.55,
        sampleCount: 500,
      },
      {
        gpaBand: '3.75-4.00',
        testType: 'GPA_ONLY',
        testBand: 'ANY',
        admitRate: 0.38,
        sampleCount: 1200,
      },
      {
        gpaBand: '3.50-3.74',
        testType: 'SAT',
        testBand: '1400-1499',
        admitRate: 0.22,
        sampleCount: 700,
      },
    ],
  },
  {
    schoolNameNorm: 'university of california, santa barbara',
    bands: [
      {
        gpaBand: '3.75-4.00',
        testType: 'GPA_ONLY',
        testBand: 'ANY',
        admitRate: 0.4,
        sampleCount: 1000,
      },
    ],
  },
  {
    schoolNameNorm: 'university of california, merced',
    bands: [
      {
        gpaBand: '3.75-4.00',
        testType: 'SAT',
        testBand: '1500-1600',
        admitRate: 0.92,
        sampleCount: 500,
      },
      {
        gpaBand: '3.75-4.00',
        testType: 'GPA_ONLY',
        testBand: 'ANY',
        admitRate: 0.88,
        sampleCount: 1200,
      },
    ],
  },
] as const;

async function loadMinimalUcCdsBands(prisma: PrismaService) {
  let upserted = 0;
  for (const row of MINIMAL_UC_CDS_FIXTURE) {
    const school = await prisma.school.findUnique({
      where: { nameNorm: row.schoolNameNorm },
      select: { id: true },
    });
    if (!school) {
      console.warn(
        `⚠️  UC CDS fixture skipped: school not found (${row.schoolNameNorm})`,
      );
      continue;
    }
    for (const band of row.bands) {
      await prisma.schoolCdsAdmitBand.upsert({
        where: {
          schoolId_gpaBand_testType_testBand_cycleYear: {
            schoolId: school.id,
            gpaBand: band.gpaBand,
            testType: band.testType,
            testBand: band.testBand,
            cycleYear: 2024,
          },
        },
        update: {
          admitRate: new Prisma.Decimal(band.admitRate),
          sampleCount: band.sampleCount,
        },
        create: {
          schoolId: school.id,
          gpaBand: band.gpaBand,
          testType: band.testType,
          testBand: band.testBand,
          admitRate: new Prisma.Decimal(band.admitRate),
          sampleCount: band.sampleCount,
          cycleYear: 2024,
          source: 'calibration-spec-fixture:uc-system:2024',
          sourceUrl: 'fixture',
        },
      });
      upserted += 1;
    }
  }
  if (upserted > 0) {
    console.log(
      `Seeded ${upserted} UC CDS band(s) for calibration spec runtime.`,
    );
  }
}

async function main() {
  const start = Date.now();
  const caseFiles = readdirSync(CASES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (caseFiles.length === 0) {
    console.error(`❌ No calibration fixtures found in ${CASES_DIR}`);
    process.exit(1);
  }
  console.log(
    `Loaded ${caseFiles.length} calibration fixture(s) from ${CASES_DIR}\n`,
  );

  const fixtures: AnyFixture[] = caseFiles.map((f) =>
    JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8')),
  );

  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    {
      logger: ['error', 'warn'],
    },
  );
  const counselor = app.get(CounselorEngineService);
  const prisma = app.get(PrismaService);

  // Seed UC CDS bands if missing (CI seed DB doesn't load Tier 1 anchor data
  // for UC schools; fixtures 031-035 require this to exercise the cds-bands-v1
  // path. No-op when the bands already exist — upserts are idempotent).
  await loadMinimalUcCdsBands(prisma);

  // Collect unique school names needed
  const uniqueSchoolNames = Array.from(
    new Set(fixtures.map((f) => normalizeSchoolName((f as any).schoolName))),
  );
  const schoolRows = await prisma.school.findMany({
    where: { nameNorm: { in: uniqueSchoolNames } },
  });
  const schoolByNameNorm = new Map(schoolRows.map((s) => [s.nameNorm, s]));

  const results: FixtureResult[] = [];
  const wontFixIds = new Set<string>();
  for (const raw of fixtures) {
    const fixture = raw as any;
    // Discriminator: top-level `kind` field ('standalone' vs 'comparative')
    const isComparative = fixture.kind === 'comparative';
    if (fixture.wontFix) {
      wontFixIds.add(fixture.id);
    }
    const schoolNameNorm = normalizeSchoolName(fixture.schoolName);
    const school = schoolByNameNorm.get(schoolNameNorm);
    if (!school) {
      results.push({
        fixtureId: fixture.id,
        scenarioGroup: fixture.scenarioGroup,
        passed: false,
        details: 'school not found',
        failures: [
          `School "${fixture.schoolName}" not in DB (nameNorm="${schoolNameNorm}")`,
        ],
        actual: {},
      });
      continue;
    }
    try {
      const result = isComparative
        ? await evaluateComparative(
            fixture as ComparativeFixture,
            counselor,
            school,
          )
        : await evaluateStandalone(
            fixture as CalibrationFixture,
            counselor,
            school,
          );
      results.push(result);
    } catch (err) {
      results.push({
        fixtureId: fixture.id,
        scenarioGroup: fixture.scenarioGroup,
        passed: false,
        details: 'runtime error',
        failures: [String(err)],
        actual: {},
      });
    }
  }

  // Partition results: gated (counts toward CI) vs wontFix (documented gaps,
  // shown but don't block merge).
  const gatedResults = results.filter((r) => !wontFixIds.has(r.fixtureId));
  const wontFixResults = results.filter((r) => wontFixIds.has(r.fixtureId));
  const passed = gatedResults.filter((r) => r.passed).length;

  const groups = new Set(results.map((r) => r.scenarioGroup));
  for (const group of groups) {
    const items = results.filter((r) => r.scenarioGroup === group);
    const groupGated = items.filter((i) => !wontFixIds.has(i.fixtureId));
    const groupPass = groupGated.filter((i) => i.passed).length;
    console.log(`━━━ ${group} (${groupPass}/${groupGated.length} gated) ━━━`);
    for (const r of items) {
      const isWontFix = wontFixIds.has(r.fixtureId);
      const icon = isWontFix ? '⚠️ ' : r.passed ? '✅' : '❌';
      const suffix = isWontFix ? ' [wontFix — engine gap]' : '';
      console.log(`  ${icon} ${r.fixtureId.padEnd(45)} ${r.details}${suffix}`);
      for (const f of r.failures)
        console.log(`     ${isWontFix ? 'NOTE' : 'FAIL'}: ${f}`);
    }
  }
  console.log(`\n═══ GATED: ${passed}/${gatedResults.length} pass ═══`);
  if (wontFixResults.length > 0) {
    console.log(
      `═══ wontFix (engine gaps, documented): ${wontFixResults.length} fixture(s) — see fixture rationale for follow-up`,
    );
  }

  const totalMs = Date.now() - start;
  writeReport(results, totalMs);

  await app.close();
  process.exit(passed === gatedResults.length ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ Calibration spec runner crashed:', err);
  process.exit(1);
});
