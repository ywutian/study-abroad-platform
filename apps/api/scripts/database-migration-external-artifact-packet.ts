#!/usr/bin/env tsx
import * as crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

type PacketStatus =
  | 'PASS_NO_UNRESOLVED_MISMATCHES'
  | 'REVIEW_EXACT_SQL_ARTIFACT_FOUND'
  | 'BLOCKED_EXTERNAL_ARTIFACT_REQUIRED';

interface Args {
  checksumReview: string | null;
  unrecoverableArtifactSearch: string | null;
  migration: string | null;
  targetSha256: string | null;
  out: string;
  markdown: string;
  candidateRoots: string[];
  scanRepoSql: boolean;
  scanArchives: boolean;
  maxFileBytes: number;
  maxArchiveBytes: number;
}

interface ChecksumReviewReport {
  generatedAt: string;
  status: string;
  summary: {
    checksumMismatchRows: number;
    exactMatchLocations: number;
    unresolvedMismatches: number;
  };
  rows: Array<{
    migration: string;
    dbChecksum: string | null;
    selectedRecoveredFromSpec?: string | null;
    selectedRecoveredSqlSha256: string | null;
    currentWorkspace?: Record<string, unknown>;
    gitPathHistory?: Record<string, unknown>;
    exactMatchLocations: Array<Record<string, unknown>>;
    disposition: string;
    decisionRequired?: string;
  }>;
}

interface UnrecoverableArtifactSearchReport {
  generatedAt: string;
  status: string;
  summary?: {
    unrecoverableRows?: number;
    exactArtifactMatches?: number;
  };
  rows?: Array<{
    migration: string;
    dbChecksum: string | null;
    dbAppliedAt?: string;
    reconciliationDisposition?: string;
    reconciliationNotes?: string[];
    artifactSearch?: {
      exactMatches?: ArtifactMatch[];
    };
  }>;
}

interface ArtifactMatch {
  path: string;
  sha256: string;
  sizeBytes: number;
  source: 'file' | 'archive-entry';
  archivePath?: string;
  entryPath?: string;
}

interface ArtifactSearchResult {
  rootsSearched: string[];
  filesScanned: number;
  filesSkippedLarge: number;
  filesSkippedUnreadable: number;
  archivesScanned: number;
  archivesSkippedLarge: number;
  archivesSkippedUnreadable: number;
  archiveEntriesScanned: number;
  exactMatches: ArtifactMatch[];
}

interface CandidateIntakeFileSummary {
  root: string;
  candidateFilesPresent: number;
  candidateSqlFilesPresent: number;
  candidateArchiveFilesPresent: number;
  generatedIntakeFilesPresent: number;
  candidateFiles: string[];
}

interface ExternalArtifactRequestRow {
  migration: string;
  dbChecksum: string | null;
  selectedRecoveredFromSpec?: string | null;
  selectedRecoveredSqlSha256: string | null;
  disposition: string;
  exactMatchLocations: Array<Record<string, unknown>>;
  sourceKind:
    'checksum_mismatch' | 'unrecoverable_migration' | 'target_override';
  priorExactArtifactMatches: ArtifactMatch[];
}

interface PacketRow {
  sourceKind: ExternalArtifactRequestRow['sourceKind'];
  migration: string;
  dbChecksum: string | null;
  selectedRecoveredFromSpec: string | null;
  selectedRecoveredSqlSha256: string | null;
  checksumReviewDisposition: string;
  artifactSearch: ArtifactSearchResult;
  externalRequest: ReturnType<typeof buildExternalRequest>;
  acceptableEvidence: string[];
  rejectedEvidence: string[];
  nextAction: string;
}

