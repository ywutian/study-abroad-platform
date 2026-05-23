#!/usr/bin/env tsx
import 'dotenv/config';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type PacketStatus =
  | 'PROFILE_READINESS_TIMELINE_SOURCE_ACTION_READY'
  | 'BLOCKED_TIMELINE_SOURCE_ACTION_INPUTS_MISSING'
  | 'PASS_NO_TIMELINE_SOURCE_REVIEW_ROWS';

type RecommendedOutcome =
  | 'link_existing_task_to_source_backed_prompt_candidate'
  | 'link_task_to_source_backed_prompt_or_mark_generic_candidate'
  | 'source_backed_prompt_missing_keep_task_review_only'
  | 'mark_generic_essay_task_candidate'
  | 'task_missing_review_required'
  | 'manual_deadline_source_url_review_candidate'
  | 'manual_deadline_source_missing_keep_review_only'
  | 'deadline_row_missing_review_required'
  | 'metadata_deadline_requires_source_backed_deadline_candidate'
  | 'missing_deadline_requires_source_backed_deadline_or_user_date'
  | 'deadline_fallback_school_missing_review_required'
  | 'deadline_fallback_refresh_closure_required'
  | 'school_list_essay_count_zero_until_prompt_sources_approved'
  | 'school_list_essay_count_use_source_backed_only_candidate'
  | 'school_list_essay_count_refresh_closure_required'
  | 'school_list_item_missing_review_required'
  | 'global_event_official_url_missing_keep_review_only'
  | 'global_event_url_refresh_closure_required'
  | 'global_event_row_missing_review_required'
  | 'global_event_inactive_terminal_review_candidate';

interface Args {
  timelineSourceClosure: string | null;
  rowId: string | null;
  rowIds: string[];
  queueType: string | null;
  queueTypes: string[];
  limit: number;
  applicationYear: number;
  out: string;
  markdown: string;
  csv: string;
}

interface TimelineSourceClosureReport {
  generatedAt?: string;
  status?: string;
  nextCampaign?: {
    firstRowId?: string;
  };
  rows?: TimelineSourceRow[];
}

interface TimelineSourceRow {
  id: string;
  queueType: string;
  rowState: string;
  severity: string;
  recipientKey?: string;
  schoolId?: string;
  schoolName?: string;
  round?: string | null;
  consumerSurface: string;
  consumerPolicy: string;
  requiredAction: string;
  sourceKind: string;
  sourceEvidence: string[];
  fieldRefs: string[];
  details: {
    timelineId?: string;
    taskId?: string;
    wordLimit?: number | null;
    weakStateVisible?: boolean;
    generationBlocksUnsourcedDeadline?: boolean;
    schoolListItemId?: string;
    category?: string;
    eventDate?: string | null;
    registrationDeadline?: string | null;
  };
}

interface SourceBackedPromptCandidate {
  essayPromptId: string;
  promptSha256: string;
  promptSnippet: string;
  wordLimit: number | null;
  sourceUrls: string[];
  sourceTypes: string[];
  maxConfidence: number | null;
}

interface DeadlineSnapshot {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolWebsite: string | null;
  year: number;
  round: string;
  applicationDeadline: string;
  financialAidDeadline: string | null;
  decisionDate: string | null;
  source: string;
  notesSha256: string | null;
  notesSourceUrl: string | null;
  updatedAt: string;
}

interface ExistingDeadlineCandidate {
  id: string;
  year: number;
  round: string;
  applicationDeadline: string;
  financialAidDeadline: string | null;
  decisionDate: string | null;
  source: string;
  notesSourceUrl: string | null;
  updatedAt: string;
}

interface DeadlineFallbackSnapshot {
  schoolId: string;
  schoolName: string;
  schoolWebsite: string | null;
  applicationYear: number;
  requestedRound: string | null;
  metadataDeadline: string | null;
  metadataDeadlineSha256: string | null;
  sourceEvidence: string[];
  existingCurrentYearDeadlineCandidates: ExistingDeadlineCandidate[];
  exactRoundDeadlineCandidate: ExistingDeadlineCandidate | null;
  sourceSearchPlan: {
    preferredSourceFamilies: string[];
    officialSearchQueries: string[];
    websiteCandidate: string | null;
  };
}

interface EssayCountPromptRef {
  essayPromptId: string;
  promptSha256: string;
  wordLimit: number | null;
  sourceUrlCount: number;
  sourceTypes: string[];
  maxConfidence: number | null;
}

interface SchoolListEssayCountSnapshot {
  schoolListItemId: string;
  schoolId: string;
  schoolName: string;
  schoolWebsite: string | null;
  applicationYear: number;
  round: string | null;
  verifiedCurrentYearPrompts: number;
  sourceBackedVerifiedCurrentYearPrompts: number;
  unbackedVerifiedCurrentYearPrompts: number;
  sourceBackedPromptRefs: EssayCountPromptRef[];
  unbackedVerifiedPromptRefs: EssayCountPromptRef[];
  sourceEvidence: string[];
}

interface GlobalEventSnapshot {
  id: string;
  titleSha256: string;
  titleSnippet: string;
  titleZhSha256: string | null;
  category: string;
  year: number;
  eventDate: string;
  registrationDeadline: string | null;
  lateDeadline: string | null;
  resultDate: string | null;
  url: string | null;
  descriptionSha256: string | null;
  isRecurring: boolean;
  isActive: boolean;
  updatedAt: string;
  sourceEvidence: string[];
  sourceSearchPlan: {
    preferredSourceFamilies: string[];
    officialSearchQueries: string[];
  };
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');

function detectApiRoot() {
  if (path.basename(process.cwd()) === 'api') return process.cwd();
  const candidate = path.join(process.cwd(), 'apps', 'api');
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  return process.cwd();
}

function resolveApplicationYear(now = new Date()) {
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
  const values = (name: string) => {
    const found: string[] = [];
    for (let index = 0; index < argv.length; index += 1) {
      const arg = argv[index];
      if (arg.startsWith(`${name}=`)) found.push(arg.slice(name.length + 1));
      if (arg === name && argv[index + 1]) found.push(argv[index + 1]);
    }
    return found;
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(
        REPORT_ROOT,
        `profile-readiness-timeline-source-action-${stamp}.json`,
      ),
    )!,
  );
  const closure = get('--timeline-source-closure');
  return {
    timelineSourceClosure: closure
      ? path.resolve(API_ROOT, closure)
      : findLatest(/^profile-readiness-timeline-source-closure-.+\.json$/),
    rowId: get('--row-id') ?? null,
    rowIds: values('--row-id'),
    queueType: get('--queue-type') ?? null,
    queueTypes: values('--queue-type'),
    limit: Number(get('--limit', '25')),
    applicationYear: Number(
      get('--application-year', `${resolveApplicationYear()}`),
    ),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
  };
}

