#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type MonitorStatus =
  | 'ESSAY_PROMPT_SOURCE_APPROVAL_MONITOR_ACTIVE'
  | 'ESSAY_PROMPT_SOURCE_APPROVAL_MONITOR_COMPLETE'
  | 'BLOCKED_ESSAY_PROMPT_SOURCE_APPROVAL_MONITOR';
type CheckStatus = 'pass' | 'warn' | 'fail';

interface Args {
  reviewQueue: string | null;
  reviewAction: string | null;
  approval: string | null;
  writePlan: string | null;
  disposition: string | null;
  out: string;
  markdown: string;
  csv: string;
}

interface ClosureReport {
  generatedAt?: string;
  status?: string;
  destructiveDbWriteAllowedByThisPlan?: boolean;
  approvedForWriteWorkflow?: boolean;
  schemaBlocksWrites?: boolean;
  summary?: Record<string, unknown>;
  rows?: Record<string, unknown>[];
  actions?: Record<string, unknown>[];
  approvalRequestRows?: ApprovalRequestRow[];
  pendingApprovalCandidates?: PendingApprovalCandidate[];
}

interface ApprovalRequestRow {
  approvalRequestId?: string;
  essayPromptId?: string;
  schoolId?: string;
  schoolName?: string;
  applicationYear?: number | null;
  sourceType?: string;
  sourceQuality?: string;
  sourceUrl?: string;
  finalUrl?: string | null;
  confidence?: number;
  rawContentSha256?: string;
  scrapedAt?: string | null;
  matchKind?: string;
  reviewStatus?: string;
  requiredReviewerChecks?: string[];
  consumerPolicy?: string;
}

interface PendingApprovalCandidate {
  approvalRequestId?: string;
  essayPromptId?: string;
  schoolId?: string;
  schoolName?: string;
  applicationYear?: number | null;
  sourceType?: string;
  sourceQuality?: string;
  sourceUrl?: string;
  finalUrl?: string | null;
  confidence?: number;
  rawContentSha256?: string;
  scrapedAt?: string | null;
  approvalRequired?: boolean;
  schemaBlocksWrite?: boolean;
  consumerPolicy?: string;
  idempotencyKey?: string;
}

interface CheckRow {
  id: string;
  status: CheckStatus;
  summary: string;
  evidence: string[];
  missing: string[];
}

interface MonitorRow {
  approvalRequestId: string;
  essayPromptId: string;
  schoolId: string;
  schoolName: string;
  applicationYear: number | null;
  sourceType: string;
  sourceQuality: string;
  sourceUrl: string;
  finalUrl: string | null;
  confidence: number | null;
  rawContentSha256: string;
  scrapedAt: string | null;
  approvalRequired: boolean;
  schemaBlocksWrite: boolean;
  consumerPolicy: string;
  idempotencyKey: string;
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');

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
        `essay-prompt-source-approval-monitor-${stamp}.json`,
      ),
    )!,
  );
  return {
    reviewQueue: optionalPath(
      '--review-queue',
      /^essay-prompt-review-queue-.+\.json$/,
    ),
    reviewAction: optionalPath(
      '--review-action',
      /^essay-prompt-review-action-.+\.json$/,
    ),
    approval: optionalPath(
      '--approval',
      /^essay-prompt-source-review-approval-.+\.json$/,
    ),
    writePlan: optionalPath(
      '--write-plan',
      /^essay-prompt-source-write-plan-.+\.json$/,
    ),
    disposition: optionalPath(
      '--disposition',
      /^essay-prompt-disposition-.+\.json$/,
    ),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
  };
}

function resolveInputPath(value: string) {
  if (path.isAbsolute(value)) return value;
  const candidates = [
    path.resolve(process.cwd(), value),
    path.resolve(API_ROOT, value),
  ];
  return (
    candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[1]
  );
}

