#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'DATABASE_SCHEMA_DISPOSITION_READY'
  | 'BLOCKED_SCHEMA_WORKLIST_MISSING'
  | 'BLOCKED_UNMAPPED_DATABASE_SCHEMA_ROWS';
type ClosureState = 'review' | 'block_release' | 'conflict';
type NextAction =
  | 'operator-apply-migration-or-align-db'
  | 'review-restore-candidate'
  | 'external-artifact-or-baseline-review'
  | 'review-extra-db-object'
  | 'block-release';

interface Args {
  schemaWorklist: string | null;
  alignmentPlan: string | null;
  migrationReconciliation: string | null;
  restoreCandidateBundle: string | null;
  baselineProposal: string | null;
  out: string;
  markdown: string;
  csv: string;
}

interface Artifact {
  path: string | null;
  found: boolean;
  generatedAt: string | null;
  status: string | null;
  summary: Record<string, unknown>;
  rows: Record<string, unknown>[];
}

interface DispositionRow {
  objectType: string | null;
  blocker: string | null;
  status: string | null;
  action: string | null;
  model: string | null;
  table: string | null;
  column: string | null;
  migration: string | null;
  severity: string | null;
  disposition: string;
  closureState: ClosureState | 'unmapped';
  nextAction: NextAction;
  releaseImpact: 'blocks-db-backed-closure' | 'review-only';
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
  const optionalPath = (name: string, pattern: RegExp) => {
    const value = get(name);
    return value ? path.resolve(API_ROOT, value) : findLatest(pattern);
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(REPORT_ROOT, `database-schema-disposition-${stamp}.json`),
    )!,
  );
  return {
    schemaWorklist: optionalPath(
      '--schema-worklist',
      /^database-schema-compatibility-worklist-.+\.json$/,
    ),
    alignmentPlan: optionalPath(
      '--alignment-plan',
      /^database-schema-alignment-plan-.+\.json$/,
    ),
    migrationReconciliation: optionalPath(
      '--migration-reconciliation',
      /^database-migration-history-reconciliation-.+\.json$/,
    ),
    restoreCandidateBundle: optionalPath(
      '--restore-candidate-bundle',
      /^database-migration-restore-candidate-bundle-.+\.json$/,
    ),
    baselineProposal: optionalPath(
      '--baseline-proposal',
      /^database-migration-baseline-proposal-.+\.json$/,
    ),
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
  const schemaWorklist = readArtifact(args.schemaWorklist);
  const artifacts = {
    schemaWorklist,
    alignmentPlan: readArtifact(args.alignmentPlan),
    migrationReconciliation: readArtifact(args.migrationReconciliation),
    restoreCandidateBundle: readArtifact(args.restoreCandidateBundle),
    baselineProposal: readArtifact(args.baselineProposal),
  };
  if (!schemaWorklist.found) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-database-schema-disposition',
      status: 'BLOCKED_SCHEMA_WORKLIST_MISSING' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      summary: {
        totalRows: 0,
        emittedRows: 0,
        allRowsHaveDisposition: false,
        unmappedRows: 0,
        blockedRows: 1,
      },
      artifacts: summarizeArtifacts(artifacts),
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    process.exitCode = 1;
    return;
  }

  const reconciliationByMigration = new Map(
    artifacts.migrationReconciliation.rows
      .map((row) => [stringOrNull(row.migration), row] as const)
      .filter(([migration]) => Boolean(migration)),
  );
  const rows = schemaWorklist.rows.map((row) =>
    buildDispositionRow(row, reconciliationByMigration),
  );
  const unmappedRows = rows.filter((row) => row.closureState === 'unmapped');
  const status: PacketStatus =
    unmappedRows.length > 0
      ? 'BLOCKED_UNMAPPED_DATABASE_SCHEMA_ROWS'
      : 'DATABASE_SCHEMA_DISPOSITION_READY';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-schema-disposition',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    artifacts: summarizeArtifacts(artifacts),
    summary: {
      totalRows: rows.length,
      emittedRows: rows.length,
      allRowsHaveDisposition: unmappedRows.length === 0,
      unmappedRows: unmappedRows.length,
      blockedRows: unmappedRows.length,
      blockReleaseRows: countWhere(
        rows,
        (row) => row.closureState === 'block_release',
      ),
      reviewRows: countWhere(rows, (row) => row.closureState === 'review'),
      conflictRows: countWhere(rows, (row) => row.closureState === 'conflict'),
      missingTableRows: countWhere(
        rows,
        (row) => row.blocker === 'missing_table',
      ),
      unappliedRepoMigrationRows: countWhere(
        rows,
        (row) => row.blocker === 'unapplied_repo_migration',
      ),
      recoverableMigrationRows: countWhere(
        rows,
        (row) =>
          row.disposition ===
          'review_restore_checksum_matched_migration_candidate',
      ),
      unrecoverableMigrationRows: countWhere(
        rows,
        (row) =>
          row.disposition ===
          'review_unrecoverable_migration_history_external_or_baseline_required',
      ),
      extraObjectRows: countWhere(
        rows,
        (row) => row.disposition === 'review_extra_db_object_schema_drift',
      ),
      byBlocker: countBy(rows, (row) => row.blocker ?? 'unknown'),
      byClosureState: countBy(rows, (row) => row.closureState),
      byDisposition: countBy(rows, (row) => row.disposition),
    },
    closureContract: {
      noDbWrites:
        'This packet is read-only. It does not run Prisma migrate, resolve, db push, SQL restore, or pg_restore.',
      releasePolicy:
        'Rows with block_release keep DB-backed data closure blocked until an operator applies/restores/aligns migrations through an approved workflow.',
      evidencePolicy:
        'Recoverable migration SQL is review evidence only; checksum-matched candidates are not restored into the live migrations directory by this packet.',
    },
    nextCampaign: buildNextCampaign(rows),
    rows,
  };
  writeReport(args, report);
  printSummary(args, report);
  if (unmappedRows.length > 0) process.exitCode = 1;
}

