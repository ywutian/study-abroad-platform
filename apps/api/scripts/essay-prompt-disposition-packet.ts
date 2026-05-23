#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'ESSAY_PROMPT_DISPOSITION_READY'
  | 'BLOCKED_WORKLIST_MISSING'
  | 'BLOCKED_INPUT_ARTIFACT_INVALID'
  | 'BLOCKED_UNMAPPED_ESSAY_PROMPT_ROWS';
type ClosureState = 'trusted' | 'review' | 'source_search' | 'terminal';
type NextAction =
  | 'accept'
  | 'review'
  | 'source-search'
  | 'approved-write-workflow'
  | 'resolve-db-schema-then-write'
  | 'mark-terminal'
  | 'block-release';

interface Args {
  worklist: string | null;
  sourceRecovery: string | null;
  sourceValidation: string | null;
  sourceReviewStaging: string | null;
  sourceReviewApproval: string | null;
  sourceWritePlan: string | null;
  out: string;
  markdown: string;
  csv: string;
}

interface WorklistReport {
  generatedAt?: string;
  summary?: Record<string, unknown>;
  limits?: {
    requested?: number;
    emittedRows?: number;
    totalOpenRows?: number;
  };
  rows?: WorklistRow[];
}

interface WorklistRow {
  essayPromptId: string;
  schoolId: string | null;
  schoolName: string | null;
  usNewsRank: number | null;
  year: number | null;
  type: string;
  status: string;
  gap: string;
  bucket: string;
  action: string;
  severity: 'critical' | 'warning' | 'info';
  route: string;
  details?: {
    sourceCount?: number;
    sourceCandidates?: unknown[];
  };
}

interface GenericReport {
  generatedAt?: string;
  status?: string;
  artifactPath?: string | null;
  parseError?: string | null;
  summary?: Record<string, unknown>;
  rows?: any[];
  approvedSourceRows?: Array<{
    essayPromptId: string;
    schoolId?: string;
    schoolName?: string;
    sourceUrl?: string;
    sourceType?: string;
    confidence?: number;
    rawContentSha256?: string;
  }>;
  candidates?: Array<{
    essayPromptId: string;
    schoolId?: string;
    schoolName?: string;
    sourceUrl?: string;
    sourceType?: string;
    confidence?: number;
    rawContentSha256?: string;
  }>;
}

interface ArtifactSummary {
  path: string | null;
  found: boolean;
  generatedAt: string | null;
  status: string | null;
  error: string | null;
  summary: Record<string, unknown> | null;
}

interface SourcePipelineIndex {
  recoverySchoolIds: Set<string>;
  checkedSchoolIds: Set<string>;
  validatedPromptIds: Set<string>;
  stagedPromptIds: Set<string>;
  approvedPromptIds: Set<string>;
  writeCandidatePromptIds: Set<string>;
  writePlanStatus: string | null;
}

interface DispositionRow {
  essayPromptId: string;
  schoolId: string | null;
  schoolName: string | null;
  year: number | null;
  type: string;
  status: string;
  gap: string;
  action: string;
  severity: string;
  hasSourceRow: boolean;
  hasConfiguredOrCandidateSources: boolean;
  disposition: string;
  closureState: ClosureState | 'unmapped';
  nextAction: NextAction;
  sourcePipelineState: string;
  consumerPolicy: string;
  evidence: string[];
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
      path.join(REPORT_ROOT, `essay-prompt-disposition-${stamp}.json`),
    )!,
  );
  return {
    worklist:
      resolveArgPath(get('--worklist')) ??
      findLatest(/^essay-prompt-worklist-.+\.json$/),
    sourceRecovery:
      resolveArgPath(get('--source-recovery')) ??
      findLatest(/^essay-prompt-source-recovery-.+\.json$/),
    sourceValidation:
      resolveArgPath(get('--source-validation')) ??
      findLatest(/^essay-prompt-source-validation-.+\.json$/),
    sourceReviewStaging:
      resolveArgPath(get('--source-review-staging')) ??
      findLatest(/^essay-prompt-source-review-staging-.+\.json$/),
    sourceReviewApproval:
      resolveArgPath(get('--source-review-approval')) ??
      findLatest(/^essay-prompt-source-review-approval-.+\.json$/),
    sourceWritePlan:
      resolveArgPath(get('--source-write-plan')) ??
      findLatest(/^essay-prompt-source-write-plan-.+\.json$/),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
  };
}

