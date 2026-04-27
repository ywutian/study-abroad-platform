import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ProfileInput, SchoolInput } from '../prediction.prompts';
import type {
  CounselorTier,
  EncodedDimension,
} from './counselor-engine.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async resolveAnchor(
    profile: ProfileInput,
    school: SchoolInput & { acceptanceRate?: number | null },
  ): Promise<AnchorResolution> {
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
      const hasSatBands = school.sat25 != null && school.sat75 != null;
      const source = hasSatBands
        ? 'scorecard (acceptanceRate + SAT bands)'
        : 'scorecard (acceptanceRate only)';
      return {
        anchor: overall,
        tier: hasSatBands ? 2 : 3,
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
    const gpaBand = this.gpaToBand(profile.gpa, profile.gpaScale);
    if (!gpaBand) return null;

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

    for (const candidate of candidates) {
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
      const encoded: Set<EncodedDimension> = new Set(['gpa']);
      if (candidate.testType !== 'GPA_ONLY') encoded.add('test');
      return { admitRate: rate, encodedDimensions: encoded };
    }
    return null;
  }

  private gpaToBand(
    gpa: number | undefined,
    gpaScale: number | undefined,
  ): string | null {
    if (gpa == null || !Number.isFinite(gpa)) return null;
    const scale = gpaScale && gpaScale > 0 ? gpaScale : 4.0;
    const gpa4 = (gpa / scale) * 4.0;
    if (gpa4 >= 3.75) return '3.75-4.00';
    if (gpa4 >= 3.5) return '3.50-3.74';
    if (gpa4 >= 3.25) return '3.25-3.49';
    if (gpa4 >= 3) return '3.00-3.24';
    return '<3.00';
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
}
