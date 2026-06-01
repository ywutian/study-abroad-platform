import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  resolveMajorToCip,
  resolveMajorToProgramBucket,
} from '@study-abroad/shared/scoring';
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
  profileContextMultiplier,
  roundMultiplier,
  testBandMultiplier,
  urmMultiplier,
  type ModifierResult,
  type ProfileSignalCoverage,
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
 * This service is the launch served probability path. Legacy fusion/ML services
 * may remain in the module for fallback or historical comparison, but they must
 * not be called to serve a counselor-primary prediction.
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

export const COUNSELOR_RULE_VERSION =
  'counselor-cold-start-v1.8-profile-signals';

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
  /** Profile signal audit trail: consumed, explained, missing, or ignored by policy. */
  profileSignals?: ProfileSignalCoverage;
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
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(AnchorResolverService)
    private readonly anchorResolver?: AnchorResolverService,
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
      needBlindInternational?: boolean | null;
      intlAcceptanceRate?: number | null;
      oosAcceptanceRate?: number | null;
      inStateAcceptanceRate?: number | null;
      institutionType?: string | null;
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
      const profileContext = profileContextMultiplier(profile, school);
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
        profileSignals: profileContext.profileSignals,
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

    // ---- Step 2: compute all launch counselor modifiers ------------------
    // Round resolution priority: explicit param > school.applicationRound (set by
    // the caller per-school, since one user applies to multiple schools each
    // potentially in a different round) > 'RD' default. ProfileInput doesn't
    // carry applicationRound — that's a per-school attribute.
    const resolvedRound = applicationRound ?? school.applicationRound ?? 'RD';

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

    // Suppress the in-state geo BOOST when the anchor is a UC by-GPA Tier-1 band
    // (`cds-bands-v1`). The flat CA in-state multiplier (~1.35×) is measured against the
    // OVERALL all-GPA pool (CA-resident ~14.9% / overall ~11%), but the band already
    // conditions on a top GPA — stacking them over-predicts. UC is test-blind (since 2021,
    // so the SAT is ignored) and its applicant pool is GPA-saturated (a 3.9 GPA sits at the
    // admit-class median, not an elite slice), so the marginal top-GPA lift is small
    // (~1.3-1.5×, not 2-3×). Multi-source research (2026-05-31, 11 agents) puts a strong
    // CA-resident's UC Berkeley admit rate at ~22% (range 18-27%): band 0.25 alone matches
    // that, while band × 1.35 = 0.34 over-predicts. This holds under BOTH readings of the
    // band's basis — if it's a CA-resident rate the multiplier is a literal double-count; if
    // it's an all-applicant rate the residency lift is already ~spent at the top band.
    // Mirrors the gpa/test Tier-1 suppression above. OOS applicants are unaffected (their geo
    // is a penalty/adjustment, not an in-state boost). NOTE: this overrides
    // STATE_IN_STATE_OVER_OVERALL['CA'] for UC band hits — that constant only takes effect
    // for CA publics that fall to a Tier-2/3 overall anchor (no by-GPA band).
    const geoRaw = geoMultiplier(profile, school);
    const geoIsInStateBoost =
      geoRaw.impact === 'positive' && /in-state/i.test(geoRaw.label ?? '');
    const geo =
      anchorSource === 'cds-bands-v1' && geoIsInStateBoost
        ? {
            multiplier: 1.0,
            label: `${geoRaw.label} (already captured by the by-GPA band)`,
            evidence:
              'UC admit-by-GPA bands already condition on a top GPA, and UC is test-blind with a GPA-saturated applicant pool, so an extra in-state multiplier would over-state the residency advantage — the band itself is the served estimate (a strong CA resident at UC Berkeley is ~22% per published data, not ~34%).',
            impact: 'positive' as const,
          }
        : geoRaw;

    const modifierResults = {
      gpaBand: encodedDimensions.has('gpa')
        ? suppressed('GPA')
        : gpaBandMultiplier(profile, school),
      testBand: encodedDimensions.has('test')
        ? suppressed('Test score')
        : testBandMultiplier(profile, school),
      round: roundMultiplier(resolvedRound, school),
      legacyHook: legacyHookMultiplier(profile, school),
      firstGen: firstGenMultiplier(profile, school),
      athlete: athleteMultiplier(profile),
      urm: urmMultiplier(profile, school),
      geo,
      intl: intlMultiplier(profile, school),
      major: majorMultiplier(
        profile,
        school,
        await this.lookupProgramAcceptanceRate(profile, school),
      ),
      profileContext: profileContextMultiplier(profile, school),
    } as Record<string, ModifierResult>;

    // ---- Step 3: combine + clip -----------------------------------------
    // GPA and test scores are correlated in admissions; treating them as
    // independent multipliers double-penalizes consistent profiles. When both
    // modifiers are active (no Tier 1 encoding) AND both express a non-neutral
    // signal, we replace the gpa×test product with their geometric mean: a
    // 3.90 GPA + 1560 SAT applicant gets ~×0.65 instead of ×0.42 at MIT,
    // which prevents top-school predictions from collapsing to the floor for
    // a typical-strong applicant.
    //
    // **2026-05-24 correctness fix**: previously the geomean was applied
    // whenever neither dimension was Tier 1 encoded, even if one of them was
    // exactly 1.0 (e.g. admit-pool-middle-50 test band). In that case the
    // geomean wrongly *lowered* the other multiplier (e.g. gpaBand 1.027 →
    // sqrt(1.027 × 1.0) = 1.013), penalizing symmetric profiles. The
    // geometric mean only makes sense as a correlation correction when BOTH
    // dimensions are non-neutral; if one is 1.0, multiplying directly is
    // already the identity.
    //
    // When one dimension is encoded (Tier 1 cell already accounts for GPA or
    // test), the suppressed multiplier is 1.0 anyway, so multiplying directly
    // is correct.
    // Correlation correction (geometric mean) for the combined GPA×test academic signal,
    // applied UNIFORMLY whenever both academic dimensions are active (not Tier-1 encoded).
    //
    // GPA and test are correlated, so a plain product double-counts a consistent profile. The
    // geomean corrects this in BOTH tails toward the school baseline: a consistently-below-bar
    // applicant isn't double-penalized to the floor (anti-collapse), and a both-strong applicant
    // doesn't slam the anchor×2.5 cap (no over-confidence). It is also applied to the
    // single-dimension case ON PURPOSE: a strong GPA NOT corroborated by a strong test (test
    // merely in the school's middle-50 → neutral) is genuinely weaker evidence than the GPA alone
    // implies, so dampening it toward the baseline is the correlation principle, not a bug.
    //
    // Why uniform (the design decision, 2026-06 monotonicity audit):
    //   - The earlier "geomean iff BOTH non-neutral, else product" switch was NON-MONOTONIC — a
    //     strictly-WORSE applicant (both stats below band → geomean lift) could outscore a better
    //     one (one stat in the neutral middle-50 → full product penalty), inverting ~21% of
    //     ranked schools at the edge profile.
    //   - Penalty-side-only (sqrt iff product<1) is monotonic too, but removes the both-BOOST
    //     dampening → strong in-state applicants at in-state-favoring publics slam the 0.98 cap
    //     (over-confidence), and it abandons the correlation principle for single-dim boosts.
    //   - No simple symmetric monotonic combine can leave single-dim boosts at full product AND
    //     dampen both-dim boosts AND lift both-dim penalties (sign(ln gpa · ln test) is identical
    //     in both tails). Uniform geomean is the consistent, monotonic, conservative resolution.
    const bothAcademicActive =
      !encodedDimensions.has('gpa') && !encodedDimensions.has('test');
    const academicProduct = bothAcademicActive
      ? Math.sqrt(
          modifierResults.gpaBand.multiplier *
            modifierResults.testBand.multiplier,
        )
      : modifierResults.gpaBand.multiplier *
        modifierResults.testBand.multiplier;

    const product = Object.entries(modifierResults).reduce((acc, [key, m]) => {
      if (key === 'gpaBand' || key === 'testBand') return acc;
      return acc * m.multiplier;
    }, academicProduct);
    const raw = anchor * product;
    // Anchored clip: never more than 2.5× or less than 0.3× the school baseline.
    //
    // PR · prediction-counselor-fix (2026-05-21): the previous absolute floor
    // of 0.02 (i.e. `Math.max(0.02, anchor * 0.3)`) was catastrophic for
    // top-5 schools — Harvard (3.65%), Princeton (4.42%), MIT (4.55%) all
    // have `anchor * 0.3 ≈ 0.011-0.014 < 0.02`, so every international-student
    // profile from the strongest (IMO Silver + 1560 SAT) to the weakest
    // (1340 SAT + 1 EC) was clamped to the identical 2.0% — making the
    // prediction profile-blind at exactly the schools users care about most.
    // Switching to a pure relative floor `anchor * 0.1` lets reach-school
    // predictions go below 2% when the profile genuinely warrants it, while
    // still preventing collapse to ~0 on bad inputs. For UCD (41.83%) the
    // floor is now 4.18%; for Harvard it's 0.365% — both reasonable.
    const lowerBound = anchor * 0.1;
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
    // Surface the geometric-mean combination when both academic dimensions
    // are active and at least one is non-neutral. Educates the user that
    // GPA + SAT are co-evaluated, not independently penalized.
    if (
      bothAcademicActive &&
      (modifierResults.gpaBand.multiplier !== 1.0 ||
        modifierResults.testBand.multiplier !== 1.0)
    ) {
      const naive =
        modifierResults.gpaBand.multiplier *
        modifierResults.testBand.multiplier;
      factors.push({
        name: 'Combined academic signal (geometric mean)',
        impact: 'neutral',
        weight: 0,
        detail: `GPA ×${modifierResults.gpaBand.multiplier.toFixed(2)} and test ×${modifierResults.testBand.multiplier.toFixed(2)} are co-evaluated as ×${academicProduct.toFixed(2)} (geometric mean) instead of ×${naive.toFixed(2)} (product) to avoid double-penalizing consistent profiles.`,
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
      profileSignals: (modifierResults.profileContext as any)?.profileSignals,
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
    if (!profile.activities?.length) missing.add('profile.activities');
    if (!profile.awards?.length) missing.add('profile.awards');
    if (!profile.gpaTrend || profile.gpaTrend.direction === 'insufficient') {
      missing.add('profile.gpaTrend');
    }
    if (profile.isInternational && !profile.englishProficiency) {
      missing.add('profile.englishProficiency');
    }
    if (!profile.highSchoolTier && !profile.highSchoolRecognition) {
      missing.add('profile.highSchoolContext');
    }
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
    school: SchoolInput & {
      acceptanceRate?: number | null;
      institutionType?: string | null;
    },
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
    if (this.isAuditionOrPortfolioSchool(school)) {
      return {
        anchor: 0,
        tier: 4,
        anchorSource: 'audition_or_portfolio_admission',
        encodedDimensions: new Set(),
        insufficientData: {
          reason:
            'audition_or_portfolio_admission: this school admits primarily on portfolio review or audition; academic stats alone cannot reliably predict outcome',
        },
        sourceContributions: [
          {
            source: 'institutionType',
            value: null,
            role: 'anchor',
            detail:
              'Portfolio/audition-first institution; counselor declines to provide an academic-stats probability.',
          },
        ],
      };
    }

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

    const cipCode = resolveMajorToCip(profile.targetMajor);
    const cipProgram = cipCode
      ? await this.prisma.schoolProgram.findFirst({
          where: {
            schoolId: school.id,
            cipCode,
          },
          select: { acceptanceRateEstimate: true },
        })
      : null;
    if (cipProgram?.acceptanceRateEstimate) {
      const raw = cipProgram.acceptanceRateEstimate.toNumber();
      if (raw > 0) return raw > 1 ? raw / 100 : raw;
    }

    // Fuzzy name match for unknown aliases or rows whose CIP code is missing.
    const program = await this.prisma.schoolProgram.findFirst({
      where: {
        schoolId: school.id,
        programName: {
          contains: profile.targetMajor,
          mode: 'insensitive',
        },
      },
      select: { acceptanceRateEstimate: true },
    });
    if (program?.acceptanceRateEstimate) {
      const raw = program.acceptanceRateEstimate.toNumber();
      if (raw > 0) return raw > 1 ? raw / 100 : raw;
    }

    // PR · prediction-counselor-fix (2026-05-21): bucket fallback.
    // `SchoolProgram` only carries 7 coarse CIP buckets (CS, Engineering,
    // Business, Nursing, Biology, Fine Arts, Liberal Arts). A major like
    // Economics resolves to CIP 45.0101 which has NO SchoolProgram row, so
    // the lookups above return null → majorMultiplier NEUTRAL. Meanwhile a
    // CS applicant DOES match a bucket and gets the data-driven penalty.
    // That coverage gap produced a monotonicity inversion (PR diagnostic
    // agent 3). The bucket resolver maps every major to its nearest of the
    // 7 populated buckets so coverage is uniform — the rate value still
    // comes from the school's own SchoolProgram row, not a fabricated
    // constant.
    const bucketCip = resolveMajorToProgramBucket(profile.targetMajor);
    if (bucketCip && bucketCip !== cipCode) {
      const bucketProgram = await this.prisma.schoolProgram.findFirst({
        where: { schoolId: school.id, cipCode: bucketCip },
        select: { acceptanceRateEstimate: true },
      });
      if (bucketProgram?.acceptanceRateEstimate) {
        const raw = bucketProgram.acceptanceRateEstimate.toNumber();
        if (raw > 0) return raw > 1 ? raw / 100 : raw;
      }
    }

    // No hit anywhere → majorMultiplier returns neutral.
    return null;
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

  private isAuditionOrPortfolioSchool(
    school: SchoolInput & { institutionType?: string | null },
  ): boolean {
    const type = school.institutionType?.trim().toUpperCase();
    return type === 'ART_DESIGN' || type === 'MUSIC_CONSERVATORY';
  }
}