function main() {
  const args = parseArgs();
  const reviewQueue = readOptionalJson<ClosureReport>(args.reviewQueue);
  const reviewAction = readOptionalJson<ClosureReport>(args.reviewAction);
  const approval = readOptionalJson<ClosureReport>(args.approval);
  const writePlan = readOptionalJson<ClosureReport>(args.writePlan);
  const disposition = readOptionalJson<ClosureReport>(args.disposition);
  const rows = buildRows(writePlan, approval);
  const checks = buildChecks({
    reviewQueue,
    reviewAction,
    approval,
    writePlan,
    disposition,
    rows,
  });
  const failedChecks = checks.filter((check) => check.status === 'fail');
  const pendingRows = rows.length;
  const status: MonitorStatus =
    failedChecks.length > 0
      ? 'BLOCKED_ESSAY_PROMPT_SOURCE_APPROVAL_MONITOR'
      : pendingRows === 0
        ? 'ESSAY_PROMPT_SOURCE_APPROVAL_MONITOR_COMPLETE'
        : 'ESSAY_PROMPT_SOURCE_APPROVAL_MONITOR_ACTIVE';
  const approvalSummary = objectSummary(approval?.summary);
  const writePlanSummary = objectSummary(writePlan?.summary);
  const reviewActionSummary = objectSummary(reviewAction?.summary);
  const reviewQueueSummary = objectSummary(reviewQueue?.summary);
  const dispositionSummary = objectSummary(disposition?.summary);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-source-approval-monitor',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    notificationAllowedByThisPlan: false,
    sourceArtifacts: {
      reviewQueue: summarizeInput(args.reviewQueue, reviewQueue),
      reviewAction: summarizeInput(args.reviewAction, reviewAction),
      approval: summarizeInput(args.approval, approval),
      writePlan: summarizeInput(args.writePlan, writePlan),
      disposition: summarizeInput(args.disposition, disposition),
    },
    summary: {
      reviewQueueRows: numberSummary(reviewQueueSummary, 'reviewQueueRows'),
      reviewQueueBlockedRows: numberSummary(reviewQueueSummary, 'blockedRows'),
      reviewQueueAllRowsHaveConsumerPolicy:
        booleanSummary(reviewQueueSummary, 'allRowsHaveConsumerPolicy') ===
        'true',
      reviewActionTargetRows: numberSummary(reviewActionSummary, 'targetRows'),
      reviewActionCheckedSources: numberSummary(
        reviewActionSummary,
        'checkedSources',
      ),
      reviewActionOfficialPromptMatches: numberSummary(
        reviewActionSummary,
        'officialPromptMatches',
      ),
      reviewActionKeepAssignedSourceCandidates: numberSummary(
        objectSummary(reviewActionSummary.byRecommendedOutcome),
        'keep_assigned_prompt_with_source_candidate',
      ),
      reviewActionConsumerGateClosed:
        booleanSummary(reviewActionSummary, 'consumerGateClosed') === 'true',
      approvalStatus: approval?.status ?? null,
      approvalRequestRows: numberSummary(
        approvalSummary,
        'approvalRequestRows',
      ),
      approvalRequestPromptIds: numberSummary(
        approvalSummary,
        'approvalRequestPromptIds',
      ),
      approvalRequestSourceUrls: numberSummary(
        approvalSummary,
        'approvalRequestSourceUrls',
      ),
      approvedSourceRows: numberSummary(approvalSummary, 'approvedSourceRows'),
      approvedForWriteWorkflow: approval?.approvedForWriteWorkflow === true,
      writePlanStatus: writePlan?.status ?? null,
      writePlanPendingApprovalCandidates: numberSummary(
        writePlanSummary,
        'pendingApprovalUniqueCandidates',
      ),
      writePlanPendingApprovalRequestRows: numberSummary(
        writePlanSummary,
        'pendingApprovalRequestRows',
      ),
      writePlanSchemaBlocked:
        writePlan?.schemaBlocksWrites === true ||
        booleanSummary(writePlanSummary, 'pendingApprovalSchemaBlocked') ===
          'true',
      dispositionStatus: disposition?.status ?? null,
      dispositionDbSchemaBlockedRows: numberSummary(
        dispositionSummary,
        'dbSchemaBlockedRows',
      ),
      pendingRows,
      uniquePromptIds: unique(rows.map((row) => row.essayPromptId)).length,
      uniqueSourceUrls: unique(rows.map((row) => row.sourceUrl)).length,
      schoolsWithPendingRows: unique(rows.map((row) => row.schoolId)).length,
      topPendingSchoolName: rows[0]?.schoolName ?? null,
      topPendingSourceUrl: rows[0]?.sourceUrl ?? null,
      rowsWithRawContent: 0,
      failedChecks: failedChecks.length,
      warningChecks: checks.filter((check) => check.status === 'warn').length,
      passedChecks: checks.filter((check) => check.status === 'pass').length,
    },
    monitorContract: {
      writesEssayPromptSources: false,
      approvesReviewerWorkflow: false,
      storesRawContent: false,
      carriesOnlyRawContentHashes: true,
      consumersRemainHiddenUntilSourceRowsExist: true,
      completionSignal:
        'pendingRows reaches 0 after approval requests are approved/rejected and the write plan no longer carries non-writeable pending candidates',
    },
    nextCampaign: nextCampaign(status, failedChecks, pendingRows),
    checks,
    rows,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(checks, rows), 'utf8');
  printSummary(args, report);
}

