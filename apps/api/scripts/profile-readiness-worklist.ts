#!/usr/bin/env tsx
import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type Severity = 'critical' | 'warning' | 'info';
type Bucket =
  | 'trusted-usable'
  | 'missing-user-signal'
  | 'consumer-gap'
  | 'conflict'
  | 'needs-review';
type WorklistAction =
  | 'accept'
  | 'prompt-user'
  | 'set-application-round'
  | 'balance-school-list'
  | 'generate-timeline'
  | 'review-deadline-source'
  | 'run-prediction'
  | 'refresh-prediction'
  | 'match-activity-template'
  | 'match-award-competition'
  | 'start-essay-workflow'
  | 'add-recommendation-letters'
  | 'create-resume'
  | 'run-application-analysis'
  | 'review-legacy-target-source';

interface Args {
  out: string;
  limit: number;
  includeClosed: boolean;
  staleDays: number;
  applicationYear: number;
}

interface WorklistRow {
  userId: string;
  profileId: string | null;
  domain:
    | 'profile'
    | 'school_list'
    | 'deadline'
    | 'timeline'
    | 'prediction'
    | 'execution'
    | 'application_analysis'
    | 'legacy_target_school';
  gap: string;
  bucket: Bucket;
  action: WorklistAction;
  severity: Severity;
  route: string;
  schoolId?: string;
  schoolName?: string;
  round?: string | null;
  details: Record<string, unknown>;
}

interface SchoolListItemLite {
  id: string;
  schoolId: string;
  tier: string;
  round: string | null;
  school: { name: string };
}

interface TimelineLite {
  schoolId: string;
  round: string;
  tasks: Array<{ completed: boolean; dueDate: Date | null }>;
}

interface PredictionLite {
  schoolId: string;
  authority: string | null;
  updatedAt: Date;
}

const API_ROOT = detectApiRoot();
const DAY_MS = 24 * 60 * 60 * 1000;

function detectApiRoot() {
  if (path.basename(process.cwd()) === 'api') return process.cwd();
  const candidate = path.join(process.cwd(), 'apps', 'api');
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  return process.cwd();
}

function resolveApplicationYear(now = new Date()): number {
  return now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback?: string) => {
    const inline = argv.find((arg) => arg.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    out: path.resolve(
      API_ROOT,
      get(
        '--out',
        path.join(
          API_ROOT,
          'scripts',
          'closure-reports',
          `profile-readiness-worklist-${stamp}.json`,
        ),
      )!,
    ),
    limit: Number(get('--limit', '500')),
    includeClosed: argv.includes('--include-closed'),
    staleDays: Number(get('--stale-days', '90')),
    applicationYear: Number(
      get('--application-year', `${resolveApplicationYear()}`),
    ),
  };
}

