#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

type VariantStatus =
  | 'PASS_NO_CHECKSUM_MISMATCH'
  | 'REVIEW_VARIANT_EXACT_MATCH_FOUND'
  | 'BLOCKED_NO_VARIANT_MATCH';

interface Args {
  checksumReview: string;
  out: string;
  markdown: string;
}

interface ChecksumReviewReport {
  generatedAt: string;
  status: string;
  rows: ChecksumReviewRow[];
}

interface ChecksumReviewRow {
  migration: string;
  dbChecksum: string | null;
  selectedRecoveredFromSpec: string | null;
  selectedRecoveredSqlSha256: string | null;
  gitPathHistory?: {
    candidates?: Array<{
      spec?: string;
      sha256?: string;
      lineCount?: number;
    }>;
  };
  exactMatchLocations?: unknown[];
}

interface SourceCandidate {
  source: string;
  spec: string;
  originalSha256: string;
  byteLength: number;
  lineCount: number;
}

interface VariantMatch {
  sourceSpec: string;
  sourceSha256: string;
  variantName: string;
  sha256: string;
  byteLength: number;
  lineCount: number;
}

interface MigrationVariantRow {
  migration: string;
  dbChecksum: string | null;
  selectedRecoveredFromSpec: string | null;
  selectedRecoveredSqlSha256: string | null;
  sourceCandidates: SourceCandidate[];
  sourceReadErrors: Array<{ spec: string; error: string }>;
  variantFamiliesChecked: string[];
  variantChecks: number;
  uniqueVariantHashes: number;
  exactVariantMatches: VariantMatch[];
  disposition: string;
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
    `database-migration-checksum-variant-analysis-${stamp}.json`,
  );
  const out = path.resolve(API_ROOT, get('--out', defaultOut)!);
  const checksumReview = get('--checksum-review');
  return {
    checksumReview: path.resolve(
      API_ROOT,
      checksumReview ?? findLatestChecksumReview(),
    ),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
  };
}