const API_ROOT = detectApiRoot();
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const GENERATED_INTAKE_FILE_NAMES = new Set([
  '.gitignore',
  'README.md',
  'TARGETS.json',
  'TARGETS.sha256',
  'REQUEST.json',
  'REQUEST.md',
  'STATUS.json',
  'STATUS.md',
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
  const defaultOut = path.join(
    REPORT_ROOT,
    `database-migration-external-artifact-packet-${stamp}.json`,
  );
  const out = path.resolve(API_ROOT, get('--out', defaultOut)!);
  const checksumReview = get('--checksum-review');
  const unrecoverableArtifactSearch = get('--unrecoverable-artifact-search');
  const migration = get('--migration');
  const targetSha256 = get('--target-sha256');
  const candidateRoots = [
    path.join(API_ROOT, 'prisma', 'migrations'),
    path.join(API_ROOT, 'scripts', 'closure-reports'),
    ...getAll('--candidate-root'),
  ];

  return {
    checksumReview: checksumReview
      ? resolveInputArtifactPath(checksumReview)
      : migration && targetSha256
        ? null
        : path.resolve(API_ROOT, findLatestChecksumReview()),
    unrecoverableArtifactSearch: unrecoverableArtifactSearch
      ? resolveInputArtifactPath(unrecoverableArtifactSearch)
      : findLatestOptional(
          /^database-migration-unrecoverable-artifact-search-.+\.json$/,
        ),
    migration: migration ?? null,
    targetSha256: targetSha256 ?? null,
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    candidateRoots: unique(
      candidateRoots.map((root) => resolveCandidateRootPath(root)),
    ),
    scanRepoSql: argv.includes('--scan-repo-sql'),
    scanArchives: argv.includes('--scan-archives'),
    maxFileBytes: Number(get('--max-file-bytes', `${5 * 1024 * 1024}`)),
    maxArchiveBytes: Number(get('--max-archive-bytes', `${250 * 1024 * 1024}`)),
  };
}

function main() {
  const args = parseArgs();
  const checksumReview =
    args.checksumReview && fs.existsSync(args.checksumReview)
      ? (JSON.parse(
          fs.readFileSync(args.checksumReview, 'utf8'),
        ) as ChecksumReviewReport)
      : null;
  const unrecoverableArtifactSearch =
    args.unrecoverableArtifactSearch &&
    fs.existsSync(args.unrecoverableArtifactSearch)
      ? (JSON.parse(
          fs.readFileSync(args.unrecoverableArtifactSearch, 'utf8'),
        ) as UnrecoverableArtifactSearchReport)
      : null;
  const sourceRows = rowsForExternalRequest(
    args,
    checksumReview,
    unrecoverableArtifactSearch,
  );
  const preexistingExactMatches = sourceRows.reduce(
    (sum, row) =>
      sum +
      row.exactMatchLocations.length +
      row.priorExactArtifactMatches.length,
    0,
  );
  const unresolvedRows = sourceRows.filter(
    (row) =>
      row.exactMatchLocations.length === 0 &&
      row.priorExactArtifactMatches.length === 0,
  );
  const rows = unresolvedRows.map((row) => {
    const artifactSearch = searchArtifacts(row.dbChecksum, row.migration, args);
    return {
      sourceKind: row.sourceKind,
      migration: row.migration,
      dbChecksum: row.dbChecksum,
      selectedRecoveredFromSpec: row.selectedRecoveredFromSpec ?? null,
      selectedRecoveredSqlSha256: row.selectedRecoveredSqlSha256,
      checksumReviewDisposition: row.disposition,
      artifactSearch,
      externalRequest: buildExternalRequest(row),
      acceptableEvidence: buildAcceptableEvidence(row),
      rejectedEvidence: buildRejectedEvidence(row),
      nextAction:
        artifactSearch.exactMatches.length > 0
          ? 'review-and-restore-exact-sql-artifact'
          : 'request-external-exact-sql-artifact-or-approved-baseline-decision',
    } satisfies PacketRow;
  });
  const exactMatches = rows.reduce(
    (sum, row) => sum + row.artifactSearch.exactMatches.length,
    preexistingExactMatches,
  );
  const status: PacketStatus =
    rows.length === 0 && exactMatches === 0
      ? 'PASS_NO_UNRESOLVED_MISMATCHES'
      : exactMatches > 0
        ? 'REVIEW_EXACT_SQL_ARTIFACT_FOUND'
        : 'BLOCKED_EXTERNAL_ARTIFACT_REQUIRED';
  const generatedAt = new Date().toISOString();
  const report = {
    generatedAt,
    mode: 'read-only-database-migration-external-artifact-packet',
    status,
    sourceChecksumReview: args.checksumReview
      ? path.relative(API_ROOT, args.checksumReview)
      : null,
    checksumReviewGeneratedAt: checksumReview?.generatedAt ?? null,
    checksumReviewStatus: checksumReview?.status ?? null,
    sourceUnrecoverableArtifactSearch: args.unrecoverableArtifactSearch
      ? path.relative(API_ROOT, args.unrecoverableArtifactSearch)
      : null,
    unrecoverableArtifactSearchGeneratedAt:
      unrecoverableArtifactSearch?.generatedAt ?? null,
    unrecoverableArtifactSearchStatus:
      unrecoverableArtifactSearch?.status ?? null,
    targetOverride:
      args.migration && args.targetSha256
        ? {
            migration: args.migration,
            targetSha256: args.targetSha256,
          }
        : null,
    destructiveDbWriteAllowedByThisPlan: false,
    searchConfig: {
      candidateRoots: args.candidateRoots.map((root) =>
        path.relative(REPO_ROOT, root),
      ),
      scanRepoSql: args.scanRepoSql,
      scanArchives: args.scanArchives,
      maxFileBytes: args.maxFileBytes,
      maxArchiveBytes: args.maxArchiveBytes,
    },
    summary: {
      unresolvedMismatchRows: rows.filter(
        (row) =>
          row.sourceKind === 'checksum_mismatch' ||
          row.sourceKind === 'target_override',
      ).length,
      unrecoverableMigrationRows:
        unrecoverableArtifactSearch?.summary?.unrecoverableRows ??
        sourceRows.filter((row) => row.sourceKind === 'unrecoverable_migration')
          .length,
      unresolvedUnrecoverableRows: rows.filter(
        (row) => row.sourceKind === 'unrecoverable_migration',
      ).length,
      externalRequestRows: rows.length,
      preexistingExactArtifactMatches: preexistingExactMatches,
      exactArtifactMatches: exactMatches,
      filesScanned: rows.reduce(
        (sum, row) => sum + row.artifactSearch.filesScanned,
        0,
      ),
      filesSkippedLarge: rows.reduce(
        (sum, row) => sum + row.artifactSearch.filesSkippedLarge,
        0,
      ),
      filesSkippedUnreadable: rows.reduce(
        (sum, row) => sum + row.artifactSearch.filesSkippedUnreadable,
        0,
      ),
      archivesScanned: rows.reduce(
        (sum, row) => sum + row.artifactSearch.archivesScanned,
        0,
      ),
      archivesSkippedLarge: rows.reduce(
        (sum, row) => sum + row.artifactSearch.archivesSkippedLarge,
        0,
      ),
      archivesSkippedUnreadable: rows.reduce(
        (sum, row) => sum + row.artifactSearch.archivesSkippedUnreadable,
        0,
      ),
      archiveEntriesScanned: rows.reduce(
        (sum, row) => sum + row.artifactSearch.archiveEntriesScanned,
        0,
      ),
    },
    candidateIntake: buildCandidateIntake(rows, args),
    rows,
    recommendedSequence: buildRecommendedSequence(status),
    nextCampaign: buildNextCampaign(status, rows),
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  const manifestDigest = writeCandidateIntakeManifest(
    generatedAt,
    report.candidateIntake,
  );
  report.candidateIntake.manifestSha256 = manifestDigest.sha256;
  report.candidateIntake.manifestSizeBytes = manifestDigest.sizeBytes;
  report.candidateIntake.manifestDigestPath = manifestDigest.digestPath;
  report.candidateIntake.requestJsonPath = manifestDigest.requestJsonPath;
  report.candidateIntake.requestMarkdownPath =
    manifestDigest.requestMarkdownPath;
  Object.assign(
    report.candidateIntake,
    summarizeCandidateIntakeFiles(report.candidateIntake),
  );
  writeCandidateStatusArtifacts(report);
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  printSummary(args.out, args.markdown, report);
}

function rowsForExternalRequest(
  args: Args,
  checksumReview: ChecksumReviewReport | null,
  unrecoverableArtifactSearch: UnrecoverableArtifactSearchReport | null,
): ExternalArtifactRequestRow[] {
  if (args.migration && args.targetSha256) {
    return [
      {
        migration: args.migration,
        dbChecksum: args.targetSha256,
        selectedRecoveredFromSpec: null,
        selectedRecoveredSqlSha256: null,
        disposition: 'exact-sql-not-found-external-artifact-required',
        exactMatchLocations: [],
        sourceKind: 'target_override',
        priorExactArtifactMatches: [],
      },
    ];
  }
  const rows: ExternalArtifactRequestRow[] = [
    ...(checksumReview?.rows ?? []).map((row) => ({
      migration: row.migration,
      dbChecksum: row.dbChecksum,
      selectedRecoveredFromSpec: row.selectedRecoveredFromSpec ?? null,
      selectedRecoveredSqlSha256: row.selectedRecoveredSqlSha256,
      disposition: row.disposition,
      exactMatchLocations: row.exactMatchLocations,
      sourceKind: 'checksum_mismatch' as const,
      priorExactArtifactMatches: [],
    })),
    ...(unrecoverableArtifactSearch?.rows ?? []).map((row) => ({
      migration: row.migration,
      dbChecksum: row.dbChecksum,
      selectedRecoveredFromSpec: null,
      selectedRecoveredSqlSha256: null,
      disposition:
        row.reconciliationDisposition ??
        'unrecoverable-exact-sql-not-found-external-artifact-required',
      exactMatchLocations: [],
      sourceKind: 'unrecoverable_migration' as const,
      priorExactArtifactMatches: row.artifactSearch?.exactMatches ?? [],
    })),
  ];
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.migration}:${row.dbChecksum ?? 'missing-checksum'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findLatestChecksumReview() {
  if (!fs.existsSync(REPORT_ROOT)) {
    throw new Error(
      'No --checksum-review provided and scripts/closure-reports does not exist',
    );
  }
  const latest = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) =>
      /^database-migration-checksum-review-.+\.json$/.test(file),
    )
    .map((file) => ({
      file,
      mtimeMs: fs.statSync(path.join(REPORT_ROOT, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  if (!latest) {
    throw new Error('No --checksum-review provided and no report found');
  }
  return path.join(REPORT_ROOT, latest.file);
}

function resolveInputArtifactPath(value: string) {
  if (path.isAbsolute(value)) return value;
  const candidates = [
    path.resolve(process.cwd(), value),
    path.resolve(REPO_ROOT, value),
    path.resolve(API_ROOT, value),
  ];
  return (
    candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[2]
  );
}

function resolveCandidateRootPath(value: string) {
  if (path.isAbsolute(value)) return value;
  const normalized = value.replace(/\\/g, '/');
  const preferredBase = normalized.startsWith('apps/api/')
    ? REPO_ROOT
    : normalized.startsWith('scripts/') || normalized.startsWith('prisma/')
      ? API_ROOT
      : process.cwd();
  const candidates = unique([
    path.resolve(preferredBase, value),
    path.resolve(process.cwd(), value),
    path.resolve(REPO_ROOT, value),
    path.resolve(API_ROOT, value),
  ]);
  return (
    candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]
  );
}

function findLatestOptional(pattern: RegExp) {
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

function searchArtifacts(
  targetChecksum: string | null,
  migration: string,
  args: Args,
): ArtifactSearchResult {
  const roots = [...args.candidateRoots];
  if (args.scanRepoSql) roots.push(REPO_ROOT);
  const exactMatches: ArtifactMatch[] = [];
  const seenFiles = new Set<string>();
  let filesScanned = 0;
  let filesSkippedLarge = 0;
  let filesSkippedUnreadable = 0;
  let archivesScanned = 0;
  let archivesSkippedLarge = 0;
  let archivesSkippedUnreadable = 0;
  let archiveEntriesScanned = 0;

  for (const root of unique(roots)) {
    if (!fs.existsSync(root)) continue;
    for (const filePath of walkFiles(root, {
      sqlOnly: args.scanRepoSql && path.resolve(root) === REPO_ROOT,
    })) {
      if (seenFiles.has(filePath)) continue;
      seenFiles.add(filePath);
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
            args,
          );
          archivesScanned += archiveResult.archivesScanned;
          archivesSkippedUnreadable += archiveResult.archivesSkippedUnreadable;
          archiveEntriesScanned += archiveResult.archiveEntriesScanned;
          exactMatches.push(...archiveResult.exactMatches);
        }
        continue;
      }
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
    rootsSearched: unique(roots).map((root) => path.relative(REPO_ROOT, root)),
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
  args: Args,
) {
  const result = {
    archivesScanned: 1,
    archivesSkippedUnreadable: 0,
    archiveEntriesScanned: 0,
    exactMatches: [] as ArtifactMatch[],
  };
  const entries = listArchiveEntries(archivePath);
  if (entries === null) {
    result.archivesSkippedUnreadable = 1;
    return result;
  }
  for (const entry of entries) {
    if (!isArchiveEntryCandidate(entry, migration)) continue;
    const buffer = readArchiveEntry(archivePath, entry, args.maxFileBytes);
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

function isArchiveEntryCandidate(entry: string, migration: string) {
  const normalized = entry.toLowerCase();
  return (
    normalized.includes(migration.toLowerCase()) ||
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

function* walkFiles(
  root: string,
  options: { sqlOnly: boolean },
): Generator<string> {
  const skipNames = new Set([
    '.git',
    'node_modules',
    '.next',
    'dist',
    'build',
    'coverage',
    '.turbo',
    '.pnpm-store',
  ]);
  const entries = safeReadDir(root);
  for (const entry of entries) {
    if (skipNames.has(entry.name)) continue;
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(filePath, options);
      continue;
    }
    if (options.sqlOnly && !filePath.endsWith('.sql')) continue;
    yield filePath;
  }
}

function buildExternalRequest(row: ExternalArtifactRequestRow) {
  const mismatchText = row.selectedRecoveredSqlSha256
    ? ` The current git-recovered candidate has SHA-256 ${row.selectedRecoveredSqlSha256}, so it is not sufficient evidence.`
    : ' No local git-recovered candidate exists for this DB-applied migration.';
  return {
    subject: `Recover exact migration SQL for ${row.migration}`,
    request:
      `Please locate the exact applied SQL for apps/api/prisma/migrations/${row.migration}/migration.sql ` +
      `with SHA-256 ${row.dbChecksum}.${mismatchText}`,
    targetMigrationPath: `apps/api/prisma/migrations/${row.migration}/migration.sql`,
    requiredSha256: row.dbChecksum,
    knownMismatchSha256: row.selectedRecoveredSqlSha256,
  };
}

function buildAcceptableEvidence(row: ExternalArtifactRequestRow) {
  return [
    `A migration.sql file whose SHA-256 exactly equals ${row.dbChecksum}.`,
    'A deployment artifact, CI artifact, backup, release bundle, or teammate clone that contains that exact file.',
    'A documented decision that exact SQL cannot be recovered plus an approved non-production baseline/resolve packet.',
  ];
}

function buildRejectedEvidence(row: ExternalArtifactRequestRow) {
  return [
    row.selectedRecoveredSqlSha256
      ? `The current git candidate with SHA-256 ${row.selectedRecoveredSqlSha256}; it does not match the DB checksum.`
      : 'A reconstructed file with the right migration name but no exact checksum match.',
    'A manually edited migration file without checksum evidence.',
    'A production baseline/resolve decision; this packet does not approve production schema writes.',
  ];
}

function buildRecommendedSequence(status: PacketStatus) {
  if (status === 'PASS_NO_UNRESOLVED_MISMATCHES') {
    return [
      'Rerun migration checksum review and schema alignment planning to confirm the database blocker is cleared.',
    ];
  }
  if (status === 'REVIEW_EXACT_SQL_ARTIFACT_FOUND') {
    return [
      'Review exact local artifact matches and confirm their source.',
      'Restore the exact SQL only through an approved migration-history workflow.',
      'Rerun migration reconciliation, checksum review, baseline resolution, and schema alignment planning.',
    ];
  }
  return [
    'Send the external request packet to deployment artifact owners, backup owners, or teammates with older clones.',
    'Place any candidate artifact in a local intake directory and rerun this script with --candidate-root <dir> before considering baseline fallback.',
    'If exact SQL cannot be recovered, use audit:database-migration-baseline-resolution to create a non-production review packet.',
    'Do not run prisma migrate resolve, migrate deploy, or db push against valuable data from this packet.',
  ];
}

function buildCandidateIntake(rows: PacketRow[], args: Args) {
  const suggestedRoot = path.relative(
    REPO_ROOT,
    path.join(REPORT_ROOT, 'database-migration-external-candidate-intake'),
  );
  const manifestPath = path.join(suggestedRoot, 'TARGETS.json');
  const manifestDigestPath = path.join(suggestedRoot, 'TARGETS.sha256');
  const requestJsonPath = path.join(suggestedRoot, 'REQUEST.json');
  const requestMarkdownPath = path.join(suggestedRoot, 'REQUEST.md');
  const statusJsonPath = path.join(suggestedRoot, 'STATUS.json');
  const statusMarkdownPath = path.join(suggestedRoot, 'STATUS.md');
  return {
    manifestSchemaVersion: 1,
    manifestSha256: null as string | null,
    manifestSizeBytes: null as number | null,
    manifestDigestPath,
    requestJsonPath,
    requestMarkdownPath,
    statusJsonPath,
    statusMarkdownPath,
    status:
      rows.length > 0
        ? 'waiting_for_external_candidate_artifact'
        : 'no_external_candidate_required',
    candidateFilesPresent: 0,
    candidateSqlFilesPresent: 0,
    candidateArchiveFilesPresent: 0,
    generatedIntakeFilesPresent: 0,
    candidateFiles: [] as string[],
    suggestedCandidateRoot: suggestedRoot,
    manifestPath,
    sourceReportPath: path.relative(REPO_ROOT, args.out),
    sourceMarkdownPath: path.relative(REPO_ROOT, args.markdown),
    acceptedFileNames: ['migration.sql', '<migration-name>/migration.sql'],
    acceptedArchiveNames: [
      '<artifact>.zip containing migration.sql',
      '<artifact>.tar or <artifact>.tar.gz containing migration.sql',
      '<artifact>.tgz containing migration.sql',
      '<artifact>.sql.gz containing the exact SQL bytes',
    ],
    verificationCommand:
      `pnpm --filter api audit:database-migration-external-artifact-packet -- ` +
      `--candidate-root ${suggestedRoot} --scan-archives`,
    targetRows: rows.map((row) => ({
      migration: row.migration,
      sourceKind: row.sourceKind,
      targetMigrationPath: row.externalRequest.targetMigrationPath,
      requiredSha256: row.dbChecksum,
      requestSubject: row.externalRequest.subject,
    })),
    requestRows: rows.map((row) => ({
      migration: row.migration,
      sourceKind: row.sourceKind,
      subject: row.externalRequest.subject,
      request: row.externalRequest.request,
      targetMigrationPath: row.externalRequest.targetMigrationPath,
      requiredSha256: row.externalRequest.requiredSha256,
      knownMismatchSha256: row.externalRequest.knownMismatchSha256,
      acceptableEvidence: row.acceptableEvidence,
      rejectedEvidence: row.rejectedEvidence,
      nextAction: row.nextAction,
    })),
    guardrail:
      'This intake is only for checksum verification; do not copy candidates into apps/api/prisma/migrations or run Prisma write commands from this packet.',
    verificationChecklist: [
      'Place external candidates only under the suggested candidate root.',
      'Keep original artifact packaging where possible; archive candidates are read-only scanned with --scan-archives.',
      'Pass only if the packet reports exactArtifactMatches > 0 with the required SHA-256.',
      'Do not restore, copy, resolve, deploy, or baseline from an unverified candidate.',
    ],
    searchedRoots: args.candidateRoots.map((root) =>
      path.relative(REPO_ROOT, root),
    ),
  };
}

function writeCandidateIntakeManifest(
  generatedAt: string,
  candidateIntake: ReturnType<typeof buildCandidateIntake>,
) {
  const manifestPath = path.resolve(REPO_ROOT, candidateIntake.manifestPath);
  const manifest = {
    generatedAt,
    schemaVersion: candidateIntake.manifestSchemaVersion,
    status: candidateIntake.status,
    suggestedCandidateRoot: candidateIntake.suggestedCandidateRoot,
    sourceReportPath: candidateIntake.sourceReportPath,
    sourceMarkdownPath: candidateIntake.sourceMarkdownPath,
    verificationCommand: candidateIntake.verificationCommand,
    acceptedFileNames: candidateIntake.acceptedFileNames,
    acceptedArchiveNames: candidateIntake.acceptedArchiveNames,
    requiredExactSha256Match: true,
    targetRows: candidateIntake.targetRows,
    guardrail: candidateIntake.guardrail,
    verificationChecklist: candidateIntake.verificationChecklist,
    searchedRoots: candidateIntake.searchedRoots,
    prohibitedActionsBeforeExactMatch: [
      'copy into apps/api/prisma/migrations',
      'prisma migrate resolve',
      'prisma migrate deploy',
      'prisma db push',
      'SQL restore',
      'baseline fallback approval',
    ],
  };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  const sha256 = crypto.createHash('sha256').update(manifestJson).digest('hex');
  const digestPath = path.resolve(
    REPO_ROOT,
    candidateIntake.manifestDigestPath,
  );
  const digestContent = `${sha256}  ${path.basename(candidateIntake.manifestPath)}\n`;
  fs.writeFileSync(manifestPath, manifestJson);
  fs.writeFileSync(digestPath, digestContent);
  writeCandidateRequestArtifacts(generatedAt, candidateIntake, {
    manifestSha256: sha256,
    manifestSizeBytes: Buffer.byteLength(manifestJson),
  });
  return {
    sha256,
    sizeBytes: Buffer.byteLength(manifestJson),
    digestPath: candidateIntake.manifestDigestPath,
    requestJsonPath: candidateIntake.requestJsonPath,
    requestMarkdownPath: candidateIntake.requestMarkdownPath,
  };
}

function writeCandidateRequestArtifacts(
  generatedAt: string,
  candidateIntake: ReturnType<typeof buildCandidateIntake>,
  manifestDigest: { manifestSha256: string; manifestSizeBytes: number },
) {
  const requestJsonPath = path.resolve(
    REPO_ROOT,
    candidateIntake.requestJsonPath,
  );
  const requestMarkdownPath = path.resolve(
    REPO_ROOT,
    candidateIntake.requestMarkdownPath,
  );
  const request = {
    generatedAt,
    schemaVersion: candidateIntake.manifestSchemaVersion,
    status: candidateIntake.status,
    suggestedCandidateRoot: candidateIntake.suggestedCandidateRoot,
    manifestPath: candidateIntake.manifestPath,
    manifestDigestPath: candidateIntake.manifestDigestPath,
    manifestSha256: manifestDigest.manifestSha256,
    manifestSizeBytes: manifestDigest.manifestSizeBytes,
    verificationCommand: candidateIntake.verificationCommand,
    acceptedFileNames: candidateIntake.acceptedFileNames,
    acceptedArchiveNames: candidateIntake.acceptedArchiveNames,
    requestRows: candidateIntake.requestRows,
    guardrail: candidateIntake.guardrail,
    verificationChecklist: candidateIntake.verificationChecklist,
    prohibitedActionsBeforeExactMatch: [
      'copy into apps/api/prisma/migrations',
      'prisma migrate resolve',
      'prisma migrate deploy',
      'prisma db push',
      'SQL restore',
      'baseline fallback approval',
    ],
  };
  fs.writeFileSync(requestJsonPath, `${JSON.stringify(request, null, 2)}\n`);
  fs.writeFileSync(
    requestMarkdownPath,
    renderCandidateRequestMarkdown(request),
    'utf8',
  );
}

function renderCandidateRequestMarkdown(request: {
  generatedAt: string;
  status: string;
  suggestedCandidateRoot: string;
  manifestPath: string;
  manifestDigestPath: string;
  manifestSha256: string;
  manifestSizeBytes: number;
  verificationCommand: string;
  acceptedFileNames: string[];
  acceptedArchiveNames: string[];
  requestRows: Array<{
    migration: string;
    sourceKind: string;
    subject: string;
    request: string;
    targetMigrationPath: string;
    requiredSha256: string | null;
    knownMismatchSha256: string | null;
    acceptableEvidence: string[];
    rejectedEvidence: string[];
    nextAction: string;
  }>;
  guardrail: string;
  verificationChecklist: string[];
  prohibitedActionsBeforeExactMatch: string[];
}) {
  const lines = [
    '# Database Migration Exact SQL Recovery Request',
    '',
    `Status: ${request.status}`,
    `Generated at: ${request.generatedAt}`,
    `Candidate root: ${request.suggestedCandidateRoot}`,
    `Target manifest: ${request.manifestPath}`,
    `Target manifest digest sidecar: ${request.manifestDigestPath}`,
    `Target manifest SHA-256: ${request.manifestSha256}`,
    `Target manifest size bytes: ${request.manifestSizeBytes}`,
    '',
    '## Request',
    '',
    ...request.requestRows.flatMap((row) => [
      `### ${row.subject}`,
      '',
      row.request,
      '',
      `- migration: ${row.migration}`,
      `- source kind: ${row.sourceKind}`,
      `- target path: ${row.targetMigrationPath}`,
      `- required SHA-256: ${row.requiredSha256 ?? 'unknown'}`,
      `- known mismatch SHA-256: ${row.knownMismatchSha256 ?? 'none'}`,
      `- next action: ${row.nextAction}`,
      '',
      'Acceptable evidence:',
      ...row.acceptableEvidence.map((item) => `- ${item}`),
      '',
      'Rejected evidence:',
      ...row.rejectedEvidence.map((item) => `- ${item}`),
      '',
    ]),
    '## Candidate Shapes',
    '',
    ...request.acceptedFileNames.map((item) => `- ${item}`),
    ...request.acceptedArchiveNames.map((item) => `- ${item}`),
    '',
    '## Verification',
    '',
    '```bash',
    request.verificationCommand,
    '```',
    '',
    request.guardrail,
    '',
    'Verification checklist:',
    ...request.verificationChecklist.map((item) => `- ${item}`),
    '',
    'Prohibited before exact match:',
    ...request.prohibitedActionsBeforeExactMatch.map((item) => `- ${item}`),
    '',
  ];
  return `${lines.join('\n')}`;
}

function writeCandidateStatusArtifacts(report: {
  generatedAt: string;
  status: PacketStatus;
  summary: Record<string, unknown>;
  candidateIntake: ReturnType<typeof buildCandidateIntake>;
  rows: PacketRow[];
  nextCampaign: ReturnType<typeof buildNextCampaign>;
}) {
  const statusJsonPath = path.resolve(
    REPO_ROOT,
    report.candidateIntake.statusJsonPath,
  );
  const statusMarkdownPath = path.resolve(
    REPO_ROOT,
    report.candidateIntake.statusMarkdownPath,
  );
  const exactMatches = report.rows.flatMap(
    (row) => row.artifactSearch.exactMatches,
  );
  const candidateFileSummary = summarizeCandidateIntakeFiles(
    report.candidateIntake,
  );
  const statusArtifact = {
    generatedAt: report.generatedAt,
    packetStatus: report.status,
    intakeStatus: report.candidateIntake.status,
    candidateRoot: candidateFileSummary.root,
    candidateFilesPresent: candidateFileSummary.candidateFilesPresent,
    candidateSqlFilesPresent: candidateFileSummary.candidateSqlFilesPresent,
    candidateArchiveFilesPresent:
      candidateFileSummary.candidateArchiveFilesPresent,
    generatedIntakeFilesPresent:
      candidateFileSummary.generatedIntakeFilesPresent,
    candidateFiles: candidateFileSummary.candidateFiles,
    exactArtifactMatches: report.summary.exactArtifactMatches,
    filesScanned: report.summary.filesScanned,
    archivesScanned: report.summary.archivesScanned,
    archiveEntriesScanned: report.summary.archiveEntriesScanned,
    sourceReportPath: report.candidateIntake.sourceReportPath,
    sourceMarkdownPath: report.candidateIntake.sourceMarkdownPath,
    manifestPath: report.candidateIntake.manifestPath,
    manifestDigestPath: report.candidateIntake.manifestDigestPath,
    manifestSha256: report.candidateIntake.manifestSha256,
    manifestSizeBytes: report.candidateIntake.manifestSizeBytes,
    requestJsonPath: report.candidateIntake.requestJsonPath,
    requestMarkdownPath: report.candidateIntake.requestMarkdownPath,
    verificationCommand: report.candidateIntake.verificationCommand,
    targetRows: report.candidateIntake.targetRows,
    exactMatches,
    nextCampaign: report.nextCampaign,
    nextAction:
      exactMatches.length > 0
        ? 'review-exact-sql-candidate-before-restore'
        : 'continue-external-exact-sql-recovery',
    guardrail: report.candidateIntake.guardrail,
  };
  fs.writeFileSync(
    statusJsonPath,
    `${JSON.stringify(statusArtifact, null, 2)}\n`,
  );
  fs.writeFileSync(
    statusMarkdownPath,
    renderCandidateStatusMarkdown(statusArtifact),
    'utf8',
  );
}

function summarizeCandidateIntakeFiles(
  candidateIntake: ReturnType<typeof buildCandidateIntake>,
): CandidateIntakeFileSummary {
  const root = candidateIntake.suggestedCandidateRoot;
  const rootPath = path.resolve(REPO_ROOT, root);
  const candidateFiles: string[] = [];
  const generatedFilesFound = new Set<string>();
  let generatedIntakeFilesPresent = 0;

  if (!fs.existsSync(rootPath)) {
    return {
      root,
      candidateFilesPresent: 0,
      candidateSqlFilesPresent: 0,
      candidateArchiveFilesPresent: 0,
      generatedIntakeFilesPresent: 0,
      candidateFiles: [],
    };
  }

  for (const filePath of walkFiles(rootPath, { sqlOnly: false })) {
    const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');
    if (GENERATED_INTAKE_FILE_NAMES.has(relativePath)) {
      generatedFilesFound.add(relativePath);
      generatedIntakeFilesPresent += 1;
      continue;
    }
    candidateFiles.push(relativePath);
  }

  for (const statusFileName of ['STATUS.json', 'STATUS.md']) {
    if (!generatedFilesFound.has(statusFileName)) {
      generatedIntakeFilesPresent += 1;
    }
  }

  candidateFiles.sort((left, right) => left.localeCompare(right));
  return {
    root,
    candidateFilesPresent: candidateFiles.length,
    candidateSqlFilesPresent: candidateFiles.filter((filePath) =>
      filePath.toLowerCase().endsWith('.sql'),
    ).length,
    candidateArchiveFilesPresent: candidateFiles.filter((filePath) =>
      isArchivePath(filePath),
    ).length,
    generatedIntakeFilesPresent,
    candidateFiles: candidateFiles.slice(0, 50),
  };
}

function renderCandidateStatusMarkdown(status: {
  generatedAt: string;
  packetStatus: PacketStatus;
  intakeStatus: string;
  candidateRoot: string;
  candidateFilesPresent: number;
  candidateSqlFilesPresent: number;
  candidateArchiveFilesPresent: number;
  generatedIntakeFilesPresent: number;
  candidateFiles: string[];
  exactArtifactMatches: unknown;
  filesScanned: unknown;
  archivesScanned: unknown;
  archiveEntriesScanned: unknown;
  sourceReportPath: string;
  sourceMarkdownPath: string;
  manifestPath: string;
  manifestDigestPath: string;
  manifestSha256: string | null;
  manifestSizeBytes: number | null;
  requestJsonPath: string;
  requestMarkdownPath: string;
  verificationCommand: string;
  targetRows: ReturnType<typeof buildCandidateIntake>['targetRows'];
  exactMatches: ArtifactMatch[];
  nextCampaign: ReturnType<typeof buildNextCampaign>;
  nextAction: string;
  guardrail: string;
}) {
  const lines = [
    '# Database Migration Candidate Intake Status',
    '',
    `Packet status: ${status.packetStatus}`,
    `Intake status: ${status.intakeStatus}`,
    `Generated at: ${status.generatedAt}`,
    `Next action: ${status.nextAction}`,
    '',
    '## Scan Summary',
    '',
    `- candidate root: ${status.candidateRoot}`,
    `- candidate files present: ${status.candidateFilesPresent}`,
    `- candidate SQL files present: ${status.candidateSqlFilesPresent}`,
    `- candidate archive files present: ${status.candidateArchiveFilesPresent}`,
    `- generated intake files present: ${status.generatedIntakeFilesPresent}`,
    `- exact artifact matches: ${status.exactArtifactMatches}`,
    `- files scanned: ${status.filesScanned}`,
    `- archives scanned: ${status.archivesScanned}`,
    `- archive entries scanned: ${status.archiveEntriesScanned}`,
    `- latest report: ${status.sourceReportPath}`,
    `- latest Markdown: ${status.sourceMarkdownPath}`,
    '',
    '## Intake Files',
    '',
    `- target manifest: ${status.manifestPath}`,
    `- target manifest digest sidecar: ${status.manifestDigestPath}`,
    `- target manifest SHA-256: ${status.manifestSha256 ?? 'unknown'}`,
    `- target manifest size bytes: ${status.manifestSizeBytes ?? 'unknown'}`,
    `- request JSON: ${status.requestJsonPath}`,
    `- request Markdown: ${status.requestMarkdownPath}`,
    '',
    '## Candidate Files',
    '',
    ...(status.candidateFiles.length > 0
      ? status.candidateFiles.map((filePath) => `- ${filePath}`)
      : ['- none']),
    '',
    '## Targets',
    '',
    ...(status.targetRows.length > 0
      ? status.targetRows.flatMap((target) => [
          `- ${target.migration}`,
          `  - target path: ${target.targetMigrationPath}`,
          `  - required SHA-256: ${target.requiredSha256}`,
          `  - source kind: ${target.sourceKind}`,
        ])
      : ['- none']),
    '',
    '## Exact Matches',
    '',
    ...(status.exactMatches.length > 0
      ? status.exactMatches.map(
          (match) =>
            `- ${match.path} (${match.source}, sha256=${match.sha256}, bytes=${match.sizeBytes})`,
        )
      : ['- none']),
    '',
    '## Verification',
    '',
    '```bash',
    status.verificationCommand,
    '```',
    '',
    status.guardrail,
    '',
  ];
  return `${lines.join('\n')}`;
}

function buildNextCampaign(status: PacketStatus, rows: PacketRow[]) {
  if (status === 'PASS_NO_UNRESOLVED_MISMATCHES') {
    return {
      id: 'database_migration_schema_alignment_recheck',
      reason:
        'No unresolved exact-SQL recovery request remains; rerun migration checksum review and schema alignment.',
    };
  }
  if (status === 'REVIEW_EXACT_SQL_ARTIFACT_FOUND') {
    return {
      id: 'database_migration_checksum_review',
      reason:
        'An exact SQL artifact candidate exists; review/restore it, then rerun checksum review and schema alignment.',
    };
  }
  const targetRow = rows[0];
  return {
    id: 'database_migration_external_exact_sql_recovery',
    reason:
      'Exact applied SQL has not been found locally or in scanned candidate artifacts; request deployment artifacts, backups, CI release bundles, or teammate clones before baseline fallback.',
    migration: targetRow?.migration ?? null,
    recommendedAction: 'request-exact-sql-from-deployment-backup-or-team-clone',
  };
}

function renderMarkdown(report: {
  generatedAt: string;
  status: PacketStatus;
  summary: Record<string, unknown>;
  candidateIntake: ReturnType<typeof buildCandidateIntake>;
  rows: Array<{
    sourceKind: ExternalArtifactRequestRow['sourceKind'];
    migration: string;
    dbChecksum: string | null;
    selectedRecoveredSqlSha256: string | null;
    artifactSearch: ArtifactSearchResult;
    externalRequest: {
      subject: string;
      request: string;
      targetMigrationPath: string;
      requiredSha256: string | null;
      knownMismatchSha256: string | null;
    };
    acceptableEvidence: string[];
    rejectedEvidence: string[];
    nextAction: string;
  }>;
  recommendedSequence: string[];
}) {
  const lines = [
    '# Database Migration External Artifact Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
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
    '## Candidate Intake',
    '',
    `- status: ${report.candidateIntake.status}`,
    `- suggested candidate root: ${report.candidateIntake.suggestedCandidateRoot}`,
    `- machine-readable target manifest: ${report.candidateIntake.manifestPath}`,
    `- target manifest digest sidecar: ${report.candidateIntake.manifestDigestPath}`,
    `- target manifest SHA-256: ${report.candidateIntake.manifestSha256 ?? 'pending'}`,
    `- target manifest size bytes: ${report.candidateIntake.manifestSizeBytes ?? 'pending'}`,
    `- exact SQL request JSON: ${report.candidateIntake.requestJsonPath}`,
    `- exact SQL request Markdown: ${report.candidateIntake.requestMarkdownPath}`,
    `- intake status JSON: ${report.candidateIntake.statusJsonPath}`,
    `- intake status Markdown: ${report.candidateIntake.statusMarkdownPath}`,
    `- source report path: ${report.candidateIntake.sourceReportPath}`,
    `- source markdown path: ${report.candidateIntake.sourceMarkdownPath}`,
    `- accepted file names: ${report.candidateIntake.acceptedFileNames.join(', ')}`,
    `- accepted archive names: ${report.candidateIntake.acceptedArchiveNames.join(', ')}`,
    `- verification command: ${report.candidateIntake.verificationCommand}`,
    `- guardrail: ${report.candidateIntake.guardrail}`,
    `- searched roots: ${report.candidateIntake.searchedRoots.join(', ')}`,
    '- verification checklist:',
    ...report.candidateIntake.verificationChecklist.map(
      (item) => `  - ${item}`,
    ),
    '',
    '### Candidate Intake Targets',
    '',
    ...(report.candidateIntake.targetRows.length > 0
      ? report.candidateIntake.targetRows.flatMap((target) => [
          `- ${target.migration}`,
          `  - subject: ${target.requestSubject}`,
          `  - source kind: ${target.sourceKind}`,
          `  - target path: ${target.targetMigrationPath}`,
          `  - required SHA-256: ${target.requiredSha256}`,
        ])
      : ['- none']),
    '',
    '## Requests',
    '',
    ...report.rows.flatMap((row) => [
      `### ${row.migration}`,
      '',
      `Source kind: ${row.sourceKind}`,
      `Next action: ${row.nextAction}`,
      `DB checksum: ${row.dbChecksum}`,
      `Known mismatch SHA-256: ${row.selectedRecoveredSqlSha256}`,
      `Files scanned locally: ${row.artifactSearch.filesScanned}`,
      `Archives scanned locally: ${row.artifactSearch.archivesScanned}`,
      `Archive entries scanned locally: ${row.artifactSearch.archiveEntriesScanned}`,
      `Exact local matches: ${row.artifactSearch.exactMatches.length}`,
      '',
      'Request:',
      '',
      row.externalRequest.request,
      '',
      'Acceptable evidence:',
      '',
      ...row.acceptableEvidence.map((item) => `- ${item}`),
      '',
      'Rejected evidence:',
      '',
      ...row.rejectedEvidence.map((item) => `- ${item}`),
      '',
    ]),
  ];
  return `${lines.join('\n')}\n`;
}

function printSummary(
  out: string,
  markdown: string,
  report: {
    status: PacketStatus;
    summary: Record<string, unknown>;
  },
) {
  console.log(
    [
      `Database migration external artifact packet status: ${report.status}`,
      `Unresolved mismatch rows: ${report.summary.unresolvedMismatchRows}`,
      `Unresolved unrecoverable rows: ${report.summary.unresolvedUnrecoverableRows}`,
      `External request rows: ${report.summary.externalRequestRows}`,
      `Exact artifact matches: ${report.summary.exactArtifactMatches}`,
      `Files scanned: ${report.summary.filesScanned}`,
      `JSON: ${out}`,
      `Markdown: ${markdown}`,
    ].join('\n'),
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values));
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

main();
