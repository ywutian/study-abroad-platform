import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheInvalidationService } from '../../common/redis/cache-invalidation.service';
import {
  AuditLogService,
  AuditAction,
} from '../../common/services/audit-log.service';
import {
  HS_QUALITY_ASSESSED,
  HS_TIER_CHANGED,
  HS_NEEDS_REVIEW,
  HS_CALIBRATION_DRIFT,
  HS_SUGGESTION_APPROVED,
  type HsQualityAssessedPayload,
  type HsTierChangedPayload,
  type HsNeedsReviewPayload,
  type HsCalibrationDriftPayload,
  type HsSuggestionApprovedPayload,
} from '../../common/events/high-school.events';

@Injectable()
export class HighSchoolEventListener {
  private readonly logger = new Logger(HighSchoolEventListener.name);

  constructor(
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly auditLog: AuditLogService,
  ) {}

  @OnEvent(HS_QUALITY_ASSESSED)
  async handleQualityAssessed(payload: HsQualityAssessedPayload) {
    this.logger.log(
      `Quality assessed: ${payload.name} → Grade ${payload.grade} (score: ${payload.score}, source: ${payload.source})`,
    );

    await this.auditLog.log({
      userId: 'system',
      action: AuditAction.HIGH_SCHOOL_EVALUATED,
      resource: 'HighSchool',
      resourceId: payload.highSchoolId,
      metadata: {
        name: payload.name,
        score: payload.score,
        grade: payload.grade,
        source: payload.source,
        missingCritical: payload.missingCritical,
      },
    });
  }

  @OnEvent(HS_TIER_CHANGED)
  async handleTierChanged(payload: HsTierChangedPayload) {
    this.logger.warn(
      `Tier changed: ${payload.name} → ${payload.oldTier} → ${payload.newTier} (by: ${payload.changedBy})`,
    );

    await this.auditLog.log({
      userId: payload.changedBy,
      action: AuditAction.HIGH_SCHOOL_TIER_CHANGED,
      resource: 'HighSchool',
      resourceId: payload.highSchoolId,
      metadata: {
        name: payload.name,
        oldTier: payload.oldTier,
        newTier: payload.newTier,
      },
    });

    // Invalidate prediction caches for all students linked to this high school
    await this.cacheInvalidation.onHighSchoolChange(payload.highSchoolId);
  }

  @OnEvent(HS_NEEDS_REVIEW)
  handleNeedsReview(payload: HsNeedsReviewPayload) {
    this.logger.warn(
      `Review needed: ${payload.name} — ${payload.reason} (grade: ${payload.currentGrade})`,
    );
  }

  @OnEvent(HS_CALIBRATION_DRIFT)
  async handleCalibrationDrift(payload: HsCalibrationDriftPayload) {
    this.logger.warn(
      `Calibration drift: ${payload.name} (T${payload.currentTier}) — ` +
        `expected ${payload.expectedAdmitRate}%, actual ${payload.actualAdmitRate}% ` +
        `(${payload.caseCount} cases, drift ${payload.driftPercentage}pp)`,
    );

    await this.auditLog.log({
      userId: 'system',
      action: AuditAction.HIGH_SCHOOL_CALIBRATED,
      resource: 'HighSchool',
      resourceId: payload.highSchoolId,
      metadata: {
        name: payload.name,
        currentTier: payload.currentTier,
        expectedAdmitRate: payload.expectedAdmitRate,
        actualAdmitRate: payload.actualAdmitRate,
        caseCount: payload.caseCount,
        driftPercentage: payload.driftPercentage,
      },
    });
  }

  @OnEvent(HS_SUGGESTION_APPROVED)
  async handleSuggestionApproved(payload: HsSuggestionApprovedPayload) {
    this.logger.log(
      `Suggestion approved: ${payload.name} (${payload.submittedByUserIds.length} submitters)`,
    );

    await this.auditLog.log({
      userId: 'system',
      action: AuditAction.HIGH_SCHOOL_APPROVED,
      resource: 'HighSchool',
      resourceId: payload.highSchoolId,
      metadata: {
        name: payload.name,
        suggestionId: payload.suggestionId,
        submitterCount: payload.submittedByUserIds.length,
      },
    });
  }
}