async function main() {
  const args = parseArgs();
  const now = new Date();
  const staleCutoff = now.getTime() - args.staleDays * DAY_MS;
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null, isBanned: false },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        profile: {
          select: {
            id: true,
            gpa: true,
            gpaScale: true,
            gpa9: true,
            gpa10: true,
            gpa11: true,
            gpa12: true,
            grade: true,
            currentSchool: true,
            targetMajor: true,
            intendedMajor: true,
            nationality: true,
            countryOfResidence: true,
            citizenship: true,
            educationSystem: true,
            applyingTestOptional: true,
            updatedAt: true,
            semesterGpas: {
              select: { id: true, gpa: true, gpaScale: true },
              orderBy: { order: 'asc' },
            },
            testScores: { select: { id: true, type: true, score: true } },
            activities: {
              select: { id: true, activityTemplateId: true },
            },
            awards: { select: { id: true, competitionId: true } },
            education: { select: { id: true } },
            essays: { select: { id: true, essayPromptId: true } },
            predictions: {
              select: {
                schoolId: true,
                authority: true,
                updatedAt: true,
              },
            },
            applicationAnalysisRuns: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                state: true,
                dataQuality: true,
                targetSchoolCount: true,
                schoolsWithPredictions: true,
                createdAt: true,
              },
            },
          },
        },
        schoolListItems: {
          select: {
            id: true,
            schoolId: true,
            tier: true,
            round: true,
            school: { select: { name: true } },
          },
        },
        applicationTimelines: {
          select: {
            schoolId: true,
            round: true,
            status: true,
            deadline: true,
            tasks: { select: { completed: true, dueDate: true } },
          },
        },
        recommendationLetters: {
          select: { id: true, status: true, dueDate: true },
        },
        resumes: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            updatedAt: true,
            aiIssues: {
              where: { status: 'OPEN' },
              select: { id: true },
            },
          },
        },
      },
    });

    const schoolIds = Array.from(
      new Set(
        users.flatMap((user) =>
          user.schoolListItems.map((item) => item.schoolId),
        ),
      ),
    );
    const deadlines = schoolIds.length
      ? await prisma.schoolDeadline.findMany({
          where: {
            schoolId: { in: schoolIds },
            year: args.applicationYear,
          },
          select: {
            schoolId: true,
            round: true,
            applicationDeadline: true,
            source: true,
          },
        })
      : [];
    const deadlineByRound = new Set(
      deadlines.map((deadline) =>
        schoolRoundKey(deadline.schoolId, deadline.round),
      ),
    );
    const deadlineBySchool = new Set(
      deadlines.map((deadline) => deadline.schoolId),
    );

    const profileIdToUserId = new Map(
      users
        .filter((user) => user.profile)
        .map((user) => [user.profile!.id, user.id]),
    );
    const legacyTargets = await prisma.profileTargetSchool.findMany({
      select: {
        id: true,
        profileId: true,
        schoolId: true,
        round: true,
      },
    });
    const legacyByUser = new Map<string, typeof legacyTargets>();
    for (const target of legacyTargets) {
      const userId = profileIdToUserId.get(target.profileId);
      if (!userId) continue;
      const bucket = legacyByUser.get(userId) ?? [];
      bucket.push(target);
      legacyByUser.set(userId, bucket);
    }

    const rows: WorklistRow[] = [];
    const userSummaries = users.map((user) => {
      const profileGaps = buildProfileRows(user.id, user.profile);
      rows.push(...profileGaps);

      const profileScore = profileCompletenessScore(user.profile);
      rows.push(
        ...buildSchoolListRows(
          user.id,
          user.profile?.id ?? null,
          user.schoolListItems,
        ),
      );
      rows.push(
        ...buildDeadlineRows(
          user.id,
          user.profile?.id ?? null,
          user.schoolListItems,
          deadlineByRound,
          deadlineBySchool,
        ),
      );
      rows.push(
        ...buildTimelineRows(
          user.id,
          user.profile?.id ?? null,
          user.schoolListItems,
          user.applicationTimelines,
          deadlineByRound,
        ),
      );
      rows.push(
        ...buildPredictionRows(
          user.id,
          user.profile?.id ?? null,
          user.schoolListItems,
          user.profile?.predictions ?? [],
          staleCutoff,
          args.staleDays,
        ),
      );
      rows.push(
        ...buildExecutionRows(user.id, user.profile?.id ?? null, {
          essayCount: user.profile?.essays.length ?? 0,
          linkedEssayCount:
            user.profile?.essays.filter((essay) => essay.essayPromptId)
              .length ?? 0,
          recommendationLetters: user.recommendationLetters,
          resumes: user.resumes,
          now,
        }),
      );
      rows.push(
        ...buildApplicationAnalysisRows(user.id, user.profile?.id ?? null, {
          profileScore,
          schoolCount: user.schoolListItems.length,
          predictionCount:
            user.profile?.predictions.filter(
              (prediction) => prediction.authority === 'AUTHORITATIVE',
            ).length ?? 0,
          latestRun: user.profile?.applicationAnalysisRuns[0] ?? null,
        }),
      );
      rows.push(
        ...buildLegacyRows(
          user.id,
          user.profile?.id ?? null,
          user.schoolListItems,
          legacyByUser.get(user.id) ?? [],
        ),
      );

      return {
        userId: user.id,
        profileId: user.profile?.id ?? null,
        profileScore,
        schoolListCount: user.schoolListItems.length,
        profileGapCount: profileGaps.length,
        timelineCount: user.applicationTimelines.length,
        predictionCount: user.profile?.predictions.length ?? 0,
      };
    });

    if (args.includeClosed) {
      for (const summary of userSummaries) {
        if (rows.some((row) => row.userId === summary.userId)) continue;
        rows.push({
          userId: summary.userId,
          profileId: summary.profileId,
          domain: 'profile',
          gap: 'profile.ready',
          bucket: 'trusted-usable',
          action: 'accept',
          severity: 'info',
          route: '/profile',
          details: {
            profileScore: summary.profileScore,
            schoolListCount: summary.schoolListCount,
          },
        });
      }
    }

    const orderedRows = rows
      .filter((row) => args.includeClosed || row.action !== 'accept')
      .sort(compareRows);
    const limitedRows = orderedRows.slice(0, args.limit);
    const report = {
      generatedAt: now.toISOString(),
      mode: 'read-only',
      applicationYear: args.applicationYear,
      staleDays: args.staleDays,
      readinessVersion: 'profile-readiness-v1',
      limits: {
        requested: args.limit,
        emittedRows: limitedRows.length,
        totalOpenRows: orderedRows.length,
      },
      summary: {
        users: users.length,
        profiles: users.filter((user) => user.profile).length,
        usersWithoutProfile: users.filter((user) => !user.profile).length,
        usersWithSchoolList: users.filter((user) => user.schoolListItems.length)
          .length,
        schoolListItems: users.reduce(
          (total, user) => total + user.schoolListItems.length,
          0,
        ),
        applicationTimelines: users.reduce(
          (total, user) => total + user.applicationTimelines.length,
          0,
        ),
        byDomain: countBy(orderedRows, (row) => row.domain),
        byAction: countBy(orderedRows, (row) => row.action),
        byGap: countBy(orderedRows, (row) => row.gap),
        bySeverity: countBy(orderedRows, (row) => row.severity),
      },
      nextCampaigns: rankCampaigns(orderedRows),
      rows: limitedRows,
    };

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Profile readiness worklist: ${args.out}`);
    console.log(
      `Rows: ${limitedRows.length}/${orderedRows.length}; profiles=${report.summary.profiles}; users=${report.summary.users}`,
    );
    for (const campaign of report.nextCampaigns.slice(0, 6)) {
      console.log(
        `- ${campaign.domain}/${campaign.action}: count=${campaign.count} severity=${campaign.maxSeverity}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function buildProfileRows(userId: string, profile: any | null): WorklistRow[] {
  if (!profile) {
    return [
      row(
        userId,
        null,
        'profile',
        'profile.missing',
        'missing-user-signal',
        'prompt-user',
        'critical',
        '/profile',
        {
          reason:
            'User has no Profile row, so prediction/recommendation/chat context cannot build a personalized applicant signal set.',
        },
      ),
    ];
  }

  const rows: WorklistRow[] = [];
  const profileId = profile.id as string;
  if (!resolveGpaAnchor(profile)) {
    rows.push(
      row(
        userId,
        profileId,
        'profile',
        'profile.gpa_anchor',
        'missing-user-signal',
        'prompt-user',
        'critical',
        '/profile?tab=gpa',
        { acceptedSources: ['gpa', 'grade-level GPA', 'semester GPA'] },
      ),
    );
  }
  const hasTestStrategy =
    (profile.testScores?.length ?? 0) > 0 || profile.applyingTestOptional;
  if (!hasTestStrategy) {
    rows.push(
      row(
        userId,
        profileId,
        'profile',
        'profile.test_strategy',
        'missing-user-signal',
        'prompt-user',
        'critical',
        '/profile?tab=scores',
        { acceptedSources: ['test score', 'explicit test-optional flag'] },
      ),
    );
  }
  if (!(profile.activities?.length > 0)) {
    rows.push(
      row(
        userId,
        profileId,
        'profile',
        'profile.activities',
        'missing-user-signal',
        'prompt-user',
        'warning',
        '/profile?tab=activities',
        {},
      ),
    );
  }
  const unmatchedActivities = (profile.activities ?? []).filter(
    (activity: { activityTemplateId: string | null }) =>
      !activity.activityTemplateId,
  ).length;
  if (unmatchedActivities > 0) {
    rows.push(
      row(
        userId,
        profileId,
        'profile',
        'profile.activities.template_unmatched',
        'needs-review',
        'match-activity-template',
        'info',
        '/profile?tab=activities',
        { unmatchedActivities },
      ),
    );
  }
  if (!(profile.awards?.length > 0)) {
    rows.push(
      row(
        userId,
        profileId,
        'profile',
        'profile.awards',
        'missing-user-signal',
        'prompt-user',
        'info',
        '/profile?tab=awards',
        {},
      ),
    );
  }
  const unmatchedAwards = (profile.awards ?? []).filter(
    (award: { competitionId: string | null }) => !award.competitionId,
  ).length;
  if (unmatchedAwards > 0) {
    rows.push(
      row(
        userId,
        profileId,
        'profile',
        'profile.awards.competition_unmatched',
        'needs-review',
        'match-award-competition',
        'info',
        '/profile?tab=awards',
        { unmatchedAwards },
      ),
    );
  }
  if (!profile.targetMajor && !profile.intendedMajor) {
    rows.push(
      row(
        userId,
        profileId,
        'profile',
        'profile.major',
        'missing-user-signal',
        'prompt-user',
        'critical',
        '/profile?tab=basic',
        {},
      ),
    );
  }
  if (!profile.grade || !profile.currentSchool) {
    rows.push(
      row(
        userId,
        profileId,
        'profile',
        'profile.basic_context',
        'missing-user-signal',
        'prompt-user',
        'warning',
        '/profile?tab=basic',
        {
          hasGrade: Boolean(profile.grade),
          hasCurrentSchool: Boolean(profile.currentSchool),
        },
      ),
    );
  }
  if (
    !profile.nationality &&
    !profile.countryOfResidence &&
    !profile.citizenship &&
    !profile.educationSystem
  ) {
    rows.push(
      row(
        userId,
        profileId,
        'profile',
        'profile.demographics',
        'missing-user-signal',
        'prompt-user',
        'warning',
        '/profile?tab=demographics',
        {},
      ),
    );
  }
  if (!(profile.education?.length > 0)) {
    rows.push(
      row(
        userId,
        profileId,
        'profile',
        'profile.education',
        'missing-user-signal',
        'prompt-user',
        'info',
        '/profile?tab=education',
        {},
      ),
    );
  }
  return rows;
}

