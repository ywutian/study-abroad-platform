/**
 * M3: Bayesian Sequential Update Prediction Engine
 *
 * Per docs/PREDICTION_V2_DESIGN.md (v2.1, 2026-05-22)
 *
 * For each profile dimension where the school has a public data anchor, do
 * one Bayesian update. Tier-weighted (HIGH/MEDIUM/LOW). Output includes
 * per-dimension contributions for transparency.
 *
 * Standalone script (no NestJS). Reads from DB directly via Prisma.
 *
 * Usage:
 *   pnpm exec tsx scripts/m3-bayesian-engine.ts                  # Alice Zhang × 4 v3 schools
 *   pnpm exec tsx scripts/m3-bayesian-engine.ts --json           # JSON output
 *   pnpm exec tsx scripts/m3-bayesian-engine.ts --school=mit     # single school
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

// ─── Types ──────────────────────────────────────────────────────────────────

export type Tier = 'HIGH' | 'MEDIUM' | 'LOW';
export const TIER_WEIGHT: Record<Tier, number> = { HIGH: 1.0, MEDIUM: 0.7, LOW: 0.5 };

export interface Contribution {
  dimension: string;
  studentValue: string | number;
  schoolAnchor: string;
  likelihoodRatio: number;
  weight: number;
  tier: Tier;
  deltaPp: number; // probability change in percentage points
  source: string;
}

export interface Diagnostic {
  dimension: string;
  state: 'no-school-anchor' | 'no-profile-value' | 'inapplicable';
  message: string;
}

export interface PredictionOutput {
  schoolName: string;
  probability: number;
  tier: 'reach' | 'match' | 'safety';
  confidence: 'high' | 'medium' | 'low' | 'very-low';
  contributions: Contribution[];
  diagnostics: Diagnostic[];
  trace: Array<{ after: string; p: number }>;
}

// ─── Math primitives ────────────────────────────────────────────────────────

function bayesUpdate(p: number, likelihoodRatio: number, weight = 1.0): number {
  if (likelihoodRatio <= 0 || !isFinite(likelihoodRatio)) return p;
  const odds = p / (1 - p);
  const newOdds = odds * Math.pow(likelihoodRatio, weight);
  return newOdds / (1 + newOdds);
}

function normalPdf(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return 1;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function deriveTier(p: number): 'reach' | 'match' | 'safety' {
  if (p >= 0.7) return 'safety';
  if (p >= 0.35) return 'match';
  return 'reach';
}

// ─── Global aggregates (Bayesian denominators) ──────────────────────────────

const GLOBAL_AGG_PATH = join(
  __dirname,
  '..',
  'apps/api/scripts/cds-collection-2026-05-22/global-admit-aggregates.json'
);

let GLOBAL_AGG: any;
try {
  GLOBAL_AGG = JSON.parse(readFileSync(GLOBAL_AGG_PATH, 'utf8'));
} catch {
  GLOBAL_AGG = {
    hookPrevalenceInApplicantPool: {
      legacy: { value: 0.05 },
      recruitedAthlete: { value: 0.015 },
      firstGen: { value: 0.2 },
      international: { value: 0.13 },
      nationalLevelAward: { value: 0.08 },
    },
  };
}

// ─── CIP code mapping (major name → CIP code prefix) ────────────────────────

const MAJOR_TO_CIP_KEYWORDS: Record<string, string[]> = {
  'Computer Science': ['11', 'computer science', 'computing'],
  'Electrical Engineering': ['14.10', 'electrical', 'engineering'],
  Mathematics: ['27', 'math'],
  Economics: ['45.06', 'economics'],
  Biology: ['26', 'biology', 'biological'],
  Physics: ['40.08', 'physics'],
  Chemistry: ['40.05', 'chemistry'],
  Business: ['52', 'business'],
  English: ['23', 'english'],
  History: ['54', 'history'],
};

function findMajorProgram(programs: any[], targetMajor: string | null) {
  if (!targetMajor || !programs?.length) return null;
  const keywords = (MAJOR_TO_CIP_KEYWORDS[targetMajor] ?? [targetMajor.toLowerCase()]).map((k) =>
    k.toLowerCase()
  );
  return programs.find((prg) =>
    keywords.some(
      (kw) => prg.programName?.toLowerCase().includes(kw) || prg.cipCode?.toLowerCase().includes(kw)
    )
  );
}

// ─── Dimension functions ────────────────────────────────────────────────────

function dimSat(profile: any, school: any): Contribution | Diagnostic | null {
  const satScore = profile.testScores?.find((t: any) => t.type === 'SAT')?.score;
  if (!satScore) {
    if (profile.applyingTestOptional) {
      return {
        dimension: 'sat',
        state: 'inapplicable',
        message: 'Applying test-optional, SAT dimension skipped',
      };
    }
    return { dimension: 'sat', state: 'no-profile-value', message: 'No SAT score' };
  }
  if (!school.sat25 || !school.sat75) {
    return { dimension: 'sat', state: 'no-school-anchor', message: 'School has no SAT range' };
  }

  // Admit pool: normal centered at midpoint, sigma from p25-p75 range
  const admitMu = (Number(school.sat25) + Number(school.sat75)) / 2;
  const admitSigma = Math.max(20, (Number(school.sat75) - Number(school.sat25)) / 1.349);

  // Apply pool: shifted ~50 lower, slightly wider
  const applyMu = admitMu - 60;
  const applySigma = admitSigma * 1.3;

  const lAdmit = normalPdf(Number(satScore), admitMu, admitSigma);
  const lApply = normalPdf(Number(satScore), applyMu, applySigma);
  const lr = lApply > 0 ? lAdmit / lApply : 1;

  return {
    dimension: 'sat',
    studentValue: Number(satScore),
    schoolAnchor: `admit pool ${school.sat25}-${school.sat75}`,
    likelihoodRatio: lr,
    weight: TIER_WEIGHT.HIGH,
    tier: 'HIGH',
    deltaPp: 0,
    source: 'School.sat25/sat75',
  };
}

/**
 * Find which GPA band a student falls into. Bands are like "3.25-3.49", "3.75-4.00".
 */
