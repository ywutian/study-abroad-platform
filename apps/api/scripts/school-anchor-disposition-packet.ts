#!/usr/bin/env tsx
import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'SCHOOL_ANCHOR_DISPOSITION_READY'
  | 'BLOCKED_WORKLIST_MISSING'
  | 'BLOCKED_UNMAPPED_SCHOOL_ANCHOR_ROWS';
type WorklistAction =
  | 'trusted-closed'
  | 'terminal-accepted'
  | 'source-candidate-review'
  | 'legacy-provenance-review'
  | 'heuristic-review'
  | 'terminal-review'
  | 'needs-source-search';
type WorklistBucket =
  | 'trusted'
  | 'secondary'
  | 'heuristic'
  | 'terminal'
  | 'legacy'
  | 'open'
  | 'missing';
type ClosureState = 'trusted' | 'review' | 'source_search' | 'terminal';
type SourceQuality =
  | 'official_or_secondary'
  | 'candidate_evidence_review'
  | 'legacy_value_review'
  | 'heuristic_review'
  | 'source_search_required'
  | 'terminal';
type NextAction =
  | 'accept'
  | 'review'
  | 'source-search'
  | 'mark-terminal'
  | 'block-release';

interface Args {
  worklist: string | null;
  out: string;
  markdown: string;
  csv: string;
}

interface CandidateEvidence {
  file: string;
  fields: string[];
  sourceUrl: string | null;
  status: string | null;
  reason: string | null;
}

interface WorklistRow {
  schoolId: string;
  schoolName: string;
  nameNorm: string;
  usNewsRank: number | null;
  field: string;
  value: unknown;
  bucket: WorklistBucket;
  action: WorklistAction;
  status: string | null;
  source: string | null;
  sourceUrl: string | null;
  terminalReason: string | null;
  candidateEvidence: CandidateEvidence[];
}

interface WorklistReport {
  generatedAt?: string;
  mode?: string;
  fields?: string[];
  limits?: {
    requested?: number;
    emittedRows?: number;
    totalOpenRows?: number;
  };
  summary?: Record<string, unknown>;
  rows?: WorklistRow[];
}

interface DispositionRow {
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  field: string;
  bucket: WorklistBucket;
  action: WorklistAction;
  status: string | null;
  hasValue: boolean;
  hasSourceUrl: boolean;
  hasCandidateEvidence: boolean;
  candidateEvidenceCount: number;
  disposition: string;
  closureState: ClosureState | 'unmapped';
  nextAction: NextAction;
  sourceQuality: SourceQuality | 'unknown';
  consumerPolicy: string;
  evidence: string[];
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const PREDICTION_CRITICAL_FIELDS = new Set([
  'acceptanceRate',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'transferAcceptanceRate',
  'edAcceptanceRate',
  'eaAcceptanceRate',
  'sat25',
  'sat75',
  'act25',
  'act75',
  'gpaDistribution',
]);
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
      path.join(REPORT_ROOT, `school-anchor-disposition-${stamp}.json`),
    )!,
  );
  const worklist = get('--worklist');
  return {
    worklist: worklist
      ? path.resolve(API_ROOT, worklist)
      : findLatest(/^school-anchor-worklist-.+\.json$/),
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
  if (!args.worklist || !fs.existsSync(args.worklist)) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-school-anchor-disposition',
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
  const rows = (worklist.rows ?? []).map(buildRow);
  const totalRows = worklist.limits?.totalOpenRows ?? rows.length;
  const truncatedRows = Math.max(0, totalRows - rows.length);
  const unmappedRows = rows.filter((row) => row.closureState === 'unmapped');
  const blockedRows = unmappedRows.length + truncatedRows;
  const status: PacketStatus =
    blockedRows > 0
      ? 'BLOCKED_UNMAPPED_SCHOOL_ANCHOR_ROWS'
      : 'SCHOOL_ANCHOR_DISPOSITION_READY';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-school-anchor-disposition',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    worklist: path.relative(API_ROOT, args.worklist),
    worklistGeneratedAt: worklist.generatedAt ?? null,
    fields: worklist.fields ?? [],
    limits: {
      requested: worklist.limits?.requested ?? null,
      worklistEmittedRows: worklist.limits?.emittedRows ?? rows.length,
      totalOpenRows: totalRows,
      truncatedRows,
    },
    summary: {
      totalRows,
      emittedRows: rows.length,
      allRowsHaveDisposition: unmappedRows.length === 0 && truncatedRows === 0,
      unmappedRows: unmappedRows.length,
      blockedRows,
      truncatedRows,
      candidateEvidenceRows: countWhere(
        rows,
        (row) => row.hasCandidateEvidence,
      ),
      candidateReviewRows: countWhere(
        rows,
        (row) => row.action === 'source-candidate-review',
      ),
      needsSourceSearchRows: countWhere(
        rows,
        (row) => row.action === 'needs-source-search',
      ),
      heuristicReviewRows: countWhere(
        rows,
        (row) => row.action === 'heuristic-review',
      ),
      legacyReviewRows: countWhere(
        rows,
        (row) => row.action === 'legacy-provenance-review',
      ),
      terminalReviewRows: countWhere(
        rows,
        (row) => row.action === 'terminal-review',
      ),
      trustedRows: countWhere(rows, (row) => row.closureState === 'trusted'),
      terminalRows: countWhere(rows, (row) => row.closureState === 'terminal'),
      reviewRows: countWhere(rows, (row) => row.closureState === 'review'),
      sourceSearchRows: countWhere(
        rows,
        (row) => row.closureState === 'source_search',
      ),
      openMissingCriticalRows: countWhere(
        rows,
        (row) =>
          PREDICTION_CRITICAL_FIELDS.has(row.field) &&
          ['open', 'missing'].includes(row.bucket),
      ),
      byAction: countBy(rows, (row) => row.action),
      byField: countBy(rows, (row) => row.field),
      byClosureState: countBy(rows, (row) => row.closureState),
      byDisposition: countBy(rows, (row) => row.disposition),
      topReviewGroups: topGroups(
        rows.filter((row) =>
          ['review', 'source_search', 'unmapped'].includes(row.closureState),
        ),
      ),
    },
    closureContract: {
      noFactWrite:
        'This packet converts school anchor worklist rows into review dispositions only; candidate evidence is not accepted as a fact.',
      predictionConsumption:
        'Prediction and application-analysis consumers may use trusted/terminal anchors according to provenance policy; review/source-search rows stay weak-state or blocked from confident claims.',
      prohibitedActions: [
        'do not publish source-candidate-review rows without reviewer approval',
        'do not promote heuristic or legacy values to official facts',
        'do not overwrite higher-quality provenance with candidate evidence',
        'do not treat needs-source-search rows as terminal',
      ],
    },
    nextCampaign: buildNextCampaign(rows, blockedRows),
    rows,
  };
  writeReport(args, report);
  printSummary(args, report);
  if (blockedRows > 0) process.exitCode = 1;
}

