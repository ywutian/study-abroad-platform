#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PlanStatus =
  | 'BLOCKED_APPROVAL_MISSING'
  | 'BLOCKED_APPROVAL_NOT_READY'
  | 'PASS_NO_APPROVED_SOURCE_ROWS'
  | 'BLOCKED_DUPLICATE_WRITE_CANDIDATES'
  | 'BLOCKED_DB_SCHEMA_COMPATIBILITY'
  | 'DRY_RUN_WRITE_PLAN_READY';

interface Args {
  approval: string | null;
  schemaWorklist: string | null;
  out: string;
  markdown: string;
  csv: string;
}

interface ApprovalReport {
  generatedAt?: string;
  status?: string;
  approvedForWriteWorkflow?: boolean;
  approvedSourceRows?: ApprovedSourceRow[];
  approvalRequestRows?: ApprovalRequestRow[];
  summary?: Record<string, unknown>;
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
  prismaCreateData: PrismaCreateData;
}

interface PrismaCreateData {
  essayPromptId: string;
  sourceType: string;
  sourceUrl: string;
  rawContent: string;
  confidence: number;
  scrapedAt: string | null;
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

interface SchemaWorklist {
  generatedAt?: string;
  status?: string;
  summary?: {
    missingTables?: number;
    missingColumns?: number;
    unappliedRepoMigrations?: number;
    appliedMigrationsMissingFromRepo?: number;
    extraDbTables?: number;
    extraDbColumns?: number;
  };
  rows?: unknown[];
}

interface WriteCandidate {
  essayPromptId: string;
  schoolId: string;
  schoolName: string;
  applicationYear: number | null;
  sourceType: string;
  sourceUrl: string;
  confidence: number;
  rawContentSha256: string;
  scrapedAt: string | null;
  reviewerId: string;
  approvedWorkflow: string;
  reviewedAt: string;
  evidenceSnippet: string | null;
  prismaCreateData: PrismaCreateData;
  idempotencyKey: string;
}

interface PendingApprovalWriteCandidate {
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
  approvalRequestId: string;
  approvalRequired: true;
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
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(REPORT_ROOT, `essay-prompt-source-write-plan-${stamp}.json`),
    )!,
  );
  const approval = get('--approval');
  const schemaWorklist = get('--schema-worklist');
  return {
    approval: approval
      ? path.resolve(API_ROOT, approval)
      : findLatestApproval(),
    schemaWorklist: schemaWorklist
      ? path.resolve(API_ROOT, schemaWorklist)
      : findLatestSchemaWorklist(),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
  };
}

function main() {
  const args = parseArgs();
  if (!args.approval || !fs.existsSync(args.approval)) {
    const report = buildReport(args, {
      status: 'BLOCKED_APPROVAL_MISSING',
      approval: null,
      schemaWorklist: readSchemaWorklist(args.schemaWorklist),
      candidates: [],
      duplicateKeys: [],
    });
    writeReport(args, report);
    printSummary(report);
    return;
  }

  const approval = JSON.parse(
    fs.readFileSync(args.approval, 'utf8'),
  ) as ApprovalReport;
  const schemaWorklist = readSchemaWorklist(args.schemaWorklist);
  const candidates = dedupeCandidates(approval.approvedSourceRows ?? []);
  const pendingApprovalCandidates = dedupePendingApprovalRequests(
    approval.approvalRequestRows ?? [],
    schemaBlocksWrites(schemaWorklist),
  );
  const duplicateKeys = findDuplicateKeys(approval.approvedSourceRows ?? []);
  const report = buildReport(args, {
    status: statusFor(approval, schemaWorklist, candidates, duplicateKeys),
    approval,
    schemaWorklist,
    candidates,
    pendingApprovalCandidates,
    duplicateKeys,
  });
  writeReport(args, report);
  printSummary(report);
}

