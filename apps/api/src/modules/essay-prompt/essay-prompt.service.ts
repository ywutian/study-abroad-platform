import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EssayStatus, EssayType, Prisma } from '@prisma/client';
import {
  CreateEssayPromptDto,
  UpdateEssayPromptDto,
  QueryEssayPromptDto,
  VerifyEssayPromptDto,
  BatchImportEssayPromptDto,
} from './dto';
import {
  resolveSchoolId,
  type BatchImportResult,
} from '../../common/utils/import-normalizers';

@Injectable()
export class EssayPromptService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建文书题目
   */
  async create(dto: CreateEssayPromptDto, operatorId: string) {
    const { schoolId, sourceType, sourceUrl, ...data } = dto;

    // 验证学校存在
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException('学校不存在');
    }

    // 创建文书题目
    const essayPrompt = await this.prisma.essayPrompt.create({
      data: {
        ...data,
        schoolId,
        sources: sourceType
          ? {
              create: {
                sourceType,
                sourceUrl,
              },
            }
          : undefined,
      },
      include: {
        school: { select: { id: true, name: true, nameZh: true } },
        sources: true,
      },
    });

    // 创建审计日志
    await this.createAuditLog(
      essayPrompt.id,
      'CREATE',
      null,
      EssayStatus.PENDING,
      operatorId,
      'ADMIN',
    );

    return essayPrompt;
  }

  /**
   * 查询文书题目列表
   */
  async findAll(query: QueryEssayPromptDto) {
    const {
      schoolId,
      year,
      type,
      status,
      search,
      page = 1,
      pageSize = 20,
    } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.EssayPromptWhereInput = {
      isActive: true,
      ...(schoolId && { schoolId }),
      ...(year && { year }),
      ...(type && { type }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { prompt: { contains: search, mode: 'insensitive' } },
          { promptZh: { contains: search, mode: 'insensitive' } },
          { school: { name: { contains: search, mode: 'insensitive' } } },
          { school: { nameZh: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.essayPrompt.findMany({
        where,
        include: {
          school: {
            select: { id: true, name: true, nameZh: true, usNewsRank: true },
          },
          sources: {
            select: { sourceType: true, sourceUrl: true, scrapedAt: true },
          },
        },
        orderBy: [{ school: { usNewsRank: 'asc' } }, { sortOrder: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.essayPrompt.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  /**
   * 获取单个文书题目
   */
  async findOne(id: string) {
    const essayPrompt = await this.prisma.essayPrompt.findUnique({
      where: { id },
      include: {
        school: {
          select: { id: true, name: true, nameZh: true, usNewsRank: true },
        },
        sources: true,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!essayPrompt) {
      throw new NotFoundException('文书题目不存在');
    }

    return essayPrompt;
  }

  /**
   * 获取学校的文书题目
   */
  async findBySchool(schoolId: string, year?: number) {
    const where: Prisma.EssayPromptWhereInput = {
      schoolId,
      isActive: true,
      status: EssayStatus.VERIFIED,
      ...(year && { year }),
    };

    return this.prisma.essayPrompt.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { type: 'asc' }],
    });
  }

  /**
   * 更新文书题目
   */
  async update(id: string, dto: UpdateEssayPromptDto, operatorId: string) {
    const existing = await this.findOne(id);

    const essayPrompt = await this.prisma.essayPrompt.update({
      where: { id },
      data: dto,
      include: {
        school: { select: { id: true, name: true, nameZh: true } },
        sources: true,
      },
    });

    // 记录变更
    await this.createAuditLog(
      id,
      'UPDATE',
      existing.status,
      existing.status,
      operatorId,
      'ADMIN',
      {
        changes: dto,
      },
    );

    return essayPrompt;
  }

  /**
   * 审核文书题目
   */
  async verify(id: string, dto: VerifyEssayPromptDto, operatorId: string) {
    const existing = await this.findOne(id);

    if (dto.status === EssayStatus.REJECTED && !dto.reason) {
      throw new BadRequestException('拒绝时必须填写原因');
    }

    const essayPrompt = await this.prisma.essayPrompt.update({
      where: { id },
      data: {
        status: dto.status,
        verifiedBy: operatorId,
        verifiedAt: new Date(),
        rejectReason: dto.status === EssayStatus.REJECTED ? dto.reason : null,
      },
      include: {
        school: { select: { id: true, name: true, nameZh: true } },
      },
    });

    // 记录审核日志
    await this.createAuditLog(
      id,
      dto.status === EssayStatus.VERIFIED ? 'VERIFY' : 'REJECT',
      existing.status,
      dto.status,
      operatorId,
      'ADMIN',
      { reason: dto.reason },
    );

    return essayPrompt;
  }

  /**
   * 批量审核
   */
  async batchVerify(
    ids: string[],
    status: EssayStatus,
    operatorId: string,
    reason?: string,
  ) {
    const results = await Promise.all(
      ids.map((id) =>
        this.verify(id, { status: status as any, reason }, operatorId).catch(
          (e) => ({
            id,
            error: e.message,
          }),
        ),
      ),
    );

    const success = results.filter((r) => !('error' in r));
    const failed = results.filter((r) => 'error' in r);

    return { success: success.length, failed };
  }

  /**
   * 删除文书题目（软删除）
   */
  async remove(id: string, operatorId: string) {
    const existing = await this.findOne(id);

    await this.prisma.essayPrompt.update({
      where: { id },
      data: { isActive: false },
    });

    await this.createAuditLog(
      id,
      'ARCHIVE',
      existing.status,
      null,
      operatorId,
      'ADMIN',
    );

    return { message: '删除成功' };
  }

  /**
   * 获取审核统计
   */
  async getStats(year?: number) {
    const where: Prisma.EssayPromptWhereInput = {
      isActive: true,
      ...(year && { year }),
    };

    const [pending, verified, rejected, total, byType] = await Promise.all([
      this.prisma.essayPrompt.count({
        where: { ...where, status: EssayStatus.PENDING },
      }),
      this.prisma.essayPrompt.count({
        where: { ...where, status: EssayStatus.VERIFIED },
      }),
      this.prisma.essayPrompt.count({
        where: { ...where, status: EssayStatus.REJECTED },
      }),
      this.prisma.essayPrompt.count({ where }),
      this.prisma.essayPrompt.groupBy({
        by: ['type'],
        where: { ...where, status: EssayStatus.VERIFIED },
        _count: true,
      }),
    ]);

    return {
      pending,
      verified,
      rejected,
      total,
      byType: byType.reduce(
        (acc, item) => {
          acc[item.type] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * 批量导入文书题目
   */
  async batchImport(
    dto: BatchImportEssayPromptDto,
    operatorId: string,
  ): Promise<BatchImportResult> {
    const result: BatchImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      try {
        // 解析学校名 → schoolId
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

        // 去重检查：同学校 + 同年份 + 相同 prompt 前50字
        const promptPrefix = item.prompt.substring(0, 50);
        const existing = await this.prisma.essayPrompt.findFirst({
          where: {
            schoolId: school.id,
            year: item.year,
            prompt: { startsWith: promptPrefix },
            isActive: true,
          },
        });

        if (existing) {
          result.skipped++;
          result.errors.push({
            row: i + 1,
            school: item.school,
            message: '重复数据，已跳过',
          });
          continue;
        }

        // 创建 EssayPrompt
        const status = dto.autoVerify
          ? EssayStatus.VERIFIED
          : EssayStatus.PENDING;

        const essayPrompt = await this.prisma.essayPrompt.create({
          data: {
            schoolId: school.id,
            year: item.year,
            type: item.type as any,
            prompt: item.prompt,
            promptZh: item.promptZh,
            wordLimit: item.wordLimit,
            isRequired: item.isRequired ?? true,
            sortOrder: item.sortOrder ?? 0,
            status,
            ...(dto.autoVerify && {
              verifiedBy: operatorId,
              verifiedAt: new Date(),
            }),
            sources: item.sourceUrl
              ? {
                  create: {
                    sourceType: 'OFFICIAL',
                    sourceUrl: item.sourceUrl,
                  },
                }
              : undefined,
          },
        });

        // 审计日志
        await this.createAuditLog(
          essayPrompt.id,
          'CREATE',
          null,
          status,
          operatorId,
          'ADMIN',
          { changes: { batchImport: true, school: item.school } },
        );

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
   * 创建审计日志
   */
  private async createAuditLog(
    essayPromptId: string,
    action: string,
    fromStatus: EssayStatus | null,
    toStatus: EssayStatus | null,
    operatorId: string,
    operatorType: string,
    extra?: { changes?: any; reason?: string },
  ) {
    return this.prisma.essayPromptAudit.create({
      data: {
        essayPromptId,
        action,
        fromStatus,
        toStatus,
        operatorId,
        operatorType,
        changes: extra?.changes,
        reason: extra?.reason,
      },
    });
  }
}
