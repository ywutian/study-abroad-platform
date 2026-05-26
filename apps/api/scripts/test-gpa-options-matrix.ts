#!/usr/bin/env tsx
/**
 * Comprehensive test matrix for 4 weighted-GPA fix options.
 *
 * Options under test:
 *   D — baseline (current engine, no fix)
 *   A — null-out gpaDistribution when SEVERE (top-band ≥92% AND <3.75 tail ≤5%)
 *   B — remap distribution: shift bands down by halving top-band weight, redistribute
 *   C — same as A + when applicant is TO (no SAT), apply mini-table GPA multiplier
 *
 * Test surfaces:
 *   1. All 50 Layer-3 calibration fixtures × 4 options → 200 results
 *   2. 22 SEVERE schools × 10 applicant archetypes × 4 options → 880 results
 *   3. Threshold sensitivity: top-band thresholds × tail thresholds × 50 fixtures
 *
 * Strategy: do NOT modify the engine. Wrap the SchoolInput passed into
 * counselor.compute() — that mutates only what we control. Engine reads
 * `school.gpaDistribution` directly from the input.
 *
 * Output: /tmp/gpa-options-comprehensive.md
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PrismaService } from '../src/prisma/prisma.service';

// ── Config ──────────────────────────────────────────────────────────────────
type OptionId = 'A' | 'B' | 'C' | 'D';
const OPTION_IDS: OptionId[] = ['A', 'B', 'C', 'D'];

const REPORT_PATH = '/tmp/gpa-options-comprehensive.md';
const RAW_JSON_PATH = '/tmp/gpa-options-comprehensive.json';

const CASES_DIR = resolve(
  __dirname,
  '..',
  'gold-cases',
  'counselor-calibration',
  'cases',
);

const DEFAULT_TOP_BAND_THRESHOLD = 0.92;
const DEFAULT_TAIL_THRESHOLD = 0.05;

// 22 SEVERE schools from audit-weighted-gpa.tsv
const SEVERE_SCHOOLS = [
  'California Institute of Technology',
  'Georgia Institute of Technology',
  'Massachusetts Institute of Technology',
  'Princeton University',
  'Yale University',
  'Stanford University',
  'Harvard University',
  'Northeastern University',
  'Columbia University',
  'Duke University',
  'University of California, Los Angeles',
  'Dartmouth College',
  'Brown University',
  'Johns Hopkins University',
  'Barnard College',
  'Cornell University',
  'University of Pennsylvania',
  'University of Chicago',
  'Vanderbilt University',
  'Washington University in St. Louis',
  'Carnegie Mellon University',
  'University of California, Berkeley',
];

// ── Option implementations ─────────────────────────────────────────────────

/**
 * Detect SEVERE distribution per audit definition.
 * Default: top-band ≥92% AND <3.75 tail ≤5%.
 * Tunable for sensitivity matrix.
 */
function isContaminated(
  dist: Record<string, number> | null | undefined,
  topThreshold: number = DEFAULT_TOP_BAND_THRESHOLD,
  tailThreshold: number = DEFAULT_TAIL_THRESHOLD,
): boolean {
  if (!dist) return false;
  const top = Number(dist['3.75-4.00'] ?? 0);
  const tail =
    Number(dist['<3.00'] ?? 0) +
    Number(dist['3.00-3.24'] ?? 0) +
    Number(dist['3.25-3.49'] ?? 0);
  return top >= topThreshold && tail <= tailThreshold;
}

/**
 * Option B remap: shift bands down 0.5 GPA worth.
 *
 * Strategy: a reported CDS distribution like {top:95%, mid:5%} on weighted
 * scale corresponds to roughly {top:50%, upper-mid:35%, mid:10%, low-mid:4%,
 * low:1%} on unweighted scale (assumes ~0.5 GPA inflation).
 *
 * Concrete remap formula (simplification — see methodology note in report):
 *   new[3.75-4.00] = old[3.75-4.00] × 0.5
 *   new[3.50-3.74] = old[3.75-4.00] × 0.35 + old[3.50-3.74] × 0.5
 *   new[3.25-3.49] = old[3.75-4.00] × 0.10 + old[3.50-3.74] × 0.35 + old[3.25-3.49]
 *   new[3.00-3.24] = old[3.75-4.00] × 0.04 + old[3.50-3.74] × 0.10 + old[3.00-3.24]
 *   new[<3.00]     = old[3.75-4.00] × 0.01 + old[3.50-3.74] × 0.05 + old[<3.00]
 *
 * Then renormalize to sum=1.
 */
function remapBandsDown(dist: Record<string, number>): Record<string, number> {
  const top = Number(dist['3.75-4.00'] ?? 0);
  const upper = Number(dist['3.50-3.74'] ?? 0);
  const mid = Number(dist['3.25-3.49'] ?? 0);
  const lowmid = Number(dist['3.00-3.24'] ?? 0);
  const low = Number(dist['<3.00'] ?? 0);

  const remap = {
    '3.75-4.00': top * 0.5,
    '3.50-3.74': top * 0.35 + upper * 0.5,
    '3.25-3.49': top * 0.1 + upper * 0.35 + mid,
    '3.00-3.24': top * 0.04 + upper * 0.1 + lowmid,
    '<3.00': top * 0.01 + upper * 0.05 + low,
  };
  const sum = Object.values(remap).reduce((s, v) => s + v, 0);
  if (sum <= 0) return dist;
  return Object.fromEntries(
    Object.entries(remap).map(([k, v]) => [k, v / sum]),
  );
}

