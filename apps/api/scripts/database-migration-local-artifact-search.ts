#!/usr/bin/env tsx
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

type SearchStatus =
  | 'REVIEW_EXACT_SQL_ARTIFACT_FOUND'
  | 'BLOCKED_EXACT_SQL_NOT_FOUND'
  | 'BLOCKED_NO_TARGET_CHECKSUM';

interface Args {
  checksumReview: string | null;
  unrecoverableArtifactSearch: string | null;
  out: string;
  markdown: string;
  migration: string | null;
  targetSha256: string | null;
  candidateRoots: string[];
  maxFileBytes: number;
  maxFiles: number;
}

interface ChecksumReviewReport {
  rows: Array<{
    migration: string;
    dbChecksum: string | null;
    selectedRecoveredSqlSha256: string | null;
  }>;
}

interface UnrecoverableArtifactSearchReport {
  generatedAt?: string;
  status?: string;
  rows?: Array<{
    migration: string;
    dbChecksum: string | null;
    artifactSearch?: {
      exactMatches?: Array<Record<string, unknown>>;
    };
  }>;
}

interface Candidate {
  path: string;
  sizeBytes: number;
  sha256: string;
  exactMatch: boolean;
  sourceHint: string;
}

const API_ROOT = detectApiRoot();
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const DEFAULT_MIGRATION = '20260309_fix_production_schema';
const DEFAULT_CANDIDATE_ROOTS = [
  REPO_ROOT,
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'Desktop'),
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
  const defaultOut = path.join(
    REPORT_ROOT,
    `database-migration-local-artifact-search-${stamp}.json`,
  );
  const out = path.resolve(API_ROOT, get('--out', defaultOut)!);
  const checksumReview = get('--checksum-review');
  const unrecoverableArtifactSearch = get('--unrecoverable-artifact-search');
  const candidateRootArgs = getAll('--candidate-root');

  return {
    checksumReview: checksumReview
      ? resolveInputArtifactPath(checksumReview)
      : findLatestChecksumReview(),
    unrecoverableArtifactSearch: unrecoverableArtifactSearch
      ? resolveInputArtifactPath(unrecoverableArtifactSearch)
      : findLatestOptional(
          /^database-migration-unrecoverable-artifact-search-.+\.json$/,
        ),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    migration: get('--migration') ?? null,
    targetSha256: get('--target-sha256') ?? null,
    candidateRoots: unique(
      (candidateRootArgs.length ? candidateRootArgs : DEFAULT_CANDIDATE_ROOTS)
        .map((root) => path.resolve(API_ROOT, root))
        .filter((root) => fs.existsSync(root)),
    ),
    maxFileBytes: Number(get('--max-file-bytes', `${5 * 1024 * 1024}`)),
    maxFiles: Number(get('--max-files', '50000')),
  };
}

function main() {
  const args = parseArgs();
  const target = resolveTarget(args);
  const candidates =
    target.targetSha256 && target.migration
      ? searchCandidates(target.migration, target.targetSha256, args)
      : [];
  const exactMatches = candidates.filter((candidate) => candidate.exactMatch);
  const status: SearchStatus = !target.targetSha256
    ? 'BLOCKED_NO_TARGET_CHECKSUM'
    : exactMatches.length > 0
      ? 'REVIEW_EXACT_SQL_ARTIFACT_FOUND'
      : 'BLOCKED_EXACT_SQL_NOT_FOUND';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-migration-local-artifact-search',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    sourceChecksumReview: args.checksumReview
      ? path.relative(API_ROOT, args.checksumReview)
      : null,
    sourceUnrecoverableArtifactSearch: args.unrecoverableArtifactSearch
      ? path.relative(API_ROOT, args.unrecoverableArtifactSearch)
      : null,
    target,
    searchConfig: {
      candidateRoots: args.candidateRoots.map((root) =>
        path.relative(REPO_ROOT, root),
      ),
      maxFileBytes: args.maxFileBytes,
      maxFiles: args.maxFiles,
      pathFilter:
        'Only files named migration.sql or .sql files whose path includes the migration name are read.',
    },
    summary: {
      candidateFilesRead: candidates.length,
      exactMatches: exactMatches.length,
      nonMatchingCandidates: candidates.length - exactMatches.length,
    },
    candidates,
    recommendedSequence: buildRecommendedSequence(status),
    nextCampaign:
      status === 'REVIEW_EXACT_SQL_ARTIFACT_FOUND'
        ? {
            id: 'database_migration_checksum_review',
            reason:
              'Exact local SQL artifact found; review/restore through the approved migration-history workflow.',
          }
        : {
            id: 'database_migration_external_artifact_recovery',
            reason:
              'No exact SQL artifact found in controlled local roots; continue external artifact recovery or baseline review.',
          },
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  printSummary(args.out, args.markdown, report);
}

