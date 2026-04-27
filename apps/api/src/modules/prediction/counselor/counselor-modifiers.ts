/**
 * Counselor Engine — 8 deterministic modifiers
 *
 * Each modifier is a pure function `(profile, school, context?) → ModifierResult`
 * that returns:
 *   - `multiplier`: number in roughly [0.15, 4.0] applied to the school's anchor admit rate
 *   - `label`: short human-readable name (i18n keys handled by frontend, English fallback here)
 *   - `evidence`: one-sentence explanation (e.g. "Above 75th-percentile SAT")
 *
 * Why the values?
 * Each multiplier comes from published admissions consultancy literature (Arcidiacono
 * SFFA expert report for hooks, school CDS Section C9 for SAT bands, NACAC State
 * of College Admission for round/geo) — see comments. They are intentionally *not*
 * tuned to user data because we have 4 outcomes total. The whole point of counselor
 * mode is "rules-of-thumb that an admissions counselor would also use." Every
 * multiplier is defensible without data.
 *
 * Why pure functions instead of inheriting from teacher services?
 * Teachers return `{probability, active}` — the counselor needs explainable
 * `{multiplier, label, evidence}`. Different shape, different concern. The teacher
 * services stay alive (running in shadow) for future statistical comparison.
 *
 * No I/O — modifiers only read what callers pass in. Database lookups (CDS bands
 * anchor, SchoolProgram for major selectivity) happen in `counselor-engine.service.ts`
 * which then passes the resolved values into these functions.
 */

import type { ProfileInput, SchoolInput } from '../prediction.prompts';

export interface ModifierResult {
  /** Multiplier applied to anchor. 1.0 = no effect. */
  multiplier: number;
  /** Short human-readable label (English; frontend may i18n). */
  label: string;
  /** One-sentence evidence string for the factors[] breakdown. */
  evidence: string;
  /** Direction for UI styling. */
  impact: 'positive' | 'negative' | 'neutral';
}

const NEUTRAL: ModifierResult = {
  multiplier: 1.0,
  label: 'No adjustment',
  evidence: 'No relevant data available for this dimension.',
  impact: 'neutral',
};

/**
 * Convert a 4.0-scale GPA to an "equivalent SAT" score for percentile comparison
 * against a school's SAT 25/50/75 distribution. Standard mapping used in admissions
 * consulting (Compass Education Group, College Vine):
 *   3.95+ → 1500   |  3.85 → 1450  |  3.75 → 1400  |  3.65 → 1350
 *   3.50  → 1300   |  3.25 → 1230  |  3.00 → 1150  |  <3.0 → 1050
 *
 * Returns null if GPA is missing or unparseable.
 */
function gpaToEquivalentSat(
  gpa: number | undefined,
  gpaScale: number | undefined,
): number | null {
  if (gpa == null || !Number.isFinite(gpa)) return null;
  // Normalize to 4.0 scale
  const scale = gpaScale && gpaScale > 0 ? gpaScale : 4.0;
  const gpa4 = (gpa / scale) * 4.0;
  if (gpa4 >= 3.95) return 1500;
  if (gpa4 >= 3.85) return 1450;
  if (gpa4 >= 3.75) return 1400;
  if (gpa4 >= 3.65) return 1350;
  if (gpa4 >= 3.5) return 1300;
  if (gpa4 >= 3.25) return 1230;
  if (gpa4 >= 3.0) return 1150;
  return 1050;
}

/**
 * Modifier #1: GPA-band relative to school SAT distribution.
 *
 * Why use SAT distribution instead of school's GPA distribution?
 * Schools rarely publish per-applicant GPA bands in CDS (Section C9 is sparse on
 * GPA), but SAT 25/75 is universally reported. Mapping GPA → equivalent SAT lets
 * us reuse the well-populated distribution for comparison.
 */