function buildDispositionRow(
  row: Record<string, unknown>,
  reconciliationByMigration: Map<string | null, Record<string, unknown>>,
): DispositionRow {
  const blocker = stringOrNull(row.blocker);
  const migration = stringOrNull(row.migration);
  const reconciliation = migration
    ? reconciliationByMigration.get(migration)
    : null;
  const disposition = classifyDisposition(blocker, reconciliation);
  return {
    objectType: stringOrNull(row.objectType),
    blocker,
    status: stringOrNull(row.status),
    action: stringOrNull(row.action),
    model: stringOrNull(row.model),
    table: stringOrNull(row.table),
    column: stringOrNull(row.column),
    migration,
    severity: stringOrNull(row.severity),
    disposition,
    closureState: closureStateFor(disposition),
    nextAction: nextActionFor(disposition),
    releaseImpact: releaseImpactFor(disposition),
    evidence: evidenceFor(row, reconciliation, disposition),
  };
}

function classifyDisposition(
  blocker: string | null,
  reconciliation: Record<string, unknown> | null | undefined,
) {
  if (blocker === 'missing_table' || blocker === 'unapplied_repo_migration') {
    return 'block_release_apply_repo_migration_after_operator_approval';
  }
  if (blocker === 'applied_migration_missing_from_repo') {
    if (
      stringOrNull(reconciliation?.disposition) === 'recoverable-from-git' &&
      reconciliation?.checksumMatchesDb === true
    ) {
      return 'review_restore_checksum_matched_migration_candidate';
    }
    if (stringOrNull(reconciliation?.disposition) === 'unrecoverable') {
      return 'review_unrecoverable_migration_history_external_or_baseline_required';
    }
    return 'review_missing_migration_history';
  }
  if (blocker === 'extra_db_table' || blocker === 'extra_db_column') {
    return 'review_extra_db_object_schema_drift';
  }
  return 'unmapped';
}

function closureStateFor(disposition: string): DispositionRow['closureState'] {
  if (disposition.startsWith('block_release_')) return 'block_release';
  if (disposition.includes('unrecoverable')) return 'conflict';
  if (disposition.startsWith('review_')) return 'review';
  return 'unmapped';
}

function nextActionFor(disposition: string): NextAction {
  switch (disposition) {
    case 'block_release_apply_repo_migration_after_operator_approval':
      return 'operator-apply-migration-or-align-db';
    case 'review_restore_checksum_matched_migration_candidate':
      return 'review-restore-candidate';
    case 'review_unrecoverable_migration_history_external_or_baseline_required':
      return 'external-artifact-or-baseline-review';
    case 'review_missing_migration_history':
    case 'review_extra_db_object_schema_drift':
      return 'review-extra-db-object';
    default:
      return 'block-release';
  }
}

