#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

type PacketStatus =
  | 'ESSAY_PROMPT_REVIEW_ACTION_READY'
  | 'BLOCKED_REVIEW_ACTION_INPUTS_MISSING'
  | 'PASS_NO_REVIEW_QUEUE_ROWS';

type EvidenceStatus =
  | 'matched_school_official_prompt_match'
  | 'assigned_school_official_prompt_match'
  | 'cross_school_official_prompt_match'
  | 'matched_school_official_text_match_without_prompt_context'
  | 'assigned_school_official_text_match_without_prompt_context'
  | 'cross_school_official_text_match_without_prompt_context'
  | 'official_context_no_prompt_match'
  | 'untrusted_context_no_match'
  | 'blocked_or_fetch_failed'
  | 'non_html';

interface Args {
  reviewQueue: string | null;
  sourceRecovery: string | null;
  queueId: string | null;
  essayPromptId: string | null;
  queueIds: string[];
  essayPromptIds: string[];
  queueTypes: string[];
  candidateUrls: string[];
  limit: number;
  offset: number;
  perQueueTypeLimit: number | null;
  out: string;
  markdown: string;
  csv: string;
  timeoutMs: number;
  maxBytes: number;
}

interface ReviewQueueReport {
  generatedAt?: string;
  status?: string;
  nextCampaign?: Record<string, unknown>;
  rows?: ReviewQueueRow[];
}

interface ReviewQueueRow {
  queueId: string;
  queueType: string;
  queueState: string;
  releaseRiskScore: number;
  schoolId: string | null;
  schoolName: string | null;
  essayPromptId: string | null;
  applicationYear: number | null;
  severity: string;
  route: string | null;
  promptSnippet: string | null;
  sourceUrl: string | null;
  sourceQuality: string | null;
  evidenceSnippet: string | null;
  recommendedAction: string;
  primaryBlocker: string;
  consumerPolicy: Record<string, unknown>;
  requiredReviewerChecks: string[];
  prohibitedActions: string[];
  allowedOutcomes: string[];
  evidence: Record<string, unknown>;
}

interface SourceRecoveryReport {
  generatedAt?: string;
  status?: string;
  rows?: SourceRecoveryRow[];
}

interface SourceRecoveryRow {
  schoolId?: string | null;
  schoolName?: string | null;
  candidateSources?: SourceRecoveryCandidate[];
}

interface SourceRecoveryCandidate {
  sourceUrl?: string | null;
  sourceQuality?: string | null;
  priority?: number | null;
  reviewAction?: string | null;
}

interface CheckedSource {
  targetQueueId?: string;
  targetQueueType?: string;
  targetEssayPromptId?: string | null;
  targetSchoolId?: string | null;
  targetSchoolName?: string | null;
  targetMatchedSchoolId?: string | null;
  targetMatchedSchoolName?: string | null;
  sourceUrl: string;
  fetchStatus:
    | 'reachable_html'
    | 'reachable_text'
    | 'non_html'
    | 'blocked_or_fetch_failed';
  httpStatus: number | null;
  finalUrl: string | null;
  contentType: string | null;
  bytesRead: number;
  rawContentSha256: string | null;
  textContentSha256: string | null;
  sourceQuality: 'official' | 'official_application_platform' | 'unknown';
  ownerRelation:
    'assigned_school' | 'matched_school' | 'cross_school' | 'unknown';
  promptMatch: boolean;
  promptMatchKind: 'normalized_exact' | 'long_prefix_with_context' | null;
  promptLanguageSignals: string[];
  cycleSignals: string[];
  evidenceStatus: EvidenceStatus;
  recommendedAction:
    | 'use-as-reviewer-source-candidate'
    | 'review-text-match-without-prompt-context'
    | 'review-cross-school-owner-before-reassignment'
    | 'keep-as-context-no-match-evidence'
    | 'retry-or-find-alternate-source'
    | 'manual-inspect';
  evidenceSnippet: string | null;
  error: string | null;
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const APPROVAL_ACK = 'APPROVED_ESSAY_PROMPT_IDENTITY_SOURCE_REVIEW';
const APPROVAL_ACKS_BY_QUEUE_TYPE: Record<string, string> = {
  identity_conflict_review: APPROVAL_ACK,
  source_family_mismatch_review:
    'APPROVED_ESSAY_PROMPT_SOURCE_FAMILY_MISMATCH_REVIEW',
  validated_source_review: 'APPROVED_ESSAY_PROMPT_VALIDATED_SOURCE_REVIEW',
  validated_source_blocked: 'APPROVED_ESSAY_PROMPT_STAGING_BLOCKER_REVIEW',
};

function detectApiRoot() {
  if (path.basename(process.cwd()) === 'api') return process.cwd();
  const candidate = path.join(process.cwd(), 'apps', 'api');
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  return process.cwd();
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
      path.join(REPORT_ROOT, `essay-prompt-review-action-${stamp}.json`),
    )!,
  );
  return {
    reviewQueue:
      resolveArgPath(get('--review-queue')) ??
      findLatest(/^essay-prompt-review-queue-.+\.json$/),
    sourceRecovery: resolveArgPath(get('--source-recovery')),
    queueId: get('--queue-id') ?? null,
    essayPromptId: get('--essay-prompt-id') ?? null,
    queueIds: values('--queue-id'),
    essayPromptIds: values('--essay-prompt-id'),
    queueTypes: values('--queue-type'),
    candidateUrls: values('--candidate-url'),
    limit: Math.max(1, Number(get('--limit', '1'))),
    offset: nonNegativeNumberArg(get('--offset', '0')),
    perQueueTypeLimit: numberArg(get('--per-queue-type-limit')),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    timeoutMs: Number(get('--timeout-ms', '15000')),
    maxBytes: Number(get('--max-bytes', '750000')),
  };
}