async function main() {
  const args = parseArgs();
  if (
    !args.timelineSourceClosure ||
    !fs.existsSync(args.timelineSourceClosure)
  ) {
    writeAndPrint(
      args,
      blockedReport(args, 'timeline source closure artifact is missing'),
    );
    process.exitCode = 1;
    return;
  }

  const closure = readJson<TimelineSourceClosureReport>(
    args.timelineSourceClosure,
  );
  const targets = chooseTargetRows(closure, args);
  if (targets.length === 0) {
    writeAndPrint(args, {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-profile-readiness-timeline-source-action',
      status: 'PASS_NO_TIMELINE_SOURCE_REVIEW_ROWS' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      notificationSendAllowedByThisPlan: false,
      summary: {
        targetRows: 0,
        sourceBackedPromptCandidates: 0,
        exactSourceBackedPromptMatches: 0,
        deadlineRows: 0,
        deadlineSourceUrlCandidateRows: 0,
        consumerGateClosed: true,
      },
      rows: [],
    });
    return;
  }

  const prisma = new PrismaClient();
  try {
    const actions = await Promise.all(
      targets.map((target) => buildAction(prisma, target, args)),
    );
    const sourceBackedPromptCandidates = actions.flatMap(
      (action) => action.sourceBackedPromptCandidates,
    );
    const exactSourceBackedPromptMatches = actions.flatMap(
      (action) => action.exactSourceBackedPromptMatches,
    );
    const deadlineRows = actions.filter((action) => Boolean(action.deadline));
    const deadlineSourceUrlCandidateRows = actions.filter((action) =>
      Boolean(action.deadline?.notesSourceUrl),
    );
    const manualDeadlineRows = deadlineRows.filter(
      (action) => action.deadline?.source === 'MANUAL',
    );
    const deadlineMissingSourceUrlRows = deadlineRows.filter(
      (action) => !action.deadline?.notesSourceUrl,
    );
    const deadlineFallbackRows = actions.filter((action) =>
      Boolean(action.deadlineFallback),
    );
    const metadataFallbackRows = actions.filter(
      (action) => action.target.queueType === 'heuristic_metadata_fallback',
    );
    const defaultDeadlineFallbackRows = actions.filter(
      (action) => action.target.queueType === 'heuristic_default_rd_fallback',
    );
    const deadlineFallbackRowsWithMetadataValue = deadlineFallbackRows.filter(
      (action) => Boolean(action.deadlineFallback?.metadataDeadline),
    );
    const deadlineFallbackExistingCurrentYearRows = deadlineFallbackRows.filter(
      (action) =>
        (action.deadlineFallback?.existingCurrentYearDeadlineCandidates
          .length ?? 0) > 0,
    );
    const schoolListEssayCountRows = actions.filter((action) =>
      Boolean(action.schoolListEssayCount),
    );
    const schoolListEssayCountRowsWithSourceBacked =
      schoolListEssayCountRows.filter(
        (action) =>
          (action.schoolListEssayCount
            ?.sourceBackedVerifiedCurrentYearPrompts ?? 0) > 0,
      );
    const schoolListEssayCountRowsWithZeroSourceBacked =
      schoolListEssayCountRows.filter(
        (action) =>
          action.schoolListEssayCount
            ?.sourceBackedVerifiedCurrentYearPrompts === 0,
      );
    const schoolListEssayCountUnbackedPromptRefs =
      schoolListEssayCountRows.reduce(
        (total, action) =>
          total +
          (action.schoolListEssayCount?.unbackedVerifiedCurrentYearPrompts ??
            0),
        0,
      );
    const globalEventRows = actions.filter((action) =>
      Boolean(action.globalEvent),
    );
    const globalEventRowsMissingUrl = globalEventRows.filter(
      (action) => !action.globalEvent?.url,
    );
    const globalEventRowsWithUrl = globalEventRows.filter((action) =>
      Boolean(action.globalEvent?.url),
    );
    const inactiveGlobalEventRows = globalEventRows.filter(
      (action) => action.globalEvent?.isActive === false,
    );
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-profile-readiness-timeline-source-action',
      status:
        'PROFILE_READINESS_TIMELINE_SOURCE_ACTION_READY' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      notificationSendAllowedByThisPlan: false,
      sourceArtifacts: {
        timelineSourceClosure: path.relative(
          API_ROOT,
          args.timelineSourceClosure,
        ),
        timelineSourceClosureGeneratedAt: closure.generatedAt ?? null,
        timelineSourceClosureStatus: closure.status ?? null,
      },
      reviewContract: {
        noDbWrites: true,
        noTaskMutation: true,
        noPromptMutation: true,
        noDeadlineMutation: true,
        noSchoolListMutation: true,
        noGlobalEventMutation: true,
        noNotificationSend: true,
        consumerGate:
          'school-specific essay tasks, manual deadline rows, heuristic deadline fallbacks, school-list essay counts, and global events stay hidden or source-review labeled until source-backed evidence, generic/terminal disposition, user-provided date, source-backed count policy, official event URL, or reviewer approval exists',
        requiredReviewerInputs: [
          'approvedReviewerWorkflowId',
          'confirmedTaskDisposition',
          'confirmedSourceBackedEssayPromptIdOrGenericTask',
          'confirmedOfficialDeadlineSourceUrlOrTerminalNoPublicSource',
          'confirmedHeuristicDeadlineDisposition',
          'confirmedSchoolListEssayCountUsesSourceBackedPromptsOnly',
          'confirmedOfficialGlobalEventUrlOrTerminalNoPublicSource',
          'confirmedConsumerGatesRemainVisible',
        ],
      },
      summary: {
        targetRows: actions.length,
        sourceBackedPromptCandidates: sourceBackedPromptCandidates.length,
        exactSourceBackedPromptMatches: exactSourceBackedPromptMatches.length,
        taskHasEssayPromptRows: actions.filter((action) =>
          Boolean(action.task?.essayPrompt),
        ).length,
        taskFoundRows: actions.filter((action) => Boolean(action.task)).length,
        deadlineRows: deadlineRows.length,
        manualDeadlineRows: manualDeadlineRows.length,
        deadlineSourceUrlCandidateRows: deadlineSourceUrlCandidateRows.length,
        deadlineMissingSourceUrlRows: deadlineMissingSourceUrlRows.length,
        deadlineFallbackRows: deadlineFallbackRows.length,
        metadataFallbackRows: metadataFallbackRows.length,
        defaultDeadlineFallbackRows: defaultDeadlineFallbackRows.length,
        deadlineFallbackRowsWithMetadataValue:
          deadlineFallbackRowsWithMetadataValue.length,
        deadlineFallbackExistingCurrentYearRows:
          deadlineFallbackExistingCurrentYearRows.length,
        schoolListEssayCountRows: schoolListEssayCountRows.length,
        schoolListEssayCountRowsWithSourceBacked:
          schoolListEssayCountRowsWithSourceBacked.length,
        schoolListEssayCountRowsWithZeroSourceBacked:
          schoolListEssayCountRowsWithZeroSourceBacked.length,
        schoolListEssayCountUnbackedPromptRefs,
        globalEventRows: globalEventRows.length,
        globalEventRowsMissingUrl: globalEventRowsMissingUrl.length,
        globalEventRowsWithUrl: globalEventRowsWithUrl.length,
        inactiveGlobalEventRows: inactiveGlobalEventRows.length,
        byGlobalEventCategory: countBy(
          globalEventRows,
          (action) => action.globalEvent?.category ?? 'unknown',
        ),
        consumerGateClosed: false,
        recommendedOutcome: actions[0]?.recommendedDecision.outcome ?? null,
        nextAction: actions[0]?.recommendedDecision.nextAction ?? null,
        byRecommendedOutcome: countBy(
          actions,
          (action) => action.recommendedDecision.outcome,
        ),
        byQueueType: countBy(actions, (action) => action.target.queueType),
        reviewerApprovalReady: false,
      },
      target: actions[0]?.target ?? null,
      task: actions[0]?.task ?? null,
      deadline: actions[0]?.deadline ?? null,
      deadlineFallback: actions[0]?.deadlineFallback ?? null,
      schoolListEssayCount: actions[0]?.schoolListEssayCount ?? null,
      globalEvent: actions[0]?.globalEvent ?? null,
      sourceBackedPromptCandidates,
      exactSourceBackedPromptMatches,
      recommendedDecision: actions[0]?.recommendedDecision ?? null,
      actions,
      rows: actions.map((action) => ({
        rowId: action.target.id,
        queueType: action.target.queueType,
        schoolName: action.target.schoolName,
        taskId: action.target.details.taskId ?? null,
        deadlineId: action.deadline?.id ?? null,
        fallbackRound: action.deadlineFallback?.requestedRound ?? null,
        metadataDeadlineSha256:
          action.deadlineFallback?.metadataDeadlineSha256 ?? null,
        schoolListItemId:
          action.schoolListEssayCount?.schoolListItemId ??
          action.target.details.schoolListItemId ??
          null,
        verifiedCurrentYearPrompts:
          action.schoolListEssayCount?.verifiedCurrentYearPrompts ?? null,
        sourceBackedVerifiedCurrentYearPrompts:
          action.schoolListEssayCount?.sourceBackedVerifiedCurrentYearPrompts ??
          null,
        unbackedVerifiedCurrentYearPrompts:
          action.schoolListEssayCount?.unbackedVerifiedCurrentYearPrompts ??
          null,
        globalEventId: action.globalEvent?.id ?? null,
        globalEventCategory: action.globalEvent?.category ?? null,
        globalEventTitleSha256: action.globalEvent?.titleSha256 ?? null,
        outcome: action.recommendedDecision.outcome,
        nextAction: action.recommendedDecision.nextAction,
      })),
    };
    writeAndPrint(args, report);
  } finally {
    await prisma.$disconnect();
  }
}