function buildSchoolListRows(
  userId: string,
  profileId: string | null,
  schoolList: SchoolListItemLite[],
): WorklistRow[] {
  if (schoolList.length === 0) {
    return [
      row(
        userId,
        profileId,
        'school_list',
        'school_list.add_first',
        'consumer-gap',
        'prompt-user',
        'critical',
        '/schools',
        { reason: 'No canonical SchoolListItem rows exist for this user.' },
      ),
    ];
  }

  const rows: WorklistRow[] = [];
  const tiers = new Set(schoolList.map((item) => item.tier));
  if (schoolList.length < 6) {
    rows.push(
      row(
        userId,
        profileId,
        'school_list',
        'school_list.min_count',
        'consumer-gap',
        'balance-school-list',
        'warning',
        '/profile?tab=targets',
        { count: schoolList.length, recommendedMinimum: 6 },
      ),
    );
  }
  if (!tiers.has('REACH') || !tiers.has('TARGET') || !tiers.has('SAFETY')) {
    rows.push(
      row(
        userId,
        profileId,
        'school_list',
        'school_list.balance',
        'consumer-gap',
        'balance-school-list',
        'warning',
        '/profile?tab=targets',
        {
          tierCounts: {
            reach: schoolList.filter((item) => item.tier === 'REACH').length,
            target: schoolList.filter((item) => item.tier === 'TARGET').length,
            safety: schoolList.filter((item) => item.tier === 'SAFETY').length,
          },
        },
      ),
    );
  }
  for (const item of schoolList) {
    if (normalizeRound(item.round)) continue;
    rows.push(
      row(
        userId,
        profileId,
        'school_list',
        'school_list.round_missing',
        'consumer-gap',
        'set-application-round',
        'warning',
        '/profile?tab=targets',
        { schoolListItemId: item.id },
        item,
      ),
    );
  }
  return rows;
}