/**
 * Option C post-processing: when applicant is test-optional (no SAT) AND
 * GPA is present AND school is TO-eligible, apply mini-table multiplier.
 * Applied AFTER engine compute, before clipping to school anchor bounds.
 */
function optionCTestOptionalAdjustment(
  prob: number,
  anchor: number,
  profile: { gpa?: number | null; testScores?: Array<{ type: string }> },
  school: { sat25?: number | null; sat75?: number | null },
): { prob: number; applied: boolean; multiplier: number } {
  const hasSat =
    profile.testScores?.some((t) => t.type === 'SAT' || t.type === 'ACT') ??
    false;
  const usableSat = school.sat25 && school.sat75;
  if (hasSat || !usableSat || !profile.gpa) {
    return { prob, applied: false, multiplier: 1.0 };
  }
  const gpa4 = profile.gpa;
  let m: number;
  if (gpa4 >= 3.9) m = 1.05;
  else if (gpa4 >= 3.7) m = 0.95;
  else m = 0.7;

  // Apply to probability, respecting same clip bounds as engine
  const newRaw = prob * m;
  const lo = anchor * 0.1;
  const hi = Math.min(0.98, anchor * 2.5);
  const clamped = Math.max(lo, Math.min(hi, newRaw));
  return { prob: clamped, applied: true, multiplier: m };
}

// ── School transformation per option ───────────────────────────────────────

function transformSchoolForOption(
  school: any,
  option: OptionId,
  topThreshold: number = DEFAULT_TOP_BAND_THRESHOLD,
  tailThreshold: number = DEFAULT_TAIL_THRESHOLD,
): any {
  const dist =
    school.gpaDistribution && typeof school.gpaDistribution === 'object'
      ? (school.gpaDistribution as Record<string, number>)
      : null;
  const contaminated = isContaminated(dist, topThreshold, tailThreshold);

  if (option === 'D') return school;

  // A and C share same school transform; C differs in post-processing only
  if ((option === 'A' || option === 'C') && contaminated) {
    return { ...school, gpaDistribution: null };
  }

  if (option === 'B' && contaminated && dist) {
    return { ...school, gpaDistribution: remapBandsDown(dist) };
  }
  return school;
}

// ── Engine wrappers ─────────────────────────────────────────────────────────