function resolveArgPath(value: string | undefined) {
  return value ? path.resolve(API_ROOT, value) : null;
}

function main() {
  const args = parseArgs();
  if (!args.worklist || !fs.existsSync(args.worklist)) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-essay-prompt-disposition',
      status: 'BLOCKED_WORKLIST_MISSING' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      worklist: args.worklist,
      summary: {
        totalRows: 0,
        emittedRows: 0,
        allRowsHaveDisposition: false,
        unmappedRows: 0,
        blockedRows: 1,
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    process.exitCode = 1;
    return;
  }

  const worklist = readJson<WorklistReport>(args.worklist);
  const artifacts = {
    sourceRecovery: readOptionalReport(args.sourceRecovery),
    sourceValidation: readOptionalReport(args.sourceValidation),
    sourceReviewStaging: readOptionalReport(args.sourceReviewStaging),
    sourceReviewApproval: readOptionalReport(args.sourceReviewApproval),
    sourceWritePlan: readOptionalReport(args.sourceWritePlan),
  };
  const pipeline = buildPipelineIndex(artifacts);
  const rows = (worklist.rows ?? []).map((row) =>
    buildRow(row, pipeline, artifacts),
  );
  const totalRows = worklist.limits?.totalOpenRows ?? rows.length;
  const truncatedRows = Math.max(0, totalRows - rows.length);
  const unmappedRows = rows.filter((row) => row.closureState === 'unmapped');
  const artifactInputErrors = Object.entries(artifacts)
    .filter(
      ([, report]) => report?.status === 'BLOCKED_INPUT_ARTIFACT_PARSE_ERROR',
    )
    .map(([key, report]) => ({
      key,
      path: report?.artifactPath ?? null,
      error: report?.parseError ?? 'Unknown parse error',
    }));
  const blockedRows =
    unmappedRows.length + truncatedRows + artifactInputErrors.length;
  const status: PacketStatus =
    artifactInputErrors.length > 0
      ? 'BLOCKED_INPUT_ARTIFACT_INVALID'
      : blockedRows > 0
        ? 'BLOCKED_UNMAPPED_ESSAY_PROMPT_ROWS'
        : 'ESSAY_PROMPT_DISPOSITION_READY';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-disposition',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    worklist: path.relative(API_ROOT, args.worklist),
    worklistGeneratedAt: worklist.generatedAt ?? null,
    artifacts: Object.fromEntries(
      Object.entries(artifacts).map(([key, value]) => [
        key,
        summarizeArtifact(value),
      ]),
    ),
    summary: {
      totalRows,
      emittedRows: rows.length,
      allRowsHaveDisposition:
        unmappedRows.length === 0 &&
        truncatedRows === 0 &&
        artifactInputErrors.length === 0,
      unmappedRows: unmappedRows.length,
      blockedRows,
      truncatedRows,
      artifactInputErrors: artifactInputErrors.length,
      sourceGapRows: countWhere(
        rows,
        (row) => row.gap === 'source.rows_missing',
      ),
      auditLogReviewRows: countWhere(
        rows,
        (row) => row.gap === 'audit.log_missing',
      ),
      rawEvidenceReviewRows: countWhere(
        rows,
        (row) => row.gap === 'source.raw_content_missing',
      ),
      oldCycleTerminalRows: countWhere(
        rows,
        (row) => row.gap === 'prompt.not_current_year',
      ),
      approvedSourceRows: countWhere(rows, (row) =>
        row.disposition.includes('approved_source'),
      ),
      dbSchemaBlockedRows: countWhere(
        rows,
        (row) =>
          row.disposition === 'review_approved_source_blocked_by_db_schema',
      ),
      sourceSearchRows: countWhere(
        rows,
        (row) => row.closureState === 'source_search',
      ),
      reviewRows: countWhere(rows, (row) => row.closureState === 'review'),
      terminalRows: countWhere(rows, (row) => row.closureState === 'terminal'),
      trustedRows: countWhere(rows, (row) => row.closureState === 'trusted'),
      byGap: countBy(rows, (row) => row.gap),
      byAction: countBy(rows, (row) => row.action),
      byClosureState: countBy(rows, (row) => row.closureState),
      byDisposition: countBy(rows, (row) => row.disposition),
      topReviewGroups: topGroups(
        rows.filter((row) =>
          ['review', 'source_search', 'unmapped'].includes(row.closureState),
        ),
      ),
    },
    closureContract: {
      noPromptFactWrite:
        'This packet assigns dispositions only; prompt source rows still require approved DB write workflow.',
      noRawContentExport:
        'This packet intentionally omits raw source content and exports only prompt IDs, school labels, statuses, hashes/URLs through upstream artifacts.',
      publicConsumerPolicy:
        'Public essay and timeline consumers must stay source-gated; review/source-search rows remain hidden or weak-state until source rows are written.',
    },
    inputArtifactErrors: artifactInputErrors,
    nextCampaign: buildNextCampaign(rows, blockedRows, artifactInputErrors),
    rows,
  };
  writeReport(args, report);
  printSummary(args, report);
  if (blockedRows > 0) process.exitCode = 1;
}

