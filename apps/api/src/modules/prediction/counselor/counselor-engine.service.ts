import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ProfileInput, SchoolInput } from '../prediction.prompts';
import { AnchorResolverService } from './anchor-resolver.service';
import {
  athleteMultiplier,
  firstGenMultiplier,
  geoMultiplier,
  gpaBandMultiplier,
  intlMultiplier,
  legacyHookMultiplier,
  majorMultiplier,
  roundMultiplier,
  testBandMultiplier,
  urmMultiplier,
  type ModifierResult,
} from './counselor-modifiers';

/**
 * Counselor Engine Service — Anchored cold-start prediction.
 *
 * Mirrors how an admissions counselor estimates odds:
 *   1. Anchor on the school's published CDS admit rate (via `cds-bands-v1` table
 *      when (school, gpa-band, test-band) cell exists; else `school.acceptanceRate`)
 *   2. Apply 8 deterministic modifiers (GPA, test, round, hooks, geography, intl, major)
 *   3. Clip to [anchor × 0.3, anchor × 2.5] then [0.02, 0.98]
 *
 * Mathematical guarantee: no prediction can deviate from the school baseline by
 * more than 2.5× or less than 0.3×. UCM at 49% (when published rate is ~88%)
 * is mathematically impossible under this engine.
 *
 * Why not blend with AI/ML/distillation?
 * Cold start (4 verified outcomes total) means LLM will hallucinate, ML will
 * overfit, and distillation will drop most teachers as inactive. Counselor logic
 * is the most defensible signal you can ship without data. When labels accumulate
 * (~Feb 2027 estimate), a follow-up architecture can layer light ML on top.
 *
 * This service is invoked from `PredictionService.predictForSchool` when the
 * `prediction-counselor-mode-v1` feature flag is enabled. The legacy
 * fusion+distillation path runs in parallel (in shadow) and is captured in
 * `servedTrace.shadow` for retrospective comparison.
 */

export type CounselorTier = 1 | 2 | 3 | 4;

/**
 * Profile dimensions that can be "absorbed" by a Tier 1 anchor cell.
 *
 * When a CDS band cell is for `(gpaBand=3.75-4.0, testType=SAT, testBand=1500-1600)`
 * the cell admit rate ALREADY reflects "applicants with strong GPA AND strong SAT".
 * If we then also multiply by the gpaBand/testBand modifiers (×1.3 × ×1.5), we
 * double-count the same signal — overshoots the cap, defeats the purpose of
 * loading real cell data.
 *
 * `encodedDimensions` tells the compute step which modifier(s) to suppress:
 * - `GPA_ONLY` cell → encodes ['gpa']; testBand modifier still applies
 * - `SAT` or `ACT` cell → encodes ['gpa', 'test']; both suppressed
 *
 * Tier 2/3/4 anchors don't encode any dimension (overall school admit rate),
 * so all modifiers continue to apply normally there.
 */
export type EncodedDimension = 'gpa' | 'test';

export const COUNSELOR_RULE_VERSION = 'counselor-cold-start-v1.1';

export interface CounselorFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  detail: string;
}

export interface CounselorResult {
  /** Final probability after anchor × multipliers × clip. */
  probability: number;
  /** The school admit rate used as the multiplicative anchor (0-1). */
  anchor: number;
  /** Source tier of the anchor (1 = CDS bands, 2 = scorecard+algorithmic, 3 = scorecard only, 4 = no data). */
  tier: CounselorTier;
  /** Identifier of the anchor source (e.g. 'cds-bands-v1', 'scorecard'). */
  anchorSource: string;
  /** Per-modifier breakdown for the factors[] response field. */
  factors: CounselorFactor[];
  /** Set when tier=4 (insufficient data). When set, the caller should surface a "not enough data" message and skip this prediction. */
  insufficientData?: { reason: string };
  /** Each modifier's raw result for debugging / shadow comparison. */
  modifierResults: Record<string, ModifierResult>;
  /** Rule-version fingerprint used to replay or audit historical outputs. */
  ruleVersion: string;
  /** Missing inputs that were skipped neutrally instead of punished. */
  missingFields: string[];
  /** Source-level contribution trace for enterprise cold-start audits. */
  sourceContributions: Array<{
    source: string;
    value: number | null;
    role: 'anchor' | 'modifier' | 'guardrail';
    detail: string;
  }>;
}

