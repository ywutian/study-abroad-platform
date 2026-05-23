#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

type Decision = 'review-required' | 'approve-reviewed-sources';
type GateStatus =
  | 'BLOCKED_STAGING_MISSING'
  | 'PASS_NO_REVIEW_CANDIDATES'
  | 'BLOCKED_REVIEW_APPROVAL_REQUIRED'
  | 'REVIEW_APPROVED_SOURCE_ROWS';

interface Args {
  staging: string | null;
  reviewAction: string | null;
  out: string;
  markdown: string;
  csv: string;
  decision: Decision;
  reviewerId: string | null;
  approvedWorkflow: string | null;
  operatorAck: string | null;
  reviewNotes: string | null;
  sourceFamilyConfirmed: boolean;
  cycleYearConfirmed: boolean;
  rawSnapshotReviewed: boolean;
  promptFieldsReviewed: boolean;
  noConflictsConfirmed: boolean;
}

interface StagingReport {
  generatedAt?: string;
  status?: string;
  applicationYear?: number | null;
  rows?: StagingRow[];
  summary?: Record<string, unknown>;
}

interface ReviewActionReport {
  generatedAt?: string;
  status?: string;
  summary?: Record<string, unknown>;
  actions?: ReviewActionRow[];
}

interface ReviewActionRow {
  target?: {
    queueId?: string;
    queueType?: string;
    schoolId?: string | null;
    schoolName?: string | null;
    essayPromptId?: string | null;
  };
  recommendedDecision?: {
    outcome?: string;
    sourceUrls?: string[];
    requiredReviewerInputs?: string[];
  };
}

interface StagingRow {
  schoolId: string;
  schoolName: string;
  applicationYear: number | null;
  sourceUrl: string;
  finalUrl: string | null;
  sourceType: string;
  sourceQuality: string;
  acceptedForReviewerQueue: boolean;
  blockerReasons: string[];
  cycleSignals: string[];
  promptLanguageSignals: string[];
  sourceRowCandidates: SourceRowCandidate[];
}

interface SourceRowCandidate {
  essayPromptId: string;
  schoolId: string;
  schoolName: string;
  applicationYear: number | null;
  sourceType: string;
  sourceUrl: string;
  rawContent: string;
  rawContentSha256: string;
  confidence: number;
  scrapedAt: string | null;
  reviewStatus: string;
  reviewReason: string;
  evidenceSnippet: string | null;
  promptSnippet: string;
  matchKind: string;
}

interface ApprovedSourceRow {
  essayPromptId: string;
  schoolId: string;
  schoolName: string;
  applicationYear: number | null;
  sourceType: string;
  sourceUrl: string;
  rawContent: string;
  rawContentSha256: string;
  confidence: number;
  scrapedAt: string | null;
  evidenceSnippet: string | null;
  promptSnippet: string;
  matchKind: string;
  reviewerId: string;
  approvedWorkflow: string;
  reviewedAt: string;
  reviewNotes: string | null;
  prismaCreateData: {
    essayPromptId: string;
    sourceType: string;
    sourceUrl: string;
    rawContent: string;
    confidence: number;
    scrapedAt: string | null;
  };
}

interface ApprovalRequestRow {
  approvalRequestId: string;
  essayPromptId: string;
  schoolId: string;
  schoolName: string;
  applicationYear: number | null;
  sourceType: string;
  sourceQuality: string;
  sourceUrl: string;
  finalUrl: string | null;
  confidence: number;
  rawContentSha256: string;
  scrapedAt: string | null;
  evidenceSnippet: string | null;
  evidenceSnippetSha256: string | null;
  promptSnippet: string;
  promptSnippetSha256: string;
  matchKind: string;
  reviewStatus: string;
  reviewReason: string;
  blockerReasons: string[];
  cycleSignals: string[];
  promptLanguageSignals: string[];
  requiredReviewerChecks: string[];
  consumerPolicy: string;
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const APPROVAL_ACK = 'APPROVED_ESSAY_PROMPT_SOURCE_REVIEW';

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
  const has = (name: string) => argv.includes(name);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(
        REPORT_ROOT,
        `essay-prompt-source-review-approval-${stamp}.json`,
      ),
    )!,
  );
  const staging = get('--staging');
  const reviewAction = get('--review-action');
  return {
    staging: staging ? path.resolve(API_ROOT, staging) : findLatestStaging(),
    reviewAction: reviewAction ? path.resolve(API_ROOT, reviewAction) : null,
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    decision: parseDecision(get('--decision', 'review-required')!),
    reviewerId: get('--reviewer-id') ?? null,
    approvedWorkflow: get('--approved-workflow') ?? null,
    operatorAck: get('--operator-ack') ?? null,
    reviewNotes: get('--review-notes') ?? null,
    sourceFamilyConfirmed: has('--source-family-confirmed'),
    cycleYearConfirmed: has('--cycle-year-confirmed'),
    rawSnapshotReviewed: has('--raw-snapshot-reviewed'),
    promptFieldsReviewed: has('--prompt-fields-reviewed'),
    noConflictsConfirmed: has('--no-conflicts-confirmed'),
  };
}

