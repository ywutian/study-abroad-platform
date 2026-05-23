#!/usr/bin/env tsx
import 'dotenv/config';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type PacketStatus =
  | 'PROFILE_READINESS_TIMELINE_SOURCE_CLOSURE_READY'
  | 'PROFILE_READINESS_TIMELINE_SOURCE_CLOSURE_REVIEW'
  | 'BLOCKED_PROFILE_READINESS_TIMELINE_SOURCE_CLOSURE';
type RowState = 'trusted' | 'review' | 'blocked';
type Severity = 'critical' | 'warning' | 'info';
type QueueType =
  | 'trusted_deadline_generated'
  | 'needs_round_user_prompt'
  | 'operator_deadline_review'
  | 'heuristic_metadata_fallback'
  | 'heuristic_default_rd_fallback'
  | 'essay_task_source_blocked'
  | 'school_list_essay_count_source_mismatch'
  | 'global_event_trusted_official'
  | 'global_event_source_review'
  | 'personal_event_first_party';

interface Args {
  disposition: string | null;
  consumerClosure: string | null;
  applicationYear: number;
  out: string;
  markdown: string;
  csv: string;
  salt: string | null;
}

interface ArtifactSummary {
  generatedAt?: string;
  status?: string;
  summary?: Record<string, unknown>;
}

interface AuditRow {
  id: string;
  queueType: QueueType;
  rowState: RowState;
  severity: Severity;
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
  details: Record<string, unknown>;
}

interface SourceArtifacts {
  disposition: ReturnType<typeof summarizeInput>;
  consumerClosure: ReturnType<typeof summarizeInput>;
}

const API_ROOT = detectApiRoot();
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const DAY_MS = 24 * 60 * 60 * 1000;
const TIMELINE_APPLICATION_SERVICE_PATH = path.join(
  REPO_ROOT,
  'apps/api/src/modules/timeline/timeline-application.service.ts',
);
const TIMELINE_APPLICATION_SERVICE_TEXT = fs.existsSync(
  TIMELINE_APPLICATION_SERVICE_PATH,
)
  ? fs.readFileSync(TIMELINE_APPLICATION_SERVICE_PATH, 'utf8')
  : '';

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
  const optionalPath = (name: string, pattern: RegExp) => {
    const value = get(name);
    return value ? resolveInputPath(value) : findLatest(pattern);
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(
        REPORT_ROOT,
        `profile-readiness-timeline-source-closure-${stamp}.json`,
      ),
    )!,
  );
  return {
    disposition: optionalPath(
      '--disposition',
      /^profile-readiness-disposition-.+\.json$/,
    ),
    consumerClosure: optionalPath(
      '--consumer-closure',
      /^profile-readiness-consumer-closure-.+\.json$/,
    ),
    applicationYear: Number(
      get('--application-year', `${resolveApplicationYear()}`),
    ),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    salt: get('--salt') ?? null,
  };
}

async function main() {
  const args = parseArgs();
  const disposition = readOptionalJson<ArtifactSummary>(args.disposition);
  const consumerClosure = readOptionalJson<ArtifactSummary>(
    args.consumerClosure,
  );
  const sourceArtifacts: SourceArtifacts = {
    disposition: summarizeInput(args.disposition, disposition),
    consumerClosure: summarizeInput(args.consumerClosure, consumerClosure),
  };
  const salt =
    args.salt ??
    `profile-readiness-timeline-source-closure:${new Date().toISOString()}`;
  const prisma = new PrismaClient();

  try {
    const rows = await buildRows(prisma, args, salt);
    const report = buildReport(args, sourceArtifacts, rows);
    writeReport(args, report);
    printSummary(args, report);
  } catch (error) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-profile-readiness-timeline-source-closure',
      status:
        'BLOCKED_PROFILE_READINESS_TIMELINE_SOURCE_CLOSURE' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      notificationSendAllowedByThisPlan: false,
      applicationYear: args.applicationYear,
      sourceArtifacts,
      error: error instanceof Error ? error.message : String(error),
      summary: emptySummary(),
      nextCampaign: {
        id: 'profile_readiness_timeline_source_closure_unblock',
        reason:
          'Timeline source closure could not query the local database; rerun after DB/schema compatibility is available.',
      },
      rows: [] as AuditRow[],
    };
    writeReport(args, report);
    printSummary(args, report);
  } finally {
    await prisma.$disconnect();
  }
}