function gpaBandFor(gpa: number): string | null {
  if (gpa < 3.0) return '<3.00';
  if (gpa < 3.25) return '3.00-3.24';
  if (gpa < 3.5) return '3.25-3.49';
  if (gpa < 3.75) return '3.50-3.74';
  return '3.75-4.00';
}

function satBandFor(sat: number): string {
  // Map to school's CDS band shape — coarse buckets
  if (sat >= 1500) return '1500-1600';
  if (sat >= 1400) return '1400-1499';
  if (sat >= 1300) return '1300-1399';
  if (sat >= 1200) return '1200-1299';
  return '<1200';
}

/**
 * Compute weighted mean and stddev from a gpaDistribution JSON.
 * Returns per-school admit pool statistics (instead of fixed sigma=0.15).
 */
function deriveStatsFromDistribution(dist: Record<string, any>): {
  mean: number;
  sigma: number;
  totalMass: number;
} | null {
  let mean = 0;
  let sumSq = 0;
  let totalMass = 0;
  const bandMids: Array<{ mid: number; mass: number }> = [];

  for (const [band, frac] of Object.entries(dist)) {
    const f = Number(frac);
    if (!isFinite(f) || f <= 0) continue;
    let mid: number;
    if (band === '4.0' || band === '4') mid = 4.0;
    else if (band === '<3.00') mid = 2.85;
    else {
      const m = band.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
      mid = m ? (Number(m[1]) + Number(m[2])) / 2 : NaN;
    }
    if (!isFinite(mid)) continue;
    bandMids.push({ mid, mass: f });
    mean += mid * f;
    totalMass += f;
  }
  if (totalMass <= 0) return null;
  mean /= totalMass;

  for (const { mid, mass } of bandMids) {
    sumSq += mass * (mid - mean) ** 2;
  }
  let sigma = Math.sqrt(sumSq / totalMass);
  // Floor sigma at 0.05 (uncertainty in admit pool) and cap at 0.5 (sanity)
  sigma = Math.max(0.05, Math.min(0.5, sigma));
  return { mean, sigma, totalMass };
}