function buildRow(row: WorklistRow): DispositionRow {
  const candidateEvidence = row.candidateEvidence ?? [];
  const disposition = classifyDisposition(row);
  const closureState = closureStateFor(disposition);
  return {
    schoolId: row.schoolId,
    schoolName: row.schoolName,
    usNewsRank: row.usNewsRank,
    field: row.field,
    bucket: row.bucket,
    action: row.action,
    status: row.status,
    hasValue: hasValue(row.value),
    hasSourceUrl: Boolean(row.sourceUrl && row.sourceUrl.trim()),
    hasCandidateEvidence: candidateEvidence.length > 0,
    candidateEvidenceCount: candidateEvidence.length,
    disposition,
    closureState,
    nextAction: nextActionFor(disposition),
    sourceQuality: sourceQualityFor(disposition),
    consumerPolicy: consumerPolicyFor(disposition),
    evidence: evidenceFor(row, disposition),
  };
}

function classifyDisposition(row: WorklistRow) {
  switch (row.action) {
    case 'trusted-closed':
      return 'trusted_source_closed';
    case 'terminal-accepted':
      return 'terminal_source_not_public_or_not_applicable';
    case 'source-candidate-review':
      return 'review_candidate_evidence_before_publish';
    case 'legacy-provenance-review':
      return 'review_legacy_value_missing_audit_grade_provenance';
    case 'heuristic-review':
      return 'review_heuristic_anchor_before_confident_consumption';
    case 'terminal-review':
      return 'review_terminal_status_before_acceptance';
    case 'needs-source-search':
      return 'source_search_required';
    default:
      return 'unmapped';
  }
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
    case 'trusted_source_closed':
      return 'accept';
    case 'terminal_source_not_public_or_not_applicable':
      return 'mark-terminal';
    case 'source_search_required':
      return 'source-search';
    case 'review_candidate_evidence_before_publish':
    case 'review_legacy_value_missing_audit_grade_provenance':
    case 'review_heuristic_anchor_before_confident_consumption':
    case 'review_terminal_status_before_acceptance':
      return 'review';
    default:
      return 'block-release';
  }
}

function sourceQualityFor(
  disposition: string,
): DispositionRow['sourceQuality'] {
  switch (disposition) {
    case 'trusted_source_closed':
      return 'official_or_secondary';
    case 'terminal_source_not_public_or_not_applicable':
      return 'terminal';
    case 'review_candidate_evidence_before_publish':
      return 'candidate_evidence_review';
    case 'review_legacy_value_missing_audit_grade_provenance':
      return 'legacy_value_review';
    case 'review_heuristic_anchor_before_confident_consumption':
      return 'heuristic_review';
    case 'review_terminal_status_before_acceptance':
      return 'terminal';
    case 'source_search_required':
      return 'source_search_required';
    default:
      return 'unknown';
  }
}