function resolveArgPath(value: string | undefined) {
  return value ? path.resolve(API_ROOT, value) : null;
}

async function main() {
  const args = parseArgs();
  if (!args.reviewQueue || !fs.existsSync(args.reviewQueue)) {
    writeAndPrint(args, blockedReport(args, 'review queue report is missing'));
    process.exitCode = 1;
    return;
  }

  const reviewQueue = readJson<ReviewQueueReport>(args.reviewQueue);
  const sourceRecovery =
    args.sourceRecovery && fs.existsSync(args.sourceRecovery)
      ? readJson<SourceRecoveryReport>(args.sourceRecovery)
      : null;
  const rows = reviewQueue.rows ?? [];
  if (rows.length === 0) {
    writeAndPrint(args, {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-essay-prompt-review-action',
      status: 'PASS_NO_REVIEW_QUEUE_ROWS' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      notificationAllowedByThisPlan: false,
      summary: { reviewQueueRows: 0, checkedSources: 0 },
      rows: [],
    });
    return;
  }

  const targets = chooseTargetRows(rows, args);
  if (targets.length === 0) {
    writeAndPrint(
      args,
      blockedReport(
        args,
        'target queue rows were not found by --queue-id, --essay-prompt-id, or nextCampaign',
      ),
    );
    process.exitCode = 1;
    return;
  }

  const actions = await Promise.all(
    targets.map((target) => buildAction(target, rows, args, sourceRecovery)),
  );
  const checkedSources = actions.flatMap((action) => action.checkedSources);
  const rowsOut = actions.map((action) => {
    const sourceSummary = summarizeCheckedSources(action.checkedSources);
    return {
      queueId: action.target.queueId,
      queueType: action.target.queueType,
      releaseRiskScore: action.target.releaseRiskScore,
      essayPromptId: action.target.essayPromptId,
      schoolId: action.target.schoolId,
      schoolName: action.target.schoolName,
      matchedSchoolId: action.target.matchedSchoolId,
      matchedSchoolName: action.target.matchedSchoolName,
      promptSnippet: action.target.promptSnippet,
      candidateUrlCount: action.candidateUrls.length,
      sourceRecoveryCandidateUrlCount:
        action.sourceRecoveryCandidateUrls.length,
      sourcePlanningGap: action.candidateUrls.length === 0,
      recommendedOutcome: action.recommendedDecision.outcome,
      nextAction: action.recommendedDecision.nextAction,
      ...sourceSummary,
      sourceEvidenceStatuses: unique(
        action.checkedSources.map((source) => source.evidenceStatus),
      ),
      requiredReviewerInputs: action.recommendedDecision.requiredReviewerInputs,
      prohibitedActions: action.recommendedDecision.prohibitedActions,
    };
  });
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-review-action',
    status: 'ESSAY_PROMPT_REVIEW_ACTION_READY' satisfies PacketStatus,
    destructiveDbWriteAllowedByThisPlan: false,
    notificationAllowedByThisPlan: false,
    sourceArtifacts: {
      reviewQueue: path.relative(API_ROOT, args.reviewQueue),
      reviewQueueGeneratedAt: reviewQueue.generatedAt ?? null,
      reviewQueueStatus: reviewQueue.status ?? null,
      sourceRecovery: args.sourceRecovery
        ? path.relative(API_ROOT, args.sourceRecovery)
        : null,
      sourceRecoveryGeneratedAt: sourceRecovery?.generatedAt ?? null,
      sourceRecoveryStatus: sourceRecovery?.status ?? null,
    },
    reviewContract: {
      noDbWrites: true,
      noPromptReassignment: true,
      noSourceApproval: true,
      noPublicConsumerExposure: true,
      approvalAcksByQueueType: Object.fromEntries(
        unique(actions.map((action) => action.target.queueType))
          .filter(Boolean)
          .map((queueType) => [queueType, approvalAckFor(queueType)]),
      ),
      approvalRequires: [
        'approved reviewer workflow id',
        'exact reviewer acknowledgement matching the queue type',
        'official source family confirmation',
        'cycle-year confirmation',
        'raw source snapshot/hash review',
        'prompt owner confirmation',
        'consumer gate verification after write workflow',
      ],
    },
    target: actions[0]?.target ?? null,
    summary: {
      targetRows: actions.length,
      selectionOffset: args.offset,
      selectionLimit: args.limit,
      perQueueTypeLimit: args.perQueueTypeLimit,
      checkedSources: checkedSources.length,
      candidateUrls: actions.reduce(
        (sum, action) => sum + action.candidateUrls.length,
        0,
      ),
      sourceRecoveryCandidateUrls: actions.reduce(
        (sum, action) => sum + action.sourceRecoveryCandidateUrls.length,
        0,
      ),
      targetsWithSourceRecoveryCandidates: actions.filter(
        (action) => action.sourceRecoveryCandidateUrls.length > 0,
      ).length,
      targetsWithoutCandidateUrls: actions.filter(
        (action) => action.candidateUrls.length === 0,
      ).length,
      reachableSources: checkedSources.filter((row) =>
        row.fetchStatus.startsWith('reachable'),
      ).length,
      officialPromptMatches: checkedSources.filter(
        (row) =>
          row.promptMatch &&
          row.promptLanguageSignals.length > 0 &&
          ['official', 'official_application_platform'].includes(
            row.sourceQuality,
          ),
      ).length,
      matchedSchoolOfficialPromptMatches: checkedSources.filter(
        (row) =>
          row.promptMatch &&
          row.promptLanguageSignals.length > 0 &&
          row.ownerRelation === 'matched_school' &&
          ['official', 'official_application_platform'].includes(
            row.sourceQuality,
          ),
      ).length,
      assignedSchoolOfficialPromptMatches: checkedSources.filter(
        (row) =>
          row.promptMatch &&
          row.promptLanguageSignals.length > 0 &&
          row.ownerRelation === 'assigned_school' &&
          ['official', 'official_application_platform'].includes(
            row.sourceQuality,
          ),
      ).length,
      crossSchoolOfficialPromptMatches: checkedSources.filter(
        isCrossSchoolOfficialPromptMatch,
      ).length,
      officialContextNoMatchSources: checkedSources.filter(
        (row) => row.evidenceStatus === 'official_context_no_prompt_match',
      ).length,
      targetsWithCheckedSources: actions.filter(
        (action) => action.checkedSources.length > 0,
      ).length,
      targetsWithoutCheckedSources: actions.filter(
        (action) => action.checkedSources.length === 0,
      ).length,
      targetsWithOfficialPromptMatches: actions.filter((action) =>
        action.checkedSources.some(isOfficialPromptMatch),
      ).length,
      targetsWithMatchedSchoolOfficialPromptMatches: actions.filter((action) =>
        action.checkedSources.some(isMatchedSchoolOfficialPromptMatch),
      ).length,
      targetsWithAssignedSchoolOfficialPromptMatches: actions.filter((action) =>
        action.checkedSources.some(isAssignedSchoolOfficialPromptMatch),
      ).length,
      targetsWithCrossSchoolOfficialPromptMatches: actions.filter((action) =>
        action.checkedSources.some(isCrossSchoolOfficialPromptMatch),
      ).length,
      checkedSourceTargetLinks: unique(
        checkedSources.map((row) => row.targetQueueId).filter(isString),
      ).length,
      allCheckedSourcesLinkedToTargets: checkedSources.every(
        (row) =>
          Boolean(row.targetQueueId) &&
          Boolean(row.targetEssayPromptId) &&
          Boolean(row.targetSchoolName),
      ),
      blockedSources: checkedSources.filter(
        (row) => row.fetchStatus === 'blocked_or_fetch_failed',
      ).length,
      textMatchesWithoutPromptContext: checkedSources.filter((row) =>
        row.evidenceStatus.endsWith(
          '_official_text_match_without_prompt_context',
        ),
      ).length,
      matchedSchoolTextMatchesWithoutPromptContext: checkedSources.filter(
        (row) =>
          row.ownerRelation === 'matched_school' &&
          row.evidenceStatus.endsWith(
            '_official_text_match_without_prompt_context',
          ),
      ).length,
      consumerGateClosed: false,
      recommendedOutcome: actions[0]?.recommendedDecision.outcome ?? null,
      nextAction: actions[0]?.recommendedDecision.nextAction ?? null,
      byRecommendedOutcome: countBy(
        actions,
        (action) =>
          stringValue(action.recommendedDecision.outcome) ?? 'unknown',
      ),
      byQueueType: countBy(
        actions,
        (action) => stringValue(action.target.queueType) ?? 'unknown',
      ),
      reviewerApprovalReady: false,
    },
    recommendedDecision: actions[0]?.recommendedDecision ?? null,
    actions,
    consumerPolicy: {
      publicEssayPrompts: 'hide_until_reviewer_approval_and_source_row_write',
      timelineTasks: 'hide_until_reviewer_approval_and_source_row_write',
      chatContext: 'do_not_use_until_reviewer_approval_and_source_row_write',
      applicationAnalysis:
        'do_not_use_until_reviewer_approval_and_source_row_write',
      prediction: 'do_not_use_as_school_fact',
    },
    checkedSources,
    rows: rowsOut,
  };

  writeAndPrint(args, report);
}

