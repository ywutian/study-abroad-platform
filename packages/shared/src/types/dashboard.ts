/**
 * Dashboard workbench types — shared between API (which produces them in
 * dashboard.service.ts) and Web (which consumes + falls back to a local
 * version when the API didn't return one).
 *
 * History: Originally duplicated inline in both apps. After PRs #170-#177
 * the structure grew (readiness items × 5, pipeline + recentDecisions)
 * and silent drift became a real risk. Centralizing here ensures both
 * sides change together. The frontend's richer fields (contributionScore,
 * contributionDenom) are the canonical shape; the API populates them so
 * the readiness total = sum of items' contributions, eliminating the
 * "Readiness 20% / Profile 0%" UX contradiction.
 */

export type DashboardSeverity = 'critical' | 'warning' | 'normal' | 'success';
export type DashboardReadinessStatus = 'blocked' | 'attention' | 'ready';

export type DashboardPriorityKind =
  | 'profile'
  | 'school-list'
  | 'timeline'
  | 'timeline-task'
  | 'essay'
  | 'prediction'
  | 'deadline';

export interface DashboardReadinessItem {
  key: 'profile' | 'schools' | 'essays' | 'timeline' | 'prediction';
  label: string;
  /**
   * Free-text value still used as fallback when contribution* is absent.
   * New code should prefer the contribution-score pair (X/Y) to keep
   * Readiness total = sum of items' contributions, eliminating the
   * "Readiness 20% / Profile 0%" visual contradiction.
   */
  value: string;
  /** Score this item contributes to the overall Readiness total. */
  contributionScore?: number;
  /** Max possible contribution from this item. */
  contributionDenom?: number;
  status: DashboardReadinessStatus;
  href: string;
  description: string;
}

export interface DashboardPriorityItem {
  id: string;
  kind: DashboardPriorityKind;
  severity: DashboardSeverity;
  title: string;
  description: string;
  href: string;
  dueAt?: string | null;
  daysLeft?: number | null;
  mutation?: {
    type: 'timeline-task-toggle';
    endpoint: string;
  };
}

export interface DashboardDeadlineItem {
  id: string;
  type: 'school' | 'event' | 'task';
  title: string;
  subtitle: string;
  dueAt: string;
  daysLeft: number;
  severity: DashboardSeverity;
  href: string;
}

export type DashboardDecisionStatus =
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WAITLISTED'
  | 'WITHDRAWN';

export interface DashboardRecentDecision {
  id: string;
  schoolId: string;
  schoolName: string;
  round: string;
  status: DashboardDecisionStatus;
  decidedAt: string;
}

/**
 * Pipeline snapshot — counts of ApplicationTimeline rows by status,
 * plus per-school decision rows for the inline list. Optional because
 * the frontend fallback (createFallbackWorkbench) doesn't have raw
 * timeline data.
 */
export interface DashboardPipeline {
  notStarted: number;
  inProgress: number;
  submitted: number;
  accepted: number;
  rejected: number;
  waitlisted: number;
  withdrawn: number;
  recentDecisions: DashboardRecentDecision[];
}

export interface DashboardWorkbench {
  readiness: {
    score: number;
    status: DashboardReadinessStatus;
    items: DashboardReadinessItem[];
  };
  metrics: {
    due7: number;
    due30: number;
    overdueTasks: number;
    missingTimelineCount: number;
    balancedSchoolList: boolean;
  };
  priorityQueue: DashboardPriorityItem[];
  deadlineStream: DashboardDeadlineItem[];
  pipeline?: DashboardPipeline;
}

/**
 * Top-level dashboard payload returned by `GET /users/dashboard`.
 *
 * 2026-05: Centralized after PR #178 to prevent the same drift class
 * that the workbench types had. Previously the API called this
 * `DashboardSummary` and the web called the SAME shape `DashboardData`,
 * with three subtle drifts (hasEducation / upcomingPersonalEvents /
 * workbench were all `required` in the API but `optional` in the web —
 * over-defensive aliasing that masked real bugs if the API ever
 * stopped populating them).
 *
 * The API guarantees all listed fields are present (it builds the
 * shape via `buildWorkbench()` and emits empty arrays where there's no
 * data). `DashboardData` is exported as an alias for back-compat with
 * existing web consumers.
 */