function chooseTargetRows(
  report: TimelineSourceClosureReport,
  args: Args,
): TimelineSourceRow[] {
  const rows = report.rows ?? [];
  const rowIds = unique([...args.rowIds, ...(args.rowId ? [args.rowId] : [])]);
  const queueTypes = unique([
    ...args.queueTypes,
    ...(args.queueType ? [args.queueType] : []),
  ]);
  if (rowIds.length > 0) {
    return uniqueBy(
      rowIds
        .map((rowId) => rows.find((row) => row.id === rowId))
        .filter((row): row is TimelineSourceRow => Boolean(row)),
      (row) => row.id,
    ).slice(0, args.limit);
  }
  if (queueTypes.length > 0) {
    return rows
      .filter(
        (row) =>
          queueTypes.includes(row.queueType) && row.rowState !== 'trusted',
      )
      .slice(0, args.limit);
  }
  const nextRowId = report.nextCampaign?.firstRowId;
  if (nextRowId) {
    const nextRow = rows.find((row) => row.id === nextRowId);
    if (nextRow) return [nextRow];
  }
  const fallback = rows.find(
    (row) =>
      row.queueType === 'essay_task_source_blocked' &&
      row.rowState !== 'trusted',
  );
  return fallback ? [fallback] : [];
}

async function buildAction(
  prisma: PrismaClient,
  target: TimelineSourceRow,
  args: Args,
) {
  const isDeadlineReview = target.queueType === 'operator_deadline_review';
  const isDeadlineFallback = isDeadlineFallbackQueue(target.queueType);
  const isSchoolListEssayCount =
    target.queueType === 'school_list_essay_count_source_mismatch';
  const isGlobalEvent = target.queueType === 'global_event_source_review';
  const taskId =
    isDeadlineReview ||
    isDeadlineFallback ||
    isSchoolListEssayCount ||
    isGlobalEvent
      ? null
      : (target.details.taskId ?? parseTaskId(target.id));
  const task = taskId
    ? await prisma.applicationTask.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          title: true,
          type: true,
          essayPrompt: true,
          wordLimit: true,
          timeline: {
            select: {
              id: true,
              schoolId: true,
              schoolName: true,
              round: true,
              deadline: true,
              school: { select: { name: true } },
            },
          },
        },
      })
    : null;
  const schoolId =
    isDeadlineReview ||
    isDeadlineFallback ||
    isSchoolListEssayCount ||
    isGlobalEvent
      ? null
      : (task?.timeline.schoolId ?? target.schoolId);
  const sourceBackedPrompts = schoolId
    ? await prisma.essayPrompt.findMany({
        where: {
          schoolId,
          year: args.applicationYear,
          isActive: true,
          status: 'VERIFIED',
          sources: { some: { sourceUrl: { not: null } } },
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          prompt: true,
          wordLimit: true,
          sources: {
            where: { sourceUrl: { not: null } },
            select: {
              sourceUrl: true,
              sourceType: true,
              confidence: true,
            },
          },
        },
      })
    : [];
  const deadlineId = parseDeadlineId(target.sourceEvidence);
  const deadline = deadlineId
    ? await prisma.schoolDeadline.findUnique({
        where: { id: deadlineId },
        select: {
          id: true,
          schoolId: true,
          year: true,
          round: true,
          applicationDeadline: true,
          financialAidDeadline: true,
          decisionDate: true,
          source: true,
          notes: true,
          updatedAt: true,
          school: { select: { name: true, website: true } },
        },
      })
    : null;
  const deadlineSnapshot: DeadlineSnapshot | null = deadline
    ? {
        id: deadline.id,
        schoolId: deadline.schoolId,
        schoolName: deadline.school.name,
        schoolWebsite: normalizeUrl(deadline.school.website),
        year: deadline.year,
        round: deadline.round,
        applicationDeadline: deadline.applicationDeadline.toISOString(),
        financialAidDeadline:
          deadline.financialAidDeadline?.toISOString() ?? null,
        decisionDate: deadline.decisionDate?.toISOString() ?? null,
        source: deadline.source,
        notesSha256: deadline.notes ? sha256(deadline.notes) : null,
        notesSourceUrl: extractSourceUrl(deadline.notes),
        updatedAt: deadline.updatedAt.toISOString(),
      }
    : null;
  const deadlineFallback = await buildDeadlineFallbackSnapshot(
    prisma,
    target,
    args,
  );
  const schoolListEssayCount = await buildSchoolListEssayCountSnapshot(
    prisma,
    target,
    args,
  );
  const globalEvent = await buildGlobalEventSnapshot(prisma, target);
  const candidates = sourceBackedPrompts.map((prompt) => ({
    essayPromptId: prompt.id,
    promptSha256: sha256(prompt.prompt),
    promptSnippet: snippet(prompt.prompt),
    wordLimit: prompt.wordLimit,
    sourceUrls: unique(
      prompt.sources
        .map((source) => source.sourceUrl)
        .filter((url): url is string => Boolean(url)),
    ),
    sourceTypes: unique(prompt.sources.map((source) => source.sourceType)),
    maxConfidence:
      prompt.sources.reduce<number | null>((max, source) => {
        if (typeof source.confidence !== 'number') return max;
        return max === null
          ? source.confidence
          : Math.max(max, source.confidence);
      }, null) ?? null,
  }));
  const exactPromptIds = new Set(
    task?.essayPrompt
      ? sourceBackedPrompts
          .filter(
            (prompt) =>
              normalize(prompt.prompt) === normalize(task.essayPrompt),
          )
          .map((prompt) => prompt.id)
      : [],
  );
  const exactMatches = candidates.filter((candidate) =>
    exactPromptIds.has(candidate.essayPromptId),
  );
  const recommendedDecision = buildRecommendedDecision({
    target,
    task: task
      ? {
          id: task.id,
          title: task.title,
          type: String(task.type),
          essayPrompt: task.essayPrompt,
          wordLimit: task.wordLimit,
          timelineId: task.timeline.id,
          schoolId: task.timeline.schoolId,
          schoolName: task.timeline.schoolName || task.timeline.school.name,
          round: task.timeline.round,
          deadline: task.timeline.deadline?.toISOString() ?? null,
        }
      : null,
    deadline: deadlineSnapshot,
    deadlineFallback,
    schoolListEssayCount,
    globalEvent,
    sourceBackedPromptCandidates: candidates,
    exactSourceBackedPromptMatches: exactMatches,
  });
  return {
    target,
    task: task
      ? {
          id: task.id,
          title: task.title,
          type: String(task.type),
          essayPrompt: task.essayPrompt,
          wordLimit: task.wordLimit,
          timelineId: task.timeline.id,
          schoolId: task.timeline.schoolId,
          schoolName: task.timeline.schoolName || task.timeline.school.name,
          round: task.timeline.round,
          deadline: task.timeline.deadline?.toISOString() ?? null,
        }
      : null,
    deadline: deadlineSnapshot,
    deadlineFallback,
    schoolListEssayCount,
    globalEvent,
    sourceBackedPromptCandidates: candidates,
    exactSourceBackedPromptMatches: exactMatches,
    recommendedDecision,
  };
}

