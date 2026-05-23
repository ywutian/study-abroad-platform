#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type RollupStatus =
  | 'SOURCE_VALIDATION_PACKET_READY'
  | 'PASS_NO_SOURCE_CANDIDATES'
  | 'BLOCKED_VALIDATION_INPUTS_MISSING';

interface Args {
  validations: string[];
  out: string;
  markdown: string;
  csv: string;
}

interface ValidationReport {
  generatedAt?: string;
  status?: string;
  applicationYear?: number | null;
  sourceRecovery?: string | null;
  limits?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  rows?: ValidationRow[];
}

interface ValidationRow {
  candidateDepth: number;
  parentSourceUrl: string | null;
  schoolId: string;
  schoolName: string;
  sourceUrl: string;
  fetchStatus: string;
  evidenceStatus: string;
  promptMatchCount: number;
  matchedPromptIds: string[];
  promptMatches: unknown[];
  linkCandidates: unknown[];
  cycleSignals: string[];
  promptLanguageSignals: string[];
  [key: string]: unknown;
}

interface ValidationInput {
  path: string;
  exists: boolean;
  report: ValidationReport | null;
  error: string | null;
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
  const values = (name: string) => {
    const found: string[] = [];
    for (let index = 0; index < argv.length; index += 1) {
      const arg = argv[index];
      if (arg.startsWith(`${name}=`)) found.push(arg.slice(name.length + 1));
      if (arg === name && argv[index + 1]) found.push(argv[index + 1]);
    }
    return found;
  };
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
        `essay-prompt-source-validation-rollup-${stamp}.json`,
      ),
    )!,
  );
  return {
    validations: values('--validation').map((file) =>
      path.resolve(API_ROOT, file),
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
  const inputs = args.validations.map(readValidation);
  const invalidInputs = inputs.filter(
    (input) => !input.exists || !input.report,
  );
  const missingValidationArgs = inputs.length === 0;
  const rows = dedupeRows(inputs.flatMap((input) => input.report?.rows ?? []));
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-source-validation-rollup',
    status: statusFor(
      invalidInputs.length + (missingValidationArgs ? 1 : 0),
      rows.length,
    ),
    destructiveDbWriteAllowedByThisPlan: false,
    sourceReports: inputs.map((input) => ({
      path: input.path,
      exists: input.exists,
      status: input.report?.status ?? null,
      generatedAt: input.report?.generatedAt ?? null,
      limits: input.report?.limits ?? null,
      summary: input.report?.summary ?? null,
      error: input.error,
    })),
    missingInputs: [
      ...(missingValidationArgs
        ? [
            {
              path: null,
              error: 'At least one --validation report is required',
            },
          ]
        : []),
      ...invalidInputs.map((input) => ({
        path: input.path,
        error: input.error,
      })),
    ],
    applicationYear: firstDefined(
      inputs.map((input) => input.report?.applicationYear),
    ),
    sourceRecovery: firstDefined(
      inputs.map((input) => input.report?.sourceRecovery),
    ),
    summary: buildSummary(rows, inputs),
    reviewContract: {
      candidateEvidenceStatus: 'candidate_validated_for_review',
      rollupDoesNotApproveSources: true,
      requiredNextStep:
        'Run essay-prompt-source-review-staging, then explicit review approval, before any write plan.',
    },
    nextCampaign: buildNextCampaign(rows),
    rows,
  };
  writeReport(args, report);
  printSummary(args, report);
}

