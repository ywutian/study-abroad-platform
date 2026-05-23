#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

type BundleStatus =
  | 'STAGED_RESTORE_CANDIDATES_REVIEW_REQUIRED'
  | 'STAGED_RESTORE_CANDIDATES_WITH_BLOCKERS'
  | 'BLOCKED_NO_RESTORE_CANDIDATES';

interface Args {
  reconciliation: string;
  out: string;
  markdown: string;
  bundleDir: string;
}

interface ReconciliationReport {
  generatedAt: string;
  status: string;
  summary: {
    appliedMigrationsMissingFromRepo: number;
    checksumMatches: number;
    checksumMismatches: number;
    unrecoverable: number;
    baselineMigrationExists: boolean;
  };
  rows: Array<{
    migration: string;
    currentPath: string;
    recoveredFromSpec: string | null;
    recoveredSqlSha256: string | null;
    dbChecksum: string | null;
    checksumMatchesDb: boolean | null;
    disposition: string;
    dbAppliedAt: string | null;
  }>;
}

interface StagedCandidate {
  migration: string;
  sourceSpec: string;
  outputPath: string;
  sha256: string;
  dbChecksum: string | null;
  dbAppliedAt: string | null;
  byteLength: number;
}

interface BlockedRow {
  migration: string;
  disposition: string;
  reason: string;
  dbChecksum: string | null;
  recoveredSqlSha256: string | null;
}

const API_ROOT = detectApiRoot();
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
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
  const defaultOut = path.join(
    REPORT_ROOT,
    `database-migration-restore-candidate-bundle-${stamp}.json`,
  );
  const out = path.resolve(API_ROOT, get('--out', defaultOut)!);
  const defaultBundleDir = path.join(
    REPORT_ROOT,
    `database-migration-restore-candidate-bundle-${stamp}`,
  );
  const reconciliation = get('--reconciliation');

  return {
    reconciliation: path.resolve(
      API_ROOT,
      reconciliation ?? findLatestReconciliation(),
    ),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    bundleDir: path.resolve(API_ROOT, get('--bundle-dir', defaultBundleDir)!),
  };
}

function main() {
  const args = parseArgs();
  const reconciliation = JSON.parse(
    fs.readFileSync(args.reconciliation, 'utf8'),
  ) as ReconciliationReport;
  const staged: StagedCandidate[] = [];
  const blocked: BlockedRow[] = [];

  fs.mkdirSync(args.bundleDir, { recursive: true });

  for (const row of reconciliation.rows) {
    if (row.checksumMatchesDb !== true || !row.recoveredFromSpec) {
      blocked.push({
        migration: row.migration,
        disposition: row.disposition,
        reason: buildBlockedReason(row),
        dbChecksum: row.dbChecksum,
        recoveredSqlSha256: row.recoveredSqlSha256,
      });
      continue;
    }

    const sql = gitShow(row.recoveredFromSpec);
    const digest = sha256(sql);
    if (digest !== row.dbChecksum || digest !== row.recoveredSqlSha256) {
      blocked.push({
        migration: row.migration,
        disposition: 'candidate-checksum-drift',
        reason:
          'Recovered SQL no longer matches the reconciliation checksum evidence.',
        dbChecksum: row.dbChecksum,
        recoveredSqlSha256: digest,
      });
      continue;
    }

    const outputPath = path.join(
      args.bundleDir,
      'apps',
      'api',
      'prisma',
      'migrations',
      row.migration,
      'migration.sql',
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, sql);
    staged.push({
      migration: row.migration,
      sourceSpec: row.recoveredFromSpec,
      outputPath: path.relative(REPO_ROOT, outputPath),
      sha256: digest,
      dbChecksum: row.dbChecksum,
      dbAppliedAt: row.dbAppliedAt,
      byteLength: Buffer.byteLength(sql),
    });
  }

  const status = chooseStatus(staged, blocked);
  const manifest = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-migration-restore-candidate-bundle',
    status,
    sourceReconciliation: path.relative(API_ROOT, args.reconciliation),
    reconciliationGeneratedAt: reconciliation.generatedAt,
    reconciliationStatus: reconciliation.status,
    destructiveDbWriteAllowedByThisPlan: false,
    writesToPrismaMigrationDir: false,
    bundleDir: path.relative(REPO_ROOT, args.bundleDir),
    summary: {
      reconciliationMissingFromRepo:
        reconciliation.summary.appliedMigrationsMissingFromRepo,
      checksumMatchedRows: reconciliation.summary.checksumMatches,
      checksumMismatchRows: reconciliation.summary.checksumMismatches,
      unrecoverableRows: reconciliation.summary.unrecoverable,
      baselineMigrationExists: reconciliation.summary.baselineMigrationExists,
      stagedRestoreCandidates: staged.length,
      blockedRows: blocked.length,
    },
    staged,
    blocked,
    recommendedSequence: buildRecommendedSequence(status),
    nextCampaign:
      blocked.length > 0
        ? {
            id: 'database_migration_external_artifact_recovery',
            reason:
              'Restore candidates are staged for checksum-matched migrations, but one or more rows still require exact SQL recovery or baseline review.',
          }
        : {
            id: 'database_migration_restore_review',
            reason:
              'All missing migration SQL candidates are staged; review before restoring files to prisma/migrations.',
          },
  };

  const manifestPath = path.join(args.bundleDir, 'manifest.json');
  const readmePath = path.join(args.bundleDir, 'README.md');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(readmePath, renderMarkdown(manifest), 'utf8');
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(manifest), 'utf8');
  printSummary(args.out, args.markdown, manifestPath, readmePath, manifest);
}