function findLatestChecksumReview() {
  if (!fs.existsSync(REPORT_ROOT)) return null;
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
  return latest ? path.join(REPORT_ROOT, latest.file) : null;
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

function resolveTarget(args: Args) {
  if (args.migration && args.targetSha256) {
    return {
      migration: args.migration,
      targetSha256: args.targetSha256,
      selectedRecoveredSqlSha256: null,
      sourceKind: 'target_override',
    };
  }
  const checksumRow = readChecksumTargetRow(args);
  if (checksumRow?.dbChecksum) {
    return {
      migration: args.migration ?? checksumRow.migration,
      targetSha256: args.targetSha256 ?? checksumRow.dbChecksum,
      selectedRecoveredSqlSha256:
        checksumRow.selectedRecoveredSqlSha256 ?? null,
      sourceKind: 'checksum_mismatch',
    };
  }
  const unrecoverableRow = readUnrecoverableTargetRow(args);
  if (unrecoverableRow?.dbChecksum) {
    return {
      migration: args.migration ?? unrecoverableRow.migration,
      targetSha256: args.targetSha256 ?? unrecoverableRow.dbChecksum,
      selectedRecoveredSqlSha256: null,
      sourceKind: 'unrecoverable_migration',
    };
  }
  return {
    migration: args.migration ?? DEFAULT_MIGRATION,
    targetSha256: args.targetSha256,
    selectedRecoveredSqlSha256: null,
    sourceKind: 'missing_target_checksum',
  };
}

function readChecksumTargetRow(args: Args) {
  if (!args.checksumReview || !fs.existsSync(args.checksumReview)) return null;
  const report = JSON.parse(
    fs.readFileSync(args.checksumReview, 'utf8'),
  ) as ChecksumReviewReport;
  return (
    report.rows.find((item) => item.migration === (args.migration ?? '')) ??
    report.rows.find((item) => item.migration === DEFAULT_MIGRATION) ??
    report.rows[0] ??
    null
  );
}

function readUnrecoverableTargetRow(args: Args) {
  if (
    !args.unrecoverableArtifactSearch ||
    !fs.existsSync(args.unrecoverableArtifactSearch)
  ) {
    return null;
  }
  const report = JSON.parse(
    fs.readFileSync(args.unrecoverableArtifactSearch, 'utf8'),
  ) as UnrecoverableArtifactSearchReport;
  return (
    (report.rows ?? []).find((item) => item.migration === args.migration) ??
    (report.rows ?? []).find(
      (item) => (item.artifactSearch?.exactMatches ?? []).length === 0,
    ) ??
    report.rows?.[0] ??
    null
  );
}

function searchCandidates(migration: string, targetSha256: string, args: Args) {
  const candidates: Candidate[] = [];
  let visitedFiles = 0;
  for (const root of args.candidateRoots) {
    for (const filePath of walkFiles(root)) {
      visitedFiles += 1;
      if (visitedFiles > args.maxFiles) return candidates;
      if (!isCandidatePath(filePath, migration)) continue;
      const stat = safeStat(filePath);
      if (!stat?.isFile() || stat.size > args.maxFileBytes) continue;
      const buffer = safeRead(filePath);
      if (!buffer) continue;
      const digest = sha256(buffer);
      candidates.push({
        path: path.relative(REPO_ROOT, filePath),
        sizeBytes: stat.size,
        sha256: digest,
        exactMatch: digest === targetSha256,
        sourceHint: inferSourceHint(filePath),
      });
    }
  }
  return candidates.sort(
    (a, b) =>
      Number(b.exactMatch) - Number(a.exactMatch) ||
      a.path.localeCompare(b.path),
  );
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
    } else if (entry.isFile()) {
      yield filePath;
    }
  }
}