function parseDecision(value: string): Decision {
  if (value === 'approve-reviewed-sources') return value;
  return 'review-required';
}

function main() {
  const args = parseArgs();
  if (!args.staging || !fs.existsSync(args.staging)) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-essay-prompt-source-review-approval-gate',
      status: 'BLOCKED_STAGING_MISSING' satisfies GateStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      approvedForWriteWorkflow: false,
      staging: args.staging,
      summary: {
        reviewerQueueRows: 0,
        approvedSourceRows: 0,
      },
      requiredOperatorInputs: requiredInputs(args),
      reviewContract: reviewContract(),
      nextCampaign: {
        id: 'essay_prompt_source_review_staging',
        reason: 'Run source review staging before approval.',
      },
      rows: [],
      approvedSourceRows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    return;
  }

  const staging = JSON.parse(
    fs.readFileSync(args.staging, 'utf8'),
  ) as StagingReport;
  const reviewAction = readOptionalReviewAction(args.reviewAction);
  const unconstrainedReviewerRows = (staging.rows ?? []).filter(
    (row) => row.acceptedForReviewerQueue,
  );
  const actionConstraint = buildReviewActionConstraint(reviewAction);
  const reviewerRows = actionConstraint
    ? constrainReviewerRows(unconstrainedReviewerRows, actionConstraint)
    : unconstrainedReviewerRows;
  const missingInputs = requiredInputs(args).filter((input) => !input.provided);
  const approved =
    reviewerRows.length > 0 &&
    args.decision === 'approve-reviewed-sources' &&
    missingInputs.length === 0;
  const approvedAt = new Date().toISOString();
  const approvedSourceRows = approved
    ? reviewerRows.flatMap((row) => approveRowCandidates(row, args, approvedAt))
    : [];
  const approvalRequestRows = buildApprovalRequestRows(reviewerRows);
  const report = {
    generatedAt: approvedAt,
    mode: 'read-only-essay-prompt-source-review-approval-gate',
    status: statusFor(reviewerRows.length, approved, missingInputs.length),
    destructiveDbWriteAllowedByThisPlan: false,
    approvedForWriteWorkflow: approved,
    staging: path.relative(API_ROOT, args.staging),
    reviewAction: args.reviewAction
      ? path.relative(API_ROOT, args.reviewAction)
      : null,
    stagingGeneratedAt: staging.generatedAt ?? null,
    stagingStatus: staging.status ?? null,
    reviewActionGeneratedAt: reviewAction?.generatedAt ?? null,
    reviewActionStatus: reviewAction?.status ?? null,
    applicationYear: staging.applicationYear ?? null,
    decision: args.decision,
    reviewer: {
      reviewerId: args.reviewerId,
      approvedWorkflow: args.approvedWorkflow,
      reviewNotes: args.reviewNotes,
      reviewedAt: approved ? approvedAt : null,
    },
    confirmations: {
      sourceFamilyConfirmed: args.sourceFamilyConfirmed,
      cycleYearConfirmed: args.cycleYearConfirmed,
      rawSnapshotReviewed: args.rawSnapshotReviewed,
      promptFieldsReviewed: args.promptFieldsReviewed,
      noConflictsConfirmed: args.noConflictsConfirmed,
    },
    approvalCommandTemplate: buildApprovalCommandTemplate(args),
    summary: buildSummary({
      unconstrainedReviewerRows,
      reviewerRows,
      approvalRequestRows,
      approvedRows: approvedSourceRows,
      missingInputs,
      actionConstraint,
      reviewAction,
    }),
    requiredOperatorInputs: requiredInputs(args),
    operatorGuardrails: operatorGuardrails(),
    reviewContract: reviewContract(),
    nextCampaign: buildNextCampaign(
      reviewerRows,
      approvedSourceRows,
      missingInputs,
    ),
    rows: reviewerRows.map((row) => ({
      schoolId: row.schoolId,
      schoolName: row.schoolName,
      applicationYear: row.applicationYear,
      sourceUrl: row.sourceUrl,
      sourceQuality: row.sourceQuality,
      blockerReasons: row.blockerReasons,
      sourceRowCandidates: row.sourceRowCandidates.length,
      promptIds: row.sourceRowCandidates.map(
        (candidate) => candidate.essayPromptId,
      ),
    })),
    approvalRequestRows,
    approvedSourceRows,
  };

  writeReport(args, report);
  printSummary(args, report);
}

