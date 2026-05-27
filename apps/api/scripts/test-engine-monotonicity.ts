#!/usr/bin/env tsx
/**
 * Monotonicity / sensitivity test suite for the counselor prediction engine.
 *
 * UNLIKE existing gold-case fixtures (which assert `prob ∈ [X, Y]` industry
 * anchors), this suite asserts DIRECTIONAL behavior: when one feature changes,
 * the engine must move the correct direction. These tests catch "silent"
 * direction bugs that band-style fixtures cannot.
 *
 * Categories:
 *   A. GPA monotonicity            — ±0.1 GPA must not move prob the wrong way
 *   B. SAT monotonicity            — ±50 SAT must not move prob the wrong way
 *   C. Round-switch direction      — RD→ED at ED-offering schools must boost
 *   D. Hook direction              — recruited-athlete / legacy / first-gen /
 *                                    USAMO / national-leadership: never hurt
 *   E. Intl penalty direction      — flipping isInternational at need-aware
 *                                    schools must NOT increase prob
 *   F. Cross-school monotonicity   — same profile, T5 < T20 < T50 ordering
 *   G. Test-optional direction     — TO flag (no score) must NOT increase prob
 *
 * Run: `tsx apps/api/scripts/test-engine-monotonicity.ts`
 *
 * Exit code: 0 if all PASS, 1 if any FAIL. CI / pre-push can gate on this.
 */

import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PrismaService } from '../src/prisma/prisma.service';

// ------------------------------------------------------------------------
// Tolerance: comparator allows 0.5pp slack to absorb floor effects, anchor
// rounding, and small modifier clamps. A FAIL means delta > 0.5pp in the
// wrong direction — almost certainly a real bug, not numeric noise.
// ------------------------------------------------------------------------
const TOLERANCE = 0.005;

// ------------------------------------------------------------------------
// School name list — only schools known to have CDS bands + intl data
// populated in production (avoid stub schools with NULL fields).
// ------------------------------------------------------------------------
const SCHOOL_NAMES = [
  'Stanford University',
  'Massachusetts Institute of Technology',
  'Harvard University',
  'University of Pennsylvania',
  'Johns Hopkins University',
  'Vanderbilt University',
  'Northwestern University',
  'University of Michigan, Ann Arbor',
  'University of California, Los Angeles',
  'University of California, Berkeley',
  'Williams College',
  'Brown University',
  'Pomona College',
  'Swarthmore College',
  'Carnegie Mellon University',
  'Tulane University',
];

// ------------------------------------------------------------------------
// Mirror of buildSchoolInput in comprehensive-prediction-matrix.ts — converts
// Prisma Decimal types to numbers so the engine's normalizer works.
// ------------------------------------------------------------------------
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

// ------------------------------------------------------------------------
// Base profile builder — keeps every field explicit so each perturbation
// only changes ONE knob.
// ------------------------------------------------------------------------
interface BaseProfileOpts {
  gpa: number;
  sat: number;
  isInternational?: boolean;
  nationality?: string;
  stateOfResidence?: string | null;
  isLegacy?: boolean;
  legacySchools?: string[];
  isFirstGen?: boolean;
  recruitedAthlete?: boolean;
  applyingTestOptional?: boolean;
  targetMajor?: string;
  includeUsamo?: boolean;
  includeNationalLeadership?: boolean;
  awardsLevel?: 'NONE' | 'STATE' | 'NATIONAL' | 'INTERNATIONAL';
  omitTestScore?: boolean;
}

