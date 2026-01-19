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

  async getMyCases(userId: string): Promise<AdmissionCase[]> {
    return this.prisma.admissionCase.findMany({
      where: { userId },
      include: {
        school: { select: { id: true, name: true, nameZh: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
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
