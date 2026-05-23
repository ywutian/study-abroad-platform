#!/usr/bin/env tsx
import * as crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

type ReconciliationStatus =
  | 'PASS'
  | 'BLOCKED_DATABASE_UNAVAILABLE'
  | 'REVIEW_RECOVERABLE_SQUASHED_HISTORY'
  | 'BLOCKED_CHECKSUM_MISMATCH'
  | 'BLOCKED_UNRECOVERABLE_MIGRATION_HISTORY';

type RecoveryDisposition =
  | 'already-present'
  | 'recoverable-from-git'
  | 'recoverable-from-git-checksum-mismatch'
  | 'unrecoverable';

interface Args {
  worklist: string;
  out: string;
  markdown: string;
}

interface WorklistRow {
  blocker: string;
  migration?: string;
  evidence?: {
    checksum?: string;
    startedAt?: string;
    finishedAt?: string;
    appliedStepsCount?: number;
    logsPresent?: boolean;
  };
}

interface WorklistReport {
  generatedAt: string;
  status: string;
  rows: WorklistRow[];
}

interface MissingMigrationRecovery {
  migration: string;
  disposition: RecoveryDisposition;
  action:
    | 'accept-present'
    | 'restore-or-baseline-review'
    | 'manual-recovery-required';
  currentPath: string;
  existsInCurrentRepo: boolean;
  gitHistoryCommitCount: number;
  latestHistoryCommit: string | null;
  recoverableCandidateCount: number;
  recoveredFromSpec: string | null;
  recoveredSqlSha256: string | null;
  dbChecksum: string | null;
  checksumMatchesDb: boolean | null;
  lineCount: number | null;
  sourcePreview: string | null;
  dbAppliedAt: string | null;
  notes: string[];
}

const API_ROOT = detectApiRoot();
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const MIGRATION_ROOT = path.join(API_ROOT, 'prisma', 'migrations');
const BASELINE_MIGRATION = '0001_baseline';

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
    `database-migration-history-reconciliation-${stamp}.json`,
  );
  const out = path.resolve(API_ROOT, get('--out', defaultOut)!);
  const worklist = get('--worklist');
  return {
    worklist: path.resolve(API_ROOT, worklist ?? findLatestSchemaWorklist()),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
  };
}

