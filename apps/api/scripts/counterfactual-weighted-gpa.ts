#!/usr/bin/env tsx
/**
 * Counterfactual: weighted-GPA distribution contamination.
 *
 * Compares current counselor engine output vs Option A (null-out the
 * gpaDistribution for SEVERE-tier schools, forcing the heuristic SAT-band
 * fallback in gpaBandMultiplier).
 *
 * Schools:
 *   - Stanford (SEVERE)
 *   - MIT       (SEVERE)
 *   - UCLA      (SEVERE)
 *   - Smith     (HIGH)
 *   - Williams  (control — no gpaDistribution data)
 *
 * Applicants: Perfect / Strong / Below-median (all unweighted 4.0 scale).
 *
 * No engine or DB writes — Option A is simulated by passing a copy of the
 * school row with gpaDistribution = null before each "Option A" compute.
 */

import { NestFactory } from '@nestjs/core';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PrismaService } from '../src/prisma/prisma.service';

function buildSchoolInput(school: any, opts?: { nullDistribution?: boolean }) {
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
    gpaDistribution: opts?.nullDistribution
      ? null
      : (school.gpaDistribution ?? null),
    testingPolicy: school.testingPolicy ?? undefined,
    testOptional: school.testOptional ?? undefined,
    hasEarlyDecision: school.hasEarlyDecision ?? undefined,
    hasEarlyAction: school.hasEarlyAction ?? undefined,
    hasRestrictiveEa: school.hasRestrictiveEa ?? undefined,
  };
}

const TARGET_SCHOOLS = [
  { name: 'Stanford University', label: 'Stanford', sev: 'SEVERE' },
  {
    name: 'Massachusetts Institute of Technology',
    label: 'MIT',
    sev: 'SEVERE',
  },
  {
    name: 'University of California, Los Angeles',
    label: 'UCLA',
    sev: 'SEVERE',
  },
  { name: 'Smith College', label: 'Smith', sev: 'HIGH' },
  { name: 'Williams College', label: 'Williams', sev: 'CONTROL' },
];

const APPLICANTS = [
  { label: 'Perfect (4.00 / 1560)', gpa: 4.0, sat: 1560 },
  { label: 'Strong (3.85 / 1500)', gpa: 3.85, sat: 1500 },
  { label: 'BelowMed (3.60 / 1430)', gpa: 3.6, sat: 1430 },
];

function buildProfile(gpa: number, sat: number) {
  return {
    gpa,
    gpaScale: 4.0,
    isInternational: false,
    nationality: 'US',
    stateOfResidence: 'NY', // OOS for UCLA, neutral for others
    targetMajor: 'Computer Science',
    isLegacy: false,
    isFirstGen: false,
    recruitedAthlete: false,
    testScores: [{ type: 'SAT', score: sat }],
    activities: [
      {
        name: 'Activity 1',
        category: 'ACADEMIC',
        role: 'President',
        hoursPerWeek: 8,
        weeksPerYear: 30,
        yearsActive: 3,
      },
      {
        name: 'Activity 2',
        category: 'LEADERSHIP',
        role: 'Member',
        hoursPerWeek: 6,
        weeksPerYear: 30,
        yearsActive: 3,
      },
      {
        name: 'Activity 3',
        category: 'COMMUNITY_SERVICE',
        role: 'Member',
        hoursPerWeek: 4,
        weeksPerYear: 30,
        yearsActive: 2,
      },
    ],
    awards: [{ name: 'National Award', level: 'NATIONAL', year: 2025 }],
  };
}

async function main() {
  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    { logger: ['error'] },
  );
  const counselor = app.get(CounselorEngineService);
  const prisma = app.get(PrismaService);

  const schoolRows = await prisma.school.findMany({
    where: {
      nameNorm: {
        in: TARGET_SCHOOLS.map((s) => s.name.toLowerCase().trim()),
      },
    },
  });
  const schoolMap = new Map(schoolRows.map((s) => [s.nameNorm, s]));

  type Row = {
    school: string;
    sev: string;
    applicant: string;
    current: number;
    optionA: number;
    delta: number;
    anchor: number;
    tier: number;
    distEntries: number;
    gpaMultCurrent: number;
    gpaMultOptionA: number;
    gpaLabelCurrent: string;
  };

  const rows: Row[] = [];

  for (const sch of TARGET_SCHOOLS) {
    const row = schoolMap.get(sch.name.toLowerCase().trim());
    if (!row) {
      console.error(`MISSING SCHOOL: ${sch.name}`);
      continue;
    }
    const distEntries =
      row.gpaDistribution && typeof row.gpaDistribution === 'object'
        ? Object.keys(row.gpaDistribution as Record<string, unknown>).length
        : 0;
    const anchorRate = row.acceptanceRate ? Number(row.acceptanceRate) : 0;

    for (const a of APPLICANTS) {
      const profile = buildProfile(a.gpa, a.sat);
      const current = await counselor.compute(
        profile as any,
        buildSchoolInput(row) as any,
        'RD',
      );
      const optionA = await counselor.compute(
        profile as any,
        buildSchoolInput(row, { nullDistribution: true }) as any,
        'RD',
      );
      rows.push({
        school: sch.label,
        sev: sch.sev,
        applicant: a.label,
        current: current.probability,
        optionA: optionA.probability,
        delta: optionA.probability - current.probability,
        anchor: current.anchor,
        tier: current.tier,
        distEntries,
        gpaMultCurrent: current.modifierResults.gpaBand?.multiplier ?? 1,
        gpaMultOptionA: optionA.modifierResults.gpaBand?.multiplier ?? 1,
        gpaLabelCurrent: current.modifierResults.gpaBand?.label ?? '?',
      });
    }
  }

  // ── Print formatted table ──────────────────────────────────────────────
  console.log('\n## Counterfactual: weighted-GPA contamination — Option A\n');
  console.log(
    'Engine: current behavior (uses school.gpaDistribution if present)',
  );
  console.log(
    'Option A: null-out gpaDistribution → falls back to SAT-band heuristic\n',
  );
  console.log(
    [
      'school',
      'sev',
      'applicant',
      'anchor%',
      't',
      'distN',
      'current%',
      'optA%',
      'Δpp',
      'gpaMult_now',
      'gpaMult_A',
      'gpaPath_now',
    ].join('\t'),
  );
  for (const r of rows) {
    console.log(
      [
        r.school,
        r.sev,
        r.applicant,
        (r.anchor * 100).toFixed(2),
        r.tier,
        r.distEntries,
        (r.current * 100).toFixed(2),
        (r.optionA * 100).toFixed(2),
        ((r.optionA - r.current) * 100).toFixed(2),
        r.gpaMultCurrent.toFixed(2),
        r.gpaMultOptionA.toFixed(2),
        r.gpaLabelCurrent,
      ].join('\t'),
    );
  }

  console.log('\n## Per-school summary\n');
  for (const sch of TARGET_SCHOOLS) {
    const schRows = rows.filter((r) => r.school === sch.label);
    if (!schRows.length) continue;
    console.log(
      `\n### ${sch.label} (${sch.sev}, anchor ${(schRows[0].anchor * 100).toFixed(2)}%, distEntries=${schRows[0].distEntries})`,
    );
    for (const r of schRows) {
      console.log(
        `  ${r.applicant.padEnd(26)}  current=${(r.current * 100).toFixed(2)}%  optA=${(r.optionA * 100).toFixed(2)}%  Δ=${((r.optionA - r.current) * 100).toFixed(2)}pp  (gpaMult: ${r.gpaMultCurrent.toFixed(2)} → ${r.gpaMultOptionA.toFixed(2)})`,
      );
    }
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