async function buildRows(
  prisma: PrismaClient,
  args: Args,
  salt: string,
): Promise<AuditRow[]> {
  const [
    schoolListItems,
    timelines,
    deadlines,
    essayPrompts,
    globalEvents,
    personalEvents,
  ] = await Promise.all([
    prisma.schoolListItem.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        userId: true,
        schoolId: true,
        round: true,
        school: {
          select: {
            name: true,
            metadata: true,
          },
        },
      },
    }),
    prisma.applicationTimeline.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        userId: true,
        schoolId: true,
        schoolName: true,
        round: true,
        deadline: true,
        createdAt: true,
        school: {
          select: {
            name: true,
            metadata: true,
          },
        },
        tasks: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            type: true,
            essayPrompt: true,
            wordLimit: true,
          },
        },
      },
    }),
    prisma.schoolDeadline.findMany({
      where: { year: args.applicationYear },
      orderBy: [{ schoolId: 'asc' }, { applicationDeadline: 'asc' }],
      select: {
        id: true,
        schoolId: true,
        year: true,
        round: true,
        applicationDeadline: true,
        source: true,
        essayCount: true,
        essayPrompts: true,
      },
    }),
    prisma.essayPrompt.findMany({
      where: {
        isActive: true,
        status: 'VERIFIED',
        year: args.applicationYear,
      },
      orderBy: [{ schoolId: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        schoolId: true,
        prompt: true,
        wordLimit: true,
        sources: {
          select: {
            sourceUrl: true,
            sourceType: true,
            confidence: true,
          },
        },
      },
    }),
    prisma.globalEvent.findMany({
      where: {
        isActive: true,
        year: { in: [args.applicationYear - 1, args.applicationYear] },
      },
      orderBy: [{ year: 'desc' }, { eventDate: 'asc' }],
      select: {
        id: true,
        title: true,
        category: true,
        year: true,
        eventDate: true,
        registrationDeadline: true,
        url: true,
      },
    }),
    prisma.personalEvent.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        userId: true,
        globalEventId: true,
        title: true,
        category: true,
        deadline: true,
        eventDate: true,
        url: true,
        globalEvent: {
          select: {
            title: true,
            year: true,
            url: true,
          },
        },
      },
    }),
  ]);

  const deadlineBySchoolRound = new Map<string, (typeof deadlines)[number]>();
  for (const deadline of deadlines) {
    deadlineBySchoolRound.set(
      schoolRoundKey(deadline.schoolId, deadline.round),
      deadline,
    );
  }

  const promptsBySchool = groupBy(essayPrompts, (prompt) => prompt.schoolId);
  const sourceBackedPromptBySchoolPrompt = new Map<
    string,
    (typeof essayPrompts)[number]
  >();
  const verifiedPromptCountBySchool = new Map<string, number>();
  const sourceBackedPromptCountBySchool = new Map<string, number>();
  for (const [schoolId, prompts] of promptsBySchool.entries()) {
    verifiedPromptCountBySchool.set(schoolId, prompts.length);
    const backed = prompts.filter(hasSourceUrl);
    sourceBackedPromptCountBySchool.set(schoolId, backed.length);
    for (const prompt of backed) {
      sourceBackedPromptBySchoolPrompt.set(
        promptKey(schoolId, prompt.prompt),
        prompt,
      );
    }
  }

  const rows: AuditRow[] = [];
  for (const item of schoolListItems) {
    const schoolName = item.school.name;
    const recipientKey = hashId(salt, item.userId);
    if (!item.round) {
      rows.push({
        id: `school-list-round:${item.id}`,
        queueType: 'needs_round_user_prompt',
        rowState: 'review',
        severity: 'critical',
        recipientKey,
        schoolId: item.schoolId,
        schoolName,
        round: null,
        consumerSurface: 'school-list -> timeline generation',
        consumerPolicy:
          'Show weak-state round prompt; do not generate application deadlines until the applicant selects a round or an operator confirms one.',
        requiredAction: 'prompt-user-for-application-round',
        sourceKind: 'first_party_missing',
        sourceEvidence: ['SchoolListItem.round is null'],
        fieldRefs: ['SchoolListItem.round', 'ApplicationTimeline.round'],
        details: { schoolListItemId: item.id },
      });
    } else {
      rows.push(
        buildDeadlineCoverageRow({
          id: `school-list-deadline:${item.id}`,
          recipientKey,
          schoolId: item.schoolId,
          schoolName,
          round: item.round,
          metadata: item.school.metadata,
          deadline: deadlineBySchoolRound.get(
            schoolRoundKey(item.schoolId, item.round),
          ),
          consumerSurface: 'school-list -> generate timelines',
          timelineId: null,
        }),
      );
    }

    const verifiedCount = verifiedPromptCountBySchool.get(item.schoolId) ?? 0;
    const sourceBackedCount =
      sourceBackedPromptCountBySchool.get(item.schoolId) ?? 0;
    if (verifiedCount !== sourceBackedCount) {
      rows.push({
        id: `school-list-essay-count:${item.id}`,
        queueType: 'school_list_essay_count_source_mismatch',
        rowState: 'review',
        severity: 'warning',
        recipientKey,
        schoolId: item.schoolId,
        schoolName,
        round: item.round,
        consumerSurface: 'school-list essayPromptCount',
        consumerPolicy:
          'Count only source-backed verified current-year prompts in user-facing school-list surfaces, or label the count as review-only.',
        requiredAction: 'align-school-list-essay-count-with-source-gate',
        sourceKind: 'verified_without_required_source_gate',
        sourceEvidence: [
          `verifiedCurrentYearPrompts=${verifiedCount}`,
          `sourceBackedVerifiedCurrentYearPrompts=${sourceBackedCount}`,
        ],
        fieldRefs: [
          'EssayPrompt.status',
          'EssayPrompt.year',
          'EssayPromptSource.sourceUrl',
          'SchoolListItemResponseDto.essayPromptCount',
        ],
        details: { schoolListItemId: item.id },
      });
    }
  }

  for (const timeline of timelines) {
    rows.push(
      buildDeadlineCoverageRow({
        id: `timeline-deadline:${timeline.id}`,
        recipientKey: hashId(salt, timeline.userId),
        schoolId: timeline.schoolId,
        schoolName: timeline.schoolName || timeline.school.name,
        round: timeline.round,
        metadata: timeline.school.metadata,
        deadline: deadlineBySchoolRound.get(
          schoolRoundKey(timeline.schoolId, timeline.round),
        ),
        consumerSurface: 'application timeline',
        timelineId: timeline.id,
      }),
    );

    for (const task of timeline.tasks) {
      if (task.type !== 'ESSAY') continue;
      if (isCommonAppEssayTask(task.title, task.essayPrompt)) continue;

      const matchedPrompt = task.essayPrompt
        ? sourceBackedPromptBySchoolPrompt.get(
            promptKey(timeline.schoolId, task.essayPrompt),
          )
        : null;
      if (matchedPrompt) continue;
      const weakStateVisible = timelineTaskSourceWeakStateVisible();

      rows.push({
        id: `essay-task-source:${task.id}`,
        queueType: 'essay_task_source_blocked',
        rowState: weakStateVisible ? 'review' : 'blocked',
        severity: weakStateVisible ? 'warning' : 'critical',
        recipientKey: hashId(salt, timeline.userId),
        schoolId: timeline.schoolId,
        schoolName: timeline.schoolName || timeline.school.name,
        round: timeline.round,
        consumerSurface: 'application timeline essay task',
        consumerPolicy:
          'Hide or label school-specific essay task as source-review until it maps to a source-backed verified current-year EssayPrompt.',
        requiredAction:
          'link-task-to-source-backed-essay-prompt-or-mark-generic',
        sourceKind: 'missing_essay_prompt_source',
        sourceEvidence: [
          `taskTitle=${task.title}`,
          `essayPrompt=${task.essayPrompt ?? 'none'}`,
        ],
        fieldRefs: [
          'ApplicationTask.essayPrompt',
          'EssayPrompt.status',
          'EssayPrompt.year',
          'EssayPromptSource.sourceUrl',
        ],
        details: {
          timelineId: timeline.id,
          taskId: task.id,
          wordLimit: task.wordLimit,
          weakStateVisible,
        },
      });
    }
  }

  for (const event of globalEvents) {
    const hasUrl = Boolean(event.url?.trim());
    rows.push({
      id: `global-event:${event.id}`,
      queueType: hasUrl
        ? 'global_event_trusted_official'
        : 'global_event_source_review',
      rowState: hasUrl ? 'trusted' : 'review',
      severity: hasUrl ? 'info' : 'warning',
      consumerSurface: 'timeline global events',
      consumerPolicy: hasUrl
        ? 'May show as sourced global-event guidance with official URL visible.'
        : 'Show as review-only or suppress official-source claims until url is populated.',
      requiredAction: hasUrl
        ? 'accept'
        : 'add-official-event-url-or-mark-terminal',
      sourceKind: hasUrl ? 'official_url' : 'missing_official_url',
      sourceEvidence: [
        `title=${event.title}`,
        `year=${event.year}`,
        `url=${event.url ?? 'none'}`,
      ],
      fieldRefs: [
        'GlobalEvent.url',
        'GlobalEvent.year',
        'GlobalEvent.isActive',
      ],
      details: {
        category: event.category,
        eventDate: event.eventDate?.toISOString() ?? null,
        registrationDeadline: event.registrationDeadline?.toISOString() ?? null,
      },
    });
  }

  for (const event of personalEvents) {
    const linkedGlobalNeedsSource =
      event.globalEventId && !event.globalEvent?.url?.trim();
    rows.push({
      id: `personal-event:${event.id}`,
      queueType: linkedGlobalNeedsSource
        ? 'global_event_source_review'
        : 'personal_event_first_party',
      rowState: linkedGlobalNeedsSource ? 'review' : 'trusted',
      severity: linkedGlobalNeedsSource ? 'warning' : 'info',
      recipientKey: hashId(salt, event.userId),
      consumerSurface: 'personal timeline events',
      consumerPolicy: linkedGlobalNeedsSource
        ? 'Keep global-event source weak-state visible on subscribed personal event.'
        : 'Treat as first-party personal planning data; no external source claim required.',
      requiredAction: linkedGlobalNeedsSource
        ? 'add-official-url-to-linked-global-event-or-label-review'
        : 'accept',
      sourceKind: event.globalEventId
        ? 'global_event_subscription'
        : 'first_party_user_entered',
      sourceEvidence: [
        `title=${event.title}`,
        `globalEventId=${event.globalEventId ?? 'none'}`,
        `eventUrl=${event.url ?? 'none'}`,
        `globalEventUrl=${event.globalEvent?.url ?? 'none'}`,
      ],
      fieldRefs: [
        'PersonalEvent.globalEventId',
        'PersonalEvent.url',
        'GlobalEvent.url',
      ],
      details: {
        category: event.category,
        linkedGlobalTitle: event.globalEvent?.title ?? null,
        deadline: event.deadline?.toISOString() ?? null,
        eventDate: event.eventDate?.toISOString() ?? null,
      },
    });
  }

  return rows.sort(compareRows);
}