function buildPipelineIndex(artifacts: Record<string, GenericReport | null>) {
  const index: SourcePipelineIndex = {
    recoverySchoolIds: new Set(),
    checkedSchoolIds: new Set(),
    validatedPromptIds: new Set(),
    stagedPromptIds: new Set(),
    approvedPromptIds: new Set(),
    writeCandidatePromptIds: new Set(),
    writePlanStatus: artifacts.sourceWritePlan?.status ?? null,
  };

  for (const row of artifacts.sourceRecovery?.rows ?? []) {
    if (typeof row.schoolId === 'string')
      index.recoverySchoolIds.add(row.schoolId);
  }
  for (const row of artifacts.sourceValidation?.rows ?? []) {
    if (typeof row.schoolId === 'string')
      index.checkedSchoolIds.add(row.schoolId);
    for (const promptId of arrayStrings(row.matchedPromptIds)) {
      index.validatedPromptIds.add(promptId);
    }
  }
  for (const row of artifacts.sourceReviewStaging?.rows ?? []) {
    for (const candidate of row.sourceRowCandidates ?? []) {
      if (typeof candidate.essayPromptId === 'string') {
        index.stagedPromptIds.add(candidate.essayPromptId);
      }
    }
  }
  for (const row of artifacts.sourceReviewApproval?.approvedSourceRows ?? []) {
    if (typeof row.essayPromptId === 'string') {
      index.approvedPromptIds.add(row.essayPromptId);
    }
  }
  for (const row of artifacts.sourceWritePlan?.candidates ?? []) {
    if (typeof row.essayPromptId === 'string') {
      index.writeCandidatePromptIds.add(row.essayPromptId);
    }
  }
  return index;
}

function buildRow(
  row: WorklistRow,
  pipeline: SourcePipelineIndex,
  artifacts: Record<string, GenericReport | null>,
): DispositionRow {
  const disposition = classifyDisposition(row, pipeline, artifacts);
  const closureState = closureStateFor(disposition);
  return {
    essayPromptId: row.essayPromptId,
    schoolId: row.schoolId,
    schoolName: row.schoolName,
    year: row.year,
    type: row.type,
    status: row.status,
    gap: row.gap,
    action: row.action,
    severity: row.severity,
    hasSourceRow: Number(row.details?.sourceCount ?? 0) > 0,
    hasConfiguredOrCandidateSources:
      Array.isArray(row.details?.sourceCandidates) &&
      row.details.sourceCandidates.length > 0,
    disposition,
    closureState,
    nextAction: nextActionFor(disposition),
    sourcePipelineState: sourcePipelineStateFor(disposition),
    consumerPolicy: consumerPolicyFor(disposition),
    evidence: evidenceFor(row, disposition, artifacts),
  };
}

