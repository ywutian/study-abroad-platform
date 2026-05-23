#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'SCHOOL_CONSUMER_VISIBILITY_DISPOSITION_READY'
  | 'PASS_NO_SCHOOL_CONSUMER_VISIBILITY_ROWS'
  | 'BLOCKED_WORKLIST_MISSING';

type ClosureState = 'trusted' | 'review';
type Disposition =
  | 'trusted_consumer_visibility_present'
  | 'review_add_consumer_reference'
  | 'review_add_provenance_visibility'
  | 'review_add_weak_state_visibility';

interface Args {
  worklist: string | null;
  out: string;
  markdown: string;
  csv: string;
  limit: number;
}

interface WorklistReport {
  generatedAt?: string;
  status?: string;
  summary?: Record<string, unknown>;
  rows?: WorklistRow[];
}

interface WorklistRow {
  domain: 'school_data_consumer_visibility';
  severity: 'critical' | 'warning' | 'info';
  status: 'ACCEPTED' | 'REVIEW';
  action: 'accept' | 'review-consumer-visibility' | 'add-consumer-reference';
  blocker:
    | 'none'
    | 'missing_consumer_reference'
    | 'missing_provenance_visibility'
    | 'missing_weak_state_visibility';
  field: string;
  fieldPriority: 'P0' | 'P1' | 'P2';
  surfaceId: string;
  surfaceLabel: string;
  surfacePriority: 'P0' | 'P1' | 'P2';
  highRiskConsumer: boolean;
  counts: {
    scannedFiles: number;
    fieldFiles: number;
    fieldMentions: number;
    provenanceFiles: number;
    weakStateFiles: number;
  };
  evidence: {
    files: Array<{
      file: string;
      fieldMentions: number;
      provenanceMentions: number;
      weakStateMentions: number;
    }>;
    provenanceSignals: string[];
    weakStateSignals: string[];
  };
  rationale: string;
}

interface DispositionRow {
  domain: 'school_data_consumer_visibility';
  field: string;
  fieldPriority: WorklistRow['fieldPriority'];
  surfaceId: string;
  surfaceLabel: string;
  surfacePriority: WorklistRow['surfacePriority'];
  highRiskConsumer: boolean;
  severity: WorklistRow['severity'];
  originalStatus: WorklistRow['status'];
  originalBlocker: WorklistRow['blocker'];
  closureState: ClosureState;
  disposition: Disposition;
  consumerPolicy: {
    prediction: 'allow_with_existing_support' | 'block_until_review';
    recommendation: 'allow_with_existing_support' | 'block_until_review';
    schoolPages: 'allow_with_existing_support' | 'block_until_review';
    chatContext: 'allow_with_existing_support' | 'block_until_review';
    adminReview: 'show_visibility_gap';
  };
  recommendedAction: string;
  implementationTargets: string[];
  requiredEvidence: string[];
  prohibitedActions: string[];
  sourceWorklistRationale: string;
  evidence: WorklistRow['evidence'];
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
      path.join(
        REPORT_ROOT,
        `school-data-consumer-visibility-disposition-${stamp}.json`,
      ),
    )!,
  );
  const worklist = get('--worklist');
  return {
    worklist: worklist
      ? path.resolve(API_ROOT, worklist)
      : findLatest(
          /^school-data-consumer-visibility-(?!disposition-).+\.json$/,
        ),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    limit: Number(get('--limit', '1000')),
  };
}