@Injectable()
export class CounselorEngineService {
  private readonly logger = new Logger(CounselorEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly anchorResolver?: AnchorResolverService,
  ) {}

  /**
   * Compute counselor prediction for a (profile, school) pair.
   *
   * @param profile - Profile data (may include extended fields recruitedAthlete, urmStatus)
   * @param school - School data (must include acceptanceRate, sat25/75, state, isPrivate, etc.)
   * @param applicationRound - Override for `profile.applicationRound`; the route layer can pass
   *                           a per-application round (RD/ED/EA) since a profile may apply to
   *                           multiple schools across different rounds.
   */
  async compute(
    profile: ProfileInput & {
      recruitedAthlete?: boolean;
      urmStatus?: string | null;
    },
    school: SchoolInput & {
      acceptanceRate?: number | null;
      state?: string | null;
      isPrivate?: boolean | null;
      needBlindInternational?: boolean;
      intlAcceptanceRate?: number | null;
    },
    applicationRound?: string,
  ): Promise<CounselorResult> {
    // ---- Step 1: resolve anchor -----------------------------------------
    const {
      anchor,
      tier,
      anchorSource,
      encodedDimensions,
      insufficientData,
      sourceContributions: anchorContributions,
    } = this.anchorResolver
      ? await this.anchorResolver.resolveAnchor(profile, school)
      : await this.resolveAnchor(profile, school);

    if (insufficientData) {
      // Tier 4: return a sentinel result. Caller surfaces "insufficient data" UI.
      return {
        probability: 0,
        anchor: 0,
        tier: 4,
        anchorSource: 'none',
        factors: [],
        insufficientData,
        modifierResults: {},
        ruleVersion: COUNSELOR_RULE_VERSION,
        missingFields: this.resolveMissingFields(profile, school),
        sourceContributions: [
          {
            source: 'anchor',
            value: null,
            role: 'anchor',
            detail: insufficientData.reason,
          },
        ],
      };
    }

    // ---- Step 2: compute all 8 modifiers --------------------------------
    // Round resolution priority: explicit param > school.applicationRound (set by
    // the caller per-school, since one user applies to multiple schools each
    // potentially in a different round) > 'RD' default. ProfileInput doesn't
    // carry applicationRound — that's a per-school attribute.
    const resolvedRound =
      applicationRound ?? (school as SchoolInput).applicationRound ?? 'RD';

    // Suppress modifiers whose dimension is already encoded in a Tier 1 cell —
    // see EncodedDimension docs above. Without this, a (gpa=3.75-4, sat=1500-1600)
    // cell rate gets re-multiplied by gpa×1.3 + test×1.5, double-counting strong
    // stats and overshooting the 2.5× cap on every Tier 1 hit.
    //
    // We deliberately use impact='positive' (not 'neutral') so the factor stays
    // visible in the breakdown — users SHOULD see "strong GPA acknowledged".
    // The multiplier is 1.0 because the contribution is already in the cell rate.
    const suppressed = (label: string): ModifierResult => ({
      multiplier: 1.0,
      label: `${label} (already encoded in Tier 1 cell)`,
      evidence: `Strong ${label.toLowerCase()} is already encoded in the school's published Tier 1 cell admit rate — not multiplied again to avoid double-counting.`,
      impact: 'positive',
    });

    const modifierResults = {
      gpaBand: encodedDimensions.has('gpa')
        ? suppressed('GPA')
        : gpaBandMultiplier(profile, school),
      testBand: encodedDimensions.has('test')
        ? suppressed('Test score')
        : testBandMultiplier(profile, school),
      round: roundMultiplier(resolvedRound),
      legacyHook: legacyHookMultiplier(profile, school),
      firstGen: firstGenMultiplier(profile),
      athlete: athleteMultiplier(profile),
      urm: urmMultiplier(profile, school),
      geo: geoMultiplier(profile, school),
      intl: intlMultiplier(profile, school),
      major: majorMultiplier(
        profile,
        school,
        await this.lookupProgramAcceptanceRate(profile, school),
      ),
    } as Record<string, ModifierResult>;

    // ---- Step 3: combine + clip -----------------------------------------
    const product = Object.values(modifierResults).reduce(
      (acc, m) => acc * m.multiplier,
      1.0,
    );
    const raw = anchor * product;
    // Anchored clip: never more than 2.5× or less than 0.3× the school baseline.
    const lowerBound = Math.max(0.02, anchor * 0.3);
    const upperBound = Math.min(0.98, anchor * 2.5);
    const probability = Math.max(lowerBound, Math.min(upperBound, raw));

    // ---- Step 4: build factors[] for UI breakdown -----------------------
    const factors: CounselorFactor[] = [
      {
        name: 'School baseline admit rate',
        impact: 'neutral',
        weight: 1.0,
        detail: `Anchored at ${(anchor * 100).toFixed(1)}% (${anchorSource}, Tier ${tier})`,
      },
    ];
    for (const [_key, mr] of Object.entries(modifierResults)) {
      // Skip neutral (×1.0 with no specific evidence) factors to keep the breakdown focused.
      if (mr.multiplier === 1.0 && mr.impact === 'neutral') continue;
      factors.push({
        name: mr.label,
        impact: mr.impact,
        weight: Math.abs(mr.multiplier - 1.0),
        detail: `${mr.evidence} (×${mr.multiplier.toFixed(2)})`,
      });
    }
    // Add the final clamp note if the raw value was clipped — operational
    // transparency. Helps debugging "why didn't multiplying by 4× get me to 95%?"
    if (raw > upperBound + 0.001) {
      factors.push({
        name: 'Capped at 2.5× school baseline',
        impact: 'neutral',
        weight: 0,
        detail: `Combined modifiers would have produced ${(raw * 100).toFixed(0)}%, but counselor caps any prediction at 2.5× the school baseline`,
      });
    } else if (raw < lowerBound - 0.001) {
      factors.push({
        name: 'Floored at 0.3× school baseline',
        impact: 'neutral',
        weight: 0,
        detail: `Combined modifiers would have produced ${(raw * 100).toFixed(1)}%, but counselor floors any prediction at 0.3× the school baseline`,
      });
    }

    return {
      probability,
      anchor,
      tier,
      anchorSource,
      factors,
      modifierResults,
      ruleVersion: COUNSELOR_RULE_VERSION,
      missingFields: this.resolveMissingFields(profile, school),
      sourceContributions: [
        ...(anchorContributions ?? [
          {
            source: anchorSource,
            value: anchor,
            role: 'anchor' as const,
            detail: `Anchor resolved from ${anchorSource} at Tier ${tier}`,
          },
        ]),
        ...Object.entries(modifierResults).map(([key, modifier]) => ({
          source: key,
          value: modifier.multiplier,
          role: 'modifier' as const,
          detail: modifier.evidence,
        })),
        {
          source: 'anchored-clamp',
          value: probability,
          role: 'guardrail',
          detail:
            'Final probability constrained to [anchor × 0.3, anchor × 2.5] and [0.02, 0.98].',
        },
      ],
    };
  }

