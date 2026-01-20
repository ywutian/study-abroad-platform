import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdmissionCase,
  Prisma,
  Visibility,
  Role,
  MemoryType,
  EntityType,
} from '@prisma/client';
import {
  PaginationDto,
  createPaginatedResponse,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
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
  type BatchImportResult,
} from '../../common/utils/import-normalizers';

interface CaseFilters {
  schoolId?: string;
  year?: number;
  result?: string;
  search?: string;
  visibility?: Visibility;
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
    @Optional()
    @Inject(forwardRef(() => MemoryManagerService))
    private memoryManager?: MemoryManagerService,
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

    if (filters.search) {
      where.OR = [
        { major: { contains: filters.search, mode: 'insensitive' } },
        { school: { name: { contains: filters.search, mode: 'insensitive' } } },
        {
          school: { nameZh: { contains: filters.search, mode: 'insensitive' } },
        },
      ];
    }

    // Visibility filter based on requester role
    if (requesterRole === Role.ADMIN) {
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
          school: { select: { id: true, name: true, nameZh: true } },
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
  ): Promise<AdmissionCase> {
    const caseItem = await this.prisma.admissionCase.findUnique({
      where: { id },
      include: {
        school: {
          select: { id: true, name: true, nameZh: true, usNewsRank: true },
        },
      },
    });

    if (!caseItem) {
      throw new NotFoundException('Case not found');
    }

    // Check visibility
    if (
      requesterId &&
      (caseItem.userId === requesterId || requesterRole === Role.ADMIN)
    ) {
      return caseItem;
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
    // 记录浏览行为到记忆系统
    if (requesterId) {
      this.recordViewCaseToMemory(requesterId, caseItem).catch((err) => {
        this.logger.warn('Failed to record view case to memory', err);
      });
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
      satRange?: string;
      actRange?: string;
      toeflRange?: string;
      tags?: string[];
      visibility?: 'PRIVATE' | 'PUBLIC' | 'ANONYMOUS' | 'VERIFIED_ONLY';
      // Essay fields
      essayType?: 'COMMON_APP' | 'UC' | 'SUPPLEMENTAL' | 'WHY_SCHOOL' | 'OTHER';
      essayPrompt?: string;
      essayContent?: string;
      promptNumber?: number;
    },
  ): Promise<AdmissionCase> {
    const { schoolId, essayType, ...rest } = data;
    const admissionCase = await this.prisma.admissionCase.create({
      data: {
        ...rest,
        result: rest.result as any,
        ...(essayType && { essayType: essayType as any }),
        user: { connect: { id: userId } },
        school: { connect: { id: schoolId } },
      },
      include: {
        school: { select: { name: true, nameZh: true } },
      },
    });

    // 记录创建案例到记忆系统
    this.recordCreateCaseToMemory(userId, admissionCase, data).catch((err) => {
      this.logger.warn('Failed to record create case to memory', err);
    });

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
      satRange: string;
      actRange: string;
      toeflRange: string;
      tags: string[];
      visibility: 'PRIVATE' | 'PUBLIC' | 'ANONYMOUS' | 'VERIFIED_ONLY';
      // Essay fields
      essayType: 'COMMON_APP' | 'UC' | 'SUPPLEMENTAL' | 'WHY_SCHOOL' | 'OTHER';
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

    const { schoolId, result, visibility, essayType, ...rest } = data;
    return this.prisma.admissionCase.update({
      where: { id },
      data: {
        ...rest,
        ...(result && { result: result as any }),
        ...(visibility && { visibility: visibility as any }),
        ...(essayType && { essayType: essayType as any }),
        ...(schoolId && { school: { connect: { id: schoolId } } }),
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
        school: { select: { id: true, name: true, nameZh: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
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
          school: { select: { id: true, name: true, nameZh: true } },
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
    const result: BatchImportResult = { imported: 0, skipped: 0, errors: [] };

    // 获取或创建系统导入用户
    let importUser = await this.prisma.user.findFirst({
      where: { email: 'import@system.local' },
    });
    if (!importUser) {
      importUser = await this.prisma.user.create({
        data: {
          email: 'import@system.local',
          passwordHash: 'imported',
          role: 'USER',
        },
      });
    }

    const defaultVisibility = dto.visibility || Visibility.ANONYMOUS;

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      try {
        // 解析学校名
        const school = await resolveSchoolId(this.prisma, item.school);
        if (!school) {
          result.skipped++;
          result.errors.push({
            row: i + 1,
            school: item.school,
            message: `学校未找到: ${item.school}`,
          });
          continue;
        }

        // 处理标签
        const tags = parseTags(item.tags || '');
        if (item.toefl && !tags.includes('international')) {
          tags.push('international');
        }

        // 标准化文书类型
        const essayType = normalizeEssayType(item.essayType || '');

        // 创建案例
        await this.prisma.admissionCase.create({
          data: {
            userId: importUser.id,
            schoolId: school.id,
            year: item.year,
            round: normalizeRound(item.round || ''),
            result: normalizeResult(item.result) as any,
            major: item.major || null,
            gpaRange: item.gpa || null,
            satRange: item.sat || null,
            actRange: item.act || null,
            toeflRange: item.toefl || null,
            tags,
            visibility: defaultVisibility,
            isVerified: dto.autoVerify || false,
            ...(dto.autoVerify && { verifiedAt: new Date() }),
            ...(essayType && { essayType: essayType as any }),
            ...(item.essayPrompt && { essayPrompt: item.essayPrompt }),
            ...(item.essayContent && { essayContent: item.essayContent }),
          },
        });

        result.imported++;
      } catch (e: any) {
        result.skipped++;
        result.errors.push({
          row: i + 1,
          school: item.school,
          message: e.message,
        });
      }
    }

    return result;
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
        },
        include: {
          school: { select: { id: true, name: true, nameZh: true } },
        },
      });
    } else {
      // REJECT: 将可见性设为 PRIVATE，从 gallery 隐藏
      return this.prisma.admissionCase.update({
        where: { id },
        data: {
          visibility: Visibility.PRIVATE,
        },
        include: {
          school: { select: { id: true, name: true, nameZh: true } },
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
    const results = await Promise.all(
      dto.ids.map((id) =>
        this.reviewCaseEssay(id, {
          action: dto.action,
          reason: dto.reason,
        }).catch((e) => ({
          id,
          error: e.message,
        })),
      ),
    );

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
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const schoolName =
        admissionCase.school?.nameZh ||
        admissionCase.school?.name ||
        '未知学校';
      const resultText =
        data.result === 'ADMITTED'
          ? '录取'
          : data.result === 'REJECTED'
            ? '拒绝'
            : data.result === 'WAITLISTED'
              ? '候补'
              : data.result;

      // 记录录取决策
      await this.memoryManager.remember(userId, {
        type: MemoryType.DECISION,
        category: 'admission_case',
        content: `用户分享了${data.year}年${schoolName}的${resultText}案例${data.major ? `，专业：${data.major}` : ''}`,
        importance: 0.8,
        metadata: {
          caseId: admissionCase.id,
          schoolId: data.schoolId,
          year: data.year,
          result: data.result,
          major: data.major,
          round: data.round,
        },
      });

      // 记录学校实体
      await this.memoryManager.recordEntity(userId, {
        type: EntityType.SCHOOL,
        name: schoolName,
        description: `${data.year}年申请，结果：${resultText}`,
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
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const schoolName =
        caseItem.school?.nameZh || caseItem.school?.name || '未知学校';

      await this.memoryManager.remember(userId, {
        type: MemoryType.FACT,
        category: 'case_view',
        content: `用户查看了${caseItem.year}年${schoolName}的${caseItem.result === 'ADMITTED' ? '录取' : '申请'}案例`,
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