function buildReport(
  args: Args,
  state: {
    status: PlanStatus;
    approval: ApprovalReport | null;
    schemaWorklist: ReturnType<typeof readSchemaWorklist>;
    candidates: WriteCandidate[];
    pendingApprovalCandidates?: PendingApprovalWriteCandidate[];
    duplicateKeys: string[];
  },
) {
  const schemaBlocked = schemaBlocksWrites(state.schemaWorklist);
  const pendingApprovalCandidates = state.pendingApprovalCandidates ?? [];
  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-source-approved-write-plan',
    status: state.status,
    destructiveDbWriteAllowedByThisPlan: false,
    approval: args.approval ? path.relative(API_ROOT, args.approval) : null,
    approvalGeneratedAt: state.approval?.generatedAt ?? null,
    approvalStatus: state.approval?.status ?? null,
    approvedForWriteWorkflow: state.approval?.approvedForWriteWorkflow ?? false,
    schemaWorklist: state.schemaWorklist,
    schemaBlocksWrites: schemaBlocked,
    summary: {
      approvedSourceRows: state.approval?.approvedSourceRows?.length ?? 0,
      uniqueWriteCandidates: state.candidates.length,
      duplicateWriteCandidateKeys: state.duplicateKeys.length,
      promptIds: Array.from(
        new Set(state.candidates.map((candidate) => candidate.essayPromptId)),
      ).length,
      sourceUrls: Array.from(
        new Set(state.candidates.map((candidate) => candidate.sourceUrl)),
      ).length,
      pendingApprovalRequestRows:
        state.approval?.approvalRequestRows?.length ?? 0,
      pendingApprovalUniqueCandidates: pendingApprovalCandidates.length,
      pendingApprovalPromptIds: Array.from(
        new Set(
          pendingApprovalCandidates.map((candidate) => candidate.essayPromptId),
        ),
      ).length,
      pendingApprovalSourceUrls: Array.from(
        new Set(
          pendingApprovalCandidates.map((candidate) => candidate.sourceUrl),
        ),
      ).length,
      pendingApprovalSchemaBlocked:
        schemaBlocked && pendingApprovalCandidates.length > 0,
      schemaWorklistStatus: state.schemaWorklist.status,
      schemaMissingTables: state.schemaWorklist.summary?.missingTables ?? null,
      schemaMissingColumns:
        state.schemaWorklist.summary?.missingColumns ?? null,
      unappliedRepoMigrations:
        state.schemaWorklist.summary?.unappliedRepoMigrations ?? null,
      appliedMigrationsMissingFromRepo:
        state.schemaWorklist.summary?.appliedMigrationsMissingFromRepo ?? null,
    },
    writeContract: writeContract(),
    pendingApprovalWriteContract: pendingApprovalWriteContract(),
    nextCampaign: nextCampaign(state.status, state),
    duplicateKeys: state.duplicateKeys,
    candidates: state.candidates,
    prismaCreateManyData: state.candidates.map(
      (candidate) => candidate.prismaCreateData,
    ),
    pendingApprovalCandidates,
    pendingApprovalPrismaCreateManyDataPreview: pendingApprovalCandidates.map(
      (candidate) => ({
        essayPromptId: candidate.essayPromptId,
        sourceType: candidate.sourceType,
        sourceUrl: candidate.sourceUrl,
        confidence: candidate.confidence,
        rawContentSha256: candidate.rawContentSha256,
        scrapedAt: candidate.scrapedAt,
      }),
    ),
  };
}

function statusFor(
  approval: ApprovalReport,
  schemaWorklist: ReturnType<typeof readSchemaWorklist>,
  candidates: WriteCandidate[],
  duplicateKeys: string[],
): PlanStatus {
  if (!approval.approvedForWriteWorkflow) return 'BLOCKED_APPROVAL_NOT_READY';
  if (candidates.length === 0) return 'PASS_NO_APPROVED_SOURCE_ROWS';
  if (duplicateKeys.length > 0) return 'BLOCKED_DUPLICATE_WRITE_CANDIDATES';
  if (schemaBlocksWrites(schemaWorklist)) {
    return 'BLOCKED_DB_SCHEMA_COMPATIBILITY';
  }
  return 'DRY_RUN_WRITE_PLAN_READY';
}

function dedupeCandidates(rows: ApprovedSourceRow[]): WriteCandidate[] {
  const seen = new Map<string, ApprovedSourceRow>();
  for (const row of rows) {
    const key = writeKey(row);
    if (!seen.has(key)) seen.set(key, row);
  }
  return Array.from(seen.values()).map((row) => ({
    essayPromptId: row.essayPromptId,
    schoolId: row.schoolId,
    schoolName: row.schoolName,
    applicationYear: row.applicationYear,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    confidence: row.confidence,
    rawContentSha256: row.rawContentSha256,
    scrapedAt: row.scrapedAt,
    reviewerId: row.reviewerId,
    approvedWorkflow: row.approvedWorkflow,
    reviewedAt: row.reviewedAt,
    evidenceSnippet: row.evidenceSnippet,
    prismaCreateData: row.prismaCreateData,
    idempotencyKey: writeKey(row),
  }));
}

function findDuplicateKeys(rows: ApprovedSourceRow[]) {
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = writeKey(row);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}