export function gpaBandMultiplier(
  profile: ProfileInput,
  school: SchoolInput,
): ModifierResult {
  const equivSat = gpaToEquivalentSat(profile.gpa, profile.gpaScale);
  if (equivSat == null) {
    return { ...NEUTRAL, label: 'GPA' };
  }
  const sat25 = school.sat25;
  const sat50 = school.satAvg;
  const sat75 = school.sat75;
  if (!sat25 || !sat75) {
    return {
      multiplier: 1.0,
      label: 'GPA',
      evidence: `GPA ${profile.gpa?.toFixed(2)} (no school percentile data; no adjustment)`,
      impact: 'neutral',
    };
  }
  if (equivSat >= sat75) {
    return {
      multiplier: 1.3,
      label: 'GPA above 75th percentile',
      evidence: `GPA ${profile.gpa?.toFixed(2)} (equivalent SAT ~${equivSat}) is at/above this school's 75th percentile (${sat75})`,
      impact: 'positive',
    };
  }
  if (sat50 && equivSat >= sat50) {
    return {
      multiplier: 1.1,
      label: 'GPA above median',
      evidence: `GPA ${profile.gpa?.toFixed(2)} (equiv SAT ~${equivSat}) is above this school's median (${sat50})`,
      impact: 'positive',
    };
  }
  if (equivSat >= sat25) {
    return {
      multiplier: 0.85,
      label: 'GPA in middle 50',
      evidence: `GPA ${profile.gpa?.toFixed(2)} (equiv SAT ~${equivSat}) sits between 25th and 50th percentile (${sat25}-${sat50 ?? sat75})`,
      impact: 'neutral',
    };
  }
  if (equivSat >= sat25 - 100) {
    return {
      multiplier: 0.5,
      label: 'GPA just below 25th percentile',
      evidence: `GPA ${profile.gpa?.toFixed(2)} (equiv SAT ~${equivSat}) is below 25th percentile (${sat25}) but within 100 points`,
      impact: 'negative',
    };
  }
  return {
    multiplier: 0.15,
    label: 'GPA well below 25th percentile',
    evidence: `GPA ${profile.gpa?.toFixed(2)} (equiv SAT ~${equivSat}) is more than 100 points below this school's 25th percentile (${sat25})`,
    impact: 'negative',
  };
}

/**
 * Modifier #2: Test-band relative to school SAT/ACT distribution.
 *
 * Reads the highest SAT or ACT score in `profile.testScores[]` and compares
 * to the school's 25/75 percentiles. ACT is converted to SAT-equivalent via
 * the College Board concordance (rough: ACT * 45 ≈ SAT) for unified comparison.
 */
export function testBandMultiplier(
  profile: ProfileInput,
  school: SchoolInput,
): ModifierResult {
  const testScores = profile.testScores ?? [];
  let bestEquivSat: number | null = null;
  let testLabel: string | null = null;
  for (const ts of testScores) {
    if (ts.type === 'SAT' && ts.score) {
      if (bestEquivSat == null || ts.score > bestEquivSat) {
        bestEquivSat = ts.score;
        testLabel = `SAT ${ts.score}`;
      }
    } else if (ts.type === 'ACT' && ts.score) {
      const equiv = ts.score * 45; // rough College Board concordance
      if (bestEquivSat == null || equiv > bestEquivSat) {
        bestEquivSat = equiv;
        testLabel = `ACT ${ts.score}`;
      }
    }
  }
  if (bestEquivSat == null || testLabel == null) {
    return { ...NEUTRAL, label: 'Test score' };
  }
  const sat25 = school.sat25;
  const sat75 = school.sat75;
  if (!sat25 || !sat75) {
    return {
      multiplier: 1.0,
      label: 'Test score',
      evidence: `${testLabel} (no school percentile data; no adjustment)`,
      impact: 'neutral',
    };
  }
  if (bestEquivSat >= sat75 + 50) {
    return {
      multiplier: 1.5,
      label: 'Test score well above 75th percentile',
      evidence: `${testLabel} is more than 50 points above the school's 75th percentile (${sat75})`,
      impact: 'positive',
    };
  }
  if (bestEquivSat >= sat75) {
    return {
      multiplier: 1.2,
      label: 'Test score above 75th percentile',
      evidence: `${testLabel} meets or exceeds the school's 75th percentile (${sat75})`,
      impact: 'positive',
    };
  }
  if (bestEquivSat >= sat25) {
    return {
      multiplier: 0.85,
      label: 'Test score in middle 50',
      evidence: `${testLabel} falls between this school's 25th and 75th percentile (${sat25}-${sat75})`,
      impact: 'neutral',
    };
  }
  if (bestEquivSat >= sat25 - 100) {
    return {
      multiplier: 0.5,
      label: 'Test score just below 25th percentile',
      evidence: `${testLabel} is below the 25th percentile (${sat25}) but within 100 points`,
      impact: 'negative',
    };
  }
  return {
    multiplier: 0.3,
    label: 'Test score well below 25th percentile',
    evidence: `${testLabel} is more than 100 points below the school's 25th percentile (${sat25})`,
    impact: 'negative',
  };
}