function buildDeadlineCoverageRow(args: {
  id: string;
  recipientKey: string;
  schoolId: string;
  schoolName: string;
  round: string;
  metadata: unknown;
  deadline?: {
    id: string;
    source: string;
    applicationDeadline: Date;
    year: number;
    essayCount: number | null;
    essayPrompts: unknown;
  };
  consumerSurface: string;
  timelineId: string | null;
}): AuditRow {
  const metadataDeadline = getMetadataDeadline(args.metadata, args.round);
  if (args.deadline && args.deadline.source !== 'MANUAL') {
    return {
      id: args.id,
      queueType: 'trusted_deadline_generated',
      rowState: 'trusted',
      severity: 'info',
      recipientKey: args.recipientKey,
      schoolId: args.schoolId,
      schoolName: args.schoolName,
      round: args.round,
      consumerSurface: args.consumerSurface,
      consumerPolicy:
        'May be used for timeline generation with source label and year visible.',
      requiredAction: 'accept',
      sourceKind: `school_deadline_${args.deadline.source.toLowerCase()}`,
      sourceEvidence: [
        `SchoolDeadline.id=${args.deadline.id}`,
        `year=${args.deadline.year}`,
        `source=${args.deadline.source}`,
        `applicationDeadline=${args.deadline.applicationDeadline.toISOString()}`,
      ],
      fieldRefs: [
        'SchoolDeadline.year',
        'SchoolDeadline.round',
        'SchoolDeadline.source',
        'ApplicationTimeline.deadline',
      ],
      details: {
        timelineId: args.timelineId,
        essayCount: args.deadline.essayCount,
        hasStructuredEssayPrompts: Array.isArray(args.deadline.essayPrompts),
      },
    };
  }

  if (args.deadline) {
    return {
      id: args.id,
      queueType: 'operator_deadline_review',
      rowState: 'review',
      severity: 'warning',
      recipientKey: args.recipientKey,
      schoolId: args.schoolId,
      schoolName: args.schoolName,
      round: args.round,
      consumerSurface: args.consumerSurface,
      consumerPolicy:
        'Show with manual/review weak-state; do not treat as authoritative application execution data.',
      requiredAction: 'verify-deadline-source-or-keep-review-label',
      sourceKind: 'manual_school_deadline',
      sourceEvidence: [
        `SchoolDeadline.id=${args.deadline.id}`,
        `year=${args.deadline.year}`,
        `source=${args.deadline.source}`,
        `applicationDeadline=${args.deadline.applicationDeadline.toISOString()}`,
      ],
      fieldRefs: [
        'SchoolDeadline.source',
        'SchoolDeadline.applicationDeadline',
        'ApplicationTimeline.deadline',
      ],
      details: { timelineId: args.timelineId },
    };
  }

  if (metadataDeadline) {
    return {
      id: args.id,
      queueType: 'heuristic_metadata_fallback',
      rowState: 'review',
      severity: 'warning',
      recipientKey: args.recipientKey,
      schoolId: args.schoolId,
      schoolName: args.schoolName,
      round: args.round,
      consumerSurface: args.consumerSurface,
      consumerPolicy:
        'Show as metadata-derived weak-state only; require SchoolDeadline provenance before authoritative use.',
      requiredAction: 'backfill-school-deadline-source-or-label-heuristic',
      sourceKind: 'school_metadata_deadline',
      sourceEvidence: [
        `School.metadata.deadlines.${args.round}=${metadataDeadline}`,
      ],
      fieldRefs: ['School.metadata.deadlines', 'SchoolDeadline.source'],
      details: { timelineId: args.timelineId },
    };
  }

  const generationBlocksUnsourcedDeadline =
    timelineGenerationBlocksUnsourcedDeadline();

  return {
    id: args.id,
    queueType: 'heuristic_default_rd_fallback',
    rowState: generationBlocksUnsourcedDeadline ? 'review' : 'blocked',
    severity: generationBlocksUnsourcedDeadline ? 'warning' : 'critical',
    recipientKey: args.recipientKey,
    schoolId: args.schoolId,
    schoolName: args.schoolName,
    round: args.round,
    consumerSurface: args.consumerSurface,
    consumerPolicy:
      'Do not show as school-specific deadline; use generic planning placeholder until sourced deadline or user-selected date exists.',
    requiredAction: 'backfill-deadline-source-or-prompt-user-for-date',
    sourceKind: 'default_rd_heuristic_or_missing_deadline',
    sourceEvidence: [
      'No current-year SchoolDeadline row',
      'No School.metadata.deadlines fallback for round',
    ],
    fieldRefs: [
      'SchoolDeadline.year',
      'SchoolDeadline.round',
      'School.metadata.deadlines',
      'ApplicationTimeline.deadline',
    ],
    details: {
      timelineId: args.timelineId,
      generationBlocksUnsourcedDeadline,
    },
  };
}