function main() {
  const args = parseArgs();
  if (!args.worklist || !fs.existsSync(args.worklist)) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-school-data-consumer-visibility-disposition',
      status: 'BLOCKED_WORKLIST_MISSING' satisfies PacketStatus,
      destructiveWriteAllowedByThisPlan: false,
      worklist: args.worklist,
      summary: {
        totalRows: 0,
        emittedRows: 0,
        allRowsHaveDisposition: false,
        unmappedRows: 0,
        blockedRows: 1,
      },
      nextCampaign: {
        id: 'school_data_consumer_visibility_worklist',
        reason:
          'Run audit:school-consumer-visibility before building dispositions.',
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    return;
  }

  const worklist = JSON.parse(
    fs.readFileSync(args.worklist, 'utf8'),
  ) as WorklistReport;
  const rows = (worklist.rows ?? []).map(toDispositionRow).slice(0, args.limit);
  const reviewRows = rows.filter((row) => row.closureState === 'review');
  const criticalReviewRows = reviewRows.filter(
    (row) => row.severity === 'critical',
  );
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-school-data-consumer-visibility-disposition',
    status: (rows.length > 0
      ? 'SCHOOL_CONSUMER_VISIBILITY_DISPOSITION_READY'
      : 'PASS_NO_SCHOOL_CONSUMER_VISIBILITY_ROWS') satisfies PacketStatus,
    destructiveWriteAllowedByThisPlan: false,
    worklist: path.relative(API_ROOT, args.worklist),
    worklistGeneratedAt: worklist.generatedAt ?? null,
    worklistStatus: worklist.status ?? null,
    summary: {
      totalRows: worklist.rows?.length ?? 0,
      emittedRows: rows.length,
      allRowsHaveDisposition: true,
      unmappedRows: 0,
      blockedRows: 0,
      trustedRows: rows.filter((row) => row.closureState === 'trusted').length,
      reviewRows: reviewRows.length,
      criticalReviewRows: criticalReviewRows.length,
      p0ReviewRows: reviewRows.filter((row) => row.fieldPriority === 'P0')
        .length,
      highRiskReviewRows: reviewRows.filter((row) => row.highRiskConsumer)
        .length,
      missingConsumerReferenceRows: rows.filter(
        (row) => row.originalBlocker === 'missing_consumer_reference',
      ).length,
      missingProvenanceVisibilityRows: rows.filter(
        (row) => row.originalBlocker === 'missing_provenance_visibility',
      ).length,
      missingWeakStateVisibilityRows: rows.filter(
        (row) => row.originalBlocker === 'missing_weak_state_visibility',
      ).length,
      byDisposition: countBy(rows, (row) => row.disposition),
      bySurface: countBy(reviewRows, (row) => row.surfaceId),
      byField: countBy(reviewRows, (row) => row.field),
    },
    reviewContract: {
      dispositionPacketDoesNotModifyConsumers: true,
      dispositionPacketDoesNotApproveMissingReferences: true,
      acceptedResolutionRequires: [
        'code reference exists for the expected field or the field/surface expectation is marked terminal with rationale',
        'externally sourced facts expose source/provenance/support labels in user-facing or admin-facing surfaces',
        'high-risk consumers show weak/unknown/confidence state when data support is incomplete',
      ],
      prohibitedActions: [
        'do not treat missing consumer references as trusted runtime usage',
        'do not hide provenance gaps by only adding comments or unrelated text',
        'do not expose prediction/recommendation/chat facts without source or weak-state policy',
      ],
    },
    nextCampaign: buildNextCampaign(reviewRows),
    rows,
  };
  writeReport(args, report);
  printSummary(args, report);
}

function toDispositionRow(row: WorklistRow): DispositionRow {
  const disposition = chooseDisposition(row);
  const closureState: ClosureState =
    disposition === 'trusted_consumer_visibility_present'
      ? 'trusted'
      : 'review';
  return {
    domain: 'school_data_consumer_visibility',
    field: row.field,
    fieldPriority: row.fieldPriority,
    surfaceId: row.surfaceId,
    surfaceLabel: row.surfaceLabel,
    surfacePriority: row.surfacePriority,
    highRiskConsumer: row.highRiskConsumer,
    severity: row.severity,
    originalStatus: row.status,
    originalBlocker: row.blocker,
    closureState,
    disposition,
    consumerPolicy: consumerPolicy(closureState),
    recommendedAction: recommendedAction(disposition),
    implementationTargets: implementationTargets(row),
    requiredEvidence: requiredEvidence(disposition),
    prohibitedActions: [
      'do not count a field/surface row closed until code, provenance, and weak-state evidence are present or terminalized',
      'do not promote source-less school facts into prediction, recommendation, school pages, or chat context',
      'do not infer external facts from consumer code references',
    ],
    sourceWorklistRationale: row.rationale,
    evidence: row.evidence,
  };
}

