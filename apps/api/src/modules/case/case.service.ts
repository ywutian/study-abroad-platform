import {
  Injectable,
  NotFoundException,
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
  EssayType,
} from '@prisma/client';
import { fireAndForget } from '../../common/utils/async.util';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';
import { CaseIncentiveService, PointAction } from '../points/incentive.service';
import {
  BatchImportCaseDto,
  ReviewCaseEssayDto,
  BatchVerifyCaseDto,
} from './dto/batch-import-case.dto';
import { SCHOOL_NAME_RANK_SELECT } from '../../common/constants/prisma-selects';
import { computeCaseQualityScore } from '../../common/constants/data-formats';
import { CaseQueryService, CaseStats } from './case-query.service';
import { CaseBatchService } from './case-batch.service';
import { CaseMemoryService } from './case-memory.service';
import { type BatchImportResult } from '../../common/utils/import-normalizers';

@Injectable()
export class CaseService {
  private readonly logger = new Logger(CaseService.name);

  constructor(
    private prisma: PrismaService,
    private caseQueryService: CaseQueryService,
    private caseBatchService: CaseBatchService,
    private caseMemoryService: CaseMemoryService,
    @Optional()
    private caseIncentiveService?: CaseIncentiveService,
  ) {}

  // ============ Delegated Query Methods ============

  async findAll(
    pagination: PaginationDto,
    filters: Parameters<CaseQueryService['findAll']>[1],
    requesterId?: string | null,
    requesterRole?: Role | null,
  ): Promise<PaginatedResponseDto<AdmissionCase, CaseStats>> {
    return this.caseQueryService.findAll(
      pagination,
      filters,
      requesterId,
      requesterRole,
    );
  }

  async findById(
    id: string,
    requesterId: string | null,
    requesterRole: Role | null,
    locale = 'zh',
  ): Promise<AdmissionCase> {
    return this.caseQueryService.findById(
      id,
      requesterId,
      requesterRole,
      locale,
    );
  }

  async getMyCases(userId: string): Promise<AdmissionCase[]> {
    return this.caseQueryService.getMyCases(userId);
  }

  async getPrefillFromProfile(userId: string) {
    return this.caseQueryService.getPrefillFromProfile(userId);
  }

  async getAdminStats() {
    return this.caseQueryService.getAdminStats();
  }

  // ============ Delegated Batch Methods ============

  async batchImport(
    dto: BatchImportCaseDto,
    operatorId: string,
  ): Promise<BatchImportResult> {
    return this.caseBatchService.batchImport(dto, operatorId);
  }

  async getBatchHistory(page = 1, limit = 20) {
    return this.caseBatchService.getBatchHistory(page, limit);
  }

  async getImportProgress(batchId: string) {
    return this.caseBatchService.getImportProgress(batchId);
  }

  async getPendingEssays(page = 1, pageSize = 20) {
    return this.caseBatchService.getPendingEssays(page, pageSize);
  }

  async reviewCaseEssay(id: string, dto: ReviewCaseEssayDto) {
    return this.caseBatchService.reviewCaseEssay(id, dto);
  }

  async batchVerifyCases(dto: BatchVerifyCaseDto) {
    return this.caseBatchService.batchVerifyCases(dto);
  }

  // ============ Local Methods (create, update, delete) ============

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
          testScores: testScores,
        }),
        ...(activitiesJson?.length && {
          activities: activitiesJson,
        }),
        ...(awardsJson?.length && {
          awards: awardsJson,
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
      this.caseMemoryService.recordCreateCaseToMemory(
        userId,
        admissionCase,
        data,
        locale,
      ),
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
          visibility: visibility,
        }),
        ...(essayType && { essayType }),
        ...(schoolId && { school: { connect: { id: schoolId } } }),
        ...(testScores !== undefined && {
          testScores: testScores,
        }),
        ...(activitiesJson !== undefined && {
          activities: activitiesJson,
        }),
        ...(awardsJson !== undefined && {
          awards: awardsJson,
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
}

// Re-export types for backward compatibility
export type { CaseStats } from './case-query.service';