async function buildAction(
  target: ReviewQueueRow,
  allRows: ReviewQueueRow[],
  args: Args,
  sourceRecovery: SourceRecoveryReport | null,
) {
  const relatedRows = allRows.filter(
    (row) => row.essayPromptId && row.essayPromptId === target.essayPromptId,
  );
  const sourceRecoveryCandidateUrls = candidateUrlsFromSourceRecovery(
    target,
    sourceRecovery,
  );
  const candidateUrls = unique([
    ...args.candidateUrls,
    ...relatedRows.flatMap(candidateUrlsFromRow),
    ...sourceRecoveryCandidateUrls,
  ]);
  const checkedSources =
    candidateUrls.length > 0
      ? await Promise.all(
          candidateUrls.map((url) => checkSource(url, target, args)),
        )
      : [];
  const recommendedDecision = buildRecommendedDecision(target, checkedSources);
  return {
    target: summarizeTarget(target),
    candidateUrls,
    sourceRecoveryCandidateUrls,
    checkedSources: checkedSources.map((source) => ({
      ...source,
      targetQueueId: target.queueId,
      targetQueueType: target.queueType,
      targetEssayPromptId: target.essayPromptId,
      targetSchoolId: target.schoolId,
      targetSchoolName: target.schoolName,
      targetMatchedSchoolId: stringValue(target.evidence?.matchedSchoolId),
      targetMatchedSchoolName: stringValue(target.evidence?.matchedSchoolName),
    })),
    recommendedDecision,
  };
}

function summarizeCheckedSources(sources: CheckedSource[]) {
  return {
    checkedSourceCount: sources.length,
    reachableSourceCount: sources.filter((row) =>
      row.fetchStatus.startsWith('reachable'),
    ).length,
    officialPromptMatchCount: sources.filter(isOfficialPromptMatch).length,
    matchedSchoolOfficialPromptMatchCount: sources.filter(
      isMatchedSchoolOfficialPromptMatch,
    ).length,
    assignedSchoolOfficialPromptMatchCount: sources.filter(
      isAssignedSchoolOfficialPromptMatch,
    ).length,
    crossSchoolOfficialPromptMatchCount: sources.filter(
      isCrossSchoolOfficialPromptMatch,
    ).length,
    officialContextNoMatchCount: sources.filter(
      (row) => row.evidenceStatus === 'official_context_no_prompt_match',
    ).length,
    blockedSourceCount: sources.filter(
      (row) => row.fetchStatus === 'blocked_or_fetch_failed',
    ).length,
  };
}

