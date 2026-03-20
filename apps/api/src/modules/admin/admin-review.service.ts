import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  DataReviewStatus,
  DataType,
  Prisma,
  StagingStatus,
  Visibility,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuditLogService,
  AuditAction,
} from '../../common/services/audit-log.service';
import {
  CaseStandardFormat,
  computeCaseQualityScore,
  computeCaseCompleteness,
  QUALITY_THRESHOLDS,
} from '../../common/constants/data-formats';
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';
import { PredictionHistoricalService } from '../prediction/prediction-historical.service';
import { fireAndForget } from '../../common/utils/async.util';
import { Optional } from '@nestjs/common';

@Injectable()
export class AdminReviewService {
  private readonly logger = new Logger(AdminReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notificationService: NotificationService,
    @Optional()
    private readonly predictionHistorical?: PredictionHistoricalService,
  ) {}

  // ============================================
  // Unified Import Pipeline
  // ============================================

  /**
   * Process a case through the quality scoring + tiered routing pipeline.
   * Returns the created/staged record ID.
   */
  async importCase(
    data: CaseStandardFormat,
    userId: string,
    importBatchId?: string,
  ): Promise<{
    id: string;
    route: 'auto_approved' | 'pending_review' | 'staging';
    qualityScore: number;
    completeness: number;
  }> {
    const qualityScore = computeCaseQualityScore(data);
    const completeness = computeCaseCompleteness(data);

    if (qualityScore >= QUALITY_THRESHOLDS.AUTO_APPROVE) {
      // High quality → auto-approve into AdmissionCase
      const caseRecord = await this.createCaseFromStandard(data, {
        qualityScore,
        reviewStatus: DataReviewStatus.AUTO_APPROVED,
        userId,
        importBatchId,
      });

      await this.auditLog.log({
        userId,
        action: AuditAction.ADMIN_ACTION,
        resource: 'case',
        resourceId: caseRecord.id,
        metadata: {
          source: data.source,
          qualityScore,
          completeness,
          route: 'auto_approved',
        },
      });

      return {
        id: caseRecord.id,
        route: 'auto_approved',
        qualityScore,
        completeness,
      };
    }

    if (qualityScore >= QUALITY_THRESHOLDS.PENDING_REVIEW) {
      // Medium quality → create case but mark as pending review (invisible to users)
      const caseRecord = await this.createCaseFromStandard(data, {
        qualityScore,
        reviewStatus: DataReviewStatus.PENDING_REVIEW,
        userId,
        importBatchId,
      });

      await this.auditLog.log({
        userId,
        action: AuditAction.ADMIN_ACTION,
        resource: 'case',
        resourceId: caseRecord.id,
        metadata: {
          source: data.source,
          qualityScore,
          completeness,
          route: 'pending_review',
        },
      });

      return {
        id: caseRecord.id,
        route: 'pending_review',
        qualityScore,
        completeness,
      };
    }

    // Low quality → staging table
    const staging = await this.prisma.dataImportStaging.create({
      data: {
        dataType: DataType.CASE,
        source: data.source,
        rawData: data as any,
        qualityScore,
        createdBy: userId,
        importBatchId,
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.ADMIN_ACTION,
      resource: 'staging',
      resourceId: staging.id,
      metadata: {
        source: data.source,
        qualityScore,
        completeness,
        route: 'staging',
      },
    });

    return { id: staging.id, route: 'staging', qualityScore, completeness };
  }

  /**
   * Batch import multiple cases
   */
  async importCaseBatch(
    cases: CaseStandardFormat[],
    userId: string,
  ): Promise<{
    importBatchId: string;
    results: { autoApproved: number; pendingReview: number; staged: number };
  }> {
    const importBatchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const results = { autoApproved: 0, pendingReview: 0, staged: 0 };

    for (const c of cases) {
      const result = await this.importCase(c, userId, importBatchId);
      if (result.route === 'auto_approved') results.autoApproved++;
      else if (result.route === 'pending_review') results.pendingReview++;
      else results.staged++;
    }

    await this.auditLog.log({
      userId,
      action: AuditAction.CASE_BATCH_IMPORTED,
      resource: 'batch',
      resourceId: importBatchId,
      metadata: { count: cases.length, ...results },
    });

    return { importBatchId, results };
  }

  // ============================================
  // Review Queue
  // ============================================

  /**
   * Get the review queue (staging table items + pending-review cases)
   */
  async getReviewQueue(params: {
    type?: DataType;
    status?: StagingStatus;
    source?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.type) where.dataType = params.type;
    if (params.status) where.status = params.status;
    else where.status = StagingStatus.PENDING;
    if (params.source) where.source = params.source;

    const [items, total] = await Promise.all([
      this.prisma.dataImportStaging.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.dataImportStaging.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get pending-review cases (already in AdmissionCase table but not visible)
   */
  async getPendingCases(page = 1, limit = 20) {
    const pageSize = Math.min(limit, 100);
    const skip = (page - 1) * pageSize;

    const where = { reviewStatus: DataReviewStatus.PENDING_REVIEW };

    const [rawItems, total] = await Promise.all([
      this.prisma.admissionCase.findMany({
        where,
        select: {
          id: true,
          year: true,
          round: true,
          result: true,
          major: true,
          gpaRange: true,
          gpaScale: true,
          satRange: true,
          actRange: true,
          toeflRange: true,
          qualityScore: true,
          source: true,
          reviewStatus: true,
          createdAt: true,
          testScores: true,
          apCount: true,
          apSubjects: true,
          ibScore: true,
          activities: true,
          awards: true,
          highSchoolType: true,
          curriculumType: true,
          demographicTags: true,
          financialAid: true,
          enrollmentStatus: true,
          narrative: true,
          activityList: true,
          school: {
            select: {
              id: true,
              name: true,
              nameZh: true,
              usNewsRank: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.admissionCase.count({ where }),
    ]);

    const items = rawItems.map((c) => ({
      id: c.id,
      school: c.school,
      admissionYear: c.year,
      admissionSeason: c.round,
      admissionResult: c.result,
      major: c.major,
      gpa: c.gpaRange ? { range: c.gpaRange, scale: c.gpaScale } : undefined,
      sat: c.satRange ? { range: c.satRange } : undefined,
      qualityScore: c.qualityScore,
      source: c.source,
      reviewStatus: c.reviewStatus,
      createdAt: c.createdAt.toISOString(),
      testScores: c.testScores,
      apCount: c.apCount,
      apSubjects: c.apSubjects,
      ibScore: c.ibScore,
      activities: c.activities,
      activitiesCount: Array.isArray(c.activities)
        ? (c.activities as unknown[]).length
        : c.activityList
          ? c.activityList.split('\n').filter(Boolean).length
          : undefined,
      awards: c.awards,
      awardsCount: Array.isArray(c.awards)
        ? (c.awards as unknown[]).length
        : undefined,
      highSchoolType: c.highSchoolType,
      curriculumType: c.curriculumType,
      demographicTags: c.demographicTags,
      financialAid: c.financialAid,
      enrollmentStatus: c.enrollmentStatus,
      narrative: c.narrative,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Approve a staging item → merge into the real table
   */
  async approveStagingItem(id: string, reviewerId: string, note?: string) {
    // Pre-check: prevent self-review
    const preCheck = await this.prisma.dataImportStaging.findUnique({
      where: { id },
      select: { createdBy: true, status: true },
    });
    if (!preCheck) throw new NotFoundException('Staging item not found');
    if (preCheck.createdBy && preCheck.createdBy === reviewerId) {
      throw new ForbiddenException('Cannot review your own imports');
    }

    // Atomic status check: only PENDING items can be approved (prevents race conditions)
    const updated = await this.prisma.dataImportStaging.updateMany({
      where: { id, status: StagingStatus.PENDING },
      data: {
        status: StagingStatus.APPROVED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });

    if (updated.count === 0) {
      if (preCheck.status !== StagingStatus.PENDING) {
        throw new ConflictException(
          'Item already processed by another reviewer',
        );
      }
      throw new ConflictException('Item already processed by another reviewer');
    }

    // Now fetch the full item to create the case
    const item = await this.prisma.dataImportStaging.findUnique({
      where: { id },
    });
    let mergedId: string | undefined;

    if (item && item.dataType === DataType.CASE) {
      const data = item.rawData as unknown as CaseStandardFormat;
      const caseRecord = await this.createCaseFromStandard(data, {
        qualityScore: item.qualityScore,
        reviewStatus: DataReviewStatus.APPROVED,
        userId: reviewerId,
        importBatchId: item.importBatchId ?? undefined,
      });
      mergedId = caseRecord.id;

      // Update mergedId back
      await this.prisma.dataImportStaging.update({
        where: { id },
        data: { mergedId },
      });
    }

    await this.auditLog.log({
      userId: reviewerId,
      action: AuditAction.STAGING_APPROVED,
      resource: 'staging',
      resourceId: id,
      metadata: { dataType: item?.dataType, mergedId },
    });

    return { mergedId };
  }

  /**
   * Approve a pending-review case (already in AdmissionCase table)
   */
  async approvePendingCase(caseId: string, reviewerId: string, note?: string) {
    // Atomic: only update if currently PENDING_REVIEW (prevents double-approve race)
    const updated = await this.prisma.admissionCase.updateMany({
      where: { id: caseId, reviewStatus: DataReviewStatus.PENDING_REVIEW },
      data: {
        reviewStatus: DataReviewStatus.APPROVED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      const exists = await this.prisma.admissionCase.findUnique({
        where: { id: caseId },
      });
      if (!exists) throw new NotFoundException('Case not found');
      throw new ConflictException('Case already reviewed');
    }

    await this.auditLog.log({
      userId: reviewerId,
      action: AuditAction.CASE_REVIEW_APPROVED,
      resource: 'case',
      resourceId: caseId,
      metadata: { note },
    });

    // Notify the case owner and invalidate prediction cache
    const approvedCase = await this.prisma.admissionCase.findUnique({
      where: { id: caseId },
      select: { userId: true, schoolId: true },
    });
    if (approvedCase?.userId) {
      fireAndForget(
        this.notificationService.createNotification(
          approvedCase.userId,
          NotificationType.CASE_REVIEW_APPROVED,
          { relatedId: caseId, relatedType: 'admission_case' },
        ),
        this.logger,
        'Failed to send case approval notification',
      );
    }

    // Invalidate prediction cache for the school so predictions use fresh data
    if (approvedCase?.schoolId && this.predictionHistorical) {
      fireAndForget(
        this.predictionHistorical.invalidateSchoolCache(approvedCase.schoolId),
        this.logger,
        'Failed to invalidate prediction cache',
      );
    }
  }

  /**
   * Reject a staging item
   */
  async rejectStagingItem(id: string, reviewerId: string, reason: string) {
    // Self-review prevention
    const preCheck = await this.prisma.dataImportStaging.findUnique({
      where: { id },
      select: { createdBy: true },
    });
    if (!preCheck) throw new NotFoundException('Staging item not found');
    if (preCheck.createdBy && preCheck.createdBy === reviewerId) {
      throw new ForbiddenException('Cannot review your own imports');
    }

    // Atomic status check
    const updated = await this.prisma.dataImportStaging.updateMany({
      where: { id, status: StagingStatus.PENDING },
      data: {
        status: StagingStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: reason,
      },
    });

    if (updated.count === 0) {
      const exists = await this.prisma.dataImportStaging.findUnique({
        where: { id },
      });
      if (!exists) throw new NotFoundException('Staging item not found');
      throw new ConflictException('Item already processed by another reviewer');
    }

    await this.auditLog.log({
      userId: reviewerId,
      action: AuditAction.STAGING_REJECTED,
      resource: 'staging',
      resourceId: id,
      metadata: { reason },
    });
  }

  /**
   * Reject a pending-review case
   */
  async rejectPendingCase(caseId: string, reviewerId: string, reason: string) {
    // Atomic: only reject if currently PENDING_REVIEW
    const updated = await this.prisma.admissionCase.updateMany({
      where: { id: caseId, reviewStatus: DataReviewStatus.PENDING_REVIEW },
      data: {
        reviewStatus: DataReviewStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      const exists = await this.prisma.admissionCase.findUnique({
        where: { id: caseId },
      });
      if (!exists) throw new NotFoundException('Case not found');
      throw new ConflictException('Case already reviewed');
    }

    await this.auditLog.log({
      userId: reviewerId,
      action: AuditAction.CASE_REVIEW_REJECTED,
      resource: 'case',
      resourceId: caseId,
      metadata: { reason },
    });

    // Notify the case owner
    const rejectedCase = await this.prisma.admissionCase.findUnique({
      where: { id: caseId },
      select: { userId: true },
    });
    if (rejectedCase?.userId) {
      fireAndForget(
        this.notificationService.createNotification(
          rejectedCase.userId,
          NotificationType.CASE_REVIEW_REJECTED,
          { relatedId: caseId, relatedType: 'admission_case' },
        ),
        this.logger,
        'Failed to send case rejection notification',
      );
    }
  }

  /**
   * Edit staging data and approve (atomic transaction to prevent race conditions)
   */
  async editAndApproveStagingItem(
    id: string,
    reviewerId: string,
    correctedData: Record<string, unknown>,
    note?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.dataImportStaging.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Staging item not found');
      if (item.status !== StagingStatus.PENDING) {
        throw new ConflictException(
          'Item already processed by another reviewer',
        );
      }

      // Self-review prevention
      if (item.createdBy && item.createdBy === reviewerId) {
        throw new ForbiddenException('Cannot review your own imports');
      }

      // Merge corrections into raw data
      const mergedData = {
        ...(item.rawData as Record<string, unknown>),
        ...correctedData,
      };

      // Atomically update data + status
      await tx.dataImportStaging.update({
        where: { id },
        data: {
          rawData: mergedData as any,
          status: StagingStatus.APPROVED,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNote: note,
        },
      });

      // Create the case from merged data
      let mergedId: string | undefined;
      if (item.dataType === DataType.CASE) {
        const data = mergedData as unknown as CaseStandardFormat;
        const caseRecord = await this.createCaseFromStandard(data, {
          qualityScore: item.qualityScore,
          reviewStatus: DataReviewStatus.APPROVED,
          userId: reviewerId,
          importBatchId: item.importBatchId ?? undefined,
        });
        mergedId = caseRecord.id;

        await tx.dataImportStaging.update({
          where: { id },
          data: { mergedId },
        });
      }

      await this.auditLog.log({
        userId: reviewerId,
        action: AuditAction.STAGING_APPROVED,
        resource: 'staging',
        resourceId: id,
        metadata: {
          changedFields: Object.keys(correctedData),
          mergedId,
          editedBeforeApproval: true,
        },
      });

      return { mergedId };
    });
  }

  /**
   * Batch approve/reject staging items
   */
  async batchReview(
    ids: string[],
    action: 'approve' | 'reject',
    reviewerId: string,
    reason?: string,
  ) {
    const results = { success: 0, failed: 0 };

    for (const id of ids) {
      try {
        if (action === 'approve') {
          await this.approveStagingItem(id, reviewerId);
        } else {
          await this.rejectStagingItem(
            id,
            reviewerId,
            reason ?? 'Batch rejected',
          );
        }
        results.success++;
      } catch {
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Get review stats
   */
  async getReviewStats() {
    const [
      pendingStaging,
      pendingCases,
      approvedToday,
      rejectedToday,
      totalStaging,
    ] = await Promise.all([
      this.prisma.dataImportStaging.count({
        where: { status: StagingStatus.PENDING },
      }),
      this.prisma.admissionCase.count({
        where: { reviewStatus: DataReviewStatus.PENDING_REVIEW },
      }),
      this.prisma.dataImportStaging.count({
        where: {
          status: StagingStatus.APPROVED,
          reviewedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.dataImportStaging.count({
        where: {
          status: StagingStatus.REJECTED,
          reviewedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.dataImportStaging.count(),
    ]);

    return {
      pendingStaging,
      pendingCases,
      totalPending: pendingStaging + pendingCases,
      approvedToday,
      rejectedToday,
      totalStaging,
    };
  }

  /**
   * Get import batches
   */
  async getImportBatches(page = 1, limit = 20) {
    const pageSize = Math.min(limit, 100);
    const skip = (page - 1) * pageSize;

    // Count distinct batches for pagination
    const batchCount = await this.prisma.dataImportStaging.groupBy({
      by: ['importBatchId'],
      where: { importBatchId: { not: null } },
    });
    const total = batchCount.length;

    // Get distinct batch IDs with counts
    const batches = await this.prisma.dataImportStaging.groupBy({
      by: ['importBatchId', 'source'],
      where: { importBatchId: { not: null } },
      _count: true,
      _min: { createdAt: true },
      orderBy: { _min: { createdAt: 'desc' } },
      skip,
      take: pageSize,
    });

    const items = batches.map((b) => ({
      id: b.importBatchId,
      source: b.source,
      itemCount: b._count,
      createdAt: b._min.createdAt,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Rollback an import batch (soft delete)
   */
  async rollbackBatch(importBatchId: string, userId: string) {
    // Remove staging items
    const stagingDeleted = await this.prisma.dataImportStaging.updateMany({
      where: { importBatchId },
      data: { status: StagingStatus.REJECTED, reviewNote: 'Batch rollback' },
    });

    // Remove cases from this batch
    const casesDeleted = await this.prisma.admissionCase.updateMany({
      where: { importBatchId },
      data: { reviewStatus: DataReviewStatus.REJECTED },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.CASE_BATCH_ROLLBACK,
      resource: 'batch',
      resourceId: importBatchId,
      metadata: {
        action: 'rollback',
        stagingDeleted: stagingDeleted.count,
        casesDeleted: casesDeleted.count,
      },
    });

    return {
      stagingRolledBack: stagingDeleted.count,
      casesRolledBack: casesDeleted.count,
    };
  }

  // ============================================
  // Internal Helpers
  // ============================================

  private async createCaseFromStandard(
    data: CaseStandardFormat,
    opts: {
      qualityScore: number;
      reviewStatus: DataReviewStatus;
      userId: string;
      importBatchId?: string;
    },
  ) {
    // Resolve schoolId if not provided
    let schoolId = data.schoolId;
    if (!schoolId && data.schoolName) {
      const school = await this.prisma.school.findFirst({
        where: {
          OR: [
            { nameNorm: data.schoolName.toLowerCase().trim() },
            { aliases: { has: data.schoolName } },
          ],
        },
        select: { id: true },
      });
      schoolId = school?.id;
    }

    if (!schoolId) {
      throw new BadRequestException(
        `Could not resolve school: ${data.schoolName}`,
      );
    }

    // Build GPA range string
    let gpaRange: string | undefined;
    if (data.gpa?.range) gpaRange = data.gpa.range;
    else if (data.gpa?.value) gpaRange = `${data.gpa.value}`;

    // Build SAT range string
    let satRange: string | undefined;
    if (data.sat?.range) satRange = data.sat.range;
    else if (data.sat?.total) satRange = `${data.sat.total}`;

    // Build ACT range string
    let actRange: string | undefined;
    if (data.act?.range) actRange = data.act.range;
    else if (data.act?.composite) actRange = `${data.act.composite}`;

    // Map result to enum
    const resultMap: Record<string, string> = {
      ADMITTED: 'ADMITTED',
      REJECTED: 'REJECTED',
      WAITLISTED: 'WAITLISTED',
      DEFERRED: 'DEFERRED',
    };

    // Build structured data from standard format
    const testScores = data.testScores?.length
      ? (data.testScores as unknown as Prisma.InputJsonValue)
      : undefined;
    const activities = data.activities?.length
      ? (data.activities as unknown as Prisma.InputJsonValue)
      : undefined;
    const awards = data.awards?.length
      ? (data.awards as unknown as Prisma.InputJsonValue)
      : undefined;

    const activityList =
      data.activityList ??
      data.activities
        ?.map((a) => `${a.category ?? ''} - ${a.description}`)
        .join('\n') ??
      undefined;

    return this.prisma.admissionCase.create({
      data: {
        userId: opts.userId,
        schoolId,
        year: data.year,
        round: data.round,
        result: (resultMap[data.result] ?? 'ADMITTED') as any,
        major: data.major,
        gpaRange,
        gpa9: data.gpa?.gpa9,
        gpa10: data.gpa?.gpa10,
        gpa11: data.gpa?.gpa11,
        gpa12: data.gpa?.gpa12,
        ucCappedGpa: data.gpa?.ucCapped,
        ucUncappedGpa: data.gpa?.ucUncapped,
        gpaScale: data.gpa?.scale,
        satRange,
        actRange,
        toeflRange:
          data.toefl?.range ??
          (data.toefl?.total ? `${data.toefl.total}` : undefined),
        tags: data.tags ?? [],
        ...(activityList && { activityList }),
        essayType: data.essays?.[0]?.type as any,
        essayPrompt: data.essays?.[0]?.prompt,
        essayContent: data.essays?.[0]?.content,
        promptNumber: data.essays?.[0]?.promptNumber,
        visibility: (data.visibility as Visibility) ?? Visibility.PUBLIC,
        qualityScore: opts.qualityScore,
        reviewStatus: opts.reviewStatus,
        source: data.source,
        importBatchId: opts.importBatchId,
        // Structured enrichment fields
        ...(testScores && { testScores }),
        ...(activities && { activities }),
        ...(awards && { awards }),
        ...(data.ap?.count !== undefined && { apCount: data.ap.count }),
        ...(data.ap?.subjects?.length && { apSubjects: data.ap.subjects }),
        ...(data.ib?.score !== undefined && { ibScore: data.ib.score }),
        ...(data.ib?.predicted !== undefined && {
          ibPredicted: data.ib.predicted,
        }),
        ...(data.highSchoolType && {
          highSchoolType: data.highSchoolType as any,
        }),
        ...(data.curriculumType && {
          curriculumType: data.curriculumType as any,
        }),
        ...(data.demographicTags?.length && {
          demographicTags: data.demographicTags,
        }),
        ...(data.financialAid && { financialAid: data.financialAid }),
        ...(data.enrollmentStatus && {
          enrollmentStatus: data.enrollmentStatus,
        }),
        ...(data.narrative && { narrative: data.narrative }),
      },
    });
  }
}