function buildDeadlineRows(
  userId: string,
  profileId: string | null,
  schoolList: SchoolListItemLite[],
  deadlineByRound: Set<string>,
  deadlineBySchool: Set<string>,
): WorklistRow[] {
  const rows: WorklistRow[] = [];
  for (const item of schoolList) {
    const round = normalizeRound(item.round);
    if (!round) continue;
    if (deadlineByRound.has(schoolRoundKey(item.schoolId, round))) continue;
    rows.push(
      row(
        userId,
        profileId,
        'deadline',
        deadlineBySchool.has(item.schoolId)
          ? 'deadline.round_missing'
          : 'deadline.school_missing',
        'needs-review',
        'review-deadline-source',
        'warning',
        '/timeline',
        {
          reason:
            'No SchoolDeadline row matches this school/round for the selected application year.',
        },
        item,
      ),
    );
  }
  return rows;
}

function buildTimelineRows(
  userId: string,
  profileId: string | null,
  schoolList: SchoolListItemLite[],
  timelines: TimelineLite[],
  deadlineByRound: Set<string>,
): WorklistRow[] {
  const coverageByRound = new Set(
    timelines.map((timeline) =>
      schoolRoundKey(timeline.schoolId, timeline.round),
    ),
  );
  const coverageBySchool = new Set(
    timelines.map((timeline) => timeline.schoolId),
  );
  const rows: WorklistRow[] = [];
  for (const item of schoolList) {
    const round = normalizeRound(item.round);
    const covered = round
      ? coverageByRound.has(schoolRoundKey(item.schoolId, round))
      : coverageBySchool.has(item.schoolId);
    if (covered) continue;
    const hasDeadline = round
      ? deadlineByRound.has(schoolRoundKey(item.schoolId, round))
      : false;
    rows.push(
      row(
        userId,
        profileId,
        'timeline',
        'timeline.missing_school_round',
        'consumer-gap',
        hasDeadline ? 'generate-timeline' : 'set-application-round',
        'warning',
        '/timeline',
        {
          hasDeadlineCandidate: hasDeadline,
          reason: hasDeadline
            ? 'SchoolDeadline exists and can seed ApplicationTimeline.'
            : 'Timeline generation is blocked until school round/deadline is known.',
        },
        item,
      ),
    );
  }
  const pendingTasks = timelines
    .flatMap((timeline) => timeline.tasks)
    .filter((task) => !task.completed);
  const overdue = pendingTasks.filter(
    (task) => task.dueDate && task.dueDate.getTime() < Date.now(),
  ).length;
  if (overdue > 0) {
    rows.push(
      row(
        userId,
        profileId,
        'timeline',
        'timeline.overdue_tasks',
        'consumer-gap',
        'prompt-user',
        'info',
        '/timeline',
        { overdueTaskCount: overdue },
      ),
    );
  }
  return rows;
}

