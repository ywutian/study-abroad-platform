#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'SCHOOL_MEDIA_DISPOSITION_READY'
  | 'BLOCKED_WORKLIST_MISSING'
  | 'BLOCKED_UNMAPPED_MEDIA_ROWS';
type ClosureState =
  'trusted' | 'review' | 'source_search' | 'terminal' | 'conflict';
type NextAction =
  | 'accept'
  | 'review-media'
  | 'source-search'
  | 'retry-discovery'
  | 'mark-terminal'
  | 'resolve-conflict';

interface Args {
  worklist: string | null;
  out: string;
  markdown: string;
  csv: string;
}

interface WorklistRow {
  schoolId?: string;
  schoolName?: string;
  usNewsRank?: number | null;
  assetId?: string | null;
  gap?: string;
  bucket?: string;
  action?: string;
  severity?: string;
  route?: string;
  details?: Record<string, unknown>;
}

interface DispositionRow {
  schoolId: string | null;
  schoolName: string | null;
  usNewsRank: number | null;
  assetId: string | null;
  gap: string | null;
  action: string | null;
  severity: string | null;
  disposition: string;
  closureState: ClosureState | 'unmapped';
  nextAction: NextAction;
  consumerPolicy: string;
  evidence: string[];
  route: string | null;
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
      path.join(REPORT_ROOT, `school-media-disposition-${stamp}.json`),
    )!,
  );
  const worklist = get('--worklist');
  return {
    worklist: worklist
      ? path.resolve(API_ROOT, worklist)
      : findLatest(/^school-media-worklist-.+\.json$/),
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
  const source = readWorklist(args.worklist);
  if (!source.found) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-school-media-disposition',
      status: 'BLOCKED_WORKLIST_MISSING' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      summary: {
        totalRows: 0,
        emittedRows: 0,
        allRowsHaveDisposition: false,
        blockedRows: 1,
        unmappedRows: 0,
      },
      source,
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    process.exitCode = 1;
    return;
  }

  const rows = source.rows.map(buildDispositionRow);
  const unmappedRows = rows.filter((row) => row.closureState === 'unmapped');
  const status: PacketStatus =
    unmappedRows.length > 0
      ? 'BLOCKED_UNMAPPED_MEDIA_ROWS'
      : 'SCHOOL_MEDIA_DISPOSITION_READY';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-school-media-disposition',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    source,
    summary: {
      totalRows: source.rows.length,
      emittedRows: rows.length,
      allRowsHaveDisposition: unmappedRows.length === 0,
      blockedRows: unmappedRows.length,
      unmappedRows: unmappedRows.length,
      trustedRows: countWhere(rows, (row) => row.closureState === 'trusted'),
      reviewRows: countWhere(rows, (row) => row.closureState === 'review'),
      sourceSearchRows: countWhere(
        rows,
        (row) => row.closureState === 'source_search',
      ),
      terminalRows: countWhere(rows, (row) => row.closureState === 'terminal'),
      conflictRows: countWhere(rows, (row) => row.closureState === 'conflict'),
      byGap: countBy(rows, (row) => row.gap ?? 'unknown'),
      byAction: countBy(rows, (row) => row.action ?? 'unknown'),
      byClosureState: countBy(rows, (row) => row.closureState),
      byDisposition: countBy(rows, (row) => row.disposition),
    },
    closureContract: {
      noDbWrites:
        'This packet is read-only. It does not approve, reject, upload, fetch, or write media assets.',
      consumerPolicy:
        'School cards/detail pages must keep using placeholders or weak-state fallbacks until an approved primary campus cover exists.',
      evidencePolicy:
        'Website URLs and candidate asset metadata are source-search hints only; they are not approved media provenance.',
    },
    nextCampaign: buildNextCampaign(rows),
    rows,
  };
  writeReport(args, report);
  printSummary(args, report);
  if (unmappedRows.length > 0) process.exitCode = 1;
}