function timelineTaskSourceWeakStateVisible() {
  return (
    TIMELINE_APPLICATION_SERVICE_TEXT.includes('source_review_required') &&
    TIMELINE_APPLICATION_SERVICE_TEXT.includes('sourcePolicy') &&
    TIMELINE_APPLICATION_SERVICE_TEXT.includes('source-backed verified')
  );
}

function timelineGenerationBlocksUnsourcedDeadline() {
  return (
    TIMELINE_APPLICATION_SERVICE_TEXT.includes('DEADLINE_SOURCE_REQUIRED') &&
    !TIMELINE_APPLICATION_SERVICE_TEXT.includes(
      'new Date(applicationYear, 0, 15)',
    ) &&
    !TIMELINE_APPLICATION_SERVICE_TEXT.includes('Jan 15 typical RD')
  );
}

function buildReport(
  args: Args,
  sourceArtifacts: SourceArtifacts,
  rows: AuditRow[],
) {
  const blockedRows = rows.filter((row) => row.rowState === 'blocked');
  const reviewRows = rows.filter((row) => row.rowState === 'review');
  const trustedRows = rows.filter((row) => row.rowState === 'trusted');
  const status: PacketStatus =
    blockedRows.length > 0
      ? 'BLOCKED_PROFILE_READINESS_TIMELINE_SOURCE_CLOSURE'
      : reviewRows.length > 0
        ? 'PROFILE_READINESS_TIMELINE_SOURCE_CLOSURE_REVIEW'
        : 'PROFILE_READINESS_TIMELINE_SOURCE_CLOSURE_READY';

  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-profile-readiness-timeline-source-closure',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    notificationSendAllowedByThisPlan: false,
    applicationYear: args.applicationYear,
    sourceArtifacts,
    summary: {
      ...emptySummary(),
      totalRows: rows.length,
      trustedRows: trustedRows.length,
      reviewRows: reviewRows.length,
      blockedRows: blockedRows.length,
      byQueueType: countBy(rows, (row) => row.queueType),
      byRowState: countBy(rows, (row) => row.rowState),
      byConsumerSurface: countBy(rows, (row) => row.consumerSurface),
      allRowsHaveConsumerPolicy: rows.every((row) =>
        Boolean(row.consumerPolicy.trim()),
      ),
      sourceBackedConsumerRows: rows.filter(
        (row) =>
          row.queueType === 'trusted_deadline_generated' ||
          row.queueType === 'global_event_trusted_official' ||
          row.queueType === 'personal_event_first_party',
      ).length,
    },
    nextCampaign: buildNextCampaign(blockedRows, reviewRows),
    rows,
  };
}

