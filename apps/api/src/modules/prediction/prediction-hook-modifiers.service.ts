import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileInput, SchoolInput } from './prediction.prompts';
import {
  adjustInLogOdds,
  logit,
  getMajorSelectivityMultiplier,
  calculateSelectivityIndex,
} from '@study-abroad/shared/scoring';
import type {
  ProfileMetrics,
  SchoolMetrics,
} from '@study-abroad/shared/scoring';

// ============================================
// Hook Shift Interface
// ============================================

export interface HookShift {
  hookType: string;
  logOddsShift: number;
  source: string; // literature reference
}

// ============================================
// Default Hook Coefficients (log-odds space)
// ============================================

/**
 * Hook coefficients from Arcidiacono (2020) expert report, SFFA v. Harvard.
 *
 * These are log-odds shifts derived from reported odds ratios:
 *   OR = exp(shift)  →  shift = ln(OR)
 *
 * - LEGACY_PRIMARY:  ln(8.5)  ≈ +2.14  (parent attended same institution)
 * - LEGACY_SECONDARY: ln(3.0) ≈ +1.10  (sibling/grandparent connection)
 * - FIRST_GEN:       ln(1.5)  ≈ +0.40  (first-generation college student)
 * - NEED_AWARE_PARTIAL: ln(0.6) ≈ -0.50 (partial need-aware, some disadvantage)
 * - NEED_AWARE_FULL:  ln(0.37) ≈ -1.00  (full need-aware for intl, strong penalty)
 */
const HOOK_COEFFICIENTS = {
  LEGACY_PRIMARY: 2.14,
  LEGACY_SECONDARY: 1.1,
  FIRST_GEN: 0.4,
  NEED_AWARE_PARTIAL: -0.5,
  NEED_AWARE_FULL: -1.0,
} as const;

/**
 * ED round log-odds shifts (converted from ROUND_MULTIPLIERS in constants.ts).
 *
 * These replace the old `probability * multiplier` approach with mathematically
 * correct log-odds shifts. Values are ln(multiplier):
 *   ED:  ln(1.35) ≈ 0.30
 *   ED2: ln(1.25) ≈ 0.22
 *   REA: ln(1.15) ≈ 0.14
 *   etc.
 */
const ROUND_LOG_ODDS_SHIFTS: Record<string, number> = {
  ED: 0.3,
  ED2: 0.22,
  REA: 0.14,
  SCEA: 0.14,
  EA: 0.1,
  ROLLING: 0.05,
  RD: 0,
};

/**
 * Chinese applicant adjustment multipliers by school selectivity tier.
 *
 * Reflects the documented over-representation penalty for Chinese nationals
 * at highly selective US institutions.
 *
 * Source: CAPS framework (Zeng & Shen 2025), College-specific CDS Section C
 * analysis of international admit rates by country of origin.
 */
const CHINESE_APPLICANT_MULTIPLIER: Array<{
  threshold: number;
  multiplier: number;
}> = [
  { threshold: 0.85, multiplier: 0.4 },
  { threshold: 0.7, multiplier: 0.6 },
  { threshold: 0.5, multiplier: 0.8 },
  { threshold: 0, multiplier: 1.0 },
];

/** Maximum total log-odds shift to prevent extreme swings. */
const MAX_TOTAL_SHIFT = 3.0;

const CHINA_CODES = new Set(['CN', 'CHN', 'CHINA', 'PRC']);

/**
 * Hook Modifiers Service (v5 ML-Primary Architecture)
 *
 * Manages hook coefficients in log-odds space, replacing the ad-hoc
 * `probability * multiplier` approach used in v3/v4. Log-odds shifts
 * are mathematically equivalent to odds-ratio adjustments and never
 * push probabilities outside [0, 1].
 *
 * Hook categories:
 * 1. Legacy (primary/secondary) — Arcidiacono SFFA v. Harvard
 * 2. First-generation — same source
 * 3. Need-aware penalty — intl students at need-aware schools
 * 4. ED/EA round bonus — converted from historical multipliers
 * 5. Major selectivity — competitive program base rate adjustment
 * 6. Chinese applicant adjustment — country-of-origin pool penalty
 */
