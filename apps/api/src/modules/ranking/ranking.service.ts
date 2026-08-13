import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolService } from '../school/school.service';
import { CustomRanking, School } from '@prisma/client';
import { clampPercentRate } from '../../common/utils/percent.util';
import { scoreAndRankSchools, type RankingWeights } from './ranking-score.util';
import { toJsonInput } from '../resume/resume-content.helpers';

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
        weights: toJsonInput(weights),
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

  /**
   * A ranking served to someone other than its owner must not carry `userId`.
   *
   * `CustomRanking.userId` is the value `GET /forum/posts` publishes as
   * `author.id` beside `profile.realName` — both unauthenticated — so shipping
   * it on a `@Public()` route hands over the join key that links a published
   * ranking back to a named person. 52ebf249 fixed *who* may read these rows;
   * this fixes *what* the row says about its author. Nothing renders a
   * ranking's owner on either client.
   *
   * The owner keeps it, and findById needs the column for its own ownership
   * check — so this strips on the way out rather than narrowing the query.
   */
  private stripOwner(ranking: CustomRanking, viewerId?: string): CustomRanking {
    if (viewerId && ranking.userId === viewerId) return ranking;
    const { userId: _userId, ...rest } = ranking;
    return rest as CustomRanking;
  }

  // Get public rankings
  async getPublicRankings(): Promise<CustomRanking[]> {
    // governance: public-feed — filters `isPublic: true`. CustomRanking.isPublic defaults to FALSE, so this filter is the whole access control — findById() beside it lacked the equivalent check and served every private ranking on a @Public() route until 52ebf249
    const rankings = await this.prisma.customRanking.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    // No viewer is threaded here: this list is public by definition, so the
    // owner id comes off every row.
    return rankings.map((r) => this.stripOwner(r));
  }

  /**
   * `viewerId` — who is asking. Omitted means an anonymous caller.
   *
   * GET /rankings/:id is @Public(), and this had no visibility check at all,
   * so anyone with an id could read any ranking. `CustomRanking.isPublic`
   * defaults to **false**, so that was every ranking anyone had ever saved,
   * not an unlucky few — while getPublicRankings() right above filters on
   * `isPublic: true`.
   *
   * 404 rather than 403 for a private ranking: the response must not confirm
   * that an id exists.
   */
  async findById(id: string, viewerId?: string): Promise<CustomRanking> {
    const ranking = await this.prisma.customRanking.findUnique({
      where: { id },
    });

    if (!ranking) {
      throw new NotFoundException('Ranking not found');
    }

    if (!ranking.isPublic && ranking.userId !== viewerId) {
      throw new NotFoundException('Ranking not found');
    }

    return this.stripOwner(ranking, viewerId);
  }

  async deleteRanking(id: string, userId: string): Promise<void> {
    // Ownership belongs in the WHERE, not in a comparison against a field the
    // reader may have removed. This used to call findById and then check
    // `ranking.userId !== userId` — and once findById started stripping the
    // owner id for everyone but the owner, that comparison was reading
    // `undefined` for a non-owner deleting a PUBLIC ranking. It failed closed,
    // but by accident, and the only test covering the branch used a PRIVATE
    // fixture that 404s earlier, so nothing was watching.
    const { count } = await this.prisma.customRanking.deleteMany({
      where: { id, userId },
    });

    // Nothing matched: no such id, or not this caller's row. 404 either way —
    // a delete must not confirm that someone else's ranking exists.
    if (count === 0) {
      throw new NotFoundException('Ranking not found');
    }
  }
}