function buildPredictionRows(
  userId: string,
  profileId: string | null,
  schoolList: SchoolListItemLite[],
  predictions: PredictionLite[],
  staleCutoff: number,
  staleDays: number,
): WorklistRow[] {
  if (!profileId || schoolList.length === 0) return [];
  const bySchool = new Map(predictions.map((item) => [item.schoolId, item]));
  const rows: WorklistRow[] = [];
  for (const item of schoolList) {
    const prediction = bySchool.get(item.schoolId);
    if (!prediction) {
      rows.push(
        row(
          userId,
          profileId,
          'prediction',
          'prediction.missing',
          'consumer-gap',
          'run-prediction',
          'warning',
          '/prediction',
          {
            reason:
              'No PredictionResult exists for this canonical SchoolListItem.',
          },
          item,
        ),
      );
      continue;
    }
    if (prediction.authority !== 'AUTHORITATIVE') {
      rows.push(
        row(
          userId,
          profileId,
          'prediction',
          'prediction.authoritative_missing',
          'consumer-gap',
          'run-prediction',
          'warning',
          '/prediction',
          { authority: prediction.authority ?? 'null' },
          item,
        ),
      );
      continue;
    }
    if (prediction.updatedAt.getTime() < staleCutoff) {
      rows.push(
        row(
          userId,
          profileId,
          'prediction',
          'prediction.stale',
          'consumer-gap',
          'refresh-prediction',
          'info',
          '/prediction',
          {
            updatedAt: prediction.updatedAt.toISOString(),
            staleDays,
          },
          item,
        ),
      );
    }
  }
  return rows;
}