function statusFor(
  reviewerRows: number,
  approved: boolean,
  missingInputs: number,
): GateStatus {
  if (reviewerRows === 0) return 'PASS_NO_REVIEW_CANDIDATES';
  if (approved) return 'REVIEW_APPROVED_SOURCE_ROWS';
  if (missingInputs > 0) return 'BLOCKED_REVIEW_APPROVAL_REQUIRED';
  return 'BLOCKED_REVIEW_APPROVAL_REQUIRED';
}

function requiredInputs(args: Args) {
  return [
    {
      key: 'decision',
      requiredValue: 'approve-reviewed-sources',
      provided: args.decision === 'approve-reviewed-sources',
    },
    {
      key: 'reviewerId',
      requiredValue: 'non-empty reviewer id',
      provided: Boolean(args.reviewerId),
    },
    {
      key: 'approvedWorkflow',
      requiredValue: 'approved operator/reviewer workflow id',
      provided: Boolean(args.approvedWorkflow),
    },
    {
      key: 'operatorAck',
      requiredValue: APPROVAL_ACK,
      provided: args.operatorAck === APPROVAL_ACK,
    },
    {
      key: 'sourceFamilyConfirmed',
      requiredValue: true,
      provided: args.sourceFamilyConfirmed,
    },
    {
      key: 'cycleYearConfirmed',
      requiredValue: true,
      provided: args.cycleYearConfirmed,
    },
    {
      key: 'rawSnapshotReviewed',
      requiredValue: true,
      provided: args.rawSnapshotReviewed,
    },
    {
      key: 'promptFieldsReviewed',
      requiredValue: true,
      provided: args.promptFieldsReviewed,
    },
    {
      key: 'noConflictsConfirmed',
      requiredValue: true,
      provided: args.noConflictsConfirmed,
    },
  ];
}

function approveRowCandidates(
  row: StagingRow,
  args: Args,
  reviewedAt: string,
): ApprovedSourceRow[] {
  return row.sourceRowCandidates.map((candidate) => ({
    essayPromptId: candidate.essayPromptId,
    schoolId: candidate.schoolId,
    schoolName: candidate.schoolName,
    applicationYear: candidate.applicationYear,
    sourceType: candidate.sourceType,
    sourceUrl: candidate.sourceUrl,
    rawContent: candidate.rawContent,
    rawContentSha256: candidate.rawContentSha256,
    confidence: candidate.confidence,
    scrapedAt: candidate.scrapedAt,
    evidenceSnippet: candidate.evidenceSnippet,
    promptSnippet: candidate.promptSnippet,
    matchKind: candidate.matchKind,
    reviewerId: args.reviewerId!,
    approvedWorkflow: args.approvedWorkflow!,
    reviewedAt,
    reviewNotes: args.reviewNotes,
    prismaCreateData: {
      essayPromptId: candidate.essayPromptId,
      sourceType: candidate.sourceType,
      sourceUrl: candidate.sourceUrl,
      rawContent: candidate.rawContent,
      confidence: candidate.confidence,
      scrapedAt: candidate.scrapedAt,
    },
  }));
}