function isOfficialPromptMatch(row: CheckedSource) {
  return (
    row.promptMatch &&
    row.promptLanguageSignals.length > 0 &&
    ['official', 'official_application_platform'].includes(row.sourceQuality)
  );
}

function isMatchedSchoolOfficialPromptMatch(row: CheckedSource) {
  return isOfficialPromptMatch(row) && row.ownerRelation === 'matched_school';
}

function isAssignedSchoolOfficialPromptMatch(row: CheckedSource) {
  return isOfficialPromptMatch(row) && row.ownerRelation === 'assigned_school';
}

function isCrossSchoolOfficialPromptMatch(row: CheckedSource) {
  return (
    isOfficialPromptMatch(row) &&
    row.ownerRelation !== 'assigned_school' &&
    row.ownerRelation !== 'matched_school'
  );
}

function summarizeTarget(target: ReviewQueueRow) {
  return {
    queueId: target.queueId,
    queueType: target.queueType,
    queueState: target.queueState,
    releaseRiskScore: target.releaseRiskScore,
    schoolId: target.schoolId,
    schoolName: target.schoolName,
    essayPromptId: target.essayPromptId,
    applicationYear: target.applicationYear,
    route: target.route,
    promptSnippet: target.promptSnippet,
    recommendedAction: target.recommendedAction,
    primaryBlocker: target.primaryBlocker,
    matchedSchoolId: stringValue(target.evidence?.matchedSchoolId),
    matchedSchoolName: stringValue(target.evidence?.matchedSchoolName),
    schoolIdentityRelation: stringValue(
      target.evidence?.schoolIdentityRelation,
    ),
    correctionCandidate: target.evidence?.correctionCandidate ?? null,
  };
}

function chooseTargetRows(rows: ReviewQueueRow[], args: Args) {
  const selected: ReviewQueueRow[] = [];
  const queueIds = unique([
    ...args.queueIds,
    ...(args.queueId ? [args.queueId] : []),
  ]);
  const essayPromptIds = unique([
    ...args.essayPromptIds,
    ...(args.essayPromptId ? [args.essayPromptId] : []),
  ]);
  for (const queueId of queueIds) {
    const row = rows.find((candidate) => candidate.queueId === queueId);
    if (row) selected.push(row);
  }
  for (const essayPromptId of essayPromptIds) {
    const row = rows.find(
      (candidate) => candidate.essayPromptId === essayPromptId,
    );
    if (row) selected.push(row);
  }
  if (selected.length === 0 && args.queueTypes.length > 0) {
    if (args.perQueueTypeLimit) {
      for (const queueType of args.queueTypes) {
        selected.push(
          ...rows
            .filter((candidate) => candidate.queueType === queueType)
            .sort(compareRows)
            .slice(args.offset, args.offset + args.perQueueTypeLimit),
        );
      }
    } else {
      selected.push(
        ...rows
          .filter((candidate) => args.queueTypes.includes(candidate.queueType))
          .sort(compareRows)
          .slice(args.offset, args.offset + args.limit),
      );
    }
  }
  if (selected.length === 0) selected.push(rows.slice().sort(compareRows)[0]);
  return uniqueBy(selected.filter(Boolean), (row) => row.queueId);
}

function compareRows(a: ReviewQueueRow, b: ReviewQueueRow) {
  if ((b.releaseRiskScore ?? 0) !== (a.releaseRiskScore ?? 0)) {
    return (b.releaseRiskScore ?? 0) - (a.releaseRiskScore ?? 0);
  }
  return (a.schoolName ?? '').localeCompare(b.schoolName ?? '');
}

function candidateUrlsFromRow(row: ReviewQueueRow) {
  const evidence = row.evidence ?? {};
  return [
    row.sourceUrl,
    ...stringList(evidence.checkedUrls),
    ...stringList(evidence.finalUrls),
    ...stringList(evidence.crossSchoolPromptMatchSourceUrls),
    ...stringList(evidence.trustedValidatedSourceUrls),
    ...stringList(evidence.untrustedValidatedSourceUrls),
  ].filter((url): url is string => Boolean(url));
}

function candidateUrlsFromSourceRecovery(
  target: ReviewQueueRow,
  sourceRecovery: SourceRecoveryReport | null,
) {
  if (!sourceRecovery?.rows?.length) return [];
  const targetSchoolIds = new Set(
    [target.schoolId, stringValue(target.evidence?.matchedSchoolId)].filter(
      isString,
    ),
  );
  const targetSchoolNames = new Set(
    [
      normalizeText(target.schoolName ?? ''),
      normalizeText(stringValue(target.evidence?.matchedSchoolName) ?? ''),
    ].filter(Boolean),
  );
  return sourceRecovery.rows
    .filter((row) => {
      const rowId = stringValue(row.schoolId);
      const rowName = normalizeText(row.schoolName ?? '');
      return (
        (rowId !== null && targetSchoolIds.has(rowId)) ||
        (rowName.length > 0 && targetSchoolNames.has(rowName))
      );
    })
    .flatMap((row) =>
      (row.candidateSources ?? [])
        .slice()
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
        .map((source) => stringValue(source.sourceUrl))
        .filter(
          (url): url is string => typeof url === 'string' && isHttpUrl(url),
        ),
    );
}

