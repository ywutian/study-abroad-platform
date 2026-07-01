#!/usr/bin/env tsx
/**
 * Comprehensive prediction matrix.
 *
 * Runs a diverse profile × school × round × hook matrix through the
 * counselor engine to characterize prediction behavior across the input
 * space. Output is markdown + JSON for further analysis.
 *
 * Coverage axes:
 *   - Profile strength: weak / mid / strong / extreme
 *   - Major: STEM / humanities / business / undeclared
 *   - Nationality: US / CN / IN / GB
 *   - State: CA in-state / OOS
 *   - Hooks: none / first-gen / legacy / athlete / multi-hook
 *   - Rounds: RD / ED / EA / REA / UC
 *   - School tiers: T5 / T20 / T30 / T50 / Safety / LAC
 */

import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PrismaService } from '../src/prisma/prisma.service';

// Mirror of buildSchoolInput in run-counselor-calibration-spec.ts — converts
// Prisma Decimal types to numbers so the engine's normalizer works.
function buildSchoolInput(school: any): any {
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

interface ProfileTemplate {
  label: string;
  gpa: number;
  sat: number;
  activities: number; // count
  awardsLevel: 'NONE' | 'STATE' | 'NATIONAL' | 'INTERNATIONAL';
}

const PROFILE_TEMPLATES: ProfileTemplate[] = [
  { label: 'weak', gpa: 3.4, sat: 1280, activities: 2, awardsLevel: 'NONE' },
  { label: 'mid', gpa: 3.75, sat: 1400, activities: 3, awardsLevel: 'STATE' },
  {
    label: 'strong',
    gpa: 3.9,
    sat: 1490,
    activities: 4,
    awardsLevel: 'NATIONAL',
  },
  {
    label: 'extreme',
    gpa: 3.98,
    sat: 1560,
    activities: 5,
    awardsLevel: 'INTERNATIONAL',
  },
];

const SCHOOLS = [
  // T5
  { name: 'Massachusetts Institute of Technology', tier: 'T5' },
  { name: 'Harvard University', tier: 'T5' },
  { name: 'Stanford University', tier: 'T5' },
  // T10-20
  { name: 'University of Pennsylvania', tier: 'T10' },
  { name: 'Cornell University', tier: 'T15' },
  { name: 'University of Chicago', tier: 'T10' },
  // T20-30
  { name: 'University of Michigan, Ann Arbor', tier: 'T25' },
  { name: 'University of Virginia', tier: 'T25' },
  { name: 'University of North Carolina at Chapel Hill', tier: 'T30' },
  // T30-50 / Safety
  { name: 'Penn State University', tier: 'T50' },
  { name: 'Arizona State University', tier: 'Safety' },
  // LACs
  { name: 'Williams College', tier: 'T10-LAC' },
  { name: 'Amherst College', tier: 'T10-LAC' },
  // UC system (Tier 1 CDS)
  { name: 'University of California, Los Angeles', tier: 'UC' },
  { name: 'University of California, Berkeley', tier: 'UC' },
  { name: 'University of California, San Diego', tier: 'UC' },
  { name: 'University of California, Merced', tier: 'UC-Safety' },
];

const NATIONALITIES = ['US', 'CN', 'IN', 'GB'] as const;

interface HookProfile {
  label: string;
  isFirstGen?: boolean;
  isLegacy?: boolean;
  legacySchools?: string[];
  recruitedAthlete?: boolean;
}

const HOOKS: HookProfile[] = [
  { label: 'none' },
  { label: 'first-gen', isFirstGen: true },
  {
    label: 'legacy-self-reported',
    isLegacy: true,
    legacySchools: ['Harvard University'],
  },
  { label: 'athlete-self-reported', recruitedAthlete: true },
];

interface MatrixRow {
  profile: string;
  school: string;
  tier: string;
  round: string;
  nationality: string;
  state: string;
  hook: string;
  probability: number;
  predictedTier: string;
  confidence: string;
  anchor: number;
  anchorSource: string;
}

function buildProfile(
  template: ProfileTemplate,
  nationality: string,
  state: string | null,
  major: string,
  hook: HookProfile,
) {
  const activities = Array.from({ length: template.activities }, (_, i) => ({
    name: `Activity ${i + 1}`,
    category:
      i === 0 ? 'ACADEMIC' : i === 1 ? 'LEADERSHIP' : 'COMMUNITY_SERVICE',
    role: i === 0 ? 'President' : 'Member',
    hoursPerWeek: 8 - i,
    weeksPerYear: 30,
    yearsActive: 3,
  }));

  const awards =
    template.awardsLevel === 'NONE'
      ? []
      : [
          {
            name: `${template.awardsLevel} Award`,
            level: template.awardsLevel as
              'STATE' | 'NATIONAL' | 'INTERNATIONAL',
            year: 2025,
          },
        ];

  return {
    gpa: template.gpa,
    gpaScale: 4.0,
    isInternational: nationality !== 'US',
    nationality,
    stateOfResidence: state ?? undefined,
    currentSchoolType:
      nationality !== 'US' ? ('INTERNATIONAL' as const) : undefined,
    targetMajor: major,
    isLegacy: hook.isLegacy ?? false,
    legacySchools: hook.legacySchools,
    isFirstGen: hook.isFirstGen ?? false,
    recruitedAthlete: hook.recruitedAthlete ?? false,
    testScores: [{ type: 'SAT', score: template.sat }],
    activities,
    awards,
  };
}

async function main() {
  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    {
      logger: ['error'],
    },
  );
  const counselor = app.get(CounselorEngineService);
  const prisma = app.get(PrismaService);

  // Load all schools we'll test against
  const schoolRows = await prisma.school.findMany({
    where: {
      nameNorm: {
        in: SCHOOLS.map((s) => s.name.toLowerCase().trim()),
      },
    },
  });
  const schoolMap = new Map(schoolRows.map((s) => [s.nameNorm, s]));

  const rows: MatrixRow[] = [];

  // ─── Section 1: profile × school × round (US domestic, no hook) ──────────
  for (const template of PROFILE_TEMPLATES) {
    for (const school of SCHOOLS) {
      const schoolRow = schoolMap.get(school.name.toLowerCase().trim());
      if (!schoolRow) continue;

      const profile = buildProfile(template, 'US', null, 'Computer Science', {
        label: 'none',
      });

      for (const round of ['RD', 'ED', 'EA']) {
        const result = await counselor.compute(
          profile as any,
          buildSchoolInput(schoolRow) as any,
          round,
        );
        rows.push({
          profile: template.label,
          school: school.name,
          tier: school.tier,
          round,
          nationality: 'US',
          state: '—',
          hook: 'none',
          probability: result.probability,
          predictedTier: result.factors[0]?.detail?.includes('Anchored')
            ? result.probability < 0.2
              ? 'reach'
              : result.probability < 0.7
                ? 'match'
                : 'safety'
            : '—',
          confidence:
            result.tier === 4 ? 'tier4-insufficient' : `tier${result.tier}`,
          anchor: result.anchor,
          anchorSource: result.anchorSource,
        });
      }
    }
  }

  // ─── Section 2: International penalty (strong profile, T5/T20) ───────────
  for (const nationality of NATIONALITIES) {
    for (const schoolName of [
      'Harvard University',
      'University of Pennsylvania',
      'University of Michigan, Ann Arbor',
      'University of California, Berkeley',
    ]) {
      const schoolRow = schoolMap.get(schoolName.toLowerCase().trim());
      if (!schoolRow) continue;

      const profile = buildProfile(
        PROFILE_TEMPLATES[2], // strong
        nationality,
        null,
        'Economics',
        { label: 'none' },
      );

      const result = await counselor.compute(
        profile as any,
        buildSchoolInput(schoolRow) as any,
        'RD',
      );
      rows.push({
        profile: 'strong',
        school: schoolName,
        tier: SCHOOLS.find((s) => s.name === schoolName)?.tier ?? '?',
        round: 'RD',
        nationality,
        state: '—',
        hook: 'none',
        probability: result.probability,
        predictedTier:
          result.probability < 0.2
            ? 'reach'
            : result.probability < 0.7
              ? 'match'
              : 'safety',
        confidence: `tier${result.tier}`,
        anchor: result.anchor,
        anchorSource: result.anchorSource,
      });
    }
  }

  // ─── Section 3: In-state vs OOS (UC + T30 publics) ───────────────────────
  for (const state of ['CA', 'TX']) {
    for (const schoolName of [
      'University of California, Berkeley',
      'University of California, Los Angeles',
      'University of California, San Diego',
      'University of Michigan, Ann Arbor',
      'University of North Carolina at Chapel Hill',
    ]) {
      const schoolRow = schoolMap.get(schoolName.toLowerCase().trim());
      if (!schoolRow) continue;

      const profile = buildProfile(
        PROFILE_TEMPLATES[2], // strong
        'US',
        state,
        'Biology',
        { label: 'none' },
      );

      const result = await counselor.compute(
        profile as any,
        buildSchoolInput(schoolRow) as any,
        'RD',
      );
      rows.push({
        profile: 'strong',
        school: schoolName,
        tier: SCHOOLS.find((s) => s.name === schoolName)?.tier ?? '?',
        round: 'RD',
        nationality: 'US',
        state,
        hook: 'none',
        probability: result.probability,
        predictedTier:
          result.probability < 0.2
            ? 'reach'
            : result.probability < 0.7
              ? 'match'
              : 'safety',
        confidence: `tier${result.tier}`,
        anchor: result.anchor,
        anchorSource: result.anchorSource,
      });
    }
  }

  // ─── Section 4: Hook stacking (strong profile, T5/T20) ───────────────────
  for (const hook of HOOKS) {
    for (const schoolName of [
      'Harvard University',
      'Stanford University',
      'University of Pennsylvania',
    ]) {
      const schoolRow = schoolMap.get(schoolName.toLowerCase().trim());
      if (!schoolRow) continue;

      const profile = buildProfile(
        PROFILE_TEMPLATES[2], // strong
        'US',
        null,
        'Economics',
        hook,
      );

      const result = await counselor.compute(
        profile as any,
        buildSchoolInput(schoolRow) as any,
        'RD',
      );
      rows.push({
        profile: 'strong',
        school: schoolName,
        tier: SCHOOLS.find((s) => s.name === schoolName)?.tier ?? '?',
        round: 'RD',
        nationality: 'US',
        state: '—',
        hook: hook.label,
        probability: result.probability,
        predictedTier:
          result.probability < 0.2
            ? 'reach'
            : result.probability < 0.7
              ? 'match'
              : 'safety',
        confidence: `tier${result.tier}`,
        anchor: result.anchor,
        anchorSource: result.anchorSource,
      });
    }
  }

  // ─── Section 5: Round comparison (Penn ED vs RD, strong) ─────────────────
  const pennRow = schoolMap.get('university of pennsylvania');
  if (pennRow) {
    for (const round of ['RD', 'ED', 'EA']) {
      const result = await counselor.compute(
        buildProfile(PROFILE_TEMPLATES[2], 'US', null, 'Economics', {
          label: 'none',
        }) as any,
        buildSchoolInput(pennRow) as any,
        round,
      );
      rows.push({
        profile: 'strong',
        school: 'University of Pennsylvania',
        tier: 'T10',
        round,
        nationality: 'US',
        state: '—',
        hook: 'none-round-compare',
        probability: result.probability,
        predictedTier:
          result.probability < 0.2
            ? 'reach'
            : result.probability < 0.7
              ? 'match'
              : 'safety',
        confidence: `tier${result.tier}`,
        anchor: result.anchor,
        anchorSource: result.anchorSource,
      });
    }
  }

  await app.close();
  return rows;
}

