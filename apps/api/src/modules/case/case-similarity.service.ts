import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CASE_REVIEW_APPROVED_WHERE } from '../../common/constants/prisma-selects';
import { parseCaseActivities } from '../../common/constants/data-formats';
import {
  MIN_SIMILAR_CASES,
  SimilarCaseDto,
  SimilarCasesResponseDto,
} from './dto/similar-cases-response.dto';

/** GPA window (4.0 scale) used to match "similar" applicants. */
const GPA_WINDOW = 0.3;

type SimilarCaseRow = Prisma.AdmissionCaseGetPayload<{
  include: { school: { select: { name: true; nameZh: true } } };
}>;

/**
 * Finds real admission cases with a profile similar to a given user — the
 * data source behind the prediction page's "students like you" comparison.
 *
 * Matching is deliberately rule-based and conservative (GPA ±0.3, major
 * substring, nationality-preferred). It NEVER widens the match to manufacture
 * results: when fewer than `MIN_SIMILAR_CASES` cases match, the response is
 * flagged `INSUFFICIENT_DATA` so the UI states the count honestly instead of
 * drawing a conclusion from a tiny sample.
 */
@Injectable()
export class CaseSimilarityService {
  private readonly logger = new Logger(CaseSimilarityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findSimilar(
    userId: string,
    query: { schoolId?: string; limit?: number },
    locale: string = 'zh',
  ): Promise<SimilarCasesResponseDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        gpa: true,
        gpaScale: true,
        targetMajor: true,
        nationality: true,
      },
    });

    if (!profile) {
      throw new BadRequestException(
        'Profile not found — please complete your profile first.',
      );
    }

    const take = Math.min(Math.max(query.limit ?? 10, 1), 20);
    const gpa = profile.gpa != null ? Number(profile.gpa) : null;
    const gpaScale = Number(profile.gpaScale) || 4.0;

    // Base filter: only public, approved cases.
    const where: Prisma.AdmissionCaseWhereInput = {
      visibility: { in: ['ANONYMOUS', 'PUBLIC'] },
      reviewStatus: CASE_REVIEW_APPROVED_WHERE.reviewStatus,
    };

    // GPA band match (string `gpaRange` like "3.7-3.9" — crude contains match,
    // intentionally NOT widened beyond ±0.3).
    if (gpa != null && !Number.isNaN(gpa)) {
      const low = Math.max(0, gpa - GPA_WINDOW).toFixed(1);
      const high = Math.min(gpaScale, gpa + GPA_WINDOW).toFixed(1);
      where.OR = [
        { gpaRange: { contains: low, mode: 'insensitive' } },
        { gpaRange: { contains: high, mode: 'insensitive' } },
      ];
    }

    if (profile.targetMajor) {
      where.major = { contains: profile.targetMajor, mode: 'insensitive' };
    }

    if (query.schoolId) {
      where.schoolId = query.schoolId;
    }

    let rows: SimilarCaseRow[];
    let nationalityMatched = false;

    try {
      if (profile.nationality) {
        const sameNationality = await this.prisma.admissionCase.findMany({
          where: {
            ...where,
            nationality: { equals: profile.nationality, mode: 'insensitive' },
          },
          take,
          orderBy: { createdAt: 'desc' },
          include: { school: { select: { name: true, nameZh: true } } },
        });

        if (sameNationality.length >= take) {
          rows = sameNationality;
          nationalityMatched = true;
        } else {
          // Top up with cross-nationality cases — flagged so the UI can caveat.
          const fallback = await this.prisma.admissionCase.findMany({
            where: {
              ...where,
              id: { notIn: sameNationality.map((c) => c.id) },
            },
            take: take - sameNationality.length,
            orderBy: { createdAt: 'desc' },
            include: { school: { select: { name: true, nameZh: true } } },
          });
          rows = [...sameNationality, ...fallback];
          nationalityMatched =
            fallback.length === 0 && sameNationality.length > 0;
        }
      } else {
        rows = await this.prisma.admissionCase.findMany({
          where,
          take,
          orderBy: { createdAt: 'desc' },
          include: { school: { select: { name: true, nameZh: true } } },
        });
      }
    } catch (error) {
      this.logger.error('Failed to query similar cases', error);
      rows = [];
    }

    const cases: SimilarCaseDto[] = rows.map((c) => ({
      id: c.id,
      school:
        locale === 'zh'
          ? c.school?.nameZh || c.school?.name || ''
          : c.school?.name || '',
      year: c.year ?? undefined,
      round: c.round ?? undefined,
      result: c.result,
      gpaRange: c.gpaRange ?? undefined,
      satRange: c.satRange ?? undefined,
      major: c.major ?? undefined,
      tags: c.tags ?? [],
      demographicTags: c.demographicTags ?? [],
      nationality: c.nationality ?? undefined,
      activitySummary: parseCaseActivities(c.activities)
        .map((a) => a.description)
        .filter(Boolean)
        .slice(0, 4)
        .join(' · '),
    }));

    const breakdown = {
      admitted: cases.filter((c) => c.result === 'ADMITTED').length,
      rejected: cases.filter((c) => c.result === 'REJECTED').length,
      waitlisted: cases.filter((c) => c.result === 'WAITLISTED').length,
    };

    return {
      status: cases.length >= MIN_SIMILAR_CASES ? 'OK' : 'INSUFFICIENT_DATA',
      count: cases.length,
      minRequired: MIN_SIMILAR_CASES,
      nationalityMatched,
      matchCriteria: {
        gpa: gpa ?? undefined,
        targetMajor: profile.targetMajor ?? undefined,
        nationality: profile.nationality ?? undefined,
        schoolFilter: query.schoolId,
      },
      breakdown,
      cases,
    };
  }
}
