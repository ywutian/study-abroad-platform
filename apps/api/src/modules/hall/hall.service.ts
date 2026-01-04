import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Review, UserList, Prisma, Profile } from '@prisma/client';
import { PaginationDto, createPaginatedResponse, PaginatedResponseDto } from '../../common/dto/pagination.dto';

interface CreateReviewDto {
  profileUserId: string;
  academicScore: number;
  activityScore: number;
  essayScore: number;
  overallScore: number;
  comment?: string;
}

interface CreateUserListDto {
  title: string;
  description?: string;
  category?: string;
  items: unknown[];
  isPublic?: boolean;
}

export interface PublicProfileResponse {
  id: string;
  userId: string;
  grade?: string | null;
  gpa?: number;
  gpaScale?: number;
  targetMajor?: string | null;
  visibility: string;
  _count: {
    testScores: number;
    activities: number;
    awards: number;
  };
}

export interface RankingResult {
  schoolId: string;
  schoolName: string;
  totalApplicants: number;
  yourRank: number;
  percentile: number;
  breakdown: {
    gpa: number;
    activities: number;
    awards: number;
    testScores: number;
  };
}

@Injectable()
export class HallService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // Public Profiles (公开档案)
  // ============================================

  async getPublicProfiles(search?: string): Promise<{ data: PublicProfileResponse[] }> {
    const where: Prisma.ProfileWhereInput = {
      visibility: { in: ['ANONYMOUS', 'VERIFIED_ONLY'] },
    };

    if (search) {
      where.targetMajor = { contains: search, mode: 'insensitive' };
    }

    const profiles = await this.prisma.profile.findMany({
      where,
      select: {
        id: true,
        userId: true,
        grade: true,
        gpa: true,
        gpaScale: true,
        targetMajor: true,
        visibility: true,
        _count: {
          select: {
            testScores: true,
            activities: true,
            awards: true,
          },
        },
      },
      take: 50,
      orderBy: { updatedAt: 'desc' },
    });

    // Anonymize userId for ANONYMOUS profiles
    const result = profiles.map((p) => ({
      ...p,
      userId: p.visibility === 'ANONYMOUS' ? `anon-${p.id.slice(0, 8)}` : p.userId,
      gpa: p.gpa ? Number(p.gpa) : undefined,
      gpaScale: p.gpaScale ? Number(p.gpaScale) : undefined,
    }));

    return { data: result };
  }

  // ============================================
  // Batch Ranking (批量排名)
  // ============================================

  async getBatchRanking(userId: string, schoolIds: string[]): Promise<{ rankings: RankingResult[] }> {
    if (!schoolIds.length) {
      return { rankings: [] };
    }

    // Get schools info
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
    });

    // Get user's profile
    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: true,
        awards: true,
      },
    });

    if (!userProfile) {
      return { rankings: [] };
    }

    // Get all visible profiles
    const allProfiles = await this.prisma.profile.findMany({
      where: { visibility: { not: 'PRIVATE' } },
      include: {
        testScores: true,
        activities: true,
        awards: true,
      },
    });

    // Add user's profile if not included
    const profiles = allProfiles.find((p) => p.userId === userId)
      ? allProfiles
      : [...allProfiles, userProfile];

    // Calculate scores for all profiles
    const scoredProfiles = profiles.map((p) => ({
      userId: p.userId,
      score: this.calculateProfileScore(p),
      breakdown: this.calculateBreakdown(p),
    }));

    // Sort by score
    scoredProfiles.sort((a, b) => b.score - a.score);

    // Find user's rank and breakdown
    const userIndex = scoredProfiles.findIndex((p) => p.userId === userId);
    const userBreakdown = scoredProfiles[userIndex]?.breakdown || {
      gpa: 0,
      activities: 0,
      awards: 0,
      testScores: 0,
    };

    // Calculate percentile for each breakdown category
    const calculatePercentile = (category: keyof typeof userBreakdown) => {
      const sorted = [...scoredProfiles].sort((a, b) => b.breakdown[category] - a.breakdown[category]);
      const rank = sorted.findIndex((p) => p.userId === userId) + 1;
      return Math.round((1 - rank / sorted.length) * 100);
    };

    // Generate ranking for each school
    const rankings: RankingResult[] = schools.map((school) => ({
      schoolId: school.id,
      schoolName: school.nameZh || school.name,
      totalApplicants: profiles.length,
      yourRank: userIndex + 1,
      percentile: Math.round((1 - (userIndex + 1) / profiles.length) * 100),
      breakdown: {
        gpa: calculatePercentile('gpa'),
        activities: calculatePercentile('activities'),
        awards: calculatePercentile('awards'),
        testScores: calculatePercentile('testScores'),
      },
    }));

    return { rankings };
  }

  private calculateBreakdown(profile: any): { gpa: number; activities: number; awards: number; testScores: number } {
    const gpa = profile.gpa ? (Number(profile.gpa) / 4) * 100 : 0;
    
    const satScore = profile.testScores?.find((t: any) => t.type === 'SAT');
    const testScores = satScore ? (satScore.score / 1600) * 100 : 0;
    
    const activityCount = profile.activities?.length || 0;
    const activities = Math.min(activityCount * 20, 100);
    
    const awardCount = profile.awards?.length || 0;
    const awards = Math.min(awardCount * 33, 100);
    
    return { gpa, activities, awards, testScores };
  }

  // ============================================
  // Reviews (招生官打分)
  // ============================================

  async createReview(reviewerId: string, data: CreateReviewDto): Promise<Review> {
    // Can't review yourself
    if (reviewerId === data.profileUserId) {
      throw new BadRequestException('Cannot review yourself');
    }

    // Check if already reviewed
    const existing = await this.prisma.review.findUnique({
      where: {
        reviewerId_profileUserId: {
          reviewerId,
          profileUserId: data.profileUserId,
        },
      },
    });

    if (existing) {
      // Update existing review
      return this.prisma.review.update({
        where: { id: existing.id },
        data: {
          academicScore: data.academicScore,
          activityScore: data.activityScore,
          essayScore: data.essayScore,
          overallScore: data.overallScore,
          comment: data.comment,
        },
      });
    }

    return this.prisma.review.create({
      data: {
        reviewerId,
        profileUserId: data.profileUserId,
        academicScore: data.academicScore,
        activityScore: data.activityScore,
        essayScore: data.essayScore,
        overallScore: data.overallScore,
        comment: data.comment,
      },
    });
  }

  async getReviewsForUser(profileUserId: string): Promise<Review[]> {
    return this.prisma.review.findMany({
      where: { profileUserId },
      include: {
        reviewer: {
          select: { id: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyReviews(reviewerId: string): Promise<Review[]> {
    return this.prisma.review.findMany({
      where: { reviewerId },
      include: {
        profileUser: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAverageScores(profileUserId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { profileUserId },
    });

    if (reviews.length === 0) {
      return null;
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      academicScore: avg(reviews.map((r) => r.academicScore)),
      activityScore: avg(reviews.map((r) => r.activityScore)),
      essayScore: avg(reviews.map((r) => r.essayScore)),
      overallScore: avg(reviews.map((r) => r.overallScore)),
      reviewCount: reviews.length,
    };
  }

  // ============================================
  // Ranking (排名对比)
  // ============================================

  async getProfileRanking(userId: string, schoolId: string) {
    // Get all profiles that target this school and are visible
    const profiles = await this.prisma.profile.findMany({
      where: {
        visibility: { not: 'PRIVATE' },
      },
      include: {
        testScores: true,
        activities: true,
        awards: true,
      },
    });

    // Also get the requesting user's profile
    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: true,
        awards: true,
      },
    });

    if (!userProfile) {
      return { rank: null, total: profiles.length, message: 'Complete your profile first' };
    }

    // Calculate scores for all profiles (simplified scoring)
    const scoredProfiles = profiles.map((p) => ({
      userId: p.userId,
      score: this.calculateProfileScore(p),
    }));

    // Add user's score if not already included
    const userScore = this.calculateProfileScore(userProfile);
    if (!scoredProfiles.find((p) => p.userId === userId)) {
      scoredProfiles.push({ userId, score: userScore });
    }

    // Sort by score (higher is better)
    scoredProfiles.sort((a, b) => b.score - a.score);

    // Find user's rank
    const userRank = scoredProfiles.findIndex((p) => p.userId === userId) + 1;

    return {
      rank: userRank,
      total: scoredProfiles.length,
      percentile: Math.round((1 - userRank / scoredProfiles.length) * 100),
    };
  }

  private calculateProfileScore(profile: any): number {
    let score = 0;

    // GPA (max 40 points)
    if (profile.gpa) {
      score += (Number(profile.gpa) / 4) * 40;
    }

    // Test scores (max 30 points)
    const satScore = profile.testScores?.find((t: any) => t.type === 'SAT');
    if (satScore) {
      score += (satScore.score / 1600) * 30;
    }

    // Activities (max 15 points)
    const activityCount = profile.activities?.length || 0;
    score += Math.min(activityCount * 3, 15);

    // Awards (max 15 points)
    const awardCount = profile.awards?.length || 0;
    score += Math.min(awardCount * 5, 15);

    return score;
  }

  // ============================================
  // User Lists (用户创建榜单)
  // ============================================

  async createList(userId: string, data: CreateUserListDto): Promise<UserList> {
    return this.prisma.userList.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        category: data.category,
        items: data.items as object,
        isPublic: data.isPublic ?? true,
      },
    });
  }

  async updateList(listId: string, userId: string, data: Partial<CreateUserListDto>): Promise<UserList> {
    const list = await this.prisma.userList.findUnique({ where: { id: listId } });

    if (!list || list.userId !== userId) {
      throw new NotFoundException('List not found');
    }

    return this.prisma.userList.update({
      where: { id: listId },
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        items: data.items as object | undefined,
        isPublic: data.isPublic,
      },
    });
  }

  async deleteList(listId: string, userId: string): Promise<void> {
    const list = await this.prisma.userList.findUnique({ where: { id: listId } });

    if (!list || list.userId !== userId) {
      throw new NotFoundException('List not found');
    }

    await this.prisma.userList.delete({ where: { id: listId } });
  }

  async getPublicLists(pagination: PaginationDto, category?: string): Promise<PaginatedResponseDto<UserList>> {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserListWhereInput = { isPublic: true };
    if (category) {
      where.category = category;
    }

    const [lists, total] = await Promise.all([
      this.prisma.userList.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true } },
          _count: { select: { votes: true } },
        },
      }),
      this.prisma.userList.count({ where }),
    ]);

    return createPaginatedResponse(lists, total, page, pageSize);
  }

  async getMyLists(userId: string): Promise<UserList[]> {
    return this.prisma.userList.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { votes: true } },
      },
    });
  }

  async getListById(listId: string): Promise<UserList> {
    const list = await this.prisma.userList.findUnique({
      where: { id: listId },
      include: {
        user: { select: { id: true, email: true } },
        _count: { select: { votes: true } },
      },
    });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    return list;
  }

  async voteList(listId: string, userId: string, value: 1 | -1) {
    // Check if list exists and is public
    const list = await this.prisma.userList.findUnique({ where: { id: listId } });
    if (!list || !list.isPublic) {
      throw new NotFoundException('List not found');
    }

    // Can't vote on own list
    if (list.userId === userId) {
      throw new BadRequestException('Cannot vote on your own list');
    }

    return this.prisma.userListVote.upsert({
      where: { listId_userId: { listId, userId } },
      update: { value },
      create: { listId, userId, value },
    });
  }

  async removeVote(listId: string, userId: string) {
    await this.prisma.userListVote.deleteMany({
      where: { listId, userId },
    });
  }

  async getListVoteCount(listId: string): Promise<number> {
    const result = await this.prisma.userListVote.aggregate({
      where: { listId },
      _sum: { value: true },
    });
    return result._sum.value || 0;
  }
}