function buildSummary(input: {
  unconstrainedReviewerRows: StagingRow[];
  reviewerRows: StagingRow[];
  approvalRequestRows: ApprovalRequestRow[];
  approvedRows: ApprovedSourceRow[];
  missingInputs: Array<{ key: string }>;
  actionConstraint: ReviewActionConstraint | null;
  reviewAction: ReviewActionReport | null;
}) {
  const unconstrainedSourceRows = input.unconstrainedReviewerRows.reduce(
    (sum, row) => sum + row.sourceRowCandidates.length,
    0,
  );
  return {
    reviewerQueueRows: input.reviewerRows.length,
    reviewerQueueSourceRows: input.reviewerRows.reduce(
      (sum, row) => sum + row.sourceRowCandidates.length,
      0,
    ),
    unconstrainedReviewerQueueRows: input.unconstrainedReviewerRows.length,
    unconstrainedReviewerQueueSourceRows: unconstrainedSourceRows,
    reviewActionConstraintApplied: Boolean(input.actionConstraint),
    reviewActionStatus: input.reviewAction?.status ?? null,
    reviewActionEligibleSourceRows:
      input.actionConstraint?.eligibleSourceKeys.size ?? null,
    reviewActionEligiblePromptIds:
      input.actionConstraint?.eligiblePromptIds.size ?? null,
    reviewActionExcludedSourceRows: input.actionConstraint
      ? Math.max(
          0,
          unconstrainedSourceRows -
            input.reviewerRows.reduce(
              (sum, row) => sum + row.sourceRowCandidates.length,
              0,
            ),
        )
      : null,
    approvalRequestRows: input.approvalRequestRows.length,
    approvalRequestPromptIds: Array.from(
      new Set(input.approvalRequestRows.map((row) => row.essayPromptId)),
    ).length,
    approvalRequestSourceUrls: Array.from(
      new Set(input.approvalRequestRows.map((row) => row.sourceUrl)),
    ).length,
    approvedSourceRows: input.approvedRows.length,
    approvedPromptIds: Array.from(
      new Set(input.approvedRows.map((row) => row.essayPromptId)),
    ).length,
    approvedSourceUrls: Array.from(
      new Set(input.approvedRows.map((row) => row.sourceUrl)),
    ).length,
    missingRequiredInputs: input.missingInputs.length,
    missingRequiredInputKeys: input.missingInputs.map((item) => item.key),
    bySourceType: countBy(input.approvedRows, (row) => row.sourceType),
    bySchool: countBy(input.approvedRows, (row) => row.schoolName),
  };
}

function buildApprovalRequestRows(rows: StagingRow[]): ApprovalRequestRow[] {
  return rows.flatMap((row) =>
    row.sourceRowCandidates.map((candidate) => ({
      approvalRequestId: sourceKey(
        candidate.essayPromptId,
        candidate.sourceUrl,
      ),
      essayPromptId: candidate.essayPromptId,
      schoolId: candidate.schoolId,
      schoolName: candidate.schoolName,
      applicationYear: candidate.applicationYear,
      sourceType: candidate.sourceType,
      sourceQuality: row.sourceQuality,
      sourceUrl: candidate.sourceUrl,
      finalUrl: row.finalUrl,
      confidence: candidate.confidence,
      rawContentSha256: candidate.rawContentSha256,
      scrapedAt: candidate.scrapedAt,
      evidenceSnippet: candidate.evidenceSnippet,
      evidenceSnippetSha256: candidate.evidenceSnippet
        ? sha256Text(candidate.evidenceSnippet)
        : null,
      promptSnippet: candidate.promptSnippet,
      promptSnippetSha256: sha256Text(candidate.promptSnippet),
      matchKind: candidate.matchKind,
      reviewStatus: candidate.reviewStatus,
      reviewReason: candidate.reviewReason,
      blockerReasons: row.blockerReasons,
      cycleSignals: row.cycleSignals,
      promptLanguageSignals: row.promptLanguageSignals,
      requiredReviewerChecks: reviewerChecks(),
      consumerPolicy:
        'keep public essay, timeline, chat, prediction, and application-analysis consumers hidden until source row write and re-audit',
    })),
  );
}

function reviewerChecks() {
  return [
    'confirm source family belongs to assigned school and prompt type',
    'confirm application cycle and effective year',
    'review raw source snapshot hash and source URL',
    'confirm prompt text, required/optional status, and word limit',
    'confirm no identity conflict, duplicate canonical prompt, or source-family mismatch remains',
    'confirm consumer gates remain hidden until DB source rows exist and closure audit is re-run',
  ];
}