function findLatestReconciliation() {
  if (!fs.existsSync(REPORT_ROOT)) {
    throw new Error(
      'No --reconciliation provided and scripts/closure-reports does not exist',
    );
  }
  const latest = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) =>
      /^database-migration-history-reconciliation-.+\.json$/.test(file),
    )
    .map((file) => ({
      file,
      mtimeMs: fs.statSync(path.join(REPORT_ROOT, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  if (!latest) {
    throw new Error('No --reconciliation provided and no report found');
  }
  return path.join(REPORT_ROOT, latest.file);
}

function buildBlockedReason(row: ReconciliationReport['rows'][number]): string {
  if (row.checksumMatchesDb === false) {
    return 'Recovered SQL does not match the checksum recorded in _prisma_migrations.';
  }
  if (!row.recoveredFromSpec) {
    return 'No recoverable git spec is available for this migration.';
  }
  return 'Row is not eligible for restore staging.';
}

function chooseStatus(
  staged: StagedCandidate[],
  blocked: BlockedRow[],
): BundleStatus {
  if (staged.length === 0) return 'BLOCKED_NO_RESTORE_CANDIDATES';
  if (blocked.length > 0) return 'STAGED_RESTORE_CANDIDATES_WITH_BLOCKERS';
  return 'STAGED_RESTORE_CANDIDATES_REVIEW_REQUIRED';
}

function buildRecommendedSequence(status: BundleStatus) {
  if (status === 'BLOCKED_NO_RESTORE_CANDIDATES') {
    return [
      'Return to migration reconciliation and exact-SQL recovery; no checksum-matched SQL was safe to stage.',
    ];
  }
  if (status === 'STAGED_RESTORE_CANDIDATES_WITH_BLOCKERS') {
    return [
      'Review the staged checksum-matched migration files in this bundle only; they have not been restored to prisma/migrations.',
      'Continue exact SQL recovery for blocked rows, or create a non-production baseline/resolve review packet.',
      'Do not copy staged files into prisma/migrations until the full migration-history path is approved.',
      'After approval/restoration, rerun schema compatibility, migration reconciliation, checksum review, and schema alignment planning.',
    ];
  }
  return [
    'Review the staged migration files and manifest.',
    'Restore files to prisma/migrations only through an approved migration-history workflow.',
    'Rerun schema compatibility, migration reconciliation, checksum review, and schema alignment planning.',
  ];
}

function renderMarkdown(report: {
  generatedAt: string;
  status: BundleStatus;
  destructiveDbWriteAllowedByThisPlan: boolean;
  writesToPrismaMigrationDir: boolean;
  bundleDir: string;
  summary: Record<string, unknown>;
  staged: StagedCandidate[];
  blocked: BlockedRow[];
  recommendedSequence: string[];
}) {
  const lines = [
    '# Database Migration Restore Candidate Bundle',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Bundle dir: ${report.bundleDir}`,
    `Destructive DB write allowed: ${report.destructiveDbWriteAllowedByThisPlan}`,
    `Writes to prisma/migrations: ${report.writesToPrismaMigrationDir}`,
    '',
    '## Summary',
    '',
    ...Object.entries(report.summary).map(
      ([key, value]) => `- ${key}: ${value}`,
    ),
    '',
    '## Recommended Sequence',
    '',
    ...report.recommendedSequence.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Staged Candidates',
    '',
    ...(report.staged.length
      ? report.staged.map(
          (row) => `- ${row.migration}: ${row.sha256} (${row.outputPath})`,
        )
      : ['- none']),
    '',
    '## Blocked Rows',
    '',
    ...(report.blocked.length
      ? report.blocked.map(
          (row) =>
            `- ${row.migration}: ${row.reason} db=${row.dbChecksum} recovered=${row.recoveredSqlSha256}`,
        )
      : ['- none']),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function printSummary(
  out: string,
  markdown: string,
  manifestPath: string,
  readmePath: string,
  report: {
    status: BundleStatus;
    summary: Record<string, unknown>;
  },
) {
  console.log(
    [
      `Database migration restore candidate bundle status: ${report.status}`,
      `Staged restore candidates: ${report.summary.stagedRestoreCandidates}`,
      `Blocked rows: ${report.summary.blockedRows}`,
      `JSON: ${out}`,
      `Markdown: ${markdown}`,
      `Bundle manifest: ${manifestPath}`,
      `Bundle README: ${readmePath}`,
    ].join('\n'),
  );
}

function gitShow(spec: string) {
  return execFileSync('git', ['show', spec], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 50 * 1024 * 1024,
  });
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

main();