function buildDispositionRow(row: WorklistRow): DispositionRow {
  const action = stringOrNull(row.action);
  const disposition = classifyDisposition(action);
  return {
    schoolId: stringOrNull(row.schoolId),
    schoolName: stringOrNull(row.schoolName),
    usNewsRank: typeof row.usNewsRank === 'number' ? row.usNewsRank : null,
    assetId: stringOrNull(row.assetId),
    gap: stringOrNull(row.gap),
    action,
    severity: stringOrNull(row.severity),
    disposition,
    closureState: closureStateFor(disposition),
    nextAction: nextActionFor(disposition),
    consumerPolicy: consumerPolicyFor(disposition),
    evidence: evidenceFor(row, disposition),
    route: stringOrNull(row.route),
  };
}

function classifyDisposition(action: string | null) {
  switch (action) {
    case 'trusted-closed':
      return 'trusted_approved_primary_media';
    case 'discover-media':
      return 'source_search_primary_campus_cover_required';
    case 'review-media-candidate':
      return 'review_candidate_media_before_approval';
    case 'source-evidence-review':
      return 'review_media_provenance_or_license';
    case 'fix-primary-conflict':
      return 'conflict_multiple_primary_media';
    case 'retry-discovery':
      return 'terminal_or_retry_failed_media_discovery';
    case 'terminal-accepted':
      return 'terminal_media_gap_accepted';
    default:
      return 'unmapped';
  }
}

function closureStateFor(disposition: string): DispositionRow['closureState'] {
  if (disposition.startsWith('trusted_')) return 'trusted';
  if (disposition.startsWith('source_search_')) return 'source_search';
  if (disposition.startsWith('review_')) return 'review';
  if (disposition.startsWith('terminal_')) return 'terminal';
  if (disposition.startsWith('conflict_')) return 'conflict';
  return 'unmapped';
}

function nextActionFor(disposition: string): NextAction {
  switch (closureStateFor(disposition)) {
    case 'trusted':
      return 'accept';
    case 'source_search':
      return 'source-search';
    case 'review':
      return 'review-media';
    case 'terminal':
      return disposition.includes('retry')
        ? 'retry-discovery'
        : 'mark-terminal';
    case 'conflict':
      return 'resolve-conflict';
    default:
      return 'review-media';
  }
}

function consumerPolicyFor(disposition: string) {
  if (disposition.startsWith('trusted_')) {
    return 'eligible_for_school_card_and_detail_primary_cover';
  }
  if (disposition.startsWith('source_search_')) {
    return 'use_placeholder_or_non_primary_fallback_until_approved';
  }
  if (disposition.startsWith('review_')) {
    return 'hold_candidate_from_primary_surfaces_until_reviewed';
  }
  if (disposition.startsWith('conflict_')) {
    return 'block_primary_cover_selection_until_conflict_resolved';
  }
  if (disposition.startsWith('terminal_')) {
    return 'show_placeholder_and_terminal_reason_until_new_candidate_exists';
  }
  return 'block_media_closure_until_disposition_is_mapped';
}

function evidenceFor(row: WorklistRow, disposition: string) {
  const details = row.details ?? {};
  return [
    'school-media-closure-worklist',
    `gap:${stringOrNull(row.gap) ?? 'unknown'}`,
    `action:${stringOrNull(row.action) ?? 'unknown'}`,
    `disposition:${disposition}`,
    ...(stringOrNull(details.websiteCandidate)
      ? [`websiteCandidate:${stringOrNull(details.websiteCandidate)}`]
      : []),
    ...(stringOrNull(row.assetId)
      ? [`asset:${stringOrNull(row.assetId)}`]
      : []),
    ...(stringOrNull(details.status)
      ? [`assetStatus:${stringOrNull(details.status)}`]
      : []),
  ];
}