export interface DashboardSummary {
  user: {
    email: string;
    role: string;
    points: number;
    createdAt: string;
    nickname?: string;
  };
  profile: {
    completeness: number;
    hasTestScores: boolean;
    hasActivities: boolean;
    hasAwards: boolean;
    hasEducation: boolean;
    targetSchoolCount: number;
    essayCount: number;
    schoolTiers: {
      reach: number;
      target: number;
      safety: number;
    };
  };
  stats: {
    followers: number;
    following: number;
    cases: number;
    predictions: number;
  };
  pendingTasks: {
    total: number;
    byType: { type: string; count: number }[];
    profileGaps: string[];
  };
  upcomingDeadlines: Array<{
    id: string;
    schoolName: string;
    round: string;
    deadline: string;
    daysLeft: number;
  }>;
  upcomingPersonalEvents: Array<{
    id: string;
    title: string;
    category: string;
    deadline: string | null;
    eventDate: string | null;
    daysLeft: number;
  }>;
  recentActivity: Array<{
    type: string;
    title: string;
    description: string;
    createdAt: string;
  }>;
  workbench: DashboardWorkbench;
  /**
   * 2026-05 Phase 2c: Latest AI essay feedback (optional). Null when
   * the user has no essays or no AI runs yet. See DashboardEssayCoach.
   */
  essayCoach?: DashboardEssayCoach | null;
  /**
   * 2026-05 Phase 2b: 5 high-value backend signals (assessment,
   * recommendation, verification, chatUnread + points already in user)
   * that were previously invisible to the dashboard. Optional so the
   * frontend fallback (createFallbackWorkbench) doesn't need to set it.
   */
  signals?: DashboardSignals;
}

/**
 * 2026-05 Phase 2b: Extended signals surface — 5 high-value backend
 * states that the dashboard had no visibility into until now. Each
 * field below was already reachable via its own dedicated route, but
 * never aggregated for the dashboard. See plan Phase 2b.
 */
export interface DashboardSignals {
  /**
   * MBTI / Holland assessment result codes (e.g., 'INTJ', 'RIA').
   * Both null when the user hasn't completed any assessment.
   */
  assessment: {
    mbti: string | null;
    holland: string | null;
    completedAt: string | null;
  };
  /** Total number of school-recommendation runs the user has done. */
  recommendationCount: number;
  /**
   * 'unverified': no VerificationRequest, or last request was REJECTED
   * 'pending':    most recent request is PENDING
   * 'verified':   most recent request was APPROVED
   */
  verificationStatus: 'unverified' | 'pending' | 'verified';
  /** Count of unread messages across all conversations the user is in. */
  chatUnread: number;
}

/**
 * 2026-05 Phase 2c: Most recent AI feedback across all user essays.
 * Powers the dashboard `<DashboardEssayCoach />` surface — a 1-click
 * path from the dashboard into continued essay work.
 *
 * Null when the user has no essays or no AI results yet (the
 * component renders nothing in that case).
 */
export interface DashboardEssayCoach {
  /** The essay this feedback belongs to. */
  essayId: string;
  /** Essay title for the card heading. */
  essayTitle: string;
  /** 'review' = analysis with suggestions; 'polish' = rewrite. */
  type: 'review' | 'polish' | string;
  /**
   * One actionable suggestion to display inline. Null when the result
   * type doesn't have suggestions (e.g. polish), in which case the UI
   * falls back to a generic "continue polishing" prompt.
   */
  suggestion: string | null;
  /** ISO timestamp of when this AI feedback was generated. */
  createdAt: string;
}

/**
 * Web-side alias for {@link DashboardSummary}. Kept so existing web
 * imports (`type DashboardData`) continue to work without churn.
 */
export type DashboardData = DashboardSummary;
