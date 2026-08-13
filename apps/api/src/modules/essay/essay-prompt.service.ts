import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EssayStatus, Prisma } from '@prisma/client';
import { ERR } from '../../common/constants/error-messages';
import {
  SCHOOL_NAME_RANK_SELECT,
  SCHOOL_NAME_SELECT,
} from '../../common/constants/prisma-selects';
import {
  resolveSchoolId,
  type BatchImportResult,
} from '../../common/utils/import-normalizers';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BatchImportEssayPromptDto,
  CreateEssayPromptDto,
  QueryEssayPromptDto,
  UpdateEssayPromptDto,
  VerifyEssayPromptDto,
} from './dto';

/** Number of leading characters used for deduplication matching */
const DEDUP_PREFIX_LENGTH = 50;
const SOURCE_BACKED_PROMPT_WHERE: Prisma.EssayPromptWhereInput = {
  sources: { some: { sourceUrl: { not: null } } },
};
const ESSAY_PROMPT_SOURCE_SELECT = {
  sourceType: true,
  sourceUrl: true,
  scrapedAt: true,
  confidence: true,
} as const;

interface EssayPromptQueryOptions {
  requireSourceEvidence?: boolean;
  includeSourceSummary?: boolean;
}

type PromptSourceSummaryInput = {
  sourceType?: string | null;
  sourceUrl?: string | null;
  scrapedAt?: Date | string | null;
  confidence?: number | null;
};

