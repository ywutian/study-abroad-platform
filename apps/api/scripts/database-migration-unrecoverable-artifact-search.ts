#!/usr/bin/env tsx
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type SearchStatus =
  | 'PASS_NO_UNRECOVERABLE_MIGRATIONS'
  | 'REVIEW_EXACT_UNRECOVERABLE_ARTIFACT_FOUND'
  | 'UNRECOVERABLE_ARTIFACT_SEARCH_READY_NO_MATCH'
  | 'BLOCKED_RECONCILIATION_MISSING';

interface Args {
  reconciliation: string | null;
  out: string;
  markdown: string;
  csv: string;
  candidateRoots: string[];
  scanRepoSql: boolean;
  scanArchives: boolean;
  maxFileBytes: number;
  maxArchiveBytes: number;
  maxFiles: number;
}

interface Artifact {
  path: string | null;
  found: boolean;
  generatedAt: string | null;
  status: string | null;
  summary: Record<string, unknown>;
  rows: Record<string, unknown>[];
}

interface Match {
  path: string;
  sha256: string;
  sizeBytes: number;
  source: 'file' | 'archive-entry';
  archivePath?: string;
  entryPath?: string;
}

interface SearchResult {
  rootsSearched: string[];
  filesScanned: number;
  filesSkippedLarge: number;
  filesSkippedUnreadable: number;
  archivesScanned: number;
  archivesSkippedLarge: number;
  archivesSkippedUnreadable: number;
  archiveEntriesScanned: number;
  exactMatches: Match[];
}

const API_ROOT = detectApiRoot();
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const DEFAULT_CANDIDATE_ROOTS = [
  REPO_ROOT,
  path.join(API_ROOT, 'scripts', 'closure-reports'),
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'Desktop'),
  '/tmp',
];

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
  const getAll = (name: string) => {
    const values: string[] = [];
    for (let index = 0; index < argv.length; index += 1) {
      const arg = argv[index];
      if (arg.startsWith(`${name}=`)) {
        values.push(arg.slice(name.length + 1));
      } else if (arg === name && argv[index + 1]) {
        values.push(argv[index + 1]);
        index += 1;
      }
    }
    return values.flatMap((value) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    );
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(
        REPORT_ROOT,
        `database-migration-unrecoverable-artifact-search-${stamp}.json`,
      ),
    )!,
  );
  const reconciliation = get('--reconciliation');
  const rootArgs = getAll('--candidate-root');
  return {
    reconciliation: reconciliation
      ? path.resolve(API_ROOT, reconciliation)
      : findLatest(/^database-migration-history-reconciliation-.+\.json$/),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    candidateRoots: unique(
      (rootArgs.length ? rootArgs : DEFAULT_CANDIDATE_ROOTS)
        .map((root) => path.resolve(API_ROOT, root))
        .filter((root) => fs.existsSync(root)),
    ),
    scanRepoSql: argv.includes('--scan-repo-sql'),
    scanArchives: argv.includes('--scan-archives'),
    maxFileBytes: Number(get('--max-file-bytes', `${5 * 1024 * 1024}`)),
    maxArchiveBytes: Number(get('--max-archive-bytes', `${250 * 1024 * 1024}`)),
    maxFiles: Number(get('--max-files', '50000')),
  };
}

