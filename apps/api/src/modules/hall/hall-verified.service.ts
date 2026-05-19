import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, AdmissionResult, Visibility } from '@prisma/client';
import { VERIFIED_CASE_WHERE } from './hall.constants';
import {
  VerifiedRankingQueryDto,
  VerifiedRankingResponseDto,
  VerifiedUserDto,
  RankingFilter,
} from './dto';

@Injectable()
export class HallVerifiedService {
  private readonly IVY_PLUS_SCHOOLS = [
    'Harvard University',
    'Yale University',
    'Princeton University',
    'Columbia University',
    'University of Pennsylvania',
    'Brown University',
    'Dartmouth College',
    'Cornell University',
    'Stanford University',
    'MIT',
    'Massachusetts Institute of Technology',
    'Duke University',
    'University of Chicago',
  ];

  /**
   * The PUBLIC verified-case filter = the shared {@link VERIFIED_CASE_WHERE}
   * trust predicate (C4: one source of truth) + a `visibility` narrowing.
   *
   * 2026-05 Hall Plan C (security B4): `getVerifiedRanking` is `@Public()`,
   * so it must NEVER include PRIVATE-visibility cases — only ANONYMOUS /
   * VERIFIED_ONLY. Previously the queries filtered `isVerified` + review
   * status but had no `visibility` filter, leaking private cases to
   * logged-out visitors.
   */
  private readonly PUBLIC_CASE_WHERE = {
    ...VERIFIED_CASE_WHERE,
    visibility: { in: [Visibility.ANONYMOUS, Visibility.VERIFIED_ONLY] },
  } satisfies Prisma.AdmissionCaseWhereInput;

  constructor(private prisma: PrismaService) {}

  async getVerifiedRanking(
    query: VerifiedRankingQueryDto,
  ): Promise<VerifiedRankingResponseDto> {
    const {
      filter = RankingFilter.ALL,
      year,
      schoolId,
      limit = 50,
      offset = 0,
    } = query;

    const where: Prisma.AdmissionCaseWhereInput = { ...this.PUBLIC_CASE_WHERE };

    if (year) {
      where.year = year;
    }

    if (schoolId) {
      where.schoolId = schoolId;
    }

    if (filter === RankingFilter.ADMITTED) {
      where.result = AdmissionResult.ADMITTED;
    }

    if (filter === RankingFilter.TOP20) {
      where.school = {
        usNewsRank: { lte: 20 },
      };
    }

    if (filter === RankingFilter.IVY) {
      where.school = {
        name: { in: this.IVY_PLUS_SCHOOLS },
      };
    }

    const [cases, total] = await Promise.all([
      this.prisma.admissionCase.findMany({
        where,
        // 2026-05 Hall Plan C (security B4): `realName` is NOT selected —
        // this is a `@Public()` endpoint; the user is shown as a masked
        // label only. Never join applicant identity onto a public surface.
        include: {
          school: true,
          user: { select: { id: true } },
        },
        orderBy: [{ school: { usNewsRank: 'asc' } }, { verifiedAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.admissionCase.count({ where }),
    ]);

    const stats = await this.getVerifiedStats();

    const users: VerifiedUserDto[] = cases.map((c, index) => ({
      rank: offset + index + 1,
      caseId: c.id,
      userId: c.userId,
      // 2026-05 Hall Plan C (security B4): masked label, never realName.
      userName: `用户${c.userId.slice(-4)}`,
      gpaRange: c.gpaRange || undefined,
      satRange: c.satRange || undefined,
      actRange: c.actRange || undefined,
      toeflRange: c.toeflRange || undefined,
      schoolName: c.school.name,
      schoolNameZh: c.school.nameZh || undefined,
      schoolRank: c.school.usNewsRank || undefined,
      result: c.result,
      year: c.year,
      round: c.round || undefined,
      major: c.major || undefined,
      isVerified: c.isVerified,
      verifiedAt: c.verifiedAt || undefined,
    }));

    return {
      users,
      stats,
      total,
      hasMore: offset + limit < total,
    };
  }

  private async getVerifiedStats() {
    const [totalVerified, totalAdmitted, topSchoolsCount, ivyCount] =
      await Promise.all([
        this.prisma.admissionCase.count({
          where: { ...this.PUBLIC_CASE_WHERE },
        }),
        this.prisma.admissionCase.count({
          where: {
            ...this.PUBLIC_CASE_WHERE,
            result: AdmissionResult.ADMITTED,
          },
        }),
        this.prisma.admissionCase.count({
          where: {
            ...this.PUBLIC_CASE_WHERE,
            result: AdmissionResult.ADMITTED,
            school: { usNewsRank: { lte: 20 } },
          },
        }),
        this.prisma.admissionCase.count({
          where: {
            ...this.PUBLIC_CASE_WHERE,
            result: AdmissionResult.ADMITTED,
            school: { name: { in: this.IVY_PLUS_SCHOOLS } },
          },
        }),
      ]);

    return {
      totalVerified,
      totalAdmitted,
      topSchoolsCount,
      ivyCount,
    };
  }

  async getAvailableYears(): Promise<number[]> {
    const cases = await this.prisma.admissionCase.findMany({
      // Use PUBLIC_CASE_WHERE (not the bare VERIFIED_CASE_WHERE) so the
      // visibility narrowing applies — a PRIVATE-only year must never
      // surface in the public year filter.
      where: { ...this.PUBLIC_CASE_WHERE },
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    });

    return cases.map((c) => c.year);
  }
}
