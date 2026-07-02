#!/usr/bin/env tsx
import * as crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

type ReviewStatus =
  'PASS' | 'BLOCKED_EXACT_SQL_NOT_FOUND' | 'REVIEW_EXACT_SQL_FOUND';

interface Args {
  reconciliation: string;
  out: string;
  markdown: string;
  includeUnreachable: boolean;
}

interface ReconciliationRow {
  migration: string;
  disposition: string;
  currentPath: string;
  recoveredFromSpec: string | null;
  recoveredSqlSha256: string | null;
  dbChecksum: string | null;
  checksumMatchesDb: boolean | null;
  recoverableCandidateCount?: number;
}

interface ReconciliationReport {
  generatedAt: string;
  status: string;
  rows: ReconciliationRow[];
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
    `database-migration-checksum-review-${stamp}.json`,
  );
  const out = path.resolve(API_ROOT, get('--out', defaultOut)!);
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
    includeUnreachable: argv.includes('--include-unreachable'),
  };
}

function main() {
  const args = parseArgs();
  const reconciliation = JSON.parse(
    fs.readFileSync(args.reconciliation, 'utf8'),
  ) as ReconciliationReport;
  const mismatchRows = reconciliation.rows.filter(
    (row) => row.checksumMatchesDb === false,
  );
  const reviews = mismatchRows.map((row) => reviewMismatch(row, args));
  const exactMatches = reviews.reduce(
    (sum, row) => sum + row.exactMatchLocations.length,
    0,
  );
  const status: ReviewStatus =
    mismatchRows.length === 0
      ? 'PASS'
      : exactMatches > 0
        ? 'REVIEW_EXACT_SQL_FOUND'
        : 'BLOCKED_EXACT_SQL_NOT_FOUND';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-migration-checksum-review',
    status,
    sourceReconciliation: path.relative(API_ROOT, args.reconciliation),
    reconciliationGeneratedAt: reconciliation.generatedAt,
    reconciliationStatus: reconciliation.status,
    searchScope: {
      currentWorkspace: true,
      gitPathHistory: true,
      gitStashes: true,
      unreachableBlobs: args.includeUnreachable,
    },
    summary: {
      checksumMismatchRows: mismatchRows.length,
      exactMatchLocations: exactMatches,
      unresolvedMismatches: reviews.filter(
        (row) => row.exactMatchLocations.length === 0,
      ).length,
    },
    rows: reviews,
    recommendedSequence: buildRecommendedSequence(status),
    nextCampaign:
      status === 'PASS'
        ? {
            id: 'database_migration_history_reconciliation',
            reason:
              'No checksum mismatch rows remain; rerun reconciliation and alignment planning.',
          }
        : {
            id: 'database_migration_checksum_review',
            reason:
              'Resolve exact SQL mismatch or document baseline/resolve decision before schema migration work continues.',
          },
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  printSummary(args.out, args.markdown, report);
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

function reviewMismatch(row: ReconciliationRow, args: Args) {
  const target = row.dbChecksum;
  const relPath = path.join(
    'apps',
    'api',
    'prisma',
    'migrations',
    row.migration,
    'migration.sql',
  );
  const currentPath = path.join(REPO_ROOT, relPath);
  const exactMatchLocations: Array<Record<string, unknown>> = [];
  const currentWorkspace = fs.existsSync(currentPath)
    ? hashBuffer(fs.readFileSync(currentPath))
    : null;
  if (target && currentWorkspace?.sha256 === target) {
    exactMatchLocations.push({
      source: 'current-workspace',
      path: relPath,
      sha256: currentWorkspace.sha256,
    });
  }

  const gitCandidates = collectGitPathCandidates(relPath);
  for (const candidate of gitCandidates) {
    if (target && candidate.sha256 === target) {
      exactMatchLocations.push({
        source: 'git-path-history',
        spec: candidate.spec,
        sha256: candidate.sha256,
      });
    }
  }

  const stashMatches = collectStashPathMatches(relPath, target);
  exactMatchLocations.push(...stashMatches);

  const unreachableMatches = args.includeUnreachable
    ? collectUnreachableBlobMatches(target)
    : [];
  exactMatchLocations.push(...unreachableMatches);

  return {
    migration: row.migration,
    dbChecksum: target,
    selectedRecoveredFromSpec: row.recoveredFromSpec,
    selectedRecoveredSqlSha256: row.recoveredSqlSha256,
    currentWorkspace: currentWorkspace
      ? {
          exists: true,
          sha256: currentWorkspace.sha256,
          lineCount: currentWorkspace.text.split(/\r?\n/).length,
        }
      : { exists: false },
    gitPathHistory: {
      candidateCount: gitCandidates.length,
      candidates: gitCandidates.map((candidate) => ({
        spec: candidate.spec,
        sha256: candidate.sha256,
        lineCount: candidate.text.split(/\r?\n/).length,
      })),
    },
    stashPathMatches: stashMatches,
    unreachableBlobExactMatches: unreachableMatches,
    exactMatchLocations,
    disposition:
      exactMatchLocations.length > 0
        ? 'exact-sql-found-review-restore'
        : 'exact-sql-not-found-baseline-or-external-artifact-required',
    decisionRequired:
      exactMatchLocations.length > 0
        ? 'Review exact match and restore only through approved migration-history workflow.'
        : 'Find exact SQL from external backup/deployment artifact, or document baseline/resolve decision for this database.',
  };
}

function collectGitPathCandidates(relPath: string) {
  const commits = gitText(['log', '--all', '--format=%H', '--', relPath])
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const candidates: Array<{ spec: string; sha256: string; text: string }> = [];
  for (const commit of commits) {
    for (const spec of [`${commit}:${relPath}`, `${commit}^:${relPath}`]) {
      if (seen.has(spec)) continue;
      seen.add(spec);
      const text = gitText(['show', spec], true);
      if (text === null) continue;
      candidates.push({ spec, sha256: sha256(text), text });
    }
  }
  return candidates;
}

function collectStashPathMatches(relPath: string, target: string | null) {
  if (!target) return [];
  const stashes = gitText(['stash', 'list', '--format=%gd'])
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const matches: Array<Record<string, unknown>> = [];
  for (const stash of stashes) {
    const text = gitText(['show', `${stash}:${relPath}`], true);
    if (text === null) continue;
    const digest = sha256(text);
    if (digest === target) {
      matches.push({
        source: 'git-stash',
        stash,
        path: relPath,
        sha256: digest,
      });
    }
  }
  return matches;
}

function collectUnreachableBlobMatches(target: string | null) {
  if (!target) return [];
  const fsck = gitText(
    ['fsck', '--full', '--no-reflogs', '--unreachable'],
    true,
  );
  if (fsck === null) return [];
  const blobIds = fsck
    .split('\n')
    .map((line) => line.match(/unreachable blob ([a-f0-9]+)/)?.[1])
    .filter((value): value is string => Boolean(value));
  const matches: Array<Record<string, unknown>> = [];
  for (const blobId of blobIds) {
    const size = Number(gitText(['cat-file', '-s', blobId], true) ?? 0);
    if (!Number.isFinite(size) || size > 5 * 1024 * 1024) continue;
    const content = gitBuffer(['cat-file', '-p', blobId], true);
    if (content === null) continue;
    const digest = hashBuffer(content).sha256;
    if (digest === target) {
      matches.push({
        source: 'unreachable-blob',
        blobId,
        size,
        sha256: digest,
      });
    }
  }
  return matches;
}

function buildRecommendedSequence(status: ReviewStatus) {
  if (status === 'PASS') {
    return ['Rerun migration reconciliation and schema alignment planning.'];
  }
  if (status === 'REVIEW_EXACT_SQL_FOUND') {
    return [
      'Review exact SQL match locations.',
      'Restore the exact file only through an approved migration-history workflow.',
      'Rerun migration reconciliation and schema alignment planning.',
    ];
  }
  return [
    'Try to locate the exact applied SQL from external deployment artifacts, backups, or teammate clones.',
    'If exact SQL cannot be recovered, document an explicit baseline/resolve decision for this database.',
    'Do not run migrate deploy against valuable data while checksum mismatch remains unresolved.',
    'After resolution, rerun schema compatibility, migration reconciliation, and schema alignment planning.',
  ];
}

function renderMarkdown(report: {
  generatedAt: string;
  status: ReviewStatus;
  summary: Record<string, unknown>;
  rows: Array<{
    migration: string;
    dbChecksum: string | null;
    selectedRecoveredSqlSha256: string | null;
    exactMatchLocations: Array<Record<string, unknown>>;
    disposition: string;
    decisionRequired: string;
  }>;
  recommendedSequence: string[];
}) {
  const lines = [
    '# Database Migration Checksum Review',
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
    '## Mismatch Rows',
    '',
    ...report.rows.map((row) =>
      [
        `- ${row.migration}: ${row.disposition}`,
        `  - DB checksum: ${row.dbChecksum}`,
        `  - selected recovered SHA-256: ${row.selectedRecoveredSqlSha256}`,
        `  - exact match locations: ${row.exactMatchLocations.length}`,
        `  - decision: ${row.decisionRequired}`,
      ].join('\n'),
    ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function printSummary(
  out: string,
  markdown: string,
  report: {
    status: ReviewStatus;
    summary: Record<string, unknown>;
  },
) {
  console.log(
    [
      `Database migration checksum review status: ${report.status}`,
      `Checksum mismatch rows: ${report.summary.checksumMismatchRows}`,
      `Exact match locations: ${report.summary.exactMatchLocations}`,
      `Unresolved mismatches: ${report.summary.unresolvedMismatches}`,
      `JSON: ${out}`,
      `Markdown: ${markdown}`,
    ].join('\n'),
  );
}

function hashBuffer(buffer: Buffer) {
  const text = buffer.toString('utf8');
  return {
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    text,
  };
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function gitText(args: string[], nullable?: false): string;
function gitText(args: string[], nullable: true): string | null;
function gitText(args: string[], nullable = false) {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (error) {
    if (nullable) return null;
    throw error;
  }
}

function gitBuffer(args: string[], nullable: true): Buffer | null {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    if (nullable) return null;
    throw new Error('unreachable');
  }
}

main();