function buildRows(
  writePlan: ClosureReport | null,
  approval: ClosureReport | null,
): MonitorRow[] {
  const writePlanRows = writePlan?.pendingApprovalCandidates ?? [];
  const approvalRowsByKey = new Map(
    (approval?.approvalRequestRows ?? []).map((row) => [approvalKey(row), row]),
  );
  return writePlanRows.map((row) => {
    const approvalRow = approvalRowsByKey.get(approvalKey(row));
    return {
      approvalRequestId:
        row.approvalRequestId ?? approvalRow?.approvalRequestId ?? '',
      essayPromptId: row.essayPromptId ?? approvalRow?.essayPromptId ?? '',
      schoolId: row.schoolId ?? approvalRow?.schoolId ?? '',
      schoolName: row.schoolName ?? approvalRow?.schoolName ?? '',
      applicationYear:
        row.applicationYear ?? approvalRow?.applicationYear ?? null,
      sourceType: row.sourceType ?? approvalRow?.sourceType ?? '',
      sourceQuality: row.sourceQuality ?? approvalRow?.sourceQuality ?? '',
      sourceUrl: row.sourceUrl ?? approvalRow?.sourceUrl ?? '',
      finalUrl: row.finalUrl ?? approvalRow?.finalUrl ?? null,
      confidence: row.confidence ?? approvalRow?.confidence ?? null,
      rawContentSha256:
        row.rawContentSha256 ?? approvalRow?.rawContentSha256 ?? '',
      scrapedAt: row.scrapedAt ?? approvalRow?.scrapedAt ?? null,
      approvalRequired: row.approvalRequired === true,
      schemaBlocksWrite: row.schemaBlocksWrite === true,
      consumerPolicy: row.consumerPolicy ?? approvalRow?.consumerPolicy ?? '',
      idempotencyKey:
        row.idempotencyKey ??
        `${row.essayPromptId ?? ''}|${row.sourceType ?? ''}|${row.sourceUrl ?? ''}`,
    };
  });
}