function main() {
  const args = parseArgs();
  const reconciliation = readArtifact(args.reconciliation);
  if (!reconciliation.found) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-database-migration-unrecoverable-artifact-search',
      status: 'BLOCKED_RECONCILIATION_MISSING' satisfies SearchStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      writesToPrismaMigrationDir: false,
      sourceReconciliation: reconciliation,
      summary: {
        unrecoverableRows: 0,
        exactArtifactMatches: 0,
        filesScanned: 0,
        archivesScanned: 0,
        archiveEntriesScanned: 0,
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    process.exitCode = 1;
    return;
  }

  const unrecoverableRows = reconciliation.rows.filter(
    (row) => stringOrNull(row.disposition) === 'unrecoverable',
  );
  const rows = unrecoverableRows.map((row) => {
    const migration = stringOrNull(row.migration) ?? 'unknown';
    const dbChecksum = stringOrNull(row.dbChecksum);
    const artifactSearch = searchArtifacts(migration, dbChecksum, args);
    return {
      migration,
      dbChecksum,
      dbAppliedAt: stringOrNull(row.dbAppliedAt),
      reconciliationDisposition: stringOrNull(row.disposition),
      reconciliationNotes: Array.isArray(row.notes) ? row.notes : [],
      artifactSearch,
      acceptableEvidence: buildAcceptableEvidence(migration, dbChecksum),
      rejectedEvidence: buildRejectedEvidence(migration),
      nextAction:
        artifactSearch.exactMatches.length > 0
          ? 'review-exact-sql-artifact'
          : 'request-external-artifact-or-nonproduction-baseline-review',
    };
  });
  const exactArtifactMatches = rows.reduce(
    (sum, row) => sum + row.artifactSearch.exactMatches.length,
    0,
  );
  const status: SearchStatus =
    rows.length === 0
      ? 'PASS_NO_UNRECOVERABLE_MIGRATIONS'
      : exactArtifactMatches > 0
        ? 'REVIEW_EXACT_UNRECOVERABLE_ARTIFACT_FOUND'
        : 'UNRECOVERABLE_ARTIFACT_SEARCH_READY_NO_MATCH';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-migration-unrecoverable-artifact-search',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    writesToPrismaMigrationDir: false,
    sourceReconciliation: {
      path: reconciliation.path,
      generatedAt: reconciliation.generatedAt,
      status: reconciliation.status,
      summary: reconciliation.summary,
    },
    searchConfig: {
      candidateRoots: args.candidateRoots.map((root) =>
        path.relative(REPO_ROOT, root),
      ),
      scanRepoSql: args.scanRepoSql,
      scanArchives: args.scanArchives,
      maxFileBytes: args.maxFileBytes,
      maxArchiveBytes: args.maxArchiveBytes,
      maxFiles: args.maxFiles,
      pathFilter:
        'Reads migration.sql or .sql files whose path includes the migration name; --scan-repo-sql widens repo SQL scanning; --scan-archives inspects SQL-like archive entries.',
    },
    summary: {
      unrecoverableRows: rows.length,
      exactArtifactMatches,
      filesScanned: sumRows(rows, 'filesScanned'),
      filesSkippedLarge: sumRows(rows, 'filesSkippedLarge'),
      filesSkippedUnreadable: sumRows(rows, 'filesSkippedUnreadable'),
      archivesScanned: sumRows(rows, 'archivesScanned'),
      archivesSkippedLarge: sumRows(rows, 'archivesSkippedLarge'),
      archivesSkippedUnreadable: sumRows(rows, 'archivesSkippedUnreadable'),
      archiveEntriesScanned: sumRows(rows, 'archiveEntriesScanned'),
    },
    rows,
    recommendedSequence: buildRecommendedSequence(status),
    nextCampaign:
      status === 'REVIEW_EXACT_UNRECOVERABLE_ARTIFACT_FOUND'
        ? {
            id: 'database_migration_exact_artifact_review',
            reason:
              'An exact SQL artifact was found for an unrecoverable DB-applied migration.',
            recommendedAction:
              'review-artifact-source-before-approved-migration-history-restore',
          }
        : {
            id: 'database_migration_unrecoverable_external_recovery',
            reason:
              'No exact SQL artifact was found locally for the unrecoverable DB-applied migration.',
            recommendedAction:
              'request-deployment-backup-team-clone-or-approve-nonproduction-baseline',
          },
  };
  writeReport(args, report);
  printSummary(args, report);
}

function searchArtifacts(
  migration: string,
  targetChecksum: string | null,
  args: Args,
): SearchResult {
  const roots = args.scanRepoSql
    ? unique([...args.candidateRoots, REPO_ROOT])
    : args.candidateRoots;
  const seen = new Set<string>();
  const exactMatches: Match[] = [];
  let visitedFiles = 0;
  let filesScanned = 0;
  let filesSkippedLarge = 0;
  let filesSkippedUnreadable = 0;
  let archivesScanned = 0;
  let archivesSkippedLarge = 0;
  let archivesSkippedUnreadable = 0;
  let archiveEntriesScanned = 0;

  for (const root of roots) {
    for (const filePath of walkFiles(root)) {
      if (seen.has(filePath)) continue;
      seen.add(filePath);
      visitedFiles += 1;
      if (visitedFiles > args.maxFiles) break;
      const stat = safeStat(filePath);
      if (!stat?.isFile()) continue;
      if (args.scanArchives && isArchivePath(filePath)) {
        if (stat.size > args.maxArchiveBytes) {
          archivesSkippedLarge += 1;
        } else {
          const archiveResult = searchArchive(
            filePath,
            migration,
            targetChecksum,
            args.maxFileBytes,
          );
          archivesScanned += archiveResult.archivesScanned;
          archivesSkippedUnreadable += archiveResult.archivesSkippedUnreadable;
          archiveEntriesScanned += archiveResult.archiveEntriesScanned;
          exactMatches.push(...archiveResult.exactMatches);
        }
        continue;
      }
      if (!isCandidateFile(filePath, migration, args.scanRepoSql)) continue;
      if (stat.size > args.maxFileBytes) {
        filesSkippedLarge += 1;
        continue;
      }
      const buffer = safeRead(filePath);
      if (!buffer) {
        filesSkippedUnreadable += 1;
        continue;
      }
      filesScanned += 1;
      const digest = sha256(buffer);
      if (targetChecksum && digest === targetChecksum) {
        exactMatches.push({
          path: path.relative(REPO_ROOT, filePath),
          sha256: digest,
          sizeBytes: stat.size,
          source: 'file',
        });
      }
    }
  }

  return {
    rootsSearched: roots.map((root) => path.relative(REPO_ROOT, root)),
    filesScanned,
    filesSkippedLarge,
    filesSkippedUnreadable,
    archivesScanned,
    archivesSkippedLarge,
    archivesSkippedUnreadable,
    archiveEntriesScanned,
    exactMatches,
  };
}