function buildNextCampaign(rows: DispositionRow[]) {
  const conflict = rows.find((row) => row.closureState === 'conflict');
  if (conflict) {
    return {
      id: 'school_media_conflict_review',
      reason: 'At least one school has conflicting primary media state.',
      schoolId: conflict.schoolId,
      recommendedAction: 'resolve-primary-media-conflict',
    };
  }
  const candidate = rows.find((row) => row.closureState === 'review');
  if (candidate) {
    return {
      id: 'school_media_candidate_review',
      reason: 'Candidate media or provenance rows require human review.',
      schoolId: candidate.schoolId,
      recommendedAction: 'review-candidate-media-and-provenance',
    };
  }
  const sourceSearch = rows.find((row) => row.closureState === 'source_search');
  if (sourceSearch) {
    return {
      id: 'school_media_source_search',
      reason:
        'Schools without approved or candidate campus covers need source discovery.',
      schoolId: sourceSearch.schoolId,
      recommendedAction:
        'discover-official-or-licensed-campus-cover-candidates',
    };
  }
  return {
    id: 'school_media_accept_or_monitor',
    reason: 'All emitted media rows are trusted or terminal.',
  };
}

function readWorklist(filePath: string | null) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      path: filePath,
      found: false,
      generatedAt: null,
      status: null,
      summary: {},
      rows: [] as WorklistRow[],
    };
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
    string,
    unknown
  >;
  return {
    path: path.relative(API_ROOT, filePath),
    found: true,
    generatedAt: stringOrNull(parsed.generatedAt),
    status: stringOrNull(parsed.status),
    summary: objectRecord(parsed.summary),
    rows: Array.isArray(parsed.rows) ? parsed.rows.filter(isRecord) : [],
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

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isRecord(value: unknown): value is WorklistRow {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const summary = report.summary ?? {};
  const groups = Object.entries(summary.byDisposition ?? {});
  return [
    '# School Media Disposition Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total rows: ${summary.totalRows ?? 0}`,
    `- Source-search rows: ${summary.sourceSearchRows ?? 0}`,
    `- Review rows: ${summary.reviewRows ?? 0}`,
    `- Trusted rows: ${summary.trustedRows ?? 0}`,
    `- Terminal rows: ${summary.terminalRows ?? 0}`,
    `- Conflict rows: ${summary.conflictRows ?? 0}`,
    '',
    '## Consumer Policy',
    '',
    '- Do not show unapproved candidate media as a primary school cover.',
    '- Use placeholders or non-primary fallbacks until approved primary media exists.',
    '- Treat website candidates as source-search hints, not provenance.',
    '',
    '## Dispositions',
    '',
    '| Disposition | Rows |',
    '| --- | ---: |',
    ...(groups.length
      ? groups.map(([key, count]) => `| ${escapeMarkdown(key)} | ${count} |`)
      : ['| None | 0 |']),
    '',
  ].join('\n');
}

function renderCsv(rows: DispositionRow[]) {
  const header = [
    'schoolId',
    'schoolName',
    'assetId',
    'gap',
    'action',
    'severity',
    'disposition',
    'closureState',
    'nextAction',
    'consumerPolicy',
    'route',
  ];
  const lines = rows.map((row) =>
    [
      row.schoolId ?? '',
      row.schoolName ?? '',
      row.assetId ?? '',
      row.gap ?? '',
      row.action ?? '',
      row.severity ?? '',
      row.disposition,
      row.closureState,
      row.nextAction,
      row.consumerPolicy,
      row.route ?? '',
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

function printSummary(args: Args, report: Record<string, any>) {
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        csv: args.csv,
        totalRows: report.summary?.totalRows ?? 0,
        sourceSearchRows: report.summary?.sourceSearchRows ?? 0,
        reviewRows: report.summary?.reviewRows ?? 0,
        conflictRows: report.summary?.conflictRows ?? 0,
        byDisposition: report.summary?.byDisposition ?? {},
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