function readValidation(filePath: string): ValidationInput {
  const resolved = path.resolve(API_ROOT, filePath);
  if (!fs.existsSync(resolved)) {
    return {
      path: path.relative(API_ROOT, resolved),
      exists: false,
      report: null,
      error: 'Validation report does not exist',
    };
  }
  try {
    return {
      path: path.relative(API_ROOT, resolved),
      exists: true,
      report: JSON.parse(fs.readFileSync(resolved, 'utf8')) as ValidationReport,
      error: null,
    };
  } catch (error) {
    return {
      path: path.relative(API_ROOT, resolved),
      exists: true,
      report: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function dedupeRows(rows: ValidationRow[]) {
  const bySource = new Map<string, ValidationRow>();
  for (const row of rows) {
    const key = [row.schoolId, normalizeUrl(row.sourceUrl)].join('|');
    const existing = bySource.get(key);
    if (!existing) {
      bySource.set(key, row);
      continue;
    }
    bySource.set(key, mergeDuplicateRows(existing, row));
  }
  return Array.from(bySource.values()).sort(compareValidationRows);
}

function mergeDuplicateRows(a: ValidationRow, b: ValidationRow) {
  const best = compareValidationRows(a, b) <= 0 ? a : b;
  const other = best === a ? b : a;
  return {
    ...best,
    matchedPromptIds: unique([
      ...(best.matchedPromptIds ?? []),
      ...(other.matchedPromptIds ?? []),
    ]),
    promptMatches:
      best.promptMatches?.length >= other.promptMatches?.length
        ? best.promptMatches
        : other.promptMatches,
    linkCandidates: dedupeLinkCandidates([
      ...(best.linkCandidates ?? []),
      ...(other.linkCandidates ?? []),
    ]),
    cycleSignals: unique([
      ...(best.cycleSignals ?? []),
      ...(other.cycleSignals ?? []),
    ]),
    promptLanguageSignals: unique([
      ...(best.promptLanguageSignals ?? []),
      ...(other.promptLanguageSignals ?? []),
    ]),
  };
}

function compareValidationRows(a: ValidationRow, b: ValidationRow) {
  return (
    evidenceRank(b.evidenceStatus) - evidenceRank(a.evidenceStatus) ||
    (b.promptMatchCount ?? 0) - (a.promptMatchCount ?? 0) ||
    fetchRank(b.fetchStatus) - fetchRank(a.fetchStatus) ||
    (a.candidateDepth ?? 0) - (b.candidateDepth ?? 0) ||
    (b.linkCandidates?.length ?? 0) - (a.linkCandidates?.length ?? 0) ||
    a.schoolName.localeCompare(b.schoolName) ||
    a.sourceUrl.localeCompare(b.sourceUrl)
  );
}

function evidenceRank(status: string) {
  switch (status) {
    case 'candidate_validated_for_review':
      return 5;
    case 'prompt_match_needs_review':
      return 4;
    case 'reachable_context_only':
      return 3;
    case 'reachable_no_prompt_match':
      return 2;
    case 'non_html_review':
      return 1;
    default:
      return 0;
  }
}

function fetchRank(status: string) {
  switch (status) {
    case 'reachable_html':
      return 3;
    case 'reachable_non_html':
      return 2;
    case 'blocked':
    case 'fetch_failed':
      return 1;
    default:
      return 0;
  }
}

function dedupeLinkCandidates(items: unknown[]) {
  const byUrl = new Map<string, any>();
  for (const item of items as any[]) {
    const key = normalizeUrl(item?.url ?? '');
    if (!key) continue;
    const existing = byUrl.get(key);
    if (!existing || Number(item?.score ?? 0) > Number(existing?.score ?? 0)) {
      byUrl.set(key, item);
    }
  }
  return Array.from(byUrl.values()).sort(
    (a, b) => Number(b.score ?? 0) - Number(a.score ?? 0),
  );
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function buildSummary(rows: ValidationRow[], inputs: ValidationInput[]) {
  const validated = rows.filter(
    (row) => row.evidenceStatus === 'candidate_validated_for_review',
  );
  return {
    sourceReports: inputs.length,
    validSourceReports: inputs.filter((input) => input.report).length,
    sourceReportStatuses: countBy(
      inputs,
      (input) => input.report?.status ?? (input.error ? 'error' : 'missing'),
    ),
    offsetBatches: inputs.map((input) => ({
      path: input.path,
      status: input.report?.status ?? null,
      offsetSchools: input.report?.limits?.offsetSchools ?? null,
      limitSchools: input.report?.limits?.limitSchools ?? null,
      eligibleSchools: input.report?.limits?.eligibleSchools ?? null,
      checkedSchools: input.report?.summary?.checkedSchools ?? null,
      checkedCandidates: input.report?.summary?.checkedCandidates ?? null,
      validatedCandidates: input.report?.summary?.validatedCandidates ?? null,
      promptMatchCandidates:
        input.report?.summary?.promptMatchCandidates ?? null,
      linkedSourceCandidates:
        input.report?.summary?.linkedSourceCandidates ?? null,
    })),
    checkedSchools: new Set(rows.map((row) => row.schoolId)).size,
    checkedCandidates: rows.length,
    reachableCandidates: rows.filter(
      (row) => row.fetchStatus === 'reachable_html',
    ).length,
    blockedOrFailedCandidates: rows.filter((row) =>
      ['blocked', 'fetch_failed', 'skipped_invalid_url'].includes(
        row.fetchStatus,
      ),
    ).length,
    nonHtmlCandidates: rows.filter(
      (row) => row.fetchStatus === 'reachable_non_html',
    ).length,
    validatedCandidates: validated.length,
    promptMatchCandidates: rows.filter((row) => row.promptMatchCount > 0)
      .length,
    totalPromptMatches: rows.reduce(
      (sum, row) => sum + (row.promptMatchCount ?? 0),
      0,
    ),
    cycleSignalCandidates: rows.filter((row) => row.cycleSignals?.length > 0)
      .length,
    promptLanguageSignalCandidates: rows.filter(
      (row) => row.promptLanguageSignals?.length > 0,
    ).length,
    linkedSourceCandidateRows: rows.filter(
      (row) => row.linkCandidates?.length > 0,
    ).length,
    linkedSourceCandidates: rows.reduce(
      (sum, row) => sum + (row.linkCandidates?.length ?? 0),
      0,
    ),
    byFetchStatus: countBy(rows, (row) => row.fetchStatus),
    byEvidenceStatus: countBy(rows, (row) => row.evidenceStatus),
    byCandidateDepth: countBy(rows, (row) => String(row.candidateDepth)),
    followedLinkedCandidates: rows.filter((row) => row.candidateDepth > 0)
      .length,
    topValidatedSchools: Array.from(
      new Set(validated.map((row) => row.schoolName)),
    )
      .sort()
      .slice(0, 20),
    topLinkedSourceCandidates: rows
      .flatMap((row) =>
        (row.linkCandidates ?? []).map((link: any) => ({
          schoolName: row.schoolName,
          sourceUrl: row.sourceUrl,
          linkedUrl: link.url,
          score: Number(link.score ?? 0),
          reasons: Array.isArray(link.reasons) ? link.reasons : [],
        })),
      )
      .sort(
        (a, b) => b.score - a.score || a.schoolName.localeCompare(b.schoolName),
      )
      .slice(0, 20),
  };
}

function buildNextCampaign(rows: ValidationRow[]) {
  const validated = rows.find(
    (row) => row.evidenceStatus === 'candidate_validated_for_review',
  );
  if (validated) {
    return {
      id: 'essay_prompt_source_review',
      reason: `${validated.schoolName} has validated prompt-source matches in the rollup; stage and approve only after source-family, cycle-year, and raw snapshot review.`,
      schoolId: validated.schoolId,
      schoolName: validated.schoolName,
      sourceUrl: validated.sourceUrl,
      promptMatchCount: validated.promptMatchCount,
    };
  }
  return {
    id: 'essay_prompt_source_search_expansion',
    reason:
      'No additional prompt text matches were found in the supplied validation batch rollup; expand source search or review linked candidates.',
  };
}

function statusFor(invalidInputs: number, rowCount: number): RollupStatus {
  if (invalidInputs > 0) return 'BLOCKED_VALIDATION_INPUTS_MISSING';
  return rowCount > 0
    ? 'SOURCE_VALIDATION_PACKET_READY'
    : 'PASS_NO_SOURCE_CANDIDATES';
}

function firstDefined<T>(items: Array<T | null | undefined>) {
  return (
    items.find((item): item is T => item !== null && item !== undefined) ?? null
  );
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function normalizeUrl(value: string) {
  return String(value ?? '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const rows = Array.isArray(report.rows)
    ? (report.rows as ValidationRow[])
    : [];
  const validated = rows.filter(
    (row) => row.evidenceStatus === 'candidate_validated_for_review',
  );
  return [
    '# Essay Prompt Source Validation Rollup',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Source reports: ${report.summary?.sourceReports ?? 0}`,
    `- Valid source reports: ${report.summary?.validSourceReports ?? 0}`,
    `- Checked schools: ${report.summary?.checkedSchools ?? 0}`,
    `- Checked candidates: ${report.summary?.checkedCandidates ?? 0}`,
    `- Validated candidates: ${report.summary?.validatedCandidates ?? 0}`,
    `- Total prompt matches: ${report.summary?.totalPromptMatches ?? 0}`,
    `- Linked source candidates: ${report.summary?.linkedSourceCandidates ?? 0}`,
    '',
    '## Source Batches',
    '',
    '| Report | Offset | Limit | Checked Schools | Checked Candidates | Validated |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...renderSourceBatches(report.summary?.offsetBatches),
    '',
    '## Validated Candidates',
    '',
    ...renderValidated(validated),
    '',
    '## Top Linked Source Candidates',
    '',
    ...renderLinked(report.summary?.topLinkedSourceCandidates),
    '',
  ].join('\n');
}

function renderValidated(rows: ValidationRow[]) {
  if (rows.length === 0) return ['- None'];
  return rows.map(
    (row) =>
      `- ${row.schoolName}: ${row.promptMatchCount} matches (${row.sourceUrl})`,
  );
}

function renderSourceBatches(value: unknown) {
  const batches = Array.isArray(value) ? value : [];
  if (batches.length === 0) return ['| None | 0 | 0 | 0 | 0 | 0 |'];
  return batches.map(
    (batch: any) =>
      `| ${escapeMarkdown(batch.path ?? '')} | ${batch.offsetSchools ?? ''} | ${batch.limitSchools ?? ''} | ${batch.checkedSchools ?? ''} | ${batch.checkedCandidates ?? ''} | ${batch.validatedCandidates ?? ''} |`,
  );
}

function renderLinked(value: unknown) {
  const links = Array.isArray(value) ? value : [];
  if (links.length === 0) return ['- None'];
  return links.map(
    (link: any) =>
      `- ${escapeMarkdown(link.schoolName ?? '')}: ${link.score ?? 0} ${escapeMarkdown(link.linkedUrl ?? '')}`,
  );
}

function renderCsv(rows: ValidationRow[]) {
  const header = [
    'schoolId',
    'schoolName',
    'applicationYear',
    'sourceUrl',
    'candidateDepth',
    'parentSourceUrl',
    'sourceType',
    'sourceQuality',
    'fetchStatus',
    'httpStatus',
    'finalUrl',
    'contentType',
    'bytesRead',
    'evidenceStatus',
    'promptMatchCount',
    'matchedPromptIds',
    'linkCandidateCount',
    'cycleSignals',
    'promptLanguageSignals',
    'recommendedAction',
    'reviewDisposition',
    'error',
  ];
  const lines = rows.map((row) =>
    [
      row.schoolId,
      row.schoolName,
      row.applicationYear ?? '',
      row.sourceUrl,
      String(row.candidateDepth),
      row.parentSourceUrl ?? '',
      row.sourceType ?? '',
      row.sourceQuality ?? '',
      row.fetchStatus,
      row.httpStatus ?? '',
      row.finalUrl ?? '',
      row.contentType ?? '',
      row.bytesRead ?? '',
      row.evidenceStatus,
      String(row.promptMatchCount ?? 0),
      (row.matchedPromptIds ?? []).join('|'),
      String(row.linkCandidates?.length ?? 0),
      (row.cycleSignals ?? []).join('|'),
      (row.promptLanguageSignals ?? []).join('|'),
      row.recommendedAction ?? '',
      row.reviewDisposition ?? '',
      row.error ?? '',
    ]
      .map(csvCell)
      .join(','),
  );
  return `${header.join(',')}\n${lines.join('\n')}\n`;
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
        checkedSchools: report.summary.checkedSchools,
        checkedCandidates: report.summary.checkedCandidates,
        validatedCandidates: report.summary.validatedCandidates,
        totalPromptMatches: report.summary.totalPromptMatches,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
