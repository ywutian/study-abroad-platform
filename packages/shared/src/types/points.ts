/**
 * Hall refactor Phase 1 — shared PointAction mirror.
 *
 * We mirror the backend enum here as a `const` object so:
 *   1. mobile/web can reference action names without depending on @prisma/client
 *   2. governance checks can diff this against `points-config.service.ts`
 *
 * If you add a value to PointAction in `apps/api/src/modules/points/points-config.service.ts`,
 * add it here too. CI will catch drift via `lint:integration`.
 */
export const POINT_ACTION = {
  // Earning
  SUBMIT_CASE: 'SUBMIT_CASE',
  CASE_VERIFIED: 'CASE_VERIFIED',
  CASE_HELPFUL: 'CASE_HELPFUL',
  COMPLETE_PROFILE: 'COMPLETE_PROFILE',
  REFER_USER: 'REFER_USER',
  VERIFICATION_APPROVED: 'VERIFICATION_APPROVED',
  SWIPE_CORRECT: 'SWIPE_CORRECT',
  SUBMIT_REVIEW: 'SUBMIT_REVIEW',
  REVIEW_HELPFUL: 'REVIEW_HELPFUL',
  // Hall refactor Phase 1 — Tinder review + challenge + application progress
  REVIEW_SWIPE_COMPLETE: 'REVIEW_SWIPE_COMPLETE',
  REVIEW_HELPFUL_RECEIVED: 'REVIEW_HELPFUL_RECEIVED',
  REVIEWER_LEVEL_UP: 'REVIEWER_LEVEL_UP',
  CHALLENGE_COMPLETE: 'CHALLENGE_COMPLETE',
  CASE_STUDY_COMPLETE: 'CASE_STUDY_COMPLETE',
  PROFILE_RESEARCHED_5_SCHOOLS: 'PROFILE_RESEARCHED_5_SCHOOLS',
  ESSAY_DRAFT_COMPLETE: 'ESSAY_DRAFT_COMPLETE',
  ED_SUBMITTED: 'ED_SUBMITTED',

  // Spending
  VIEW_CASE_DETAIL: 'VIEW_CASE_DETAIL',
  AI_ANALYSIS: 'AI_ANALYSIS',
  MESSAGE_VERIFIED: 'MESSAGE_VERIFIED',
  AI_ESSAY_POLISH: 'AI_ESSAY_POLISH',
  AI_ESSAY_REVIEW: 'AI_ESSAY_REVIEW',
  AI_ESSAY_BRAINSTORM: 'AI_ESSAY_BRAINSTORM',
  AI_ESSAY_GALLERY: 'AI_ESSAY_GALLERY',
  AI_SCHOOL_RECOMMENDATION: 'AI_SCHOOL_RECOMMENDATION',
  AI_ACTIVITY_REFINE: 'AI_ACTIVITY_REFINE',
  RANKING_ANALYZED: 'RANKING_ANALYZED',
  REVIEW_REPORTED: 'REVIEW_REPORTED',
} as const;

export type PointAction = (typeof POINT_ACTION)[keyof typeof POINT_ACTION];