function buildChecks(input: {
  reviewQueue: ClosureReport | null;
  reviewAction: ClosureReport | null;
  approval: ClosureReport | null;
  writePlan: ClosureReport | null;
  disposition: ClosureReport | null;
  rows: MonitorRow[];
}) {
  const checks: CheckRow[] = [];
  const add = (
    id: string,
    ok: boolean,
    summary: string,
    evidence: string[],
    missing: string[] = [],
  ) => {
    checks.push({
      id,
      status: ok ? 'pass' : 'fail',
      summary,
      evidence,
      missing,
    });
  };
  const reviewQueueSummary = objectSummary(input.reviewQueue?.summary);
  const reviewActionSummary = objectSummary(input.reviewAction?.summary);
  const approvalSummary = objectSummary(input.approval?.summary);
  const writePlanSummary = objectSummary(input.writePlan?.summary);
  const dispositionSummary = objectSummary(input.disposition?.summary);
  const approvalRequestRows = numberSummary(
    approvalSummary,
    'approvalRequestRows',
  );
  const approvalUniqueWriteRows = new Set(
    (input.approval?.approvalRequestRows ?? []).map((row) => writeKey(row)),
  ).size;
  const writePlanPendingRows = numberSummary(
    writePlanSummary,
    'pendingApprovalUniqueCandidates',
  );
  const pendingApprovalRequestRows = numberSummary(
    writePlanSummary,
    'pendingApprovalRequestRows',
  );
  const validatedSourceReviewRows = numberSummary(
    reviewQueueSummary,
    'validatedSourceReviewRows',
  );
  const approvedSourceRows = numberSummary(
    approvalSummary,
    'approvedSourceRows',
  );
  const reviewActionConsumerGateClosed =
    booleanSummary(reviewActionSummary, 'consumerGateClosed') === 'true';
  const sourceApprovalExpected =
    validatedSourceReviewRows > 0 ||
    approvalRequestRows > 0 ||
    writePlanPendingRows > 0 ||
    pendingApprovalRequestRows > 0;

  add(
    'review_queue_consumer_policy_present',
    Boolean(input.reviewQueue) &&
      booleanSummary(reviewQueueSummary, 'allRowsHaveConsumerPolicy') ===
        'true',
    'Reviewer queue rows must carry consumer-hide policy before approval monitoring.',
    [
      `status=${input.reviewQueue?.status ?? 'missing'}`,
      `allRowsHaveConsumerPolicy=${booleanSummary(reviewQueueSummary, 'allRowsHaveConsumerPolicy')}`,
    ],
    input.reviewQueue ? [] : ['--review-queue'],
  );
  add(
    'review_action_present_and_consumer_gate_open',
    !sourceApprovalExpected ||
      (Boolean(input.reviewAction) && !reviewActionConsumerGateClosed),
    'Reviewer action packet should exist while public/timeline consumers remain source-gated.',
    [
      `status=${input.reviewAction?.status ?? 'missing'}`,
      `consumerGateClosed=${booleanSummary(reviewActionSummary, 'consumerGateClosed')}`,
      `validatedSourceReviewRows=${validatedSourceReviewRows}`,
    ],
    !sourceApprovalExpected || input.reviewAction ? [] : ['--review-action'],
  );
  add(
    'approval_request_rows_pending',
    !sourceApprovalExpected ||
      (Boolean(input.approval) &&
        approvalRequestRows > 0 &&
        approvedSourceRows === 0 &&
        input.approval?.approvedForWriteWorkflow !== true),
    'Approval gate should expose reviewer handoff rows without approving write workflow.',
    [
      `status=${input.approval?.status ?? 'missing'}`,
      `approvalRequestRows=${approvalRequestRows}`,
      `validatedSourceReviewRows=${validatedSourceReviewRows}`,
      `approvedSourceRows=${approvedSourceRows}`,
      `approvedForWriteWorkflow=${String(input.approval?.approvedForWriteWorkflow)}`,
    ],
    !sourceApprovalExpected || input.approval ? [] : ['--approval'],
  );
  add(
    'write_plan_non_writeable_pending_candidates',
    !sourceApprovalExpected ||
      (Boolean(input.writePlan) &&
        input.writePlan?.destructiveDbWriteAllowedByThisPlan === false &&
        writePlanPendingRows > 0),
    'Write plan must carry pending approval rows as non-writeable preflight candidates.',
    [
      `status=${input.writePlan?.status ?? 'missing'}`,
      `destructiveDbWriteAllowedByThisPlan=${String(input.writePlan?.destructiveDbWriteAllowedByThisPlan)}`,
      `pendingApprovalUniqueCandidates=${writePlanPendingRows}`,
      `validatedSourceReviewRows=${validatedSourceReviewRows}`,
    ],
    !sourceApprovalExpected || input.writePlan ? [] : ['--write-plan'],
  );
  add(
    'approval_write_plan_alignment',
    !sourceApprovalExpected ||
      (approvalUniqueWriteRows === writePlanPendingRows &&
        approvalRequestRows === pendingApprovalRequestRows &&
        writePlanPendingRows === input.rows.length),
    'Approval request rows and deduplicated write-plan pending candidates should align.',
    [
      `approvalRequestRows=${approvalRequestRows}`,
      `approvalUniqueWriteRows=${approvalUniqueWriteRows}`,
      `writePlanPendingRows=${writePlanPendingRows}`,
      `pendingApprovalRequestRows=${pendingApprovalRequestRows}`,
      `monitorRows=${input.rows.length}`,
      `validatedSourceReviewRows=${validatedSourceReviewRows}`,
    ],
    !sourceApprovalExpected ||
      (approvalUniqueWriteRows === writePlanPendingRows &&
        approvalRequestRows === pendingApprovalRequestRows &&
        writePlanPendingRows === input.rows.length)
      ? []
      : ['regenerate approval/write-plan together'],
  );
  add(
    'db_schema_still_blocks_essay_source_writes',
    !sourceApprovalExpected ||
      input.writePlan?.schemaBlocksWrites === true ||
      booleanSummary(writePlanSummary, 'pendingApprovalSchemaBlocked') ===
        'true',
    'The monitor must preserve the global DB schema blocker instead of creating write permission.',
    [
      `schemaBlocksWrites=${String(input.writePlan?.schemaBlocksWrites)}`,
      `pendingApprovalSchemaBlocked=${booleanSummary(writePlanSummary, 'pendingApprovalSchemaBlocked')}`,
      `schemaWorklistStatus=${String(writePlanSummary.schemaWorklistStatus ?? 'unknown')}`,
    ],
  );
  add(
    'monitor_rows_hash_only',
    !sourceApprovalExpected ||
      (input.rows.length > 0 &&
        input.rows.every(
          (row) =>
            row.rawContentSha256.length > 0 &&
            !Object.prototype.hasOwnProperty.call(row, 'rawContent'),
        )),
    'Monitor rows must carry raw-content hashes only, never raw source bodies.',
    [`monitorRows=${input.rows.length}`],
    !sourceApprovalExpected || input.rows.length > 0
      ? []
      : ['pendingApprovalCandidates'],
  );
  add(
    'consumer_policy_remains_hidden',
    !sourceApprovalExpected ||
      (input.rows.length > 0 &&
        input.rows.every((row) => consumerPolicyIsHidden(row.consumerPolicy)) &&
        numberSummary(dispositionSummary, 'sourceGapRows') > 0),
    'Essay public/timeline/chat consumers must remain hidden until source rows exist and the audit is rerun.',
    [
      `hiddenRows=${input.rows.filter((row) => consumerPolicyIsHidden(row.consumerPolicy)).length}`,
      `sourceGapRows=${numberSummary(dispositionSummary, 'sourceGapRows')}`,
    ],
    input.disposition ? [] : ['--disposition'],
  );
  return checks;
}

