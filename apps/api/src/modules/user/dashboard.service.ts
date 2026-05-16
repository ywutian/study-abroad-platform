import { Injectable } from '@nestjs/common';
import {
  type DashboardEssayCoach,
  type DashboardPriorityKind,
  type DashboardSeverity,
  type DashboardSignals,
  type DashboardSummary,
  type DashboardWorkbench,
} from '@study-abroad/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { getSchoolDisplayName } from '../../common/utils/locale.util';
import { calculateProfileCompleteness } from '../profile/profile-completeness.util';

// 2026-05: Re-export so consumers (e.g. user.controller.ts type imports)
// don't break. The interfaces live in @study-abroad/shared so API + Web
// can never silently drift on the dashboard contract — see PR #178 for
// the workbench types and the follow-up that brought DashboardSummary
// over too.
export type { DashboardSummary, DashboardWorkbench };

type DashboardDeadlineItem = DashboardSummary['upcomingDeadlines'][number];

// DashboardWorkbench, DashboardPriorityKind, DashboardSeverity now live in
// @study-abroad/shared (imported above) so API + Web can't drift.
// Local-only type alias kept for the small number of internal helper
// signatures that referenced the old name.

type DashboardPriorityTaskSource = {
  id: string;
  title: string;
  type: string;
  dueDate: Date | null;
  timeline: {
    id: string;
    schoolName: string;
    round: string;
    school?: { name: string; nameZh: string | null } | null;
  };
};

type PointHistorySource = {
  action: string;
  points: number;
  createdAt: Date;
};