function buildExecutionRows(
  userId: string,
  profileId: string | null,
  args: {
    essayCount: number;
    linkedEssayCount: number;
    recommendationLetters: Array<{
      id: string;
      status: string;
      dueDate: Date | null;
    }>;
    resumes: Array<{ id: string; aiIssues: Array<{ id: string }> }>;
    now: Date;
  },
): WorklistRow[] {
  const rows: WorklistRow[] = [];
  if (args.essayCount === 0) {
    rows.push(
      row(
        userId,
        profileId,
        'execution',
        'essays.none',
        'consumer-gap',
        'start-essay-workflow',
        'info',
        '/essays',
        {},
      ),
    );
  } else if (args.linkedEssayCount < args.essayCount) {
    rows.push(
      row(
        userId,
        profileId,
        'execution',
        'essays.prompt_link_missing',
        'needs-review',
        'start-essay-workflow',
        'info',
        '/essays',
        {
          essayCount: args.essayCount,
          linkedEssayCount: args.linkedEssayCount,
        },
      ),
    );
  }

  const submitted = args.recommendationLetters.filter((letter) =>
    ['SUBMITTED', 'CONFIRMED'].includes(letter.status),
  ).length;
  const overdue = args.recommendationLetters.filter(
    (letter) =>
      letter.dueDate &&
      letter.dueDate.getTime() < args.now.getTime() &&
      !['SUBMITTED', 'CONFIRMED'].includes(letter.status),
  ).length;
  if (submitted < 2) {
    rows.push(
      row(
        userId,
        profileId,
        'execution',
        'recommendation_letters.min_submitted',
        'consumer-gap',
        'add-recommendation-letters',
        'info',
        '/profile?tab=recLetters',
        {
          submittedOrConfirmedCount: submitted,
          totalRecommendationLetters: args.recommendationLetters.length,
        },
      ),
    );
  }
  if (overdue > 0) {
    rows.push(
      row(
        userId,
        profileId,
        'execution',
        'recommendation_letters.overdue',
        'consumer-gap',
        'prompt-user',
        'info',
        '/profile?tab=recLetters',
        { overdueRecommendationLetters: overdue },
      ),
    );
  }
  if (args.resumes.length === 0) {
    rows.push(
      row(
        userId,
        profileId,
        'execution',
        'resume.none',
        'consumer-gap',
        'create-resume',
        'info',
        '/resume',
        {},
      ),
    );
  } else if (args.resumes[0].aiIssues.length > 0) {
    rows.push(
      row(
        userId,
        profileId,
        'execution',
        'resume.open_issues',
        'needs-review',
        'create-resume',
        'info',
        '/resume',
        { openIssueCount: args.resumes[0].aiIssues.length },
      ),
    );
  }
  return rows;
}

function buildApplicationAnalysisRows(
  userId: string,
  profileId: string | null,
  args: {
    profileScore: number;
    schoolCount: number;
    predictionCount: number;
    latestRun: {
      state: string;
      dataQuality: unknown;
      targetSchoolCount: number | null;
      schoolsWithPredictions: number | null;
      createdAt: Date;
    } | null;
  },
): WorklistRow[] {
  if (!profileId || args.profileScore < 60 || args.schoolCount === 0) return [];
  if (args.predictionCount === 0) {
    return [
      row(
        userId,
        profileId,
        'application_analysis',
        'application_analysis.predictions_required',
        'consumer-gap',
        'run-prediction',
        'warning',
        '/prediction',
        { schoolCount: args.schoolCount },
      ),
    ];
  }
  if (!args.latestRun) {
    return [
      row(
        userId,
        profileId,
        'application_analysis',
        'application_analysis.not_run',
        'consumer-gap',
        'run-application-analysis',
        'info',
        '/uncommon-app',
        {
          profileScore: args.profileScore,
          schoolCount: args.schoolCount,
          authoritativePredictionCount: args.predictionCount,
        },
      ),
    ];
  }
  if (args.latestRun.state !== 'ready') {
    return [
      row(
        userId,
        profileId,
        'application_analysis',
        'application_analysis.not_ready',
        'needs-review',
        'run-application-analysis',
        'info',
        '/uncommon-app',
        {
          state: args.latestRun.state,
          dataQuality: args.latestRun.dataQuality,
          targetSchoolCount: args.latestRun.targetSchoolCount,
          schoolsWithPredictions: args.latestRun.schoolsWithPredictions,
          lastRunAt: args.latestRun.createdAt.toISOString(),
        },
      ),
    ];
  }
  return [];
}