@Injectable()
export class EssayPromptService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建文书题目
   */
  async create(dto: CreateEssayPromptDto, operatorId: string) {
    const { schoolId, sourceType, sourceUrl, ...data } = dto;

    // 验证学校存在
    // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException(ERR.NOT_FOUND.school());
    }

    // 创建文书题目
    // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
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
        school: { select: SCHOOL_NAME_SELECT },
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
  async findAll(
    query: QueryEssayPromptDto,
    options: EssayPromptQueryOptions = {},
  ) {
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
      ...(options.requireSourceEvidence ? SOURCE_BACKED_PROMPT_WHERE : {}),
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
      // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
      this.prisma.essayPrompt.findMany({
        where,
        include: {
          school: {
            select: SCHOOL_NAME_RANK_SELECT,
          },
          sources: {
            select: ESSAY_PROMPT_SOURCE_SELECT,
          },
        },
        orderBy: [{ school: { usNewsRank: 'asc' } }, { sortOrder: 'asc' }],
        skip,
        take: pageSize,
      }),
      // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
      this.prisma.essayPrompt.count({ where }),
    ]);

    return {
      data: options.includeSourceSummary
        ? data.map((prompt) => this.withPublicSourceSummary(prompt))
        : data,
      total,
      page,
      pageSize,
    };
  }

  async findAllPublic(query: QueryEssayPromptDto) {
    return this.findAll(
      {
        ...query,
        status:
          EssayStatus.VERIFIED as unknown as QueryEssayPromptDto['status'],
      },
      { requireSourceEvidence: true, includeSourceSummary: true },
    );
  }

  /**
   * 获取单个文书题目
   */
  async findOne(id: string) {
    // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
    const essayPrompt = await this.prisma.essayPrompt.findUnique({
      where: { id },
      include: {
        school: {
          select: SCHOOL_NAME_RANK_SELECT,
        },
        sources: true,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!essayPrompt) {
      throw new NotFoundException(ERR.NOT_FOUND.essayPrompt());
    }

    return essayPrompt;
  }

  /**
   * Public-safe version of findOne — excludes auditLogs and sources.
   */
  async findOnePublic(id: string) {
    // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
    const essayPrompt = await this.prisma.essayPrompt.findFirst({
      where: {
        id,
        isActive: true,
        status: EssayStatus.VERIFIED,
        ...SOURCE_BACKED_PROMPT_WHERE,
      },
      select: {
        id: true,
        schoolId: true,
        type: true,
        prompt: true,
        promptZh: true,
        wordLimit: true,
        isRequired: true,
        year: true,
        school: {
          select: SCHOOL_NAME_RANK_SELECT,
        },
        sources: {
          select: ESSAY_PROMPT_SOURCE_SELECT,
        },
      },
    });

    if (!essayPrompt) {
      throw new NotFoundException(ERR.NOT_FOUND.essayPrompt());
    }

    return this.withPublicSourceSummary({
      ...essayPrompt,
      schoolName: essayPrompt.school?.name || essayPrompt.school?.nameZh,
    });
  }

  /**
   * 获取学校的文书题目
   */
  async findBySchool(schoolId: string, year?: number) {
    const where: Prisma.EssayPromptWhereInput = {
      schoolId,
      isActive: true,
      status: EssayStatus.VERIFIED,
      ...SOURCE_BACKED_PROMPT_WHERE,
      ...(year && { year }),
    };

    // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
    const prompts = await this.prisma.essayPrompt.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { type: 'asc' }],
      include: {
        sources: {
          select: ESSAY_PROMPT_SOURCE_SELECT,
        },
      },
    });

    return prompts.map((prompt) => this.withPublicSourceSummary(prompt));
  }

  /**
   * 更新文书题目
   */
  async update(id: string, dto: UpdateEssayPromptDto, operatorId: string) {
    const existing = await this.findOne(id);

    // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
    const essayPrompt = await this.prisma.essayPrompt.update({
      where: { id },
      data: dto,
      include: {
        school: { select: SCHOOL_NAME_SELECT },
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (dto.status === EssayStatus.REJECTED && !dto.reason) {
      throw new BadRequestException(ERR.BAD_REQUEST.rejectReasonRequired());
    }

    // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
    const essayPrompt = await this.prisma.essayPrompt.update({
      where: { id },
      data: {
        status: dto.status,
        verifiedBy: operatorId,
        verifiedAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
        rejectReason: dto.status === EssayStatus.REJECTED ? dto.reason : null,
      },
      include: {
        school: { select: SCHOOL_NAME_SELECT },
      },
    });

    // 记录审核日志
    await this.createAuditLog(
      id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
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
        this.verify(
          id,
          {
            status: status as unknown as VerifyEssayPromptDto['status'],
            reason,
          },
          operatorId,
        ).catch((e) => ({
          id,
          error: e.message,
        })),
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

    // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
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

    return { message: ERR.BAD_REQUEST.deleted() };
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
      // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
      this.prisma.essayPrompt.count({
        where: { ...where, status: EssayStatus.PENDING },
      }),
      // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
      this.prisma.essayPrompt.count({
        where: { ...where, status: EssayStatus.VERIFIED },
      }),
      // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
      this.prisma.essayPrompt.count({
        where: { ...where, status: EssayStatus.REJECTED },
      }),
      // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
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
   * 按学校 ID 批量查询已验证文书题目数量
   */
  async countBySchoolIds(schoolIds: string[]): Promise<Map<string, number>> {
    if (schoolIds.length === 0) return new Map();

    const counts = await this.prisma.essayPrompt.groupBy({
      by: ['schoolId'],
      where: {
        schoolId: { in: schoolIds },
        isActive: true,
        status: EssayStatus.VERIFIED,
      },
      _count: true,
    });

    return new Map(counts.map((c) => [c.schoolId, c._count]));
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
        // Resolve school name → schoolId
        const school = await resolveSchoolId(this.prisma, item.school);
        if (!school) {
          result.skipped++;
          result.errors.push({
            row: i + 1,
            school: item.school,
            message: `${ERR.NOT_FOUND.essaySchool()}: ${item.school}`,
          });
          continue;
        }

        // Dedup: same school + year + type + prompt prefix
        const promptPrefix = item.prompt.substring(0, DEDUP_PREFIX_LENGTH);
        // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
        const existing = await this.prisma.essayPrompt.findFirst({
          where: {
            schoolId: school.id,
            year: item.year,
            type: item.type,
            prompt: { startsWith: promptPrefix },
            isActive: true,
          },
        });

        if (existing) {
          result.skipped++;
          result.errors.push({
            row: i + 1,
            school: item.school,
            message: ERR.CONFLICT.essayDuplicate(),
          });
          continue;
        }

        // Create EssayPrompt
        const status = dto.autoVerify
          ? EssayStatus.VERIFIED
          : EssayStatus.PENDING;

        // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
        const essayPrompt = await this.prisma.essayPrompt.create({
          data: {
            schoolId: school.id,
            year: item.year,
            type: item.type,
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

        // Audit log
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
      } catch (e: unknown) {
        result.skipped++;
        result.errors.push({
          row: i + 1,
          school: item.school,
          message: e instanceof Error ? e.message : String(e),
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
    // governance: system-scope — EssayPrompt / School / EssayPromptAudit are scraped application questions — school data with no User or Profile relation. Writes reach this service only through essay-prompt-admin.controller (@Roles(Role.OPERATOR))
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

  private withPublicSourceSummary<
    T extends { sources?: PromptSourceSummaryInput[] },
  >(prompt: T) {
    const { sources = [], ...rest } = prompt;
    return {
      ...rest,
      sourceSummary: this.buildSourceSummary(sources),
    };
  }

  private buildSourceSummary(sources: PromptSourceSummaryInput[]) {
    const sourceUrls = Array.from(
      new Set(
        sources
          .map((source) => source.sourceUrl?.trim())
          .filter((url): url is string => Boolean(url)),
      ),
    );
    const sourceTypes = Array.from(
      new Set(
        sources
          .map((source) => source.sourceType?.trim())
          .filter((sourceType): sourceType is string => Boolean(sourceType)),
      ),
    );
    const scrapedAtValues = sources
      .map((source) => source.scrapedAt)
      .filter(Boolean)
      .map((value) => new Date(value as string | Date))
      .filter((date) => Number.isFinite(date.getTime()));
    const confidenceValues = sources
      .map((source) => source.confidence)
      .filter(
        (confidence): confidence is number =>
          typeof confidence === 'number' && Number.isFinite(confidence),
      );

    return {
      hasSourceEvidence: sourceUrls.length > 0,
      sourceUrls,
      sourceTypes,
      sourceQuality: sourceTypes.some((type) =>
        ['OFFICIAL', 'COMMON_APP', 'UC'].includes(type.toUpperCase()),
      )
        ? 'official'
        : sourceTypes.length > 0
          ? 'secondary'
          : 'unknown',
      latestScrapedAt:
        scrapedAtValues.length > 0
          ? new Date(
              Math.max(...scrapedAtValues.map((date) => date.getTime())),
            ).toISOString()
          : null,
      minConfidence:
        confidenceValues.length > 0 ? Math.min(...confidenceValues) : null,
    };
  }
}