@Injectable()
export class PredictionHookModifiersService {
  private readonly logger = new Logger(PredictionHookModifiersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the effective base rate for a school+profile+round combination.
   *
   * Priority chain (each step modifies the rate from the previous):
   *   1. ED-specific rate (edAcceptanceRate, shared for ED/ED2) > intlAcceptanceRate > overall acceptanceRate
   *   2. Chinese applicant adjustment (selectivity-tiered multiplier)
   *   3. Major selectivity multiplier (hyper-competitive programs like CS@CMU)
   *
   * @returns Effective base rate as a probability (0-1 scale)
   */
  async getBaseRate(
    school: SchoolMetrics & {
      edAcceptanceRate?: number;
      intlAcceptanceRate?: number;
      acceptanceRate: number;
    },
    profile: ProfileInput,
    round: string,
    majorCompetitiveness?: number,
    /**
     * Per-school per-major acceptance rate from SchoolProgram (CDS Section J).
     * When set, this OVERRIDES the school-level rate and the 5-band multiplier
     * because it's more accurate than `school.acceptanceRate × heuristic_mult`.
     * Format: percentage (e.g. 6.45 means 6.45%) — same as school.acceptanceRate.
     */
    programAcceptanceRate?: number,
  ): Promise<number> {
    // Step 1: Select the most specific acceptance rate
    let baseRate: number;

    // Step 1.5: If program-specific rate is available, prefer it over school-level.
    // This is more accurate than `school_rate × competitiveness_multiplier`.
    // Only applies to RD round (ED/EA have their own round-specific rates).
    const useProgramRate =
      programAcceptanceRate != null &&
      Number.isFinite(programAcceptanceRate) &&
      programAcceptanceRate > 0 &&
      (round === 'RD' || round === 'REGULAR' || !round);

    if (useProgramRate) {
      baseRate = programAcceptanceRate!;
      this.logger.debug(
        `Using program-specific rate: ${baseRate.toFixed(2)}% ` +
          `(school-level was ${school.acceptanceRate}%)`,
      );
    } else if (
      (round === 'ED' || round === 'SCEA' || round === 'REA') &&
      school.edAcceptanceRate != null
    ) {
      baseRate = school.edAcceptanceRate;
    } else if (round === 'ED2' && school.edAcceptanceRate != null) {
      // ED2 uses the same ED rate since schools rarely publish separate ED2 rates
      baseRate = school.edAcceptanceRate;
    } else if (profile.isInternational && school.intlAcceptanceRate != null) {
      baseRate = school.intlAcceptanceRate;
    } else {
      baseRate = school.acceptanceRate;
    }

    // Normalize to 0-1 if stored as percentage (> 1)
    if (baseRate > 1) {
      baseRate = baseRate / 100;
    }

    // Step 2: Chinese applicant adjustment
    if (this.isChineseApplicant(profile)) {
      const selectivity = calculateSelectivityIndex(school);
      const multiplier = this.getChineseApplicantMultiplier(selectivity);
      if (multiplier < 1.0) {
        baseRate = baseRate * multiplier;
        this.logger.debug(
          `Chinese applicant adjustment: selectivity=${selectivity.toFixed(2)}, ` +
            `multiplier=${multiplier}, adjusted rate=${baseRate.toFixed(4)}`,
        );
      }
    }

    // Step 3: Major selectivity multiplier — SKIP when we already used the
    // program-specific rate (which already encodes major selectivity).
    if (!useProgramRate && majorCompetitiveness != null) {
      const majorMultiplier =
        getMajorSelectivityMultiplier(majorCompetitiveness);
      if (majorMultiplier !== 1.0) {
        baseRate = baseRate * majorMultiplier;
        this.logger.debug(
          `Major selectivity adjustment: competitiveness=${majorCompetitiveness}, ` +
            `multiplier=${majorMultiplier}, adjusted rate=${baseRate.toFixed(4)}`,
        );
      }
    }

    // Clamp to valid probability range
    return Math.max(0.005, Math.min(0.95, baseRate));
  }

  /**
   * Compute all applicable hook shifts in log-odds space.
   *
   * Each shift is documented with its literature reference.
   * Shifts are independent and additive in log-odds space
   * (which corresponds to multiplicative odds ratios).
   */
  computeHookShifts(
    profile: ProfileInput,
    school: SchoolInput & {
      needBlindInternational?: boolean;
      considersLegacy?: boolean;
    },
  ): HookShift[] {
    const shifts: HookShift[] = [];

    // --- Legacy hook ---
    if (profile.isLegacy && school.considersLegacy !== false) {
      const isDirectLegacy = profile.legacySchools?.some(
        (ls) =>
          ls.toLowerCase() === school.name?.toLowerCase() ||
          ls.toLowerCase() === school.nameZh?.toLowerCase(),
      );

      if (isDirectLegacy) {
        shifts.push({
          hookType: 'LEGACY_PRIMARY',
          logOddsShift: HOOK_COEFFICIENTS.LEGACY_PRIMARY,
          source: 'Arcidiacono (2020) SFFA v. Harvard expert report, OR=8.5x',
        });
      }
      // No boost when legacy school doesn't match — legacy advantage is school-specific
    }

    // --- First-generation hook ---
    if (profile.isFirstGen) {
      shifts.push({
        hookType: 'FIRST_GEN',
        logOddsShift: HOOK_COEFFICIENTS.FIRST_GEN,
        source: 'Arcidiacono (2020) SFFA v. Harvard, first-gen OR≈1.5x',
      });
    }

    // --- Need-aware penalty (international students only) ---
    if (
      profile.needsFinancialAid &&
      profile.isInternational &&
      !school.needBlindInternational
    ) {
      // Distinguish partial vs. full need-aware based on school's needBlind status
      // If the school is not need-blind for internationals and the student needs aid,
      // apply full penalty. Partial penalty would apply for schools that are
      // "need-aware but generous" (future: load from school metadata).
      shifts.push({
        hookType: 'NEED_AWARE_FULL',
        logOddsShift: HOOK_COEFFICIENTS.NEED_AWARE_FULL,
        source:
          'Need-aware admissions penalty for international students requiring aid, OR≈0.37x',
      });
    }

    // --- ED/EA round bonus ---
    const roundShift =
      ROUND_LOG_ODDS_SHIFTS[school.applicationRound ?? 'RD'] ?? 0;
    if (roundShift !== 0) {
      shifts.push({
        hookType: 'ROUND_BONUS',
        logOddsShift: roundShift,
        source: `Application round ${school.applicationRound} demonstrated interest signal, derived from CDS historical ED/EA admit rates`,
      });
    }

    return shifts;
  }

  /**
   * Apply hook shifts to a base probability in log-odds space.
   *
   * Total shift is capped at [-MAX_TOTAL_SHIFT, +MAX_TOTAL_SHIFT] to prevent
   * extreme probability swings from stacking too many hooks.
   *
   * @param probability - Base probability (0-1)
   * @param shifts - Array of hook shifts to apply
   * @returns Adjusted probability (0.01-0.99)
   */
  applyHooks(probability: number, shifts: HookShift[]): number {
    if (shifts.length === 0) return probability;

    const totalShift = shifts.reduce((sum, s) => sum + s.logOddsShift, 0);
    const clampedShift = Math.max(
      -MAX_TOTAL_SHIFT,
      Math.min(MAX_TOTAL_SHIFT, totalShift),
    );

    if (clampedShift !== totalShift) {
      this.logger.warn(
        `Hook shift clamped: raw=${totalShift.toFixed(3)}, clamped=${clampedShift.toFixed(3)}, ` +
          `hooks=[${shifts.map((s) => `${s.hookType}:${s.logOddsShift}`).join(', ')}]`,
      );
    }

    const adjusted = adjustInLogOdds(probability, clampedShift);
    return Math.max(0.01, Math.min(0.99, adjusted));
  }

  // ============================================
  // Private helpers
  // ============================================

  private isChineseApplicant(profile: ProfileInput): boolean {
    if (!profile.nationality) return false;
    return CHINA_CODES.has(profile.nationality.toUpperCase());
  }

  private getChineseApplicantMultiplier(selectivity: number): number {
    for (const tier of CHINESE_APPLICANT_MULTIPLIER) {
      if (selectivity > tier.threshold) {
        return tier.multiplier;
      }
    }
    return 1.0;
  }
}