function buildLegacyRows(
  userId: string,
  profileId: string | null,
  schoolList: SchoolListItemLite[],
  legacyTargets: Array<{
    id: string;
    schoolId: string;
    round: string | null;
  }>,
): WorklistRow[] {
  const canonicalBySchool = new Map(
    schoolList.map((item) => [item.schoolId, normalizeRound(item.round)]),
  );
  const rows: WorklistRow[] = [];
  for (const legacy of legacyTargets) {
    const canonicalRound = canonicalBySchool.get(legacy.schoolId);
    const legacyRound = normalizeRound(legacy.round);
    if (canonicalRound === undefined) {
      rows.push(
        row(
          userId,
          profileId,
          'legacy_target_school',
          'legacy_target_school.not_in_school_list',
          'conflict',
          'review-legacy-target-source',
          'warning',
          '/profile?tab=targets',
          {
            legacyTargetSchoolId: legacy.id,
            schoolId: legacy.schoolId,
            reason:
              'Deprecated ProfileTargetSchool row has no canonical SchoolListItem counterpart.',
          },
        ),
      );
    } else if (
      legacyRound &&
      canonicalRound &&
      legacyRound !== canonicalRound
    ) {
      rows.push(
        row(
          userId,
          profileId,
          'legacy_target_school',
          'legacy_target_school.round_conflict',
          'conflict',
          'review-legacy-target-source',
          'warning',
          '/profile?tab=targets',
          {
            legacyTargetSchoolId: legacy.id,
            schoolId: legacy.schoolId,
            legacyRound,
            canonicalRound,
          },
        ),
      );
    }
  }
  return rows;
}

function row(
  userId: string,
  profileId: string | null,
  domain: WorklistRow['domain'],
  gap: string,
  bucket: Bucket,
  action: WorklistAction,
  severity: Severity,
  route: string,
  details: Record<string, unknown>,
  schoolListItem?: SchoolListItemLite,
): WorklistRow {
  return {
    userId,
    profileId,
    domain,
    gap,
    bucket,
    action,
    severity,
    route,
    schoolId: schoolListItem?.schoolId,
    schoolName: schoolListItem?.school.name,
    round: normalizeRound(schoolListItem?.round),
    details,
  };
}

function resolveGpaAnchor(profile: any | null): boolean {
  if (!profile) return false;
  if (toNumber(profile.gpa) !== undefined) return true;
  if (
    [profile.gpa12, profile.gpa11, profile.gpa10, profile.gpa9].some(
      (value) => toNumber(value) !== undefined,
    )
  ) {
    return true;
  }
  return (profile.semesterGpas ?? []).some(
    (item: { gpa: unknown }) => toNumber(item.gpa) !== undefined,
  );
}