async function buildSchoolListEssayCountSnapshot(
  prisma: PrismaClient,
  target: TimelineSourceRow,
  args: Args,
): Promise<SchoolListEssayCountSnapshot | null> {
  if (target.queueType !== 'school_list_essay_count_source_mismatch') {
    return null;
  }
  const schoolListItemId =
    target.details.schoolListItemId ?? parseSchoolListItemId(target.id);
  if (!schoolListItemId) return null;

  const item = await prisma.schoolListItem.findUnique({
    where: { id: schoolListItemId },
    select: {
      id: true,
      schoolId: true,
      round: true,
      school: {
        select: {
          name: true,
          website: true,
          essayPrompts: {
            where: {
              year: args.applicationYear,
              isActive: true,
              status: 'VERIFIED',
            },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              prompt: true,
              wordLimit: true,
              sources: {
                where: { sourceUrl: { not: null } },
                select: {
                  sourceUrl: true,
                  sourceType: true,
                  confidence: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!item) return null;

  const sourceBackedPromptRefs: EssayCountPromptRef[] = [];
  const unbackedVerifiedPromptRefs: EssayCountPromptRef[] = [];
  for (const prompt of item.school.essayPrompts) {
    const promptRef = buildEssayCountPromptRef(prompt);
    if (promptRef.sourceUrlCount > 0) {
      sourceBackedPromptRefs.push(promptRef);
    } else {
      unbackedVerifiedPromptRefs.push(promptRef);
    }
  }

  return {
    schoolListItemId: item.id,
    schoolId: item.schoolId,
    schoolName: item.school.name,
    schoolWebsite: normalizeUrl(item.school.website),
    applicationYear: args.applicationYear,
    round: item.round,
    verifiedCurrentYearPrompts: item.school.essayPrompts.length,
    sourceBackedVerifiedCurrentYearPrompts: sourceBackedPromptRefs.length,
    unbackedVerifiedCurrentYearPrompts: unbackedVerifiedPromptRefs.length,
    sourceBackedPromptRefs,
    unbackedVerifiedPromptRefs,
    sourceEvidence: target.sourceEvidence,
  };
}

function buildEssayCountPromptRef(prompt: {
  id: string;
  prompt: string;
  wordLimit: number | null;
  sources: Array<{
    sourceUrl: string | null;
    sourceType: string;
    confidence: number | null;
  }>;
}): EssayCountPromptRef {
  return {
    essayPromptId: prompt.id,
    promptSha256: sha256(prompt.prompt),
    wordLimit: prompt.wordLimit,
    sourceUrlCount: prompt.sources.filter((source) =>
      Boolean(source.sourceUrl?.trim()),
    ).length,
    sourceTypes: unique(prompt.sources.map((source) => source.sourceType)),
    maxConfidence:
      prompt.sources.reduce<number | null>((max, source) => {
        if (typeof source.confidence !== 'number') return max;
        return max === null
          ? source.confidence
          : Math.max(max, source.confidence);
      }, null) ?? null,
  };
}

async function buildGlobalEventSnapshot(
  prisma: PrismaClient,
  target: TimelineSourceRow,
): Promise<GlobalEventSnapshot | null> {
  if (target.queueType !== 'global_event_source_review') return null;
  const globalEventId = parseGlobalEventId(target.id);
  if (!globalEventId) return null;
  const event = await prisma.globalEvent.findUnique({
    where: { id: globalEventId },
    select: {
      id: true,
      title: true,
      titleZh: true,
      category: true,
      year: true,
      eventDate: true,
      registrationDeadline: true,
      lateDeadline: true,
      resultDate: true,
      url: true,
      description: true,
      isRecurring: true,
      isActive: true,
      updatedAt: true,
    },
  });
  if (!event) return null;
  return {
    id: event.id,
    titleSha256: sha256(event.title),
    titleSnippet: snippet(event.title, 120),
    titleZhSha256: event.titleZh ? sha256(event.titleZh) : null,
    category: String(event.category),
    year: event.year,
    eventDate: event.eventDate.toISOString(),
    registrationDeadline: event.registrationDeadline?.toISOString() ?? null,
    lateDeadline: event.lateDeadline?.toISOString() ?? null,
    resultDate: event.resultDate?.toISOString() ?? null,
    url: normalizeUrl(event.url),
    descriptionSha256: event.description ? sha256(event.description) : null,
    isRecurring: event.isRecurring,
    isActive: event.isActive,
    updatedAt: event.updatedAt.toISOString(),
    sourceEvidence: target.sourceEvidence,
    sourceSearchPlan: buildGlobalEventSourceSearchPlan({
      title: event.title,
      category: String(event.category),
      year: event.year,
      eventDate: event.eventDate.toISOString(),
    }),
  };
}

function buildGlobalEventSourceSearchPlan(args: {
  title: string;
  category: string;
  year: number;
  eventDate: string;
}) {
  const title = args.title.trim();
  const normalizedTitle = normalize(title);
  const preferredSourceFamilies = ['official event organizer page'];
  const officialSearchQueries = [
    `${title} official date ${args.year}`,
    `${title} registration deadline ${args.year}`,
  ];

  if (normalizedTitle.includes('sat')) {
    preferredSourceFamilies.unshift('College Board official SAT dates page');
    officialSearchQueries.unshift(
      `College Board SAT test dates ${args.year}`,
      `College Board SAT registration deadlines ${args.year}`,
    );
  } else if (normalizedTitle.includes('act')) {
    preferredSourceFamilies.unshift('ACT official test dates page');
    officialSearchQueries.unshift(
      `ACT test dates ${args.year}`,
      `ACT registration deadlines ${args.year}`,
    );
  } else if (normalizedTitle.includes('toefl')) {
    preferredSourceFamilies.unshift('ETS official TOEFL iBT dates page');
    officialSearchQueries.unshift(
      `ETS TOEFL iBT test dates ${args.year}`,
      `TOEFL iBT registration deadlines ${args.year}`,
    );
  } else if (
    normalizedTitle.includes('amc') ||
    normalizedTitle.includes('aime')
  ) {
    preferredSourceFamilies.unshift('MAA official AMC/AIME calendar');
    officialSearchQueries.unshift(
      `MAA AMC AIME dates ${args.year}`,
      `AMC AIME official competition calendar ${args.year}`,
    );
  } else if (normalizedTitle.includes('usabo')) {
    preferredSourceFamilies.unshift('USABO official schedule page');
    officialSearchQueries.unshift(
      `USABO official exam dates ${args.year}`,
      `USABO registration deadline ${args.year}`,
    );
  } else if (normalizedTitle.includes('usaco')) {
    preferredSourceFamilies.unshift('USACO official contest schedule');
    officialSearchQueries.unshift(
      `USACO contest schedule ${args.year}`,
      `USACO official contest dates ${args.year}`,
    );
  }

  return {
    preferredSourceFamilies: unique(preferredSourceFamilies),
    officialSearchQueries: unique([
      ...officialSearchQueries,
      `${args.category} ${title} official source ${args.eventDate.slice(0, 10)}`,
    ]),
  };
}

async function buildDeadlineFallbackSnapshot(
  prisma: PrismaClient,
  target: TimelineSourceRow,
  args: Args,
): Promise<DeadlineFallbackSnapshot | null> {
  if (!isDeadlineFallbackQueue(target.queueType) || !target.schoolId) {
    return null;
  }
  const requestedRound = target.round?.trim() || null;
  const school = await prisma.school.findUnique({
    where: { id: target.schoolId },
    select: {
      id: true,
      name: true,
      website: true,
      metadata: true,
      deadlines: {
        where: { year: args.applicationYear },
        orderBy: [{ round: 'asc' }, { applicationDeadline: 'asc' }],
        select: {
          id: true,
          year: true,
          round: true,
          applicationDeadline: true,
          financialAidDeadline: true,
          decisionDate: true,
          source: true,
          notes: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!school) return null;

  const existingCurrentYearDeadlineCandidates = school.deadlines.map(
    (deadline) => ({
      id: deadline.id,
      year: deadline.year,
      round: deadline.round,
      applicationDeadline: deadline.applicationDeadline.toISOString(),
      financialAidDeadline:
        deadline.financialAidDeadline?.toISOString() ?? null,
      decisionDate: deadline.decisionDate?.toISOString() ?? null,
      source: deadline.source,
      notesSourceUrl: extractSourceUrl(deadline.notes),
      updatedAt: deadline.updatedAt.toISOString(),
    }),
  );
  const exactRoundDeadlineCandidate =
    existingCurrentYearDeadlineCandidates.find(
      (deadline) =>
        normalizeRound(deadline.round) === normalizeRound(requestedRound),
    ) ?? null;
  const metadataDeadline = requestedRound
    ? getMetadataDeadline(school.metadata, requestedRound)
    : null;

  return {
    schoolId: school.id,
    schoolName: school.name,
    schoolWebsite: normalizeUrl(school.website),
    applicationYear: args.applicationYear,
    requestedRound,
    metadataDeadline,
    metadataDeadlineSha256: metadataDeadline ? sha256(metadataDeadline) : null,
    sourceEvidence: target.sourceEvidence,
    existingCurrentYearDeadlineCandidates,
    exactRoundDeadlineCandidate,
    sourceSearchPlan: buildDeadlineSourceSearchPlan({
      schoolName: school.name,
      schoolWebsite: normalizeUrl(school.website),
      applicationYear: args.applicationYear,
      requestedRound,
    }),
  };
}

function buildRecommendedDecision(input: {
  target: TimelineSourceRow;
  task: {
    id: string;
    title: string;
    type: string;
    essayPrompt: string | null;
    wordLimit: number | null;
    timelineId: string;
    schoolId: string;
    schoolName: string;
    round: string;
    deadline: string | null;
  } | null;
  deadline: DeadlineSnapshot | null;
  deadlineFallback: DeadlineFallbackSnapshot | null;
  schoolListEssayCount: SchoolListEssayCountSnapshot | null;
  globalEvent: GlobalEventSnapshot | null;
  sourceBackedPromptCandidates: SourceBackedPromptCandidate[];
  exactSourceBackedPromptMatches: SourceBackedPromptCandidate[];
}) {
  const requiredReviewerInputs = [
    'approvedReviewerWorkflowId',
    'confirmedTaskDisposition',
    'confirmedConsumerGatesRemainVisible',
  ];
  const prohibitedActions = [
    'do not mutate ApplicationTask from this packet',
    'do not infer an EssayPrompt link without source-backed current-year evidence',
    'do not show school-specific essay task as authoritative while source review is open',
  ];

  if (input.target.queueType === 'global_event_source_review') {
    const globalEventInputs = [
      'approvedReviewerWorkflowId',
      'confirmedOfficialGlobalEventUrlOrTerminalNoPublicSource',
      'confirmedEventDateMatchesOfficialSource',
      'confirmedRegistrationDeadlineMatchesOfficialSourceOrIsUnavailable',
      'confirmedEventYearCategoryAndActiveState',
      'confirmedTimelineConsumersKeepReviewLabelUntilWrite',
    ];
    const globalEventProhibitedActions = [
      'do not mutate GlobalEvent from this packet',
      'do not treat global events without official URLs as source-backed timeline facts',
      'do not send reminders or official-source claims from review-only global event evidence',
    ];
    if (!input.globalEvent) {
      return {
        outcome:
          'global_event_row_missing_review_required' satisfies RecommendedOutcome,
        nextAction:
          'review-missing-global-event-or-refresh-timeline-source-closure',
        confidence: 'candidate_only',
        reason:
          'The timeline source row points to a GlobalEvent that is missing from the current database snapshot.',
        requiredReviewerInputs: globalEventInputs,
        prohibitedActions: globalEventProhibitedActions,
      };
    }
    if (!input.globalEvent.isActive) {
      return {
        outcome:
          'global_event_inactive_terminal_review_candidate' satisfies RecommendedOutcome,
        nextAction:
          'review-inactive-global-event-terminal-disposition-or-refresh-closure',
        confidence: 'candidate_only',
        reason:
          'The GlobalEvent is inactive in the current database snapshot; reviewer should confirm terminal/suppressed consumer handling or refresh closure.',
        globalEventId: input.globalEvent.id,
        requiredReviewerInputs: globalEventInputs,
        prohibitedActions: globalEventProhibitedActions,
      };
    }
    if (input.globalEvent.url) {
      return {
        outcome:
          'global_event_url_refresh_closure_required' satisfies RecommendedOutcome,
        nextAction:
          'refresh-timeline-source-closure-and-verify-global-event-url',
        confidence: 'candidate_only',
        reason:
          'The GlobalEvent now has a URL in the current database snapshot; refresh closure and verify that the URL is official and matches date/deadline facts before treating it as source-backed.',
        globalEventId: input.globalEvent.id,
        sourceUrl: input.globalEvent.url,
        requiredReviewerInputs: globalEventInputs,
        prohibitedActions: globalEventProhibitedActions,
      };
    }
    return {
      outcome:
        'global_event_official_url_missing_keep_review_only' satisfies RecommendedOutcome,
      nextAction: 'add-official-event-url-or-mark-terminal',
      confidence: 'candidate_only',
      reason:
        'The GlobalEvent is active but has no official URL, so timeline consumers must keep it review-only or suppress official-source claims until an official source or terminal disposition exists.',
      globalEventId: input.globalEvent.id,
      category: input.globalEvent.category,
      sourceSearchPlan: input.globalEvent.sourceSearchPlan,
      requiredReviewerInputs: globalEventInputs,
      prohibitedActions: globalEventProhibitedActions,
    };
  }

  if (input.target.queueType === 'school_list_essay_count_source_mismatch') {
    const essayCountInputs = [
      'approvedReviewerWorkflowId',
      'confirmedSchoolListEssayCountUsesSourceBackedPromptsOnly',
      'confirmedUnbackedVerifiedPromptIdsStayHidden',
      'confirmedEssayPromptSourceApprovalOrTerminalDisposition',
      'confirmedSchoolListWeakStateCopy',
    ];
    const essayCountProhibitedActions = [
      'do not mutate SchoolListItem from this packet',
      'do not mutate EssayPrompt or EssayPromptSource from this packet',
      'do not count source-less verified prompts in user-facing school-list essayPromptCount',
      'do not expose unbacked prompt text in school-list, timeline, chat, prediction, or application-analysis consumers',
    ];
    if (!input.schoolListEssayCount) {
      return {
        outcome:
          'school_list_item_missing_review_required' satisfies RecommendedOutcome,
        nextAction:
          'review-missing-school-list-item-or-refresh-timeline-source-closure',
        confidence: 'candidate_only',
        reason:
          'The essay-count source mismatch row points to a SchoolListItem that is missing from the current database snapshot.',
        requiredReviewerInputs: essayCountInputs,
        prohibitedActions: essayCountProhibitedActions,
      };
    }
    if (input.schoolListEssayCount.unbackedVerifiedCurrentYearPrompts === 0) {
      return {
        outcome:
          'school_list_essay_count_refresh_closure_required' satisfies RecommendedOutcome,
        nextAction:
          'refresh-timeline-source-closure-and-verify-school-list-count-gate',
        confidence: 'candidate_only',
        reason:
          'The current database snapshot no longer has source-less verified current-year prompts for this school-list item; refresh the closure packet and verify the consumer count gate.',
        sourceBackedCount:
          input.schoolListEssayCount.sourceBackedVerifiedCurrentYearPrompts,
        requiredReviewerInputs: essayCountInputs,
        prohibitedActions: essayCountProhibitedActions,
      };
    }
    if (input.schoolListEssayCount.sourceBackedVerifiedCurrentYearPrompts > 0) {
      return {
        outcome:
          'school_list_essay_count_use_source_backed_only_candidate' satisfies RecommendedOutcome,
        nextAction:
          'verify-consumer-counts-only-source-backed-prompts-and-queue-unbacked-prompts',
        confidence: 'candidate_only',
        reason:
          'The school has some source-backed verified current-year prompts, but additional verified prompts lack source evidence; consumers may count only the source-backed subset while routing unbacked prompt IDs to source review.',
        sourceBackedCount:
          input.schoolListEssayCount.sourceBackedVerifiedCurrentYearPrompts,
        unbackedVerifiedCount:
          input.schoolListEssayCount.unbackedVerifiedCurrentYearPrompts,
        unbackedVerifiedPromptIds:
          input.schoolListEssayCount.unbackedVerifiedPromptRefs.map(
            (prompt) => prompt.essayPromptId,
          ),
        requiredReviewerInputs: essayCountInputs,
        prohibitedActions: essayCountProhibitedActions,
      };
    }
    return {
      outcome:
        'school_list_essay_count_zero_until_prompt_sources_approved' satisfies RecommendedOutcome,
      nextAction:
        'show-zero-or-review-only-essay-count-until-prompt-sources-approved',
      confidence: 'candidate_only',
      reason:
        'The school-list row has verified current-year prompts but none have source URLs, so the user-facing essay count must stay zero or review-only until prompt source approval exists.',
      sourceBackedCount: 0,
      unbackedVerifiedCount:
        input.schoolListEssayCount.unbackedVerifiedCurrentYearPrompts,
      unbackedVerifiedPromptIds:
        input.schoolListEssayCount.unbackedVerifiedPromptRefs.map(
          (prompt) => prompt.essayPromptId,
        ),
      requiredReviewerInputs: essayCountInputs,
      prohibitedActions: essayCountProhibitedActions,
    };
  }

  if (isDeadlineFallbackQueue(input.target.queueType)) {
    const deadlineInputs = [
      'approvedReviewerWorkflowId',
      'confirmedOfficialDeadlineSourceUrlOrTerminalNoPublicSource',
      'confirmedApplicationDeadlineMatchesSource',
      'confirmedApplicationYearAndRound',
      'confirmedUserProvidedDateIfNoOfficialSource',
      'confirmedTimelineConsumersKeepWeakStateUntilWrite',
    ];
    const deadlineProhibitedActions = [
      'do not mutate SchoolDeadline from this packet',
      'do not promote School.metadata.deadlines or default RD fallback into authoritative deadline evidence',
      'do not generate authoritative timeline deadlines or reminders from heuristic fallback rows',
    ];
    if (!input.deadlineFallback) {
      return {
        outcome:
          'deadline_fallback_school_missing_review_required' satisfies RecommendedOutcome,
        nextAction: 'review-missing-school-or-refresh-timeline-source-closure',
        confidence: 'candidate_only',
        reason:
          'The fallback row points to a school that is missing from the current database snapshot.',
        requiredReviewerInputs: deadlineInputs,
        prohibitedActions: deadlineProhibitedActions,
      };
    }
    if (input.deadlineFallback.exactRoundDeadlineCandidate) {
      return {
        outcome:
          'deadline_fallback_refresh_closure_required' satisfies RecommendedOutcome,
        nextAction:
          'refresh-timeline-source-closure-and-review-existing-deadline-provenance',
        confidence: 'candidate_only',
        reason:
          'A current-year SchoolDeadline now exists for the requested round; refresh the closure packet and verify its provenance before treating the fallback as closed.',
        deadlineId: input.deadlineFallback.exactRoundDeadlineCandidate.id,
        requiredReviewerInputs: deadlineInputs,
        prohibitedActions: deadlineProhibitedActions,
      };
    }
    if (
      input.target.queueType === 'heuristic_metadata_fallback' &&
      input.deadlineFallback.metadataDeadline
    ) {
      return {
        outcome:
          'metadata_deadline_requires_source_backed_deadline_candidate' satisfies RecommendedOutcome,
        nextAction:
          'verify-metadata-deadline-against-official-source-or-keep-weak-state',
        confidence: 'candidate_only',
        reason:
          'The school-list row is backed only by School.metadata.deadlines, so reviewer must confirm an official source and create or approve a sourced SchoolDeadline before authoritative timeline use.',
        metadataDeadlineSha256: input.deadlineFallback.metadataDeadlineSha256,
        sourceSearchPlan: input.deadlineFallback.sourceSearchPlan,
        requiredReviewerInputs: deadlineInputs,
        prohibitedActions: deadlineProhibitedActions,
      };
    }
    return {
      outcome:
        'missing_deadline_requires_source_backed_deadline_or_user_date' satisfies RecommendedOutcome,
      nextAction: 'add-source-backed-school-deadline-or-prompt-user-for-date',
      confidence: 'candidate_only',
      reason:
        'No current-year SchoolDeadline or metadata deadline exists for this school-list round, so consumers must use a generic planning placeholder until official source evidence or a user-provided date exists.',
      sourceSearchPlan: input.deadlineFallback.sourceSearchPlan,
      requiredReviewerInputs: deadlineInputs,
      prohibitedActions: deadlineProhibitedActions,
    };
  }

  if (input.target.queueType === 'operator_deadline_review') {
    const deadlineInputs = [
      'approvedReviewerWorkflowId',
      'confirmedOfficialDeadlineSourceUrl',
      'confirmedApplicationDeadlineMatchesSource',
      'confirmedApplicationYearAndRound',
      'confirmedTimelineConsumersKeepReviewLabelUntilWrite',
    ];
    const deadlineProhibitedActions = [
      'do not mutate SchoolDeadline from this packet',
      'do not treat MANUAL deadline rows as source-backed facts without official source evidence',
      'do not generate authoritative deadline reminders from review-only deadline evidence',
    ];
    if (!input.deadline) {
      return {
        outcome:
          'deadline_row_missing_review_required' satisfies RecommendedOutcome,
        nextAction:
          'review-missing-deadline-or-refresh-timeline-source-closure',
        confidence: 'candidate_only',
        reason:
          'The timeline source row points to a SchoolDeadline that no longer exists in the current database snapshot.',
        sourceBackedEssayPromptId: null,
        requiredReviewerInputs: deadlineInputs,
        prohibitedActions: deadlineProhibitedActions,
      };
    }
    if (input.deadline.notesSourceUrl) {
      return {
        outcome:
          'manual_deadline_source_url_review_candidate' satisfies RecommendedOutcome,
        nextAction: 'review-source-url-date-match-or-keep-review-label',
        confidence: 'candidate_only',
        reason:
          'The manual deadline row has a URL-like source candidate in notes, but reviewer must confirm the source family, application year, round, and date before this can become source-backed timeline evidence.',
        deadlineId: input.deadline.id,
        sourceUrl: input.deadline.notesSourceUrl,
        requiredReviewerInputs: deadlineInputs,
        prohibitedActions: deadlineProhibitedActions,
      };
    }
    return {
      outcome:
        'manual_deadline_source_missing_keep_review_only' satisfies RecommendedOutcome,
      nextAction: 'add-official-deadline-source-or-keep-review-label',
      confidence: 'candidate_only',
      reason:
        'The manual deadline row has no URL-like source evidence in notes, so timeline and school-list consumers must keep the deadline review-labeled until official source evidence is added or a terminal/review disposition is recorded.',
      deadlineId: input.deadline.id,
      sourceUrl: null,
      websiteCandidate: input.deadline.schoolWebsite,
      requiredReviewerInputs: deadlineInputs,
      prohibitedActions: deadlineProhibitedActions,
    };
  }

  if (!input.task) {
    return {
      outcome: 'task_missing_review_required' satisfies RecommendedOutcome,
      nextAction: 'review-missing-task-or-refresh-timeline-source-closure',
      confidence: 'candidate_only',
      reason:
        'The timeline source row points to an ApplicationTask that no longer exists in the current database snapshot.',
      sourceBackedEssayPromptId: null,
      requiredReviewerInputs,
      prohibitedActions,
    };
  }

  if (input.exactSourceBackedPromptMatches.length > 0) {
    const match = input.exactSourceBackedPromptMatches[0];
    return {
      outcome:
        'link_existing_task_to_source_backed_prompt_candidate' satisfies RecommendedOutcome,
      nextAction: 'review-link-existing-task-to-source-backed-prompt',
      confidence: 'source_backed_candidate_only',
      reason:
        'The task essayPrompt text exactly matches a source-backed verified current-year EssayPrompt for the same school.',
      sourceBackedEssayPromptId: match.essayPromptId,
      sourceUrls: match.sourceUrls,
      requiredReviewerInputs: [
        ...requiredReviewerInputs,
        'confirmedSourceBackedEssayPromptId',
      ],
      prohibitedActions,
    };
  }

  if (isGenericEssayTask(input.task.title, input.task.essayPrompt)) {
    return {
      outcome: 'mark_generic_essay_task_candidate' satisfies RecommendedOutcome,
      nextAction: 'review-mark-task-generic-or-link-source-backed-prompt',
      confidence: 'candidate_only',
      reason:
        'The task appears to be a generic writing task; reviewer should mark it generic or link it to a source-backed prompt before authoritative school-specific display.',
      sourceBackedEssayPromptId: null,
      requiredReviewerInputs,
      prohibitedActions,
    };
  }

  if (input.sourceBackedPromptCandidates.length > 0) {
    return {
      outcome:
        'link_task_to_source_backed_prompt_or_mark_generic_candidate' satisfies RecommendedOutcome,
      nextAction: 'review-select-source-backed-prompt-or-mark-generic',
      confidence: 'candidate_only',
      reason:
        'The school has source-backed current-year EssayPrompt candidates, but this task has no exact source-backed prompt text link.',
      sourceBackedEssayPromptId: null,
      candidatePromptIds: input.sourceBackedPromptCandidates.map(
        (candidate) => candidate.essayPromptId,
      ),
      requiredReviewerInputs: [
        ...requiredReviewerInputs,
        'confirmedSourceBackedEssayPromptIdOrGenericTask',
      ],
      prohibitedActions,
    };
  }

  return {
    outcome:
      'source_backed_prompt_missing_keep_task_review_only' satisfies RecommendedOutcome,
    nextAction: 'keep-task-source-review-or-regenerate-after-prompt-approval',
    confidence: 'candidate_only',
    reason:
      'No source-backed verified current-year EssayPrompt exists for this school in the current database snapshot, so the task cannot be promoted to authoritative school-specific essay guidance.',
    sourceBackedEssayPromptId: null,
    requiredReviewerInputs,
    prohibitedActions,
  };
}

function isGenericEssayTask(title: string, essayPrompt: string | null) {
  const text = normalize(`${title} ${essayPrompt ?? ''}`);
  return [
    'common app',
    'common application',
    'personal statement',
    'personal essay',
    'generic essay',
  ].some((token) => text.includes(token));
}

function parseTaskId(rowId: string) {
  return rowId.startsWith('essay-task-source:')
    ? rowId.slice('essay-task-source:'.length)
    : null;
}

function parseDeadlineId(sourceEvidence: string[]) {
  const row = sourceEvidence.find((item) =>
    item.startsWith('SchoolDeadline.id='),
  );
  return row ? row.slice('SchoolDeadline.id='.length).trim() : null;
}

function parseSchoolListItemId(rowId: string) {
  return rowId.startsWith('school-list-essay-count:')
    ? rowId.slice('school-list-essay-count:'.length)
    : null;
}

function parseGlobalEventId(rowId: string) {
  return rowId.startsWith('global-event:')
    ? rowId.slice('global-event:'.length)
    : null;
}

function isDeadlineFallbackQueue(queueType: string) {
  return (
    queueType === 'heuristic_default_rd_fallback' ||
    queueType === 'heuristic_metadata_fallback'
  );
}

function getMetadataDeadline(metadata: unknown, round: string | null) {
  if (
    !round ||
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata)
  ) {
    return null;
  }
  const deadlines = (metadata as { deadlines?: unknown }).deadlines;
  if (!deadlines || typeof deadlines !== 'object' || Array.isArray(deadlines)) {
    return null;
  }
  const normalizedRound = normalizeRound(round);
  for (const [key, value] of Object.entries(deadlines)) {
    if (
      normalizeRound(key) === normalizedRound &&
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }
  return null;
}

function buildDeadlineSourceSearchPlan(args: {
  schoolName: string;
  schoolWebsite: string | null;
  applicationYear: number;
  requestedRound: string | null;
}) {
  const round = args.requestedRound ?? 'requested round';
  return {
    preferredSourceFamilies: [
      'official undergraduate admissions deadlines page',
      'official application requirements page',
      'official financial aid deadline page when aid deadlines are involved',
      'Common App college requirements only as secondary confirmation',
    ],
    officialSearchQueries: [
      `${args.schoolName} undergraduate admissions deadlines ${args.applicationYear} ${round}`,
      `${args.schoolName} first-year application deadlines ${args.applicationYear} ${round}`,
      `${args.schoolName} apply deadline ${round} ${args.applicationYear}`,
    ],
    websiteCandidate: args.schoolWebsite,
  };
}

function extractSourceUrl(notes: string | null) {
  if (!notes) return null;
  const match = notes.match(/https?:\/\/[^\s)>\]}"]+/i);
  return match?.[0] ?? null;
}

function normalizeUrl(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function blockedReport(args: Args, reason: string) {
  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-profile-readiness-timeline-source-action',
    status:
      'BLOCKED_TIMELINE_SOURCE_ACTION_INPUTS_MISSING' satisfies PacketStatus,
    destructiveDbWriteAllowedByThisPlan: false,
    notificationSendAllowedByThisPlan: false,
    sourceArtifacts: {
      timelineSourceClosure: args.timelineSourceClosure,
    },
    summary: {
      targetRows: 0,
      blockedRows: 1,
      reason,
    },
    rows: [],
  };
}

function writeAndPrint(args: Args, report: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report));
  fs.writeFileSync(args.csv, renderCsv(report));
  printSummary(args, report);
}

function renderMarkdown(report: Record<string, unknown>) {
  const summary = objectValue(report.summary);
  const target = objectValue(report.target);
  const decision = objectValue(report.recommendedDecision);
  return [
    '# Profile Readiness Timeline Source Action Packet',
    '',
    `- Status: ${report.status ?? 'unknown'}`,
    `- Target: ${target.schoolName ?? 'unknown'} / ${target.id ?? 'unknown'}`,
    `- Recommended outcome: ${decision.outcome ?? summary.recommendedOutcome ?? 'unknown'}`,
    `- Next action: ${decision.nextAction ?? summary.nextAction ?? 'unknown'}`,
    `- Source-backed prompt candidates: ${summary.sourceBackedPromptCandidates ?? 0}`,
    `- Deadline rows: ${summary.deadlineRows ?? 0}`,
    `- Manual deadline rows: ${summary.manualDeadlineRows ?? 0}`,
    `- Deadline source URL candidates: ${summary.deadlineSourceUrlCandidateRows ?? 0}`,
    `- Deadline rows missing source URL: ${summary.deadlineMissingSourceUrlRows ?? 0}`,
    `- Deadline fallback rows: ${summary.deadlineFallbackRows ?? 0}`,
    `- Metadata fallback rows: ${summary.metadataFallbackRows ?? 0}`,
    `- Default deadline fallback rows: ${summary.defaultDeadlineFallbackRows ?? 0}`,
    `- Fallback rows with metadata value: ${summary.deadlineFallbackRowsWithMetadataValue ?? 0}`,
    `- School-list essay count rows: ${summary.schoolListEssayCountRows ?? 0}`,
    `- School-list essay count rows with source-backed prompts: ${summary.schoolListEssayCountRowsWithSourceBacked ?? 0}`,
    `- School-list essay count rows with zero source-backed prompts: ${summary.schoolListEssayCountRowsWithZeroSourceBacked ?? 0}`,
    `- Global event rows: ${summary.globalEventRows ?? 0}`,
    `- Global event rows missing URL: ${summary.globalEventRowsMissingUrl ?? 0}`,
    `- Consumer gate closed: ${summary.consumerGateClosed ?? false}`,
    '',
    'This packet is read-only. It does not mutate timeline tasks, prompts, deadlines, sources, or notification state.',
    '',
  ].join('\n');
}

function renderCsv(report: Record<string, unknown>) {
  const rows = Array.isArray(report.rows)
    ? (report.rows as Record<string, unknown>[])
    : [];
  const headers = [
    'rowId',
    'queueType',
    'schoolName',
    'taskId',
    'deadlineId',
    'fallbackRound',
    'metadataDeadlineSha256',
    'schoolListItemId',
    'verifiedCurrentYearPrompts',
    'sourceBackedVerifiedCurrentYearPrompts',
    'unbackedVerifiedCurrentYearPrompts',
    'globalEventId',
    'globalEventCategory',
    'globalEventTitleSha256',
    'outcome',
    'nextAction',
  ];
  return [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => csvCell(row[header])).join(','),
    ),
  ].join('\n');
}

function printSummary(args: Args, report: Record<string, unknown>) {
  const summary = objectValue(report.summary);
  console.log(`Status: ${report.status ?? 'unknown'}`);
  console.log(`JSON: ${args.out}`);
  console.log(`Markdown: ${args.markdown}`);
  console.log(`CSV: ${args.csv}`);
  console.log(`Target rows: ${summary.targetRows ?? 0}`);
  console.log(
    `Recommended outcome: ${summary.recommendedOutcome ?? 'unknown'}`,
  );
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function findLatest(pattern: RegExp) {
  if (!fs.existsSync(REPORT_ROOT)) return null;
  const matches = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) => pattern.test(file))
    .map((file) => path.join(REPORT_ROOT, file))
    .filter((file) => fs.statSync(file).isFile())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return matches[0] ?? null;
}

function snippet(value: string, max = 220) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > max
    ? `${normalized.slice(0, Math.max(0, max - 1))}...`
    : normalized;
}

function normalize(value: string | null) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRound(value: string | null) {
  return normalize(value).replace(/\s+/g, '').toUpperCase();
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const value of values) {
    const key = keyFor(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function countBy<T>(values: T[], keyFor: (value: T) => string) {
  return values.reduce<Record<string, number>>((acc, value) => {
    const key = keyFor(value) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
