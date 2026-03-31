import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdmissionCase,
  DataReviewStatus,
  Prisma,
  Visibility,
} from '@prisma/client';
import { fireAndForget } from '../../common/utils/async.util';
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
import { SCHOOL_NAME_SELECT } from '../../common/constants/prisma-selects';
import {
  computeCaseQualityScore,
  QUALITY_THRESHOLDS,
} from '../../common/constants/data-formats';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class CaseBatchService {
  private readonly logger = new Logger(CaseBatchService.name);

  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private redis: RedisService,
  ) {}

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
}