function profileCompletenessScore(profile: any | null): number {
  if (!profile) return 0;
  let score = 0;
  if (resolveGpaAnchor(profile)) score += 30;
  if ((profile.testScores?.length ?? 0) > 0 || profile.applyingTestOptional) {
    score += 15;
  }
  if ((profile.activities?.length ?? 0) > 0) score += 20;
  if ((profile.awards?.length ?? 0) > 0) score += 10;
  if (profile.targetMajor || profile.intendedMajor) score += 8;
  if (profile.grade && profile.currentSchool) score += 7;
  if (profile.visibility) score += 4;
  if (
    profile.nationality ||
    profile.countryOfResidence ||
    profile.citizenship ||
    profile.educationSystem
  ) {
    score += 6;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeRound(round?: string | null): string | null {
  if (!round) return null;
  const value = String(round).trim().toUpperCase().replace(/\s+/g, '_');
  if (!value) return null;
  if (['EARLY_DECISION', 'EARLY_DECISION_1'].includes(value)) return 'ED';
  if (['EARLY_DECISION_2', 'EDII', 'ED_II'].includes(value)) return 'ED2';
  if (['EARLY_ACTION', 'EARLY_ACTION_1'].includes(value)) return 'EA';
  if (
    ['RESTRICTIVE_EARLY_ACTION', 'SINGLE_CHOICE_EA', 'SCEA'].includes(value)
  ) {
    return 'REA';
  }
  if (['REGULAR_DECISION', 'REGULAR'].includes(value)) return 'RD';
  if (value.includes('ROLLING')) return 'ROLLING';
  return value;
}

function schoolRoundKey(schoolId: string, round?: string | null): string {
  return `${schoolId}:${normalizeRound(round) ?? '*'}`;
}

function countBy<T extends string>(
  rows: WorklistRow[],
  getKey: (row: WorklistRow) => T,
): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function rankCampaigns(rows: WorklistRow[]) {
  const grouped = new Map<string, WorklistRow[]>();
  for (const row of rows) {
    const key = `${row.domain}:${row.action}:${row.gap}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return Array.from(grouped.entries())
    .map(([key, group]) => {
      const [domain, action, gap] = key.split(':');
      const score = group.reduce(
        (sum, row) => sum + severityWeight(row.severity),
        0,
      );
      return {
        domain,
        action,
        gap,
        count: group.length,
        score,
        maxSeverity: maxSeverity(group),
        sampleUserIds: group.slice(0, 5).map((row) => row.userId),
      };
    })
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 12);
}

function maxSeverity(rows: WorklistRow[]): Severity {
  if (rows.some((row) => row.severity === 'critical')) return 'critical';
  if (rows.some((row) => row.severity === 'warning')) return 'warning';
  return 'info';
}

function compareRows(a: WorklistRow, b: WorklistRow): number {
  return (
    severityWeight(b.severity) - severityWeight(a.severity) ||
    a.domain.localeCompare(b.domain) ||
    a.gap.localeCompare(b.gap) ||
    a.userId.localeCompare(b.userId)
  );
}

function severityWeight(severity: Severity): number {
  if (severity === 'critical') return 5;
  if (severity === 'warning') return 3;
  return 1;
}

function summarizePrismaAuditError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const compactMessage = compactPrismaAuditMessage(message);
  const missingTable = message.match(/The table `([^`]+)` does not exist/);
  if (missingTable) {
    return {
      kind: 'database_schema_compatibility',
      message: `Current database is missing table ${missingTable[1]} required by the current Prisma schema`,
      rawError: message,
    };
  }
  const missingColumn = message.match(/The column `([^`]+)` does not exist/);
  if (missingColumn) {
    return {
      kind: 'database_schema_compatibility',
      message: `Current database is missing column ${missingColumn[1]} required by the current Prisma schema`,
      rawError: message,
    };
  }
  if (/Can't reach database server/i.test(message)) {
    return {
      kind: 'database_audit_availability',
      message: compactMessage,
      rawError: message,
    };
  }
  return {
    kind: 'profile_readiness_worklist_error',
    message: compactMessage,
    rawError: message,
  };
}

function compactPrismaAuditMessage(message: string): string {
  const unavailable = message.match(/Can't reach database server at `[^`]+`/i);
  if (unavailable) return unavailable[0];
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? message.trim() ?? message;
}

function writeBlockedReport(args: Args, error: unknown) {
  const blocker = summarizePrismaAuditError(error);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only',
    status: 'BLOCKED',
    applicationYear: args.applicationYear,
    staleDays: args.staleDays,
    readinessVersion: 'profile-readiness-v1',
    limits: {
      requested: args.limit,
      emittedRows: 0,
      totalOpenRows: 0,
    },
    summary: {
      users: 0,
      profiles: 0,
      usersWithoutProfile: 0,
      usersWithSchoolList: 0,
      schoolListItems: 0,
      applicationTimelines: 0,
      byDomain: {},
      byAction: {},
      byGap: {},
      bySeverity: {},
      blocker,
    },
    nextCampaigns: [
      {
        domain: blocker.kind,
        action: 'block-release',
        gap: blocker.kind,
        count: 1,
        score: severityWeight('critical'),
        maxSeverity: 'critical',
        sampleUserIds: [],
      },
    ],
    rows: [],
  };
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Profile readiness worklist: ${args.out}`);
  console.log(`Status=BLOCKED; blocker=${blocker.message}`);
}

main().catch((error) => {
  try {
    writeBlockedReport(parseArgs(), error);
  } catch {
    console.error(error);
    process.exitCode = 1;
  }
});