  private resolveMissingFields(
    profile: ProfileInput,
    school: SchoolInput & { acceptanceRate?: number | null },
  ): string[] {
    const missing = new Set<string>();
    if (profile.gpa == null) missing.add('profile.gpa');
    if (!profile.testScores?.length) missing.add('profile.testScores');
    if (!profile.highSchoolLocation) missing.add('profile.highSchoolLocation');
    if (!profile.targetMajor) missing.add('profile.targetMajor');
    if (school.acceptanceRate == null) missing.add('school.acceptanceRate');
    if (school.sat25 == null || school.sat75 == null) {
      missing.add('school.satBands');
    }
    return Array.from(missing);
  }

  // ---------------------------------------------------------------------------
  // Anchor resolution: 4-tier fallback
  // ---------------------------------------------------------------------------

  private async resolveAnchor(
    profile: ProfileInput,
    school: SchoolInput & { acceptanceRate?: number | null },
  ): Promise<{
    anchor: number;
    tier: CounselorTier;
    anchorSource: string;
    /**
     * Profile dimensions already absorbed into the anchor — see EncodedDimension.
     * For Tier 1 CDS-band cells, this depends on the cell's `testType`. For
     * Tier 2/3/4 (overall acceptance rate), the set is empty and all modifiers
     * apply normally.
     */
    encodedDimensions: ReadonlySet<EncodedDimension>;
    insufficientData?: { reason: string };
    sourceContributions?: CounselorResult['sourceContributions'];
  }> {
    // Tier 1: CDS Section C9 admit-by-band lookup if (school, gpaBand, testBand)
    // cell exists. Most accurate signal — uses school-published numbers directly.
    const cdsBand = await this.lookupCdsBand(profile, school);
    if (cdsBand != null) {
      return {
        anchor: cdsBand.admitRate,
        tier: 1,
        anchorSource: 'cds-bands-v1',
        encodedDimensions: cdsBand.encodedDimensions,
      };
    }

    // Tier 2 / 3: fall back to overall acceptanceRate.
    // The difference between Tier 2 and Tier 3 is only relevant for the
    // GPA/SAT band modifiers (which need sat25/75 to be useful) — both use
    // acceptanceRate as anchor. Distinction is reported in `tier` for ops
    // visibility but doesn't affect math here.
    const overall = this.normalizeAcceptanceRate(school.acceptanceRate);
    if (overall != null) {
      const hasSatBands = school.sat25 != null && school.sat75 != null;
      return {
        anchor: overall,
        tier: hasSatBands ? 2 : 3,
        anchorSource: hasSatBands
          ? 'scorecard (acceptanceRate + SAT bands)'
          : 'scorecard (acceptanceRate only)',
        encodedDimensions: new Set(),
      };
    }

    // Tier 4: no usable data — caller shows "insufficient data" message.
    return {
      anchor: 0,
      tier: 4,
      anchorSource: 'none',
      encodedDimensions: new Set(),
      insufficientData: {
        reason:
          'school_missing_acceptance_rate: no acceptanceRate or CDS band data available for this school',
      },
    };
  }

