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

/**
 * Unified visual tone for dashboard surfaces.
 *
 * 2026-05 Phase 2.5c: Both `DashboardSeverity` (priority queue, deadlines)
 * and `DashboardReadinessStatus` (readiness items) carry **conceptually
 * different** semantics, but they collapse to the **same 4-color visual
 * vocabulary** when rendered. Previously each surface duplicated its own
 * className map, producing 4 places where "destructive/25 bg-destructive/5"
 * had to stay in lock-step.
 *
 * Centralizing tone here lets each consumer call `toneFromSeverity()` /
 * `toneFromReadinessStatus()` and then look up a single `toneMeta` map.
 * Adding/changing a visual token now touches exactly one place.
 *
 * Semantics:
 *   - critical: red — blocking issue / overdue / rejected
 *   - warning:  amber — needs attention soon
 *   - neutral:  muted — informational, no urgency
 *   - success:  green — done / ready / accepted
 */
export type DashboardTone = 'critical' | 'warning' | 'neutral' | 'success';

export function toneFromSeverity(severity: DashboardSeverity): DashboardTone {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    case 'normal':
    default:
      return 'neutral';
  }
}

export function toneFromReadinessStatus(status: DashboardReadinessStatus): DashboardTone {
  switch (status) {
    case 'blocked':
      return 'critical';
    case 'attention':
      return 'warning';
    case 'ready':
      return 'success';
    default:
      return 'neutral';
  }
}

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
  /**
   * `school` / `event` / `task` are real, dated items the user owns.
   * `prep` (2026-05 batch 4) is a SYNTHETIC, advisory row the dashboard
   * derives algorithmically by subtracting a fixed lead-time offset from
   * a real application deadline (e.g. "ask recommenders 6 weeks early").
   * It has no per-user completion state — it is a calendar nudge, not a
   * tracked task. Consumers may render `prep` rows with a lighter,
   * "suggested" visual treatment to distinguish them from hard deadlines.
   */
  type: 'school' | 'event' | 'task' | 'prep';
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
 * Dashboard application-stage selector.
 *
 * `/dashboard` is a stable workbench — its layout is constant for every
 * user. `deriveStage` does NOT drive layout structure; it only answers
 * "what should the focus card say / which sidebar tab opens by default /
 * what tone the copy uses".
 *
 * Real application season is structurally parallel (writing RD essays +
 * waiting on EA results + handling a waitlist, all at once). `primary`
 * only picks the focus card's subject; `parallel` explicitly carries
 * every other in-flight track so no application line is ever dropped
 * behind a single stage label.
 */
export type DashboardStage = 'onboarding' | 'planning' | 'executing' | 'submitting' | 'decision';

export interface DeriveStageInput {
  /** profile.targetSchoolCount */
  targetSchoolCount: number;
  /** profile.essayCount */
  essayCount: number;
  /** profile.completeness (0-100) */
  completeness: number;
  /** workbench.pipeline — optional; undefined is treated as all-zero. */
  pipeline?: DashboardPipeline | null;
}

export interface DeriveStageResult {
  /** Drives the focus card subject, default sidebar tab, and copy tone. */
  primary: DashboardStage;
  /**
   * Tracks running *in addition to* `primary`. The focus card renders an
   * "N other things in progress" hint from this, so the parallel reality
   * of application season is never hidden behind one stage label.
   */
  parallel: {
    hasInProgress: boolean;
    hasSubmitted: boolean;
    hasWaitlisted: boolean;
    hasAccepted: boolean;
  };
}

/**
 * Pure stage selector — zero side effects, safe to call on every render.
 * Pairs with `toneFromSeverity` as a dashboard-contract helper.
 */
export function deriveStage(input: DeriveStageInput): DeriveStageResult {
  const p = input.pipeline;
  const inProgress = p?.inProgress ?? 0;
  const notStarted = p?.notStarted ?? 0;
  const submitted = p?.submitted ?? 0;
  const accepted = p?.accepted ?? 0;
  const rejected = p?.rejected ?? 0;
  const waitlisted = p?.waitlisted ?? 0;

  const parallel = {
    hasInProgress: inProgress > 0,
    hasSubmitted: submitted > 0,
    hasWaitlisted: waitlisted > 0,
    hasAccepted: accepted > 0,
  };

  // Priority high→low — take the latest application phase as `primary`.
  // Each branch only sets `primary`; `parallel` always carries the rest.

  // 1. decision — an acceptance ALWAYS reframes the dashboard: a real
  //    choice (commit / compare aid) now exists, regardless of remaining
  //    RD work. A lone rejection/waitlist, by contrast, only counts as
  //    `decision` once the cycle has wound down — nothing left `inProgress`
  //    and nothing `notStarted`. Otherwise a single ED rejection in
  //    December would flip a student mid-RD-crunch to "results are in",
  //    burying their highest-stakes unsubmitted work. `withdrawn` never
  //    counts — a user-initiated drop is not "a result".
  const anyResult = accepted > 0 || waitlisted > 0 || rejected > 0;
  const cycleWoundDown = inProgress === 0 && notStarted === 0;
  if (accepted > 0 || (anyResult && cycleWoundDown)) {
    return { primary: 'decision', parallel };
  }
  // 2. submitting — submitted some, still writing others (parallel crunch).
  if (submitted > 0 && inProgress > 0) {
    return { primary: 'submitting', parallel };
  }
  // 3. executing — already working materials (timelines or essays started).
  if (inProgress > 0 || submitted > 0 || input.essayCount > 0) {
    return { primary: 'executing', parallel };
  }
  // 4. planning — has target schools but has not started any materials.
  if (input.targetSchoolCount > 0) {
    return { primary: 'planning', parallel };
  }
  // 5. onboarding — fallback: brand-new account.
  return { primary: 'onboarding', parallel };
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
    /**
     * 2026-05 Phase 2.7 #28: Self-reported applicant grade. Drives
     * grade-aware copy on the dashboard (a SENIOR sees a different
     * rhythm message than a FRESHMAN). Stored as a free-form string in
     * `Profile.grade` — well-known values: 'FRESHMAN' | 'SOPHOMORE' |
     * 'JUNIOR' | 'SENIOR' | 'GAP_YEAR'. Frontend gracefully degrades
     * any unknown / null value to the generic rhythm message.
     */
    grade?: string | null;
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
  /**
   * 2026-05 Phase 2.7 #31: 3 personalized QuickAsk suggestion chips
   * generated server-side from the user's profile (targetMajor) +
   * school list (first added school name). Frontend uses these in
   * preference to the hardcoded i18n suggestions; falls back to the
   * generic chips when this field is undefined (e.g., frontend
   * fallback or backend hasn't computed yet).
   *
   * Each string is already localized — backend reads the request locale.
   */
  quickAskSuggestions?: [string, string, string];
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