function buildProfile(opts: BaseProfileOpts): any {
  const activities: any[] = [
    {
      name: 'Math Club',
      category: 'ACADEMIC',
      role: 'President',
      hoursPerWeek: 6,
      weeksPerYear: 30,
      yearsActive: 3,
    },
    {
      name: 'Volunteer Tutor',
      category: 'COMMUNITY_SERVICE',
      role: 'Tutor',
      hoursPerWeek: 4,
      weeksPerYear: 30,
      yearsActive: 2,
    },
    {
      name: 'Debate Team',
      category: 'ACADEMIC',
      role: 'Member',
      hoursPerWeek: 4,
      weeksPerYear: 28,
      yearsActive: 2,
    },
  ];
  if (opts.includeNationalLeadership) {
    activities.push({
      name: 'National Honor Society',
      category: 'LEADERSHIP',
      role: 'National President',
      hoursPerWeek: 8,
      weeksPerYear: 30,
      yearsActive: 2,
      tier: 1,
    });
  }

  const awards: any[] = [];
  if (opts.awardsLevel && opts.awardsLevel !== 'NONE') {
    awards.push({
      name: `${opts.awardsLevel} Science Award`,
      level: opts.awardsLevel,
      year: 2025,
    });
  }
  if (opts.includeUsamo) {
    awards.push({
      name: 'USAMO Qualifier',
      level: 'NATIONAL',
      tier: 1,
      competitionName: 'USAMO',
      year: 2025,
    });
  }

  return {
    gpa: opts.gpa,
    gpaScale: 4.0,
    isInternational: opts.isInternational ?? false,
    nationality: opts.nationality ?? 'US',
    stateOfResidence: opts.stateOfResidence ?? undefined,
    currentSchoolType:
      opts.isInternational === true ? 'INTERNATIONAL' : undefined,
    targetMajor: opts.targetMajor ?? 'Computer Science',
    isLegacy: opts.isLegacy ?? false,
    legacySchools: opts.legacySchools,
    isFirstGen: opts.isFirstGen ?? false,
    recruitedAthlete: opts.recruitedAthlete ?? false,
    applyingTestOptional: opts.applyingTestOptional ?? false,
    testScores: opts.omitTestScore ? [] : [{ type: 'SAT', score: opts.sat }],
    activities,
    awards,
  };
}

// ------------------------------------------------------------------------
// Test record + assertion helpers
// ------------------------------------------------------------------------
type Direction = 'no-decrease' | 'no-increase' | 'equal-within';

interface TestCase {
  id: string;
  category: string;
  description: string;
  school: string;
  baseProb: number;
  perturbedProb: number;
  delta: number;
  direction: Direction;
  pass: boolean;
  notes?: string;
  suspectedPath?: string;
}

function assert(
  baseProb: number,
  perturbedProb: number,
  direction: Direction,
): { pass: boolean; delta: number } {
  const delta = perturbedProb - baseProb;
  if (direction === 'no-decrease') {
    // perturbed must be >= base - tolerance
    return { pass: delta >= -TOLERANCE, delta };
  }
  if (direction === 'no-increase') {
    return { pass: delta <= TOLERANCE, delta };
  }
  // equal-within
  return { pass: Math.abs(delta) <= TOLERANCE, delta };
}