function buildNextCampaign(
  reviewerRows: StagingRow[],
  approvedRows: ApprovedSourceRow[],
  missingInputs: Array<{ key: string }>,
) {
  if (approvedRows.length > 0) {
    const [top] = approvedRows;
    return {
      id: 'essay_prompt_source_write_workflow',
      reason: `${approvedRows.length} reviewed source rows are approved for a write workflow; write only through an approved admin/Prisma path after DB schema compatibility is resolved.`,
      schoolId: top.schoolId,
      schoolName: top.schoolName,
      sourceUrl: top.sourceUrl,
      recommendedAction: 'dry-run-approved-source-row-write',
    };
  }
  if (reviewerRows.length > 0) {
    const [top] = reviewerRows;
    return {
      id: 'essay_prompt_source_review_approval',
      reason: `${top.schoolName} has ${top.sourceRowCandidates.length} source rows in reviewer queue but approval inputs are missing: ${missingInputs
        .map((input) => input.key)
        .join(', ')}`,
      schoolId: top.schoolId,
      schoolName: top.schoolName,
      sourceUrl: top.sourceUrl,
      recommendedAction: 'complete-review-approval-inputs',
    };
  }
  return {
    id: 'essay_prompt_source_review_staging',
    reason:
      'No reviewer queue rows are available; continue source validation/staging.',
    recommendedAction: 'continue-source-validation',
  };
}

function operatorGuardrails() {
  return [
    'This script never writes Prisma data.',
    'approvedForWriteWorkflow=true is not a DB write; it only certifies reviewer inputs for a later dry-run/write workflow.',
    'Do not expose prompts publicly until EssayPromptSource rows exist in the DB and the public/timeline source gates pass.',
    'If DB schema compatibility is blocked, keep approved rows as artifacts and do not attempt a live write.',
  ];
}

function reviewContract() {
  return {
    approvedEvidenceStatus:
      'approved source rows are reviewed candidates for a controlled write workflow, not proof that the DB is already updated.',
    requiredAck: APPROVAL_ACK,
    writeTarget: 'EssayPromptSource',
    sourceFields: [
      'essayPromptId',
      'sourceType',
      'sourceUrl',
      'rawContent',
      'confidence',
      'scrapedAt',
    ],
    prohibitedActions: [
      'do not write DB rows from this script',
      'do not mark essay prompt closure passed until DB source rows exist',
      'do not bypass source-gated public/timeline consumers',
    ],
  };
}