function dimGpa(profile: any, school: any): Contribution | Diagnostic | null {
  const gpa = profile.gpa ? Number(profile.gpa) : null;
  if (gpa === null) {
    return { dimension: 'gpa', state: 'no-profile-value', message: 'No GPA' };
  }

  // ── Path A: CDS band direct lookup (highest precision, per Bug B fix) ──
  // If school has SchoolCdsAdmitBand attached, look up directly. This
  // bypasses the normal-pdf approximation entirely for the 9 UC schools
  // (and any other school where we've imported per-cell admit rates).
  const bands = (school._cdsBands ?? []) as Array<{
    gpaBand: string;
    testType: string;
    testBand: string;
    admitRate: number;
  }>;
  if (bands.length > 0) {
    const studentGpaBand = gpaBandFor(gpa);
    const sat = profile.testScores?.find((t: any) => t.type === 'SAT')?.score;
    const studentSatBand = sat ? satBandFor(Number(sat)) : null;

    // Prefer (GPA × SAT) match, fall back to GPA_ONLY
    let band = bands.find(
      (b) =>
        b.gpaBand === studentGpaBand &&
        (b.testType === 'SAT' ? b.testBand === studentSatBand : true)
    );
    if (!band) {
      // try GPA_ONLY
      band = bands.find((b) => b.gpaBand === studentGpaBand && b.testType === 'GPA_ONLY');
    }
    if (band) {
      const bandRate = Number(band.admitRate); // already 0-1 (e.g., 0.17)
      const overall = rateToDecimal(school.acceptanceRate) ?? 0.1;
      // ── CDS band → DIRECT PRIOR OVERRIDE (not LR update) ──
      // Reason: For low-selectivity schools (UCR overall 77%, CDS for low
      // GPA = 28%), the LR-based Bayes update from 77% prior gives ~55%,
      // not 28%. The CDS band is the most precise direct estimate of
      // P(admit | GPA); we use it as the new prior, then other dims update.
      // Signal this to predict() via lr=NaN + a sentinel in source.
      return {
        dimension: 'gpa',
        studentValue: gpa,
        schoolAnchor: `CDS band ${band.gpaBand} / ${band.testType}=${band.testBand}: ${(bandRate * 100).toFixed(1)}%`,
        likelihoodRatio: bandRate, // re-purposed: when source includes CDS_DIRECT, this is the new prior
        weight: TIER_WEIGHT.HIGH,
        tier: 'HIGH',
        deltaPp: 0,
        source: `SchoolCdsAdmitBand CDS_DIRECT (was ${(overall * 100).toFixed(1)}% overall → ${(bandRate * 100).toFixed(1)}% in this band)`,
      };
    }
    // CDS bands exist but no match for this profile — fall through to Path B
  }

  // ── Path B: normal-pdf approximation with per-school adaptive sigma ──
  // (per Bug A fix — sigma derived from gpaDistribution variance, not fixed)
  const dist = school.gpaDistribution;
  if (!dist || typeof dist !== 'object') {
    return {
      dimension: 'gpa',
      state: 'no-school-anchor',
      message: 'School has no gpaDistribution or CDS band',
    };
  }
  const stats = deriveStatsFromDistribution(dist);
  if (!stats || stats.totalMass === 0) {
    return {
      dimension: 'gpa',
      state: 'no-school-anchor',
      message: 'gpaDistribution unparseable',
    };
  }

  const admitMu = stats.mean;
  const admitSigma = stats.sigma;
  // Apply pool: shifted ~0.10 below admit (less selective schools, gap smaller).
  // Selective schools (sigma small) → applied pool only slightly wider.
  const applyMu = admitMu - 0.1;
  const applySigma = Math.max(admitSigma * 1.5, 0.2);

  // ── Monotonicity fix: clamp evaluation GPA at admit_mu so that GPA above
  // admit mean doesn't get penalized for falling in the right tail of the
  // admit pool. Below admit_mu uses actual gpa for monotonic decrease.
  // ── This handles the case where GPA is bounded at 4.0 (top schools'
  // admit pool peaks near 4.0; a 4.0 student is at admit pool peak, not
  // outlier).
  const effectiveGpa = Math.min(gpa, admitMu);

  const lAdmit = normalPdf(effectiveGpa, admitMu, admitSigma);
  const lApply = normalPdf(effectiveGpa, applyMu, applySigma);
  const lr = lApply > 0 ? lAdmit / lApply : 1;

  return {
    dimension: 'gpa',
    studentValue: gpa,
    schoolAnchor: `admit pool mean ≈ ${admitMu.toFixed(2)}, σ ≈ ${admitSigma.toFixed(2)} (derived)`,
    likelihoodRatio: lr,
    weight: TIER_WEIGHT.HIGH,
    tier: 'HIGH',
    deltaPp: 0,
    source: 'School.gpaDistribution (normal-pdf, adaptive σ, monotonic)',
  };
}

// DB stores rates as percentages (3.91 for 3.91%), normalize to decimal
function rateToDecimal(raw: any): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!isFinite(n) || n < 0) return null;
  // Heuristic: values > 1.0 are percentages, <= 1.0 are decimals
  return n > 1.0 ? n / 100 : n;
}

function dimRound(profile: any, school: any): Contribution | Diagnostic | null {
  const round = profile.applicationRound;
  if (!round) {
    return { dimension: 'round', state: 'no-profile-value', message: 'No application round' };
  }
  const overall = rateToDecimal(school.acceptanceRate);
  if (!overall) {
    return { dimension: 'round', state: 'no-school-anchor', message: 'No overall acceptance rate' };
  }

  let edRate: number | null = null;
  let label = '';

  if (round === 'ED' || round === 'ED_I' || round === 'ED1') {
    edRate = rateToDecimal(school.edAcceptanceRate);
    label = 'ED';
  } else if (round === 'REA' || round === 'EA' || round === 'SCEA') {
    edRate = rateToDecimal(school.eaAcceptanceRate);
    label = round;
  } else {
    return {
      dimension: 'round',
      state: 'inapplicable',
      message: `Round=${round}, no special boost (RD baseline)`,
    };
  }

  if (edRate === null) {
    const fallback = round === 'ED' || round === 'ED_I' || round === 'ED1' ? 2.5 : 1.4;
    return {
      dimension: 'round',
      studentValue: round,
      schoolAnchor: `(fallback global) ${label} ×${fallback}`,
      likelihoodRatio: fallback,
      weight: TIER_WEIGHT.MEDIUM,
      tier: 'MEDIUM',
      deltaPp: 0,
      source: 'global fallback (school not published)',
    };
  }

  const lr = edRate / overall;
  return {
    dimension: 'round',
    studentValue: round,
    schoolAnchor: `${label}Rate ${(edRate * 100).toFixed(2)}% / overall ${(overall * 100).toFixed(2)}%`,
    likelihoodRatio: lr,
    weight: TIER_WEIGHT.HIGH,
    tier: 'HIGH',
    deltaPp: 0,
    source: `School.${round === 'ED' ? 'edAcceptanceRate' : 'eaAcceptanceRate'}`,
  };
}