  /**
   * Look up `SchoolCdsAdmitBand` for the (school, gpaBand, testBand) cell.
   * Mirrors `cds-bands-teacher.service.ts:resolveGpaBand/resolveSatBand` logic
   * for a consistent band convention across the platform.
   *
   * Returns the cell admit rate AND which profile dimensions the cell
   * encodes. `testType: 'GPA_ONLY'` cells encode only GPA; `SAT`/`ACT` cells
   * encode both GPA and test. The caller uses this to suppress redundant
   * modifiers in the compute step (see `EncodedDimension` docs).
   */
  private async lookupCdsBand(
    profile: ProfileInput,
    school: SchoolInput,
  ): Promise<{
    admitRate: number;
    encodedDimensions: ReadonlySet<EncodedDimension>;
  } | null> {
    const gpaBands = this.gpaToBands(profile.gpa, profile.gpaScale);
    if (!gpaBands.length) return null;

    const testCandidates: Array<{ testType: string; testBand: string }> = [];
    const sat = profile.testScores?.find((t) => t.type === 'SAT')?.score;
    if (sat != null) {
      const satBand = this.satToBand(sat);
      if (satBand) testCandidates.push({ testType: 'SAT', testBand: satBand });
    }
    const act = profile.testScores?.find((t) => t.type === 'ACT')?.score;
    if (act != null) {
      const actBand = this.actToBand(act);
      if (actBand) testCandidates.push({ testType: 'ACT', testBand: actBand });
    }
    testCandidates.push({ testType: 'GPA_ONLY', testBand: 'ANY' });

    // PR-14: iterate gpaBands in preference order (UC weighted first, then
    // standard 4.0 fallback). For each gpaBand, try each test candidate.
    // First hit wins.
    for (const gpaBand of gpaBands) {
      for (const c of testCandidates) {
        const row = await this.prisma.schoolCdsAdmitBand.findFirst({
          where: {
            schoolId: school.id,
            gpaBand,
            testType: c.testType,
            testBand: c.testBand,
          },
          orderBy: [{ cycleYear: 'desc' }, { updatedAt: 'desc' }],
          select: { admitRate: true },
        });
        if (row) {
          let rate = row.admitRate.toNumber();
          if (rate >= 1) rate = rate / 100; // tolerate percentages stored as 88 not 0.88
          if (rate <= 0 || rate >= 1) continue;
          // Cell with testType = SAT/ACT encodes BOTH gpa + test signal.
          // Cell with testType = GPA_ONLY encodes ONLY gpa.
          const encoded: Set<EncodedDimension> = new Set(['gpa']);
          if (c.testType !== 'GPA_ONLY') encoded.add('test');
          return { admitRate: rate, encodedDimensions: encoded };
        }
      }
    }
    return null;
  }

