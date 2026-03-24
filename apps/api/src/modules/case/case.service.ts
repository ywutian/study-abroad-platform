import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdmissionCase,
  DataReviewStatus,
  Prisma,
  Visibility,
  Role,
  MemoryType,
  EntityType,
  EssayType,
} from '@prisma/client';
import { fireAndForget } from '../../common/utils/async.util';
import { getSchoolDisplayName } from '../../common/utils/locale.util';
import {
  PaginationDto,
  createPaginatedResponse,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { CaseIncentiveService, PointAction } from '../points/incentive.service';
import {
  AuditLogService,
  AuditAction,
} from '../../common/services/audit-log.service';
import {
  BatchImportCaseDto,
  ReviewCaseEssayDto,
  BatchVerifyCaseDto,
} from './dto/batch-import-case.dto';
import {
  resolveSchoolId,
  normalizeResult,
  normalizeRound,
  normalizeEssayType,
  parseTags,
  parseActivitiesText,
  parseAwardsText,
  parseTestScoresFromRanges,
  normalizeHighSchoolType,
  normalizeCurriculum,
  type BatchImportResult,
} from '../../common/utils/import-normalizers';
import {
  SCHOOL_NAME_SELECT,
  SCHOOL_NAME_RANK_SELECT,
  CASE_REVIEW_APPROVED_WHERE,
} from '../../common/constants/prisma-selects';
import {
  computeCaseQualityScore,
  parseCaseActivities,
  parseCaseAwards,
  parseCaseTestScores,
  QUALITY_THRESHOLDS,
} from '../../common/constants/data-formats';
import { RedisService } from '../../common/redis/redis.service';

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
export class CaseService {
  private readonly logger = new Logger(CaseService.name);

  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private redis: RedisService,
    @Optional()
    private memoryManager?: MemoryManagerService,
    @Optional()
    private caseIncentiveService?: CaseIncentiveService,
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
          school: { select: SCHOOL_NAME_SELECT },
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
    if (requesterId && this.caseIncentiveService) {
      fireAndForget(
        this.caseIncentiveService.chargeViewCaseDetail(requesterId, id),
        this.logger,
        'Failed to charge view case detail',
      );
    }

    // 记录浏览行为到记忆系统
    if (requesterId) {
      fireAndForget(
        this.recordViewCaseToMemory(requesterId, caseItem, locale),
        this.logger,
        'Failed to record view case to memory',
      );
    }

    return caseItem;
  }

  /**
   * Create a new admission case for a user, including optional essay data
   * @param userId - The ID of the user creating the case
   * @param data - Case creation payload including school, scores, essay, and visibility settings
   * @returns The newly created admission case with associated school information
   */
  async create(
    userId: string,
    data: {
      schoolId: string;
      year: number;
      round?: string;
      result: string;
      major?: string;
      gpaRange?: string;
      gpa9?: number;
      gpa10?: number;
      gpa11?: number;
      gpa12?: number;
      satRange?: string;
      actRange?: string;
      toeflRange?: string;
      tags?: string[];
      activityList?: string;
      visibility?: 'PRIVATE' | 'PUBLIC' | 'ANONYMOUS' | 'VERIFIED_ONLY';
      // Structured enrichment fields
      testScores?: any[];
      activities?: any[];
      awards?: any[];
      apCount?: number;
      apSubjects?: string[];
      ibScore?: number;
      ibPredicted?: boolean;
      highSchoolId?: string;
      highSchoolType?: string;
      curriculumType?: string;
      demographicTags?: string[];
      nationality?: string;
      financialAid?: string;
      enrollmentStatus?: string;
      narrative?: string;
      // Essay fields
      essayType?: EssayType;
      essayPrompt?: string;
      essayContent?: string;
      promptNumber?: number;
    },
    locale = 'zh',
    userRole: Role = Role.USER,
  ): Promise<AdmissionCase> {
    const {
      schoolId,
      essayType,
      testScores,
      activities: activitiesJson,
      awards: awardsJson,
      apCount,
      apSubjects,
      ibScore,
      ibPredicted,
      highSchoolId: _explicitHsId,
      highSchoolType,
      curriculumType,
      demographicTags,
      nationality,
      financialAid,
      enrollmentStatus,
      narrative,
      ...rest
    } = data;

    // Compute quality score for review routing
    const qualityScore = computeCaseQualityScore({
      source: 'user_submit',
      schoolName: schoolId,
      year: rest.year,
      result: rest.result as any,
      round: rest.round as any,
      major: rest.major || undefined,
      gpa: rest.gpaRange ? { range: rest.gpaRange, scale: 4 } : undefined,
      sat: rest.satRange ? { range: rest.satRange } : undefined,
      act: rest.actRange ? { range: rest.actRange } : undefined,
      toefl: rest.toeflRange ? { range: rest.toeflRange } : undefined,
      tags: rest.tags,
      testScores: testScores as any,
      activities: activitiesJson as any,
      awards: awardsJson as any,
      ap: apCount ? { count: apCount, subjects: apSubjects } : undefined,
      ib: ibScore ? { score: ibScore, predicted: ibPredicted } : undefined,
      highSchoolType,
      curriculumType,
      demographicTags,
      narrative,
    });

    // Sync activityList fallback from structured activities
    const activityListFallback =
      rest.activityList ||
      (activitiesJson?.length
        ? activitiesJson
            .map((a: any) =>
              a.category
                ? `${a.category} - ${a.description}${a.role ? ` (${a.role})` : ''}`
                : a.description,
            )
            .join('\n')
        : undefined);

    // Trusted roles get auto-approved; regular users go through review
    const isTrusted =
      userRole === Role.VERIFIED ||
      userRole === Role.ADMIN ||
      userRole === Role.SUPER_ADMIN;
    const reviewStatus = isTrusted
      ? DataReviewStatus.AUTO_APPROVED
      : DataReviewStatus.PENDING_REVIEW;

    // Use explicit highSchoolId if provided, otherwise auto-fill from profile
    let resolvedHighSchoolId = data.highSchoolId;
    if (!resolvedHighSchoolId) {
      const profileHighSchoolEdu = await this.prisma.education.findFirst({
        where: {
          profile: { userId },
          schoolType: 'HIGH_SCHOOL',
          highSchoolId: { not: null },
        },
        select: { highSchoolId: true },
      });
      resolvedHighSchoolId = profileHighSchoolEdu?.highSchoolId || undefined;
    }

    // Auto-fill highSchoolType from HighSchool record if not provided
    let resolvedHsType = highSchoolType;
    if (!resolvedHsType && resolvedHighSchoolId) {
      const hs = await this.prisma.highSchool.findUnique({
        where: { id: resolvedHighSchoolId },
        select: { type: true },
      });
      if (hs?.type) resolvedHsType = hs.type;
    }

    const admissionCase = await this.prisma.admissionCase.create({
      data: {
        ...rest,
        ...(activityListFallback && { activityList: activityListFallback }),
        result: rest.result as AdmissionCase['result'],
        ...(essayType && { essayType }),
        // Structured enrichment fields (cast to Prisma JSON)
        ...(testScores?.length && {
          testScores: testScores as unknown as Prisma.InputJsonValue,
        }),
        ...(activitiesJson?.length && {
          activities: activitiesJson as unknown as Prisma.InputJsonValue,
        }),
        ...(awardsJson?.length && {
          awards: awardsJson as unknown as Prisma.InputJsonValue,
        }),
        ...(apCount !== undefined && { apCount }),
        ...(apSubjects?.length && { apSubjects }),
        ...(ibScore !== undefined && { ibScore }),
        ...(ibPredicted !== undefined && { ibPredicted }),
        ...(resolvedHsType && { highSchoolType: resolvedHsType as any }),
        ...(resolvedHighSchoolId && {
          highSchool: { connect: { id: resolvedHighSchoolId } },
        }),
        ...(curriculumType && { curriculumType: curriculumType as any }),
        ...(demographicTags?.length && { demographicTags }),
        ...(nationality && { nationality }),
        ...(financialAid && { financialAid }),
        ...(enrollmentStatus && { enrollmentStatus }),
        ...(narrative && { narrative }),
        source: 'user_submit',
        qualityScore,
        reviewStatus,
        user: { connect: { id: userId } },
        school: { connect: { id: schoolId } },
      },
      include: {
        school: { select: { name: true, nameZh: true } },
      },
    });

    // 奖励积分
    if (this.caseIncentiveService) {
      fireAndForget(
        this.caseIncentiveService.reward(userId, PointAction.SUBMIT_CASE, {
          caseId: admissionCase.id,
        }),
        this.logger,
        'Failed to reward case submission',
      );
    }

    // 记录创建案例到记忆系统
    fireAndForget(
      this.recordCreateCaseToMemory(userId, admissionCase, data, locale),
      this.logger,
      'Failed to record create case to memory',
    );

    return admissionCase;
  }

  /**
   * Update an existing admission case owned by the specified user
   * @param id - The unique identifier of the case to update
   * @param userId - The ID of the user requesting the update (must be the case owner)
   * @param data - Partial case data to update, including school, scores, essay, and visibility fields
   * @throws {NotFoundException} When the case does not exist or is not owned by the user
   * @returns The updated admission case
   */
  async update(
    id: string,
    userId: string,
    data: Partial<{
      schoolId: string;
      year: number;
      round: string;
      result: string;
      major: string;
      gpaRange: string;
      gpa9: number;
      gpa10: number;
      gpa11: number;
      gpa12: number;
      satRange: string;
      actRange: string;
      toeflRange: string;
      tags: string[];
      activityList: string;
      visibility: 'PRIVATE' | 'PUBLIC' | 'ANONYMOUS' | 'VERIFIED_ONLY';
      // Structured enrichment fields
      testScores: any[];
      activities: any[];
      awards: any[];
      apCount: number;
      apSubjects: string[];
      ibScore: number;
      ibPredicted: boolean;
      highSchoolType: string;
      curriculumType: string;
      demographicTags: string[];
      financialAid: string;
      enrollmentStatus: string;
      narrative: string;
      // Essay fields
      essayType: EssayType;
      essayPrompt: string;
      essayContent: string;
      promptNumber: number;
    }>,
  ): Promise<AdmissionCase> {
    const caseItem = await this.prisma.admissionCase.findUnique({
      where: { id },
    });

    if (!caseItem || caseItem.userId !== userId) {
      throw new NotFoundException('Case not found');
    }

    const {
      schoolId,
      result,
      visibility,
      essayType,
      testScores,
      activities: activitiesJson,
      awards: awardsJson,
      highSchoolType,
      curriculumType,
      ...rest
    } = data;

    return this.prisma.admissionCase.update({
      where: { id },
      data: {
        ...rest,
        ...(result && { result: result as AdmissionCase['result'] }),
        ...(visibility && {
          visibility: visibility as AdmissionCase['visibility'],
        }),
        ...(essayType && { essayType }),
        ...(schoolId && { school: { connect: { id: schoolId } } }),
        ...(testScores !== undefined && {
          testScores: testScores as unknown as Prisma.InputJsonValue,
        }),
        ...(activitiesJson !== undefined && {
          activities: activitiesJson as unknown as Prisma.InputJsonValue,
        }),
        ...(awardsJson !== undefined && {
          awards: awardsJson as unknown as Prisma.InputJsonValue,
        }),
        ...(highSchoolType !== undefined && {
          highSchoolType: highSchoolType as any,
        }),
        ...(curriculumType !== undefined && {
          curriculumType: curriculumType as any,
        }),
      },
    });
  }

  /**
   * Delete an admission case owned by the specified user
   * @param id - The unique identifier of the case to delete
   * @param userId - The ID of the user requesting the deletion (must be the case owner)
   * @throws {NotFoundException} When the case does not exist or is not owned by the user
   * @returns void
   */
  async delete(id: string, userId: string): Promise<void> {
    const caseItem = await this.prisma.admissionCase.findUnique({
      where: { id },
    });

    if (!caseItem || caseItem.userId !== userId) {
      throw new NotFoundException('Case not found');
    }

    await this.prisma.admissionCase.delete({
      where: { id },
    });
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
        school: { select: SCHOOL_NAME_SELECT },
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
      type: ts.type as string,
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

  /**
   * Retrieve a paginated list of user-submitted essays pending review
   * @param page - The page number to retrieve (defaults to 1)
   * @param pageSize - The number of items per page (defaults to 20)
   * @returns Paginated result containing pending essay cases, total count, page, and pageSize
   */
  async getPendingEssays(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const where: Prisma.AdmissionCaseWhereInput = {
      essayContent: { not: null },
      isVerified: false,
      visibility: { not: Visibility.PRIVATE },
    };

    const [data, total] = await Promise.all([
      this.prisma.admissionCase.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          school: { select: SCHOOL_NAME_SELECT },
        },
      }),
      this.prisma.admissionCase.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  /**
   * Batch import admission cases from an external data source
   * @param dto - The batch import payload containing case items, visibility settings, and auto-verify flag
   * @param operatorId - The ID of the admin operator performing the import
   * @returns Import result summary including counts of imported, skipped, and per-row error details
   */
  async batchImport(
    dto: BatchImportCaseDto,
    operatorId: string,
  ): Promise<BatchImportResult> {
    const importBatchId = randomUUID();

    // 获取或创建系统导入用户
    let importUser = await this.prisma.user.findFirst({
      where: { email: 'import@system.local' },
    });
    if (!importUser) {
      importUser = await this.prisma.user.create({
        data: {
          email: 'import@system.local',
          passwordHash: await bcrypt.hash(randomUUID(), 12),
          role: 'USER',
        },
      });
    }

    const defaultVisibility = dto.visibility || Visibility.ANONYMOUS;

    // Pre-resolve schools outside transaction — batch by unique name to avoid N+1
    const uniqueSchoolNames = [...new Set(dto.items.map((i) => i.school))];
    const schoolMap = new Map<string, { id: string }>();
    for (const name of uniqueSchoolNames) {
      const school = await resolveSchoolId(this.prisma, name);
      if (school) schoolMap.set(name, school);
    }

    const resolvedItems: {
      index: number;
      item: (typeof dto.items)[0];
      school: { id: string };
    }[] = [];
    const preErrors: BatchImportResult['errors'] = [];

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      const school = schoolMap.get(item.school);
      if (!school) {
        preErrors.push({
          row: i + 1,
          school: item.school,
          message: `School not found: ${item.school}`,
        });
      } else {
        resolvedItems.push({ index: i, item, school });
      }
    }

    if (resolvedItems.length === 0) {
      return {
        imported: 0,
        skipped: preErrors.length,
        errors: preErrors,
        importBatchId,
      };
    }

    // Atomic transaction: all-or-nothing import
    const imported = await this.prisma.$transaction(
      async (tx) => {
        // Build dedup set: skip cases already imported with same key fields
        const existingCases = await tx.admissionCase.findMany({
          where: {
            userId: importUser.id,
            source: 'csv_import',
            schoolId: { in: resolvedItems.map((r) => r.school.id) },
          },
          select: { schoolId: true, year: true, result: true, major: true },
        });
        const existingKeys = new Set(
          existingCases.map(
            (c) => `${c.schoolId}|${c.year}|${c.result}|${c.major ?? ''}`,
          ),
        );

        const results = [];
        let processedCount = 0;
        for (const { index, item, school } of resolvedItems) {
          // Validate result value
          const normalizedResult = normalizeResult(item.result);
          if (!normalizedResult) {
            preErrors.push({
              row: index + 1,
              school: item.school,
              message: `Unrecognized result value: ${item.result}`,
            });
            continue;
          }
          const dedupKey = `${school.id}|${item.year}|${normalizedResult}|${item.major ?? ''}`;
          if (existingKeys.has(dedupKey)) {
            preErrors.push({
              row: index + 1,
              school: item.school,
              message: `Duplicate case skipped: ${item.school} ${item.year} ${normalizedResult}`,
            });
            continue;
          }
          existingKeys.add(dedupKey); // Prevent intra-batch duplicates too
          const tags = parseTags(item.tags || '');
          if (item.toefl && !tags.includes('international')) {
            tags.push('international');
          }
          const essayType = normalizeEssayType(item.essayType || '');

          // Parse enrichment fields from batch import text
          const testScores = parseTestScoresFromRanges(
            item.sat,
            item.act,
            item.toefl,
          );
          const activities = parseActivitiesText(item.activities || '');
          const awards = parseAwardsText(item.awards || '');
          const hsType = normalizeHighSchoolType(item.highSchoolType || '');
          const curriculum = normalizeCurriculum(item.curriculum || '');
          const demographicTags = item.demographicTags
            ? item.demographicTags
                .split(';')
                .map((t: string) => t.trim())
                .filter(Boolean)
            : [];
          const apSubjects = item.apSubjects
            ? item.apSubjects
                .split(';')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [];

          // Generate activityList fallback from structured activities
          const activityList =
            activities.length > 0
              ? activities
                  .map((a) =>
                    a.category
                      ? `${a.category} - ${a.description}`
                      : a.description,
                  )
                  .join('\n')
              : null;

          const qualityScore = computeCaseQualityScore({
            source: 'csv_import',
            schoolName: school?.id ?? '',
            year: item.year,
            result: normalizedResult as any,
            round: normalizeRound(item.round || '') as any,
            major: item.major || undefined,
            gpa: item.gpa ? { range: item.gpa, scale: 4 } : undefined,
            sat: item.sat ? { range: item.sat } : undefined,
            act: item.act ? { range: item.act } : undefined,
            toefl: item.toefl ? { range: item.toefl } : undefined,
            tags,
            testScores: testScores.length > 0 ? testScores : undefined,
            activities: activities.length > 0 ? activities : undefined,
            awards: awards.length > 0 ? awards : undefined,
            ap: item.apCount ? { count: item.apCount } : undefined,
            ib: item.ibScore ? { score: item.ibScore } : undefined,
            highSchoolType: hsType || undefined,
            curriculumType: curriculum || undefined,
            demographicTags:
              demographicTags.length > 0 ? demographicTags : undefined,
          });

          // Determine review status: autoVerify only applies if quality >= threshold
          const canAutoVerify =
            dto.autoVerify && qualityScore >= QUALITY_THRESHOLDS.PENDING_REVIEW;
          const reviewStatus = canAutoVerify
            ? DataReviewStatus.AUTO_APPROVED
            : DataReviewStatus.PENDING_REVIEW;

          const created = await tx.admissionCase.create({
            data: {
              userId: importUser.id,
              schoolId: school.id,
              year: item.year,
              round: normalizeRound(item.round || ''),
              result: normalizedResult as any,
              major: item.major || null,
              gpaRange: item.gpa || null,
              satRange: item.sat || null,
              actRange: item.act || null,
              toeflRange: item.toefl || null,
              tags,
              ...(activityList && { activityList }),
              visibility: defaultVisibility,
              isVerified: canAutoVerify,
              ...(canAutoVerify && { verifiedAt: new Date() }),
              ...(essayType && { essayType: essayType as any }),
              ...(item.essayPrompt && { essayPrompt: item.essayPrompt }),
              ...(item.essayContent && { essayContent: item.essayContent }),
              // Structured enrichment fields
              ...(testScores.length > 0 && {
                testScores: testScores as unknown as Prisma.InputJsonValue,
              }),
              ...(activities.length > 0 && {
                activities: activities as unknown as Prisma.InputJsonValue,
              }),
              ...(awards.length > 0 && {
                awards: awards as unknown as Prisma.InputJsonValue,
              }),
              ...(item.apCount !== undefined && { apCount: item.apCount }),
              ...(apSubjects.length > 0 && { apSubjects }),
              ...(item.ibScore !== undefined && { ibScore: item.ibScore }),
              ...(hsType && { highSchoolType: hsType }),
              ...(curriculum && { curriculumType: curriculum }),
              ...(demographicTags.length > 0 && { demographicTags }),
              ...(item.financialAid && { financialAid: item.financialAid }),
              ...(item.enrollmentStatus && {
                enrollmentStatus: item.enrollmentStatus,
              }),
              ...(item.narrative && { narrative: item.narrative }),
              source: 'csv_import',
              qualityScore,
              reviewStatus,
              importBatchId,
            },
          });
          results.push(created);

          // Update progress in Redis every 50 items
          processedCount++;
          if (processedCount % 50 === 0) {
            fireAndForget(
              this.redis.set(
                `import:progress:${importBatchId}`,
                JSON.stringify({
                  processed: processedCount,
                  total: resolvedItems.length,
                }),
                300,
              ),
              this.logger,
              'import progress update',
            );
          }
        }
        return results;
      },
      { timeout: 120000 },
    );

    // Audit log: record who imported what
    fireAndForget(
      this.auditLog.log({
        userId: operatorId,
        action: AuditAction.CASE_BATCH_IMPORTED,
        resource: 'case',
        resourceId: importBatchId,
        metadata: {
          count: imported.length,
          skipped: preErrors.length,
          errorCount: preErrors.length,
          autoVerify: dto.autoVerify || false,
          visibility: dto.visibility || 'ANONYMOUS',
        },
      }),
      this.logger,
      'batchImport audit log',
    );

    return {
      imported: imported.length,
      skipped: preErrors.length,
      errors: preErrors,
      importBatchId,
    };
  }

  /**
   * Get import batch history grouped by importBatchId
   */
  async getBatchHistory(page = 1, limit = 20) {
    const batches = await this.prisma.admissionCase.groupBy({
      by: ['importBatchId', 'source'],
      where: { importBatchId: { not: null } },
      _count: true,
      _min: { createdAt: true },
      orderBy: { _min: { createdAt: 'desc' } },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: batches.map((b) => ({
        importBatchId: b.importBatchId,
        source: b.source,
        count: b._count,
        createdAt: b._min.createdAt,
      })),
      page,
      limit,
    };
  }

  /**
   * Get import progress for a batch from Redis
   */
  async getImportProgress(batchId: string) {
    const data = await this.redis.get(`import:progress:${batchId}`);
    if (!data) return { status: 'not_found' };
    try {
      return { status: 'in_progress', ...JSON.parse(data) };
    } catch {
      return { status: 'unknown' };
    }
  }

  /**
   * Review a user-submitted case essay by approving or rejecting it
   * @param id - The unique identifier of the case to review
   * @param dto - Review action payload containing the action (APPROVE or REJECT) and optional reason
   * @throws {NotFoundException} When the case with the given ID does not exist
   * @returns The updated admission case with associated school information
   */
  async reviewCaseEssay(id: string, dto: ReviewCaseEssayDto) {
    const caseItem = await this.prisma.admissionCase.findUnique({
      where: { id },
    });

    if (!caseItem) {
      throw new NotFoundException('Case not found');
    }

    if (dto.action === 'APPROVE') {
      return this.prisma.admissionCase.update({
        where: { id },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          reviewStatus: DataReviewStatus.APPROVED,
          reviewedAt: new Date(),
        },
        include: {
          school: { select: SCHOOL_NAME_SELECT },
        },
      });
    } else {
      // REJECT: hide from gallery and record rejection status
      return this.prisma.admissionCase.update({
        where: { id },
        data: {
          visibility: Visibility.PRIVATE,
          reviewStatus: DataReviewStatus.REJECTED,
          reviewedAt: new Date(),
        },
        include: {
          school: { select: SCHOOL_NAME_SELECT },
        },
      });
    }
  }

  /**
   * Batch verify or reject multiple admission cases in a single operation
   * @param dto - Batch verification payload containing case IDs, action (APPROVE or REJECT), and optional reason
   * @returns Summary with the count of successfully processed cases and an array of failed cases with error details
   */
  async batchVerifyCases(dto: BatchVerifyCaseDto) {
    const results: Array<AdmissionCase | { id: string; error: string }> = [];

    // Process sequentially to avoid connection pool exhaustion
    for (const id of dto.ids) {
      try {
        const result = await this.reviewCaseEssay(id, {
          action: dto.action,
          reason: dto.reason,
        });
        results.push(result);
      } catch (e: any) {
        results.push({ id, error: e.message });
      }
    }

    const success = results.filter((r) => !('error' in r));
    const failed = results.filter((r) => 'error' in r);

    return { success: success.length, failed };
  }

  // ============ Memory Integration ============

  /**
   * 记录创建录取案例到记忆系统
   */
  private async recordCreateCaseToMemory(
    userId: string,
    admissionCase: any,
    data: any,
    locale = 'zh',
  ): Promise<void> {
    if (!this.memoryManager) return;
    // Skip memory for bulk imports — too noisy
    if (data.source === 'csv_import' || data.source === 'reddit') return;

    try {
      const isZh = locale === 'zh';
      const schoolName = admissionCase.school
        ? getSchoolDisplayName(admissionCase.school, locale)
        : isZh
          ? '未知学校'
          : 'Unknown school';
      const resultText = isZh
        ? data.result === 'ADMITTED'
          ? '录取'
          : data.result === 'REJECTED'
            ? '拒绝'
            : data.result === 'WAITLISTED'
              ? '候补'
              : data.result
        : data.result.toLowerCase();

      // Parse structured fields for rich memory content
      const activities = parseCaseActivities(admissionCase.activities);
      const awards = parseCaseAwards(admissionCase.awards);
      const testScores = parseCaseTestScores(admissionCase.testScores);
      const satScore = testScores.find((t: any) => t.type === 'SAT');
      const actScore = testScores.find((t: any) => t.type === 'ACT');

      // Build rich memory content
      const parts = isZh
        ? [
            `用户分享了${data.year}年${schoolName}的${resultText}案例`,
            data.major && `专业：${data.major}`,
            data.gpaRange && `GPA：${data.gpaRange}`,
            satScore && `SAT：${satScore.score}`,
            actScore && `ACT：${actScore.score}`,
            activities.length > 0 &&
              `活动：${activities.length}项 (${activities
                .slice(0, 3)
                .map((a: any) => a.description)
                .join('、')})`,
            awards.length > 0 &&
              `奖项：${awards.length}项 (${awards
                .slice(0, 3)
                .map((a: any) => a.name)
                .join('、')})`,
            admissionCase.highSchoolType &&
              `高中类型：${admissionCase.highSchoolType}`,
            admissionCase.curriculumType &&
              `课程体系：${admissionCase.curriculumType}`,
          ]
        : [
            `User shared a ${data.year} ${resultText} case for ${schoolName}`,
            data.major && `Major: ${data.major}`,
            data.gpaRange && `GPA: ${data.gpaRange}`,
            satScore && `SAT: ${satScore.score}`,
            actScore && `ACT: ${actScore.score}`,
            activities.length > 0 &&
              `Activities: ${activities.length} (${activities
                .slice(0, 3)
                .map((a: any) => a.description)
                .join(', ')})`,
            awards.length > 0 &&
              `Awards: ${awards.length} (${awards
                .slice(0, 3)
                .map((a: any) => a.name)
                .join(', ')})`,
            admissionCase.highSchoolType &&
              `HS Type: ${admissionCase.highSchoolType}`,
            admissionCase.curriculumType &&
              `Curriculum: ${admissionCase.curriculumType}`,
          ];

      await this.memoryManager.remember(userId, {
        type: MemoryType.DECISION,
        category: 'admission_case',
        content: parts.filter(Boolean).join(isZh ? '。' : '. '),
        importance: 0.8,
        metadata: {
          caseId: admissionCase.id,
          schoolId: data.schoolId,
          year: data.year,
          result: data.result,
          major: data.major,
          round: data.round,
          gpaRange: data.gpaRange,
          satScore: satScore?.score,
          activityCount: activities.length,
          awardCount: awards.length,
          highSchoolType: admissionCase.highSchoolType,
          curriculumType: admissionCase.curriculumType,
          demographicTags: admissionCase.demographicTags,
        },
      });

      // 记录学校实体
      await this.memoryManager.recordEntity(userId, {
        type: EntityType.SCHOOL,
        name: schoolName,
        description: isZh
          ? `${data.year}年申请，结果：${resultText}`
          : `${data.year} application, result: ${resultText}`,
        attributes: {
          schoolId: data.schoolId,
          result: data.result,
          year: data.year,
          major: data.major,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record create case to memory', error);
    }
  }

  /**
   * 记录浏览案例到记忆系统
   */
  private async recordViewCaseToMemory(
    userId: string,
    caseItem: any,
    locale = 'zh',
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const isZh = locale === 'zh';
      const schoolName = caseItem.school
        ? getSchoolDisplayName(caseItem.school, locale)
        : isZh
          ? '未知学校'
          : 'Unknown school';

      await this.memoryManager.remember(userId, {
        type: MemoryType.FACT,
        category: 'case_view',
        content: isZh
          ? `用户查看了${caseItem.year}年${schoolName}的${caseItem.result === 'ADMITTED' ? '录取' : '申请'}案例`
          : `User viewed a ${caseItem.year} ${caseItem.result === 'ADMITTED' ? 'admission' : 'application'} case for ${schoolName}`,
        importance: 0.3,
        metadata: {
          caseId: caseItem.id,
          schoolId: caseItem.schoolId,
          year: caseItem.year,
          result: caseItem.result,
          viewedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record view case to memory', error);
    }
  }
}