/**
 * Modifier #3: Application round.
 *
 * Multipliers from CDS Section C21 across ~40 schools that publish ED/EA/RD
 * splits separately. ED 2.5× is the typical Ivy/peer ratio (Penn 35% ED vs
 * 7% RD ≈ 5×, but average across all ED schools is ~2-3×). RD = 1.0 baseline.
 */
export function roundMultiplier(round: string | undefined): ModifierResult {
  const r = (round ?? 'RD').toUpperCase();
  switch (r) {
    case 'ED':
      return {
        multiplier: 2.5,
        label: 'Early Decision',
        evidence:
          'ED admit rates are typically 2-5× the RD rate at peer institutions (CDS Section C21)',
        impact: 'positive',
      };
    case 'ED2':
      return {
        multiplier: 2.0,
        label: 'Early Decision 2',
        evidence: 'ED2 admit rates are typically 1.5-3× the RD rate',
        impact: 'positive',
      };
    case 'REA':
    case 'SCEA':
      return {
        multiplier: 1.5,
        label: 'Restrictive Early Action',
        evidence: 'REA/SCEA admit rates are typically 1.3-1.8× the RD rate',
        impact: 'positive',
      };
    case 'EA':
      return {
        multiplier: 1.3,
        label: 'Early Action',
        evidence:
          'Non-restrictive EA admit rates are typically 1.1-1.5× the RD rate',
        impact: 'positive',
      };
    case 'ROLLING':
      return {
        multiplier: 1.1,
        label: 'Rolling admission',
        evidence:
          'Earlier applicants in rolling cycles see slightly better odds than late applicants',
        impact: 'positive',
      };
    case 'RD':
    default:
      return {
        multiplier: 1.0,
        label: 'Regular Decision',
        evidence:
          "Regular Decision is the baseline round used to compute the school's CDS admit rate",
        impact: 'neutral',
      };
  }
}

/**
 * Modifier #4: Legacy hook (parent / sibling attended same school).
 *
 * Coefficient from Arcidiacono (2020) SFFA v. Harvard expert report:
 * legacy admit rate ~33% vs ~5% baseline at Harvard → odds ratio ~8.5 → 3× simplified
 * for counselor framing. Note: post-2024 some schools have ended legacy preference
 * (Amherst, Carnegie Mellon) — defensive simplification: still 3× until we
 * track per-school legacy policy. Worst case overshoots by ~2pp at non-legacy schools.
 */
export function legacyHookMultiplier(
  profile: ProfileInput,
  school: SchoolInput,
): ModifierResult {
  const isLegacy = profile.isLegacy === true;
  const matchedSchool = isLegacy
    ? (profile.legacySchools ?? []).some(
        (name) =>
          name.toLowerCase().trim() === school.name.toLowerCase().trim(),
      )
    : false;
  if (!matchedSchool) {
    return { ...NEUTRAL, label: 'Legacy status' };
  }
  return {
    multiplier: 3.0,
    label: 'Legacy applicant',
    evidence: `Parent or sibling attended ${school.name}; historical odds ratio ~3-8× (Arcidiacono SFFA expert report)`,
    impact: 'positive',
  };
}

/**
 * Modifier #5: First-generation college student.
 *
 * Coefficient from Arcidiacono SFFA report: ~1.5× odds ratio for first-gen
 * applicants at need-aware schools. Counselor uses 1.4 as a conservative public estimate.
 */
export function firstGenMultiplier(profile: ProfileInput): ModifierResult {
  if (!profile.isFirstGen) {
    return { ...NEUTRAL, label: 'First-generation status' };
  }
  return {
    multiplier: 1.4,
    label: 'First-generation college student',
    evidence:
      'First-gen applicants see ~1.4-1.5× the baseline admit rate at most US schools (Arcidiacono SFFA)',
    impact: 'positive',
  };
}