function dedupePendingApprovalRequests(
  rows: ApprovalRequestRow[],
  schemaBlocked: boolean,
): PendingApprovalWriteCandidate[] {
  const seen = new Map<string, ApprovalRequestRow>();
  for (const row of rows) {
    const key = writeKey(row);
    if (!seen.has(key)) seen.set(key, row);
  }
  return Array.from(seen.values()).map((row) => ({
    essayPromptId: row.essayPromptId,
    schoolId: row.schoolId,
    schoolName: row.schoolName,
    applicationYear: row.applicationYear,
    sourceType: row.sourceType,
    sourceQuality: row.sourceQuality,
    sourceUrl: row.sourceUrl,
    finalUrl: row.finalUrl,
    confidence: row.confidence,
    rawContentSha256: row.rawContentSha256,
    scrapedAt: row.scrapedAt,
    approvalRequestId: row.approvalRequestId,
    approvalRequired: true,
    schemaBlocksWrite: schemaBlocked,
    consumerPolicy: row.consumerPolicy,
    idempotencyKey: writeKey(row),
  }));
}

function writeKey(row: {
  essayPromptId: string;
  sourceType: string;
  sourceUrl: string;
}) {
  return `${row.essayPromptId}|${row.sourceType}|${row.sourceUrl}`;
}