function main() {
  const args = parseArgs();
  const checksumReview = JSON.parse(
    fs.readFileSync(args.checksumReview, 'utf8'),
  ) as ChecksumReviewReport;
  const rows = checksumReview.rows
    .filter((row) => row.dbChecksum && !row.exactMatchLocations?.length)
    .map((row) => analyzeRow(row));
  const exactVariantMatches = rows.reduce(
    (total, row) => total + row.exactVariantMatches.length,
    0,
  );
  const status: VariantStatus =
    rows.length === 0
      ? 'PASS_NO_CHECKSUM_MISMATCH'
      : exactVariantMatches > 0
        ? 'REVIEW_VARIANT_EXACT_MATCH_FOUND'
        : 'BLOCKED_NO_VARIANT_MATCH';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-migration-checksum-variant-analysis',
    status,
    sourceChecksumReview: path.relative(API_ROOT, args.checksumReview),
    checksumReviewGeneratedAt: checksumReview.generatedAt,
    checksumReviewStatus: checksumReview.status,
    destructiveDbWriteAllowedByThisPlan: false,
    writesToPrismaMigrationDir: false,
    summary: {
      checksumMismatchRows: rows.length,
      sourceSqlCandidates: rows.reduce(
        (total, row) => total + row.sourceCandidates.length,
        0,
      ),
      sourceReadErrors: rows.reduce(
        (total, row) => total + row.sourceReadErrors.length,
        0,
      ),
      variantChecks: rows.reduce((total, row) => total + row.variantChecks, 0),
      uniqueVariantHashes: rows.reduce(
        (total, row) => total + row.uniqueVariantHashes,
        0,
      ),
      exactVariantMatches,
      unresolvedAfterVariantAnalysis: rows.filter(
        (row) => row.exactVariantMatches.length === 0,
      ).length,
    },
    variantFamilies: variantFamilies(),
    rows,
    recommendedSequence: buildRecommendedSequence(status),
    nextCampaign: buildNextCampaign(status),
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  printSummary(args.out, args.markdown, report);
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

function analyzeRow(row: ChecksumReviewRow): MigrationVariantRow {
  const specs = collectSourceSpecs(row);
  const sourceCandidates: SourceCandidate[] = [];
  const sourceReadErrors: Array<{ spec: string; error: string }> = [];
  const exactVariantMatches: VariantMatch[] = [];
  let variantChecks = 0;
  const uniqueVariantHashes = new Set<string>();

  for (const { source, spec } of specs) {
    const text = gitShow(spec);
    if (text === null) {
      sourceReadErrors.push({
        spec,
        error: 'Unable to read candidate SQL from git spec',
      });
      continue;
    }
    const sourceSha256 = sha256(text);
    sourceCandidates.push({
      source,
      spec,
      originalSha256: sourceSha256,
      byteLength: Buffer.byteLength(text),
      lineCount: lineCount(text),
    });
    for (const variant of buildVariants(text)) {
      variantChecks += 1;
      uniqueVariantHashes.add(variant.sha256);
      if (row.dbChecksum && variant.sha256 === row.dbChecksum) {
        exactVariantMatches.push({
          sourceSpec: spec,
          sourceSha256,
          variantName: variant.name,
          sha256: variant.sha256,
          byteLength: Buffer.byteLength(variant.text),
          lineCount: lineCount(variant.text),
        });
      }
    }
  }

  return {
    migration: row.migration,
    dbChecksum: row.dbChecksum,
    selectedRecoveredFromSpec: row.selectedRecoveredFromSpec,
    selectedRecoveredSqlSha256: row.selectedRecoveredSqlSha256,
    sourceCandidates,
    sourceReadErrors,
    variantFamiliesChecked: variantFamilies(),
    variantChecks,
    uniqueVariantHashes: uniqueVariantHashes.size,
    exactVariantMatches,
    disposition:
      exactVariantMatches.length > 0
        ? 'variant-exact-match-review-restore'
        : 'no-common-text-variant-match-external-artifact-or-baseline-required',
  };
}

function collectSourceSpecs(row: ChecksumReviewRow) {
  const specs: Array<{ source: string; spec: string }> = [];
  const seen = new Set<string>();
  const add = (source: string, spec: string | null | undefined) => {
    if (!spec || seen.has(spec)) return;
    seen.add(spec);
    specs.push({ source, spec });
  };
  add('selected-recovered-spec', row.selectedRecoveredFromSpec);
  for (const candidate of row.gitPathHistory?.candidates ?? []) {
    add('git-path-history', candidate.spec);
  }
  return specs;
}

function variantFamilies() {
  return [
    'original',
    'line-ending-normalization',
    'final-newline-normalization',
    'bom-prefix-toggle',
    'trim-trailing-whitespace-per-line',
    'strip-leading-sql-comment-block',
    'strip-sql-line-comments',
    'collapse-blank-line-runs',
  ];
}

function buildVariants(text: string) {
  const baseVariants = [
    { name: 'original', text },
    {
      name: 'lf-normalized',
      text: text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    },
    {
      name: 'trim-trailing-whitespace-per-line',
      text: normalizeLf(text).replace(/[ \t]+$/gm, ''),
    },
    {
      name: 'strip-leading-sql-comment-block',
      text: stripLeadingSqlCommentBlock(normalizeLf(text)),
    },
    {
      name: 'strip-sql-line-comments',
      text: normalizeLf(text)
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n'),
    },
    {
      name: 'collapse-blank-line-runs',
      text: normalizeLf(text).replace(/\n{3,}/g, '\n\n'),
    },
  ];
  const variants: Array<{ name: string; text: string; sha256: string }> = [];
  const seen = new Set<string>();
  for (const base of baseVariants) {
    for (const finalNewline of finalNewlineVariants(base.text)) {
      for (const lineEnding of lineEndingVariants(finalNewline.text)) {
        for (const bom of bomVariants(lineEnding.text)) {
          const name = [
            base.name,
            finalNewline.name,
            lineEnding.name,
            bom.name,
          ].join('|');
          const key = `${name}:${sha256(bom.text)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          variants.push({ name, text: bom.text, sha256: sha256(bom.text) });
        }
      }
    }
  }
  return variants;
}

function finalNewlineVariants(text: string) {
  const trimmed = text.replace(/[ \t\r\n]+$/g, '');
  return [
    { name: 'preserve-final-newline', text },
    { name: 'ensure-single-final-lf', text: `${trimmed}\n` },
    { name: 'remove-final-newline', text: trimmed },
  ];
}

function lineEndingVariants(text: string) {
  const lf = normalizeLf(text);
  return [
    { name: 'preserve-line-endings', text },
    { name: 'lf', text: lf },
    { name: 'crlf', text: lf.replace(/\n/g, '\r\n') },
  ];
}

function bomVariants(text: string) {
  const withoutBom = text.replace(/^\uFEFF/, '');
  return [
    { name: 'preserve-bom', text },
    { name: 'without-bom', text: withoutBom },
    { name: 'with-bom', text: `\uFEFF${withoutBom}` },
  ];
}

function stripLeadingSqlCommentBlock(text: string) {
  const lines = text.split('\n');
  let index = 0;
  while (
    index < lines.length &&
    (lines[index].trim() === '' || lines[index].trimStart().startsWith('--'))
  ) {
    index += 1;
  }
  return lines.slice(index).join('\n');
}

function buildRecommendedSequence(status: VariantStatus) {
  if (status === 'PASS_NO_CHECKSUM_MISMATCH') {
    return ['Rerun migration reconciliation and schema alignment planning.'];
  }
  if (status === 'REVIEW_VARIANT_EXACT_MATCH_FOUND') {
    return [
      'Review the deterministic variant match and compare it against DB-applied migration evidence.',
      'Restore exact SQL only through an approved migration-history workflow.',
      'Rerun checksum review, migration reconciliation, schema worklist, and platform closure audit.',
    ];
  }
  return [
    'Treat common text normalization explanations as exhausted for the remaining checksum mismatch.',
    'Continue external exact-SQL artifact recovery or obtain explicit non-production baseline/resolve approval.',
    'Do not restore migration files or run Prisma resolve/deploy from this artifact.',
  ];
}

function buildNextCampaign(status: VariantStatus) {
  if (status === 'REVIEW_VARIANT_EXACT_MATCH_FOUND') {
    return {
      id: 'database_migration_variant_restore_review',
      reason:
        'A deterministic text variant matched the DB checksum and needs operator review before any restore.',
    };
  }
  if (status === 'PASS_NO_CHECKSUM_MISMATCH') {
    return {
      id: 'database_migration_history_reconciliation',
      reason: 'No checksum mismatch rows remain.',
    };
  }
  return {
    id: 'database_migration_external_artifact_or_baseline_approval',
    reason:
      'No common text variant matches the DB checksum; exact SQL recovery or baseline approval remains required.',
  };
}

function renderMarkdown(report: {
  generatedAt: string;
  status: VariantStatus;
  destructiveDbWriteAllowedByThisPlan: boolean;
  writesToPrismaMigrationDir: boolean;
  summary: Record<string, unknown>;
  rows: MigrationVariantRow[];
  recommendedSequence: string[];
}) {
  const lines = [
    '# Database Migration Checksum Variant Analysis',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
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
    '## Rows',
    '',
    ...(report.rows.length
      ? report.rows.map(
          (row) =>
            `- ${row.migration}: ${row.disposition}; sources=${row.sourceCandidates.length}; variants=${row.variantChecks}; exactMatches=${row.exactVariantMatches.length}`,
        )
      : ['- none']),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function printSummary(
  out: string,
  markdown: string,
  report: {
    status: VariantStatus;
    summary: Record<string, unknown>;
  },
) {
  console.log(
    [
      `Database migration checksum variant analysis status: ${report.status}`,
      `Variant checks: ${report.summary.variantChecks}`,
      `Exact variant matches: ${report.summary.exactVariantMatches}`,
      `JSON: ${out}`,
      `Markdown: ${markdown}`,
    ].join('\n'),
  );
}

function gitShow(spec: string) {
  try {
    return execFileSync('git', ['show', spec], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function normalizeLf(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function lineCount(text: string) {
  return normalizeLf(text).split('\n').length;
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

main();