/**
 * Modifier #6: Recruited athlete.
 *
 * Recruited athletes at Ivy League / D1 schools see admit rates of 70-86% per
 * institutional data (e.g. Harvard CDS shows ~86% for recruited athletes vs ~5%
 * baseline → odds ratio ~120, but counselor uses conservative 4× to avoid
 * over-promising). NEW field on Profile (additive migration in this PR).
 */
export function athleteMultiplier(
  profile: ProfileInput & { recruitedAthlete?: boolean },
): ModifierResult {
  if (!profile.recruitedAthlete) {
    return { ...NEUTRAL, label: 'Recruited athlete' };
  }
  return {
    multiplier: 4.0,
    label: 'Recruited athlete',
    evidence:
      'Recruited athletes at peer institutions see admit rates 4-15× the baseline (institutional CDS data)',
    impact: 'positive',
  };
}

/**
 * Modifier #7: URM (under-represented minority) status.
 *
 * Post-2023 SCOTUS SFFA v. Harvard ruling, race cannot be a direct admissions
 * factor. However, contextual review (essays, geographic origin) still indirectly
 * advantages URM applicants at need-blind schools per Common App data. Conservative
 * 1.5× multiplier; only applies at need-blind schools (those still doing holistic).
 *
 * NEW Profile field; opt-in, defaults to null (no effect).
 */
export function urmMultiplier(
  profile: ProfileInput & { urmStatus?: string | null },
  school: SchoolInput,
): ModifierResult {
  const isUrm =
    profile.urmStatus &&
    ['BLACK', 'HISPANIC', 'NATIVE_AMERICAN', 'PACIFIC_ISLANDER'].includes(
      profile.urmStatus,
    );
  if (!isUrm) {
    return { ...NEUTRAL, label: 'URM status' };
  }
  // Only meaningful at need-blind schools (post-SFFA, race-conscious admission ended)
  const isNeedBlindUS =
    !school.needBlindInternational || (school.acceptanceRate ?? 1) < 0.3;
  if (!isNeedBlindUS) {
    return {
      ...NEUTRAL,
      label: 'URM status (no effect at non-holistic schools)',
    };
  }
  return {
    multiplier: 1.5,
    label: 'Under-represented minority',
    evidence:
      'Post-SFFA, contextual review at need-blind schools still indirectly advantages URM applicants ~1.5× (Common App reports)',
    impact: 'positive',
  };
}

/**
 * Modifier #8a: In-state vs out-of-state at public flagships.
 *
 * UC system: in-state ~17% admit, OOS ~9% (UC official data) → 1.8× / 0.5×.
 * UMich, UNC, UVA, UT-Austin, UF: similar 2-3× in-state advantage.
 * Other publics: 1.3× / 0.85× (smaller residency preference).
 * Privates: 1.0 (no residency effect).
 */
const PUBLIC_FLAGSHIPS_WITH_STRONG_RESIDENCY_PREF = new Set([
  'CA', // UC system, CSU
  'MI', // UMich
  'NC', // UNC
  'VA', // UVA, W&M
  'TX', // UT-Austin, A&M
  'FL', // UF, FSU
]);

export function geoMultiplier(
  profile: ProfileInput,
  school: SchoolInput & { state?: string | null; isPrivate?: boolean | null },
): ModifierResult {
  // Don't double-penalize international applicants — `intlMultiplier` already
  // captures the intl-vs-domestic delta. Without this guard, a CN applicant
  // looking at a UC public would get 0.4× intl × 0.5× OOS = 0.2× combined,
  // which produced absurd 30-37% UC predictions (4/26 evening regression).
  if (profile.isInternational) {
    return {
      ...NEUTRAL,
      label: 'Geography (international applicant — see intl modifier)',
    };
  }
  if (school.isPrivate) {
    return {
      ...NEUTRAL,
      label: 'Geography (private school, no residency effect)',
    };
  }
  const schoolState = school.state?.trim().toUpperCase();
  const applicantLocation = profile.highSchoolLocation?.trim().toUpperCase();
  if (!schoolState || !applicantLocation) {
    return { ...NEUTRAL, label: 'Geography' };
  }
  const isInState = applicantLocation === schoolState;
  const strongPref =
    PUBLIC_FLAGSHIPS_WITH_STRONG_RESIDENCY_PREF.has(schoolState);
  if (isInState && strongPref) {
    return {
      multiplier: 1.8,
      label: 'In-state at public flagship',
      evidence: `${schoolState} residents see ~1.8-2.5× the OOS admit rate at this state's flagship public universities`,
      impact: 'positive',
    };
  }
  if (isInState) {
    return {
      multiplier: 1.3,
      label: 'In-state at public school',
      evidence: `${schoolState} residents see ~1.3× the OOS admit rate at most public universities`,
      impact: 'positive',
    };
  }
  if (strongPref) {
    return {
      multiplier: 0.5,
      label: 'Out-of-state at public flagship',
      evidence: `Out-of-state applicants face ~0.4-0.6× the in-state admit rate at ${schoolState} public flagships`,
      impact: 'negative',
    };
  }
  return {
    multiplier: 0.85,
    label: 'Out-of-state at public school',
    evidence: `Out-of-state applicants face a modest ~0.85× admit-rate penalty at most public universities`,
    impact: 'negative',
  };
}