function main() {
  const args = parseArgs();
  const worklist = JSON.parse(
    fs.readFileSync(args.worklist, 'utf8'),
  ) as WorklistReport;
  const missingRows = worklist.rows.filter(
    (row) => row.blocker === 'applied_migration_missing_from_repo',
  );
  const unavailableRows = worklist.rows.filter(
    (row) => row.blocker === 'database_unavailable',
  );
  const recoveries = missingRows
    .map((row) => reconcileMissingMigration(row))
    .sort((a, b) => a.migration.localeCompare(b.migration));
  const status = chooseStatus(unavailableRows.length, recoveries);
  const baselineExists = fs.existsSync(
    path.join(MIGRATION_ROOT, BASELINE_MIGRATION, 'migration.sql'),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-migration-history-reconciliation',
    status,
    sourceWorklist: path.relative(API_ROOT, args.worklist),
    worklistGeneratedAt: worklist.generatedAt,
    worklistStatus: worklist.status,
    summary: {
      appliedMigrationsMissingFromRepo: missingRows.length,
      recoverableFromGit: recoveries.filter((row) =>
        row.disposition.startsWith('recoverable-from-git'),
      ).length,
      checksumMatches: recoveries.filter(
        (row) => row.checksumMatchesDb === true,
      ).length,
      checksumMismatches: recoveries.filter(
        (row) => row.checksumMatchesDb === false,
      ).length,
      unrecoverable: recoveries.filter(
        (row) => row.disposition === 'unrecoverable',
      ).length,
      alreadyPresent: recoveries.filter(
        (row) => row.disposition === 'already-present',
      ).length,
      baselineMigrationExists: baselineExists,
    },
    riskAssessment: {
      destructiveDbWriteAllowedByThisPlan: false,
      canAutoRestoreWithoutReview: false,
      likelySquashedHistory: baselineExists && recoveries.length > 0,
      decision: buildDecision(status, baselineExists),
    },
    rows: recoveries,
    recommendedSequence: buildRecommendedSequence(status),
    verificationCommands: [
      'pnpm --filter api audit:database-schema-compatibility -- --out /tmp/database-schema-compatibility.json --db-timeout-ms 8000',
      `pnpm --filter api audit:database-migration-history-reconciliation -- --worklist ${args.worklist} --out /tmp/database-migration-history-reconciliation.json`,
      `pnpm --filter api audit:database-schema-alignment-plan -- --worklist ${args.worklist} --out /tmp/database-schema-alignment-plan.json`,
      'pnpm --filter api audit:platform-data-closure -- --out /tmp/platform-data-closure.json --db-timeout-ms 8000',
    ],
    nextCampaign:
      status === 'PASS'
        ? {
            id: 'database_schema_compatibility',
            reason:
              'Migration history is reconciled; rerun schema compatibility and alignment planning.',
          }
        : {
            id: 'database_migration_history_reconciliation',
            reason:
              'Review recoverable migration history before applying or resolving schema migrations.',
          },
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  printSummary(args.out, args.markdown, report);
}

function findLatestSchemaWorklist() {
  if (!fs.existsSync(REPORT_ROOT)) {
    throw new Error(
      'No --worklist provided and scripts/closure-reports does not exist',
    );
  }
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
  if (!latest) {
    throw new Error('No --worklist provided and no schema worklist found');
  }
  return path.join(REPORT_ROOT, latest.file);
}

function reconcileMissingMigration(row: WorklistRow): MissingMigrationRecovery {
  const migration = row.migration ?? 'unknown';
  const currentPath = path.join(MIGRATION_ROOT, migration, 'migration.sql');
  const relPath = path.relative(REPO_ROOT, currentPath);
  const notes: string[] = [];
  if (fs.existsSync(currentPath)) {
    return {
      migration,
      disposition: 'already-present',
      action: 'accept-present',
      currentPath: path.relative(API_ROOT, currentPath),
      existsInCurrentRepo: true,
      gitHistoryCommitCount: 0,
      latestHistoryCommit: null,
      recoverableCandidateCount: 1,
      recoveredFromSpec: null,
      recoveredSqlSha256: sha256(fs.readFileSync(currentPath, 'utf8')),
      dbChecksum: row.evidence?.checksum ?? null,
      checksumMatchesDb: compareChecksum(
        sha256(fs.readFileSync(currentPath, 'utf8')),
        row.evidence?.checksum,
      ),
      lineCount: fs.readFileSync(currentPath, 'utf8').split(/\r?\n/).length,
      sourcePreview: previewSql(fs.readFileSync(currentPath, 'utf8')),
      dbAppliedAt: row.evidence?.finishedAt ?? null,
      notes: ['Migration file is already present in the current repo.'],
    };
  }

  const commits = gitLog(relPath);
  const candidates = commits.flatMap((commit) =>
    [`${commit}:${relPath}`, `${commit}^:${relPath}`].flatMap((spec) => {
      const sql = gitShow(spec);
      return sql === null ? [] : [{ spec, sql, sha256: sha256(sql) }];
    }),
  );
  const expectedChecksum = row.evidence?.checksum;
  const selectedCandidate =
    candidates.find((candidate) => candidate.sha256 === expectedChecksum) ??
    candidates[0] ??
    null;

  if (selectedCandidate === null) {
    return {
      migration,
      disposition: 'unrecoverable',
      action: 'manual-recovery-required',
      currentPath: path.relative(API_ROOT, currentPath),
      existsInCurrentRepo: false,
      gitHistoryCommitCount: commits.length,
      latestHistoryCommit: commits[0] ?? null,
      recoverableCandidateCount: 0,
      recoveredFromSpec: null,
      recoveredSqlSha256: null,
      dbChecksum: row.evidence?.checksum ?? null,
      checksumMatchesDb: null,
      lineCount: null,
      sourcePreview: null,
      dbAppliedAt: row.evidence?.finishedAt ?? null,
      notes: [
        'No recoverable migration.sql was found in local git history for this migration name.',
      ],
    };
  }

  const recoveredSql = selectedCandidate.sql;
  const recoveredFromSpec = selectedCandidate.spec;
  const recoveredSqlSha256 = selectedCandidate.sha256;
  const checksumMatchesDb = compareChecksum(
    recoveredSqlSha256,
    row.evidence?.checksum,
  );
  if (recoveredFromSpec?.includes('^:')) {
    notes.push(
      'Recovered from the parent of a commit that deleted or squashed this migration.',
    );
  }
  if (checksumMatchesDb === false) {
    notes.push(
      'Recovered SQL sha256 does not match the checksum recorded in _prisma_migrations.',
    );
  }
  if (candidates.length > 1) {
    notes.push(
      `Evaluated ${candidates.length} recoverable git candidates and selected ${
        checksumMatchesDb ? 'a checksum match' : 'the newest candidate'
      }.`,
    );
  }

  return {
    migration,
    disposition:
      checksumMatchesDb === false
        ? 'recoverable-from-git-checksum-mismatch'
        : 'recoverable-from-git',
    action: 'restore-or-baseline-review',
    currentPath: path.relative(API_ROOT, currentPath),
    existsInCurrentRepo: false,
    gitHistoryCommitCount: commits.length,
    latestHistoryCommit: commits[0] ?? null,
    recoverableCandidateCount: candidates.length,
    recoveredFromSpec,
    recoveredSqlSha256,
    dbChecksum: row.evidence?.checksum ?? null,
    checksumMatchesDb,
    lineCount: recoveredSql.split(/\r?\n/).length,
    sourcePreview: previewSql(recoveredSql),
    dbAppliedAt: row.evidence?.finishedAt ?? null,
    notes,
  };
}

function chooseStatus(
  unavailableRows: number,
  recoveries: MissingMigrationRecovery[],
): ReconciliationStatus {
  if (unavailableRows > 0) return 'BLOCKED_DATABASE_UNAVAILABLE';
  if (recoveries.length === 0) return 'PASS';
  if (recoveries.some((row) => row.disposition === 'unrecoverable')) {
    return 'BLOCKED_UNRECOVERABLE_MIGRATION_HISTORY';
  }
  if (
    recoveries.some(
      (row) => row.disposition === 'recoverable-from-git-checksum-mismatch',
    )
  ) {
    return 'BLOCKED_CHECKSUM_MISMATCH';
  }
  return 'REVIEW_RECOVERABLE_SQUASHED_HISTORY';
}

function buildDecision(status: ReconciliationStatus, baselineExists: boolean) {
  if (status === 'PASS') {
    return 'No DB-applied migrations are missing from the repo.';
  }
  if (status === 'BLOCKED_DATABASE_UNAVAILABLE') {
    return 'Connect or repoint the database before migration history reconciliation can run.';
  }
  if (status === 'BLOCKED_UNRECOVERABLE_MIGRATION_HISTORY') {
    return 'At least one missing migration cannot be recovered or checksum-matched; manual migration-history recovery is required.';
  }
  if (status === 'BLOCKED_CHECKSUM_MISMATCH') {
    return 'Missing migration SQL is recoverable from git, but at least one recovered file does not match the checksum recorded in _prisma_migrations. Restore/locate the exact applied SQL or document a baseline/resolve decision before any migrate deploy.';
  }
  return baselineExists
    ? 'Missing migration SQL is recoverable from git history, but current repo also has a squashed baseline. Review whether to restore historical migration files or document a baseline/resolve decision before any migrate deploy.'
    : 'Missing migration SQL is recoverable from git history; review and restore files before running migrate deploy against this database.';
}

function buildRecommendedSequence(status: ReconciliationStatus) {
  if (status === 'BLOCKED_DATABASE_UNAVAILABLE') {
    return [
      'Start or repoint the intended database.',
      'Regenerate the schema compatibility worklist.',
      'Run this reconciliation report again.',
    ];
  }
  if (status === 'BLOCKED_UNRECOVERABLE_MIGRATION_HISTORY') {
    return [
      'Manually locate unrecoverable migration SQL from backups, teammates, or deployment artifacts.',
      'Do not run migrate deploy against valuable data.',
      'After restoring or resolving missing history, rerun schema compatibility and reconciliation.',
    ];
  }
  if (status === 'BLOCKED_CHECKSUM_MISMATCH') {
    return [
      'Inspect rows with checksumMatchesDb=false and locate the exact SQL that was applied to the database.',
      'If exact SQL cannot be recovered, document an explicit baseline/resolve decision for this database.',
      'Do not run migrate deploy against valuable data until the checksum mismatch has a review disposition.',
      'After resolution, rerun schema compatibility, migration reconciliation, and the alignment plan.',
    ];
  }
  if (status === 'REVIEW_RECOVERABLE_SQUASHED_HISTORY') {
    return [
      'Review the recovered git specs and checksum matches in this report.',
      'Choose one approved path: restore historical migration directories, or document a baseline/resolve decision for this local database.',
      'Only after that decision, rerun migrate status, schema compatibility, and the alignment plan.',
      'Then apply remaining repo migrations only on an approved local/staging target with backup or disposable clone.',
    ];
  }
  return [
    'Rerun schema compatibility and continue with the next DB-backed P0/P1 data campaign.',
  ];
}

function renderMarkdown(report: {
  generatedAt: string;
  status: ReconciliationStatus;
  sourceWorklist: string;
  summary: Record<string, unknown>;
  riskAssessment: {
    destructiveDbWriteAllowedByThisPlan: boolean;
    canAutoRestoreWithoutReview: boolean;
    likelySquashedHistory: boolean;
    decision: string;
  };
  rows: MissingMigrationRecovery[];
  recommendedSequence: string[];
}) {
  const lines = [
    '# Database Migration History Reconciliation',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Source worklist: ${report.sourceWorklist}`,
    '',
    '## Summary',
    '',
    ...Object.entries(report.summary).map(
      ([key, value]) => `- ${key}: ${value}`,
    ),
    '',
    '## Risk Assessment',
    '',
    `- Destructive DB write allowed by this plan: ${report.riskAssessment.destructiveDbWriteAllowedByThisPlan}`,
    `- Can auto-restore without review: ${report.riskAssessment.canAutoRestoreWithoutReview}`,
    `- Likely squashed history: ${report.riskAssessment.likelySquashedHistory}`,
    `- Decision: ${report.riskAssessment.decision}`,
    '',
    '## Recommended Sequence',
    '',
    ...report.recommendedSequence.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Missing Migration Rows',
    '',
    ...report.rows
      .slice(0, 50)
      .map((row) =>
        [
          `- ${row.migration}: ${row.disposition}`,
          `  - recoveredFrom: ${row.recoveredFromSpec ?? 'none'}`,
          `  - checksumMatchesDb: ${row.checksumMatchesDb}`,
          `  - lines: ${row.lineCount ?? 'unknown'}`,
        ].join('\n'),
      ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function gitLog(relPath: string) {
  try {
    const output = execFileSync(
      'git',
      ['log', '--all', '--format=%H', '--', relPath],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function gitShow(spec: string) {
  try {
    return execFileSync('git', ['show', spec], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function compareChecksum(actual: string, expected?: string) {
  return expected ? actual === expected : null;
}

function previewSql(sql: string) {
  return sql
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .slice(0, 240);
}

function printSummary(
  out: string,
  markdown: string,
  report: {
    status: ReconciliationStatus;
    summary: Record<string, unknown>;
  },
) {
  console.log(
    [
      `Database migration history reconciliation status: ${report.status}`,
      `Applied migrations missing from repo: ${report.summary.appliedMigrationsMissingFromRepo}`,
      `Recoverable from git: ${report.summary.recoverableFromGit}`,
      `Checksum matches: ${report.summary.checksumMatches}`,
      `Checksum mismatches: ${report.summary.checksumMismatches}`,
      `Unrecoverable: ${report.summary.unrecoverable}`,
      `JSON: ${out}`,
      `Markdown: ${markdown}`,
    ].join('\n'),
  );
}

main();
