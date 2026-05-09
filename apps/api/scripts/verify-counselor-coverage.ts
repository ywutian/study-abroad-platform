#!/usr/bin/env -S ts-node --transpile-only
/**
 * Counselor 240 x 13 coverage verifier.
 *
 * Boots the counselor engine in-process, runs every US school against a fixed
 * archetype matrix, validates numeric Tier 1-3 outputs, and writes reports to
 * verification-report/phase-b by default. If --launch is provided, reports are
 * written under verification-report/launch. If --baseline <json> is provided, it
 * also emits Phase C delta diagnostics against a prior coverage report.
 */

import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PredictionTransformerService } from '../src/modules/prediction/prediction-transformer.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { ProfileInput } from '../src/modules/prediction/prediction.prompts';

const EPSILON = 1e-6;
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = resolve(REPO_ROOT, 'verification-report', 'phase-b');

type Archetype = {
  id: string;
  round?: string;
  profile: ProfileInput | any;
};

type CoverageRow = {
  schoolId: string;
  schoolName: string;
  archetype: string;
  probability: number | null;
  counselorTier: number;
  anchor: number;
  anchorSource: string;
  ruleVersion: string;
  anomalies: string[];
};

const ARCHETYPES: Archetype[] = [
  {
    id: 'strong-intl-china-ed',
    round: 'ED',
    profile: {
      gpa: 3.95,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      isInternational: true,
      nationality: 'CN',
      highSchoolLocation: 'CN',
      testScores: [{ type: 'SAT', score: 1560 }],
      activities: Array.from({ length: 10 }, (_, i) => ({
        name: `Activity ${i + 1}`,
      })),
      awards: Array.from({ length: 3 }, (_, i) => ({ name: `Award ${i + 1}` })),
    },
  },
  {
    id: 'strong-domestic-rd',
    round: 'RD',
    profile: {
      gpa: 4.0,
      gpaScale: 4,
      targetMajor: 'Economics',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      testScores: [{ type: 'SAT', score: 1550 }],
      activities: Array.from({ length: 10 }, (_, i) => ({
        name: `Activity ${i + 1}`,
      })),
      awards: [{ name: 'National Merit' }],
    },
  },
  {
    id: 'mid-intl-rd',
    round: 'RD',
    profile: {
      gpa: 3.7,
      gpaScale: 4,
      targetMajor: 'Business',
      isInternational: true,
      nationality: 'IN',
      highSchoolLocation: 'IN',
      testScores: [{ type: 'SAT', score: 1380 }],
      activities: Array.from({ length: 4 }, (_, i) => ({
        name: `Activity ${i + 1}`,
      })),
      awards: [],
    },
  },
  {
    id: 'mid-domestic-rd',
    round: 'RD',
    profile: {
      gpa: 3.6,
      gpaScale: 4,
      targetMajor: 'Biology',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      testScores: [{ type: 'SAT', score: 1300 }],
      activities: Array.from({ length: 3 }, (_, i) => ({
        name: `Activity ${i + 1}`,
      })),
      awards: [],
    },
  },
  {
    id: 'weak-rd',
    round: 'RD',
    profile: {
      gpa: 3.2,
      gpaScale: 4,
      targetMajor: 'Psychology',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      testScores: [{ type: 'SAT', score: 1200 }],
      activities: [{ name: 'Club member' }, { name: 'Volunteer' }],
      awards: [],
    },
  },
  {
    id: 'first-gen-rd',
    round: 'RD',
    profile: {
      gpa: 3.7,
      gpaScale: 4,
      targetMajor: 'Political Science',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      isFirstGen: true,
      testScores: [{ type: 'SAT', score: 1400 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'legacy-ed',
    round: 'ED',
    profile: {
      gpa: 3.85,
      gpaScale: 4,
      targetMajor: 'English',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      isLegacy: true,
      legacySchools: [],
      testScores: [{ type: 'SAT', score: 1480 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'recruited-athlete-ea',
    round: 'EA',
    profile: {
      gpa: 3.5,
      gpaScale: 4,
      targetMajor: 'Sociology',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      recruitedAthlete: true,
      testScores: [{ type: 'SAT', score: 1300 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'need-aware-intl-rd',
    round: 'RD',
    profile: {
      gpa: 3.8,
      gpaScale: 4,
      targetMajor: 'Mathematics',
      isInternational: true,
      nationality: 'CN',
      highSchoolLocation: 'CN',
      needsFinancialAid: true,
      testScores: [{ type: 'SAT', score: 1450 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'no-sat-test-optional',
    round: 'RD',
    profile: {
      gpa: 3.85,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      applyingTestOptional: true,
      testScores: [],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'spike-usamo-rd',
    round: 'RD',
    profile: {
      gpa: 3.9,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      testScores: [{ type: 'SAT', score: 1500 }],
      activities: Array.from({ length: 5 }, (_, i) => ({
        name: `STEM activity ${i + 1}`,
        category: 'ACADEMIC',
        role: i === 0 ? 'Founder' : 'Member',
      })),
      awards: [
        {
          name: 'USAMO qualifier',
          level: 'National',
          tier: 1,
          competitionName: 'USAMO',
        },
      ],
    },
  },
  {
    id: 'missing-gpa-sat-only',
    round: 'RD',
    profile: {
      targetMajor: 'Engineering',
      isInternational: false,
      nationality: 'US',
      highSchoolLocation: 'US',
      testScores: [{ type: 'SAT', score: 1500 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'empty-profile',
    round: 'RD',
    profile: {
      testScores: [],
      activities: [],
      awards: [],
    },
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const baselineIndex = args.indexOf('--baseline');
  return {
    reportDir: args.includes('--launch')
      ? resolve(REPO_ROOT, 'verification-report', 'launch')
      : args.includes('--phase-c')
        ? resolve(REPO_ROOT, 'verification-report', 'phase-c')
        : REPORT_DIR,
    baseline:
      baselineIndex >= 0 && args[baselineIndex + 1]
        ? resolve(process.cwd(), args[baselineIndex + 1])
        : null,
  };
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

function validateRow(
  row: CoverageRow,
  modifiers: Record<string, { multiplier: number }>,
) {
  if (row.counselorTier === 4) return;
  if (row.probability == null || !Number.isFinite(row.probability)) {
    row.anomalies.push('probability_not_finite');
  } else if (
    row.probability < 0.02 - EPSILON ||
    row.probability > 0.98 + EPSILON
  ) {
    row.anomalies.push('probability_out_of_range');
  }

  for (const [name, modifier] of Object.entries(modifiers)) {
    if (
      !Number.isFinite(modifier.multiplier) ||
      modifier.multiplier < 0.1 ||
      modifier.multiplier > 10
    ) {
      row.anomalies.push(`modifier_${name}_out_of_range`);
    }
  }

  const lower = Math.max(0.02, row.anchor * 0.3);
  const upper = Math.min(0.98, row.anchor * 2.5);
  if (
    row.probability != null &&
    (row.probability < lower - 0.001 || row.probability > upper + 0.001)
  ) {
    row.anomalies.push('anchor_bound_violation');
  }
}

function writeCsv(rows: CoverageRow[], path: string) {
  const header = [
    'schoolId',
    'schoolName',
    'archetype',
    'probability',
    'counselorTier',
    'anchor',
    'anchorSource',
    'ruleVersion',
    'anomalies',
  ];
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.schoolId,
        `"${row.schoolName.replace(/"/g, '""')}"`,
        row.archetype,
        row.probability ?? '',
        row.counselorTier,
        row.anchor,
        row.anchorSource,
        row.ruleVersion,
        `"${row.anomalies.join(';')}"`,
      ].join(','),
    ),
  ];
  writeFileSync(path, lines.join('\n'));
}

async function main() {
  const args = parseArgs();
  mkdirSync(args.reportDir, { recursive: true });

  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    {
      logger: ['error', 'warn'],
    },
  );
  const counselor = app.get(CounselorEngineService);
  const prisma = app.get(PrismaService);
  const transformer = app.get(PredictionTransformerService);

  const schools = await prisma.school.findMany({
    where: { country: 'US' },
    orderBy: { name: 'asc' },
  });
  const rows: CoverageRow[] = [];
  const tierCounts = new Map<number, number>();

  for (const school of schools) {
    const schoolInput = transformer.schoolToInput(school as any);
    for (const archetype of ARCHETYPES) {
      const result = await counselor.compute(
        archetype.profile,
        schoolInput,
        archetype.round,
      );
      const row: CoverageRow = {
        schoolId: school.id,
        schoolName: school.name,
        archetype: archetype.id,
        probability: result.tier === 4 ? null : result.probability,
        counselorTier: result.tier,
        anchor: result.anchor,
        anchorSource: result.anchorSource,
        ruleVersion: result.ruleVersion,
        anomalies: [],
      };
      validateRow(
        row,
        result.modifierResults as Record<string, { multiplier: number }>,
      );
      rows.push(row);
      tierCounts.set(result.tier, (tierCounts.get(result.tier) ?? 0) + 1);
    }
  }

  const anomalies = rows.filter((row) => row.anomalies.length > 0);
  const probabilities = rows
    .map((row) => row.probability)
    .filter((value): value is number => value != null);
  const summary = {
    generatedAt: new Date().toISOString(),
    schoolCount: schools.length,
    archetypeCount: ARCHETYPES.length,
    pairCount: rows.length,
    validPairCount: rows.length - anomalies.length,
    anomalyCount: anomalies.length,
    tierDistribution: Object.fromEntries([...tierCounts.entries()].sort()),
    probability: {
      p50: percentile(probabilities, 50),
      p95: percentile(probabilities, 95),
      max: probabilities.length ? Math.max(...probabilities) : null,
    },
  };

  let phaseCDelta: unknown = undefined;
  if (args.baseline) {
    const baselineReport = JSON.parse(readFileSync(args.baseline, 'utf8')) as {
      rows: CoverageRow[];
    };
    const baselineByKey = new Map(
      baselineReport.rows.map((row) => [
        `${row.schoolId}:${row.archetype}`,
        row,
      ]),
    );
    const deltas = rows.flatMap((row) => {
      const prev = baselineByKey.get(`${row.schoolId}:${row.archetype}`);
      if (!prev || prev.probability == null || row.probability == null)
        return [];
      return [
        {
          schoolId: row.schoolId,
          schoolName: row.schoolName,
          archetype: row.archetype,
          delta: Math.abs(row.probability - prev.probability),
          current: row.probability,
          baseline: prev.probability,
        },
      ];
    });
    const byArchetype = Object.fromEntries(
      ARCHETYPES.map((archetype) => {
        const values = deltas
          .filter((row) => row.archetype === archetype.id)
          .map((row) => row.delta);
        return [
          archetype.id,
          { p95: percentile(values, 95), max: Math.max(0, ...values) },
        ];
      }),
    );
    const schoolMax = new Map<
      string,
      { schoolName: string; maxDelta: number }
    >();
    for (const row of deltas) {
      const current = schoolMax.get(row.schoolId);
      if (!current || row.delta > current.maxDelta) {
        schoolMax.set(row.schoolId, {
          schoolName: row.schoolName,
          maxDelta: row.delta,
        });
      }
    }
    phaseCDelta = {
      globalMax: Math.max(0, ...deltas.map((row) => row.delta)),
      perArchetype: byArchetype,
      manualReview: [...schoolMax.entries()]
        .filter(([, value]) => value.maxDelta > 0.3)
        .map(([schoolId, value]) => ({
          schoolId,
          ...value,
          classification: 'UNREVIEWED',
        }))
        .sort((a, b) => b.maxDelta - a.maxDelta),
      hardGate: {
        globalMaxLe040: Math.max(0, ...deltas.map((row) => row.delta)) <= 0.4,
        perArchetypeP95Le020: Object.values(byArchetype).every(
          (value: any) => value.p95 <= 0.2,
        ),
      },
    };
  }

  const report = { summary, phaseCDelta, rows, anomalies };
  const jsonPath = join(args.reportDir, 'coverage.json');
  const csvPath = join(args.reportDir, 'counselor-coverage.csv');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(
    join(args.reportDir, 'counselor-coverage.json'),
    JSON.stringify(report, null, 2),
  );
  writeCsv(rows, csvPath);
  await app.close();

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report: ${jsonPath}`);
  if (anomalies.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