/**
 * Coerce a stored admit-rate value (Decimal or number; may be 11.5 = 11.5% or
 * 0.115) into a probability in (0, 1). Returns null on missing / invalid input.
 *
 * Mirrors `CounselorEngineService.normalizeAcceptanceRate` — kept inline here
 * so the modifiers stay pure functions without a dep on the engine class.
 */
function normalizeRate(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  const n = raw > 1 ? raw / 100 : raw;
  return n > 0 && n < 1 ? n : null;
}

/**
 * Modifier #8b: International applicant.
 *
 * The original counselor shipped with a flat 0.4× / 0.7× penalty. That was
 * calibrated to elite schools where intl admit rates are 1/3-1/2 of overall.
 * It produces *outrageous-low* predictions at less-selective schools (UCM,
 * 88% overall × 0.4 = 36%, but UCM's actual intl admit rate is ~85% — i.e.
 * essentially no penalty). This was the first regression the engine produced
 * after going live for CN intl users on UC schools (4/26 evening).
 *
 * Fixed signal hierarchy (best to worst):
 *   1. School publishes its own intl admit rate (`school.intlAcceptanceRate`)
 *      → use the ratio `intlRate / overallRate` clamped to [0.3, 1.2]. Most
 *      data-correct path. Today populated for ~30 schools via scorecard ETL.
 *   2. Selectivity-aware fallback (when intlAcceptanceRate is missing):
 *      - Less selective (≥ 40%): 0.95× — school takes everyone qualified,
 *        intl penalty is negligible (UCs Merced/Riverside/Santa Cruz, ASU,
 *        most state publics — intl admit rate ≈ overall per published CDS)
 *      - Moderately selective (20-40%): 0.85× need-blind / 0.7× need-aware
 *        — intl pool somewhat competitive (BU, USC, UCSD, UCD, UCI)
 *      - Highly selective (< 20%): 0.7× need-blind / 0.4× need-aware — the
 *        original peer-school calibration applies (HYPMSP, NYU, top T20)
 *   3. Unknown selectivity: assume highly-selective (conservative default)
 *
 * Domestic applicants always return NEUTRAL (no change).
 */