function readSchemaWorklist(reportPath: string | null) {
  if (!reportPath) {
    return {
      reportFound: false,
      path: null,
      generatedAt: null,
      status: null,
      summary: null,
      rows: null,
      error: null,
    };
  }
  if (!fs.existsSync(reportPath)) {
    return {
      reportFound: false,
      path: reportPath,
      generatedAt: null,
      status: null,
      summary: null,
      rows: null,
      error: 'Schema worklist path does not exist',
    };
  }
  try {
    const parsed = JSON.parse(
      fs.readFileSync(reportPath, 'utf8'),
    ) as SchemaWorklist;
    return {
      reportFound: true,
      path: path.relative(API_ROOT, reportPath),
      generatedAt: parsed.generatedAt ?? null,
      status: parsed.status ?? null,
      summary: parsed.summary ?? null,
      rows: Array.isArray(parsed.rows) ? parsed.rows.length : null,
      error: null,
    };
  } catch (error) {
    return {
      reportFound: false,
      path: path.relative(API_ROOT, reportPath),
      generatedAt: null,
      status: null,
      summary: null,
      rows: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function schemaBlocksWrites(schema: ReturnType<typeof readSchemaWorklist>) {
  if (!schema.reportFound) return true;
  if (schema.status !== 'PASS') return true;
  const summary = schema.summary;
  if (!summary) return true;
  return (
    (summary.missingTables ?? 0) > 0 ||
    (summary.missingColumns ?? 0) > 0 ||
    (summary.unappliedRepoMigrations ?? 0) > 0 ||
    (summary.appliedMigrationsMissingFromRepo ?? 0) > 0
  );
}

function nextCampaign(
  status: PlanStatus,
  state: {
    schemaWorklist: ReturnType<typeof readSchemaWorklist>;
    candidates: WriteCandidate[];
    pendingApprovalCandidates?: PendingApprovalWriteCandidate[];
  },
) {
  if (status === 'BLOCKED_DB_SCHEMA_COMPATIBILITY') {
    return {
      id: 'database_schema_compatibility',
      reason: `Approved essay source rows are ready, but DB writes are blocked by schema worklist status ${state.schemaWorklist.status ?? 'missing'}.`,
      recommendedAction: 'resolve-db-schema-compatibility-before-write',
    };
  }
  if (status === 'DRY_RUN_WRITE_PLAN_READY') {
    const [top] = state.candidates;
    return {
      id: 'essay_prompt_source_controlled_write',
      reason: `${state.candidates.length} approved source rows have a dry-run write plan; execute only through an approved write command/workflow.`,
      schoolId: top?.schoolId ?? null,
      schoolName: top?.schoolName ?? null,
      recommendedAction: 'execute-approved-source-row-write-workflow',
    };
  }
  if (status === 'BLOCKED_APPROVAL_NOT_READY') {
    const [topPending] = state.pendingApprovalCandidates ?? [];
    return {
      id: 'essay_prompt_source_review_approval',
      reason: topPending
        ? `${state.pendingApprovalCandidates?.length ?? 0} source rows are staged as non-writeable approval requests; reviewer approval inputs must be completed before write planning.`
        : 'Approval artifact is present but not approved for write workflow.',
      schoolId: topPending?.schoolId ?? null,
      schoolName: topPending?.schoolName ?? null,
      sourceUrl: topPending?.sourceUrl ?? null,
      recommendedAction: topPending
        ? 'complete-review-approval-inputs-before-write-plan'
        : 'complete-review-approval-inputs',
    };
  }
  if (status === 'BLOCKED_DUPLICATE_WRITE_CANDIDATES') {
    return {
      id: 'essay_prompt_source_write_dedupe',
      reason: 'Approved source rows contain duplicate write keys.',
      recommendedAction: 'dedupe-approved-source-row-candidates',
    };
  }
  return {
    id: 'essay_prompt_source_review_approval',
    reason: 'No approved source rows are available for write planning.',
    recommendedAction: 'continue-source-review-approval',
  };
}

function writeContract() {
  return {
    writeTarget: 'EssayPromptSource',
    destructiveDbWriteAllowedByThisPlan: false,
    requiredBeforeLiveWrite: [
      'database_schema_compatibility PASS',
      'approved write workflow or admin command outside this read-only planner',
      'idempotency check for existing EssayPromptSource rows by essayPromptId/sourceType/sourceUrl',
      'post-write platform audit showing sourceBackedVerifiedCurrent increased',
      'public/timeline source-gated consumer checks still pass',
    ],
    prohibitedActions: [
      'do not run Prisma writes from this script',
      'do not bypass DB schema compatibility blockers',
      'do not mark essay prompt closure passed until DB rows exist and audit confirms consumption',
    ],
  };
}

function pendingApprovalWriteContract() {
  return {
    writeTarget: 'EssayPromptSource',
    approvalRequired: true,
    destructiveDbWriteAllowedByThisPlan: false,
    candidateStatus: 'non-writeable approval-request preview',
    rawContentPolicy:
      'approval request rows carry rawContentSha256 and snippets only; rawContent is intentionally unavailable until the approval gate emits approvedSourceRows',
    requiredBeforeLiveWrite: [
      'reviewer decision approve-reviewed-sources',
      'reviewer ID and approved workflow ID',
      'exact APPROVED_ESSAY_PROMPT_SOURCE_REVIEW acknowledgement',
      'source-family, cycle-year, raw-snapshot, prompt-field, and no-conflict confirmations',
      'database_schema_compatibility PASS',
      'approved write workflow or admin command outside this read-only planner',
    ],
    prohibitedActions: [
      'do not treat approvalRequestRows as approvedSourceRows',
      'do not synthesize rawContent from snippets or hashes',
      'do not run Prisma writes from pending approval candidates',
      'do not expose public/timeline/chat/prediction/application-analysis consumers before DB source rows exist and audit is re-run',
    ],
  };
}

function findLatestApproval() {
  if (!fs.existsSync(REPORT_ROOT)) return null;
  const latest = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) =>
      /^essay-prompt-source-review-approval-.+\.json$/.test(file),
    )
    .map((file) => ({
      file,
      mtimeMs: fs.statSync(path.join(REPORT_ROOT, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return latest ? path.join(REPORT_ROOT, latest.file) : null;
}

function findLatestSchemaWorklist() {
  if (!fs.existsSync(REPORT_ROOT)) return null;
  const latest = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) =>
      /^database-schema-compatibility-worklist-.+\.json$/.test(file),
    )
    .map((file) => ({
      file,
      mtimeMs: fs.statSync(path.join(REPORT_ROOT, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return latest ? path.join(REPORT_ROOT, latest.file) : null;
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(
    args.csv,
    renderCsv(report.candidates ?? [], report.pendingApprovalCandidates ?? []),
    'utf8',
  );
}

function renderMarkdown(report: Record<string, any>) {
  const candidates = Array.isArray(report.candidates)
    ? (report.candidates as WriteCandidate[])
    : [];
  const pendingApprovalCandidates = Array.isArray(
    report.pendingApprovalCandidates,
  )
    ? (report.pendingApprovalCandidates as PendingApprovalWriteCandidate[])
    : [];
  const lines = [
    '# Essay Prompt Source Approved Write Plan',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Schema blocks writes: ${report.schemaBlocksWrites ? 'yes' : 'no'}`,
    `Destructive DB write allowed: ${report.destructiveDbWriteAllowedByThisPlan ? 'yes' : 'no'}`,
    '',
    '## Summary',
    '',
    `- Approved source rows: ${report.summary?.approvedSourceRows ?? 0}`,
    `- Unique write candidates: ${report.summary?.uniqueWriteCandidates ?? 0}`,
    `- Pending approval request rows: ${report.summary?.pendingApprovalRequestRows ?? 0}`,
    `- Pending approval unique candidates: ${report.summary?.pendingApprovalUniqueCandidates ?? 0}`,
    `- Pending approval prompt IDs: ${report.summary?.pendingApprovalPromptIds ?? 0}`,
    `- Pending approval source URLs: ${report.summary?.pendingApprovalSourceUrls ?? 0}`,
    `- Pending approval schema blocked: ${report.summary?.pendingApprovalSchemaBlocked ? 'yes' : 'no'}`,
    `- Schema worklist status: ${report.summary?.schemaWorklistStatus ?? 'missing'}`,
    `- Missing tables: ${report.summary?.schemaMissingTables ?? 'unknown'}`,
    `- Missing columns: ${report.summary?.schemaMissingColumns ?? 'unknown'}`,
    '',
    '## Guardrails',
    '',
    '- This artifact is a dry-run write plan only.',
    '- It cannot approve writes while database schema compatibility is blocked.',
    '- After a later write workflow, rerun platform audit and essay worklist to prove closure.',
    '',
    '## Write Candidates',
    '',
    '| School | Prompt ID | Source Type | Confidence | Source |',
    '| --- | --- | --- | ---: | --- |',
    ...(candidates.length
      ? candidates.map(
          (candidate) =>
            `| ${escapeMarkdown(candidate.schoolName)} | ${candidate.essayPromptId} | ${candidate.sourceType} | ${candidate.confidence} | ${escapeMarkdown(candidate.sourceUrl)} |`,
        )
      : ['| None | n/a | n/a | 0 | n/a |']),
    '',
    '## Pending Approval Candidates',
    '',
    'These rows are reviewer handoff previews only. They are not approved source rows and are not writeable.',
    '',
    '| School | Prompt ID | Source Quality | Confidence | Schema Blocked | Source |',
    '| --- | --- | --- | ---: | --- | --- |',
    ...(pendingApprovalCandidates.length
      ? pendingApprovalCandidates.map(
          (candidate) =>
            `| ${escapeMarkdown(candidate.schoolName)} | ${candidate.essayPromptId} | ${candidate.sourceQuality} | ${candidate.confidence} | ${candidate.schemaBlocksWrite ? 'yes' : 'no'} | ${escapeMarkdown(candidate.sourceUrl)} |`,
        )
      : ['| None | n/a | n/a | 0 | n/a | n/a |']),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderCsv(
  candidates: WriteCandidate[],
  pendingApprovalCandidates: PendingApprovalWriteCandidate[],
) {
  const header = [
    'rowKind',
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
    'approvalRequestId',
    'approvalRequired',
    'schemaBlocksWrite',
    'idempotencyKey',
  ];
  const approvedLines = candidates.map((candidate) =>
    [
      'approved_write_candidate',
      candidate.essayPromptId,
      candidate.schoolId,
      candidate.schoolName,
      candidate.applicationYear ?? '',
      candidate.sourceType,
      candidate.sourceUrl,
      candidate.confidence,
      candidate.rawContentSha256,
      candidate.scrapedAt ?? '',
      candidate.reviewerId,
      candidate.approvedWorkflow,
      candidate.reviewedAt,
      '',
      false,
      false,
      candidate.idempotencyKey,
    ]
      .map(csvCell)
      .join(','),
  );
  const pendingLines = pendingApprovalCandidates.map((candidate) =>
    [
      'pending_approval_non_writeable',
      candidate.essayPromptId,
      candidate.schoolId,
      candidate.schoolName,
      candidate.applicationYear ?? '',
      candidate.sourceType,
      candidate.sourceUrl,
      candidate.confidence,
      candidate.rawContentSha256,
      candidate.scrapedAt ?? '',
      '',
      '',
      '',
      candidate.approvalRequestId,
      candidate.approvalRequired,
      candidate.schemaBlocksWrite,
      candidate.idempotencyKey,
    ]
      .map(csvCell)
      .join(','),
  );
  return `${[header.join(','), ...approvedLines, ...pendingLines].join('\n')}\n`;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, '\\|');
}

function printSummary(report: Record<string, any>) {
  console.log(`Essay prompt source write plan status: ${report.status}`);
  console.log(
    `Unique write candidates: ${report.summary?.uniqueWriteCandidates ?? 0}`,
  );
  console.log(
    `Schema worklist status: ${report.summary?.schemaWorklistStatus ?? 'missing'}`,
  );
  console.log(
    `Destructive DB write allowed: ${report.destructiveDbWriteAllowedByThisPlan ? 'yes' : 'no'}`,
  );
}

main();