function emptySummary() {
  return {
    totalRows: 0,
    trustedRows: 0,
    reviewRows: 0,
    blockedRows: 0,
    byQueueType: {} as Record<string, number>,
    byRowState: {} as Record<string, number>,
    byConsumerSurface: {} as Record<string, number>,
    allRowsHaveConsumerPolicy: false,
    sourceBackedConsumerRows: 0,
  };
}

function buildNextCampaign(blockedRows: AuditRow[], reviewRows: AuditRow[]) {
  const first = blockedRows[0] ?? reviewRows[0] ?? null;
  if (!first) {
    return {
      id: 'profile_readiness_timeline_source_closure_accept',
      reason:
        'Timeline, school-list, essay-task, global-event, and personal-event source closure is ready.',
    };
  }
  return {
    id: 'profile_readiness_timeline_source_closure',
    reason: `${first.schoolName ?? first.consumerSurface} has the highest-risk ${first.queueType} row requiring ${first.requiredAction}.`,
    firstRowId: first.id,
    queueType: first.queueType,
    rowState: first.rowState,
    schoolId: first.schoolId ?? null,
    schoolName: first.schoolName ?? null,
    requiredAction: first.requiredAction,
  };
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const rows = (report.rows ?? []) as AuditRow[];
  return [
    '# Profile Readiness Timeline Source Closure Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Application year: ${report.applicationYear}`,
    '',
    '## Summary',
    '',
    `- Total rows: ${report.summary.totalRows}`,
    `- Trusted rows: ${report.summary.trustedRows}`,
    `- Review rows: ${report.summary.reviewRows}`,
    `- Blocked rows: ${report.summary.blockedRows}`,
    `- All rows have consumer policy: ${report.summary.allRowsHaveConsumerPolicy}`,
    '',
    '## Next Campaign',
    '',
    `- ${report.nextCampaign?.reason ?? 'none'}`,
    '',
    '## Queue Type Counts',
    '',
    ...Object.entries(report.summary.byQueueType ?? {}).map(
      ([key, value]) => `- ${key}: ${value}`,
    ),
    '',
    '## Highest Risk Rows',
    '',
    '| Row | State | Type | School | Round | Surface | Required action |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows
      .slice(0, 50)
      .map(
        (row) =>
          `| ${escapeMarkdown(row.id)} | ${row.rowState} | ${row.queueType} | ${escapeMarkdown(row.schoolName ?? '')} | ${escapeMarkdown(row.round ?? '')} | ${escapeMarkdown(row.consumerSurface)} | ${escapeMarkdown(row.requiredAction)} |`,
      ),
    '',
  ].join('\n');
}