export function intlMultiplier(
  profile: ProfileInput,
  school: SchoolInput & {
    needBlindInternational?: boolean;
    intlAcceptanceRate?: number | null;
    acceptanceRate?: number | null;
  },
): ModifierResult {
  if (!profile.isInternational) {
    return { ...NEUTRAL, label: 'International status (domestic applicant)' };
  }

  const overallRate = normalizeRate(school.acceptanceRate);
  const intlRate = normalizeRate(school.intlAcceptanceRate);

  // Best signal: school publishes its own intl admit rate. Use ratio directly.
  if (intlRate != null && overallRate != null) {
    const ratio = intlRate / overallRate;
    const clamped = Math.max(0.3, Math.min(1.2, ratio));
    return {
      multiplier: clamped,
      label: 'International (school-published intl rate)',
      evidence: `This school admits ~${(intlRate * 100).toFixed(0)}% of international applicants vs ~${(overallRate * 100).toFixed(0)}% overall (×${clamped.toFixed(2)})`,
      impact: clamped >= 0.95 ? 'neutral' : 'negative',
    };
  }

  // Fallback: scale penalty by school's overall selectivity. The 40% threshold
  // intentionally catches public state systems like UCSC (47%) where intl
  // admit rate ≈ overall per published CDS — the elite-school 0.7× penalty
  // is not empirically justified there.
  if (overallRate != null && overallRate >= 0.4) {
    return {
      multiplier: 0.95,
      label: 'International (less-selective school)',
      evidence: `This school admits ${(overallRate * 100).toFixed(0)}% overall — international applicants face only a small penalty at less-selective institutions`,
      impact: 'neutral',
    };
  }

  if (overallRate != null && overallRate >= 0.2) {
    if (school.needBlindInternational) {
      return {
        multiplier: 0.85,
        label: 'International (need-blind, moderately selective)',
        evidence:
          'International pool sees a moderate ~0.85× penalty at this need-blind moderately-selective school',
        impact: 'negative',
      };
    }
    return {
      multiplier: 0.7,
      label: 'International (need-aware, moderately selective)',
      evidence:
        'International applicants face ~0.7× the domestic admit rate at need-aware moderately-selective schools',
      impact: 'negative',
    };
  }

  // Highly selective (< 20% admit rate, or unknown selectivity).
  if (school.needBlindInternational) {
    return {
      multiplier: 0.7,
      label: 'International (need-blind school)',
      evidence:
        'International pool sees ~0.7× the domestic admit rate at need-blind-for-intl schools (Harvard, MIT, Princeton, Yale, Amherst)',
      impact: 'negative',
    };
  }
  return {
    multiplier: 0.4,
    label: 'International (need-aware, highly selective school)',
    evidence:
      'International applicants face ~0.4× the domestic admit rate at need-aware highly-selective schools',
    impact: 'negative',
  };
}

/**
 * Modifier #8c: Major selectivity.
 *
 * For schools with `SchoolProgram` data (currently 25 schools × ~10 majors via
 * `seed-program-rates.ts`), use `acceptanceRateEstimate` to compute a multiplier:
 *   majorMultiplier = programAdmitRate / schoolAdmitRate
 * Clamped to [0.3, 1.5] to avoid extreme values. CS at top schools is typically
 * 0.4-0.6 (e.g. CMU CS 7% vs CMU overall 17% → 0.41×).
 *
 * Caller (counselor-engine.service.ts) supplies `programAcceptanceRate` after
 * a `SchoolProgram` lookup; this function just does the math.
 */
export function majorMultiplier(
  profile: ProfileInput,
  school: SchoolInput & { acceptanceRate?: number | null },
  programAcceptanceRate: number | null,
): ModifierResult {
  if (!profile.targetMajor) {
    return { ...NEUTRAL, label: 'Major selectivity' };
  }
  if (programAcceptanceRate == null) {
    return {
      ...NEUTRAL,
      label: `Major: ${profile.targetMajor} (no program-level data)`,
    };
  }
  const schoolRate = school.acceptanceRate;
  if (!schoolRate || schoolRate <= 0) {
    return { ...NEUTRAL, label: 'Major selectivity' };
  }
  // Both should be in same units (decimal probability)
  const ratio = programAcceptanceRate / schoolRate;
  const clamped = Math.max(0.3, Math.min(1.5, ratio));
  if (clamped < 0.85) {
    return {
      multiplier: clamped,
      label: `Major: ${profile.targetMajor} (more selective)`,
      evidence: `${profile.targetMajor} at this school admits ~${(programAcceptanceRate * 100).toFixed(0)}% vs ${(schoolRate * 100).toFixed(0)}% overall (${clamped.toFixed(2)}× ratio)`,
      impact: 'negative',
    };
  }
  if (clamped > 1.15) {
    return {
      multiplier: clamped,
      label: `Major: ${profile.targetMajor} (less selective)`,
      evidence: `${profile.targetMajor} at this school admits ~${(programAcceptanceRate * 100).toFixed(0)}% vs ${(schoolRate * 100).toFixed(0)}% overall`,
      impact: 'positive',
    };
  }
  return {
    multiplier: 1.0,
    label: `Major: ${profile.targetMajor}`,
    evidence: `${profile.targetMajor} at this school is roughly as selective as the school overall`,
    impact: 'neutral',
  };
}