function buildApprovalCommandTemplate(args: Args) {
  return [
    'pnpm --filter api audit:essay-prompt-source-review-approval',
    '--',
    args.staging ? `--staging ${shellQuote(args.staging)}` : null,
    args.reviewAction
      ? `--review-action ${shellQuote(args.reviewAction)}`
      : null,
    '--decision approve-reviewed-sources',
    '--reviewer-id <reviewer-id>',
    '--approved-workflow <approved-workflow-id>',
    `--operator-ack ${APPROVAL_ACK}`,
    '--source-family-confirmed',
    '--cycle-year-confirmed',
    '--raw-snapshot-reviewed',
    '--prompt-fields-reviewed',
    '--no-conflicts-confirmed',
    '--out /tmp/essay-prompt-source-review-approval-latest.json',
    '--markdown /tmp/essay-prompt-source-review-approval-latest.md',
    '--csv /tmp/essay-prompt-source-review-approval-latest.csv',
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

interface ReviewActionConstraint {
  eligibleSourceKeys: Set<string>;
  eligiblePromptIds: Set<string>;
}

function buildReviewActionConstraint(
  reviewAction: ReviewActionReport | null,
): ReviewActionConstraint | null {
  if (!reviewAction) return null;
  const eligibleSourceKeys = new Set<string>();
  const eligiblePromptIds = new Set<string>();
  for (const action of reviewAction.actions ?? []) {
    if (
      action.target?.queueType !== 'validated_source_review' ||
      action.recommendedDecision?.outcome !==
        'keep_assigned_prompt_with_source_candidate'
    ) {
      continue;
    }
    const essayPromptId = action.target.essayPromptId;
    if (!essayPromptId) continue;
    eligiblePromptIds.add(essayPromptId);
    for (const sourceUrl of action.recommendedDecision.sourceUrls ?? []) {
      eligibleSourceKeys.add(sourceKey(essayPromptId, sourceUrl));
    }
  }
  return { eligibleSourceKeys, eligiblePromptIds };
}

function constrainReviewerRows(
  rows: StagingRow[],
  constraint: ReviewActionConstraint,
): StagingRow[] {
  return rows
    .map((row) => ({
      ...row,
      sourceRowCandidates: row.sourceRowCandidates.filter((candidate) => {
        const promptMatches = constraint.eligiblePromptIds.has(
          candidate.essayPromptId,
        );
        if (!promptMatches) return false;
        return [candidate.sourceUrl, row.sourceUrl, row.finalUrl]
          .filter((url): url is string => Boolean(url))
          .some((url) =>
            constraint.eligibleSourceKeys.has(
              sourceKey(candidate.essayPromptId, url),
            ),
          );
      }),
    }))
    .filter((row) => row.sourceRowCandidates.length > 0);
}

function sourceKey(essayPromptId: string, sourceUrl: string) {
  return `${essayPromptId}|${canonicalUrl(sourceUrl)}`;
}

function canonicalUrl(sourceUrl: string) {
  try {
    const parsed = new URL(sourceUrl);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return sourceUrl.trim().replace(/\/+$/, '');
  }
}

function readOptionalReviewAction(
  reviewActionPath: string | null,
): ReviewActionReport | null {
  if (!reviewActionPath || !fs.existsSync(reviewActionPath)) return null;
  return JSON.parse(
    fs.readFileSync(reviewActionPath, 'utf8'),
  ) as ReviewActionReport;
}

function findLatestStaging() {
  if (!fs.existsSync(REPORT_ROOT)) return null;
  const latest = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) =>
      /^essay-prompt-source-review-staging-.+\.json$/.test(file),
    )
    .map((file) => ({
      file,
      mtimeMs: fs.statSync(path.join(REPORT_ROOT, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return latest ? path.join(REPORT_ROOT, latest.file) : null;
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const approvedRows = Array.isArray(report.approvedSourceRows)
    ? (report.approvedSourceRows as ApprovedSourceRow[])
    : [];
  const rows = Array.isArray(report.rows)
    ? (report.rows as Array<{
        schoolName: string;
        sourceUrl: string;
        sourceRowCandidates: number;
      }>)
    : [];
  const approvalRequestRows = Array.isArray(report.approvalRequestRows)
    ? (report.approvalRequestRows as ApprovalRequestRow[])
    : [];
  const missing = Array.isArray(report.summary?.missingRequiredInputKeys)
    ? (report.summary.missingRequiredInputKeys as string[])
    : [];
  const lines = [
    '# Essay Prompt Source Review Approval Gate',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Decision: ${report.decision ?? 'unknown'}`,
    `Approved for write workflow: ${report.approvedForWriteWorkflow ? 'yes' : 'no'}`,
    '',
    '## Summary',
    '',
    `- Reviewer queue rows: ${report.summary?.reviewerQueueRows ?? 0}`,
    `- Review-action constraint applied: ${report.summary?.reviewActionConstraintApplied ? 'yes' : 'no'}`,
    `- Review-action eligible source rows: ${report.summary?.reviewActionEligibleSourceRows ?? 'n/a'}`,
    `- Review-action excluded source rows: ${report.summary?.reviewActionExcludedSourceRows ?? 'n/a'}`,
    `- Approval request rows: ${report.summary?.approvalRequestRows ?? 0}`,
    `- Approval request prompt IDs: ${report.summary?.approvalRequestPromptIds ?? 0}`,
    `- Approved source rows: ${report.summary?.approvedSourceRows ?? 0}`,
    `- Missing required inputs: ${missing.length ? missing.join(', ') : 'none'}`,
    '',
    '## Approval Command Template',
    '',
    '```bash',
    report.approvalCommandTemplate ?? '',
    '```',
    '',
    '## Guardrails',
    '',
    '- This artifact does not write the database.',
    '- Public/timeline consumers remain source-gated until source rows exist in DB.',
    '- DB schema compatibility must be resolved before any live write workflow.',
    '',
    '## Reviewer Queue',
    '',
    '| School | Candidate Rows | Source |',
    '| --- | ---: | --- |',
    ...rows.map(
      (row) =>
        `| ${escapeMarkdown(row.schoolName)} | ${row.sourceRowCandidates} | ${escapeMarkdown(row.sourceUrl)} |`,
    ),
    '',
    '## Approval Request Rows',
    '',
    '| School | Prompt ID | Source Type | Confidence | Raw Hash | Source |',
    '| --- | --- | --- | ---: | --- | --- |',
    ...approvalRequestRows.map(
      (row) =>
        `| ${escapeMarkdown(row.schoolName)} | ${row.essayPromptId} | ${row.sourceType} | ${row.confidence} | ${row.rawContentSha256} | ${escapeMarkdown(row.sourceUrl)} |`,
    ),
    '',
    '## Approved Source Rows',
    '',
    '| School | Prompt ID | Source Type | Confidence | Source |',
    '| --- | --- | --- | ---: | --- |',
    ...(approvedRows.length
      ? approvedRows.map(
          (row) =>
            `| ${escapeMarkdown(row.schoolName)} | ${row.essayPromptId} | ${row.sourceType} | ${row.confidence} | ${escapeMarkdown(row.sourceUrl)} |`,
        )
      : ['| None | n/a | n/a | 0 | n/a |']),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderCsv(report: Record<string, any>) {
  const approvedRows = Array.isArray(report.approvedSourceRows)
    ? (report.approvedSourceRows as ApprovedSourceRow[])
    : [];
  if (approvedRows.length > 0) return renderApprovedCsv(approvedRows);
  const requestRows = Array.isArray(report.approvalRequestRows)
    ? (report.approvalRequestRows as ApprovalRequestRow[])
    : [];
  return renderApprovalRequestCsv(requestRows);
}

function renderApprovedCsv(rows: ApprovedSourceRow[]) {
  const header = [
    'essayPromptId',
    'schoolId',
    'schoolName',
    'applicationYear',
    'sourceType',
    'sourceUrl',
    'confidence',
    'rawContentSha256',
    'scrapedAt',
    'reviewerId',
    'approvedWorkflow',
    'reviewedAt',
    'evidenceSnippet',
  ];
  const lines = rows.map((row) =>
    [
      row.essayPromptId,
      row.schoolId,
      row.schoolName,
      row.applicationYear ?? '',
      row.sourceType,
      row.sourceUrl,
      row.confidence,
      row.rawContentSha256,
      row.scrapedAt ?? '',
      row.reviewerId,
      row.approvedWorkflow,
      row.reviewedAt,
      row.evidenceSnippet ?? '',
    ]
      .map(csvCell)
      .join(','),
  );
  return `${[header.join(','), ...lines].join('\n')}\n`;
}

function renderApprovalRequestCsv(rows: ApprovalRequestRow[]) {
  const header = [
    'approvalRequestId',
    'essayPromptId',
    'schoolId',
    'schoolName',
    'applicationYear',
    'sourceType',
    'sourceQuality',
    'sourceUrl',
    'finalUrl',
    'confidence',
    'rawContentSha256',
    'scrapedAt',
    'matchKind',
    'promptSnippetSha256',
    'evidenceSnippetSha256',
    'reviewStatus',
    'reviewReason',
    'consumerPolicy',
  ];
  const lines = rows.map((row) =>
    [
      row.approvalRequestId,
      row.essayPromptId,
      row.schoolId,
      row.schoolName,
      row.applicationYear ?? '',
      row.sourceType,
      row.sourceQuality,
      row.sourceUrl,
      row.finalUrl ?? '',
      row.confidence,
      row.rawContentSha256,
      row.scrapedAt ?? '',
      row.matchKind,
      row.promptSnippetSha256,
      row.evidenceSnippetSha256 ?? '',
      row.reviewStatus,
      row.reviewReason,
      row.consumerPolicy,
    ]
      .map(csvCell)
      .join(','),
  );
  return `${[header.join(','), ...lines].join('\n')}\n`;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, '\\|');
}

function sha256Text(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function printSummary(_: Args, report: Record<string, any>) {
  console.log(`Essay prompt source review approval status: ${report.status}`);
  console.log(`Decision: ${report.decision ?? 'unknown'}`);
  console.log(
    `Approved for write workflow: ${report.approvedForWriteWorkflow ? 'yes' : 'no'}`,
  );
  console.log(
    `Approved source rows: ${report.summary?.approvedSourceRows ?? 0}`,
  );
  console.log(
    `Missing required inputs: ${report.summary?.missingRequiredInputs ?? 0}`,
  );
}

main();
