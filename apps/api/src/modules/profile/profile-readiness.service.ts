import { Injectable } from '@nestjs/common';
import { normalizeApplicationRound } from '@study-abroad/shared';
import type {
  ProfileReadinessAction,
  ProfileReadinessGpaSource,
  ProfileReadinessItem,
  ProfileReadinessStatus,
  ProfileReadinessTestStrategy,
  ProfileReadinessV1,
} from '@study-abroad/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const FRESH_PREDICTION_DAYS = 90;

type ReadinessProfile = Prisma.ProfileGetPayload<{
  include: {
    testScores: true;
    activities: true;
    awards: true;
    semesterGpas: true;
    essays: true;
  };
}>;

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function statusForScore(score: number): ProfileReadinessStatus {
  if (score >= 80) return 'ready';
  if (score >= 45) return 'attention';
  return 'blocked';
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeRound(round?: string | null): string | null {
  return normalizeApplicationRound(round) ?? null;
}

function schoolRoundKey(schoolId: string, round?: string | null): string {
  return `${schoolId}:${normalizeRound(round) ?? '*'}`;
}

@Injectable()
export class ProfileReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async getReadiness(userId: string): Promise<ProfileReadinessV1> {
    const now = new Date();
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: true,
        awards: true,
        semesterGpas: { orderBy: { order: 'asc' } },
        essays: true,
      },
    });

    const [
      schoolList,
      timelines,
      resumes,
      resumeEvidenceCount,
      recommendationLetters,
      latestAnalysis,
    ] = await Promise.all([
      this.prisma.schoolListItem.findMany({
        where: { userId },
        select: {
          id: true,
          schoolId: true,
          tier: true,
          round: true,
          updatedAt: true,
        },
      }),
      this.prisma.applicationTimeline.findMany({
        where: { userId },
        select: {
          schoolId: true,
          round: true,
          updatedAt: true,
          tasks: {
            select: { completed: true, dueDate: true },
          },
        },
      }),
      this.prisma.resume.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: {
          updatedAt: true,
          aiReviews: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { overallScore: true },
          },
          aiIssues: {
            where: { status: 'OPEN' },
            select: { id: true },
          },
        },
      }),
      this.prisma.resumeEvidence.count({ where: { userId } }),
      this.prisma.recommendationLetter.findMany({
        where: { userId },
        select: {
          status: true,
          dueDate: true,
          updatedAt: true,
        },
      }),
      this.prisma.applicationAnalysisRun.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          state: true,
          dataQuality: true,
          targetSchoolCount: true,
          schoolsWithPredictions: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const profileId = profile?.id;
    const schoolIds = schoolList.map((item) => item.schoolId);
    const [predictions, deadlines] = await Promise.all([
      profileId
        ? this.prisma.predictionResult.findMany({
            where: {
              profileId,
              ...(schoolIds.length ? { schoolId: { in: schoolIds } } : {}),
            },
            select: {
              schoolId: true,
              authority: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      schoolIds.length
        ? this.prisma.schoolDeadline.findMany({
            where: {
              schoolId: { in: schoolIds },
              year: this.resolveApplicationYear(now),
            },
            select: {
              schoolId: true,
              round: true,
              applicationDeadline: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const profileCompleteness = this.buildProfileCompleteness(profile);
    const schoolListSummary = this.buildSchoolListSummary(
      schoolList,
      deadlines,
    );
    const predictionDataSupport = this.buildPredictionSupport(
      schoolIds,
      predictions,
      now,
    );
    const timeline = this.buildTimelineSummary(schoolList, timelines, now);
    const essays = {
      count: profile?.essays.length ?? 0,
      linkedPromptCount:
        profile?.essays.filter((essay) => essay.essayPromptId).length ?? 0,
    };
    const resume = {
      count: resumes.length,
      latestUpdatedAt: resumes[0]?.updatedAt.toISOString(),
      latestQualityScore: resumes[0]?.aiReviews[0]?.overallScore ?? undefined,
      openIssueCount: resumes[0]?.aiIssues.length ?? 0,
      evidenceCount: resumeEvidenceCount,
    };
    const recommendationLettersSummary = this.buildRecommendationLetterSummary(
      recommendationLetters,
      now,
    );
    const applicationAnalysis = {
      state: this.resolveAnalysisState(
        profileCompleteness.score,
        schoolList.length,
        predictionDataSupport.authoritativeCount +
          predictionDataSupport.previewCount,
        latestAnalysis?.state,
      ),
      dataQuality: latestAnalysis?.dataQuality,
      targetSchoolCount: latestAnalysis?.targetSchoolCount ?? schoolList.length,
      schoolsWithPredictions:
        latestAnalysis?.schoolsWithPredictions ??
        predictionDataSupport.authoritativeCount +
          predictionDataSupport.previewCount,
      lastRunAt: latestAnalysis?.createdAt.toISOString(),
    };
    const workflowReadiness = this.buildWorkflowReadiness({
      profileScore: profileCompleteness.score,
      schoolList: schoolListSummary,
      predictions: predictionDataSupport,
      timeline,
      essays,
      resume,
      recommendationLetters: recommendationLettersSummary,
      schoolCount: schoolList.length,
    });
    const nextActions = this.buildNextActions({
      profileGaps: profileCompleteness.gaps,
      schoolList: schoolListSummary,
      predictions: predictionDataSupport,
      timeline,
      essays,
      resume,
      recommendationLetters: recommendationLettersSummary,
    });

    const blockers = [
      ...profileCompleteness.gaps.filter((gap) =>
        [
          'profile.gpa_anchor',
          'profile.test_strategy',
          'profile.major',
        ].includes(gap),
      ),
      ...(schoolList.length === 0 ? ['school_list.add_first'] : []),
    ];
    const warnings = [
      ...profileCompleteness.gaps.filter((gap) => !blockers.includes(gap)),
      ...workflowReadiness.items.flatMap((item) => item.gaps),
    ];

    return {
      readinessVersion: 'profile-readiness-v1',
      computedAt: now.toISOString(),
      overall: {
        score: workflowReadiness.score,
        status: workflowReadiness.status,
        blockers: Array.from(new Set(blockers)),
        warnings: Array.from(new Set(warnings)),
        nextActions,
        canRunPrediction:
          profileCompleteness.score >= 45 && schoolList.length > 0,
        canGenerateRecommendation: profileCompleteness.score >= 60,
        canRunApplicationAnalysis:
          profileCompleteness.score >= 60 &&
          schoolList.length > 0 &&
          predictionDataSupport.authoritativeCount +
            predictionDataSupport.previewCount >
            0,
      },
      profileCompleteness,
      workflowReadiness,
      schoolList: schoolListSummary,
      predictionDataSupport,
      timeline,
      essays,
      resume,
      recommendationLetters: recommendationLettersSummary,
      applicationAnalysis,
      sources: {
        profileUpdatedAt: profile?.updatedAt.toISOString(),
        schoolListUpdatedAt: this.latestDate(
          schoolList.map((item) => item.updatedAt),
        ),
        predictionUpdatedAt: this.latestDate(
          predictions.map((item) => item.updatedAt),
        ),
        timelineUpdatedAt: this.latestDate(
          timelines.map((item) => item.updatedAt),
        ),
        resumeUpdatedAt: resume.latestUpdatedAt,
        recommendationLettersUpdatedAt: this.latestDate(
          recommendationLetters.map((item) => item.updatedAt),
        ),
        applicationAnalysisUpdatedAt: latestAnalysis?.updatedAt.toISOString(),
      },
    };
  }

  private resolveApplicationYear(now: Date): number {
    return now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  }

  private buildProfileCompleteness(profile: ReadinessProfile | null) {
    const gaps: string[] = [];
    const gpaAnchor = this.resolveGpaAnchor(profile);
    const testStrategy: ProfileReadinessTestStrategy = profile?.testScores
      .length
      ? 'scores_submitted'
      : profile?.applyingTestOptional
        ? 'test_optional_confirmed'
        : 'unknown';

    let score = 0;
    if (gpaAnchor) score += 30;
    else gaps.push('profile.gpa_anchor');

    if (testStrategy !== 'unknown') score += 15;
    else gaps.push('profile.test_strategy');

    if (profile?.activities.length) score += 20;
    else gaps.push('profile.activities');

    if (profile?.awards.length) score += 10;
    else gaps.push('profile.awards');

    const hasMajor = Boolean(profile?.targetMajor || profile?.intendedMajor);
    const hasBasicContext = Boolean(profile?.grade && profile?.currentSchool);
    if (hasMajor) score += 8;
    else gaps.push('profile.major');
    if (hasBasicContext) score += 7;
    else gaps.push('profile.basic_context');

    const hasPrivacy = Boolean(profile?.visibility);
    const hasDemographicContext = Boolean(
      profile?.nationality ||
      profile?.countryOfResidence ||
      profile?.citizenship ||
      profile?.educationSystem,
    );
    if (hasPrivacy) score += 4;
    else gaps.push('profile.privacy');
    if (hasDemographicContext) score += 6;
    else gaps.push('profile.demographics');

    return {
      score: clampScore(score),
      status: statusForScore(score),
      gaps,
      gpaAnchor,
      testStrategy,
      counts: {
        testScores: profile?.testScores.length ?? 0,
        activities: profile?.activities.length ?? 0,
        awards: profile?.awards.length ?? 0,
      },
    };
  }

  private resolveGpaAnchor(
    profile: ReadinessProfile | null,
  ):
    | { value: number; scale: number; source: ProfileReadinessGpaSource }
    | undefined {
    if (!profile) return undefined;
    const scale = toNumber(profile.gpaScale) ?? 4;
    const cumulative = toNumber(profile.gpa);
    if (cumulative !== undefined) {
      return { value: cumulative, scale, source: 'cumulative' };
    }

    const gradeGpas = [
      profile.gpa12,
      profile.gpa11,
      profile.gpa10,
      profile.gpa9,
    ]
      .map(toNumber)
      .filter((value): value is number => value !== undefined);
    if (gradeGpas.length) {
      return { value: gradeGpas[0], scale, source: 'grade_level' };
    }

    const semester = profile.semesterGpas
      .map((item) => ({
        value: toNumber(item.gpa),
        scale: toNumber(item.gpaScale) ?? scale,
      }))
      .find((item) => item.value !== undefined);
    if (semester?.value !== undefined) {
      return {
        value: semester.value,
        scale: semester.scale,
        source: 'semester',
      };
    }

    return undefined;
  }

  private buildSchoolListSummary(
    schoolList: Array<{ schoolId: string; tier: string; round: string | null }>,
    deadlines: Array<{
      schoolId: string;
      round: string;
      applicationDeadline: Date;
    }>,
  ): ProfileReadinessV1['schoolList'] {
    const tierCounts = {
      reach: schoolList.filter((item) => item.tier === 'REACH').length,
      target: schoolList.filter((item) => item.tier === 'TARGET').length,
      safety: schoolList.filter((item) => item.tier === 'SAFETY').length,
    };
    const deadlineBySchool = new Map<string, Set<string>>();
    for (const deadline of deadlines) {
      const rounds =
        deadlineBySchool.get(deadline.schoolId) ?? new Set<string>();
      rounds.add(normalizeRound(deadline.round) ?? '*');
      deadlineBySchool.set(deadline.schoolId, rounds);
    }
    const missingDeadlineCount = schoolList.filter((item) => {
      const rounds = deadlineBySchool.get(item.schoolId);
      if (!rounds) return true;
      const normalizedRound = normalizeRound(item.round);
      return normalizedRound ? !rounds.has(normalizedRound) : rounds.size === 0;
    }).length;

    return {
      count: schoolList.length,
      tierCounts,
      missingRoundCount: schoolList.filter((item) => !item.round).length,
      missingDeadlineCount,
      balanced:
        tierCounts.reach > 0 && tierCounts.target > 0 && tierCounts.safety > 0,
    };
  }

  private buildPredictionSupport(
    schoolIds: string[],
    predictions: Array<{
      schoolId: string;
      authority: string | null;
      updatedAt: Date;
    }>,
    now: Date,
  ): ProfileReadinessV1['predictionDataSupport'] {
    const freshCutoff = now.getTime() - FRESH_PREDICTION_DAYS * DAY_MS;
    const authoritative = predictions.filter(
      (item) => item.authority === 'AUTHORITATIVE',
    );
    const preview = predictions.filter(
      (item) => item.authority === 'PREVIEW' || !item.authority,
    );
    const freshAuthoritative = authoritative.filter(
      (item) => item.updatedAt.getTime() >= freshCutoff,
    );
    const stale = predictions.filter(
      (item) => item.updatedAt.getTime() < freshCutoff,
    );
    const predictedSchoolIds = new Set(
      predictions.map((item) => item.schoolId),
    );

    return {
      previewCount: preview.length,
      authoritativeCount: authoritative.length,
      freshAuthoritativeCount: freshAuthoritative.length,
      staleCount: stale.length,
      missingSchoolIds: schoolIds.filter(
        (schoolId) => !predictedSchoolIds.has(schoolId),
      ),
      lastRunAt: this.latestDate(predictions.map((item) => item.updatedAt)),
    };
  }

  private buildTimelineSummary(
    schoolList: Array<{ schoolId: string; round: string | null }>,
    timelines: Array<{
      schoolId: string;
      round: string;
      tasks: Array<{ completed: boolean; dueDate: Date | null }>;
    }>,
    now: Date,
  ): ProfileReadinessV1['timeline'] {
    const coverageByRound = new Set(
      timelines.map((timeline) =>
        schoolRoundKey(timeline.schoolId, timeline.round),
      ),
    );
    const coverageBySchool = new Set(
      timelines.map((timeline) => timeline.schoolId),
    );
    const missingTimelineCount = schoolList.filter((item) => {
      const round = normalizeRound(item.round);
      return round
        ? !coverageByRound.has(schoolRoundKey(item.schoolId, round))
        : !coverageBySchool.has(item.schoolId);
    }).length;
    const tasks = timelines.flatMap((timeline) => timeline.tasks);
    const pendingTasks = tasks.filter((task) => !task.completed);
    const dueTasks = pendingTasks.filter((task) => task.dueDate);
    const overdueTaskCount = dueTasks.filter(
      (task) => task.dueDate!.getTime() < now.getTime(),
    ).length;
    const due7Count = dueTasks.filter((task) => {
      const diff = task.dueDate!.getTime() - now.getTime();
      return diff >= 0 && diff <= 7 * DAY_MS;
    }).length;
    const due30Count = dueTasks.filter((task) => {
      const diff = task.dueDate!.getTime() - now.getTime();
      return diff >= 0 && diff <= 30 * DAY_MS;
    }).length;

    return {
      coverageCount: Math.max(0, schoolList.length - missingTimelineCount),
      missingTimelineCount,
      pendingTaskCount: pendingTasks.length,
      overdueTaskCount,
      due7Count,
      due30Count,
    };
  }

  private buildRecommendationLetterSummary(
    letters: Array<{ status: string; dueDate: Date | null }>,
    now: Date,
  ): ProfileReadinessV1['recommendationLetters'] {
    const isOverdue = (letter: { status: string; dueDate: Date | null }) =>
      Boolean(
        letter.dueDate &&
        letter.dueDate.getTime() < now.getTime() &&
        !['SUBMITTED', 'CONFIRMED'].includes(letter.status),
      );

    return {
      count: letters.length,
      requested: letters.filter((letter) => letter.status === 'REQUESTED')
        .length,
      inProgress: letters.filter((letter) => letter.status === 'IN_PROGRESS')
        .length,
      submitted: letters.filter((letter) => letter.status === 'SUBMITTED')
        .length,
      confirmed: letters.filter((letter) => letter.status === 'CONFIRMED')
        .length,
      overdue: letters.filter(isOverdue).length,
    };
  }

  private buildWorkflowReadiness(args: {
    profileScore: number;
    schoolList: ProfileReadinessV1['schoolList'];
    predictions: ProfileReadinessV1['predictionDataSupport'];
    timeline: ProfileReadinessV1['timeline'];
    essays: ProfileReadinessV1['essays'];
    resume: ProfileReadinessV1['resume'];
    recommendationLetters: ProfileReadinessV1['recommendationLetters'];
    schoolCount: number;
  }): ProfileReadinessV1['workflowReadiness'] {
    const schoolListScore =
      Math.min(args.schoolList.count / 6, 1) * 15 +
      (args.schoolList.balanced ? 10 : 0);
    const predictionScore =
      args.schoolCount === 0
        ? 0
        : (args.predictions.freshAuthoritativeCount / args.schoolCount) * 10;
    const timelineScore =
      args.schoolCount === 0
        ? 0
        : (args.timeline.coverageCount / args.schoolCount) * 6 +
          (args.timeline.pendingTaskCount === 0 ? 4 : 0);
    const recommendationReady =
      args.recommendationLetters.submitted +
        args.recommendationLetters.confirmed >=
      2;
    const score = clampScore(
      args.profileScore * 0.4 +
        schoolListScore +
        predictionScore +
        timelineScore +
        (args.essays.count > 0 ? 5 : 0) +
        (recommendationReady
          ? 5
          : args.recommendationLetters.count > 0
            ? 2
            : 0) +
        (args.resume.count > 0 ? 5 : 0),
    );
    const items: ProfileReadinessItem[] = [
      this.workflowItem(
        'profile',
        'profile.readiness.item.profile',
        args.profileScore,
        '/profile',
        [],
      ),
      this.workflowItem(
        'school_list',
        'profile.readiness.item.schoolList',
        clampScore(schoolListScore * 4),
        '/profile?tab=targets',
        [
          ...(args.schoolList.count === 0
            ? ['school_list.add_first']
            : args.schoolList.count < 6
              ? ['school_list.min_count']
              : []),
          ...(args.schoolList.count > 0 && !args.schoolList.balanced
            ? ['school_list.balance']
            : []),
          ...(args.schoolList.missingRoundCount > 0
            ? ['school_list.round_missing']
            : []),
        ],
        'targets',
      ),
      this.workflowItem(
        'prediction',
        'profile.readiness.item.prediction',
        clampScore(predictionScore * 10),
        '/prediction',
        args.predictions.missingSchoolIds.length
          ? ['prediction.fresh_authoritative_missing']
          : [],
      ),
      this.workflowItem(
        'timeline',
        'profile.readiness.item.timeline',
        clampScore(timelineScore * 10),
        '/timeline',
        args.timeline.missingTimelineCount
          ? ['timeline.missing_school_round']
          : [],
      ),
      this.workflowItem(
        'execution',
        'profile.readiness.item.execution',
        clampScore(
          (args.essays.count > 0 ? 35 : 0) +
            (recommendationReady
              ? 35
              : args.recommendationLetters.count > 0
                ? 15
                : 0) +
            (args.resume.count > 0 ? 30 : 0),
        ),
        '/uncommon-app',
        [
          ...(args.essays.count === 0 ? ['essays.none'] : []),
          ...(!recommendationReady
            ? ['recommendation_letters.min_submitted']
            : []),
          ...(args.resume.count === 0 ? ['resume.none'] : []),
        ],
      ),
    ];

    return { score, status: statusForScore(score), items };
  }

  private workflowItem(
    key: string,
    labelKey: string,
    score: number,
    href: string,
    gaps: string[],
    targetTab?: string,
  ): ProfileReadinessItem {
    return {
      key,
      labelKey,
      score,
      status: statusForScore(score),
      gaps,
      href,
      targetTab,
    };
  }

  private buildNextActions(args: {
    profileGaps: string[];
    schoolList: ProfileReadinessV1['schoolList'];
    predictions: ProfileReadinessV1['predictionDataSupport'];
    timeline: ProfileReadinessV1['timeline'];
    essays: ProfileReadinessV1['essays'];
    resume: ProfileReadinessV1['resume'];
    recommendationLetters: ProfileReadinessV1['recommendationLetters'];
  }): ProfileReadinessAction[] {
    const actions: ProfileReadinessAction[] = [];
    const firstProfileGap = args.profileGaps[0];
    if (firstProfileGap) {
      actions.push({
        key: firstProfileGap,
        href: `/profile?tab=${this.tabForGap(firstProfileGap)}`,
        targetTab: this.tabForGap(firstProfileGap),
        labelKey: 'profile.readiness.action.completeProfile',
        severity: 'critical',
      });
    }
    if (args.schoolList.count < 6 || !args.schoolList.balanced) {
      actions.push({
        key:
          args.schoolList.count === 0
            ? 'school_list.add_first'
            : 'school_list.balance',
        href: args.schoolList.count === 0 ? '/schools' : '/profile?tab=targets',
        targetTab: args.schoolList.count === 0 ? undefined : 'targets',
        labelKey:
          args.schoolList.count === 0
            ? 'profile.readiness.action.addSchools'
            : 'profile.readiness.action.balanceSchools',
        severity: args.schoolList.count === 0 ? 'critical' : 'warning',
      });
    }
    if (
      args.predictions.missingSchoolIds.length ||
      args.predictions.freshAuthoritativeCount === 0
    ) {
      actions.push({
        key: 'prediction.run',
        href: '/prediction',
        labelKey: 'profile.readiness.action.runPrediction',
        severity: 'warning',
      });
    }
    if (args.timeline.missingTimelineCount > 0) {
      actions.push({
        key: 'timeline.sync',
        href: '/timeline',
        labelKey: 'profile.readiness.action.syncTimeline',
        severity: 'warning',
      });
    }
    if (args.essays.count === 0) {
      actions.push({
        key: 'essays.start',
        href: '/essays',
        labelKey: 'profile.readiness.action.startEssays',
        severity: 'info',
      });
    }
    if (
      args.recommendationLetters.submitted +
        args.recommendationLetters.confirmed <
      2
    ) {
      actions.push({
        key: 'recommendation_letters.add',
        href: '/profile?tab=recLetters',
        targetTab: 'recLetters',
        labelKey: 'profile.readiness.action.addRecommendationLetters',
        severity: 'info',
      });
    }
    if (args.resume.count === 0) {
      actions.push({
        key: 'resume.create',
        href: '/resume',
        labelKey: 'profile.readiness.action.createResume',
        severity: 'info',
      });
    }
    actions.push({
      key: 'application.open_hub',
      href: '/uncommon-app',
      labelKey: 'profile.readiness.action.openApplicationHub',
      severity: 'success',
    });
    return actions.slice(0, 4);
  }

  private tabForGap(gap: string): string {
    if (gap.includes('gpa')) return 'gpa';
    if (gap.includes('test')) return 'scores';
    if (gap.includes('activities')) return 'activities';
    if (gap.includes('awards')) return 'awards';
    if (gap.includes('demographics')) return 'demographics';
    if (gap.includes('privacy')) return 'privacy';
    return 'basic';
  }

  private resolveAnalysisState(
    profileScore: number,
    schoolCount: number,
    predictionCount: number,
    latestState?: string,
  ): ProfileReadinessV1['applicationAnalysis']['state'] {
    if (latestState === 'ready') return 'ready';
    if (profileScore < 60) return 'insufficientProfileData';
    if (schoolCount === 0) return 'noTargetSchools';
    if (predictionCount === 0) return 'noPredictions';
    return 'notRun';
  }

  private latestDate(dates: Date[]): string | undefined {
    if (!dates.length) return undefined;
    const latest = dates.reduce((max, date) =>
      date.getTime() > max.getTime() ? date : max,
    );
    return latest.toISOString();
  }
}