async function checkSource(
  sourceUrl: string,
  target: ReviewQueueRow,
  args: Args,
): Promise<CheckedSource> {
  const base = baseSource(sourceUrl, target);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 platform-data-closure-audit/1.0 (+read-only)',
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5',
      },
    });
    clearTimeout(timeout);
    const contentType = response.headers.get('content-type');
    const arrayBuffer = await response.arrayBuffer();
    const raw = Buffer.from(arrayBuffer).subarray(0, args.maxBytes);
    const finalUrl = response.url || sourceUrl;
    const isHtmlOrText =
      !contentType ||
      contentType.includes('html') ||
      contentType.includes('text') ||
      contentType.includes('xml');
    if (!isHtmlOrText) {
      return {
        ...base,
        fetchStatus: 'non_html',
        httpStatus: response.status,
        finalUrl,
        contentType,
        bytesRead: raw.length,
        rawContentSha256: sha256(raw),
        textContentSha256: null,
        evidenceStatus: 'non_html',
        recommendedAction: 'manual-inspect',
        error: null,
      };
    }

    const html = raw.toString('utf8');
    const text = visibleText(html);
    const promptMatch = matchPrompt(target.promptSnippet, text);
    const promptLanguageSignals = detectPromptLanguageSignals(text);
    const cycleSignals = detectCycleSignals(text);
    const ownerRelation = ownerRelationFor(
      finalUrl,
      text,
      target.schoolName,
      stringValue(target.evidence?.matchedSchoolName),
    );
    const sourceQuality = sourceQualityFor(finalUrl);
    const evidenceStatus = evidenceStatusFor({
      promptMatch,
      ownerRelation,
      sourceQuality,
      promptLanguageSignals,
    });
    return {
      ...base,
      fetchStatus: contentType?.includes('html')
        ? 'reachable_html'
        : 'reachable_text',
      httpStatus: response.status,
      finalUrl,
      contentType,
      bytesRead: raw.length,
      rawContentSha256: sha256(raw),
      textContentSha256: sha256(Buffer.from(text)),
      sourceQuality,
      ownerRelation,
      promptMatch: Boolean(promptMatch),
      promptMatchKind: promptMatch?.kind ?? null,
      promptLanguageSignals,
      cycleSignals,
      evidenceStatus,
      recommendedAction: recommendedActionFor(evidenceStatus),
      evidenceSnippet: promptMatch?.snippet ?? null,
      error: null,
    };
  } catch (error) {
    return {
      ...base,
      fetchStatus: 'blocked_or_fetch_failed',
      httpStatus: null,
      finalUrl: null,
      contentType: null,
      bytesRead: 0,
      rawContentSha256: null,
      textContentSha256: null,
      evidenceStatus: 'blocked_or_fetch_failed',
      recommendedAction: 'retry-or-find-alternate-source',
      evidenceSnippet: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function baseSource(sourceUrl: string, target: ReviewQueueRow): CheckedSource {
  const ownerRelation = ownerRelationFor(
    sourceUrl,
    '',
    target.schoolName,
    stringValue(target.evidence?.matchedSchoolName),
  );
  return {
    sourceUrl,
    fetchStatus: 'blocked_or_fetch_failed',
    httpStatus: null,
    finalUrl: null,
    contentType: null,
    bytesRead: 0,
    rawContentSha256: null,
    textContentSha256: null,
    sourceQuality: sourceQualityFor(sourceUrl),
    ownerRelation,
    promptMatch: false,
    promptMatchKind: null,
    promptLanguageSignals: [],
    cycleSignals: [],
    evidenceStatus: 'blocked_or_fetch_failed',
    recommendedAction: 'retry-or-find-alternate-source',
    evidenceSnippet: null,
    error: null,
  };
}

function sourceQualityFor(sourceUrl: string) {
  const host = hostname(sourceUrl);
  if (host.endsWith('.edu')) return 'official' as const;
  if (host === 'commonapp.org' || host.endsWith('.commonapp.org')) {
    return 'official_application_platform' as const;
  }
  if (host === 'questbridge.org' || host.endsWith('.questbridge.org')) {
    return 'official_application_platform' as const;
  }
  return 'unknown' as const;
}

function ownerRelationFor(
  sourceUrl: string,
  text: string,
  assignedSchool: string | null,
  matchedSchool: string | null,
): CheckedSource['ownerRelation'] {
  const host = hostname(sourceUrl);
  const haystack = normalizeText(`${host} ${text.slice(0, 4000)}`);
  const assignedTokens = schoolTokens(assignedSchool);
  const matchedTokens = schoolTokens(matchedSchool);
  const assigned = assignedTokens.some((token) => haystack.includes(token));
  const matched = matchedTokens.some((token) => haystack.includes(token));
  if (assigned && !matched) return 'assigned_school';
  if (matched && !assigned) return 'matched_school';
  if (matched && assigned) return 'cross_school';
  return 'unknown';
}

function schoolTokens(schoolName: string | null) {
  const normalized = normalizeText(schoolName ?? '');
  const tokens = [normalized];
  if (normalized.includes('university of pennsylvania')) {
    tokens.push('upenn', 'penn admissions');
  }
  if (
    normalized.includes('pennsylvania state university') ||
    normalized.includes('penn state university')
  ) {
    tokens.push('penn state', 'psu');
  }
  if (normalized.includes('washington university in st louis')) {
    tokens.push('washu', 'wustl');
  }
  if (normalized.includes('william mary')) {
    tokens.push('william mary');
  }
  if (normalized.includes('california institute of technology')) {
    tokens.push('caltech');
  }
  return unique(tokens.filter((token) => token.length >= 3));
}

function evidenceStatusFor(input: {
  promptMatch: ReturnType<typeof matchPrompt>;
  ownerRelation: CheckedSource['ownerRelation'];
  sourceQuality: CheckedSource['sourceQuality'];
  promptLanguageSignals: string[];
}): EvidenceStatus {
  const trusted =
    input.sourceQuality === 'official' ||
    input.sourceQuality === 'official_application_platform';
  if (input.promptMatch && trusted) {
    if (input.promptLanguageSignals.length === 0) {
      if (input.ownerRelation === 'matched_school') {
        return 'matched_school_official_text_match_without_prompt_context';
      }
      if (input.ownerRelation === 'assigned_school') {
        return 'assigned_school_official_text_match_without_prompt_context';
      }
      return 'cross_school_official_text_match_without_prompt_context';
    }
    if (input.ownerRelation === 'matched_school') {
      return 'matched_school_official_prompt_match';
    }
    if (input.ownerRelation === 'assigned_school') {
      return 'assigned_school_official_prompt_match';
    }
    return 'cross_school_official_prompt_match';
  }
  if (trusted && input.promptLanguageSignals.length > 0) {
    return 'official_context_no_prompt_match';
  }
  return 'untrusted_context_no_match';
}

function recommendedActionFor(status: EvidenceStatus) {
  switch (status) {
    case 'matched_school_official_prompt_match':
    case 'assigned_school_official_prompt_match':
      return 'use-as-reviewer-source-candidate' as const;
    case 'cross_school_official_prompt_match':
      return 'review-cross-school-owner-before-reassignment' as const;
    case 'matched_school_official_text_match_without_prompt_context':
    case 'assigned_school_official_text_match_without_prompt_context':
    case 'cross_school_official_text_match_without_prompt_context':
      return 'review-text-match-without-prompt-context' as const;
    case 'official_context_no_prompt_match':
    case 'untrusted_context_no_match':
      return 'keep-as-context-no-match-evidence' as const;
    case 'non_html':
      return 'manual-inspect' as const;
    case 'blocked_or_fetch_failed':
      return 'retry-or-find-alternate-source' as const;
  }
}

function buildRecommendedDecision(
  target: ReviewQueueRow,
  checkedSources: CheckedSource[],
) {
  const matchedOfficial = checkedSources.filter(
    (row) =>
      row.evidenceStatus === 'matched_school_official_prompt_match' ||
      row.evidenceStatus === 'cross_school_official_prompt_match',
  );
  const crossSchoolOfficial = checkedSources.filter(
    (row) => row.evidenceStatus === 'cross_school_official_prompt_match',
  );
  const assignedOfficial = checkedSources.filter(
    (row) => row.evidenceStatus === 'assigned_school_official_prompt_match',
  );
  const officialContextNoMatch = checkedSources.filter(
    (row) => row.evidenceStatus === 'official_context_no_prompt_match',
  );
  const matchedSchoolOfficialContextNoMatch = officialContextNoMatch.filter(
    (row) => row.ownerRelation === 'matched_school',
  );
  const officialTextMatchWithoutPromptContext = checkedSources.filter((row) =>
    row.evidenceStatus.endsWith('_official_text_match_without_prompt_context'),
  );
  const matchedSchoolOfficialTextMatchWithoutPromptContext =
    officialTextMatchWithoutPromptContext.filter(
      (row) => row.ownerRelation === 'matched_school',
    );
  const matchedSchoolName = stringValue(target.evidence?.matchedSchoolName);
  const relation = stringValue(target.evidence?.schoolIdentityRelation);
  const approvalAck = approvalAckFor(target.queueType);
  const requiredReviewerInputs = [
    'approvedReviewerWorkflowId',
    `reviewerAck:${approvalAck}`,
    'confirmedPromptOwner',
    'confirmedSourceFamily',
    'confirmedApplicationYear',
    'confirmedPromptTextAndLimits',
    'confirmedRawSnapshotHash',
    'confirmedConsumerGatesRemainHiddenUntilWrite',
  ];
  const prohibitedActions = [
    'do not mutate EssayPrompt.schoolId from this packet',
    'do not create EssayPromptSource rows from this packet',
    'do not expose this prompt to public essay, timeline, chat, prediction, or application-analysis consumers',
  ];

  if (target.queueType === 'validated_source_blocked') {
    return {
      outcome: 'staging_blockers_keep_source_review_blocked',
      nextAction: 'resolve-staging-blockers-before-review',
      confidence: 'blocked_until_staging_review',
      targetSchoolId: target.schoolId,
      targetSchoolName: target.schoolName,
      reason:
        'The source candidate is blocked by staging checks; reviewer must resolve blocker reasons before any source approval or write workflow.',
      sourceUrls: checkedSources.map((row) => row.finalUrl ?? row.sourceUrl),
      blockerReasons: stringList(target.evidence?.blockerReasons),
      requiredReviewerInputs: [
        ...requiredReviewerInputs,
        'confirmedStagingBlockersResolvedOrCandidateRejected',
      ],
      prohibitedActions,
    };
  }

  if (
    target.queueType === 'source_family_mismatch_review' &&
    crossSchoolOfficial.length > 0 &&
    assignedOfficial.length === 0
  ) {
    return {
      outcome: 'cross_school_prompt_owner_review_candidate',
      nextAction: 'review-cross-school-prompt-owner-and-reassign-or-reject',
      confidence: 'source_backed_cross_school_candidate_only',
      targetSchoolId: target.schoolId,
      targetSchoolName: target.schoolName,
      reason:
        'Official prompt-context evidence matches the stored prompt text, but not as assigned-school evidence; reviewer must confirm the true prompt owner before reassignment, rejection, terminalization, or any source approval.',
      sourceUrls: crossSchoolOfficial.map(
        (row) => row.finalUrl ?? row.sourceUrl,
      ),
      requiredReviewerInputs: [
        ...requiredReviewerInputs,
        'confirmedCrossSchoolPromptOwnerOrReject',
      ],
      prohibitedActions,
    };
  }

  if (
    target.queueType === 'identity_conflict_review' &&
    relation === 'distinct_school_identity' &&
    matchedOfficial.length > 0 &&
    assignedOfficial.length === 0
  ) {
    return {
      outcome: 'reassign_prompt_owner_candidate',
      nextAction: 'review-official-source-and-reassign-or-reject',
      confidence: 'source_backed_candidate_only',
      targetSchoolId: stringValue(target.evidence?.matchedSchoolId),
      targetSchoolName: matchedSchoolName,
      reason:
        'Official source evidence matches the stored prompt text for the matched school, while assigned-school official context does not match.',
      sourceUrls: matchedOfficial.map((row) => row.finalUrl ?? row.sourceUrl),
      requiredReviewerInputs,
      prohibitedActions,
    };
  }

  if (
    target.queueType === 'identity_conflict_review' &&
    relation === 'possible_duplicate_same_website_location'
  ) {
    return {
      outcome: 'duplicate_school_identity_review',
      nextAction:
        'review-merge-school-rows-or-add-alias-before-source-approval',
      confidence: 'candidate_only',
      targetSchoolId: stringValue(target.evidence?.matchedSchoolId),
      targetSchoolName: matchedSchoolName,
      reason:
        'Identity conflict appears to involve two rows for the same institution; reviewer must resolve school identity before source approval.',
      sourceUrls: checkedSources.map((row) => row.finalUrl ?? row.sourceUrl),
      requiredReviewerInputs,
      prohibitedActions,
    };
  }

  if (
    target.queueType === 'identity_conflict_review' &&
    relation === 'distinct_school_identity' &&
    matchedSchoolOfficialTextMatchWithoutPromptContext.length > 0 &&
    matchedOfficial.length === 0 &&
    assignedOfficial.length === 0
  ) {
    return {
      outcome: 'reassign_owner_requires_authenticated_prompt_source_candidate',
      nextAction: 'review-owner-reassignment-and-authenticated-prompt-source',
      confidence: 'owner_supported_authenticated_prompt_source_required',
      targetSchoolId: stringValue(target.evidence?.matchedSchoolId),
      targetSchoolName: matchedSchoolName,
      reason:
        'Matched-school official pages contain the stored text, but not in a prompt-language context; reviewer may treat ownership as a candidate only after authenticated current-cycle prompt evidence confirms this is an application prompt.',
      sourceUrls: matchedSchoolOfficialTextMatchWithoutPromptContext.map(
        (row) => row.finalUrl ?? row.sourceUrl,
      ),
      requiredReviewerInputs: [
        ...requiredReviewerInputs,
        'confirmedAuthenticatedCurrentCyclePromptSource',
      ],
      prohibitedActions,
    };
  }

  if (
    target.queueType === 'identity_conflict_review' &&
    relation === 'distinct_school_identity' &&
    matchedSchoolOfficialContextNoMatch.length > 0 &&
    assignedOfficial.length === 0
  ) {
    return {
      outcome: 'reassign_prompt_owner_update_text_or_verify_candidate',
      nextAction:
        'review-official-source-update-prompt-or-authenticated-verify',
      confidence: 'owner_supported_text_mismatch_candidate_only',
      targetSchoolId: stringValue(target.evidence?.matchedSchoolId),
      targetSchoolName: matchedSchoolName,
      reason:
        'Matched-school official prompt context is current and reachable, but the stored prompt text does not exactly match the public official wording; reviewer should reassign only with updated text or authenticated current-cycle evidence.',
      sourceUrls: matchedSchoolOfficialContextNoMatch.map(
        (row) => row.finalUrl ?? row.sourceUrl,
      ),
      requiredReviewerInputs,
      prohibitedActions,
    };
  }

  if (assignedOfficial.length > 0) {
    return {
      outcome: 'keep_assigned_prompt_with_source_candidate',
      nextAction: 'review-validated-source-before-write',
      confidence: 'source_backed_candidate_only',
      targetSchoolId: target.schoolId,
      targetSchoolName: target.schoolName,
      reason:
        'Assigned-school official source evidence matches the stored prompt text; reviewer still must approve source family and write workflow.',
      sourceUrls: assignedOfficial.map((row) => row.finalUrl ?? row.sourceUrl),
      requiredReviewerInputs,
      prohibitedActions,
    };
  }

  return {
    outcome:
      officialTextMatchWithoutPromptContext.length > 0
        ? 'text_match_without_prompt_context_review'
        : officialContextNoMatch.length > 0
          ? 'reject_reassign_or_terminalize_candidate'
          : 'needs_more_official_evidence',
    nextAction:
      officialTextMatchWithoutPromptContext.length > 0
        ? 'review-text-match-before-source-approval'
        : officialContextNoMatch.length > 0
          ? 'review-prompt-owner-and-reject-reassign-or-terminalize'
          : 'manual-official-source-search',
    confidence: 'candidate_only',
    targetSchoolId: target.schoolId,
    targetSchoolName: target.schoolName,
    reason:
      officialTextMatchWithoutPromptContext.length > 0
        ? 'Official pages matched the stored text, but prompt-language context was not strong enough to treat the page as current prompt evidence.'
        : officialContextNoMatch.length > 0
          ? 'Official prompt-context pages were reachable but did not match the stored prompt text.'
          : 'No official prompt match or official prompt-context no-match evidence was sufficient.',
    sourceUrls: checkedSources.map((row) => row.finalUrl ?? row.sourceUrl),
    requiredReviewerInputs,
    prohibitedActions,
  };
}

function approvalAckFor(queueType: string | null | undefined) {
  return queueType
    ? (APPROVAL_ACKS_BY_QUEUE_TYPE[queueType] ?? APPROVAL_ACK)
    : APPROVAL_ACK;
}

function matchPrompt(promptSnippet: string | null, text: string) {
  const prompt = normalizeText(promptSnippet ?? '');
  const haystack = normalizeText(text);
  if (!prompt || prompt.length < 24) return null;
  const index = haystack.indexOf(prompt);
  if (index >= 0) {
    return {
      kind: 'normalized_exact' as const,
      snippet: snippetAround(haystack, index, prompt.length),
    };
  }
  const prefixLength = Math.min(
    140,
    Math.max(90, Math.floor(prompt.length * 0.7)),
  );
  const prefix = prompt.slice(0, prefixLength);
  const prefixIndex = haystack.indexOf(prefix);
  if (
    prefixIndex >= 0 &&
    hasPromptContextNearby(haystack, prefixIndex, prefix.length)
  ) {
    return {
      kind: 'long_prefix_with_context' as const,
      snippet: snippetAround(haystack, prefixIndex, prefix.length),
    };
  }
  return null;
}

function hasPromptContextNearby(text: string, index: number, length: number) {
  const start = Math.max(0, index - 600);
  const end = Math.min(text.length, index + length + 600);
  const context = text.slice(start, end);
  return detectPromptLanguageSignals(context).length > 0;
}

function detectPromptLanguageSignals(text: string) {
  const normalized = normalizeText(text);
  const signals = [
    'essay prompts',
    'essay prompt',
    'writing prompts',
    'writing prompt',
    'short answer prompts',
    'short answer prompt',
    'short answer questions',
    'supplemental short answer',
    'supplemental essay',
    'writing supplement',
    'school specific prompt',
    'common application',
    'coalition app',
  ];
  return signals.filter((signal) => normalized.includes(signal));
}

function detectCycleSignals(text: string) {
  const raw = text
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ');
  const normalized = normalizeText(text);
  return unique(
    [
      ...Array.from(
        raw.matchAll(/\b20(?:24|25|26|27)\s*[-/]\s*(?:\d{2}|20\d{2})\b/g),
      ).map((match) => match[0].replace(/\s+/g, '')),
      ...Array.from(
        normalized.matchAll(/\b20(?:24|25|26|27)(?:\s*-\s*\d{2})?\b/g),
      ).map((match) => match[0]),
      ...Array.from(normalized.matchAll(/\b(?:2025|2026|2027)\b/g)).map(
        (match) => match[0],
      ),
    ].slice(0, 12),
  );
}

function visibleText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function snippetAround(text: string, index: number, length: number) {
  const start = Math.max(0, index - 120);
  const end = Math.min(text.length, index + length + 180);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function hostname(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isHttpUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function sha256(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function blockedReport(args: Args, reason: string) {
  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-review-action',
    status: 'BLOCKED_REVIEW_ACTION_INPUTS_MISSING' satisfies PacketStatus,
    destructiveDbWriteAllowedByThisPlan: false,
    notificationAllowedByThisPlan: false,
    sourceArtifacts: {
      reviewQueue: args.reviewQueue,
      sourceRecovery: args.sourceRecovery,
    },
    summary: {
      checkedSources: 0,
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
    '# Essay Prompt Review Action Packet',
    '',
    `- Status: ${report.status ?? 'unknown'}`,
    `- Target: ${target.schoolName ?? 'unknown'} / ${target.essayPromptId ?? 'unknown'}`,
    `- Target rows: ${summary.targetRows ?? 0}`,
    `- Selection offset: ${summary.selectionOffset ?? 0}`,
    `- Recommended outcome: ${decision.outcome ?? summary.recommendedOutcome ?? 'unknown'}`,
    `- Next action: ${decision.nextAction ?? summary.nextAction ?? 'unknown'}`,
    `- Candidate URLs: ${summary.candidateUrls ?? 0}`,
    `- Source-recovery candidate URLs: ${summary.sourceRecoveryCandidateUrls ?? 0}`,
    `- Checked sources: ${summary.checkedSources ?? 0}`,
    `- Official prompt matches: ${summary.officialPromptMatches ?? 0}`,
    `- Targets with official prompt matches: ${summary.targetsWithOfficialPromptMatches ?? 0}`,
    `- Targets without candidate URLs: ${summary.targetsWithoutCandidateUrls ?? 0}`,
    `- Targets without checked sources: ${summary.targetsWithoutCheckedSources ?? 0}`,
    `- Checked sources linked to targets: ${summary.allCheckedSourcesLinkedToTargets ?? false}`,
    `- Consumer gate closed: ${summary.consumerGateClosed ?? false}`,
    '',
    '## Review Contract',
    '',
    'This packet is read-only. It does not approve sources, reassign prompts, write the database, or expose consumers. Reviewer approval requires an external workflow id and the exact acknowledgement for each queue type represented in the packet.',
    '',
  ].join('\n');
}

function renderCsv(report: Record<string, unknown>) {
  const rows = Array.isArray(report.checkedSources)
    ? (report.checkedSources as CheckedSource[])
    : [];
  const headers = [
    'targetQueueId',
    'targetQueueType',
    'targetEssayPromptId',
    'targetSchoolId',
    'targetSchoolName',
    'targetMatchedSchoolId',
    'targetMatchedSchoolName',
    'sourceUrl',
    'fetchStatus',
    'httpStatus',
    'finalUrl',
    'sourceQuality',
    'ownerRelation',
    'promptMatch',
    'promptMatchKind',
    'evidenceStatus',
    'recommendedAction',
    'cycleSignals',
    'rawContentSha256',
  ];
  return [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => csvCell((row as any)[header])).join(','),
    ),
  ].join('\n');
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function printSummary(args: Args, report: Record<string, unknown>) {
  const summary = objectValue(report.summary);
  console.log(`Status: ${report.status ?? 'unknown'}`);
  console.log(`JSON: ${args.out}`);
  console.log(`Markdown: ${args.markdown}`);
  console.log(`CSV: ${args.csv}`);
  console.log(`Candidate URLs: ${summary.candidateUrls ?? 0}`);
  console.log(`Checked sources: ${summary.checkedSources ?? 0}`);
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

function stringValue(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function numberArg(value: string | undefined) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
}

function nonNegativeNumberArg(value: string | undefined) {
  if (!value) return 0;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
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
    const key = keyFor(value);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