function isCandidatePath(filePath: string, migration: string) {
  const normalized = filePath.toLowerCase();
  return (
    normalized.includes(migration.toLowerCase()) &&
    (normalized.endsWith('/migration.sql') || normalized.endsWith('.sql'))
  );
}

function inferSourceHint(filePath: string) {
  if (filePath.includes('/Downloads/')) return 'downloads';
  if (filePath.includes('/Desktop/')) return 'desktop';
  if (filePath.startsWith(REPO_ROOT)) return 'repository';
  return 'local-candidate-root';
}

function buildRecommendedSequence(status: SearchStatus) {
  if (status === 'BLOCKED_NO_TARGET_CHECKSUM') {
    return [
      'Provide --checksum-review or --target-sha256 before local artifact search can prove an exact match.',
    ];
  }
  if (status === 'REVIEW_EXACT_SQL_ARTIFACT_FOUND') {
    return [
      'Review the exact local SQL artifact source and integrity.',
      'Feed its directory to audit:database-migration-external-artifact-packet with --candidate-root.',
      'Restore only through an approved migration-history workflow, then rerun reconciliation and schema alignment.',
    ];
  }
  return [
    'Continue external artifact recovery from deployment artifacts, backups, or teammate clones.',
    'Drop any candidate directory locally and rerun this script with --candidate-root <dir>.',
    'If exact SQL cannot be recovered, use the non-production baseline/resolve decision gate.',
  ];
}

function renderMarkdown(report: {
  generatedAt: string;
  status: SearchStatus;
  destructiveDbWriteAllowedByThisPlan: boolean;
  target: {
    migration: string | null;
    targetSha256: string | null;
    selectedRecoveredSqlSha256: string | null;
    sourceKind: string;
  };
  searchConfig: { candidateRoots: string[]; pathFilter: string };
  summary: Record<string, unknown>;
  candidates: Candidate[];
  recommendedSequence: string[];
}) {
  const lines = [
    '# Database Migration Local Artifact Search',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Destructive DB write allowed: ${report.destructiveDbWriteAllowedByThisPlan}`,
    '',
    '## Target',
    '',
    `- migration: ${report.target.migration}`,
    `- source kind: ${report.target.sourceKind}`,
    `- target SHA-256: ${report.target.targetSha256}`,
    `- known mismatch SHA-256: ${report.target.selectedRecoveredSqlSha256}`,
    '',
    '## Search Config',
    '',
    `- roots: ${report.searchConfig.candidateRoots.join(', ') || 'none'}`,
    `- path filter: ${report.searchConfig.pathFilter}`,
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
    '## Candidates',
    '',
    ...(report.candidates.length
      ? report.candidates.map(
          (candidate) =>
            `- ${candidate.exactMatch ? 'EXACT' : 'MISS'} ${candidate.sha256} ${candidate.path}`,
        )
      : ['- none']),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function printSummary(
  out: string,
  markdown: string,
  report: { status: SearchStatus; summary: Record<string, unknown> },
) {
  console.log(
    [
      `Database migration local artifact search status: ${report.status}`,
      `Candidate files read: ${report.summary.candidateFilesRead}`,
      `Exact matches: ${report.summary.exactMatches}`,
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