function classifyDisposition(
  row: WorklistRow,
  pipeline: SourcePipelineIndex,
  artifacts: Record<string, GenericReport | null>,
) {
  if (row.gap === 'prompt.not_current_year') {
    return 'terminal_not_current_application_year';
  }
  if (row.gap === 'audit.log_missing') {
    return 'review_missing_prompt_audit_log';
  }
  if (row.gap === 'source.raw_content_missing') {
    return 'review_source_raw_content_missing';
  }
  if (row.gap !== 'source.rows_missing') return 'unmapped';

  if (pipeline.writeCandidatePromptIds.has(row.essayPromptId)) {
    return pipeline.writePlanStatus === 'DRY_RUN_WRITE_PLAN_READY'
      ? 'review_approved_source_write_plan_ready'
      : pipeline.writePlanStatus === 'BLOCKED_DB_SCHEMA_COMPATIBILITY'
        ? 'review_approved_source_blocked_by_db_schema'
        : 'review_approved_source_write_plan_blocked';
  }
  if (pipeline.approvedPromptIds.has(row.essayPromptId)) {
    return 'review_approved_source_needs_write_plan';
  }
  if (pipeline.stagedPromptIds.has(row.essayPromptId)) {
    return 'review_validated_source_staged_for_approval';
  }
  if (pipeline.validatedPromptIds.has(row.essayPromptId)) {
    return 'review_validated_source_candidate';
  }
  if (row.schoolId && pipeline.checkedSchoolIds.has(row.schoolId)) {
    return 'source_search_continue_after_validation_miss';
  }
  if (row.schoolId && pipeline.recoverySchoolIds.has(row.schoolId)) {
    return 'source_search_official_candidates_ranked';
  }
  if (artifacts.sourceRecovery?.status === 'SOURCE_RECOVERY_PACKET_READY') {
    return 'source_search_required_not_in_recovery_packet';
  }
  return 'source_search_required';
}

function closureStateFor(disposition: string): DispositionRow['closureState'] {
  if (disposition.startsWith('trusted_')) return 'trusted';
  if (disposition.startsWith('terminal_')) return 'terminal';
  if (disposition.startsWith('review_')) return 'review';
  if (disposition.startsWith('source_search_')) return 'source_search';
  return 'unmapped';
}

function nextActionFor(disposition: string): NextAction {
  switch (disposition) {
    case 'terminal_not_current_application_year':
      return 'mark-terminal';
    case 'review_approved_source_write_plan_ready':
      return 'approved-write-workflow';
    case 'review_approved_source_blocked_by_db_schema':
      return 'resolve-db-schema-then-write';
    case 'review_approved_source_write_plan_blocked':
    case 'review_approved_source_needs_write_plan':
    case 'review_validated_source_staged_for_approval':
    case 'review_validated_source_candidate':
    case 'review_missing_prompt_audit_log':
    case 'review_source_raw_content_missing':
      return 'review';
    case 'source_search_continue_after_validation_miss':
    case 'source_search_official_candidates_ranked':
    case 'source_search_required_not_in_recovery_packet':
    case 'source_search_required':
      return 'source-search';
    default:
      return 'block-release';
  }
}

function sourcePipelineStateFor(disposition: string) {
  if (disposition.includes('write_plan_ready'))
    return 'approved_write_plan_ready';
  if (disposition.includes('blocked_by_db_schema'))
    return 'approved_write_blocked_by_schema';
  if (disposition.includes('approved_source')) return 'approved_source_review';
  if (disposition.includes('staged')) return 'staged_for_review';
  if (disposition.includes('validated')) return 'validated_candidate';
  if (disposition.startsWith('source_search')) return 'source_search';
  if (disposition.startsWith('terminal')) return 'terminal';
  return 'review';
}

