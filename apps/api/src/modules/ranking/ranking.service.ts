import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolService } from '../school/school.service';
import { CustomRanking, School } from '@prisma/client';

export interface RankingWeights {
  usNewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
}

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

    // Validate weights - ensure they are numbers
    const validWeights: RankingWeights = {
      usNewsRank: Number(weights.usNewsRank) || 0,
      acceptanceRate: Number(weights.acceptanceRate) || 0,
      tuition: Number(weights.tuition) || 0,
      avgSalary: Number(weights.avgSalary) || 0,
    };

    // Normalize weights to sum to 100
    const totalWeight = Object.values(validWeights).reduce(
      (sum, w) => sum + w,
      0,
    );

    // If no weights, return schools with zero scores
    if (totalWeight === 0) {
      return schools.map((school, index) => ({
        ...school,
        score: 0,
        rank: index + 1,
      }));
    }

    const normalizedWeights: RankingWeights = {
      usNewsRank: (validWeights.usNewsRank / totalWeight) * 100,
      acceptanceRate: (validWeights.acceptanceRate / totalWeight) * 100,
      tuition: (validWeights.tuition / totalWeight) * 100,
      avgSalary: (validWeights.avgSalary / totalWeight) * 100,
    };

    // Get min/max for normalization
    const stats = this.calculateStats(schools);

    // Calculate scores
    const scoredSchools = schools.map((school) => ({
      ...school,
      score: this.calculateScore(school, normalizedWeights, stats),
      rank: 0,
    }));

    // Rescale scores to 0-100 (top school = 100)
    const maxScore = Math.max(...scoredSchools.map((s) => s.score));
    if (maxScore > 0) {
      scoredSchools.forEach((school) => {
        school.score = (school.score / maxScore) * 100;
      });
    }

    // Sort by score (higher is better)
    scoredSchools.sort((a, b) => b.score - a.score);

    // Assign ranks
    scoredSchools.forEach((school, index) => {
      school.rank = index + 1;
    });

    return scoredSchools;
  }

  private calculateStats(schools: School[]) {
    const usNewsRanks = schools
      .map((s) => s.usNewsRank)
      .filter((r): r is number => r !== null);
    const acceptanceRates = schools
      .map((s) => s.acceptanceRate)
      .filter((r): r is Prisma.Decimal => r !== null)
      .map((r) => Number(r));
    const tuitions = schools
      .map((s) => s.tuition)
      .filter((t): t is number => t !== null);
    const salaries = schools
      .map((s) => s.avgSalary)
      .filter((s): s is number => s !== null);

    // Helper function to safely get min/max, defaulting to 0 for empty arrays
    const safeMinMax = (arr: number[]) => ({
      min: arr.length > 0 ? Math.min(...arr) : 0,
      max: arr.length > 0 ? Math.max(...arr) : 0,
    });

    return {
      usNewsRank: safeMinMax(usNewsRanks),
      acceptanceRate: safeMinMax(acceptanceRates),
      tuition: safeMinMax(tuitions),
      avgSalary: safeMinMax(salaries),
    };
  }

  private calculateScore(
    school: School,
    weights: RankingWeights,
    stats: ReturnType<typeof this.calculateStats>,
  ): number {
    let score = 0;

    // US News Rank (lower is better, so invert)
    if (school.usNewsRank !== null) {
      const normalized =
        1 -
        (school.usNewsRank - stats.usNewsRank.min) /
          (stats.usNewsRank.max - stats.usNewsRank.min || 1);
      score += normalized * weights.usNewsRank;
    }

    // Acceptance Rate (lower is better in this context - more selective)
    if (school.acceptanceRate !== null) {
      const rate = Number(school.acceptanceRate);
      const normalized =
        1 -
        (rate - stats.acceptanceRate.min) /
          (stats.acceptanceRate.max - stats.acceptanceRate.min || 1);
      score += normalized * weights.acceptanceRate;
    }

    // Tuition (lower is better)
    if (school.tuition !== null) {
      const normalized =
        1 -
        (school.tuition - stats.tuition.min) /
          (stats.tuition.max - stats.tuition.min || 1);
      score += normalized * weights.tuition;
    }

    // Salary (higher is better)
    if (school.avgSalary !== null) {
      const normalized =
        (school.avgSalary - stats.avgSalary.min) /
        (stats.avgSalary.max - stats.avgSalary.min || 1);
      score += normalized * weights.avgSalary;
    }

    return score;
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

// Import Prisma namespace for Decimal type
import { Prisma } from '@prisma/client';
