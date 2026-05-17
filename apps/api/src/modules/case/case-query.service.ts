import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdmissionCase,
  DataReviewStatus,
  Prisma,
  Visibility,
  Role,
} from '@prisma/client';
import { fireAndForget } from '../../common/utils/async.util';
import {
  PaginationDto,
  createPaginatedResponse,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';
import { PointsService } from '../points/incentive.service';
import { SCHOOL_NAME_RANK_SELECT } from '../../common/constants/prisma-selects';
import { CaseMemoryService } from './case-memory.service';

interface CaseFilters {
  schoolId?: string;
  year?: number;
  result?: string;
  search?: string;
  visibility?: Visibility;
  highSchoolId?: string;
  round?: string;
  major?: string;
  nationality?: string;
}

// 标准化统计数据类型
export interface CaseStats {
  admitted: number;
  rejected: number;
  waitlisted: number;
}

@Injectable()
export class CaseQueryService {
  private readonly logger = new Logger(CaseQueryService.name);

  constructor(
    private prisma: PrismaService,
    private caseMemoryService: CaseMemoryService,
    @Optional()
    private pointsService?: PointsService,
  ) {}

  /**
   * Retrieve a paginated list of admission cases with optional filters and visibility enforcement
   * @param pagination - Pagination options including page number and page size
   * @param filters - Filter criteria such as schoolId, year, result, search text, and visibility
   * @param requesterId - ID of the requesting user, or null/undefined for unauthenticated requests
   * @param requesterRole - Role of the requesting user, used to determine visibility access
   * @returns Paginated response containing admission cases and aggregated result statistics
   */
  async findAll(
    pagination: PaginationDto,
    filters: CaseFilters,
    requesterId?: string | null,
    requesterRole?: Role | null,
  ): Promise<PaginatedResponseDto<AdmissionCase, CaseStats>> {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AdmissionCaseWhereInput = {};

    if (filters.schoolId) {
      where.schoolId = filters.schoolId;
    }

    if (filters.year) {
      where.year = filters.year;
    }

    if (filters.result) {
      where.result = filters.result as any;
    }

    if (filters.highSchoolId) {
      where.highSchoolId = filters.highSchoolId;
    }

    if (filters.round) {
      where.round = filters.round;
    }

    if (filters.major) {
      where.major = { contains: filters.major, mode: 'insensitive' };
    }

    if (filters.nationality) {
      where.nationality = {
        contains: filters.nationality,
        mode: 'insensitive',
      };
    }

    if (filters.search) {
      where.OR = [
        { major: { contains: filters.search, mode: 'insensitive' } },
        { school: { name: { contains: filters.search, mode: 'insensitive' } } },
        {
          school: { nameZh: { contains: filters.search, mode: 'insensitive' } },
        },
      ];
    }

    // Data review filter: non-admin users only see approved cases
    if (requesterRole !== Role.ADMIN && requesterRole !== Role.SUPER_ADMIN) {
      where.reviewStatus = {
        in: [DataReviewStatus.AUTO_APPROVED, DataReviewStatus.APPROVED],
      };
    }

    // Visibility filter based on requester role
    if (requesterRole === Role.ADMIN || requesterRole === Role.SUPER_ADMIN) {
      // Admin sees all
    } else if (requesterRole === Role.VERIFIED && requesterId) {
      where.AND = [
        where.OR ? { OR: where.OR } : {},
        {
          OR: [
            { visibility: Visibility.ANONYMOUS },
            { visibility: Visibility.VERIFIED_ONLY },
            { userId: requesterId },
          ],
        },
      ];
      delete where.OR;
    } else if (requesterId) {
      where.AND = [
        where.OR ? { OR: where.OR } : {},
        {
          OR: [{ visibility: Visibility.ANONYMOUS }, { userId: requesterId }],
        },
      ];
      delete where.OR;
    } else {
      // Unauthenticated user - only show anonymous cases
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { visibility: Visibility.ANONYMOUS }];
        delete where.OR;
      } else {
        where.visibility = Visibility.ANONYMOUS;
      }
    }

    const [cases, total, resultStats] = await Promise.all([
      this.prisma.admissionCase.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          school: { select: SCHOOL_NAME_RANK_SELECT },
        },
      }),
      this.prisma.admissionCase.count({ where }),
      this.prisma.admissionCase.groupBy({
        by: ['result'],
        where,
        _count: true,
      }),
    ]);

    const statsMap = Object.fromEntries(
      resultStats.map((r) => [r.result, r._count]),
    );

    return createPaginatedResponse(cases, total, page, pageSize, {
      admitted: statsMap['ADMITTED'] || 0,
      rejected: statsMap['REJECTED'] || 0,
      waitlisted: statsMap['WAITLISTED'] || 0,
    });
  }

  /**
   * Find a single admission case by ID with visibility checks
   * @param id - The unique identifier of the admission case
   * @param requesterId - ID of the requesting user, or null for unauthenticated requests
   * @param requesterRole - Role of the requesting user, used for visibility enforcement
   * @throws {NotFoundException} When the case with the given ID does not exist
   * @throws {ForbiddenException} When the case is private or restricted to verified users only
   * @returns The admission case including associated school information
   */
  async findById(
    id: string,
    requesterId: string | null,
    requesterRole: Role | null,
    locale = 'zh',
  ): Promise<AdmissionCase> {
    const caseItem = await this.prisma.admissionCase.findUnique({
      where: { id },
      include: {
        school: {
          select: SCHOOL_NAME_RANK_SELECT,
        },
      },
    });

    if (!caseItem) {
      throw new NotFoundException('Case not found');
    }

    // Owner and admin bypass all checks
    const isOwner = requesterId && caseItem.userId === requesterId;
    const isAdmin =
      requesterRole === Role.ADMIN || requesterRole === Role.SUPER_ADMIN;

    if (isOwner || isAdmin) {
      return caseItem;
    }

    // Non-admin, non-owner: block unreviewed cases
    if (
      caseItem.reviewStatus !== DataReviewStatus.AUTO_APPROVED &&
      caseItem.reviewStatus !== DataReviewStatus.APPROVED
    ) {
      throw new NotFoundException('Case not found');
    }

    if (caseItem.visibility === Visibility.PRIVATE) {
      throw new ForbiddenException('This case is private');
    }

    if (
      caseItem.visibility === Visibility.VERIFIED_ONLY &&
      requesterRole !== Role.VERIFIED
    ) {
      throw new ForbiddenException('Only verified users can view this case');
    }

    // ANONYMOUS visibility - allow public access
    // 扣除查看积分（首次查看才扣）
    if (requesterId && this.pointsService) {
      fireAndForget(
        this.pointsService.chargeViewCaseDetail(requesterId, id),
        this.logger,
        'Failed to charge view case detail',
      );
    }

    // 记录浏览行为到记忆系统
    if (requesterId) {
      fireAndForget(
        this.caseMemoryService.recordViewCaseToMemory(
          requesterId,
          caseItem,
          locale,
        ),
        this.logger,
        'Failed to record view case to memory',
      );
    }

    return caseItem;
  }

  /**
   * Retrieve all admission cases belonging to a specific user, ordered by creation date descending
   * @param userId - The ID of the user whose cases to retrieve
   * @returns Array of admission cases with associated school information
   */
  async getMyCases(userId: string): Promise<AdmissionCase[]> {
    return this.prisma.admissionCase.findMany({
      where: { userId },
      include: {
        school: { select: SCHOOL_NAME_RANK_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============ Profile-to-Case Prefill ============

  /**
   * Extract prefillable fields from user's profile for case creation.
   * Maps profile test scores, activities, awards, education to case DTO format.
   */
  async getPrefillFromProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: { orderBy: { order: 'asc' } },
        awards: {
          include: { competition: { select: { name: true, tier: true } } },
          orderBy: { order: 'asc' },
        },
        education: { include: { highSchool: true } },
      },
    });

    if (!profile) {
      return {};
    }

    // Map test scores → CaseTestScoreDto format
    const testScores = profile.testScores.map((ts) => ({
      type: ts.type,
      score: ts.score,
      subscores: ts.subScores as Record<string, number> | undefined,
      testDate: ts.testDate?.toISOString(),
    }));

    // Build GPA range from profile
    const gpaRange = profile.gpa ? String(profile.gpa) : undefined;
    const gpaScale = profile.gpaScale ? Number(profile.gpaScale) : undefined;

    // Map activities → CaseActivityDto format
    const activities = profile.activities.map((a) => ({
      category: a.category,
      description: a.name + (a.organization ? ` @ ${a.organization}` : ''),
      role: a.role || undefined,
      hoursPerWeek: a.hoursPerWeek ?? undefined,
      weeksPerYear: a.weeksPerYear ?? undefined,
    }));

    // Map awards → CaseAwardDto format
    const awards = profile.awards.map((a) => ({
      name: a.name,
      level: a.level.toLowerCase() as any,
      competition: (a.competition as any)?.name,
      tier: (a.competition as any)?.tier ?? undefined,
      year: a.year ?? undefined,
    }));

    // Extract AP/IB info from test scores
    const apScores = testScores.filter((t) => t.type === 'AP');
    const ibScores = testScores.filter((t) => t.type === 'IB');

    // Build demographic tags
    const demographicTags: string[] = [];
    if (profile.firstGeneration) demographicTags.push('first_gen');
    if (profile.legacy?.length) demographicTags.push('legacy');
    if (
      profile.nationality &&
      profile.nationality !== 'US' &&
      profile.nationality !== 'USA'
    ) {
      demographicTags.push('international');
    }

    // Extract high school type and highSchoolId from profile
    const highSchoolType = profile.currentSchoolType || undefined;
    const curriculumType = profile.educationSystem || undefined;
    const highSchoolEdu = profile.education.find(
      (e) => e.schoolType === 'HIGH_SCHOOL' && e.highSchoolId,
    );
    const highSchoolId = highSchoolEdu?.highSchoolId || undefined;

    // Financial aid
    const financialAid = profile.needsFinancialAid
      ? 'needs_aid'
      : profile.needsFinancialAid === false
        ? 'none'
        : undefined;

    return {
      gpaRange,
      gpaScale,
      major: profile.targetMajor || profile.intendedMajor || undefined,
      testScores: testScores.length > 0 ? testScores : undefined,
      activities: activities.length > 0 ? activities : undefined,
      awards: awards.length > 0 ? awards : undefined,
      apCount: apScores.length > 0 ? apScores.length : undefined,
      apSubjects:
        apScores.length > 0
          ? apScores
              .map((s) => s.subscores?.subject || `AP #${s.score}`)
              .filter(Boolean)
          : undefined,
      ibScore: ibScores.length > 0 ? ibScores[0].score : undefined,
      highSchoolId,
      highSchoolType,
      curriculumType,
      demographicTags: demographicTags.length > 0 ? demographicTags : undefined,
      nationality: profile.nationality || undefined,
      financialAid,
      // Generate activityList fallback
      activityList:
        activities.length > 0
          ? activities
              .map(
                (a) =>
                  `${a.category} - ${a.description}${a.role ? ` (${a.role})` : ''}`,
              )
              .join('\n')
          : undefined,
    };
  }

  // ============ Admin Methods ============

  /**
   * Retrieve aggregated admin statistics for admission cases
   * @returns An object containing counts for total cases, cases with essays, verified cases, and pending essay reviews
   */
  async getAdminStats() {
    const [total, withEssay, verified, pendingEssays] = await Promise.all([
      this.prisma.admissionCase.count(),
      this.prisma.admissionCase.count({
        where: { essayContent: { not: null } },
      }),
      this.prisma.admissionCase.count({
        where: { isVerified: true },
      }),
      this.prisma.admissionCase.count({
        where: {
          essayContent: { not: null },
          isVerified: false,
          visibility: { not: Visibility.PRIVATE },
        },
      }),
    ]);

    return { total, withEssay, verified, pendingEssays };
  }
}