function consumerPolicyFor(disposition: string) {
  if (disposition === 'terminal_not_current_application_year') {
    return 'exclude_from_current_year_public_and_timeline_consumers';
  }
  if (disposition.includes('approved_source')) {
    return 'keep_hidden_until_source_row_write_is_executed_and_reaudited';
  }
  if (disposition.startsWith('review_')) {
    return 'admin_review_only_until_source_evidence_or_audit_log_is_closed';
  }
  if (disposition.startsWith('source_search_')) {
    return 'do_not_show_publicly_until_official_or_common_app_source_validates';
  }
  return 'blocked_until_disposition_mapping_added';
}

function evidenceFor(
  row: WorklistRow,
  disposition: string,
  artifacts: Record<string, GenericReport | null>,
) {
  return [
    'essay-prompt-worklist',
    `gap:${row.gap}`,
    `action:${row.action}`,
    `status:${row.status}`,
    `disposition:${disposition}`,
    ...(artifacts.sourceRecovery?.status
      ? [`sourceRecovery:${artifacts.sourceRecovery.status}`]
      : []),
    ...(artifacts.sourceValidation?.status
      ? [`sourceValidation:${artifacts.sourceValidation.status}`]
      : []),
    ...(artifacts.sourceReviewStaging?.status
      ? [`sourceReviewStaging:${artifacts.sourceReviewStaging.status}`]
      : []),
    ...(artifacts.sourceReviewApproval?.status
      ? [`sourceReviewApproval:${artifacts.sourceReviewApproval.status}`]
      : []),
    ...(artifacts.sourceWritePlan?.status
      ? [`sourceWritePlan:${artifacts.sourceWritePlan.status}`]
      : []),
  ];
}

function buildNextCampaign(
  rows: DispositionRow[],
  blockedRows: number,
  artifactInputErrors: Array<{
    key: string;
    path: string | null;
    error: string;
  }>,
) {
  if (artifactInputErrors.length > 0) {
    const first = artifactInputErrors[0];
    return {
      id: 'essay_prompt_input_artifact_rebuild',
      reason: `${artifactInputErrors.length} input artifact could not be parsed; rerun upstream packet ${first.key} before essay disposition.`,
      artifact: first.path,
      error: first.error,
    };
  }
  if (blockedRows > 0) {
    return {
      id: 'essay_prompt_disposition_mapping',
      reason: `${blockedRows} essay prompt rows are unmapped or truncated; add mappings before closure.`,
    };
  }
  const dbBlocked = rows.find(
    (row) => row.disposition === 'review_approved_source_blocked_by_db_schema',
  );
  if (dbBlocked) {
    return {
      id: 'database_schema_compatibility',
      reason:
        'Approved essay prompt source rows exist, but source-row writes remain blocked by DB schema compatibility.',
      schoolId: dbBlocked.schoolId,
      schoolName: dbBlocked.schoolName,
      recommendedAction: 'resolve-db-schema-compatibility-before-write',
    };
  }
  const sourceSearch = topGroups(
    rows.filter((row) => row.closureState === 'source_search'),
  )[0];
  if (sourceSearch) {
    return {
      id: 'essay_prompt_source_search',
      reason: `${sourceSearch.count} rows need source search in ${sourceSearch.key}.`,
      group: sourceSearch.key,
    };
  }
  const review = topGroups(
    rows.filter((row) => row.closureState === 'review'),
  )[0];
  if (review) {
    return {
      id: 'essay_prompt_review_queue',
      reason: `${review.count} rows need review in ${review.key}.`,
      group: review.key,
    };
  }
  return {
    id: 'essay_prompt_monitor',
    reason:
      'All essay prompt rows are trusted or terminal; rerun after source writes or new prompts.',
  };
}