function dimIntl(profile: any, school: any): Contribution | Diagnostic | null {
  const isIntl = profile.nationality && !/^(US|USA|United States)$/i.test(profile.nationality);
  if (!isIntl) {
    return {
      dimension: 'intl',
      state: 'inapplicable',
      message: 'Domestic US applicant',
    };
  }
  const intlRate = rateToDecimal(school.intlAcceptanceRate);
  const overall = rateToDecimal(school.acceptanceRate);

  // HIGH tier path: school publishes intlAcceptanceRate
  if (intlRate && overall) {
    const lr = intlRate / overall;
    return {
      dimension: 'intl',
      studentValue: profile.nationality,
      schoolAnchor: `intl ${(intlRate * 100).toFixed(2)}% vs overall ${(overall * 100).toFixed(2)}%`,
      likelihoodRatio: lr,
      weight: TIER_WEIGHT.HIGH,
      tier: 'HIGH',
      deltaPp: 0,
      source: 'School.intlAcceptanceRate',
    };
  }

  // MEDIUM tier fallback: school doesn't publish intl rate, but we still know
  // international applicants face a meaningful penalty at selective US schools.
  // Industry consensus (NACAC 2024; Crimson aggregates):
  //   - T10 (overall < 10%):  intl ≈ 0.5× domestic odds (need-aware, intl quotas)
  //   - T20 (overall 10-20%): intl ≈ 0.65× domestic odds
  //   - T20+ (overall > 20%): intl ≈ 0.85× domestic odds (less restrictive)
  // Using log-odds multipliers so this composes with other Bayesian dims.
  if (overall) {
    let fallbackLR: number;
    let band: string;
    if (overall < 0.1) {
      fallbackLR = 0.5;
      band = 'T10';
    } else if (overall < 0.2) {
      fallbackLR = 0.65;
      band = 'T20';
    } else {
      fallbackLR = 0.85;
      band = 'T20+';
    }
    return {
      dimension: 'intl',
      studentValue: profile.nationality,
      schoolAnchor: `(fallback) ${band} band, ×${fallbackLR} odds`,
      likelihoodRatio: fallbackLR,
      weight: TIER_WEIGHT.MEDIUM,
      tier: 'MEDIUM',
      deltaPp: 0,
      source: 'global fallback (school.intlAcceptanceRate missing)',
    };
  }

  // Truly no data — can't even infer a penalty
  return {
    dimension: 'intl',
    state: 'no-school-anchor',
    message: 'School has no intl admit rate and no overall acceptance rate',
  };
}

function dimMajor(profile: any, school: any): Contribution | Diagnostic | null {
  const major = profile.targetMajor;
  if (!major) {
    return { dimension: 'major', state: 'no-profile-value', message: 'No target major' };
  }
  const program = findMajorProgram(school.programs ?? [], major);
  if (!program?.acceptanceRateEstimate) {
    return {
      dimension: 'major',
      state: 'no-school-anchor',
      message: `No SchoolProgram for "${major}"`,
    };
  }
  const programRate = rateToDecimal(program.acceptanceRateEstimate);
  const overall = rateToDecimal(school.acceptanceRate);
  if (!programRate || !overall) {
    return { dimension: 'major', state: 'no-school-anchor', message: 'Invalid rates' };
  }
  const lr = programRate / overall;
  return {
    dimension: 'major',
    studentValue: major,
    schoolAnchor: `${program.programName} ${(programRate * 100).toFixed(2)}% vs overall ${(overall * 100).toFixed(2)}%`,
    likelihoodRatio: lr,
    weight: TIER_WEIGHT.MEDIUM,
    tier: 'MEDIUM',
    deltaPp: 0,
    source: 'SchoolProgram.acceptanceRateEstimate',
  };
}

function dimLegacy(profile: any, school: any): Contribution | Diagnostic | null {
  const legacy = Array.isArray(profile.legacy) ? profile.legacy : [];
  const hasLegacyAtThis = legacy.some(
    (s: string) => s?.toLowerCase() === school.name?.toLowerCase()
  );
  if (!hasLegacyAtThis) {
    return { dimension: 'legacy', state: 'inapplicable', message: 'No legacy at this school' };
  }
  // Per-school multiplier from CDS / SFFA / school class profile (HIGH tier when DB has it)
  // Fallback to global avg ×4 (range 1.3-6.7 from collected data)
  const perSchoolMult = school.legacyAdmitMultiplier ? Number(school.legacyAdmitMultiplier) : null;
  const tier = school.admitProfileConfidenceTier ?? 'MEDIUM';
  const lr = perSchoolMult ?? 4.0;
  return {
    dimension: 'legacy',
    studentValue: 'legacy at this school',
    schoolAnchor: perSchoolMult
      ? `per-school ×${perSchoolMult} (${tier})`
      : 'global avg ×4 (no per-school data)',
    likelihoodRatio: lr,
    weight: tier === 'HIGH' ? TIER_WEIGHT.HIGH : TIER_WEIGHT.MEDIUM,
    tier: tier === 'HIGH' ? 'HIGH' : 'MEDIUM',
    deltaPp: 0,
    source: perSchoolMult ? `School.legacyAdmitMultiplier (${tier})` : 'global aggregate fallback',
  };
}

