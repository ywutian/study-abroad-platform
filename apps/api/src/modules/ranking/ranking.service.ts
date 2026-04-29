import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolService } from '../school/school.service';
import { CustomRanking, School } from '@prisma/client';
import { clampPercentRate } from '../../common/utils/percent.util';
import { scoreAndRankSchools, type RankingWeights } from './ranking-score.util';

export type { RankingWeights } from './ranking-score.util';

export interface RankedSchool extends School {
  score: number;
  rank: number;
}

@Injectable()
export class RankingService {
  constructor(
    private prisma: PrismaService,
    private schoolService: SchoolService,
  ) {}

  // Calculate custom ranking based on weights
  async calculateRanking(weights: RankingWeights): Promise<RankedSchool[]> {
    const schools = await this.schoolService.findAllWithMetrics();

    const displaySchools = schools.map((school) => ({
      ...school,
      acceptanceRate: (clampPercentRate(school.acceptanceRate) ??
        school.acceptanceRate) as typeof school.acceptanceRate,
      graduationRate: (clampPercentRate(school.graduationRate) ??
        school.graduationRate) as typeof school.graduationRate,
    }));

    return scoreAndRankSchools(displaySchools, weights);
  }

  // Save custom ranking
  async saveRanking(
    userId: string,
    name: string,
    weights: RankingWeights,
    isPublic: boolean,
  ): Promise<CustomRanking> {
    return this.prisma.customRanking.create({
      data: {
        userId,
        name,
        weights: weights as object,
        isPublic,
      },
    });
  }

  // Get user's saved rankings
  async getUserRankings(userId: string): Promise<CustomRanking[]> {
    return this.prisma.customRanking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get public rankings
  async getPublicRankings(): Promise<CustomRanking[]> {
    return this.prisma.customRanking.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findById(id: string): Promise<CustomRanking> {
    const ranking = await this.prisma.customRanking.findUnique({
      where: { id },
    });

    if (!ranking) {
      throw new NotFoundException('Ranking not found');
    }

    return ranking;
  }

  async deleteRanking(id: string, userId: string): Promise<void> {
    const ranking = await this.findById(id);

    if (ranking.userId !== userId) {
      throw new NotFoundException('Ranking not found');
    }

    await this.prisma.customRanking.delete({
      where: { id },
    });
  }
}