function chooseDisposition(row: WorklistRow): Disposition {
  switch (row.blocker) {
    case 'none':
      return 'trusted_consumer_visibility_present';
    case 'missing_consumer_reference':
      return 'review_add_consumer_reference';
    case 'missing_provenance_visibility':
      return 'review_add_provenance_visibility';
    case 'missing_weak_state_visibility':
      return 'review_add_weak_state_visibility';
  }
}

function consumerPolicy(
  closureState: ClosureState,
): DispositionRow['consumerPolicy'] {
  const allowOrBlock =
    closureState === 'trusted'
      ? 'allow_with_existing_support'
      : 'block_until_review';
  return {
    prediction: allowOrBlock,
    recommendation: allowOrBlock,
    schoolPages: allowOrBlock,
    chatContext: allowOrBlock,
    adminReview: 'show_visibility_gap' as const,
  };
}

function recommendedAction(disposition: Disposition) {
  switch (disposition) {
    case 'trusted_consumer_visibility_present':
      return 'accept-current-consumer-visibility-evidence';
    case 'review_add_consumer_reference':
      return 'add-field-reference-or-mark-surface-terminal';
    case 'review_add_provenance_visibility':
      return 'add-source-provenance-support-labels';
    case 'review_add_weak_state_visibility':
      return 'add-unknown-confidence-or-fallback-state';
  }
}

function implementationTargets(row: WorklistRow) {
  if (row.evidence.files.length > 0) {
    return row.evidence.files.map((file) => file.file);
  }
  return surfaceTargetHints(row.surfaceId);
}

function surfaceTargetHints(surfaceId: string) {
  switch (surfaceId) {
    case 'api_school_detail':
      return ['apps/api/src/modules/school'];
    case 'prediction_engine':
      return ['apps/api/src/modules/prediction', 'packages/shared/src/scoring'];
    case 'web_prediction_results':
      return ['apps/web/src/components/features/prediction'];
    case 'web_school_pages':
      return ['apps/web/src/app/[locale]/(main)/schools'];
    case 'essay_ai_context':
      return ['apps/api/src/modules/essay'];
    case 'agent_chat_context':
      return [
        'apps/api/src/modules/ai',
        'apps/web/src/app/[locale]/(main)/chat',
      ];
    default:
      return [];
  }
}

function requiredEvidence(disposition: Disposition) {
  switch (disposition) {
    case 'trusted_consumer_visibility_present':
      return ['existing static consumer, provenance, or weak-state evidence'];
    case 'review_add_consumer_reference':
      return [
        'code reference to the expected field in the target surface',
        'or explicit terminal rationale that the field should not be consumed there',
      ];
    case 'review_add_provenance_visibility':
      return [
        'source/provenance/support label in the matching consumer surface',
        'admin or user-visible explanation path for sourced school facts',
      ];
    case 'review_add_weak_state_visibility':
      return [
        'unknown/unavailable/confidence/fallback display or response metadata',
        'test or static audit evidence that weak-state text remains visible',
      ];
  }
}

function buildNextCampaign(reviewRows: DispositionRow[]) {
  const top = reviewRows.sort(compareRows)[0];
  if (!top) {
    return {
      id: 'school_data_coverage_backfill',
      reason:
        'Consumer visibility rows are trusted; continue school data coverage and provenance backfill.',
    };
  }
  return {
    id: 'school_data_consumer_visibility_p0_implementation',
    reason: `${top.surfaceId}.${top.field} is ${top.disposition}; implement or terminalize this consumer-visibility gap next.`,
    field: top.field,
    surfaceId: top.surfaceId,
    disposition: top.disposition,
    recommendedAction: top.recommendedAction,
  };
}