function searchArchive(
  archivePath: string,
  migration: string,
  targetChecksum: string | null,
  maxFileBytes: number,
) {
  const result = {
    archivesScanned: 1,
    archivesSkippedUnreadable: 0,
    archiveEntriesScanned: 0,
    exactMatches: [] as Match[],
  };
  const entries = listArchiveEntries(archivePath);
  if (!entries) {
    result.archivesSkippedUnreadable = 1;
    return result;
  }
  for (const entry of entries) {
    if (!isArchiveEntryCandidate(entry, migration)) continue;
    const buffer = readArchiveEntry(archivePath, entry, maxFileBytes);
    if (!buffer) {
      result.archivesSkippedUnreadable += 1;
      continue;
    }
    result.archiveEntriesScanned += 1;
    const digest = sha256(buffer);
    if (targetChecksum && digest === targetChecksum) {
      result.exactMatches.push({
        path: `${path.relative(REPO_ROOT, archivePath)}::${entry}`,
        archivePath: path.relative(REPO_ROOT, archivePath),
        entryPath: entry,
        sha256: digest,
        sizeBytes: buffer.byteLength,
        source: 'archive-entry',
      });
    }
  }
  return result;
}

function listArchiveEntries(archivePath: string) {
  try {
    if (isZipPath(archivePath)) {
      return execFileSync('unzip', ['-Z1', archivePath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 20 * 1024 * 1024,
      })
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    if (isTarPath(archivePath)) {
      return execFileSync('tar', ['-tf', archivePath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 20 * 1024 * 1024,
      })
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    if (isGzipPath(archivePath)) {
      return [path.basename(archivePath).replace(/\.gz$/i, '')];
    }
  } catch {
    return null;
  }
  return null;
}

function readArchiveEntry(
  archivePath: string,
  entry: string,
  maxFileBytes: number,
) {
  try {
    const maxBuffer = maxFileBytes + 1024;
    if (isZipPath(archivePath)) {
      return execFileSync('unzip', ['-p', archivePath, entry], {
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer,
      });
    }
    if (isTarPath(archivePath)) {
      return execFileSync('tar', ['-xOf', archivePath, entry], {
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer,
      });
    }
    if (isGzipPath(archivePath)) {
      return execFileSync('gzip', ['-cd', archivePath], {
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer,
      });
    }
  } catch {
    return null;
  }
  return null;
}

function isCandidateFile(
  filePath: string,
  migration: string,
  scanRepoSql: boolean,
) {
  const normalized = filePath.toLowerCase();
  const migrationLower = migration.toLowerCase();
  if (!normalized.endsWith('.sql')) return false;
  if (normalized.includes(migrationLower)) return true;
  if (
    normalized.endsWith('/migration.sql') &&
    normalized.includes('migrations')
  ) {
    return scanRepoSql;
  }
  return false;
}

function isArchiveEntryCandidate(entry: string, migration: string) {
  const normalized = entry.toLowerCase();
  const migrationLower = migration.toLowerCase();
  return (
    normalized.includes(migrationLower) ||
    normalized.endsWith('/migration.sql') ||
    normalized.endsWith('migration.sql') ||
    normalized.endsWith('.sql')
  );
}

function isArchivePath(filePath: string) {
  return isZipPath(filePath) || isTarPath(filePath) || isGzipPath(filePath);
}

function isZipPath(filePath: string) {
  return filePath.toLowerCase().endsWith('.zip');
}

function isTarPath(filePath: string) {
  const normalized = filePath.toLowerCase();
  return (
    normalized.endsWith('.tar') ||
    normalized.endsWith('.tgz') ||
    normalized.endsWith('.tar.gz')
  );
}

function isGzipPath(filePath: string) {
  const normalized = filePath.toLowerCase();
  return normalized.endsWith('.gz') && !isTarPath(filePath);
}

function* walkFiles(root: string): Generator<string> {
  const skipNames = new Set([
    '.git',
    'node_modules',
    '.next',
    'dist',
    'build',
    'coverage',
    '.turbo',
    '.pnpm-store',
    'Library',
    '.Trash',
  ]);
  const entries = safeReadDir(root);
  for (const entry of entries) {
    if (skipNames.has(entry.name)) continue;
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(filePath);
    } else {
      yield filePath;
    }
  }
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

function buildAcceptableEvidence(migration: string, dbChecksum: string | null) {
  return [
    `A migration.sql file for ${migration} whose SHA-256 exactly equals ${dbChecksum ?? '<db checksum>'}.`,
    'A deployment artifact, CI artifact, backup, release bundle, or teammate clone containing that exact file.',
    'A documented decision that exact SQL cannot be recovered plus an approved non-production baseline/resolve packet.',
  ];
}

function buildRejectedEvidence(migration: string) {
  return [
    `A reconstructed or manually edited ${migration}/migration.sql without checksum evidence.`,
    'A migration with the same name but a different SHA-256 from the DB checksum.',
    'A production baseline/resolve decision; this packet does not approve production schema writes.',
  ];
}

function buildRecommendedSequence(status: SearchStatus) {
  if (status === 'PASS_NO_UNRECOVERABLE_MIGRATIONS') {
    return [
      'Rerun database schema compatibility and platform closure audits to confirm DB migration history is closed.',
    ];
  }
  if (status === 'REVIEW_EXACT_UNRECOVERABLE_ARTIFACT_FOUND') {
    return [
      'Review the exact artifact match and confirm its source.',
      'Restore the exact SQL only through an approved migration-history workflow.',
      'Rerun migration reconciliation, restore candidate bundle, schema disposition, operator handoff, and platform audit.',
    ];
  }
  return [
    'Send the migration name and DB checksum to deployment artifact owners, backup owners, or teammates with older clones.',
    'Place any candidate artifact in a local directory and rerun this script with --candidate-root <dir>.',
    'If exact SQL cannot be recovered, use the existing baseline-resolution flow to create an approved non-production review packet.',
    'Do not run prisma migrate resolve, migrate deploy, db push, SQL restore, or migration-directory writes from this packet.',
  ];
}

function sumRows(
  rows: Array<{ artifactSearch: SearchResult }>,
  key: keyof SearchResult,
) {
  return rows.reduce((sum, row) => {
    const value = row.artifactSearch[key];
    return typeof value === 'number' ? sum + value : sum;
  }, 0);
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const summary = report.summary ?? {};
  const lines = [
    '# Database Migration Unrecoverable Artifact Search',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    ...Object.entries(summary).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Recommended Sequence',
    '',
    ...(report.recommendedSequence ?? []).map(
      (step: string, index: number) => `${index + 1}. ${step}`,
    ),
    '',
    '## Rows',
    '',
    ...(report.rows ?? []).flatMap((row: Record<string, any>) => [
      `### ${row.migration}`,
      '',
      `DB checksum: ${row.dbChecksum}`,
      `Next action: ${row.nextAction}`,
      `Files scanned: ${row.artifactSearch?.filesScanned ?? 0}`,
      `Archives scanned: ${row.artifactSearch?.archivesScanned ?? 0}`,
      `Archive entries scanned: ${row.artifactSearch?.archiveEntriesScanned ?? 0}`,
      `Exact matches: ${row.artifactSearch?.exactMatches?.length ?? 0}`,
      '',
    ]),
  ];
  return `${lines.join('\n')}\n`;
}

function renderCsv(rows: Array<Record<string, any>>) {
  const header = [
    'migration',
    'dbChecksum',
    'dbAppliedAt',
    'nextAction',
    'filesScanned',
    'archivesScanned',
    'archiveEntriesScanned',
    'exactMatches',
  ];
  const lines = rows.map((row) =>
    [
      row.migration ?? '',
      row.dbChecksum ?? '',
      row.dbAppliedAt ?? '',
      row.nextAction ?? '',
      row.artifactSearch?.filesScanned ?? 0,
      row.artifactSearch?.archivesScanned ?? 0,
      row.artifactSearch?.archiveEntriesScanned ?? 0,
      row.artifactSearch?.exactMatches?.length ?? 0,
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

function printSummary(args: Args, report: Record<string, any>) {
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        csv: args.csv,
        unrecoverableRows: report.summary?.unrecoverableRows ?? 0,
        exactArtifactMatches: report.summary?.exactArtifactMatches ?? 0,
        filesScanned: report.summary?.filesScanned ?? 0,
        archivesScanned: report.summary?.archivesScanned ?? 0,
        archiveEntriesScanned: report.summary?.archiveEntriesScanned ?? 0,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

function safeReadDir(root: string) {
  try {
    return fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
}

function safeStat(filePath: string) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function safeRead(filePath: string) {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function sha256(buffer: Buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function unique(values: string[]) {
  return Array.from(new Set(values));
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

main();
