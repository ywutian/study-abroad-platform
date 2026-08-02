import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ProfileInput, SchoolInput } from '../prediction.prompts';
import type {
  CounselorTier,
  EncodedDimension,
} from './counselor-engine.service';
import {
  hasBandComparableScore,
  isPlaceholderSatBand,
} from './counselor-modifiers';

export interface AnchorResolution {
  anchor: number;
  tier: CounselorTier;
  anchorSource: string;
  encodedDimensions: ReadonlySet<EncodedDimension>;
  insufficientData?: { reason: string };
  sourceContributions: Array<{
    source: string;
    value: number | null;
    role: 'anchor';
    detail: string;
  }>;
}

@Injectable()
export class AnchorResolverService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveAnchor(
    profile: ProfileInput,
    school: SchoolInput & {
      acceptanceRate?: number | null;
      institutionType?: string | null;
    },
  ): Promise<AnchorResolution> {
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

    const cdsBand = await this.lookupCdsBand(profile, school);
    if (cdsBand != null) {
      return {
        anchor: cdsBand.admitRate,
        tier: 1,
        anchorSource: 'cds-bands-v1',
        encodedDimensions: cdsBand.encodedDimensions,
        sourceContributions: [
          {
            source: 'cds-bands-v1',
            value: cdsBand.admitRate,
            role: 'anchor',
            detail:
              'School-published CDS admit band matched the applicant GPA/test cell.',
          },
        ],
      };
    }

    const overall = this.normalizeAcceptanceRate(school.acceptanceRate);
    if (overall != null) {
      // Tier drives confidence, and confidence drives interval width
      // (`deriveCounselorConfidence` → `LOGIT_HALF_WIDTH`): tier ≤2 can reach
      // `medium` (±0.55 logit), tier 3 is pinned to `low` (±0.85). It never
      // touches the anchor value — that is `acceptanceRate`, full stop.
      //
      // So tier 2 is a claim that the engine had a usable test signal for THIS
      // applicant. Two ways it used to be claimed falsely (2026-07-24 audit):
      //   1. a placeholder band counted as a band, while every band modifier
      //      rejected it and returned neutral;
      //   2. the school having a band was enough, even when the applicant
      //      submitted no comparable score — so a no-score applicant got the
      //      narrower interval off a band the engine never read.
      // Both are the same failure: claiming more certainty than we have. Widen
      // the interval instead. Point estimates are untouched.
      //
      // "Comparable" comes from `hasBandComparableScore`, not a local list —
      // it must stay identical to what `testBandMultiplier` actually consumes.
      // Hardcoding SAT|ACT here (the first cut) wrongly demoted IB / A-Level /
      // Gaokao applicants, whose scores DO get converted to an SAT-equivalent
      // and compared against the band.
      const schoolBandUsable =
        school.sat25 != null &&
        school.sat75 != null &&
        !isPlaceholderSatBand(school.sat25, school.sat75);
      const bandInformsThisApplicant =
        schoolBandUsable && hasBandComparableScore(profile.testScores);

      // This string is rendered to users verbatim inside `sourceSummary` and
      // `factors[0].detail`, so it stays short and free of internal jargon.
      // The old 'scorecard (acceptanceRate + SAT bands)' read as though the
      // bands fed the anchor — they never did.
      const source = bandInformsThisApplicant
        ? 'scorecard admit rate, test bands applied'
        : 'scorecard admit rate only';
      return {
        anchor: overall,
        tier: bandInformsThisApplicant ? 2 : 3,
        anchorSource: source,
        encodedDimensions: new Set(),
        sourceContributions: [
          {
            source,
            value: overall,
            role: 'anchor',
            detail:
              'Fallback school-wide admit rate used because no matching CDS band cell was available.',
          },
        ],
      };
    }

    return {
      anchor: 0,
      tier: 4,
      anchorSource: 'none',
      encodedDimensions: new Set(),
      insufficientData: {
        reason:
          'school_missing_acceptance_rate: no acceptanceRate or CDS band data available for this school',
      },
      sourceContributions: [
        {
          source: 'none',
          value: null,
          role: 'anchor',
          detail:
            'No usable CDS band or school-wide acceptance rate was available.',
        },
      ],
    };
  }

  private async lookupCdsBand(
    profile: ProfileInput,
    school: SchoolInput,
  ): Promise<{
    admitRate: number;
    encodedDimensions: ReadonlySet<EncodedDimension>;
  } | null> {
    const gpaBands = this.gpaToBands(profile.gpa, profile.gpaScale);
    if (!gpaBands.length) return null;

    const candidates: Array<{ testType: string; testBand: string }> = [];
    const sat = profile.testScores?.find((t) => t.type === 'SAT')?.score;
    if (sat != null) {
      const satBand = this.satToBand(sat);
      if (satBand) candidates.push({ testType: 'SAT', testBand: satBand });
    }
    const act = profile.testScores?.find((t) => t.type === 'ACT')?.score;
    if (act != null) {
      const actBand = this.actToBand(act);
      if (actBand) candidates.push({ testType: 'ACT', testBand: actBand });
    }
    candidates.push({ testType: 'GPA_ONLY', testBand: 'ANY' });

    for (const gpaBand of gpaBands) {
      for (const candidate of candidates) {
        // governance: system-scope — SchoolCdsAdmitBand — published admit-rate bands keyed by school
        const row = await this.prisma.schoolCdsAdmitBand.findFirst({
          where: {
            schoolId: school.id,
            gpaBand,
            testType: candidate.testType,
            testBand: candidate.testBand,
          },
          orderBy: [{ cycleYear: 'desc' }, { updatedAt: 'desc' }],
          select: { admitRate: true },
        });
        if (!row) continue;
        let rate = row.admitRate.toNumber();
        if (rate >= 1) rate = rate / 100;
        if (rate <= 0 || rate >= 1) continue;
        // Isotonic floor: a strictly-higher GPA band must never serve a LOWER
        // anchor than a lower band in the same (testType, testBand) ladder.
        rate = await this.isotonicBandRate(
          school.id,
          candidate.testType,
          candidate.testBand,
          gpaBand,
          rate,
        );
        const encoded: Set<EncodedDimension> = new Set(['gpa']);
        if (candidate.testType !== 'GPA_ONLY') encoded.add('test');
        return { admitRate: rate, encodedDimensions: encoded };
      }
    }
    return null;
  }

  /**
   * Isotonic (monotonic) floor for the by-GPA CDS band ladder. A strictly-HIGHER
   * GPA band must never serve a LOWER anchor than a lower GPA band in the same
   * (testType, testBand) ladder. Hand-estimated CDS ladders can dip at the top
   * (e.g. UC Merced GPA_ONLY: 3.50-3.74 = 92% but 3.75-4.00 = 88%), which would
   * make a 3.8-GPA applicant score BELOW a 3.7 — a visible, trust-eroding
   * non-monotonicity (caught by the 2026-06 invariant audit). We clamp the
   * matched band's rate UP to the running max over all strictly-lower GPA bands
   * in the same ladder. This only ever RAISES the served rate and never lowers
   * one, so it cannot push a prediction above the school's own published
   * top-band ceiling. Bands are only comparable WITHIN a family (standard 4.0 vs
   * UC-weighted) and WITHIN a fixed testBand (we never mix SAT bands).
   */
  private async isotonicBandRate(
    schoolId: string,
    testType: string,
    testBand: string,
    matchedBand: string,
    matchedRate: number,
  ): Promise<number> {
    const LADDERS = [
      ['<3.00', '3.00-3.24', '3.25-3.49', '3.50-3.74', '3.75-4.00'],
      ['<3.60', '3.60-3.79', '3.80-3.99', '4.00-4.19', '4.20-4.40'],
    ];
    const family = LADDERS.find((l) => l.includes(matchedBand));
    if (!family) return matchedRate;
    const lowerBands = family.slice(0, family.indexOf(matchedBand));
    if (lowerBands.length === 0) return matchedRate;

    // governance: system-scope — SchoolCdsAdmitBand — published admit-rate bands keyed by school
    const rows = await this.prisma.schoolCdsAdmitBand.findMany({
      where: { schoolId, testType, testBand, gpaBand: { in: lowerBands } },
      orderBy: [{ cycleYear: 'desc' }, { updatedAt: 'desc' }],
      select: { gpaBand: true, admitRate: true },
    });
    const seen = new Set<string>();
    let max = matchedRate;
    for (const r of rows) {
      if (seen.has(r.gpaBand)) continue; // first row per band = latest cycle
      seen.add(r.gpaBand);
      let rate = r.admitRate.toNumber();
      if (rate >= 1) rate = rate / 100;
      if (rate <= 0 || rate >= 1) continue;
      if (rate > max) max = rate;
    }
    return max;
  }

  private gpaToBands(
    gpa: number | undefined,
    gpaScale: number | undefined,
  ): string[] {
    if (gpa == null || !Number.isFinite(gpa)) return [];
    const scale = gpaScale && gpaScale > 0 ? gpaScale : 4.0;
    const bands: string[] = [];

    if (scale > 4.0) {
      if (gpa >= 4.2) bands.push('4.20-4.40');
      else if (gpa >= 4.0) bands.push('4.00-4.19');
      else if (gpa >= 3.8) bands.push('3.80-3.99');
      else if (gpa >= 3.6) bands.push('3.60-3.79');
      else bands.push('<3.60');
    }

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