function compareRows(a: DispositionRow, b: DispositionRow) {
  return (
    severityWeight(b.severity) - severityWeight(a.severity) ||
    priorityWeight(b.fieldPriority) - priorityWeight(a.fieldPriority) ||
    Number(b.highRiskConsumer) - Number(a.highRiskConsumer) ||
    a.surfaceId.localeCompare(b.surfaceId) ||
    a.field.localeCompare(b.field)
  );
}

function severityWeight(severity: DispositionRow['severity']) {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

function priorityWeight(priority: WorklistRow['fieldPriority']) {
  if (priority === 'P0') return 3;
  if (priority === 'P1') return 2;
  return 1;
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = getKey(row) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function writeReport(args: Args, report: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report as any));
  fs.writeFileSync(args.csv, renderCsv((report as any).rows ?? []));

  if (args.out.startsWith(REPORT_ROOT)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportBase = path.join(
    REPORT_ROOT,
    `school-data-consumer-visibility-disposition-${stamp}`,
  );
  fs.mkdirSync(REPORT_ROOT, { recursive: true });
  fs.writeFileSync(
    `${reportBase}.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  fs.writeFileSync(`${reportBase}.md`, renderMarkdown(report as any));
  fs.writeFileSync(`${reportBase}.csv`, renderCsv((report as any).rows ?? []));
}

function renderMarkdown(report: {
  generatedAt: string;
  status: string;
  summary: Record<string, unknown>;
  nextCampaign: Record<string, unknown>;
  rows: DispositionRow[];
}) {
  const reviewRows = report.rows
    .filter((row) => row.closureState === 'review')
    .sort(compareRows)
    .slice(0, 30);
  return [
    '# School Data Consumer Visibility Disposition Packet',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Total rows: ${report.summary.totalRows}`,
    `- Trusted rows: ${report.summary.trustedRows}`,
    `- Review rows: ${report.summary.reviewRows}`,
    `- Critical review rows: ${report.summary.criticalReviewRows}`,
    `- Blocked rows: ${report.summary.blockedRows}`,
    '',
    '## Next Campaign',
    '',
    `- ${report.nextCampaign.reason ?? 'Continue school data closure.'}`,
    '',
    '## Top Review Rows',
    '',
    reviewRows.length === 0
      ? '- None'
      : reviewRows
          .map(
            (row) =>
              `- ${row.severity.toUpperCase()} ${row.surfaceId}.${row.field}: ${row.disposition} (${row.recommendedAction})`,
          )
          .join('\n'),
    '',
    '## Review Contract',
    '',
    '- This packet is read-only and does not change API/web/prediction consumers.',
    '- Review dispositions are not trusted runtime usage; they are an explicit implementation queue.',
    '- Missing references can close only through code evidence or explicit terminal rationale.',
    '',
  ].join('\n');
}

function renderCsv(rows: DispositionRow[]) {
  const headers = [
    'field',
    'surfaceId',
    'severity',
    'closureState',
    'disposition',
    'recommendedAction',
    'implementationTargets',
  ];
  return [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => csvCell((row as any)[header])).join(','),
    ),
  ].join('\n');
}

function csvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ''
      : Array.isArray(value)
        ? value.join('|')
        : String(value);
  return `"${text.replace(/"/g, '""')}"`;
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
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return latest ? path.join(REPORT_ROOT, latest.file) : null;
}

function printSummary(
  args: Args,
  report: {
    status: string;
    summary: Record<string, unknown>;
    nextCampaign: Record<string, unknown>;
  },
) {
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        csv: args.csv,
        reviewRows: report.summary.reviewRows,
        criticalReviewRows: report.summary.criticalReviewRows,
        blockedRows: report.summary.blockedRows,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