function renderCsv(rows: AuditRow[]) {
  const header = [
    'id',
    'queueType',
    'rowState',
    'severity',
    'schoolId',
    'schoolName',
    'round',
    'consumerSurface',
    'consumerPolicy',
    'requiredAction',
    'sourceKind',
    'sourceEvidence',
  ];
  const body = rows.map((row) =>
    [
      row.id,
      row.queueType,
      row.rowState,
      row.severity,
      row.schoolId ?? '',
      row.schoolName ?? '',
      row.round ?? '',
      row.consumerSurface,
      row.consumerPolicy,
      row.requiredAction,
      row.sourceKind,
      row.sourceEvidence.join('; '),
    ]
      .map(csvCell)
      .join(','),
  );
  return `${[header.join(','), ...body].join('\n')}\n`;
}

function printSummary(args: Args, report: Record<string, any>) {
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        csv: args.csv,
        totalRows: report.summary.totalRows,
        trustedRows: report.summary.trustedRows,
        reviewRows: report.summary.reviewRows,
        blockedRows: report.summary.blockedRows,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

function getMetadataDeadline(metadata: unknown, round: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const deadlines = (metadata as { deadlines?: unknown }).deadlines;
  if (!deadlines || typeof deadlines !== 'object' || Array.isArray(deadlines)) {
    return null;
  }
  const normalizedRound = round.toUpperCase();
  for (const [key, value] of Object.entries(deadlines)) {
    if (
      key.toUpperCase() === normalizedRound &&
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }
  return null;
}

function hasSourceUrl(prompt: {
  sources: Array<{ sourceUrl: string | null }>;
}) {
  return prompt.sources.some((source) => Boolean(source.sourceUrl?.trim()));
}

function isCommonAppEssayTask(title: string, prompt: string | null) {
  const text = `${title} ${prompt ?? ''}`.toLowerCase();
  return text.includes('common app') || text.includes('personal statement');
}

function schoolRoundKey(schoolId: string, round: string | null) {
  return `${schoolId}:${(round ?? '').toUpperCase()}`;
}

function promptKey(schoolId: string, prompt: string) {
  return `${schoolId}:${normalizePrompt(prompt)}`;
}

function normalizePrompt(prompt: string) {
  return prompt.toLowerCase().replace(/\s+/g, ' ').trim();
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function compareRows(a: AuditRow, b: AuditRow) {
  const stateScore: Record<RowState, number> = {
    blocked: 3,
    review: 2,
    trusted: 1,
  };
  const severityScore: Record<Severity, number> = {
    critical: 3,
    warning: 2,
    info: 1,
  };
  return (
    stateScore[b.rowState] - stateScore[a.rowState] ||
    severityScore[b.severity] - severityScore[a.severity] ||
    a.queueType.localeCompare(b.queueType) ||
    (a.schoolName ?? '').localeCompare(b.schoolName ?? '') ||
    a.id.localeCompare(b.id)
  );
}

function hashId(salt: string, value: string) {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${value}`)
    .digest('hex')
    .slice(0, 16);
}

function summarizeInput(
  filePath: string | null,
  report: Record<string, any> | null,
) {
  return {
    path: filePath ? path.relative(API_ROOT, filePath) : null,
    found: Boolean(report),
    generatedAt: report?.generatedAt ?? null,
    status: report?.status ?? null,
    summary: report?.summary ?? null,
  };
}

function resolveInputPath(value: string) {
  if (path.isAbsolute(value)) return value;
  const candidates = [
    path.resolve(process.cwd(), value),
    path.resolve(API_ROOT, value),
    path.resolve(REPO_ROOT, value),
  ];
  return (
    candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[1]
  );
}

function findLatest(pattern: RegExp) {
  const roots = [REPORT_ROOT, '/tmp'];
  const matches = roots.flatMap((root) => {
    if (!fs.existsSync(root)) return [];
    return fs
      .readdirSync(root)
      .filter((file) => pattern.test(file))
      .map((file) => {
        const full = path.join(root, file);
        return { file: full, mtimeMs: fs.statSync(full).mtimeMs };
      });
  });
  const latest = matches.sort(
    (a, b) => b.mtimeMs - a.mtimeMs || b.file.localeCompare(a.file),
  )[0];
  return latest?.file ?? null;
}

function readOptionalJson<T>(filePath: string | null) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeMarkdown(value: string) {
  return String(value ?? '').replace(/\|/g, '\\|');
}

main();