function releaseImpactFor(
  disposition: string,
): DispositionRow['releaseImpact'] {
  return disposition.startsWith('block_release_') ||
    disposition.includes('unrecoverable')
    ? 'blocks-db-backed-closure'
    : 'review-only';
}

function evidenceFor(
  row: Record<string, unknown>,
  reconciliation: Record<string, unknown> | null | undefined,
  disposition: string,
) {
  return [
    'database-schema-compatibility-worklist',
    `blocker:${stringOrNull(row.blocker) ?? 'unknown'}`,
    `disposition:${disposition}`,
    ...(stringOrNull(row.migration)
      ? [`migration:${stringOrNull(row.migration)}`]
      : []),
    ...(stringOrNull(row.model) ? [`model:${stringOrNull(row.model)}`] : []),
    ...(stringOrNull(row.table) ? [`table:${stringOrNull(row.table)}`] : []),
    ...(stringOrNull(row.column) ? [`column:${stringOrNull(row.column)}`] : []),
    ...(reconciliation
      ? [
          `reconciliation:${stringOrNull(reconciliation.disposition) ?? 'unknown'}`,
          `checksumMatchesDb:${String(reconciliation.checksumMatchesDb ?? 'unknown')}`,
        ]
      : []),
  ];
}

function buildNextCampaign(rows: DispositionRow[]) {
  const block = rows.find((row) => row.closureState === 'block_release');
  if (block) {
    return {
      id: 'database_schema_compatibility',
      reason:
        'DB-backed closure is still blocked by missing/unapplied repo migration state.',
      migration: block.migration,
      table: block.table,
      recommendedAction:
        'operator-review-and-apply-or-align-repo-migration-with-backup',
    };
  }
  const conflict = rows.find((row) => row.closureState === 'conflict');
  if (conflict) {
    return {
      id: 'database_migration_history_recovery',
      reason:
        'At least one DB-applied migration remains unrecoverable from local git history.',
      migration: conflict.migration,
      recommendedAction: 'external-artifact-search-or-baseline-review',
    };
  }
  return {
    id: 'database_schema_review_queue',
    reason:
      'All schema drift rows have review dispositions; inspect restore candidates and extra DB objects.',
  };
}

function readArtifact(filePath: string | null): Artifact {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      path: filePath,
      found: false,
      generatedAt: null,
      status: null,
      summary: {},
      rows: [],
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

function summarizeArtifacts(artifacts: Record<string, Artifact>) {
  return Object.fromEntries(
    Object.entries(artifacts).map(([key, artifact]) => [
      key,
      {
        path: artifact.path,
        found: artifact.found,
        generatedAt: artifact.generatedAt,
        status: artifact.status,
        summary: artifact.summary,
      },
    ]),
  );
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

function isRecord(value: unknown): value is Record<string, unknown> {
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
    '# Database Schema Disposition Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total rows: ${summary.totalRows ?? 0}`,
    `- Block-release rows: ${summary.blockReleaseRows ?? 0}`,
    `- Review rows: ${summary.reviewRows ?? 0}`,
    `- Conflict rows: ${summary.conflictRows ?? 0}`,
    `- Recoverable migration rows: ${summary.recoverableMigrationRows ?? 0}`,
    `- Unrecoverable migration rows: ${summary.unrecoverableMigrationRows ?? 0}`,
    '',
    '## Contract',
    '',
    '- This packet is read-only and performs no DB or migration writes.',
    '- Block-release rows remain blockers until an approved operator workflow acts.',
    '- Checksum-matched restore candidates are evidence only.',
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
    'objectType',
    'blocker',
    'status',
    'action',
    'model',
    'table',
    'column',
    'migration',
    'severity',
    'disposition',
    'closureState',
    'nextAction',
    'releaseImpact',
  ];
  const lines = rows.map((row) =>
    [
      row.objectType ?? '',
      row.blocker ?? '',
      row.status ?? '',
      row.action ?? '',
      row.model ?? '',
      row.table ?? '',
      row.column ?? '',
      row.migration ?? '',
      row.severity ?? '',
      row.disposition,
      row.closureState,
      row.nextAction,
      row.releaseImpact,
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
        blockReleaseRows: report.summary?.blockReleaseRows ?? 0,
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