function dimAthlete(profile: any, school: any): Contribution | Diagnostic | null {
  if (!profile.recruitedAthlete) {
    return { dimension: 'athlete', state: 'inapplicable', message: 'Not recruited athlete' };
  }
  if (profile.recruitedCoachStatus !== 'VERIFIED' && profile.recruitedCoachStatus !== 'COMMITTED') {
    return {
      dimension: 'athlete',
      state: 'inapplicable',
      message: `Athlete claim unverified (status=${profile.recruitedCoachStatus ?? 'null'}), no boost applied`,
    };
  }
  // Per-school multiplier (e.g., Harvard 20×, Stanford ~12×, JHU D3 ~4×)
  const perSchoolMult = school.athleteAdmitMultiplier
    ? Number(school.athleteAdmitMultiplier)
    : null;
  const tier = school.admitProfileConfidenceTier ?? 'MEDIUM';
  const lr = perSchoolMult ?? 3.0;
  return {
    dimension: 'athlete',
    studentValue: `recruited (${profile.recruitedSport ?? 'unknown sport'})`,
    schoolAnchor: perSchoolMult
      ? `per-school ×${perSchoolMult} (${tier})`
      : 'global avg ×3 (no per-school data)',
    likelihoodRatio: lr,
    weight: tier === 'HIGH' ? TIER_WEIGHT.HIGH : TIER_WEIGHT.MEDIUM,
    tier: tier === 'HIGH' ? 'HIGH' : 'MEDIUM',
    deltaPp: 0,
    source: perSchoolMult ? `School.athleteAdmitMultiplier (${tier})` : 'global aggregate fallback',
  };
}

function dimFirstGen(profile: any, _school: any): Contribution | Diagnostic | null {
  if (!profile.firstGeneration) {
    return { dimension: 'firstGen', state: 'inapplicable', message: 'Not first-generation' };
  }
  // LR 1.5 (was 1.3) better matches NACAC 2024 + Arcidiacono SFFA expert-witness
  // estimates: first-gen applicants at need-blind T20 schools see 50-80% lift
  // in admit rate vs the overall pool. 1.3 with MEDIUM weight produced effective
  // probability ratio of only ~1.15×, failing structural Test 5's boost check.
  return {
    dimension: 'firstGen',
    studentValue: 'first-generation',
    schoolAnchor: 'global avg ×1.5 (NACAC 2024 + Arcidiacono SFFA)',
    likelihoodRatio: 1.5,
    weight: TIER_WEIGHT.MEDIUM,
    tier: 'MEDIUM',
    deltaPp: 0,
    source: 'literature (NACAC 2024 + Arcidiacono SFFA)',
  };
}

function dimMajorSpike(profile: any, school: any): Contribution | Diagnostic | null {
  const activities = profile.activities ?? [];
  if (!activities.length) {
    return { dimension: 'activitiesSpike', state: 'no-profile-value', message: 'No activities' };
  }
  // Compute spike strength: max single-activity intensity score
  // (hoursPerWeek × weeksPerYear estimate × leadership weight × yearsActive proxy)
  const LEADERSHIP_WEIGHT: Record<string, number> = {
    founder: 2.0,
    president: 2.0,
    captain: 2.0,
    'team captain': 2.0,
    'lead researcher': 1.8,
    director: 1.7,
    coordinator: 1.5,
    officer: 1.4,
    'vice president': 1.4,
    member: 1.0,
    participant: 1.0,
  };
  let maxScore = 0;
  for (const a of activities) {
    const role = (a.role ?? '').toLowerCase();
    const leadership =
      Object.entries(LEADERSHIP_WEIGHT).find(([k]) => role.includes(k))?.[1] ?? 1.1;
    const hpw = Number(a.hoursPerWeek ?? 0);
    const wpy = Number(a.weeksPerYear ?? 30);
    const score = hpw * wpy * leadership;
    if (score > maxScore) maxScore = score;
  }
  // Normalize: T20 admit "spike" is roughly hpw 10+ × 36wk × 2.0 leadership = 720
  const normalized = clamp(maxScore / 720, 0, 1.2);
  // T20 admits: 80% have spike; LR ≈ admit prevalence / apply prevalence
  // Apply pool spike rate ≈ 40%, admit rate ≈ 80% → LR baseline 2.0 for spike >= 1.0
  const lr = normalized >= 0.8 ? 1.6 : normalized >= 0.5 ? 1.2 : normalized >= 0.3 ? 1.0 : 0.7;
  return {
    dimension: 'activitiesSpike',
    studentValue: `spike score ${normalized.toFixed(2)}`,
    schoolAnchor: 'T20: 80% admits have spike (global prior)',
    likelihoodRatio: lr,
    weight: TIER_WEIGHT.LOW,
    tier: 'LOW',
    deltaPp: 0,
    source: 'Activity[] + global T20 prior',
  };
}

function dimAwards(profile: any, _school: any): Contribution | Diagnostic | null {
  const awards = profile.awards ?? [];
  if (!awards.length) {
    return { dimension: 'awards', state: 'no-profile-value', message: 'No awards' };
  }
  const LEVEL_WEIGHT: Record<string, number> = {
    INTERNATIONAL: 4,
    NATIONAL: 3,
    REGIONAL: 1.5,
    STATE: 1.5,
    SCHOOL: 0.5,
  };
  const scores = awards.map((a: any) => LEVEL_WEIGHT[a.level] ?? 0.5);
  const totalScore = scores.reduce((s, x) => s + x, 0);
  const hasNational = awards.some(
    (a: any) => a.level === 'NATIONAL' || a.level === 'INTERNATIONAL'
  );
  // T20 admits ~55% have state+ honor; ~30% have national+
  let lr: number;
  if (totalScore >= 8)
    lr = 2.0; // 多个 national 级别
  else if (totalScore >= 4)
    lr = 1.5; // 1-2 个 national
  else if (totalScore >= 2)
    lr = 1.2; // regional
  else lr = 0.85; // 仅 school-level
  if (hasNational) lr = Math.max(lr, 1.5);
  return {
    dimension: 'awards',
    studentValue: `awardScore ${totalScore.toFixed(1)}${hasNational ? ' (incl. national+)' : ''}`,
    schoolAnchor: 'T20: 55% state+, 30% national+ admits (global prior)',
    likelihoodRatio: lr,
    weight: TIER_WEIGHT.LOW,
    tier: 'LOW',
    deltaPp: 0,
    source: 'Award[] + global T20 prior',
  };
}