function topGroups(rows: DispositionRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.gap}:${row.action}:${row.disposition}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, 12);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readOptionalReport(filePath: string | null): GenericReport | null {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const report = readJson<GenericReport>(filePath);
    return {
      ...report,
      artifactPath: path.relative(API_ROOT, filePath),
      parseError: null,
    };
  } catch (error) {
    return {
      artifactPath: path.relative(API_ROOT, filePath),
      status: 'BLOCKED_INPUT_ARTIFACT_PARSE_ERROR',
      parseError: error instanceof Error ? error.message : String(error),
      summary: {
        inputArtifactReadable: false,
      },
      rows: [],
    };
  }
}

function summarizeArtifact(report: GenericReport | null): ArtifactSummary {
  return {
    path: report?.artifactPath ?? null,
    found: Boolean(report),
    generatedAt: report?.generatedAt ?? null,
    status: report?.status ?? null,
    error: report?.parseError ?? null,
    summary: report?.summary ?? null,
  };
}

function findLatest(pattern: RegExp) {
  if (!fs.existsSync(REPORT_ROOT)) return null;
  const latest = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) => pattern.test(file))
    .map((file) => ({
      file,
      mtimeMs: fs.statSync(path.join(REPORT_ROOT, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.file.localeCompare(a.file))[0];
  return latest ? path.join(REPORT_ROOT, latest.file) : null;
}

function arrayStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function countWhere<T>(items: T[], predicate: (item: T) => boolean) {
  return items.filter(predicate).length;
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const summary = report.summary ?? {};
  const groups = Array.isArray(summary.topReviewGroups)
    ? summary.topReviewGroups
    : [];
  return [
    '# Essay Prompt Disposition Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Worklist: ${report.worklist ?? 'none'}`,
    '',
    '## Summary',
    '',
    `- Total rows: ${summary.totalRows ?? 0}`,
    `- Source gap rows: ${summary.sourceGapRows ?? 0}`,
    `- Source-search rows: ${summary.sourceSearchRows ?? 0}`,
    `- Review rows: ${summary.reviewRows ?? 0}`,
    `- DB-schema blocked rows: ${summary.dbSchemaBlockedRows ?? 0}`,
    `- Terminal old-cycle rows: ${summary.oldCycleTerminalRows ?? 0}`,
    `- Blocked rows: ${summary.blockedRows ?? 0}`,
    '',
    '## Contract',
    '',
    '- This packet is read-only and does not create `EssayPromptSource` rows.',
    '- It does not export raw source content.',
    '- Public and timeline consumers remain source-gated until source rows exist.',
    '',
    '## Top Review Groups',
    '',
    '| Group | Rows |',
    '| --- | ---: |',
    ...(groups.length
      ? groups.map(
          (group: any) => `| ${escapeMarkdown(group.key)} | ${group.count} |`,
        )
      : ['| None | 0 |']),
    '',
  ].join('\n');
}

function renderCsv(rows: DispositionRow[]) {
  const header = [
    'essayPromptId',
    'schoolId',
    'schoolName',
    'year',
    'type',
    'status',
    'gap',
    'action',
    'severity',
    'hasSourceRow',
    'hasConfiguredOrCandidateSources',
    'disposition',
    'closureState',
    'nextAction',
    'sourcePipelineState',
    'consumerPolicy',
  ];
  const lines = rows.map((row) =>
    [
      row.essayPromptId,
      row.schoolId ?? '',
      row.schoolName ?? '',
      row.year ?? '',
      row.type,
      row.status,
      row.gap,
      row.action,
      row.severity,
      row.hasSourceRow,
      row.hasConfiguredOrCandidateSources,
      row.disposition,
      row.closureState,
      row.nextAction,
      row.sourcePipelineState,
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
        totalRows: report.summary?.totalRows ?? 0,
        blockedRows: report.summary?.blockedRows ?? 0,
        byClosureState: report.summary?.byClosureState ?? {},
        byDisposition: report.summary?.byDisposition ?? {},
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