function buildSchoolInput(school: any) {
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

async function runOption(
  counselor: CounselorEngineService,
  rawSchool: any,
  profile: any,
  option: OptionId,
  round: string,
  topThreshold: number = DEFAULT_TOP_BAND_THRESHOLD,
  tailThreshold: number = DEFAULT_TAIL_THRESHOLD,
): Promise<{
  prob: number;
  anchor: number;
  tier: number;
  gpaMult: number;
  gpaLabel: string;
  tweakApplied?: boolean;
  tweakMult?: number;
}> {
  const transformed = transformSchoolForOption(
    rawSchool,
    option,
    topThreshold,
    tailThreshold,
  );
  const input = buildSchoolInput(transformed);
  const result = await counselor.compute(profile, input as any, round);

  let prob = result.probability;
  let tweakApplied: boolean | undefined = undefined;
  let tweakMult: number | undefined = undefined;
  if (option === 'C') {
    const adj = optionCTestOptionalAdjustment(
      prob,
      result.anchor,
      profile,
      transformed,
    );
    prob = adj.prob;
    tweakApplied = adj.applied;
    tweakMult = adj.multiplier;
  }

  return {
    prob,
    anchor: result.anchor,
    tier: result.tier,
    gpaMult: result.modifierResults?.gpaBand?.multiplier ?? 1.0,
    gpaLabel: result.modifierResults?.gpaBand?.label ?? '?',
    tweakApplied,
    tweakMult,
  };
}

// ── Calibration spec runner (Layer 3) ───────────────────────────────────────

function buildProfileInput(profile: any) {
  return {
    ...profile,
    testScores: profile.testScores ?? [],
    activities: profile.activities ?? [],
    awards: profile.awards ?? [],
  };
}

interface FixtureRunResult {
  fixtureId: string;
  scenarioGroup: string;
  schoolName: string;
  kind: 'standalone' | 'comparative';
  expectedRange?: [number, number];
  expectedTier?: string;
  expectedMinDelta?: number;
  expectedMaxDelta?: number;
  perOption: Record<
    OptionId,
    {
      probability?: number;
      deltaCmp?: number; // for comparative
      pass: boolean;
      failReason?: string;
      direction?: 'in' | 'low' | 'high' | 'comp-low' | 'comp-high';
    }
  >;
  contaminated: boolean;
}

async function runAllFixtures(
  counselor: CounselorEngineService,
  prisma: PrismaService,
  fixturesOut?: { fixtures: any[]; schoolByNorm: Map<string, any> },
): Promise<FixtureRunResult[]> {
  const caseFiles = readdirSync(CASES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const fixtures: any[] = caseFiles.map((f) =>
    JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8')),
  );

  const uniqueSchoolNorms = Array.from(
    new Set(fixtures.map((f) => String(f.schoolName).toLowerCase().trim())),
  );
  const schoolRows = await prisma.school.findMany({
    where: { nameNorm: { in: uniqueSchoolNorms } },
  });
  const schoolByNorm = new Map(schoolRows.map((s) => [s.nameNorm, s]));
  if (fixturesOut) {
    fixturesOut.fixtures = fixtures;
    fixturesOut.schoolByNorm = schoolByNorm;
  }

  const results: FixtureRunResult[] = [];
  let idx = 0;

  for (const fx of fixtures) {
    idx++;
    if (idx % 10 === 0) {
      process.stdout.write(`    fixture ${idx}/${fixtures.length}\n`);
    }
    const norm = String(fx.schoolName).toLowerCase().trim();
    const school = schoolByNorm.get(norm);
    if (!school) {
      console.warn(`  ⚠ school not found: ${fx.schoolName}`);
      continue;
    }
    const dist = (school as any).gpaDistribution as Record<
      string,
      number
    > | null;
    const contaminated = isContaminated(dist);

    const result: FixtureRunResult = {
      fixtureId: fx.id,
      scenarioGroup: fx.scenarioGroup,
      schoolName: fx.schoolName,
      kind: fx.kind === 'comparative' ? 'comparative' : 'standalone',
      expectedRange: fx.expectedProbabilityRange,
      expectedTier: fx.expectedTier,
      expectedMinDelta: fx.expectedMinDelta,
      expectedMaxDelta: fx.expectedMaxDelta,
      perOption: {} as any,
      contaminated,
    };

    for (const opt of OPTION_IDS) {
      try {
        if (fx.kind === 'comparative') {
          const profileA = buildProfileInput({
            ...fx.baseProfile,
            ...(fx.caseA.profileOverride ?? {}),
          });
          const profileB = buildProfileInput({
            ...fx.baseProfile,
            ...(fx.caseB.profileOverride ?? {}),
          });
          const roundA = fx.caseA.applicationRound ?? 'RD';
          const roundB = fx.caseB.applicationRound ?? 'RD';
          const a = await runOption(counselor, school, profileA, opt, roundA);
          const b = await runOption(counselor, school, profileB, opt, roundB);
          const delta = a.prob - b.prob;
          const minD = fx.expectedMinDelta ?? -Infinity;
          const maxD = fx.expectedMaxDelta ?? Infinity;
          const inRange = delta >= minD && delta <= maxD;
          result.perOption[opt] = {
            deltaCmp: delta,
            probability: a.prob, // caseA prob for table
            pass: inRange,
            failReason: inRange
              ? undefined
              : delta < minD
                ? `Δ=${(delta * 100).toFixed(2)}pp < min ${(minD * 100).toFixed(1)}pp`
                : `Δ=${(delta * 100).toFixed(2)}pp > max ${(maxD * 100).toFixed(1)}pp`,
            direction: inRange ? 'in' : delta < minD ? 'comp-low' : 'comp-high',
          };
        } else {
          const profile = buildProfileInput(fx.profile);
          const round = fx.applicationRound ?? 'RD';
          const r = await runOption(counselor, school, profile, opt, round);
          const [lo, hi] = fx.expectedProbabilityRange ?? [0, 1];
          const inRange = r.prob >= lo && r.prob <= hi;
          result.perOption[opt] = {
            probability: r.prob,
            pass: inRange,
            failReason: inRange
              ? undefined
              : `${(r.prob * 100).toFixed(2)}% outside [${(lo * 100).toFixed(1)}%, ${(hi * 100).toFixed(1)}%]`,
            direction: inRange ? 'in' : r.prob < lo ? 'low' : 'high',
          };
        }
      } catch (err) {
        result.perOption[opt] = {
          pass: false,
          failReason: `runtime error: ${String(err)}`,
        };
      }
    }

    results.push(result);
  }
  return results;
}

// ── Applicant archetypes (22 SEVERE × 10 archetypes) ───────────────────────

interface Archetype {
  id: string;
  label: string;
  profileBuilder: () => any;
}

const ARCHETYPES: Archetype[] = [
  {
    id: 'perfect',
    label: 'Perfect (4.00 / 1560)',
    profileBuilder: () => baseProfile({ gpa: 4.0, sat: 1560 }),
  },
  {
    id: 'strong',
    label: 'Strong (3.85 / 1500)',
    profileBuilder: () => baseProfile({ gpa: 3.85, sat: 1500 }),
  },
  {
    id: 'strong-to',
    label: 'Strong-TO (3.85 / no test)',
    profileBuilder: () => baseProfile({ gpa: 3.85 }),
  },
  {
    id: 'mid',
    label: 'Mid (3.65 / 1430)',
    profileBuilder: () => baseProfile({ gpa: 3.65, sat: 1430 }),
  },
  {
    id: 'mid-to',
    label: 'Mid-TO (3.65 / no test)',
    profileBuilder: () => baseProfile({ gpa: 3.65 }),
  },
  {
    id: 'below',
    label: 'Below (3.40 / 1330)',
    profileBuilder: () => baseProfile({ gpa: 3.4, sat: 1330 }),
  },
  {
    id: 'cn-perfect',
    label: 'CN-perfect (4.00, intl)',
    profileBuilder: () =>
      baseProfile({ gpa: 4.0, sat: 1560, intl: true, nationality: 'CN' }),
  },
  {
    id: 'cn-strong',
    label: 'CN-strong (3.85, intl)',
    profileBuilder: () =>
      baseProfile({ gpa: 3.85, sat: 1500, intl: true, nationality: 'CN' }),
  },
  {
    id: 'athlete',
    label: 'Athlete-recruit (3.50)',
    profileBuilder: () => baseProfile({ gpa: 3.5, sat: 1400, athlete: true }),
  },
  {
    id: 'legacy',
    label: 'Legacy (3.85)',
    profileBuilder: () => baseProfile({ gpa: 3.85, sat: 1500, legacy: true }),
  },
];

function baseProfile(opts: {
  gpa: number;
  sat?: number;
  intl?: boolean;
  nationality?: string;
  athlete?: boolean;
  legacy?: boolean;
}): any {
  return {
    gpa: opts.gpa,
    gpaScale: 4.0,
    isInternational: opts.intl ?? false,
    nationality: opts.nationality ?? 'US',
    stateOfResidence: 'NY',
    targetMajor: 'Computer Science',
    isLegacy: opts.legacy ?? false,
    isFirstGen: false,
    recruitedAthlete: opts.athlete ?? false,
    testScores: opts.sat ? [{ type: 'SAT', score: opts.sat }] : [],
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

interface ArchetypeResult {
  schoolName: string;
  archetypeId: string;
  archetypeLabel: string;
  perOption: Record<OptionId, { prob: number; anchor: number }>;
}

async function runArchetypeMatrix(
  counselor: CounselorEngineService,
  prisma: PrismaService,
): Promise<ArchetypeResult[]> {
  const norms = SEVERE_SCHOOLS.map((s) => s.toLowerCase().trim());
  const schoolRows = await prisma.school.findMany({
    where: { nameNorm: { in: norms } },
  });
  const schoolByNorm = new Map(schoolRows.map((s) => [s.nameNorm, s]));

  const results: ArchetypeResult[] = [];
  let schIdx = 0;
  for (const schName of SEVERE_SCHOOLS) {
    schIdx++;
    process.stdout.write(
      `    school ${schIdx}/${SEVERE_SCHOOLS.length}: ${schName}\n`,
    );
    const school = schoolByNorm.get(schName.toLowerCase().trim());
    if (!school) {
      console.warn(`  ⚠ severe school not found: ${schName}`);
      continue;
    }
    for (const arch of ARCHETYPES) {
      const profile = arch.profileBuilder();
      const perOption: Record<OptionId, { prob: number; anchor: number }> =
        {} as any;
      for (const opt of OPTION_IDS) {
        try {
          const r = await runOption(counselor, school, profile, opt, 'RD');
          perOption[opt] = { prob: r.prob, anchor: r.anchor };
        } catch (err) {
          perOption[opt] = { prob: 0, anchor: 0 };
        }
      }
      results.push({
        schoolName: schName,
        archetypeId: arch.id,
        archetypeLabel: arch.label,
        perOption,
      });
    }
  }
  return results;
}

// ── Threshold sensitivity ──────────────────────────────────────────────────

const TOP_THRESHOLDS = [0.85, 0.88, 0.9, 0.92, 0.95];
const TAIL_THRESHOLDS = [0.03, 0.05, 0.08, 0.1];

interface SensitivityCell {
  topThr: number;
  tailThr: number;
  // For each option (A/B/C), pass rate on all 50 fixtures
  passRateA: number;
  passRateB: number;
  passRateC: number;
  contaminatedCount: number;
}

async function runSensitivity(
  counselor: CounselorEngineService,
  prisma: PrismaService,
  schoolByNormCached?: Map<string, any>,
  fixturesCached?: any[],
): Promise<SensitivityCell[]> {
  let fixtures: any[] =
    fixturesCached ??
    readdirSync(CASES_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8')));
  // Sample fixtures for sensitivity to keep runtime reasonable. Pick fixtures
  // touching contaminated schools (where it matters) + a couple of controls.
  const SENSITIVITY_FIXTURE_IDS = new Set([
    '001-mit-rea-strong-unhooked-domestic',
    '002-stanford-rd-strong-unhooked-domestic',
    '003-harvard-rd-strong-intl-cn',
    '004-penn-ed-strong-unhooked',
    '008-harvard-rd-weak-extreme',
    '010-penn-rd-test-optional',
    '011-umich-rd-low-gpa-high-test',
    '016-harvard-rd-legacy-strong',
    '018-stanford-rd-athlete-verified',
    '022-caltech-rea-stem-spike',
    '027-unc-ea-strong-instate',
    '029-umass-amherst-rd-safety',
    '031-ucla-rd-strong-cs-oos',
    '036-williams-rd-strong-domestic',
    '039-mit-rd-strong-intl-cn',
    '042-columbia-ed-strong-intl-cn',
    '047-yale-rd-strong-domestic-andover',
    '049-stanford-rd-firstgen-stem-stack',
    '050-cmu-ed-firstgen-stem-stack',
  ]);
  fixtures = fixtures.filter((f) => SENSITIVITY_FIXTURE_IDS.has(f.id));
  let schoolByNorm = schoolByNormCached;
  if (!schoolByNorm) {
    const norms = Array.from(
      new Set(fixtures.map((f) => String(f.schoolName).toLowerCase().trim())),
    );
    const schoolRows = await prisma.school.findMany({
      where: { nameNorm: { in: norms } },
    });
    schoolByNorm = new Map(schoolRows.map((s) => [s.nameNorm, s]));
  }

  const cells: SensitivityCell[] = [];

  for (const topThr of TOP_THRESHOLDS) {
    for (const tailThr of TAIL_THRESHOLDS) {
      let contaminated = 0;
      let passA = 0;
      let passB = 0;
      let passC = 0;
      let total = 0;
      for (const fx of fixtures) {
        const norm = String(fx.schoolName).toLowerCase().trim();
        const school = schoolByNorm.get(norm);
        if (!school) continue;
        const dist = (school as any).gpaDistribution as Record<
          string,
          number
        > | null;
        if (isContaminated(dist, topThr, tailThr)) contaminated++;
        total++;
        for (const opt of ['A', 'B', 'C'] as OptionId[]) {
          try {
            if (fx.kind === 'comparative') {
              const profileA = buildProfileInput({
                ...fx.baseProfile,
                ...(fx.caseA.profileOverride ?? {}),
              });
              const profileB = buildProfileInput({
                ...fx.baseProfile,
                ...(fx.caseB.profileOverride ?? {}),
              });
              const ra = await runOption(
                counselor,
                school,
                profileA,
                opt,
                fx.caseA.applicationRound ?? 'RD',
                topThr,
                tailThr,
              );
              const rb = await runOption(
                counselor,
                school,
                profileB,
                opt,
                fx.caseB.applicationRound ?? 'RD',
                topThr,
                tailThr,
              );
              const delta = ra.prob - rb.prob;
              const minD = fx.expectedMinDelta ?? -Infinity;
              const maxD = fx.expectedMaxDelta ?? Infinity;
              if (delta >= minD && delta <= maxD) {
                if (opt === 'A') passA++;
                else if (opt === 'B') passB++;
                else if (opt === 'C') passC++;
              }
            } else {
              const profile = buildProfileInput(fx.profile);
              const r = await runOption(
                counselor,
                school,
                profile,
                opt,
                fx.applicationRound ?? 'RD',
                topThr,
                tailThr,
              );
              const [lo, hi] = fx.expectedProbabilityRange ?? [0, 1];
              if (r.prob >= lo && r.prob <= hi) {
                if (opt === 'A') passA++;
                else if (opt === 'B') passB++;
                else if (opt === 'C') passC++;
              }
            }
          } catch {
            // count as fail
          }
        }
      }
      cells.push({
        topThr,
        tailThr,
        passRateA: passA / total,
        passRateB: passB / total,
        passRateC: passC / total,
        contaminatedCount: contaminated,
      });
    }
  }
  return cells;
}

// ── Report generation ──────────────────────────────────────────────────────

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function pct(n: number): string {
  return (n * 100).toFixed(2) + '%';
}

function pp(n: number): string {
  return (n * 100).toFixed(2) + 'pp';
}

function writeReport(
  fixtureResults: FixtureRunResult[],
  archetypeResults: ArchetypeResult[],
  sensitivityResults: SensitivityCell[],
) {
  const lines: string[] = [];

  // ── Header ────────────────────────────────────────────────────────────
  lines.push('# Weighted-GPA Fix — Comprehensive Test Matrix');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Options Under Test');
  lines.push('');
  lines.push('| ID | Description |');
  lines.push('|---|---|');
  lines.push('| **D** | Baseline (current engine, no fix) |');
  lines.push(
    '| **A** | When dist top-band ≥92% AND <3.75 tail ≤5%: set `gpaDistribution=null` → SAT-fallback heuristic |',
  );
  lines.push(
    '| **B** | Same detect; remap bands down by 0.5 GPA (top×0.5, cascade to lower bands) |',
  );
  lines.push(
    '| **C** | Same as A + when applicant is test-optional (no SAT), apply mini-table: gpa≥3.9→×1.05, gpa≥3.7→×0.95, else ×0.7 |',
  );
  lines.push('');

  // ── Section 1: Layer-3 calibration results ────────────────────────────
  const total = fixtureResults.length;
  const passCounts: Record<OptionId, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const fr of fixtureResults) {
    for (const opt of OPTION_IDS) {
      if (fr.perOption[opt].pass) passCounts[opt]++;
    }
  }

  lines.push('## 1. Layer-3 Calibration: 50 fixtures × 4 options');
  lines.push('');
  lines.push('| Option | Pass | Total | Pass-rate | Δ from D (pp) |');
  lines.push('|---|---|---|---|---|');
  const baselinePass = passCounts.D;
  for (const opt of OPTION_IDS) {
    const pr = passCounts[opt] / total;
    const delta = ((passCounts[opt] - baselinePass) / total) * 100;
    lines.push(
      `| ${opt} | ${passCounts[opt]} | ${total} | ${(pr * 100).toFixed(1)}% | ${
        opt === 'D' ? '—' : (delta >= 0 ? '+' : '') + delta.toFixed(1)
      } |`,
    );
  }
  lines.push('');

  // Per-fixture detail (only fixtures where options diverge, OR where D fails)
  lines.push('### 1a. Per-fixture detail — fixtures that move or fail');
  lines.push('');
  lines.push(
    '| Fixture | Severe? | Expected | D prob | A prob | B prob | C prob | D | A | B | C |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');

  const diverging = fixtureResults.filter((fr) => {
    const probs = [
      fr.perOption.A.probability,
      fr.perOption.B.probability,
      fr.perOption.C.probability,
      fr.perOption.D.probability,
    ].filter((p) => p != null) as number[];
    if (probs.length < 2) return false;
    const max = Math.max(...probs);
    const min = Math.min(...probs);
    const anyFail = OPTION_IDS.some((o) => !fr.perOption[o].pass);
    return max - min > 0.005 || anyFail;
  });

  for (const fr of diverging) {
    const exp =
      fr.kind === 'comparative'
        ? `Δ∈[${pp(fr.expectedMinDelta ?? 0)}, ${pp(fr.expectedMaxDelta ?? 0)}]`
        : fr.expectedRange
          ? `[${pct(fr.expectedRange[0])}, ${pct(fr.expectedRange[1])}]`
          : '?';
    const row = [
      `\`${fr.fixtureId}\``,
      fr.contaminated ? '✓' : '',
      exp,
      fr.perOption.D.probability != null
        ? fr.kind === 'comparative'
          ? pp(fr.perOption.D.deltaCmp ?? 0)
          : pct(fr.perOption.D.probability)
        : '?',
      fr.perOption.A.probability != null
        ? fr.kind === 'comparative'
          ? pp(fr.perOption.A.deltaCmp ?? 0)
          : pct(fr.perOption.A.probability)
        : '?',
      fr.perOption.B.probability != null
        ? fr.kind === 'comparative'
          ? pp(fr.perOption.B.deltaCmp ?? 0)
          : pct(fr.perOption.B.probability)
        : '?',
      fr.perOption.C.probability != null
        ? fr.kind === 'comparative'
          ? pp(fr.perOption.C.deltaCmp ?? 0)
          : pct(fr.perOption.C.probability)
        : '?',
      fr.perOption.D.pass ? '✅' : `❌${fr.perOption.D.direction ?? ''}`,
      fr.perOption.A.pass ? '✅' : `❌${fr.perOption.A.direction ?? ''}`,
      fr.perOption.B.pass ? '✅' : `❌${fr.perOption.B.direction ?? ''}`,
      fr.perOption.C.pass ? '✅' : `❌${fr.perOption.C.direction ?? ''}`,
    ];
    lines.push('| ' + row.join(' | ') + ' |');
  }
  lines.push('');

  // ── Section 2: Archetype matrix ───────────────────────────────────────
  lines.push(
    '## 2. 22 SEVERE schools × 10 archetypes (220 cells × 4 options = 880 predictions)',
  );
  lines.push('');

  // Aggregate Δ from D per archetype
  lines.push(
    '### 2a. Median Δ from D (in pp) per archetype, across 22 SEVERE schools',
  );
  lines.push('');
  lines.push(
    '| Archetype | Median A−D | Median B−D | Median C−D | A spread (min/max pp) | B spread | C spread |',
  );
  lines.push('|---|---|---|---|---|---|---|');

  const archetypeIds = ARCHETYPES.map((a) => a.id);
  for (const archId of archetypeIds) {
    const rowsForArch = archetypeResults.filter(
      (r) => r.archetypeId === archId,
    );
    if (!rowsForArch.length) continue;
    const arch = ARCHETYPES.find((a) => a.id === archId)!;
    const deltaA = rowsForArch.map(
      (r) => (r.perOption.A.prob - r.perOption.D.prob) * 100,
    );
    const deltaB = rowsForArch.map(
      (r) => (r.perOption.B.prob - r.perOption.D.prob) * 100,
    );
    const deltaC = rowsForArch.map(
      (r) => (r.perOption.C.prob - r.perOption.D.prob) * 100,
    );
    lines.push(
      `| ${arch.label} | ${median(deltaA).toFixed(2)} | ${median(deltaB).toFixed(2)} | ${median(deltaC).toFixed(2)} | ${Math.min(...deltaA).toFixed(2)} / ${Math.max(...deltaA).toFixed(2)} | ${Math.min(...deltaB).toFixed(2)} / ${Math.max(...deltaB).toFixed(2)} | ${Math.min(...deltaC).toFixed(2)} / ${Math.max(...deltaC).toFixed(2)} |`,
    );
  }
  lines.push('');

  // Detailed grid: 22 × 10 × 4 — only show contaminated schools
  lines.push('### 2b. Per-school detail (all 22 SEVERE, all archetypes)');
  lines.push('');
  lines.push('| School | Archetype | D | A | B | C | A−D | B−D | C−D |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of archetypeResults) {
    const shortSchool = r.schoolName
      .replace('University of ', 'U ')
      .replace('University', 'U.')
      .slice(0, 30);
    lines.push(
      `| ${shortSchool} | ${r.archetypeLabel} | ${pct(r.perOption.D.prob)} | ${pct(r.perOption.A.prob)} | ${pct(r.perOption.B.prob)} | ${pct(r.perOption.C.prob)} | ${((r.perOption.A.prob - r.perOption.D.prob) * 100).toFixed(2)}pp | ${((r.perOption.B.prob - r.perOption.D.prob) * 100).toFixed(2)}pp | ${((r.perOption.C.prob - r.perOption.D.prob) * 100).toFixed(2)}pp |`,
    );
  }
  lines.push('');

  // ── Section 3: Edge cases ─────────────────────────────────────────────
  lines.push('## 3. Edge-case findings');
  lines.push('');

  // TO blind spot
  const toArchs = archetypeResults.filter((r) => r.archetypeId.endsWith('-to'));
  const toCDeltas = toArchs.map(
    (r) => (r.perOption.C.prob - r.perOption.A.prob) * 100,
  );
  const toCDeltaAtoD = toArchs.map(
    (r) => (r.perOption.C.prob - r.perOption.D.prob) * 100,
  );
  lines.push('### TO (Test-Optional) Blind Spot');
  lines.push('');
  lines.push(`- TO archetypes (strong-to + mid-to): ${toArchs.length} cells`);
  lines.push(
    `- Median C−A delta: ${median(toCDeltas).toFixed(2)}pp (positive = C diverges from A on TO, meaning the mini-table fires)`,
  );
  lines.push(`- Median C−D delta: ${median(toCDeltaAtoD).toFixed(2)}pp`);
  lines.push('');

  // CN applicant
  const cnRows = archetypeResults.filter((r) =>
    r.archetypeId.startsWith('cn-'),
  );
  const cnDeltasA = cnRows.map(
    (r) => (r.perOption.A.prob - r.perOption.D.prob) * 100,
  );
  const cnDeltasB = cnRows.map(
    (r) => (r.perOption.B.prob - r.perOption.D.prob) * 100,
  );
  lines.push('### CN International Applicant');
  lines.push('');
  lines.push(`- CN archetypes (perfect + strong): ${cnRows.length} cells`);
  lines.push(`- Median A−D delta: ${median(cnDeltasA).toFixed(2)}pp`);
  lines.push(`- Median B−D delta: ${median(cnDeltasB).toFixed(2)}pp`);
  lines.push('');

  // Hook interaction
  const hookRows = archetypeResults.filter(
    (r) => r.archetypeId === 'athlete' || r.archetypeId === 'legacy',
  );
  const hookDeltasA = hookRows.map(
    (r) => (r.perOption.A.prob - r.perOption.D.prob) * 100,
  );
  const hookDeltasB = hookRows.map(
    (r) => (r.perOption.B.prob - r.perOption.D.prob) * 100,
  );
  lines.push('### Hook (Athlete / Legacy) Interaction');
  lines.push('');
  lines.push(`- Hook archetypes: ${hookRows.length} cells`);
  lines.push(`- Median A−D delta: ${median(hookDeltasA).toFixed(2)}pp`);
  lines.push(`- Median B−D delta: ${median(hookDeltasB).toFixed(2)}pp`);
  lines.push('');

  // ── Section 4: Sensitivity ────────────────────────────────────────────
  lines.push('## 4. Threshold sensitivity heatmap');
  lines.push('');
  lines.push(
    '### Option A pass-rate as function of (top-band threshold, lower-tail threshold)',
  );
  lines.push('');
  let header = '| top \\ tail |';
  for (const tt of TAIL_THRESHOLDS) header += ` ${(tt * 100).toFixed(0)}% |`;
  lines.push(header);
  lines.push('|' + '---|'.repeat(TAIL_THRESHOLDS.length + 1));
  for (const topThr of TOP_THRESHOLDS) {
    let row = `| ${(topThr * 100).toFixed(0)}% |`;
    for (const tailThr of TAIL_THRESHOLDS) {
      const cell = sensitivityResults.find(
        (s) => s.topThr === topThr && s.tailThr === tailThr,
      );
      row += ` ${cell ? (cell.passRateA * 100).toFixed(1) : '?'}% |`;
    }
    lines.push(row);
  }
  lines.push('');

  lines.push('### Option B pass-rate');
  lines.push('');
  lines.push(header);
  lines.push('|' + '---|'.repeat(TAIL_THRESHOLDS.length + 1));
  for (const topThr of TOP_THRESHOLDS) {
    let row = `| ${(topThr * 100).toFixed(0)}% |`;
    for (const tailThr of TAIL_THRESHOLDS) {
      const cell = sensitivityResults.find(
        (s) => s.topThr === topThr && s.tailThr === tailThr,
      );
      row += ` ${cell ? (cell.passRateB * 100).toFixed(1) : '?'}% |`;
    }
    lines.push(row);
  }
  lines.push('');

  lines.push('### Option C pass-rate');
  lines.push('');
  lines.push(header);
  lines.push('|' + '---|'.repeat(TAIL_THRESHOLDS.length + 1));
  for (const topThr of TOP_THRESHOLDS) {
    let row = `| ${(topThr * 100).toFixed(0)}% |`;
    for (const tailThr of TAIL_THRESHOLDS) {
      const cell = sensitivityResults.find(
        (s) => s.topThr === topThr && s.tailThr === tailThr,
      );
      row += ` ${cell ? (cell.passRateC * 100).toFixed(1) : '?'}% |`;
    }
    lines.push(row);
  }
  lines.push('');

  lines.push('### Contaminated school count');
  lines.push('');
  lines.push(header);
  lines.push('|' + '---|'.repeat(TAIL_THRESHOLDS.length + 1));
  for (const topThr of TOP_THRESHOLDS) {
    let row = `| ${(topThr * 100).toFixed(0)}% |`;
    for (const tailThr of TAIL_THRESHOLDS) {
      const cell = sensitivityResults.find(
        (s) => s.topThr === topThr && s.tailThr === tailThr,
      );
      row += ` ${cell ? cell.contaminatedCount : '?'} |`;
    }
    lines.push(row);
  }
  lines.push('');

  // ── Section 5: Recommendation ─────────────────────────────────────────
  lines.push('## 5. Final Recommendation');
  lines.push('');
  const bestOption = OPTION_IDS.reduce(
    (best, o) => (passCounts[o] > passCounts[best] ? o : best),
    'D' as OptionId,
  );
  lines.push(
    `**Highest-passing option on Layer-3**: ${bestOption} (${passCounts[bestOption]}/${total} = ${((passCounts[bestOption] / total) * 100).toFixed(1)}%)`,
  );
  lines.push('');
  lines.push('Baseline pass rates:');
  for (const opt of OPTION_IDS) {
    lines.push(
      `- ${opt}: ${passCounts[opt]}/${total} (${((passCounts[opt] / total) * 100).toFixed(1)}%)`,
    );
  }
  lines.push('');

  // Methodology notes
  lines.push('## Methodology Notes & Caveats');
  lines.push('');
  lines.push(
    '- **Option B remap is a simplification.** A rigorous remap requires actual unweighted GPA distributions per school, which CDS does not publish. The 0.5/0.35/0.10/0.04/0.01 cascade assumes ~0.5-GPA uniform inflation, which over-applies to schools that already report unweighted CDS C9 (Caltech) and under-applies to schools with extreme grade inflation. Treat B numbers as directional.',
  );
  lines.push(
    '- **Option C TO mini-table coefficients (1.05/0.95/0.7)** are heuristic; no industry citation. They are reasonable starting points but should be sensitivity-tested separately.',
  );
  lines.push(
    '- **Layer-3 fixtures are not a complete population**: 50 cases biased toward T20. Real production traffic distribution may differ.',
  );
  lines.push(
    "- **Hook coefficient ceiling**: athlete-recruit at GPA 3.50 may hit the engine's 2.5× upper bound regardless of GPA path; A/B/C deltas there reflect the bound, not the modifier.",
  );
  lines.push('');

  writeFileSync(REPORT_PATH, lines.join('\n'));
  writeFileSync(
    RAW_JSON_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        fixtureResults,
        archetypeResults,
        sensitivityResults,
        passCounts,
      },
      null,
      2,
    ),
  );
  console.log(`\nReport written: ${REPORT_PATH}`);
  console.log(`Raw JSON:      ${RAW_JSON_PATH}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const start = Date.now();
  console.log('Bootstrapping CounselorEngineModule...');
  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    { logger: ['error', 'warn'] },
  );
  const counselor = app.get(CounselorEngineService);
  const prisma = app.get(PrismaService);

  console.log(
    '\n[1/3] Running Layer-3 calibration fixtures (50 × 4 options)...',
  );
  const cache: { fixtures: any[]; schoolByNorm: Map<string, any> } = {
    fixtures: [],
    schoolByNorm: new Map(),
  };
  const fixtureResults = await runAllFixtures(counselor, prisma, cache);
  console.log(`  → ${fixtureResults.length} fixtures evaluated`);
  writeFileSync(
    '/tmp/gpa-options-phase1.json',
    JSON.stringify(fixtureResults, null, 2),
  );

  console.log(
    '\n[2/3] Running 22 SEVERE × 10 archetype matrix (880 predictions)...',
  );
  const archetypeResults = await runArchetypeMatrix(counselor, prisma);
  console.log(`  → ${archetypeResults.length} cells evaluated`);
  writeFileSync(
    '/tmp/gpa-options-phase2.json',
    JSON.stringify(archetypeResults, null, 2),
  );

  console.log(
    '\n[3/3] Running threshold sensitivity (5 × 4 × ~19 × 3 options)...',
  );
  const sensitivityResults = await runSensitivity(
    counselor,
    prisma,
    cache.schoolByNorm,
    cache.fixtures,
  );
  console.log(`  → ${sensitivityResults.length} sensitivity cells`);
  writeFileSync(
    '/tmp/gpa-options-phase3.json',
    JSON.stringify(sensitivityResults, null, 2),
  );

  writeReport(fixtureResults, archetypeResults, sensitivityResults);

  console.log(`\nTotal runtime: ${((Date.now() - start) / 1000).toFixed(1)}s`);
  await app.close();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
