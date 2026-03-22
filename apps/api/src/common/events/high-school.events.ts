/**
 * High School event definitions for the closed-loop architecture.
 *
 * Events are emitted via EventEmitter2 and consumed by:
 *   - NotificationService (admin alerts)
 *   - CacheInvalidationService (prediction cache clearing)
 *   - AuditLogService (change tracking)
 */

// === Event Names ===
export const HS_QUALITY_ASSESSED = 'high-school.quality-assessed';
export const HS_TIER_CHANGED = 'high-school.tier-changed';
export const HS_NEEDS_REVIEW = 'high-school.needs-review';
export const HS_CALIBRATION_DRIFT = 'high-school.calibration-drift';
export const HS_SUGGESTION_APPROVED = 'high-school.suggestion-approved';

// === Event Payloads ===

export interface HsQualityAssessedPayload {
  highSchoolId: string;
  name: string;
  score: number;
  grade: string;
  missingCritical: string[];
  source: 'admin' | 'suggestion' | 'import' | 'ai-evaluate' | 'niche-scrape';
}

export interface HsTierChangedPayload {
  highSchoolId: string;
  name: string;
  oldTier: number | null;
  newTier: number | null;
  changedBy: string; // userId or "system" or "ai-draft" or "calibration"
}

export interface HsNeedsReviewPayload {
  highSchoolId: string;
  name: string;
  reason: string;
  currentGrade: string;
}

export interface HsCalibrationDriftPayload {
  highSchoolId: string;
  name: string;
  currentTier: number;
  expectedAdmitRate: number;
  actualAdmitRate: number;
  caseCount: number;
  driftPercentage: number;
}

export interface HsSuggestionApprovedPayload {
  highSchoolId: string;
  suggestionId: string;
  name: string;
  submittedByUserIds: string[];
}
