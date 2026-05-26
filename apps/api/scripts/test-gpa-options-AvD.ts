#!/usr/bin/env tsx
/**
 * A-vs-D test matrix for the weighted-GPA distribution contamination problem.
 *
 * Options:
 *   D — baseline (current engine, no fix)
 *   A — null-out gpaDistribution when SEVERE-tell fires:
 *         top-band (3.75-4.00) >= 0.92 AND lower-tail (<3.50) <= 0.05
 *
 * Strategy: do NOT modify engine source. Pass a copy of the school row with
 * gpaDistribution=null when the detector fires (clean fork).
 *
 * Test surfaces:
 *   Part 1 — All 50 Layer-3 fixtures × 2 options = 100 predictions
 *   Part 2 — 22 SEVERE schools × 5 applicant archetypes × 2 options = 220
 *   Part 3 — Threshold sensitivity: 5 top-band thresholds × 22 schools × 5 applicants
 *
 * Sanity mode: pass `--sanity` to run only fixture 001 then exit (smoke test).
 *
 * Output: /tmp/gpa-AvD-matrix.md
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PrismaService } from '../src/prisma/prisma.service';

// ── Config ──────────────────────────────────────────────────────────────────

const REPORT_PATH = '/tmp/gpa-AvD-matrix.md';
const RAW_JSON_PATH = '/tmp/gpa-AvD-matrix.json';

const CASES_DIR = resolve(
  __dirname,
  '..',
  'gold-cases',
  'counselor-calibration',
  'cases',
);

const DEFAULT_TOP = 0.92;
const DEFAULT_TAIL = 0.05;

// 22 SEVERE schools (from audit-weighted-gpa.tsv 2026-05-25)
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

// 5 applicant archetypes for Part 2
const APPLICANTS = [
  { key: 'Perfect', gpa: 4.0, sat: 1560 as number | null },
  { key: 'Strong', gpa: 3.85, sat: 1500 as number | null },
  { key: 'StrongTO', gpa: 3.85, sat: null },
  { key: 'Mid', gpa: 3.65, sat: 1430 as number | null },
  { key: 'Below', gpa: 3.4, sat: 1330 as number | null },
];

// ── Detector ────────────────────────────────────────────────────────────────

function readNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isContaminated(
  dist: Record<string, unknown> | null | undefined,
  topThreshold = DEFAULT_TOP,
  tailThreshold = DEFAULT_TAIL,
): boolean {
  if (!dist || typeof dist !== 'object') return false;
  // Detect whether values are 0-1 or 0-100 by total sum
  const vals = [
    readNum(dist['3.75-4.00']),
    readNum(dist['3.50-3.74']),
    readNum(dist['3.25-3.49']),
    readNum(dist['3.00-3.24']),
    readNum(dist['<3.00']),
  ];
  const sum = vals.reduce((s, v) => s + v, 0);
  if (sum <= 0) return false;
  const denom = sum > 2 ? 100 : 1;
  const top = vals[0] / denom;
  const tail = (vals[2] + vals[3] + vals[4]) / denom; // <3.50 = <3.00 + 3.00-3.24 + 3.25-3.49
  return top >= topThreshold && tail <= tailThreshold;
}

// ── Engine wrapper ──────────────────────────────────────────────────────────

function buildSchoolInput(school: any, overrides?: { gpaDistribution?: null }) {
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
    gpaDistribution:
      overrides && 'gpaDistribution' in overrides
        ? overrides.gpaDistribution
        : (school.gpaDistribution ?? null),
    testingPolicy: school.testingPolicy ?? undefined,
    testOptional: school.testOptional ?? undefined,
    hasEarlyDecision: school.hasEarlyDecision ?? undefined,
    hasEarlyAction: school.hasEarlyAction ?? undefined,
    hasRestrictiveEa: school.hasRestrictiveEa ?? undefined,
  };
}

type OptionId = 'A' | 'D';

interface RunOut {
  prob: number;
  anchor: number;
  tier: number;
  gpaMult: number;
  gpaLabel: string;
  wasNulled: boolean;
}

async function runOne(
  counselor: CounselorEngineService,
  rawSchool: any,
  profile: any,
  option: OptionId,
  round: string,
  topThreshold = DEFAULT_TOP,
  tailThreshold = DEFAULT_TAIL,
): Promise<RunOut> {
  let wasNulled = false;
  let input;
  if (option === 'A') {
    const dist = rawSchool.gpaDistribution as Record<string, unknown> | null;
    if (isContaminated(dist, topThreshold, tailThreshold)) {
      input = buildSchoolInput(rawSchool, { gpaDistribution: null });
      wasNulled = true;
    } else {
      input = buildSchoolInput(rawSchool);
    }
  } else {
    input = buildSchoolInput(rawSchool);
  }
  const r = await counselor.compute(profile, input as any, round);
  return {
    prob: r.probability,
    anchor: r.anchor,
    tier: r.tier,
    gpaMult: r.modifierResults?.gpaBand?.multiplier ?? 1.0,
    gpaLabel: r.modifierResults?.gpaBand?.label ?? '?',
    wasNulled,
  };
}

function buildProfileInput(profile: any) {
  return {
    ...profile,
    testScores: profile.testScores ?? [],
    activities: profile.activities ?? [],
    awards: profile.awards ?? [],
  };
}

// ── Part 1: Layer-3 fixtures ────────────────────────────────────────────────

interface FixtureRow {
  fixtureId: string;
  scenarioGroup: string;
  schoolName: string;
  kind: 'standalone' | 'comparative';
  contaminated: boolean;
  expectedRange?: [number, number];
  expectedMinDelta?: number;
  expectedMaxDelta?: number;
  D: { prob: number; pass: boolean; failReason?: string; wasNulled?: boolean };
  A: { prob: number; pass: boolean; failReason?: string; wasNulled?: boolean };
  // For comparative: delta = caseA - caseB
  deltaD?: number;
  deltaA?: number;
}

async function runPart1(
  counselor: CounselorEngineService,
  prisma: PrismaService,
  sanity: boolean,
): Promise<FixtureRow[]> {
  const caseFiles = readdirSync(CASES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const allFx: any[] = caseFiles.map((f) =>
    JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8')),
  );
  const fixtures = sanity ? allFx.slice(0, 1) : allFx;

  const norms = Array.from(
    new Set(fixtures.map((f) => String(f.schoolName).toLowerCase().trim())),
  );
  const schoolRows = await prisma.school.findMany({
    where: { nameNorm: { in: norms } },
  });
  const schoolByNorm = new Map(schoolRows.map((s) => [s.nameNorm, s]));

  const rows: FixtureRow[] = [];
  let idx = 0;
  for (const fx of fixtures) {
    idx++;
    if (idx % 10 === 0) {
      process.stdout.write(`    fixture ${idx}/${fixtures.length}\n`);
    }
    const norm = String(fx.schoolName).toLowerCase().trim();
    const school = schoolByNorm.get(norm);
    if (!school) {
      console.warn(`  WARN: school not found: ${fx.schoolName}`);
      continue;
    }
    const contaminated = isContaminated(
      school.gpaDistribution as Record<string, unknown> | null,
    );

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

      const dA = await runOne(counselor, school, profileA, 'D', roundA);
      const dB = await runOne(counselor, school, profileB, 'D', roundB);
      const aA = await runOne(counselor, school, profileA, 'A', roundA);
      const aB = await runOne(counselor, school, profileB, 'A', roundB);
      const deltaD = dA.prob - dB.prob;
      const deltaA = aA.prob - aB.prob;
      const minD = fx.expectedMinDelta ?? -Infinity;
      const maxD = fx.expectedMaxDelta ?? Infinity;
      const checkPass = (delta: number) => delta >= minD && delta <= maxD;
      const failReason = (delta: number) =>
        delta < minD
          ? `Δ=${(delta * 100).toFixed(2)}pp < min ${(minD * 100).toFixed(1)}pp`
          : `Δ=${(delta * 100).toFixed(2)}pp > max ${(maxD * 100).toFixed(1)}pp`;

      rows.push({
        fixtureId: fx.id,
        scenarioGroup: fx.scenarioGroup,
        schoolName: fx.schoolName,
        kind: 'comparative',
        contaminated,
        expectedMinDelta: fx.expectedMinDelta,
        expectedMaxDelta: fx.expectedMaxDelta,
        D: {
          prob: dA.prob,
          pass: checkPass(deltaD),
          failReason: checkPass(deltaD) ? undefined : failReason(deltaD),
          wasNulled: dA.wasNulled,
        },
        A: {
          prob: aA.prob,
          pass: checkPass(deltaA),
          failReason: checkPass(deltaA) ? undefined : failReason(deltaA),
          wasNulled: aA.wasNulled,
        },
        deltaD,
        deltaA,
      });
    } else {
      const profile = buildProfileInput(fx.profile);
      const round = fx.applicationRound ?? 'RD';
      const d = await runOne(counselor, school, profile, 'D', round);
      const a = await runOne(counselor, school, profile, 'A', round);
      const [lo, hi] = fx.expectedProbabilityRange;
      const checkPass = (p: number) => p >= lo && p <= hi;
      const failReason = (p: number) =>
        p < lo
          ? `${(p * 100).toFixed(2)}% < lo ${(lo * 100).toFixed(1)}%`
          : `${(p * 100).toFixed(2)}% > hi ${(hi * 100).toFixed(1)}%`;
      rows.push({
        fixtureId: fx.id,
        scenarioGroup: fx.scenarioGroup,
        schoolName: fx.schoolName,
        kind: 'standalone',
        contaminated,
        expectedRange: fx.expectedProbabilityRange,
        D: {
          prob: d.prob,
          pass: checkPass(d.prob),
          failReason: checkPass(d.prob) ? undefined : failReason(d.prob),
          wasNulled: d.wasNulled,
        },
        A: {
          prob: a.prob,
          pass: checkPass(a.prob),
          failReason: checkPass(a.prob) ? undefined : failReason(a.prob),
          wasNulled: a.wasNulled,
        },
      });
    }
  }
  return rows;
}

// ── Part 2: 22 SEVERE × 5 applicants ────────────────────────────────────────

interface AppRow {
  schoolName: string;
  applicant: string;
  D: { prob: number; gpaMult: number; gpaLabel: string };
  A: { prob: number; gpaMult: number; gpaLabel: string; wasNulled: boolean };
  delta: number; // A - D
}

function buildApplicantProfile(a: (typeof APPLICANTS)[number]) {
  const profile: any = {
    gpa: a.gpa,
    gpaScale: 4.0,
    isInternational: false,
    nationality: 'US',
    targetMajor: 'Computer Science',
    isLegacy: false,
    isFirstGen: false,
    recruitedAthlete: false,
    testScores: a.sat == null ? [] : [{ type: 'SAT', score: a.sat }],
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
  return profile;
}

async function runPart2(
  counselor: CounselorEngineService,
  prisma: PrismaService,
): Promise<AppRow[]> {
  const norms = SEVERE_SCHOOLS.map((s) => s.toLowerCase().trim());
  const schoolRows = await prisma.school.findMany({
    where: { nameNorm: { in: norms } },
  });
  const schoolByNorm = new Map(schoolRows.map((s) => [s.nameNorm, s]));

  const rows: AppRow[] = [];
  for (const schoolName of SEVERE_SCHOOLS) {
    const norm = schoolName.toLowerCase().trim();
    const school = schoolByNorm.get(norm);
    if (!school) {
      console.warn(`  WARN: SEVERE school not found: ${schoolName}`);
      continue;
    }
    for (const a of APPLICANTS) {
      const profile = buildApplicantProfile(a);
      const d = await runOne(counselor, school, profile, 'D', 'RD');
      const aRes = await runOne(counselor, school, profile, 'A', 'RD');
      rows.push({
        schoolName,
        applicant: a.key,
        D: { prob: d.prob, gpaMult: d.gpaMult, gpaLabel: d.gpaLabel },
        A: {
          prob: aRes.prob,
          gpaMult: aRes.gpaMult,
          gpaLabel: aRes.gpaLabel,
          wasNulled: aRes.wasNulled,
        },
        delta: aRes.prob - d.prob,
      });
    }
  }
  return rows;
}

// ── Part 3: Threshold sensitivity ───────────────────────────────────────────

const SENSITIVITY_THRESHOLDS = [0.85, 0.88, 0.9, 0.92, 0.95];

interface ThreshRow {
  threshold: number;
  schoolName: string;
  applicant: string;
  D: number;
  A: number;
  delta: number;
  nulled: boolean;
}

async function runPart3(
  counselor: CounselorEngineService,
  prisma: PrismaService,
): Promise<ThreshRow[]> {
  const norms = SEVERE_SCHOOLS.map((s) => s.toLowerCase().trim());
  const schoolRows = await prisma.school.findMany({
    where: { nameNorm: { in: norms } },
  });
  const schoolByNorm = new Map(schoolRows.map((s) => [s.nameNorm, s]));

  const rows: ThreshRow[] = [];
  for (const th of SENSITIVITY_THRESHOLDS) {
    for (const schoolName of SEVERE_SCHOOLS) {
      const school = schoolByNorm.get(schoolName.toLowerCase().trim());
      if (!school) continue;
      for (const a of APPLICANTS) {
        const profile = buildApplicantProfile(a);
        const d = await runOne(
          counselor,
          school,
          profile,
          'D',
          'RD',
          th,
          DEFAULT_TAIL,
        );
        const aRes = await runOne(
          counselor,
          school,
          profile,
          'A',
          'RD',
          th,
          DEFAULT_TAIL,
        );
        rows.push({
          threshold: th,
          schoolName,
          applicant: a.key,
          D: d.prob,
          A: aRes.prob,
          delta: aRes.prob - d.prob,
          nulled: aRes.wasNulled,
        });
      }
    }
  }
  return rows;
}

// ── Report writer ───────────────────────────────────────────────────────────

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function pct(n: number): string {
  return (n * 100).toFixed(2);
}

function pp(n: number): string {
  return (n * 100).toFixed(2);
}

function writeReport(part1: FixtureRow[], part2: AppRow[], part3: ThreshRow[]) {
  const moving = part1.filter((r) => Math.abs(r.A.prob - r.D.prob) > 0.005);
  const passD = part1.filter((r) => r.D.pass).length;
  const passA = part1.filter((r) => r.A.pass).length;
  const total1 = part1.length;

  const contaminatedFx = part1.filter((r) => r.contaminated);
  const contamPassD = contaminatedFx.filter((r) => r.D.pass).length;
  const contamPassA = contaminatedFx.filter((r) => r.A.pass).length;

  // For Part 2, summarize by applicant archetype
  const part2ByApplicant = new Map<string, AppRow[]>();
  for (const r of part2) {
    if (!part2ByApplicant.has(r.applicant))
      part2ByApplicant.set(r.applicant, []);
    part2ByApplicant.get(r.applicant)!.push(r);
  }

  const out: string[] = [];
  out.push(`# A-vs-D Weighted-GPA Distribution Test Matrix`);
  out.push(``);
  out.push(`Generated: ${new Date().toISOString()}`);
  out.push(``);

  // Executive summary (200 words target)
  const overPredict = part2.filter((r) => r.D.prob > r.A.prob).length;
  const underPredict = part2.filter((r) => r.D.prob < r.A.prob).length;
  const medianDeltaPerf = median(
    part2.filter((r) => r.applicant === 'Perfect').map((r) => r.delta),
  );
  const medianDeltaMid = median(
    part2.filter((r) => r.applicant === 'Mid').map((r) => r.delta),
  );
  const medianDeltaBelow = median(
    part2.filter((r) => r.applicant === 'Below').map((r) => r.delta),
  );

  out.push(`## Executive Summary`);
  out.push(``);
  out.push(
    `Tested 50 Layer-3 fixtures + 110 (22 SEVERE schools × 5 archetypes) under D (baseline) vs A (null gpaDistribution when top-band≥0.92 AND <3.50 tail≤0.05). Part-1 pass: D=${passD}/${total1}, A=${passA}/${total1}. On the ${contaminatedFx.length} fixtures whose school IS contaminated: D=${contamPassD}, A=${contamPassA}. Part 1 moves ≥0.5pp on ${moving.length}/${total1} fixtures — the rest are unchanged because the SEVERE-tell never fires (non-contaminated schools) or the engine bypasses gpaBandMultiplier via a Tier-1 anchor.`,
  );
  out.push(``);
  out.push(
    `Part 2 direction: Option A raises probability for ${underPredict}/${part2.length} cells and lowers it for ${overPredict}/${part2.length}. Median Δ (A−D) by archetype: Perfect=${pp(medianDeltaPerf)}pp, Mid=${pp(medianDeltaMid)}pp, Below=${pp(medianDeltaBelow)}pp. Mechanism: weighted CDS distributions place virtually every applicant above the 3.75 median, so the engine ×1.5-caps the GPA multiplier even at GPA 3.40 — D systematically over-predicts. Falling back to the SAT-band heuristic correctly identifies sub-median GPA as a negative signal.`,
  );
  out.push(``);
  out.push(`See "Bottom Line" and "Recommendation" sections.`);
  out.push(``);

  // ─── Part 1 ─────────────────────────────────────────────────────────────
  out.push(`## Part 1 — Layer-3 fixtures (50 × 2 options)`);
  out.push(``);
  out.push(`| Metric | Value |`);
  out.push(`|---|---|`);
  out.push(`| Total fixtures | ${total1} |`);
  out.push(
    `| Pass under D (baseline) | ${passD}/${total1} (${((passD / total1) * 100).toFixed(1)}%) |`,
  );
  out.push(
    `| Pass under A (null contam) | ${passA}/${total1} (${((passA / total1) * 100).toFixed(1)}%) |`,
  );
  out.push(
    `| Fixtures whose school is contaminated | ${contaminatedFx.length}/${total1} |`,
  );
  out.push(
    `| Contaminated subset — pass D | ${contamPassD}/${contaminatedFx.length} |`,
  );
  out.push(
    `| Contaminated subset — pass A | ${contamPassA}/${contaminatedFx.length} |`,
  );
  out.push(`| Fixtures moving ≥0.5pp | ${moving.length} |`);
  out.push(``);

  if (moving.length > 0) {
    out.push(`### Moving fixtures (D → A, ≥0.5pp shift)`);
    out.push(``);
    out.push(
      `| ID | School | Group | Kind | D prob | A prob | Δpp | D pass | A pass |`,
    );
    out.push(`|---|---|---|---|---|---|---|---|---|`);
    for (const r of moving) {
      const dProb = r.kind === 'comparative' ? (r.deltaD ?? 0) : r.D.prob;
      const aProb = r.kind === 'comparative' ? (r.deltaA ?? 0) : r.A.prob;
      const delta = aProb - dProb;
      out.push(
        `| \`${r.fixtureId}\` | ${r.schoolName} | ${r.scenarioGroup} | ${r.kind} | ${pct(dProb)}% | ${pct(aProb)}% | ${(delta * 100).toFixed(2)} | ${r.D.pass ? 'Y' : 'N'} | ${r.A.pass ? 'Y' : 'N'} |`,
      );
    }
    out.push(``);
  }

  // ─── Part 2 ─────────────────────────────────────────────────────────────
  out.push(`## Part 2 — 22 SEVERE schools × 5 applicant archetypes`);
  out.push(``);
  out.push(`### Per-archetype summary (median Δ across 22 schools)`);
  out.push(``);
  out.push(
    `| Archetype | GPA | SAT | Median D% | Median A% | Median Δpp | Schools where A>D | Schools where A<D |`,
  );
  out.push(`|---|---|---|---|---|---|---|---|`);
  for (const a of APPLICANTS) {
    const rs = part2.filter((r) => r.applicant === a.key);
    const medD = median(rs.map((r) => r.D.prob));
    const medA = median(rs.map((r) => r.A.prob));
    const medDelta = median(rs.map((r) => r.delta));
    const aGreater = rs.filter((r) => r.A.prob > r.D.prob + 0.001).length;
    const dGreater = rs.filter((r) => r.D.prob > r.A.prob + 0.001).length;
    out.push(
      `| ${a.key} | ${a.gpa} | ${a.sat ?? 'TO'} | ${pct(medD)}% | ${pct(medA)}% | ${(medDelta * 100).toFixed(2)} | ${aGreater}/${rs.length} | ${dGreater}/${rs.length} |`,
    );
  }
  out.push(``);

  out.push(`### Per-school detail (22 schools × 5 archetypes)`);
  out.push(``);
  // Group by school
  const part2BySchool = new Map<string, AppRow[]>();
  for (const r of part2) {
    if (!part2BySchool.has(r.schoolName)) part2BySchool.set(r.schoolName, []);
    part2BySchool.get(r.schoolName)!.push(r);
  }
  for (const schoolName of SEVERE_SCHOOLS) {
    const rs = part2BySchool.get(schoolName);
    if (!rs) continue;
    out.push(`#### ${schoolName}`);
    out.push(``);
    out.push(
      `| Archetype | D% | A% | Δpp | D gpaMult | A gpaMult | A label | A nulled? |`,
    );
    out.push(`|---|---|---|---|---|---|---|---|`);
    for (const r of rs) {
      out.push(
        `| ${r.applicant} | ${pct(r.D.prob)} | ${pct(r.A.prob)} | ${(r.delta * 100).toFixed(2)} | ${r.D.gpaMult.toFixed(2)} | ${r.A.gpaMult.toFixed(2)} | ${r.A.gpaLabel} | ${r.A.wasNulled ? 'Y' : 'N'} |`,
      );
    }
    out.push(``);
  }

  // ─── Part 3 ─────────────────────────────────────────────────────────────
  out.push(`## Part 3 — Threshold sensitivity`);
  out.push(``);
  out.push(
    `For each top-band threshold (lower=more aggressive null-out), measure how many SEVERE-school cells get nulled and the resulting per-archetype median Δ.`,
  );
  out.push(``);
  out.push(
    `| Top-threshold | Cells nulled | All-cell median Δpp | Perfect Δpp | Strong Δpp | StrongTO Δpp | Mid Δpp | Below Δpp |`,
  );
  out.push(`|---|---|---|---|---|---|---|---|`);
  for (const th of SENSITIVITY_THRESHOLDS) {
    const rs = part3.filter((r) => r.threshold === th);
    const nulled = rs.filter((r) => r.nulled).length;
    const allMed = median(rs.map((r) => r.delta));
    const byApp = (key: string) =>
      median(rs.filter((r) => r.applicant === key).map((r) => r.delta));
    out.push(
      `| ${th.toFixed(2)} | ${nulled}/${rs.length} | ${(allMed * 100).toFixed(2)} | ${(byApp('Perfect') * 100).toFixed(2)} | ${(byApp('Strong') * 100).toFixed(2)} | ${(byApp('StrongTO') * 100).toFixed(2)} | ${(byApp('Mid') * 100).toFixed(2)} | ${(byApp('Below') * 100).toFixed(2)} |`,
    );
  }
  out.push(``);

  // ─── Bottom line ────────────────────────────────────────────────────────
  out.push(`## Bottom Line`);
  out.push(``);

  const passDiff = passA - passD;
  const contamDiff = contamPassA - contamPassD;
  const directionalSummary =
    medianDeltaBelow < -0.01
      ? 'Option A meaningfully LOWERS predictions for sub-median GPA applicants (the contamination signature: weighted distributions make 3.40 GPAs look median-ish; A correctly flags them as below-25th).'
      : medianDeltaBelow > 0.01
        ? 'Option A unexpectedly RAISES predictions for sub-median applicants — investigate.'
        : 'Option A has minimal effect on sub-median applicants — investigate fallback path.';
  out.push(
    `- **Layer-3 pass rate**: A=${passA}/${total1} vs D=${passD}/${total1} (${passDiff > 0 ? '+' : ''}${passDiff}).`,
  );
  out.push(
    `- **Contaminated-school subset**: A=${contamPassA}/${contaminatedFx.length} vs D=${contamPassD}/${contaminatedFx.length} (${contamDiff > 0 ? '+' : ''}${contamDiff}).`,
  );
  out.push(`- **Direction**: ${directionalSummary}`);
  out.push(
    `- **Mid-GPA applicants** (3.65, the threshold case): median Δ = ${(medianDeltaMid * 100).toFixed(2)}pp`,
  );
  out.push(
    `- **Below-median applicants** (3.40): median Δ = ${(medianDeltaBelow * 100).toFixed(2)}pp`,
  );
  out.push(
    `- **Perfect applicants** (4.0/1560): median Δ = ${(medianDeltaPerf * 100).toFixed(2)}pp`,
  );
  out.push(``);

  // Recommendation
  out.push(`## Recommendation (data-driven)`);
  out.push(``);
  if (
    passA >= passD &&
    contamPassA >= contamPassD &&
    medianDeltaBelow < -0.005
  ) {
    out.push(
      `**Adopt Option A** at threshold top-band≥0.92, tail≤0.05. Evidence:`,
    );
    out.push(
      `- Layer-3 pass rate is preserved or improved (${passA} vs ${passD}).`,
    );
    out.push(
      `- Contaminated-school subset improves by ${contamDiff} fixtures.`,
    );
    out.push(
      `- Sub-median applicants are correctly down-weighted (median Δ ${(medianDeltaBelow * 100).toFixed(2)}pp on the Below archetype).`,
    );
    out.push(
      `- Perfect applicants barely move (${(medianDeltaPerf * 100).toFixed(2)}pp), confirming the fix targets the specific contamination signature.`,
    );
  } else if (passA < passD) {
    out.push(
      `**Reject Option A** at current threshold. Layer-3 pass rate regresses by ${Math.abs(passDiff)} fixtures. Re-tune thresholds or investigate which fixtures break.`,
    );
  } else {
    out.push(
      `**Inconclusive**. Pass rate flat but directional behavior unclear — review Part 2 cells.`,
    );
  }
  out.push(``);

  // Optional: threshold tuning recommendation
  const part3ByTh = new Map<number, number>(); // th -> median below Δ
  for (const th of SENSITIVITY_THRESHOLDS) {
    const rs = part3.filter(
      (r) => r.threshold === th && r.applicant === 'Below',
    );
    part3ByTh.set(th, median(rs.map((r) => r.delta)));
  }
  const bestTh = [...part3ByTh.entries()].sort((a, b) => a[1] - b[1])[0];
  out.push(
    `**Threshold tuning**: Among {${SENSITIVITY_THRESHOLDS.join(', ')}}, the threshold yielding most negative Below-archetype median Δ is **${bestTh[0].toFixed(2)}** (${(bestTh[1] * 100).toFixed(2)}pp). But the most aggressive threshold also nulls more cells — see Part 3 table to balance coverage vs precision.`,
  );
  out.push(``);

  writeFileSync(REPORT_PATH, out.join('\n'));
  writeFileSync(
    RAW_JSON_PATH,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), part1, part2, part3 },
      null,
      2,
    ),
  );
  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`Raw JSON: ${RAW_JSON_PATH}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const sanity = process.argv.includes('--sanity');
  const skipPart3 = process.argv.includes('--no-sensitivity');
  const skipPart1 = process.argv.includes('--no-part1');
  const skipPart2 = process.argv.includes('--no-part2');

  const start = Date.now();
  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    { logger: ['error', 'warn'] },
  );
  const counselor = app.get(CounselorEngineService);
  const prisma = app.get(PrismaService);

  console.log(`\n== A-vs-D test matrix (sanity=${sanity}) ==\n`);

  let part1: FixtureRow[] = [];
  let part2: AppRow[] = [];
  let part3: ThreshRow[] = [];

  if (!skipPart1) {
    console.log(`\n--- Part 1: Layer-3 fixtures ---`);
    part1 = await runPart1(counselor, prisma, sanity);
    console.log(`  done: ${part1.length} fixtures`);
  }

  if (sanity) {
    // In sanity mode, only Part 1 with 1 fixture
    const first = part1[0];
    console.log(`\nSanity result:`);
    console.log(JSON.stringify(first, null, 2));
    await app.close();
    process.exit(0);
  }

  if (!skipPart2) {
    console.log(`\n--- Part 2: 22 SEVERE schools × 5 applicants ---`);
    part2 = await runPart2(counselor, prisma);
    console.log(`  done: ${part2.length} predictions`);
  }

  if (!skipPart3) {
    console.log(`\n--- Part 3: Threshold sensitivity ---`);
    part3 = await runPart3(counselor, prisma);
    console.log(`  done: ${part3.length} predictions`);
  }

  console.log(`\n--- Writing report ---`);
  writeReport(part1, part2, part3);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nTotal elapsed: ${elapsed}s`);

  await app.close();
}

main().catch((err) => {
  console.error('CRASH:', err);
  process.exit(1);
});