function dimApCount(profile: any, _school: any): Contribution | Diagnostic | null {
  const apCount = (profile.testScores ?? []).filter((t: any) => t.type === 'AP').length;
  if (apCount === 0) {
    return { dimension: 'apCount', state: 'no-profile-value', message: 'No AP tests' };
  }
  // T20 admits: avg 10-14 APs
  const lr = apCount >= 10 ? 1.3 : apCount >= 7 ? 1.1 : apCount >= 4 ? 0.95 : 0.8;
  return {
    dimension: 'apCount',
    studentValue: `${apCount} APs`,
    schoolAnchor: 'T20: avg 10-14 APs (Crimson aggregate)',
    likelihoodRatio: lr,
    weight: TIER_WEIGHT.LOW,
    tier: 'LOW',
    deltaPp: 0,
    source: 'TestScore[type=AP] count + Crimson prior',
  };
}

function dimGpaTrend(profile: any, _school: any): Contribution | Diagnostic | null {
  const g9 = profile.gpa9 ? Number(profile.gpa9) : null;
  const g11 = profile.gpa11 ? Number(profile.gpa11) : null;
  const g12 = profile.gpa12 ? Number(profile.gpa12) : null;
  if (!g9 || (!g11 && !g12)) {
    return {
      dimension: 'gpaTrend',
      state: 'no-profile-value',
      message: 'Not enough grade-level GPAs',
    };
  }
  const end = g12 ?? g11!;
  const delta = end - g9;
  let lr: number;
  if (delta >= 0.35) lr = 1.06;
  else if (delta >= 0.15) lr = 1.03;
  else if (delta >= -0.15) lr = 1.0;
  else if (delta >= -0.35) lr = 0.97;
  else lr = 0.93;
  return {
    dimension: 'gpaTrend',
    studentValue: `Δ=${delta.toFixed(2)} (g9 ${g9} → end ${end})`,
    schoolAnchor: 'counselor consensus modifiers',
    likelihoodRatio: lr,
    weight: TIER_WEIGHT.LOW,
    tier: 'LOW',
    deltaPp: 0,
    source: 'profile.gpa9/11/12',
  };
}

function dimTestOptional(profile: any, school: any): Contribution | Diagnostic | null {
  if (!profile.applyingTestOptional) {
    return { dimension: 'testOptional', state: 'inapplicable', message: 'Submitting scores' };
  }
  const overall = rateToDecimal(school.acceptanceRate) ?? 1;
  if (overall >= 0.2) {
    return {
      dimension: 'testOptional',
      state: 'inapplicable',
      message: 'School >= 20% admit, no test-optional penalty',
    };
  }
  return {
    dimension: 'testOptional',
    studentValue: 'test-optional',
    schoolAnchor: '×0.85 at <20% admit schools (Common App data)',
    likelihoodRatio: 0.85,
    weight: TIER_WEIGHT.MEDIUM,
    tier: 'MEDIUM',
    deltaPp: 0,
    source: 'Common App data',
  };
}

// ─── Confidence calculation ─────────────────────────────────────────────────

function deriveConfidence(contribs: Contribution[]): 'high' | 'medium' | 'low' | 'very-low' {
  if (contribs.length === 0) return 'very-low';
  const highCount = contribs.filter((c) => c.tier === 'HIGH').length;
  const totalCount = contribs.length;
  const highRatio = highCount / totalCount;
  if (highCount >= 3 && highRatio >= 0.5) return 'high';
  if (highCount >= 2 || totalCount >= 6) return 'medium';
  if (totalCount >= 3) return 'low';
  return 'very-low';
}

// ─── Main predict function ─────────────────────────────────────────────────