  private async lookupProgramAcceptanceRate(
    profile: ProfileInput,
    school: SchoolInput,
  ): Promise<number | null> {
    if (!profile.targetMajor) return null;
    // Loose fuzzy match — SchoolProgram uses CIP codes and friendly names
    // (`programName` field; not `name`). The precise CIP mapping lives in
    // major-selectivity-teacher; counselor does the simpler programName-contains
    // lookup. If no hit, returns null and majorMultiplier returns neutral.
    const program = await this.prisma.schoolProgram.findFirst({
      where: {
        schoolId: school.id,
        OR: [
          {
            programName: {
              contains: profile.targetMajor,
              mode: 'insensitive',
            },
          },
          { cipCode: profile.targetMajor },
        ],
      },
      select: { acceptanceRateEstimate: true },
    });
    if (!program?.acceptanceRateEstimate) return null;
    const raw = program.acceptanceRateEstimate.toNumber();
    if (raw <= 0) return null;
    return raw > 1 ? raw / 100 : raw;
  }

  // ---------------------------------------------------------------------------
  // Helpers (band conventions mirror cds-bands-teacher.service.ts)
  // ---------------------------------------------------------------------------

  private gpaToBand(
    gpa: number | undefined,
    gpaScale: number | undefined,
  ): string | null {
    // Legacy single-band: returns the standard 4.0-scale band for backward
    // compatibility. New code uses gpaToBands() to also try UC-weighted bands.
    const bands = this.gpaToBands(gpa, gpaScale);
    return bands[bands.length - 1] ?? null;
  }

  /**
   * Return all candidate gpaBand labels to try (in order of preference)
   * when looking up a CDS cell. PR-14: also emits UC-weighted bands when
   * the input scale > 4.0, so UC students with weighted GPA hit per-band
   * UCOP cells loaded into `SchoolCdsAdmitBand` for higher precision.
   *
   * Order: most-specific first (UC weighted) → fallback (standard 4.0).
   */
  private gpaToBands(
    gpa: number | undefined,
    gpaScale: number | undefined,
  ): string[] {
    if (gpa == null || !Number.isFinite(gpa)) return [];
    const scale = gpaScale && gpaScale > 0 ? gpaScale : 4.0;
    const bands: string[] = [];

    // UC weighted scale (capped at 4.4): emit UC-style bands matching UCOP
    // freshman profile data ("admit rate by HS GPA: 4.20+ / 4.00-4.19 / ...").
    // Only emit when caller explicitly set scale > 4.0 (avoids misfiring
    // on accidental gpa=4.30 with default 4.0 scale).
    if (scale > 4.0) {
      if (gpa >= 4.2) bands.push('4.20-4.40');
      else if (gpa >= 4.0) bands.push('4.00-4.19');
      else if (gpa >= 3.8) bands.push('3.80-3.99');
      else if (gpa >= 3.6) bands.push('3.60-3.79');
      else bands.push('<3.60');
    }

    // Always also emit standard 4.0-scale band (normalized). Acts as
    // fallback when no UC-weighted cell matches; also primary for non-UC
    // schools.
    const gpa4 = (gpa / scale) * 4.0;
    if (gpa4 >= 3.75) bands.push('3.75-4.00');
    else if (gpa4 >= 3.5) bands.push('3.50-3.74');
    else if (gpa4 >= 3.25) bands.push('3.25-3.49');
    else if (gpa4 >= 3) bands.push('3.00-3.24');
    else bands.push('<3.00');

    return bands;
  }

  private satToBand(sat: number): string | null {
    if (!Number.isFinite(sat)) return null;
    if (sat >= 1500) return '1500-1600';
    if (sat >= 1400) return '1400-1499';
    if (sat >= 1300) return '1300-1399';
    return '<1300';
  }

  private actToBand(act: number): string | null {
    if (!Number.isFinite(act)) return null;
    if (act >= 34) return '34-36';
    if (act >= 31) return '31-33';
    if (act >= 28) return '28-30';
    return '<28';
  }

  /**
   * Coerce school.acceptanceRate (Decimal column, may be 11.5 = 11.5% OR 0.115)
   * to probability in [0, 1]. Returns null if missing or invalid.
   */
  private normalizeAcceptanceRate(
    raw: number | null | undefined,
  ): number | null {
    if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
    const normalized = raw > 1 ? raw / 100 : raw;
    return normalized > 0 && normalized < 1 ? normalized : null;
  }
}