function nextCampaign(
  status: MonitorStatus,
  failedChecks: CheckRow[],
  pendingRows: number,
) {
  if (status === 'BLOCKED_ESSAY_PROMPT_SOURCE_APPROVAL_MONITOR') {
    return {
      id: 'essay_prompt_source_approval_monitor_fix',
      reason: `${failedChecks.length} monitor checks failed; fix ${failedChecks[0]?.id ?? 'unknown'} first.`,
      firstFailedCheck: failedChecks[0]?.id ?? null,
    };
  }
  if (status === 'ESSAY_PROMPT_SOURCE_APPROVAL_MONITOR_COMPLETE') {
    return {
      id: 'essay_prompt_next_source_review_slice',
      reason:
        'No pending approval rows remain; regenerate the review queue and approval gate to select the next essay source slice.',
    };
  }
  return {
    id: 'essay_prompt_source_reviewer_approval_or_db_schema_resolution',
    reason: `${pendingRows} source candidates remain pending reviewer approval and DB schema compatibility.`,
    recommendedAction:
      'collect reviewer approvals or keep monitoring while DB schema recovery remains operator-blocked',
  };
}

function approvalKey(row: {
  approvalRequestId?: string;
  essayPromptId?: string;
  sourceUrl?: string;
}) {
  return (
    row.approvalRequestId ?? `${row.essayPromptId ?? ''}|${row.sourceUrl ?? ''}`
  );
}

function writeKey(row: {
  essayPromptId?: string;
  sourceType?: string;
  sourceUrl?: string;
}) {
  return `${row.essayPromptId ?? ''}|${row.sourceType ?? ''}|${row.sourceUrl ?? ''}`;
}

function consumerPolicyIsHidden(policy: string) {
  const normalized = policy.toLowerCase();
  return normalized.includes('hidden') && normalized.includes('source row');
}

function summarizeInput(filePath: string | null, report: ClosureReport | null) {
  return {
    path: filePath ? path.relative(API_ROOT, filePath) : null,
    found: Boolean(report),
    generatedAt: report?.generatedAt ?? null,
    status: report?.status ?? null,
    summary: report?.summary ?? null,
  };
}

function findLatest(pattern: RegExp) {
  const candidates = [REPORT_ROOT, '/tmp'].filter((dir) => fs.existsSync(dir));
  const latest = candidates
    .flatMap((dir) =>
      fs
        .readdirSync(dir)
        .filter((file) => pattern.test(file))
        .map((file) => ({
          file: path.join(dir, file),
          mtimeMs: fs.statSync(path.join(dir, file)).mtimeMs,
        })),
    )
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.file.localeCompare(a.file))[0];
  return latest?.file ?? null;
}