export function predict(profile: any, school: any): PredictionOutput {
  let p = rateToDecimal(school.acceptanceRate) ?? 0;
  if (p <= 0) {
    return {
      schoolName: school.name,
      probability: 0.05,
      tier: 'reach',
      confidence: 'very-low',
      contributions: [],
      diagnostics: [
        {
          dimension: 'prior',
          state: 'no-school-anchor',
          message: 'School lacks acceptance rate',
        },
      ],
      trace: [{ after: 'prior', p: 0.05 }],
    };
  }

  const contributions: Contribution[] = [];
  const diagnostics: Diagnostic[] = [];
  const trace: Array<{ after: string; p: number }> = [{ after: 'prior', p }];

  const DIM_FUNCTIONS = [
    dimGpa,
    dimSat,
    dimRound,
    dimIntl,
    dimMajor,
    dimLegacy,
    dimAthlete,
    dimFirstGen,
    dimMajorSpike,
    dimAwards,
    dimApCount,
    dimGpaTrend,
    dimTestOptional,
  ];

  // Track whether the GPA dimension used SchoolCdsAdmitBand direct lookup.
  // CDS bands are P(admit | GPA, [SAT]) — already conditional on the most
  // common typical-applicant signal at that GPA level. Adding LOW tier LRs
  // (activities/awards/AP/GPA trend) on top would double-count, since the
  // CDS band rate already reflects the typical EC profile of applicants at
  // that GPA band. Per fix to Test 1 over-prediction at low-selectivity UCs.
  let cdsAnchored = false;

  for (const dimFn of DIM_FUNCTIONS) {
    const result = dimFn(profile, school);
    if (!result) continue;
    if ('state' in result) {
      diagnostics.push(result);
      continue;
    }

    // Special handling: CDS band direct prior override (not LR update)
    if (result.source?.includes('CDS_DIRECT')) {
      cdsAnchored = true;
      const oldP = p;
      p = result.likelihoodRatio; // re-purposed as the new prior (bandRate)
      result.deltaPp = (p - oldP) * 100;
      contributions.push(result);
      trace.push({ after: result.dimension, p });
      continue;
    }

    // When CDS-anchored, halve LOW tier weights to avoid double-counting.
    // MEDIUM tier (round / hook / major / intl / first-gen) is NOT in the
    // CDS band conditional, so it stays at full weight.
    let effectiveWeight = result.weight;
    if (cdsAnchored && result.tier === 'LOW') {
      effectiveWeight *= 0.5;
    }

    const oldP = p;
    p = bayesUpdate(p, result.likelihoodRatio, effectiveWeight);
    result.deltaPp = (p - oldP) * 100;
    if (effectiveWeight !== result.weight) {
      // Record the actual effective weight applied (for transparency)
      result.weight = effectiveWeight;
      result.source = `${result.source} [CDS-anchored downweight ×0.5]`;
    }
    contributions.push(result);
    trace.push({ after: result.dimension, p });
  }

  // ── Soft Uncertainty Ceiling (Bug E fix, tiered v3, boundary fix) ──
  // M3 doesn't model essays/recommendations/fit/interest/demonstrated-interest
  // signals. Without those, even a perfect academic profile cannot reliably
  // exceed certain bounds at selective schools. The cap scales with selectivity.
  //
  // Boundaries use `<=` with a small overshoot so schools right on the line
  // (Princeton/MIT/Yale all at ~5%) land in the tighter T5/T10 cap rather than
  // the looser T20 cap. Previous `<` boundary caused Princeton (acc 5.0%) to
  // fall into the 45% cap and over-predict on profile 1.3 (golden fixture).
  //
  //   <= 5.5%  prior  →  cap 30%   (T5/T10: Princeton/MIT/Harvard/Yale/Stanford)
  //   <= 10.5% prior  →  cap 45%   (T20: UPenn/Duke/Brown/JHU/Northwestern/...)
  //   <= 20.5% prior  →  cap 65%   (T20-T40: CMU/UMich/UCLA/Berkeley/Vandy/...)
  //   >  20.5% prior  →  no cap    (academic profile dominates outcome)
  //
  // Industry consensus anchors (NACAC, Crimson, A2C-aggregated):
  //   - Top-bracket unhooked Stanford REA: 20-25% real
  //   - Top-bracket unhooked UPenn ED: 30-35% real
  //   - Top-bracket unhooked CMU SCS: 50-60% real
  //
  // Hooks (legacy/athlete/first-gen verified) bypass cap — they legitimately
  // push probability higher and we shouldn't artificially flatten them.
  const overall = rateToDecimal(school.acceptanceRate) ?? 1;
  const hasVerifiedHook = contributions.some(
    (c) =>
      (c.dimension === 'legacy' && c.likelihoodRatio > 1) ||
      (c.dimension === 'athlete' && c.likelihoodRatio > 1) ||
      (c.dimension === 'firstGen' && c.likelihoodRatio > 1)
  );

  // Intl applicants face additional barriers (need-aware admissions, intl quotas,
  // English proficiency uncertainty) that compound the unmodeled-signal problem.
  // Their effective cap is ~65% of the domestic cap at selective schools.
  // Without this, a strong unhooked intl profile at a T5 school would clamp to
  // the same 30% as a domestic profile, masking the intl penalty entirely.
  const isIntl = profile.nationality && !/^(US|USA|United States)$/i.test(profile.nationality);
  const intlCapMultiplier = isIntl ? 0.65 : 1.0;

  const softCeilingFor = (overallRate: number): number | null => {
    let cap: number | null = null;
    if (overallRate <= 0.055) cap = 0.3;
    else if (overallRate <= 0.105) cap = 0.45;
    else if (overallRate <= 0.205) cap = 0.65;
    else return null; // No cap for schools accepting > 20.5%
    return cap * intlCapMultiplier;
  };

  if (!hasVerifiedHook) {
    const cap = softCeilingFor(overall);
    if (cap !== null && p > cap) {
      const oldP = p;
      p = cap;
      contributions.push({
        dimension: 'softUncertaintyCeiling',
        studentValue: isIntl ? 'no verified hook (intl-adjusted)' : 'no verified hook',
        schoolAnchor: `Tiered cap @ prior ${(overall * 100).toFixed(1)}% → ${(cap * 100).toFixed(0)}%${isIntl ? ' (intl ×0.65)' : ''}`,
        likelihoodRatio: 0,
        weight: 1.0,
        tier: 'HIGH',
        deltaPp: (p - oldP) * 100,
        source: 'softUncertaintyCeiling (essays/recs/fit not modeled)',
      });
      trace.push({ after: 'softCeiling', p });
    }
  }

  // Floor 0.01 (1%) — UCLA 3.00-3.24 published 1.0%, prev 0.02 floor crushed
  // representable range. 1% is rare but real for top schools at low GPA.
  p = clamp(p, 0.01, 0.98);

  return {
    schoolName: school.name,
    probability: p,
    tier: deriveTier(p),
    confidence: deriveConfidence(contributions),
    contributions,
    diagnostics,
    trace,
  };
}