void main()
  .then((rows) => {
    // Write JSON
    const outDir = resolve(__dirname, '..', 'verification-report');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = `${outDir}/prediction-matrix-${ts}.json`;
    const mdPath = `${outDir}/prediction-matrix-${ts}.md`;

    writeFileSync(jsonPath, JSON.stringify(rows, null, 2), 'utf8');

    // Write markdown
    const lines: string[] = [];
    lines.push(`# Prediction Matrix Report — ${new Date().toISOString()}`);
    lines.push('');
    lines.push(`Total predictions: **${rows.length}**`);
    lines.push('');

    // Group 1: profile strength → probability (US domestic, RD, no hook)
    lines.push('## §1 Profile strength → probability (US RD, no hook)');
    lines.push('');
    lines.push(
      '| Profile | School | Tier | Anchor | Probability | Tier | Source |',
    );
    lines.push('|---|---|---|---|---|---|---|');
    rows
      .filter(
        (r) => r.hook === 'none' && r.round === 'RD' && r.nationality === 'US',
      )
      .forEach((r) => {
        lines.push(
          `| ${r.profile} | ${r.school} | ${r.tier} | ${(r.anchor * 100).toFixed(1)}% | **${(r.probability * 100).toFixed(2)}%** | ${r.predictedTier} | ${r.anchorSource} |`,
        );
      });
    lines.push('');

    // Group 2: international penalty
    lines.push('## §2 International penalty (strong profile, RD, no hook)');
    lines.push('');
    lines.push('| School | Nationality | Anchor | Probability | Tier |');
    lines.push('|---|---|---|---|---|');
    rows
      .filter(
        (r) =>
          r.profile === 'strong' &&
          r.state === '—' &&
          r.hook === 'none' &&
          r.round === 'RD',
      )
      .forEach((r) => {
        lines.push(
          `| ${r.school} | ${r.nationality} | ${(r.anchor * 100).toFixed(1)}% | **${(r.probability * 100).toFixed(2)}%** | ${r.predictedTier} |`,
        );
      });
    lines.push('');

    // Group 3: in-state vs OOS
    lines.push('## §3 In-state vs OOS (strong profile, RD, US, no hook)');
    lines.push('');
    lines.push('| School | State | Anchor | Probability | Tier |');
    lines.push('|---|---|---|---|---|');
    rows
      .filter(
        (r) => r.profile === 'strong' && r.state !== '—' && r.hook === 'none',
      )
      .forEach((r) => {
        lines.push(
          `| ${r.school} | ${r.state} | ${(r.anchor * 100).toFixed(1)}% | **${(r.probability * 100).toFixed(2)}%** | ${r.predictedTier} |`,
        );
      });
    lines.push('');

    // Group 4: hook stacking
    lines.push('## §4 Hook effect (strong profile, T5/T10, RD, US)');
    lines.push('');
    lines.push('| School | Hook | Anchor | Probability | Tier |');
    lines.push('|---|---|---|---|---|');
    rows
      .filter(
        (r) =>
          r.profile === 'strong' &&
          [
            'none',
            'first-gen',
            'legacy-self-reported',
            'athlete-self-reported',
          ].includes(r.hook) &&
          r.nationality === 'US' &&
          r.state === '—' &&
          r.round === 'RD' &&
          [
            'Harvard University',
            'Stanford University',
            'University of Pennsylvania',
          ].includes(r.school),
      )
      .forEach((r) => {
        lines.push(
          `| ${r.school} | ${r.hook} | ${(r.anchor * 100).toFixed(1)}% | **${(r.probability * 100).toFixed(2)}%** | ${r.predictedTier} |`,
        );
      });
    lines.push('');

    // Group 5: round comparison
    lines.push('## §5 Round comparison (Penn, strong profile, US no hook)');
    lines.push('');
    lines.push('| Round | Anchor | Probability | Tier |');
    lines.push('|---|---|---|---|');
    rows
      .filter((r) => r.hook === 'none-round-compare')
      .forEach((r) => {
        lines.push(
          `| ${r.round} | ${(r.anchor * 100).toFixed(1)}% | **${(r.probability * 100).toFixed(2)}%** | ${r.predictedTier} |`,
        );
      });
    lines.push('');

    writeFileSync(mdPath, lines.join('\n'), 'utf8');
    console.log(`\nWrote ${rows.length} predictions:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  Markdown: ${mdPath}\n`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