function readOptionalJson<T>(filePath: string | null) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function objectSummary(value: unknown) {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function numberSummary(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function booleanSummary(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value ?? 'unknown');
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function renderMarkdown(report: Record<string, any>) {
  const rows = Array.isArray(report.rows) ? report.rows : [];
  return [
    '# Essay Prompt Source Approval Monitor',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Review queue rows: ${report.summary.reviewQueueRows}`,
    `- Review action target rows: ${report.summary.reviewActionTargetRows}`,
    `- Approval request rows: ${report.summary.approvalRequestRows}`,
    `- Pending approval candidates: ${report.summary.writePlanPendingApprovalCandidates}`,
    `- Pending rows: ${report.summary.pendingRows}`,
    `- Approved source rows: ${report.summary.approvedSourceRows}`,
    `- Schema blocked: ${report.summary.writePlanSchemaBlocked ? 'yes' : 'no'}`,
    `- Consumer gate closed: ${report.summary.reviewActionConsumerGateClosed ? 'yes' : 'no'}`,
    `- Raw content stored: ${report.summary.rowsWithRawContent > 0 ? 'yes' : 'no'}`,
    '',
    '## Checks',
    '',
    '| Check | Status | Summary | Missing |',
    '| --- | --- | --- | --- |',
    ...report.checks.map(
      (check: CheckRow) =>
        `| ${escapeMarkdown(check.id)} | ${check.status} | ${escapeMarkdown(check.summary)} | ${escapeMarkdown(check.missing.join(', ') || 'none')} |`,
    ),
    '',
    '## Pending Approval Rows',
    '',
    `Showing ${Math.min(rows.length, 25)} of ${rows.length} hash-only rows.`,
    '',
    '| School | Prompt ID | Source Quality | Source URL | Schema Blocked |',
    '| --- | --- | --- | --- | --- |',
    ...(rows.length
      ? rows
          .slice(0, 25)
          .map(
            (row: MonitorRow) =>
              `| ${escapeMarkdown(row.schoolName)} | ${escapeMarkdown(row.essayPromptId)} | ${escapeMarkdown(row.sourceQuality)} | ${escapeMarkdown(row.sourceUrl)} | ${row.schemaBlocksWrite ? 'yes' : 'no'} |`,
          )
      : ['| none | n/a | n/a | n/a | n/a |']),
    '',
  ].join('\n');
}

function renderCsv(checks: CheckRow[], rows: MonitorRow[]) {
  const header = [
    'rowKind',
    'id',
    'status',
    'summary',
    'missing',
    'approvalRequestId',
    'essayPromptId',
    'schoolId',
    'schoolName',
    'applicationYear',
    'sourceType',
    'sourceQuality',
    'sourceUrl',
    'confidence',
    'rawContentSha256',
    'approvalRequired',
    'schemaBlocksWrite',
    'idempotencyKey',
  ];
  const checkRows = checks.map((check) =>
    [
      'check',
      check.id,
      check.status,
      check.summary,
      check.missing.join('; '),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]
      .map(csvCell)
      .join(','),
  );
  const monitorRows = rows.map((row) =>
    [
      'pending_approval',
      '',
      'pending_reviewer_and_schema_gate',
      row.consumerPolicy,
      '',
      row.approvalRequestId,
      row.essayPromptId,
      row.schoolId,
      row.schoolName,
      row.applicationYear ?? '',
      row.sourceType,
      row.sourceQuality,
      row.sourceUrl,
      row.confidence ?? '',
      row.rawContentSha256,
      row.approvalRequired ? 'true' : 'false',
      row.schemaBlocksWrite ? 'true' : 'false',
      row.idempotencyKey,
    ]
      .map(csvCell)
      .join(','),
  );
  return `${[header.join(','), ...checkRows, ...monitorRows].join('\n')}\n`;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeMarkdown(value: string) {
  return String(value ?? '').replace(/\|/g, '\\|');
}

function printSummary(args: Args, report: Record<string, any>) {
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        csv: args.csv,
        approvalRequestRows: report.summary.approvalRequestRows,
        pendingRows: report.summary.pendingRows,
        schemaBlocked: report.summary.writePlanSchemaBlocked,
        failedChecks: report.summary.failedChecks,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
