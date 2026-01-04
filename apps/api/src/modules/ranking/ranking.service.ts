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
    private schoolService: SchoolService
  ) {}

  // Calculate custom ranking based on weights
  async calculateRanking(weights: RankingWeights): Promise<RankedSchool[]> {
    const schools = await this.schoolService.findAllWithMetrics();

    // Normalize weights to sum to 100
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    const normalizedWeights: RankingWeights = {
      usNewsRank: (weights.usNewsRank / totalWeight) * 100,
      acceptanceRate: (weights.acceptanceRate / totalWeight) * 100,
      tuition: (weights.tuition / totalWeight) * 100,
      avgSalary: (weights.avgSalary / totalWeight) * 100,
    };

    // Get min/max for normalization
    const stats = this.calculateStats(schools);

    // Calculate scores
    const scoredSchools = schools.map((school) => ({
      ...school,
      score: this.calculateScore(school, normalizedWeights, stats),
      rank: 0,
    }));

    // Sort by score (higher is better)
    scoredSchools.sort((a, b) => b.score - a.score);

    // Assign ranks
    scoredSchools.forEach((school, index) => {
      school.rank = index + 1;
    });

    return scoredSchools;
  }

  private calculateStats(schools: School[]) {
    const usNewsRanks = schools.map((s) => s.usNewsRank).filter((r): r is number => r !== null);
    const acceptanceRates = schools.map((s) => s.acceptanceRate).filter((r): r is Prisma.Decimal => r !== null).map(r => Number(r));
    const tuitions = schools.map((s) => s.tuition).filter((t): t is number => t !== null);
    const salaries = schools.map((s) => s.avgSalary).filter((s): s is number => s !== null);

    return {
      usNewsRank: { min: Math.min(...usNewsRanks), max: Math.max(...usNewsRanks) },
      acceptanceRate: { min: Math.min(...acceptanceRates), max: Math.max(...acceptanceRates) },
      tuition: { min: Math.min(...tuitions), max: Math.max(...tuitions) },
      avgSalary: { min: Math.min(...salaries), max: Math.max(...salaries) },
    };
  }

  private calculateScore(
    school: School,
    weights: RankingWeights,
    stats: ReturnType<typeof this.calculateStats>
  ): number {
    let score = 0;

    // US News Rank (lower is better, so invert)
    if (school.usNewsRank !== null) {
      const normalized = 1 - (school.usNewsRank - stats.usNewsRank.min) / (stats.usNewsRank.max - stats.usNewsRank.min || 1);
      score += normalized * weights.usNewsRank;
    }

    // Acceptance Rate (lower is better in this context - more selective)
    if (school.acceptanceRate !== null) {
      const rate = Number(school.acceptanceRate);
      const normalized = 1 - (rate - stats.acceptanceRate.min) / (stats.acceptanceRate.max - stats.acceptanceRate.min || 1);
      score += normalized * weights.acceptanceRate;
    }

    // Tuition (lower is better)
    if (school.tuition !== null) {
      const normalized = 1 - (school.tuition - stats.tuition.min) / (stats.tuition.max - stats.tuition.min || 1);
      score += normalized * weights.tuition;
    }

    // Salary (higher is better)
    if (school.avgSalary !== null) {
      const normalized = (school.avgSalary - stats.avgSalary.min) / (stats.avgSalary.max - stats.avgSalary.min || 1);
      score += normalized * weights.avgSalary;
    }

    return score;
  }

  // Save custom ranking
  async saveRanking(userId: string, name: string, weights: RankingWeights, isPublic: boolean): Promise<CustomRanking> {
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