type SchoolDeadlineSource = {
  id: string;
  year: number;
  round: string;
  applicationDeadline: Date;
};

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardSummary(
    userId: string,
    locale = 'zh',
  ): Promise<DashboardSummary> {
    // 并行获取所有数据
    const now = new Date();
    const [
      user,
      profile,
      followStats,
      casesCount,
      predictionsCount,
      timelines,
      pointHistory,
      schoolListCount,
      schoolTierGroups,
      pendingTaskCount,
      pendingTaskTypes,
      personalEvents,
      schoolListWithDeadlines,
      priorityTasks,
      overdueTaskCount,
      timelineCoverage,
      pipelineGroups,
      recentDecisionRows,
      latestEssayAiResult,
      // Phase 2b signals — 5 previously dashboard-invisible states
      assessmentResults,
      recommendationCount,
      latestVerificationRow,
      chatUnreadRows,
    ] = await Promise.all([
      // 用户信息
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, role: true, points: true, createdAt: true },
      }),

      // 档案信息
      this.prisma.profile.findUnique({
        where: { userId },
        include: {
          testScores: { select: { id: true } },
          activities: { select: { id: true } },
          awards: { select: { id: true } },
          education: { select: { id: true } },
          essays: { select: { id: true } },
        },
      }),

      // 关注统计
      this.prisma.$transaction([
        this.prisma.follow.count({ where: { followingId: userId } }),
        this.prisma.follow.count({ where: { followerId: userId } }),
      ]),

      // 案例数
      this.prisma.admissionCase.count({ where: { userId } }),

      // 预测数 — 2026-05 Phase 1 Bug 3: count ALL predictions for this
      // user's profile here. The orphan-filtering (only counting predictions
      // whose schoolId is still in the user's SchoolListItem) happens
      // post-query via `validPredictionsCount` below, since PredictionResult
      // has no relation to SchoolListItem in the Prisma schema (only the
      // schoolId scalar exists). This resolves the "105 predictions + 0
      // schools" production contradiction without a DB write or schema
      // change. See docs/architecture/dashboard-invariants.md.
      this.prisma.predictionResult.count({
        where: { profile: { userId } },
      }),

      // 时间线（即将截止）
      this.prisma.applicationTimeline.findMany({
        where: {
          userId,
          status: {
            notIn: [
              'SUBMITTED',
              'ACCEPTED',
              'REJECTED',
              'WAITLISTED',
              'WITHDRAWN',
            ],
          },
          deadline: { gte: now },
        },
        orderBy: { deadline: 'asc' },
        take: 10,
        include: {
          school: { select: { name: true, nameZh: true } },
        },
      }),

      // 最近积分变动
      this.prisma.pointHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // 选校清单总数
      this.prisma.schoolListItem.count({ where: { userId } }),

      // 选校 Tier 分布
      this.prisma.schoolListItem.groupBy({
        by: ['tier'],
        where: { userId },
        _count: { tier: true },
      }),

      // 待办任务（未完成的 ApplicationTask）
      this.prisma.applicationTask.count({
        where: { timeline: { userId }, completed: false },
      }),

      // 待办任务按类型分组
      this.prisma.applicationTask.groupBy({
        by: ['type'],
        where: { timeline: { userId }, completed: false },
        _count: { type: true },
      }),

      // 即将到期的个人事件（比赛/考试）：deadline 或 eventDate 在未来
      this.prisma.personalEvent.findMany({
        where: {
          userId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          OR: [{ deadline: { gte: now } }, { eventDate: { gte: now } }],
        },
        orderBy: [{ deadline: 'asc' }, { eventDate: 'asc' }],
        take: 5,
        select: {
          id: true,
          title: true,
          category: true,
          deadline: true,
          eventDate: true,
        },
      }),

      // 选校清单中学校的截止日期（SchoolDeadline），用于补充没有生成 ApplicationTimeline 的学校
      this.prisma.schoolListItem.findMany({
        where: { userId },
        select: {
          schoolId: true,
          round: true,
          school: {
            select: {
              name: true,
              nameZh: true,
              deadlines: {
                select: {
                  id: true,
                  year: true,
                  round: true,
                  applicationDeadline: true,
                },
                orderBy: [{ applicationDeadline: 'asc' }, { year: 'desc' }],
              },
            },
          },
        },
      }),

      // 首页优先级队列：最临近的未完成申请任务
      this.prisma.applicationTask.findMany({
        where: { timeline: { userId }, completed: false },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        take: 8,
        select: {
          id: true,
          title: true,
          type: true,
          dueDate: true,
          timeline: {
            select: {
              id: true,
              schoolName: true,
              round: true,
              school: { select: { name: true, nameZh: true } },
            },
          },
        },
      }),

      this.prisma.applicationTask.count({
        where: {
          timeline: { userId },
          completed: false,
          dueDate: { lt: now },
        },
      }),

      this.prisma.applicationTimeline.findMany({
        where: {
          userId,
          status: {
            notIn: [
              'SUBMITTED',
              'ACCEPTED',
              'REJECTED',
              'WAITLISTED',
              'WITHDRAWN',
            ],
          },
        },
        select: { schoolId: true, round: true },
      }),

      // 2026-05: Pipeline snapshot — count timelines per ApplicationStatus
      // so the dashboard can surface "X submitted, Y awaiting decision, Z
      // accepted" instead of pretending submitted schools don't exist.
      this.prisma.applicationTimeline.groupBy({
        by: ['status'],
        where: { userId },
        _count: { status: true },
      }),

      // 2026-05: Per-school decisions — top 5 most-recently-updated rows
      // whose status is past IN_PROGRESS. Surfaced inline beneath the
      // pipeline pills so users see "Stanford EA — Accepted (3d ago)"
      // instead of just opaque counts.
      this.prisma.applicationTimeline.findMany({
        where: {
          userId,
          status: {
            in: [
              'SUBMITTED',
              'ACCEPTED',
              'REJECTED',
              'WAITLISTED',
              'WITHDRAWN',
            ],
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          schoolId: true,
          schoolName: true,
          round: true,
          status: true,
          updatedAt: true,
          school: { select: { name: true, nameZh: true } },
        },
      }),

      // 2026-05 Phase 2c: Latest essay AI feedback across all user essays.
      // Used by the dashboard <DashboardEssayCoach /> surface to give
      // users a 1-click path from the dashboard back into continued essay
      // work. Returns null when the user has no essays / no AI runs.
      this.prisma.essayAIResult.findFirst({
        where: { essay: { profile: { userId } } },
        orderBy: { createdAt: 'desc' },
        select: {
          type: true,
          suggestions: true,
          createdAt: true,
          essay: { select: { id: true, title: true } },
        },
      }),

      // 2026-05 Phase 2b — 5 missing signals previously dashboard-invisible.
      // 1. Assessment results (latest per type, MBTI + Holland)
      this.prisma.assessmentResult.findMany({
        where: {
          userId,
          assessment: { type: { in: ['MBTI', 'HOLLAND'] } },
        },
        orderBy: { completedAt: 'desc' },
        select: {
          result: true,
          completedAt: true,
          assessment: { select: { type: true } },
        },
      }),

      // 2. Recommendation count (total runs)
      this.prisma.schoolRecommendation.count({ where: { userId } }),

      // 3. Verification status — latest request determines state
      this.prisma.verificationRequest.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      }),

      // 4. Chat unread total (raw SQL mirrors chat.service.getTotalUnreadCount)
      this.prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count
        FROM "Message" m
        INNER JOIN "ConversationParticipant" cp
          ON cp."conversationId" = m."conversationId" AND cp."userId" = ${userId}
        WHERE m."senderId" != ${userId}
          AND m."createdAt" > COALESCE(cp."lastReadAt", '1970-01-01'::timestamp)`,
    ]);

    // 计算档案完成度（传入选校数据用于权重计算）
    const { completeness, profileGaps } = this.calculateProfileCompleteness(
      profile,
      schoolListCount,
    );

    // 解析 Tier 分布
    const schoolTiers = { reach: 0, target: 0, safety: 0 };
    for (const row of schoolTierGroups) {
      const tierKey = row.tier.toLowerCase() as keyof typeof schoolTiers;
      if (tierKey in schoolTiers) {
        schoolTiers[tierKey] = row._count.tier;
      }
    }

    // 待办任务按类型
    const tasksByType = pendingTaskTypes.map((row) => ({
      type: row.type,
      count: row._count.type,
    }));

    // 计算截止日期：来自已生成的 ApplicationTimeline
    const timelineDeadlines = timelines
      .filter((t) => t.deadline !== null)
      .map((t) => ({
        id: t.id,
        schoolName: t.school
          ? getSchoolDisplayName(t.school, locale)
          : 'Unknown',
        round: t.round,
        deadline: t.deadline!.toISOString(),
        daysLeft: Math.ceil(
          (t.deadline!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      }));

    // 补充来自 SchoolDeadline 的截止日期（选校清单中但尚未生成 Timeline 的学校）
    const timelineSchoolRounds = new Set(
      timelines.map((t) => this.schoolRoundKey(t.schoolId, t.round)),
    );
    const schoolDeadlineItems: DashboardDeadlineItem[] = [];
    for (const item of schoolListWithDeadlines) {
      if (!item.school?.deadlines) continue;

      const selectedDeadlines = this.selectUpcomingSchoolDeadlines(
        item.school.deadlines,
        item.round,
        now,
      );

      for (const { deadline: dl, effectiveDate } of selectedDeadlines) {
        if (
          timelineSchoolRounds.has(this.schoolRoundKey(item.schoolId, dl.round))
        )
          continue;
        schoolDeadlineItems.push({
          id: dl.id,
          schoolName: getSchoolDisplayName(item.school, locale),
          round: dl.round,
          deadline: effectiveDate.toISOString(),
          daysLeft: Math.ceil(
            (effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          ),
        });
      }
    }

    const upcomingDeadlines = [...timelineDeadlines, ...schoolDeadlineItems]
      .sort(
        (a, b) =>
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
      )
      .slice(0, 10);

    const upcomingPersonalEvents = personalEvents.map((ev) => {
      const date = ev.deadline ?? ev.eventDate!;
      const daysLeft = Math.ceil(
        (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        id: ev.id,
        title: ev.title,
        category: ev.category,
        deadline: ev.deadline?.toISOString() ?? null,
        eventDate: ev.eventDate?.toISOString() ?? null,
        daysLeft,
      };
    });

    // 构建最近活动
    const recentActivity = this.buildRecentActivity(pointHistory);

    // 2026-05: Reduce ApplicationStatus groupBy into a stable shape with
    // every status defaulted to 0. Frontend renders the strip only when
    // the user has at least one school past IN_PROGRESS, so no UI noise
    // for brand-new accounts. recentDecisions carries per-school details
    // for rendering inline below the count pills.
    const pipeline: NonNullable<DashboardWorkbench['pipeline']> = {
      notStarted: 0,
      inProgress: 0,
      submitted: 0,
      accepted: 0,
      rejected: 0,
      waitlisted: 0,
      withdrawn: 0,
      recentDecisions: recentDecisionRows.map((row) => ({
        id: row.id,
        schoolId: row.schoolId,
        // Prefer relation name when available (handles renames after
        // ApplicationTimeline.schoolName was first set); fall back to the
        // denormalized cached column.
        schoolName: getSchoolDisplayName(
          row.school ?? { name: row.schoolName, nameZh: null },
          locale,
        ),
        round: row.round,
        status: row.status as
          | 'SUBMITTED'
          | 'ACCEPTED'
          | 'REJECTED'
          | 'WAITLISTED'
          | 'WITHDRAWN',
        decidedAt: row.updatedAt.toISOString(),
      })),
    };
    for (const row of pipelineGroups) {
      const count = row._count.status;
      switch (row.status) {
        case 'NOT_STARTED':
          pipeline.notStarted = count;
          break;
        case 'IN_PROGRESS':
          pipeline.inProgress = count;
          break;
        case 'SUBMITTED':
          pipeline.submitted = count;
          break;
        case 'ACCEPTED':
          pipeline.accepted = count;
          break;
        case 'REJECTED':
          pipeline.rejected = count;
          break;
        case 'WAITLISTED':
          pipeline.waitlisted = count;
          break;
        case 'WITHDRAWN':
          pipeline.withdrawn = count;
          break;
      }
    }

    // 2026-05 Phase 1 Bug 3: Compute "valid" predictionsCount — only
    // predictions whose schoolId is still in the user's SchoolListItem.
    // Resolves the "105 predictions + 0 schools" production contradiction
    // by filtering orphan records from the user-facing count without
    // writing to the DB. PredictionResult.schoolId has no Prisma relation
    // to SchoolListItem, so we use a 2-step query: (1) above we got the
    // raw count of all predictions; (2) here we count predictions whose
    // schoolId is in the user's current school list.
    const userSchoolIds = schoolListWithDeadlines.map((item) => item.schoolId);
    const validPredictionsCount =
      userSchoolIds.length === 0
        ? 0
        : await this.prisma.predictionResult.count({
            where: {
              profile: { userId },
              schoolId: { in: userSchoolIds },
            },
          });

    const workbench = this.buildWorkbench({
      locale,
      completeness,
      profileGaps,
      schoolListCount,
      schoolTiers,
      essayCount: profile?.essays?.length || 0,
      predictionsCount: validPredictionsCount,
      pendingTaskCount,
      overdueTaskCount,
      upcomingDeadlines,
      upcomingPersonalEvents,
      priorityTasks,
      timelineCoverage,
      schoolListWithDeadlines,
      pipeline,
      now,
    });

    return {
      user: {
        email: user?.email || '',
        role: user?.role || 'USER',
        points: user?.points || 0,
        createdAt: user?.createdAt.toISOString() || '',
        nickname: profile?.nickname || undefined,
      },
      profile: {
        completeness,
        hasTestScores: (profile?.testScores?.length || 0) > 0,
        hasActivities: (profile?.activities?.length || 0) > 0,
        hasAwards: (profile?.awards?.length || 0) > 0,
        hasEducation: (profile?.education?.length || 0) > 0,
        targetSchoolCount: schoolListCount,
        essayCount: profile?.essays?.length || 0,
        schoolTiers,
        // 2026-05 Phase 2.7 #28: surface grade so the dashboard can show
        // grade-aware copy (a SENIOR vs a SOPHOMORE need different
        // rhythm framing).
        grade: profile?.grade ?? null,
      },
      stats: {
        followers: followStats[0],
        following: followStats[1],
        cases: casesCount,
        // 2026-05 Phase 1 Bug 3: expose valid-only count (orphans filtered).
        // See `validPredictionsCount` above for the rationale.
        predictions: validPredictionsCount,
      },
      pendingTasks: {
        total: pendingTaskCount,
        byType: tasksByType,
        profileGaps,
      },
      upcomingDeadlines,
      upcomingPersonalEvents,
      recentActivity,
      workbench,
      // 2026-05 Phase 2c: latest AI essay feedback for the
      // <DashboardEssayCoach /> card. Null when user has no AI runs.
      essayCoach: this.buildEssayCoach(latestEssayAiResult),
      // 2026-05 Phase 2b: 5 missing signals surfaced for the Hub.
      signals: this.buildSignals({
        assessmentResults,
        recommendationCount,
        latestVerificationRow,
        chatUnreadRows,
      }),
    };
  }

  /**
   * Phase 2b: Reduce 5 raw query results into the dashboard
   * `DashboardSignals` shape. Each signal degrades to a sensible
   * "nothing yet" value when the user has no data — the UI then
   * decides whether to render the tile or hide it.
   */
  private buildSignals(input: {
    assessmentResults: Array<{
      result: unknown;
      completedAt: Date;
      assessment: { type: string };
    }>;
    recommendationCount: number;
    latestVerificationRow: { status: string } | null;
    chatUnreadRows: Array<{ count: bigint }>;
  }): DashboardSignals {
    // 1. Assessment: pick latest MBTI + latest Holland; extract code
    //    from `result` JSON (LLM stores as `{ code: 'INTJ', ... }` or
    //    similar; if the shape differs, suggestion is null and the
    //    Hub falls back to "completed but unparsed").
    const mbtiRow = input.assessmentResults.find(
      (r) => r.assessment.type === 'MBTI',
    );
    const hollandRow = input.assessmentResults.find(
      (r) => r.assessment.type === 'HOLLAND',
    );
    const latestAssessmentAt = input.assessmentResults[0]?.completedAt ?? null;

    const extractCode = (result: unknown): string | null => {
      if (result && typeof result === 'object') {
        const obj = result as Record<string, unknown>;
        // Common field names across our LLM prompts
        for (const key of ['code', 'type', 'mbtiType', 'hollandCode']) {
          const value = obj[key];
          if (typeof value === 'string' && value.trim()) {
            return value.trim();
          }
        }
      }
      return null;
    };

    // 2-3. Verification status mapping
    let verificationStatus: DashboardSignals['verificationStatus'] =
      'unverified';
    if (input.latestVerificationRow) {
      switch (input.latestVerificationRow.status) {
        case 'APPROVED':
          verificationStatus = 'verified';
          break;
        case 'PENDING':
          verificationStatus = 'pending';
          break;
        case 'REJECTED':
        default:
          verificationStatus = 'unverified';
      }
    }

    return {
      assessment: {
        mbti: mbtiRow ? extractCode(mbtiRow.result) : null,
        holland: hollandRow ? extractCode(hollandRow.result) : null,
        completedAt: latestAssessmentAt
          ? latestAssessmentAt.toISOString()
          : null,
      },
      recommendationCount: input.recommendationCount,
      verificationStatus,
      chatUnread: Number(input.chatUnreadRows[0]?.count ?? 0),
    };
  }

  /**
   * Phase 2c: Reduce the raw EssayAIResult row into the dashboard's
   * lightweight `DashboardEssayCoach` shape. Picks the first
   * actionable suggestion from `suggestions` JSON for review-type
   * results; polish results get a null suggestion and the UI falls
   * back to a generic "continue polishing" prompt.
   */
  private buildEssayCoach(
    row: {
      type: string;
      suggestions: unknown;
      createdAt: Date;
      essay: { id: string; title: string };
    } | null,
  ): DashboardEssayCoach | null {
    if (!row) return null;

    let suggestion: string | null = null;
    if (Array.isArray(row.suggestions) && row.suggestions.length > 0) {
      const first = row.suggestions[0];
      if (typeof first === 'string' && first.trim()) {
        suggestion = first.trim();
      } else if (
        first &&
        typeof first === 'object' &&
        'text' in first &&
        typeof (first as { text: unknown }).text === 'string'
      ) {
        suggestion = (first as { text: string }).text.trim() || null;
      }
    }

    return {
      essayId: row.essay.id,
      essayTitle: row.essay.title,
      type: row.type,
      suggestion,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private buildWorkbench({
    locale,
    completeness,
    profileGaps,
    schoolListCount,
    schoolTiers,
    essayCount,
    predictionsCount,
    pendingTaskCount,
    overdueTaskCount,
    upcomingDeadlines,
    upcomingPersonalEvents,
    priorityTasks,
    timelineCoverage,
    schoolListWithDeadlines,
    pipeline,
    now,
  }: {
    locale: string;
    completeness: number;
    profileGaps: string[];
    schoolListCount: number;
    schoolTiers: { reach: number; target: number; safety: number };
    essayCount: number;
    predictionsCount: number;
    pendingTaskCount: number;
    overdueTaskCount: number;
    upcomingDeadlines: DashboardSummary['upcomingDeadlines'];
    upcomingPersonalEvents: DashboardSummary['upcomingPersonalEvents'];
    priorityTasks: DashboardPriorityTaskSource[];
    timelineCoverage: { schoolId: string; round: string }[];
    schoolListWithDeadlines: Array<{ schoolId: string; round: string | null }>;
    pipeline: NonNullable<DashboardWorkbench['pipeline']>;
    now: Date;
  }): DashboardWorkbench {
    const balancedSchoolList =
      schoolTiers.reach > 0 && schoolTiers.target > 0 && schoolTiers.safety > 0;
    const missingTimelineCount = this.countMissingTimelines(
      schoolListWithDeadlines,
      timelineCoverage,
    );
    const deadlineStream = this.buildDeadlineStream(
      upcomingDeadlines,
      upcomingPersonalEvents,
      priorityTasks,
      locale,
      now,
    );
    const due7 = deadlineStream.filter(
      (item) => item.daysLeft >= 0 && item.daysLeft <= 7,
    ).length;
    const due30 = deadlineStream.filter(
      (item) => item.daysLeft >= 0 && item.daysLeft <= 30,
    ).length;
    // 2026-05: Prediction added as 5th readiness item.
    // Rebalanced weights: Profile 40 + Schools 20 + Essays 15 + Timeline 10 +
    // Prediction 15 = 100 (with timeline reduced to make room for prediction).
    // Per-item contribution scores must match the items[] block below so that
    // users can audit "Readiness 65" against the five sub-scores.
    const profileContribution = Math.round(completeness * 0.4);
    const schoolsContribution = Math.round(
      Math.min(schoolListCount / 6, 1) * 20,
    );
    const essaysContribution = essayCount > 0 ? 15 : 0;
    // Timeline rolls together missing-timeline coverage (selected schools
    // without a timeline) and pending tasks. Each gap subtracts; perfect
    // state = 10. Cap at 0.
    //
    // 2026-05 Phase 1 Bug 4: with 0 schools, missingTimelineCount===0 is
    // vacuously true (no schools means no missing timelines), so the
    // previous formula awarded a perfect 10/10 — confusing users into
    // thinking they were ahead. Now: schoolListCount === 0 → 0/10.
    const timelineContribution =
      schoolListCount === 0
        ? 0
        : missingTimelineCount === 0 && pendingTaskCount === 0
          ? 10
          : Math.max(
              0,
              8 - missingTimelineCount * 2 - Math.min(pendingTaskCount, 6),
            );
    const predictionContribution = predictionsCount > 0 ? 15 : 0;
    const readinessScore = Math.min(
      100,
      profileContribution +
        schoolsContribution +
        essaysContribution +
        timelineContribution +
        predictionContribution,
    );
    // Prediction needs at least one school AND a passable profile (40%+) to
    // be runnable. Otherwise the row should communicate "blocked by upstream"
    // not "go run prediction now".
    const predictionEligible = schoolListCount > 0 && completeness >= 40;
    const priorityQueue = this.buildPriorityQueue({
      locale,
      completeness,
      profileGaps,
      schoolListCount,
      balancedSchoolList,
      essayCount,
      predictionsCount,
      missingTimelineCount,
      priorityTasks,
      overdueTaskCount,
      due30,
      now,
    });

    return {
      readiness: {
        score: readinessScore,
        status:
          readinessScore >= 85 &&
          priorityQueue.every((item) => item.severity !== 'critical')
            ? 'ready'
            : readinessScore >= 55
              ? 'attention'
              : 'blocked',
        items: [
          {
            key: 'profile',
            label: this.t(locale, '申请档案', 'Profile'),
            value: `${profileContribution}/40`,
            status:
              completeness >= 75
                ? 'ready'
                : completeness >= 40
                  ? 'attention'
                  : 'blocked',
            href: '/profile',
            description:
              profileGaps.length > 0
                ? this.t(
                    locale,
                    `还有 ${profileGaps.length} 项关键信号待补齐`,
                    `${profileGaps.length} key signals still need attention`,
                  )
                : this.t(
                    locale,
                    '核心申请信号已就绪',
                    'Core applicant signals are ready',
                  ),
          },
          {
            key: 'schools',
            label: this.t(locale, '选校结构', 'School list'),
            value: `${schoolsContribution}/20`,
            status:
              schoolListCount >= 6 && balancedSchoolList
                ? 'ready'
                : schoolListCount > 0
                  ? 'attention'
                  : 'blocked',
            href: '/schools',
            description: balancedSchoolList
              ? this.t(
                  locale,
                  '冲刺、匹配、保底已形成基础组合',
                  'Reach, target, and safety mix is in place',
                )
              : this.t(
                  locale,
                  '建议补齐冲刺、匹配、保底三层',
                  'Balance reach, target, and safety schools',
                ),
          },
          {
            key: 'essays',
            label: this.t(locale, '文书进度', 'Essays'),
            value: `${essaysContribution}/15`,
            status: essayCount > 0 ? 'ready' : 'attention',
            href: '/essays',
            description:
              essayCount > 0
                ? this.t(
                    locale,
                    '已有文书草稿可继续推进',
                    'Essay drafts are ready to continue',
                  )
                : this.t(
                    locale,
                    '先创建第一篇申请文书',
                    'Create the first application essay draft',
                  ),
          },
          {
            key: 'timeline',
            label: this.t(locale, '时间线闭环', 'Timeline'),
            // 2026-05 Phase 1 Bug 4: timeline can't be "ready" without any
            // schools. Without this guard, an empty user (0 schools → 0
            // missingTimelines → 0 pendingTasks) showed status='ready'
            // 10/10 ✓ — vacuous truth that confused users into thinking
            // they had completed planning. See dashboard-invariants.md.
            value:
              schoolListCount === 0 ? '0/10' : `${timelineContribution}/10`,
            status:
              schoolListCount === 0
                ? 'blocked'
                : missingTimelineCount === 0 && pendingTaskCount === 0
                  ? 'ready'
                  : missingTimelineCount === 0
                    ? 'attention'
                    : 'blocked',
            href: '/timeline',
            description:
              schoolListCount === 0
                ? this.t(
                    locale,
                    '先添加目标学校，时间线会自动生成',
                    'Add target schools first — timeline will populate automatically',
                  )
                : missingTimelineCount > 0
                  ? this.t(
                      locale,
                      `${missingTimelineCount} 所选校还没有申请时间线`,
                      `${missingTimelineCount} selected schools still need timelines`,
                    )
                  : this.t(
                      locale,
                      '申请节点已纳入统一节奏',
                      'Application milestones are in one planning rhythm',
                    ),
          },
          {
            key: 'prediction',
            label: this.t(locale, '录取预测', 'Prediction'),
            value: `${predictionContribution}/15`,
            status:
              predictionsCount > 0
                ? 'ready'
                : predictionEligible
                  ? 'attention'
                  : 'blocked',
            href: '/prediction',
            description:
              predictionsCount > 0
                ? this.t(
                    locale,
                    `已生成 ${predictionsCount} 次录取预测，建议定期复盘`,
                    `${predictionsCount} predictions generated — review them periodically`,
                  )
                : predictionEligible
                  ? this.t(
                      locale,
                      '档案与选校已就绪，运行第一次录取预测',
                      'Profile and schools are ready — run your first prediction',
                    )
                  : this.t(
                      locale,
                      '先补齐档案 (>40%) 与至少 1 所目标学校再运行预测',
                      'Reach 40% profile and add at least one school first',
                    ),
          },
        ],
      },
      metrics: {
        due7,
        due30,
        overdueTasks: overdueTaskCount,
        missingTimelineCount,
        balancedSchoolList,
      },
      priorityQueue,
      deadlineStream,
      pipeline,
    };
  }

  private countMissingTimelines(
    schoolListItems: Array<{ schoolId: string; round: string | null }>,
    timelineCoverage: { schoolId: string; round: string }[],
  ): number {
    const coverageByRound = new Set(
      timelineCoverage.map((item) =>
        this.schoolRoundKey(item.schoolId, item.round),
      ),
    );
    const coverageBySchool = new Set(
      timelineCoverage.map((item) => item.schoolId),
    );

    return schoolListItems.filter((item) => {
      if (item.round) {
        return !coverageByRound.has(
          this.schoolRoundKey(item.schoolId, item.round),
        );
      }
      return !coverageBySchool.has(item.schoolId);
    }).length;
  }

  private buildDeadlineStream(
    deadlines: DashboardSummary['upcomingDeadlines'],
    personalEvents: DashboardSummary['upcomingPersonalEvents'],
    priorityTasks: DashboardPriorityTaskSource[],
    locale: string,
    now: Date,
  ): DashboardWorkbench['deadlineStream'] {
    const taskDeadlines: DashboardWorkbench['deadlineStream'] = [];
    for (const task of priorityTasks) {
      if (!task.dueDate) continue;
      const daysLeft = this.daysLeft(task.dueDate, now);
      taskDeadlines.push({
        id: task.id,
        type: 'task',
        title: task.title,
        subtitle: this.t(
          locale,
          `${this.getTaskSchoolName(task, locale)} · ${task.timeline.round}`,
          `${this.getTaskSchoolName(task, locale)} · ${task.timeline.round}`,
        ),
        dueAt: task.dueDate.toISOString(),
        daysLeft,
        severity: this.severityForDays(daysLeft),
        href: `/timeline?task=${task.id}`,
      });
    }

    const schoolDeadlines: DashboardWorkbench['deadlineStream'] = deadlines.map(
      (deadline) => ({
        id: deadline.id,
        type: 'school',
        title: deadline.schoolName,
        subtitle: deadline.round,
        dueAt: deadline.deadline,
        daysLeft: deadline.daysLeft,
        severity: this.severityForDays(deadline.daysLeft),
        href: '/timeline',
      }),
    );
    const eventDeadlines: DashboardWorkbench['deadlineStream'] = [];
    for (const event of personalEvents) {
      const dueAt = event.deadline ?? event.eventDate;
      if (!dueAt) continue;
      eventDeadlines.push({
        id: event.id,
        type: 'event',
        title: event.title,
        subtitle: event.category,
        dueAt,
        daysLeft: event.daysLeft,
        severity: this.severityForDays(event.daysLeft),
        href: '/timeline?tab=personal',
      });
    }

    return [...schoolDeadlines, ...eventDeadlines, ...taskDeadlines]
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 8);
  }

  private buildPriorityQueue({
    locale,
    completeness,
    profileGaps,
    schoolListCount,
    balancedSchoolList,
    essayCount,
    predictionsCount,
    missingTimelineCount,
    priorityTasks,
    overdueTaskCount,
    due30,
    now,
  }: {
    locale: string;
    completeness: number;
    profileGaps: string[];
    schoolListCount: number;
    balancedSchoolList: boolean;
    essayCount: number;
    predictionsCount: number;
    missingTimelineCount: number;
    priorityTasks: DashboardPriorityTaskSource[];
    overdueTaskCount: number;
    due30: number;
    now: Date;
  }): DashboardWorkbench['priorityQueue'] {
    const items: DashboardWorkbench['priorityQueue'] = [];

    if (completeness < 75) {
      items.push({
        id: 'profile-gaps',
        kind: 'profile',
        severity: completeness < 40 ? 'critical' : 'warning',
        title: this.t(locale, '补齐申请档案', 'Complete applicant profile'),
        description:
          profileGaps.length > 0
            ? this.t(
                locale,
                `优先补齐 ${profileGaps.length} 项会影响预测和选校的信号。`,
                `Prioritize ${profileGaps.length} signals that affect prediction and school strategy.`,
              )
            : this.t(
                locale,
                '完善基础信息以提升申请判断质量。',
                'Improve core information quality.',
              ),
        href: '/profile',
      });
    }

    if (schoolListCount < 6 || !balancedSchoolList) {
      items.push({
        id: 'school-list-balance',
        kind: 'school-list',
        severity: schoolListCount === 0 ? 'critical' : 'warning',
        title: this.t(
          locale,
          '建立均衡选校清单',
          'Build a balanced school list',
        ),
        description: this.t(
          locale,
          schoolListCount === 0
            ? '先加入目标学校，再让时间线和预测进入闭环。'
            : '补齐冲刺、匹配、保底三层，降低申请组合风险。',
          schoolListCount === 0
            ? 'Add target schools before timelines and predictions can close the loop.'
            : 'Balance reach, target, and safety schools to reduce portfolio risk.',
        ),
        href: '/schools',
      });
    }

    if (missingTimelineCount > 0) {
      items.push({
        id: 'missing-timelines',
        kind: 'timeline',
        severity: 'warning',
        title: this.t(
          locale,
          '生成缺失申请时间线',
          'Generate missing timelines',
        ),
        description: this.t(
          locale,
          `${missingTimelineCount} 所选校尚未生成申请节点，建议先统一排期。`,
          `${missingTimelineCount} selected schools do not have application milestones yet.`,
        ),
        href: '/timeline',
      });
    }

    for (const task of priorityTasks) {
      const daysLeft = task.dueDate ? this.daysLeft(task.dueDate, now) : null;
      if (daysLeft !== null && daysLeft > 14 && items.length >= 4) continue;

      items.push({
        id: `task-${task.id}`,
        kind: 'timeline-task',
        severity: daysLeft === null ? 'normal' : this.severityForDays(daysLeft),
        title: task.title,
        description: this.t(
          locale,
          `${this.getTaskSchoolName(task, locale)} · ${task.timeline.round}${daysLeft === null ? '' : ` · ${this.formatDaysLeft(daysLeft, locale)}`}`,
          `${this.getTaskSchoolName(task, locale)} · ${task.timeline.round}${daysLeft === null ? '' : ` · ${this.formatDaysLeft(daysLeft, locale)}`}`,
        ),
        href: `/timeline?task=${task.id}`,
        dueAt: task.dueDate?.toISOString() ?? null,
        daysLeft,
        mutation: {
          type: 'timeline-task-toggle',
          endpoint: `/timelines/tasks/${task.id}/toggle`,
        },
      });
    }

    if (essayCount === 0) {
      items.push({
        id: 'start-essays',
        kind: 'essay',
        severity: schoolListCount > 0 ? 'warning' : 'normal',
        title: this.t(locale, '开启第一组文书', 'Start the first essay set'),
        description: this.t(
          locale,
          '先建立草稿，后续才能追踪题目、版本和 AI 审阅。',
          'Create drafts so prompts, revisions, and AI review can be tracked.',
        ),
        href: '/essays',
      });
    }

    if (predictionsCount === 0 && completeness >= 60 && schoolListCount > 0) {
      items.push({
        id: 'run-prediction',
        kind: 'prediction',
        severity: 'normal',
        title: this.t(locale, '复盘录取概率', 'Review admission probabilities'),
        description: this.t(
          locale,
          '用最新档案和选校清单重新校准冲刺、匹配和保底判断。',
          'Recalibrate reach, target, and safety calls with the latest profile and list.',
        ),
        href: '/prediction',
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'route-ready',
        kind: 'deadline',
        severity: 'success',
        title: this.t(
          locale,
          '申请路线已进入稳定推进',
          'Application route is ready',
        ),
        description: this.t(
          locale,
          due30 > 0 || overdueTaskCount > 0
            ? '继续处理近期截止事项，保持提交节奏。'
            : '当前没有阻塞项，可以进入预测复盘或文书深化。',
          due30 > 0 || overdueTaskCount > 0
            ? 'Keep clearing near-term due items to maintain submission rhythm.'
            : 'No blocking items. Move into prediction review or deeper essay work.',
        ),
        href: due30 > 0 || overdueTaskCount > 0 ? '/timeline' : '/prediction',
      });
    }

    return items.slice(0, 6);
  }

  private getTaskSchoolName(
    task: DashboardPriorityTaskSource,
    locale: string,
  ): string {
    if (task.timeline.school) {
      return getSchoolDisplayName(task.timeline.school, locale);
    }
    return task.timeline.schoolName;
  }

  private daysLeft(date: Date, now: Date): number {
    return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  private severityForDays(daysLeft: number | null): DashboardSeverity {
    if (daysLeft === null) return 'normal';
    if (daysLeft <= 3) return 'critical';
    if (daysLeft <= 14) return 'warning';
    return 'normal';
  }

  private formatDaysLeft(daysLeft: number, locale: string): string {
    if (daysLeft < 0) {
      return this.t(
        locale,
        `已逾期 ${Math.abs(daysLeft)} 天`,
        `${Math.abs(daysLeft)} days overdue`,
      );
    }
    if (daysLeft === 0) return this.t(locale, '今天截止', 'due today');
    return this.t(locale, `${daysLeft} 天后截止`, `${daysLeft} days left`);
  }

  private t(locale: string, zh: string, en: string): string {
    return locale.toLowerCase().startsWith('zh') ? zh : en;
  }

  private schoolRoundKey(schoolId: string, round: string): string {
    return `${schoolId}:${this.normalizeRound(round)}`;
  }

  private normalizeRound(round: string): string {
    return round.trim().toUpperCase();
  }

  private selectUpcomingSchoolDeadlines(
    deadlines: SchoolDeadlineSource[],
    preferredRound: string | null,
    now: Date,
  ): Array<{ deadline: SchoolDeadlineSource; effectiveDate: Date }> {
    const preferredRoundKey = preferredRound
      ? this.normalizeRound(preferredRound)
      : null;
    const groupedByRound = new Map<string, SchoolDeadlineSource[]>();

    for (const deadline of deadlines) {
      const roundKey = this.normalizeRound(deadline.round);
      if (preferredRoundKey && roundKey !== preferredRoundKey) continue;
      groupedByRound.set(roundKey, [
        ...(groupedByRound.get(roundKey) ?? []),
        deadline,
      ]);
    }

    return Array.from(groupedByRound.values())
      .map((roundDeadlines) => {
        const selected = this.selectBestDeadlineForRound(roundDeadlines, now);
        if (!selected) return null;

        const effectiveDate =
          selected.applicationDeadline.getTime() >= now.getTime()
            ? selected.applicationDeadline
            : this.rollAnnualDeadlineForward(selected.applicationDeadline, now);

        return { deadline: selected, effectiveDate };
      })
      .filter(
        (
          item,
        ): item is { deadline: SchoolDeadlineSource; effectiveDate: Date } =>
          item !== null,
      );
  }

  private selectBestDeadlineForRound(
    deadlines: SchoolDeadlineSource[],
    now: Date,
  ): SchoolDeadlineSource | null {
    if (deadlines.length === 0) return null;

    const futureDeadlines = deadlines
      .filter(
        (deadline) => deadline.applicationDeadline.getTime() >= now.getTime(),
      )
      .sort(
        (a, b) =>
          a.applicationDeadline.getTime() - b.applicationDeadline.getTime(),
      );

    if (futureDeadlines.length > 0) {
      return futureDeadlines[0];
    }

    return [...deadlines].sort(
      (a, b) =>
        b.year - a.year ||
        b.applicationDeadline.getTime() - a.applicationDeadline.getTime(),
    )[0];
  }

  private rollAnnualDeadlineForward(deadline: Date, now: Date): Date {
    const nextDeadline = new Date(deadline);
    nextDeadline.setUTCFullYear(now.getUTCFullYear());

    if (nextDeadline.getTime() < now.getTime()) {
      nextDeadline.setUTCFullYear(now.getUTCFullYear() + 1);
    }

    return nextDeadline;
  }

  /**
   * @deprecated 2026-05 Phase 1: algorithm extracted to
   * `apps/api/src/modules/profile/profile-completeness.util.ts` so
   * dashboard readiness and prediction precondition (Phase 1 Bug 2)
   * stay in lockstep. Kept as thin wrapper for in-class call-sites.
   */
  private calculateProfileCompleteness(
    profile: Parameters<typeof calculateProfileCompleteness>[0],
    schoolListCount: number,
  ): { completeness: number; profileGaps: string[] } {
    return calculateProfileCompleteness(profile, schoolListCount);
  }

  private buildRecentActivity(
    pointHistory: PointHistorySource[],
  ): DashboardSummary['recentActivity'] {
    const actionDescriptions: Record<string, { title: string; desc: string }> =
      {
        // Earning points
        SUBMIT_CASE: { title: '提交案例', desc: '分享了录取案例' },
        CASE_VERIFIED: { title: '案例认证', desc: '案例通过审核' },
        CASE_HELPFUL: { title: '案例获赞', desc: '案例被标记为有帮助' },
        COMPLETE_PROFILE: { title: '完善档案', desc: '更新了个人档案' },
        REFER_USER: { title: '邀请好友', desc: '成功邀请新用户注册' },
        VERIFICATION_APPROVED: {
          title: '认证通过',
          desc: '身份认证已通过审核',
        },
        SWIPE_CORRECT: { title: '预测正确', desc: '案例预测判断正确' },
        SUBMIT_REVIEW: { title: '提交评审', desc: '发表了案例评审' },
        REVIEW_HELPFUL: { title: '评审获赞', desc: '评审被标记为有帮助' },
        // Spending points
        VIEW_CASE_DETAIL: { title: '查看案例', desc: '浏览了录取案例详情' },
        AI_ANALYSIS: { title: 'AI分析', desc: '使用了AI智能分析' },
        MESSAGE_VERIFIED: {
          title: '私信认证用户',
          desc: '向认证用户发送了私信',
        },
        AI_ESSAY_POLISH: { title: '文书润色', desc: '使用了AI文书润色' },
        AI_ESSAY_REVIEW: { title: '文书评审', desc: '获取了AI文书评审' },
        AI_ESSAY_BRAINSTORM: {
          title: '文书头脑风暴',
          desc: '使用了AI头脑风暴',
        },
        AI_ESSAY_GALLERY: { title: '文书画廊', desc: '查看了文书画廊内容' },
        AI_SCHOOL_RECOMMENDATION: {
          title: 'AI选校推荐',
          desc: '获取了AI选校推荐',
        },
      };

    return pointHistory.map((h) => {
      const info = actionDescriptions[h.action] || {
        title: h.action,
        desc: '',
      };
      return {
        type: h.points > 0 ? 'earn' : 'spend',
        title: info.title,
        description: `${info.desc}${h.points > 0 ? `，获得 ${h.points} 积分` : `，消耗 ${Math.abs(h.points)} 积分`}`,
        createdAt: h.createdAt.toISOString(),
      };
    });
  }
}
