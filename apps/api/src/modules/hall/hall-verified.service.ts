import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, AdmissionResult } from '@prisma/client';
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

    const where: Prisma.AdmissionCaseWhereInput = {
      isVerified: true,
    };

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
        include: {
          school: true,
          user: {
            select: {
              id: true,
              profile: {
                select: {
                  realName: true,
                },
              },
            },
          },
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
      userName: c.user.profile?.realName || `用户${c.userId.slice(-4)}`,
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
        this.prisma.admissionCase.count({ where: { isVerified: true } }),
        this.prisma.admissionCase.count({
          where: { isVerified: true, result: AdmissionResult.ADMITTED },
        }),
        this.prisma.admissionCase.count({
          where: {
            isVerified: true,
            result: AdmissionResult.ADMITTED,
            school: { usNewsRank: { lte: 20 } },
          },
        }),
        this.prisma.admissionCase.count({
          where: {
            isVerified: true,
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
      where: { isVerified: true },
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    });

    return cases.map((c) => c.year);
  }
}