// ------------------------------------------------------------------------
// Main
// ------------------------------------------------------------------------
async function main() {
  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    { logger: ['error'] },
  );
  const counselor = app.get(CounselorEngineService);
  const prisma = app.get(PrismaService);

  const schoolRows = await prisma.school.findMany({
    where: {
      nameNorm: { in: SCHOOL_NAMES.map((s) => s.toLowerCase().trim()) },
    },
  });
  const schoolMap = new Map(schoolRows.map((s) => [s.nameNorm, s]));

  function getSchool(name: string) {
    const row = schoolMap.get(name.toLowerCase().trim());
    if (!row) throw new Error(`School not in DB: ${name}`);
    return row;
  }

  async function predict(profile: any, schoolName: string, round = 'RD') {
    const row = getSchool(schoolName);
    return counselor.compute(profile, buildSchoolInput(row), round);
  }

  const results: TestCase[] = [];

  // ─── A. GPA monotonicity (5 schools × 2 perturbations = 10 sub-checks,
  //                          rolled up as 5 pairs of tests) ──────────────
  const gpaCases: Array<{
    id: string;
    school: string;
    base: BaseProfileOpts;
    round: string;
    desc: string;
  }> = [
    {
      id: 'A1',
      school: 'Stanford University',
      base: { gpa: 3.95, sat: 1530, awardsLevel: 'NATIONAL' },
      round: 'RD',
      desc: 'Stanford strong RD',
    },
    {
      id: 'A2',
      school: 'Massachusetts Institute of Technology',
      base: { gpa: 3.85, sat: 1500, awardsLevel: 'NATIONAL' },
      round: 'REA',
      desc: 'MIT REA mid',
    },
    {
      id: 'A3',
      school: 'University of Michigan, Ann Arbor',
      base: {
        gpa: 3.85,
        sat: 1450,
        stateOfResidence: 'MI',
        awardsLevel: 'STATE',
      },
      round: 'EA',
      desc: 'UMich EA in-state',
    },
    {
      id: 'A4',
      school: 'University of California, Los Angeles',
      base: {
        gpa: 3.9,
        sat: 1480,
        isInternational: true,
        nationality: 'CN',
        awardsLevel: 'STATE',
      },
      round: 'RD',
      desc: 'UCLA RD intl-CN',
    },
    {
      id: 'A5',
      school: 'Williams College',
      base: { gpa: 3.9, sat: 1480, awardsLevel: 'NATIONAL' },
      round: 'RD',
      desc: 'Williams RD strong',
    },
  ];

  for (const tc of gpaCases) {
    const baseProfile = buildProfile(tc.base);
    const upProfile = buildProfile({ ...tc.base, gpa: tc.base.gpa + 0.1 });
    const downProfile = buildProfile({ ...tc.base, gpa: tc.base.gpa - 0.1 });

    const baseR = await predict(baseProfile, tc.school, tc.round);
    const upR = await predict(upProfile, tc.school, tc.round);
    const downR = await predict(downProfile, tc.school, tc.round);

    const upAssert = assert(baseR.probability, upR.probability, 'no-decrease');
    const downAssert = assert(
      baseR.probability,
      downR.probability,
      'no-increase',
    );

    results.push({
      id: `${tc.id}-up`,
      category: 'A. GPA monotonicity',
      description: `${tc.desc}: GPA ${tc.base.gpa} → ${(tc.base.gpa + 0.1).toFixed(2)} should not DECREASE prob`,
      school: tc.school,
      baseProb: baseR.probability,
      perturbedProb: upR.probability,
      delta: upAssert.delta,
      direction: 'no-decrease',
      pass: upAssert.pass,
      suspectedPath: upAssert.pass
        ? undefined
        : 'apps/api/src/modules/prediction/counselor/counselor-modifiers.ts:gpaBandMultiplier',
    });
    results.push({
      id: `${tc.id}-down`,
      category: 'A. GPA monotonicity',
      description: `${tc.desc}: GPA ${tc.base.gpa} → ${(tc.base.gpa - 0.1).toFixed(2)} should not INCREASE prob`,
      school: tc.school,
      baseProb: baseR.probability,
      perturbedProb: downR.probability,
      delta: downAssert.delta,
      direction: 'no-increase',
      pass: downAssert.pass,
      suspectedPath: downAssert.pass
        ? undefined
        : 'apps/api/src/modules/prediction/counselor/counselor-modifiers.ts:gpaBandMultiplier',
    });
  }

  // ─── B. SAT monotonicity (same 5 schools, ±50 SAT) ─────────────────────
  for (const tc of gpaCases) {
    const baseProfile = buildProfile(tc.base);
    const upProfile = buildProfile({ ...tc.base, sat: tc.base.sat + 50 });
    const downProfile = buildProfile({ ...tc.base, sat: tc.base.sat - 50 });

    const baseR = await predict(baseProfile, tc.school, tc.round);
    const upR = await predict(upProfile, tc.school, tc.round);
    const downR = await predict(downProfile, tc.school, tc.round);

    const upAssert = assert(baseR.probability, upR.probability, 'no-decrease');
    const downAssert = assert(
      baseR.probability,
      downR.probability,
      'no-increase',
    );

    const bId = tc.id.replace('A', 'B');
    results.push({
      id: `${bId}-up`,
      category: 'B. SAT monotonicity',
      description: `${tc.desc}: SAT ${tc.base.sat} → ${tc.base.sat + 50} should not DECREASE prob`,
      school: tc.school,
      baseProb: baseR.probability,
      perturbedProb: upR.probability,
      delta: upAssert.delta,
      direction: 'no-decrease',
      pass: upAssert.pass,
      suspectedPath: upAssert.pass
        ? undefined
        : 'apps/api/src/modules/prediction/counselor/counselor-modifiers.ts:testBandMultiplier',
    });
    results.push({
      id: `${bId}-down`,
      category: 'B. SAT monotonicity',
      description: `${tc.desc}: SAT ${tc.base.sat} → ${tc.base.sat - 50} should not INCREASE prob`,
      school: tc.school,
      baseProb: baseR.probability,
      perturbedProb: downR.probability,
      delta: downAssert.delta,
      direction: 'no-increase',
      pass: downAssert.pass,
      suspectedPath: downAssert.pass
        ? undefined
        : 'apps/api/src/modules/prediction/counselor/counselor-modifiers.ts:testBandMultiplier',
    });
  }

  // ─── C. Round-switch direction (RD vs ED at ED-offering schools) ───────
  const edSchools = [
    { id: 'C1', school: 'University of Pennsylvania' },
    { id: 'C2', school: 'Johns Hopkins University' },
    { id: 'C3', school: 'Vanderbilt University' },
    { id: 'C4', school: 'Northwestern University' },
  ];
  const edBase: BaseProfileOpts = {
    gpa: 3.9,
    sat: 1500,
    awardsLevel: 'NATIONAL',
  };
  for (const tc of edSchools) {
    const profile = buildProfile(edBase);
    const rdR = await predict(profile, tc.school, 'RD');
    const edR = await predict(profile, tc.school, 'ED');
    // ED should give HIGHER prob — assert no-decrease from RD baseline
    const a = assert(rdR.probability, edR.probability, 'no-decrease');
    // additional: ED strictly above RD - tolerance (binding boost is the whole point)
    const positiveDelta = edR.probability - rdR.probability > 0;
    results.push({
      id: tc.id,
      category: 'C. Round-switch direction',
      description: `${tc.school}: RD → ED should INCREASE prob (binding boost)`,
      school: tc.school,
      baseProb: rdR.probability,
      perturbedProb: edR.probability,
      delta: a.delta,
      direction: 'no-decrease',
      pass: a.pass,
      notes: positiveDelta
        ? 'ED > RD (strictly positive)'
        : 'ED ≤ RD — check binding boost wiring',
      suspectedPath: a.pass
        ? undefined
        : 'apps/api/src/modules/prediction/counselor/counselor-modifiers.ts:roundMultiplier',
    });
  }

  // ─── D. Hook direction (each hook never DECREASES prob) ────────────────
  const hookBase: BaseProfileOpts = {
    gpa: 3.85,
    sat: 1480,
    awardsLevel: 'STATE',
  };
  const hookTests: Array<{
    id: string;
    school: string;
    overlay: Partial<BaseProfileOpts>;
    desc: string;
    suspect: string;
  }> = [
    {
      id: 'D1',
      school: 'Stanford University',
      overlay: { recruitedAthlete: true },
      desc: 'recruited athlete',
      suspect: 'counselor-modifiers.ts:athleteMultiplier',
    },
    {
      id: 'D2',
      school: 'Harvard University',
      overlay: { isLegacy: true, legacySchools: ['Harvard University'] },
      desc: 'legacy at Harvard',
      suspect: 'counselor-modifiers.ts:legacyHookMultiplier',
    },
    {
      id: 'D3',
      school: 'University of Pennsylvania',
      overlay: { isFirstGen: true },
      desc: 'first-gen',
      suspect: 'counselor-modifiers.ts:firstGenMultiplier',
    },
    {
      id: 'D4',
      school: 'Massachusetts Institute of Technology',
      overlay: { includeUsamo: true },
      desc: 'USAMO award',
      suspect: 'counselor-modifiers.ts:profileContextMultiplier (awards tier)',
    },
    {
      id: 'D5',
      school: 'Northwestern University',
      overlay: { includeNationalLeadership: true },
      desc: 'national leadership',
      suspect:
        'counselor-modifiers.ts:profileContextMultiplier (activities tier)',
    },
  ];
  for (const tc of hookTests) {
    const baseProfile = buildProfile(hookBase);
    const hookProfile = buildProfile({ ...hookBase, ...tc.overlay });
    const baseR = await predict(baseProfile, tc.school);
    const hookR = await predict(hookProfile, tc.school);
    const a = assert(baseR.probability, hookR.probability, 'no-decrease');
    results.push({
      id: tc.id,
      category: 'D. Hook direction',
      description: `${tc.school}: adding ${tc.desc} should NOT decrease prob`,
      school: tc.school,
      baseProb: baseR.probability,
      perturbedProb: hookR.probability,
      delta: a.delta,
      direction: 'no-decrease',
      pass: a.pass,
      suspectedPath: a.pass
        ? undefined
        : `apps/api/src/modules/prediction/${tc.suspect}`,
    });
  }

  // ─── E. Intl penalty direction (need-aware schools, flip isInternational
  //       false→true should NOT increase prob) ──────────────────────────
  const intlBase: BaseProfileOpts = {
    gpa: 3.9,
    sat: 1500,
    awardsLevel: 'NATIONAL',
  };
  // Elite-selective schools where the published intl admit rate is lower than
  // overall (intl pool more competitive), so intlMultiplier should apply a
  // penalty (or at minimum NOT a boost). Pomona / Swarthmore are need-aware
  // (needBlindInternational=false); Brown is need-blind but intlAR (4.35%) <
  // overallAR (5.39%), so the school-published-rate branch still yields <1×.
  const intlSchools = [
    { id: 'E1', school: 'Brown University' },
    { id: 'E2', school: 'Pomona College' },
    { id: 'E3', school: 'Swarthmore College' },
  ];
  for (const tc of intlSchools) {
    const usProfile = buildProfile({ ...intlBase, isInternational: false });
    const intlProfile = buildProfile({
      ...intlBase,
      isInternational: true,
      nationality: 'CN',
    });
    const usR = await predict(usProfile, tc.school);
    const intlR = await predict(intlProfile, tc.school);
    const a = assert(usR.probability, intlR.probability, 'no-increase');
    results.push({
      id: tc.id,
      category: 'E. Intl penalty direction',
      description: `${tc.school}: flipping US → intl (need-aware) should NOT increase prob`,
      school: tc.school,
      baseProb: usR.probability,
      perturbedProb: intlR.probability,
      delta: a.delta,
      direction: 'no-increase',
      pass: a.pass,
      suspectedPath: a.pass
        ? undefined
        : 'apps/api/src/modules/prediction/counselor/counselor-modifiers.ts:intlMultiplier',
    });
  }

  // ─── F. Cross-school monotonicity (same profile → tier ordering) ───────
  const fBase: BaseProfileOpts = {
    gpa: 3.85,
    sat: 1480,
    awardsLevel: 'STATE',
  };
  const fProfile = buildProfile(fBase);
  const harvardR = await predict(fProfile, 'Harvard University');
  const stanfordR = await predict(fProfile, 'Stanford University');
  const cmuR = await predict(fProfile, 'Carnegie Mellon University');
  const tulaneR = await predict(fProfile, 'Tulane University');

  // F1: Harvard ~ Stanford (both ~3.6-3.8% — predictions should be within 5pp)
  {
    const delta = stanfordR.probability - harvardR.probability;
    const pass = Math.abs(delta) <= 0.05;
    results.push({
      id: 'F1',
      category: 'F. Cross-school monotonicity',
      description: `Harvard ≈ Stanford (same profile): preds within 5pp`,
      school: 'Harvard vs Stanford',
      baseProb: harvardR.probability,
      perturbedProb: stanfordR.probability,
      delta,
      direction: 'equal-within',
      pass,
      notes: `|delta| = ${(Math.abs(delta) * 100).toFixed(2)}pp; threshold 5pp`,
      suspectedPath: pass
        ? undefined
        : 'apps/api/src/modules/prediction/counselor/anchor-resolver.service.ts (anchor mismatch?)',
    });
  }
  // F2: T5 (Harvard) < T20 (CMU)
  {
    const a = assert(harvardR.probability, cmuR.probability, 'no-decrease');
    results.push({
      id: 'F2',
      category: 'F. Cross-school monotonicity',
      description: `T5 (Harvard) prob ≤ T20 (CMU) prob for same profile`,
      school: 'Harvard vs CMU',
      baseProb: harvardR.probability,
      perturbedProb: cmuR.probability,
      delta: a.delta,
      direction: 'no-decrease',
      pass: a.pass,
      suspectedPath: a.pass
        ? undefined
        : 'apps/api/src/modules/prediction/counselor/anchor-resolver.service.ts',
    });
  }
  // F3: T20 (CMU) < T50 (Tulane)
  {
    const a = assert(cmuR.probability, tulaneR.probability, 'no-decrease');
    results.push({
      id: 'F3',
      category: 'F. Cross-school monotonicity',
      description: `T20 (CMU) prob ≤ T50 (Tulane) prob for same profile`,
      school: 'CMU vs Tulane',
      baseProb: cmuR.probability,
      perturbedProb: tulaneR.probability,
      delta: a.delta,
      direction: 'no-decrease',
      pass: a.pass,
      suspectedPath: a.pass
        ? undefined
        : 'apps/api/src/modules/prediction/counselor/anchor-resolver.service.ts',
    });
  }
  // F4: Same profile across T5 — MIT vs Stanford ordering (both elite STEM)
  {
    const mitR = await predict(
      fProfile,
      'Massachusetts Institute of Technology',
    );
    const delta = Math.abs(mitR.probability - stanfordR.probability);
    const pass = delta <= 0.05;
    results.push({
      id: 'F4',
      category: 'F. Cross-school monotonicity',
      description: `MIT ≈ Stanford (same profile): preds within 5pp`,
      school: 'MIT vs Stanford',
      baseProb: mitR.probability,
      perturbedProb: stanfordR.probability,
      delta: stanfordR.probability - mitR.probability,
      direction: 'equal-within',
      pass,
      notes: `|delta| = ${(delta * 100).toFixed(2)}pp`,
      suspectedPath: pass
        ? undefined
        : 'apps/api/src/modules/prediction/counselor/anchor-resolver.service.ts',
    });
  }
  // F5: T5 ≤ T50 transitive sanity (Stanford ≤ Tulane)
  {
    const a = assert(stanfordR.probability, tulaneR.probability, 'no-decrease');
    results.push({
      id: 'F5',
      category: 'F. Cross-school monotonicity',
      description: `T5 (Stanford) prob ≤ T50 (Tulane) prob for same profile`,
      school: 'Stanford vs Tulane',
      baseProb: stanfordR.probability,
      perturbedProb: tulaneR.probability,
      delta: a.delta,
      direction: 'no-decrease',
      pass: a.pass,
      suspectedPath: a.pass
        ? undefined
        : 'apps/api/src/modules/prediction/counselor/anchor-resolver.service.ts',
    });
  }

  // ─── G. Test-optional direction (TO with no score should NOT
  //       increase prob vs SAT-submitted baseline at selective schools) ──
  const toCases = [
    { id: 'G1', school: 'University of Pennsylvania' },
    { id: 'G2', school: 'Johns Hopkins University' },
    { id: 'G3', school: 'Brown University' },
  ];
  for (const tc of toCases) {
    const withSat = buildProfile({
      gpa: 3.9,
      sat: 1500,
      applyingTestOptional: false,
      awardsLevel: 'NATIONAL',
    });
    const toNoSat = buildProfile({
      gpa: 3.9,
      sat: 1500, // ignored due to omitTestScore
      applyingTestOptional: true,
      omitTestScore: true,
      awardsLevel: 'NATIONAL',
    });
    const baseR = await predict(withSat, tc.school);
    const toR = await predict(toNoSat, tc.school);
    const a = assert(baseR.probability, toR.probability, 'no-increase');
    results.push({
      id: tc.id,
      category: 'G. Test-optional direction',
      description: `${tc.school}: applyingTestOptional=true (no SAT) should NOT increase prob vs SAT 1500`,
      school: tc.school,
      baseProb: baseR.probability,
      perturbedProb: toR.probability,
      delta: a.delta,
      direction: 'no-increase',
      pass: a.pass,
      suspectedPath: a.pass
        ? undefined
        : 'apps/api/src/modules/prediction/counselor/counselor-modifiers.ts:testBandMultiplier (applyingTestOptional branch)',
    });
  }

  await app.close();
  return results;
}