function consumerPolicyFor(disposition: string) {
  switch (disposition) {
    case 'trusted_source_closed':
      return 'prediction_and_school_pages_allowed_with_provenance';
    case 'terminal_source_not_public_or_not_applicable':
      return 'safe_to_suppress_confident_claims_and_show_terminal_state';
    case 'source_search_required':
      return 'do_not_use_for_confident_prediction_claims_until_sourced';
    case 'review_candidate_evidence_before_publish':
      return 'review_queue_only_candidate_evidence_not_a_fact';
    case 'review_legacy_value_missing_audit_grade_provenance':
      return 'weak_state_only_until_provenance_backfilled_or_terminal';
    case 'review_heuristic_anchor_before_confident_consumption':
      return 'heuristic_weak_state_only_with_visible_uncertainty';
    case 'review_terminal_status_before_acceptance':
      return 'manual_terminal_review_before_closure';
    default:
      return 'blocked_until_disposition_mapping_added';
  }
}

function evidenceFor(row: WorklistRow, disposition: string) {
  return [
    'school-anchor-closure-worklist',
    `field:${row.field}`,
    `action:${row.action}`,
    `bucket:${row.bucket}`,
    `disposition:${disposition}`,
    ...(row.status ? [`status:${row.status}`] : []),
    ...(row.sourceUrl ? ['sourceUrl:present'] : []),
    ...(row.terminalReason ? [`terminalReason:${row.terminalReason}`] : []),
    ...((row.candidateEvidence ?? []).length > 0
      ? [`candidateEvidence:${row.candidateEvidence.length}`]
      : []),
  ];
}

function buildNextCampaign(rows: DispositionRow[], blockedRows: number) {
  if (blockedRows > 0) {
    return {
      id: 'school_anchor_disposition_mapping',
      reason: `${blockedRows} school anchor rows are unmapped or truncated; rerun the worklist with a higher limit or add action mappings.`,
    };
  }
  const sourceSearch = topGroups(
    rows.filter((row) => row.closureState === 'source_search'),
  )[0];
  if (sourceSearch) {
    return {
      id: 'school_anchor_official_source_search',
      reason: `${sourceSearch.count} rows need official source search in ${sourceSearch.key}.`,
      group: sourceSearch.key,
    };
  }
  const review = topGroups(
    rows.filter((row) => row.closureState === 'review'),
  )[0];
  if (review) {
    return {
      id: 'school_anchor_review_queue',
      reason: `${review.count} rows need candidate, heuristic, legacy, or terminal review in ${review.key}.`,
      group: review.key,
    };
  }
  return {
    id: 'school_anchor_monitor',
    reason:
      'All school anchor worklist rows have trusted or terminal dispositions; rerun after new school-data imports.',
  };
}

function topGroups(rows: DispositionRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.field}:${row.action}:${row.disposition}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, 12);
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
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
    '# School Anchor Disposition Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Worklist: ${report.worklist ?? 'none'}`,
    '',
    '## Summary',
    '',
    `- Total rows: ${summary.totalRows ?? 0}`,
    `- Emitted rows: ${summary.emittedRows ?? 0}`,
    `- Blocked rows: ${summary.blockedRows ?? 0}`,
    `- Review rows: ${summary.reviewRows ?? 0}`,
    `- Source-search rows: ${summary.sourceSearchRows ?? 0}`,
    `- Candidate evidence rows: ${summary.candidateEvidenceRows ?? 0}`,
    `- Heuristic review rows: ${summary.heuristicReviewRows ?? 0}`,
    `- Legacy review rows: ${summary.legacyReviewRows ?? 0}`,
    '',
    '## Contract',
    '',
    '- This packet is read-only and does not write school facts.',
    '- Candidate evidence is review input only, not accepted data.',
    '- Prediction and application-analysis consumers must treat review/source-search rows as weak states.',
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
    'schoolId',
    'schoolName',
    'usNewsRank',
    'field',
    'bucket',
    'action',
    'status',
    'hasValue',
    'hasSourceUrl',
    'hasCandidateEvidence',
    'candidateEvidenceCount',
    'disposition',
    'closureState',
    'nextAction',
    'sourceQuality',
    'consumerPolicy',
  ];
  const lines = rows.map((row) =>
    [
      row.schoolId,
      row.schoolName,
      row.usNewsRank ?? '',
      row.field,
      row.bucket,
      row.action,
      row.status ?? '',
      row.hasValue,
      row.hasSourceUrl,
      row.hasCandidateEvidence,
      row.candidateEvidenceCount,
      row.disposition,
      row.closureState,
      row.nextAction,
      row.sourceQuality,
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
        worklist: report.worklist,
        totalRows: report.summary?.totalRows ?? 0,
        emittedRows: report.summary?.emittedRows ?? 0,
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