// ─── Pretty output ──────────────────────────────────────────────────────────

function renderOutput(out: PredictionOutput): void {
  console.log(`\n═══ ${out.schoolName} ═══`);
  console.log(
    `  Probability: ${(out.probability * 100).toFixed(1)}% | tier=${out.tier} | confidence=${out.confidence}`
  );
  console.log(`  Trace:`);
  let prev: number | null = null;
  for (const step of out.trace) {
    const arrow = prev !== null ? ` (${((step.p - prev) * 100).toFixed(1)}pp)` : '';
    console.log(`    ${(step.p * 100).toFixed(2)}% after ${step.after}${arrow}`);
    prev = step.p;
  }
  console.log(`  Contributions:`);
  for (const c of out.contributions) {
    console.log(
      `    [${c.tier}] ${c.dimension.padEnd(18)} | student=${String(c.studentValue).padEnd(25)} | lr=${c.likelihoodRatio.toFixed(2)} (w=${c.weight}) | Δ=${c.deltaPp.toFixed(2)}pp | ${c.schoolAnchor}`
    );
  }
  if (out.diagnostics.length > 0) {
    console.log(`  Diagnostics (not in probability):`);
    for (const d of out.diagnostics) {
      console.log(`    [${d.state}] ${d.dimension}: ${d.message}`);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const schoolFilter = args.find((a) => a.startsWith('--school='))?.split('=')[1];

  // Load Alice Zhang
  const user = await prisma.user.findFirst({
    where: { email: 'alice.zhang@demo.studyabroad.com' },
    include: {
      profile: { include: { activities: true, awards: true, testScores: true } },
    },
  });
  if (!user?.profile) {
    console.error('Alice Zhang profile not found');
    process.exit(1);
  }

  // Load 4 v3 case schools
  const targetSchools = [
    'stanford university',
    'massachusetts institute of technology',
    'carnegie mellon university',
    'university of michigan, ann arbor',
  ].filter((s) => !schoolFilter || s.toLowerCase().includes(schoolFilter.toLowerCase()));

  const schools = await prisma.school.findMany({
    where: { nameNorm: { in: targetSchools } },
    include: { programs: true },
  });
  // Attach CDS bands (for Path A direct lookup in dimGpa)
  const schoolIdsForBands = schools.map((s) => s.id);
  const allBands = await prisma.schoolCdsAdmitBand.findMany({
    where: { schoolId: { in: schoolIdsForBands } },
  });
  for (const school of schools) {
    (school as any)._cdsBands = allBands
      .filter((b) => b.schoolId === school.id)
      .map((b) => ({
        gpaBand: b.gpaBand,
        testType: b.testType,
        testBand: b.testBand,
        admitRate: Number(b.admitRate),
      }));
  }

  // Stage the profile with case-specific overrides
  const v3CaseRounds: Record<string, string> = {
    'stanford university': 'REA',
    'massachusetts institute of technology': 'EA',
    'carnegie mellon university': 'ED',
    'university of michigan, ann arbor': 'EA',
  };

  const allResults: PredictionOutput[] = [];
  for (const school of schools) {
    const stagedProfile = {
      ...user.profile,
      applicationRound: v3CaseRounds[school.nameNorm] ?? user.profile.applicationRound,
    };
    const out = predict(stagedProfile, school);
    allResults.push(out);
    if (!jsonMode) renderOutput(out);
  }

  if (jsonMode) {
    console.log(JSON.stringify(allResults, null, 2));
  } else {
    console.log('\n═══ Summary: v3 vs CounselorEngine vs M3 ═══');
    const v3Predictions: Record<string, [number, number]> = {
      'Stanford University': [2.0, 3.4],
      'Massachusetts Institute of Technology': [2.0, 2.1],
      'Carnegie Mellon University': [3.5, 8.1],
      'University of Michigan, Ann Arbor': [9.3, 19.6],
    };
    console.log(
      'school                                       | v3    | counselor | M3 Bayesian | actual'
    );
    console.log(
      '---------------------------------------------+-------+-----------+-------------+--------'
    );
    for (const r of allResults) {
      const [v3, ce] = v3Predictions[r.schoolName] ?? [null, null];
      const m3 = (r.probability * 100).toFixed(1) + '%';
      console.log(
        `${r.schoolName.padEnd(44)} | ${(v3 ? v3.toFixed(1) + '%' : '-').padStart(5)} | ${(ce ? ce.toFixed(1) + '%' : '-').padStart(9)} | ${m3.padStart(11)} | ADMIT`
      );
    }
  }
}

// Only run main() when executed directly, not when imported
if (process.argv[1]?.endsWith('m3-bayesian-engine.ts')) {
  main()
    .catch((err) => {
      console.error('M3 engine failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