// ------------------------------------------------------------------------
// Output
// ------------------------------------------------------------------------
function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}
function signedPp(n: number) {
  const v = n * 100;
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}pp`;
}

void main()
  .then((results) => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir = resolve(__dirname, '..', 'verification-report');
    mkdirSync(outDir, { recursive: true });

    const passed = results.filter((r) => r.pass);
    const failed = results.filter((r) => !r.pass);

    // Console
    const padId = (s: string) => s.padEnd(8);
    const padCat = (s: string) => s.padEnd(32);
    console.log('');
    console.log('═'.repeat(110));
    console.log(
      `MONOTONICITY TEST SUITE — ${results.length} tests, ${passed.length} PASS, ${failed.length} FAIL`,
    );
    console.log('═'.repeat(110));
    for (const r of results) {
      const status = r.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
      console.log(
        `${status} ${padId(r.id)} ${padCat(r.category)} ${r.description}`,
      );
      console.log(
        `         base=${pct(r.baseProb)}  perturbed=${pct(r.perturbedProb)}  Δ=${signedPp(r.delta)}  dir=${r.direction}`,
      );
      if (!r.pass && r.suspectedPath) {
        console.log(`         suspected: ${r.suspectedPath}`);
      }
      if (r.notes) console.log(`         note: ${r.notes}`);
    }
    console.log('═'.repeat(110));
    console.log(
      `Summary: ${passed.length}/${results.length} PASS  (tolerance ±${(TOLERANCE * 100).toFixed(1)}pp)`,
    );
    console.log('');

    // Markdown report
    const md: string[] = [];
    md.push(`# Engine Monotonicity Test Report — ${new Date().toISOString()}`);
    md.push('');
    md.push(`**Tolerance**: ±${(TOLERANCE * 100).toFixed(1)}pp`);
    md.push('');
    md.push(`## Summary`);
    md.push('');
    md.push(`- Total tests: **${results.length}**`);
    md.push(`- Passed: **${passed.length}**`);
    md.push(`- Failed: **${failed.length}**`);
    md.push('');

    if (failed.length > 0) {
      md.push(`## Failures (action required)`);
      md.push('');
      md.push(
        '| ID | Category | School | Base | Perturbed | Δ | Direction | Suspected path |',
      );
      md.push('|---|---|---|---|---|---|---|---|');
      for (const r of failed) {
        md.push(
          `| ${r.id} | ${r.category} | ${r.school} | ${pct(r.baseProb)} | ${pct(r.perturbedProb)} | ${signedPp(r.delta)} | ${r.direction} | ${r.suspectedPath ?? '—'} |`,
        );
      }
      md.push('');
      md.push('### Failure detail');
      md.push('');
      for (const r of failed) {
        md.push(`#### ${r.id} — ${r.description}`);
        md.push('');
        md.push(`- School: \`${r.school}\``);
        md.push(`- Base probability: ${pct(r.baseProb)}`);
        md.push(`- Perturbed probability: ${pct(r.perturbedProb)}`);
        md.push(`- Delta: **${signedPp(r.delta)}** (expected: ${r.direction})`);
        if (r.suspectedPath) {
          md.push(`- Suspected engine path: \`${r.suspectedPath}\``);
        }
        if (r.notes) md.push(`- Notes: ${r.notes}`);
        md.push('');
      }
    }

    // Per-category breakdown
    md.push('## All tests by category');
    md.push('');
    const categories = Array.from(new Set(results.map((r) => r.category)));
    for (const cat of categories) {
      md.push(`### ${cat}`);
      md.push('');
      md.push(
        '| ID | School | Description | Base | Perturbed | Δ | Direction | Status |',
      );
      md.push('|---|---|---|---|---|---|---|---|');
      for (const r of results.filter((x) => x.category === cat)) {
        md.push(
          `| ${r.id} | ${r.school} | ${r.description} | ${pct(r.baseProb)} | ${pct(r.perturbedProb)} | ${signedPp(r.delta)} | ${r.direction} | ${r.pass ? 'PASS' : '**FAIL**'} |`,
        );
      }
      md.push('');
    }

    // Interpretation
    md.push('## Interpretation (200 words)');
    md.push('');
    md.push(
      `This suite probes the counselor engine for directional correctness. ` +
        `Unlike industry-anchored fixtures (which assert prob ∈ [X, Y] ranges), ` +
        `monotonicity tests vary a single feature on the same base profile and assert ` +
        `the prediction moves the correct way. Seven categories isolate the most ` +
        `failure-prone seams: GPA / SAT band lookup, round multiplier (binding-boost ` +
        `direction), hook multipliers (athlete / legacy / first-gen / award-tier / ` +
        `activity-tier — all should be ≥1.0), the international-applicant penalty at ` +
        `need-aware schools, cross-school anchor ordering (T5 must ≤ T20 must ≤ T50 ` +
        `for the same profile, modulo close-tier neighbours), and the test-optional ` +
        `no-score penalty. A FAIL is high-signal: it means a perturbation pushed the ` +
        `probability the wrong way by more than ${(TOLERANCE * 100).toFixed(1)}pp, ` +
        `which rules out floor effects and clamp noise — almost always a real bug ` +
        `(e.g. modifier double-counting, sign error, encoded-dimension suppression mis-fire, ` +
        `anchor resolver mis-pick). The "suspected path" column points to the exact ` +
        `engine file/function to start debugging; pair with the existing ` +
        `\`counselor-engine.behavioral-matrix.spec.ts\` for finer reproduction.`,
    );
    md.push('');

    const mdPath = `${outDir}/monotonicity-${ts}.md`;
    writeFileSync(mdPath, md.join('\n'), 'utf8');
    console.log(`Report written: ${mdPath}`);

    process.exit(failed.length === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error('Monotonicity test crashed:', err);
    process.exit(2);
  });
