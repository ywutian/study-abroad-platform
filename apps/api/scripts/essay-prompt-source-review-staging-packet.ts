#!/usr/bin/env tsx
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

type PacketStatus =
  | 'SOURCE_REVIEW_STAGING_READY'
  | 'PASS_NO_VALIDATED_CANDIDATES'
  | 'BLOCKED_VALIDATION_MISSING';

interface Args {
  validation: string | null;
  manualChecks: string[];
  out: string;
  markdown: string;
  csv: string;
  timeoutMs: number;
  maxBytes: number;
  minConfidence: number;
  userAgent: string;
}

interface ValidationReport {
  generatedAt?: string;
  applicationYear?: number | null;
  status?: string;
  rows?: ValidationRow[];
  summary?: Record<string, unknown>;
}

interface ManualCheckReport {
  generatedAt?: string;
  status?: string;
  target?: {
    schoolId?: string;
    schoolName?: string;
    applicationYear?: number | null;
    promptSamples?: PromptSample[];
  };
  summary?: Record<string, unknown>;
  rows?: ManualCheckRow[];
}

interface ValidationRow {
  candidateDepth: number;
  parentSourceUrl: string | null;
  schoolId: string;
  schoolName: string;
  applicationYear: number | null;
  sourceType: string;
  sourceQuality: string;
  sourceUrl: string;
  finalUrl: string | null;
  promptMatchCount: number;
  matchedPromptIds: string[];
  promptMatches: PromptMatch[];
  cycleSignals: string[];
  promptLanguageSignals: string[];
  evidenceStatus: string;
  recommendedAction: string;
  reviewDisposition: string;
}

interface ManualCheckRow {
  sourceUrl: string;
  finalUrl: string | null;
  promptMatchCount: number;
  matchedPromptIds: string[];
  promptMatches?: PromptMatch[];
  cycleSignals: string[];
  promptLanguageSignals: string[];
  evidenceStatus: string;
  evidenceSnippets?: string[];
}

interface PromptMatch {
  essayPromptId: string;
  promptSnippet: string;
  matchKind:
    | 'exact_phrase'
    | 'normalized_phrase'
    | 'truncated_prefix_with_prompt_context';
  evidenceSnippet: string | null;
}

interface PromptSample {
  essayPromptId: string;
  type?: string;
  severity?: string;
  promptSnippet: string | null;
  route?: string;
}

interface FetchSnapshot {
  status: 'fetched' | 'fetch_failed' | 'skipped';
  finalUrl: string | null;
  contentType: string | null;
  httpStatus: number | null;
  fetchedAt: string | null;
  bytesRead: number;
  truncated: boolean;
  text: string;
  textSha256: string | null;
  error: string | null;
}

interface SourceRowCandidate {
  essayPromptId: string;
  schoolId: string;
  schoolName: string;
  applicationYear: number | null;
  sourceType: string;
  sourceUrl: string;
  rawContent: string;
  rawContentSha256: string;
  confidence: number;
  scrapedAt: string | null;
  reviewStatus: 'NEEDS_REVIEW';
  reviewReason: string;
  evidenceSnippet: string | null;
  promptSnippet: string;
  matchKind: PromptMatch['matchKind'];
  canonicalPromptKey: string;
  reviewFlags: string[];
}

interface CanonicalPromptGroup {
  canonicalPromptKey: string;
  essayPromptIds: string[];
  promptSnippets: string[];
  evidenceSnippets: string[];
}

interface StagingRow {
  schoolId: string;
  schoolName: string;
  applicationYear: number | null;
  sourceUrl: string;
  finalUrl: string | null;
  sourceType: string;
  sourceQuality: string;
  candidateDepth: number;
  parentSourceUrl: string | null;
  fetchedAt: string | null;
  snapshotStatus: FetchSnapshot['status'];
  snapshotTextSha256: string | null;
  snapshotBytesRead: number;
  snapshotTruncated: boolean;
  promptMatchCount: number;
  stagedSourceRows: number;
  acceptedForReviewerQueue: boolean;
  blockerReasons: string[];
  reviewFlags: string[];
  canonicalPromptGroups: CanonicalPromptGroup[];
  cycleSignals: string[];
  promptLanguageSignals: string[];
  sourceRowCandidates: SourceRowCandidate[];
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const TRUSTED_SOURCE_QUALITIES = new Set([
  'official',
  'common_app',
  'questbridge',
  'configured',
]);

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
        `essay-prompt-source-review-staging-${stamp}.json`,
      ),
    )!,
  );
  const validation = get('--validation') ?? get('--source-validation');
  return {
    validation: validation
      ? path.resolve(API_ROOT, validation)
      : findLatestValidation(),
    manualChecks: values('--manual-check').map(resolveInputPath),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    timeoutMs: Number(get('--timeout-ms', '10000')),
    maxBytes: Number(get('--max-bytes', `${500 * 1024}`)),
    minConfidence: Number(get('--min-confidence', '0.82')),
    userAgent:
      get(
        '--user-agent',
        'Mozilla/5.0 (compatible; StudyAbroadPlatformDataAudit/1.0; +https://example.invalid/data-audit)',
      ) ?? '',
  };
}

async function main() {
  const args = parseArgs();
  const existingManualChecks = args.manualChecks.filter((filePath) =>
    fs.existsSync(filePath),
  );
  if (
    (!args.validation || !fs.existsSync(args.validation)) &&
    existingManualChecks.length === 0
  ) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-essay-prompt-source-review-staging',
      status: 'BLOCKED_VALIDATION_MISSING' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      validation: args.validation,
      manualChecks: args.manualChecks,
      summary: {
        validatedCandidateRows: 0,
        validationValidatedCandidateRows: 0,
        manualCheckValidatedCandidateRows: 0,
        stagedSourceRows: 0,
        acceptedForReviewerQueue: 0,
      },
      reviewContract: reviewContract(),
      nextCampaign: {
        id: 'essay_prompt_source_validation',
        reason:
          'Run source validation before staging source-row review candidates.',
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    return;
  }

  const validation =
    args.validation && fs.existsSync(args.validation)
      ? (JSON.parse(
          fs.readFileSync(args.validation, 'utf8'),
        ) as ValidationReport)
      : null;
  const validationValidatedRows = (validation?.rows ?? []).filter(
    (row) => row.evidenceStatus === 'candidate_validated_for_review',
  );
  const manualCheckReports = existingManualChecks.map((filePath) => ({
    filePath,
    report: JSON.parse(fs.readFileSync(filePath, 'utf8')) as ManualCheckReport,
  }));
  const manualCheckValidatedRows = manualCheckReports.flatMap(
    ({ filePath, report }) => manualCheckToValidationRows(filePath, report),
  );
  const validatedRows = [
    ...validationValidatedRows,
    ...manualCheckValidatedRows,
  ];
  const rows: StagingRow[] = [];
  for (const row of validatedRows) {
    rows.push(await buildStagingRow(args, row));
  }

  const summary = buildSummary(rows, {
    validatedCandidateRows: validatedRows.length,
    validationValidatedCandidateRows: validationValidatedRows.length,
    manualCheckValidatedCandidateRows: manualCheckValidatedRows.length,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-source-review-staging',
    status: (validatedRows.length > 0
      ? 'SOURCE_REVIEW_STAGING_READY'
      : 'PASS_NO_VALIDATED_CANDIDATES') satisfies PacketStatus,
    destructiveDbWriteAllowedByThisPlan: false,
    validation: args.validation
      ? path.relative(API_ROOT, args.validation)
      : null,
    validationGeneratedAt: validation?.generatedAt ?? null,
    validationStatus: validation?.status ?? null,
    manualChecks: manualCheckReports.map(({ filePath, report }) => ({
      path: path.relative(API_ROOT, filePath),
      generatedAt: report.generatedAt ?? null,
      status: report.status ?? null,
      schoolName: report.target?.schoolName ?? null,
      validatedSourceUrls: numberSummary(report.summary, 'validatedSourceUrls'),
    })),
    applicationYear:
      validation?.applicationYear ??
      firstNonNull(validatedRows.map((row) => row.applicationYear)),
    limits: {
      timeoutMs: args.timeoutMs,
      maxBytes: args.maxBytes,
      minConfidence: args.minConfidence,
    },
    summary,
    reviewContract: reviewContract(),
    nextCampaign: buildNextCampaign(rows),
    rows,
  };

  writeReport(args, report);
  printSummary(args, report);
}

function manualCheckToValidationRows(
  filePath: string,
  report: ManualCheckReport,
): ValidationRow[] {
  const target = report.target ?? {};
  const promptSamples = target.promptSamples ?? [];
  const packetCycleSignals = Array.from(
    new Set((report.rows ?? []).flatMap((row) => row.cycleSignals ?? [])),
  );
  return (report.rows ?? [])
    .filter(
      (row) =>
        row.evidenceStatus === 'candidate_validated_for_review' &&
        TRUSTED_SOURCE_QUALITIES.has(
          manualSourceQuality(row.sourceUrl, target.schoolName).toLowerCase(),
        ),
    )
    .map((row) => {
      const applicationYear =
        target.applicationYear ?? inferApplicationYear(row.cycleSignals);
      const cycleSignals =
        row.cycleSignals?.length > 0 ? row.cycleSignals : packetCycleSignals;
      const cycleSignalDisposition =
        row.cycleSignals?.length > 0
          ? 'source-page-cycle-signal'
          : packetCycleSignals.length > 0
            ? 'manual-check-context-cycle-signal'
            : 'missing-cycle-signal';
      return {
        candidateDepth: 0,
        parentSourceUrl: null,
        schoolId: target.schoolId ?? 'unknown',
        schoolName: target.schoolName ?? 'unknown',
        applicationYear,
        sourceType: manualSourceType(row.sourceUrl, target.schoolName),
        sourceQuality: manualSourceQuality(row.sourceUrl, target.schoolName),
        sourceUrl: row.sourceUrl,
        finalUrl: row.finalUrl,
        promptMatchCount: row.promptMatchCount,
        matchedPromptIds: row.matchedPromptIds,
        promptMatches: manualPromptMatches(row, promptSamples),
        cycleSignals,
        promptLanguageSignals: row.promptLanguageSignals ?? [],
        evidenceStatus: row.evidenceStatus,
        recommendedAction: 'stage-source-row-for-review',
        reviewDisposition: `manual-check-validated-for-review:${path.basename(filePath)}:${cycleSignalDisposition}`,
      } satisfies ValidationRow;
    });
}

function manualPromptMatches(
  row: ManualCheckRow,
  promptSamples: PromptSample[],
): PromptMatch[] {
  if (row.promptMatches?.length) return row.promptMatches;
  return row.matchedPromptIds.map((essayPromptId, index) => {
    const sample = promptSamples.find(
      (prompt) => prompt.essayPromptId === essayPromptId,
    );
    const promptSnippet = sample?.promptSnippet ?? '';
    return {
      essayPromptId,
      promptSnippet,
      matchKind: 'normalized_phrase',
      evidenceSnippet:
        rowPromptEvidence(row, promptSnippet) ??
        row.evidenceSnippets?.[index] ??
        promptSnippet,
    };
  });
}

function rowPromptEvidence(row: ManualCheckRow, promptSnippet: string) {
  const normalizedPrompt = normalizeText(promptSnippet);
  if (!normalizedPrompt) return null;
  return (
    row.evidenceSnippets?.find((snippet) =>
      normalizeText(snippet).includes(normalizedPrompt),
    ) ?? null
  );
}

function manualSourceQuality(sourceUrl: string, schoolName?: string) {
  const host = safeHost(sourceUrl);
  if (host.endsWith('commonapp.org')) return 'common_app';
  if (host.endsWith('questbridge.org')) return 'questbridge';
  if (host.endsWith('.edu') || host.endsWith('nd.edu')) return 'official';
  if (isInstitutionBoxHost(host, schoolName)) return 'official';
  return 'unknown';
}

function isInstitutionBoxHost(host: string, schoolName?: string) {
  if (!host.endsWith('.app.box.com') || !schoolName) return false;
  const institutionLabel = host.split('.')[0] ?? '';
  return schoolHostAliases(schoolName).some(
    (alias) =>
      alias.length >= 3 &&
      (institutionLabel.includes(alias) || alias.includes(institutionLabel)),
  );
}

function schoolHostAliases(schoolName: string) {
  const normalized = normalizeText(schoolName);
  const tokens = normalized
    .split(' ')
    .filter(
      (token) =>
        token.length >= 3 &&
        ![
          'university',
          'college',
          'institute',
          'school',
          'the',
          'and',
        ].includes(token),
    );
  const acronym = normalized
    .split(' ')
    .filter((token) => !['of', 'the', 'and'].includes(token))
    .map((token) => token[0])
    .join('');
  return Array.from(new Set([...tokens, acronym].filter(Boolean)));
}

function manualSourceType(sourceUrl: string, schoolName?: string) {
  const quality = manualSourceQuality(sourceUrl, schoolName);
  if (quality === 'common_app') return 'MANUAL_COMMON_APP_CANDIDATE';
  if (quality === 'questbridge') return 'MANUAL_QUESTBRIDGE_CANDIDATE';
  if (quality === 'official') return 'MANUAL_OFFICIAL_CANDIDATE';
  return 'MANUAL_UNKNOWN_CANDIDATE';
}

async function buildStagingRow(args: Args, row: ValidationRow) {
  const sourceUrl = row.finalUrl ?? row.sourceUrl;
  const snapshot = await fetchSnapshot(sourceUrl, args);
  const canonicalPromptGroups = duplicateCanonicalPromptGroups(
    row.promptMatches,
  );
  const reviewFlags = reviewFlagsForCanonicalGroups(canonicalPromptGroups);
  const blockers = [...blockerReasons(args, row, snapshot), ...reviewFlags];
  const confidence = computeConfidence(row, snapshot);
  const rawContent = buildRawContent(row, snapshot);
  const rawContentSha256 = sha256(rawContent);
  const acceptedForReviewerQueue =
    blockers.length === 0 && confidence >= args.minConfidence;
  const sourceRowCandidates = row.promptMatches.map((match) => ({
    essayPromptId: match.essayPromptId,
    schoolId: row.schoolId,
    schoolName: row.schoolName,
    applicationYear: row.applicationYear,
    sourceType: normalizeSourceType(row.sourceQuality, row.sourceType),
    sourceUrl,
    rawContent,
    rawContentSha256,
    confidence,
    scrapedAt: snapshot.fetchedAt,
    reviewStatus: 'NEEDS_REVIEW' as const,
    reviewReason:
      'Validated prompt text match requires source-family, cycle-year, word-limit, and raw snapshot review before DB write.',
    evidenceSnippet: match.evidenceSnippet,
    promptSnippet: match.promptSnippet,
    matchKind: match.matchKind,
    canonicalPromptKey: canonicalPromptKey(match.promptSnippet),
    reviewFlags: reviewFlagsForPromptMatch(match, canonicalPromptGroups),
  }));

  return {
    schoolId: row.schoolId,
    schoolName: row.schoolName,
    applicationYear: row.applicationYear,
    sourceUrl,
    finalUrl: row.finalUrl,
    sourceType: row.sourceType,
    sourceQuality: row.sourceQuality,
    candidateDepth: row.candidateDepth,
    parentSourceUrl: row.parentSourceUrl,
    fetchedAt: snapshot.fetchedAt,
    snapshotStatus: snapshot.status,
    snapshotTextSha256: snapshot.textSha256,
    snapshotBytesRead: snapshot.bytesRead,
    snapshotTruncated: snapshot.truncated,
    promptMatchCount: row.promptMatchCount,
    stagedSourceRows: sourceRowCandidates.length,
    acceptedForReviewerQueue,
    blockerReasons: blockers,
    reviewFlags,
    canonicalPromptGroups,
    cycleSignals: row.cycleSignals,
    promptLanguageSignals: row.promptLanguageSignals,
    sourceRowCandidates,
  } satisfies StagingRow;
}

async function fetchSnapshot(
  sourceUrl: string,
  args: Args,
): Promise<FetchSnapshot> {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch (error) {
    return {
      status: 'skipped',
      finalUrl: null,
      contentType: null,
      httpStatus: null,
      fetchedAt: null,
      bytesRead: 0,
      truncated: false,
      text: '',
      textSha256: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const response = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': args.userAgent,
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.1',
      },
    });
    const contentType = response.headers.get('content-type');
    if (!response.ok) {
      return {
        status: 'fetch_failed',
        finalUrl: response.url,
        contentType,
        httpStatus: response.status,
        fetchedAt: new Date().toISOString(),
        bytesRead: 0,
        truncated: false,
        text: '',
        textSha256: null,
        error: `HTTP ${response.status}`,
      };
    }
    const isReadableText =
      !contentType ||
      /text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType);
    const isPdf =
      /pdf/i.test(contentType ?? '') || /\.pdf([?#].*)?$/i.test(response.url);
    if (!isReadableText && !isPdf) {
      return {
        status: 'fetch_failed',
        finalUrl: response.url,
        contentType,
        httpStatus: response.status,
        fetchedAt: new Date().toISOString(),
        bytesRead: 0,
        truncated: false,
        text: '',
        textSha256: null,
        error: `Unsupported content type: ${contentType}`,
      };
    }
    if (isPdf) {
      const pdfBytes = Buffer.from(await response.arrayBuffer());
      const text = extractPdfText(pdfBytes, args.timeoutMs).slice(
        0,
        args.maxBytes,
      );
      return {
        status: text.trim().length > 0 ? 'fetched' : 'fetch_failed',
        finalUrl: response.url,
        contentType,
        httpStatus: response.status,
        fetchedAt: new Date().toISOString(),
        bytesRead: pdfBytes.length,
        truncated: text.length >= args.maxBytes,
        text,
        textSha256: text.trim().length > 0 ? sha256(text) : null,
        error:
          text.trim().length > 0
            ? null
            : 'PDF text extraction returned no readable text',
      };
    }
    const body = await readResponseText(response, args.maxBytes);
    const boxPdf = await boxSharePdfSnapshot(
      parsed.toString(),
      response.url,
      body.text,
      args,
    );
    if (boxPdf) {
      return {
        status: 'fetched',
        finalUrl: response.url,
        contentType: boxPdf.contentType ?? contentType,
        httpStatus: response.status,
        fetchedAt: new Date().toISOString(),
        bytesRead: boxPdf.bytesRead,
        truncated: boxPdf.text.length >= args.maxBytes,
        text: boxPdf.text,
        textSha256: sha256(boxPdf.text),
        error: null,
      };
    }
    const text = extractText(body.text);
    return {
      status: 'fetched',
      finalUrl: response.url,
      contentType,
      httpStatus: response.status,
      fetchedAt: new Date().toISOString(),
      bytesRead: body.bytesRead,
      truncated: body.truncated,
      text,
      textSha256: sha256(text),
      error: null,
    };
  } catch (error) {
    return {
      status: 'fetch_failed',
      finalUrl: null,
      contentType: null,
      httpStatus: null,
      fetchedAt: new Date().toISOString(),
      bytesRead: 0,
      truncated: false,
      text: '',
      textSha256: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function boxSharePdfSnapshot(
  sourceUrl: string,
  finalUrl: string | null,
  html: string,
  args: Args,
) {
  if (!isBoxShareUrl(sourceUrl) && (!finalUrl || !isBoxShareUrl(finalUrl))) {
    return null;
  }
  const downloadUrl =
    boxStaticDownloadUrl(sourceUrl) ??
    (finalUrl ? boxStaticDownloadUrl(finalUrl) : null) ??
    boxAuthenticatedDownloadUrl(html);
  if (!downloadUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const response = await fetch(downloadUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': args.userAgent,
        accept: 'application/pdf,*/*;q=0.1',
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type');
    const contentDisposition = response.headers.get('content-disposition');
    const buffer = Buffer.from(await response.arrayBuffer());
    const isPdf =
      /pdf/i.test(contentType ?? '') ||
      /pdf/i.test(contentDisposition ?? '') ||
      /\.pdf([?#].*)?$/i.test(response.url);
    if (!isPdf) return null;
    const text = extractPdfText(buffer, args.timeoutMs).slice(0, args.maxBytes);
    if (text.trim().length === 0) return null;
    return {
      contentType,
      bytesRead: buffer.length,
      text,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function boxStaticDownloadUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!isBoxShareUrl(parsed.toString())) return null;
    const sharedName = parsed.pathname.split('/').filter(Boolean).at(-1);
    if (!sharedName) return null;
    return `${parsed.origin}/shared/static/${sharedName}.pdf`;
  } catch {
    return null;
  }
}

function boxAuthenticatedDownloadUrl(html: string) {
  const decoded = html
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\\u0026/g, '&');
  const match = decoded.match(/"authenticated_download_url"\s*:\s*"([^"]+)"/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1].replace(/\\\//g, '/');
  }
}

function isBoxShareUrl(url: string) {
  const host = safeHost(url);
  try {
    const parsed = new URL(url);
    return host.endsWith('.app.box.com') && parsed.pathname.startsWith('/s/');
  } catch {
    return false;
  }
}

function extractPdfText(buffer: Buffer, timeoutMs: number) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'essay-pdf-'));
  const inputPath = path.join(tempDir, 'source.pdf');
  const outputPath = path.join(tempDir, 'source.txt');
  try {
    fs.writeFileSync(inputPath, buffer);
    execFileSync('pdftotext', ['-layout', inputPath, outputPath], {
      timeout: timeoutMs,
      stdio: 'ignore',
    });
    return fs.existsSync(outputPath)
      ? fs.readFileSync(outputPath, 'utf8').replace(/\s+/g, ' ').trim()
      : '';
  } catch {
    return '';
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function readResponseText(response: Response, maxBytes: number) {
  const body = response.body as {
    getReader?: () => {
      read: () => Promise<{ done: boolean; value?: Uint8Array }>;
      cancel?: () => Promise<void>;
    };
  } | null;
  const reader = body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    const bytesRead = Buffer.byteLength(text);
    return {
      text: bytesRead > maxBytes ? text.slice(0, maxBytes) : text,
      bytesRead: Math.min(bytesRead, maxBytes),
      truncated: bytesRead > maxBytes,
    };
  }

  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const remaining = maxBytes - bytesRead;
    if (value.byteLength > remaining) {
      chunks.push(value.slice(0, Math.max(0, remaining)));
      bytesRead = maxBytes;
      truncated = true;
      await reader.cancel?.();
      break;
    }
    chunks.push(value);
    bytesRead += value.byteLength;
    if (bytesRead >= maxBytes) {
      truncated = true;
      await reader.cancel?.();
      break;
    }
  }
  return {
    text: new TextDecoder('utf-8', { fatal: false }).decode(
      Buffer.concat(chunks),
    ),
    bytesRead,
    truncated,
  };
}

function blockerReasons(
  args: Args,
  row: ValidationRow,
  snapshot: FetchSnapshot,
) {
  const blockers: string[] = [];
  if (!TRUSTED_SOURCE_QUALITIES.has(row.sourceQuality.toLowerCase())) {
    blockers.push(`unapproved_source_quality:${row.sourceQuality}`);
  }
  if (snapshot.status !== 'fetched') {
    blockers.push(`snapshot_${snapshot.status}`);
  }
  if (row.promptMatchCount <= 0) {
    blockers.push('no_prompt_matches');
  }
  if (!row.applicationYear) {
    blockers.push('missing_application_year');
  }
  if (!hasCycleSignal(row)) {
    blockers.push('cycle_year_signal_needs_review');
  }
  if (!row.promptLanguageSignals.length) {
    blockers.push('missing_prompt_language_signal');
  }
  if (computeConfidence(row, snapshot) < args.minConfidence) {
    blockers.push('confidence_below_threshold');
  }
  return blockers;
}

function hasCycleSignal(row: ValidationRow) {
  if (!row.applicationYear) return false;
  const year = String(row.applicationYear);
  const shortYear = year.slice(-2);
  return row.cycleSignals.some((signal) => {
    const normalized = signal.replace(/\s+/g, '').toLowerCase();
    return (
      normalized.includes(year) ||
      normalized.includes(`2025-${shortYear}`) ||
      normalized.includes(`2025/${shortYear}`)
    );
  });
}

function computeConfidence(row: ValidationRow, snapshot: FetchSnapshot) {
  let confidence = 0.68;
  confidence += Math.min(0.15, row.promptMatchCount * 0.04);
  if (row.promptMatches.every((match) => match.matchKind === 'exact_phrase')) {
    confidence += 0.07;
  }
  if (TRUSTED_SOURCE_QUALITIES.has(row.sourceQuality.toLowerCase())) {
    confidence += 0.06;
  }
  if (hasCycleSignal(row)) confidence += 0.04;
  if (row.promptLanguageSignals.length > 0) confidence += 0.03;
  if (snapshot.status === 'fetched') confidence += 0.04;
  if (snapshot.truncated) confidence -= 0.03;
  return Math.max(0, Math.min(0.95, Number(confidence.toFixed(2))));
}

function buildRawContent(row: ValidationRow, snapshot: FetchSnapshot) {
  const evidence = row.promptMatches
    .map((match) =>
      [
        `essayPromptId=${match.essayPromptId}`,
        `matchKind=${match.matchKind}`,
        `prompt=${match.promptSnippet}`,
        `evidence=${match.evidenceSnippet ?? 'n/a'}`,
      ].join('\n'),
    )
    .join('\n\n---\n\n');
  const canonicalGroups = duplicateCanonicalPromptGroups(row.promptMatches);
  const groupingEvidence = canonicalGroups
    .map((group) =>
      [
        `canonicalPromptKey=${group.canonicalPromptKey}`,
        `essayPromptIds=${group.essayPromptIds.join(' | ')}`,
        `promptSnippets=${group.promptSnippets.join(' | ')}`,
      ].join('\n'),
    )
    .join('\n\n---\n\n');
  const snapshotPreview = snapshot.text.slice(0, 20000);
  return [
    `sourceUrl=${row.finalUrl ?? row.sourceUrl}`,
    `school=${row.schoolName}`,
    `applicationYear=${row.applicationYear ?? 'unknown'}`,
    `reviewDisposition=${row.reviewDisposition}`,
    `cycleSignals=${row.cycleSignals.join(' | ') || 'none'}`,
    `promptLanguageSignals=${row.promptLanguageSignals.join(' | ') || 'none'}`,
    '',
    'Matched prompt evidence:',
    evidence,
    '',
    'Prompt grouping review flags:',
    groupingEvidence || 'none',
    '',
    'Fetched source text preview:',
    snapshotPreview || 'n/a',
  ].join('\n');
}

function buildSummary(
  rows: StagingRow[],
  candidateCounts: {
    validatedCandidateRows: number;
    validationValidatedCandidateRows: number;
    manualCheckValidatedCandidateRows: number;
  },
) {
  return {
    ...candidateCounts,
    stagingRows: rows.length,
    acceptedForReviewerQueue: rows.filter((row) => row.acceptedForReviewerQueue)
      .length,
    blockedFromReviewerQueue: rows.filter(
      (row) => !row.acceptedForReviewerQueue,
    ).length,
    stagedSourceRows: rows.reduce((sum, row) => sum + row.stagedSourceRows, 0),
    sourceUrls: Array.from(new Set(rows.map((row) => row.sourceUrl))).length,
    promptIds: Array.from(
      new Set(
        rows.flatMap((row) =>
          row.sourceRowCandidates.map((candidate) => candidate.essayPromptId),
        ),
      ),
    ).length,
    bySourceQuality: countBy(rows, (row) => row.sourceQuality),
    bySnapshotStatus: countBy(rows, (row) => row.snapshotStatus),
    blockerReasons: countBy(
      rows.flatMap((row) => row.blockerReasons),
      (reason) => reason,
    ),
    reviewFlags: countBy(
      rows.flatMap((row) => row.reviewFlags),
      (flag) => flag,
    ),
    canonicalDuplicatePromptGroups: rows.reduce(
      (sum, row) => sum + row.canonicalPromptGroups.length,
      0,
    ),
  };
}

function buildNextCampaign(rows: StagingRow[]) {
  const accepted = rows.find((row) => row.acceptedForReviewerQueue);
  if (accepted) {
    return {
      id: 'essay_prompt_source_reviewer_queue',
      reason: `${accepted.schoolName} has ${accepted.stagedSourceRows} staged source rows ready for reviewer queue; approve only after source-family, cycle-year, and raw snapshot review.`,
      schoolId: accepted.schoolId,
      schoolName: accepted.schoolName,
      sourceUrl: accepted.sourceUrl,
      stagedSourceRows: accepted.stagedSourceRows,
      recommendedAction: 'review-and-approve-staged-source-rows',
    };
  }
  const blocked = rows[0];
  if (blocked) {
    return {
      id: 'essay_prompt_source_review_blocked',
      reason: `${blocked.schoolName} has prompt matches but staging is blocked: ${blocked.blockerReasons.join(', ')}`,
      schoolId: blocked.schoolId,
      schoolName: blocked.schoolName,
      sourceUrl: blocked.sourceUrl,
      recommendedAction: 'resolve-review-blockers',
    };
  }
  return {
    id: 'essay_prompt_source_validation',
    reason: 'No validated source candidates are available for staging.',
    recommendedAction: 'continue-source-validation',
  };
}

function reviewContract() {
  return {
    stagingEvidenceStatus:
      'acceptedForReviewerQueue means candidate rows have enough evidence for review, not DB write approval.',
    sourceRowShape: 'EssayPromptSource create data candidate',
    acceptedEvidenceRequires: [
      'reviewer confirms source page is official/Common App/configured and applies to the target school',
      'reviewer confirms cycle year/current application year from source context',
      'reviewer confirms prompt text, word limit, required flag, and prompt grouping against the source page',
      'reviewer resolves any canonical duplicate prompt matches before source-row approval',
      'source row is written only through an approved admin/review workflow with rawContent/sourceUrl/confidence/scrapedAt',
    ],
    prohibitedActions: [
      'do not run Prisma writes from this script',
      'do not mark prompts trusted or public-visible from staging candidates alone',
      'do not overwrite prompt text or source rows without conflict review',
    ],
  };
}

function normalizeSourceType(sourceQuality: string, sourceType: string) {
  const normalizedQuality = sourceQuality.toLowerCase();
  if (normalizedQuality === 'official') return 'OFFICIAL';
  if (normalizedQuality === 'common_app') return 'COMMON_APP';
  if (normalizedQuality === 'questbridge') return 'QUESTBRIDGE';
  if (normalizedQuality === 'configured') return sourceType || 'CONFIGURED';
  return sourceType || 'UNKNOWN';
}

function duplicateCanonicalPromptGroups(
  matches: PromptMatch[],
): CanonicalPromptGroup[] {
  const groups = new Map<string, PromptMatch[]>();
  for (const match of matches) {
    const key = canonicalPromptKey(match.promptSnippet);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(match);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([canonicalPromptKey, group]) => ({
      canonicalPromptKey,
      essayPromptIds: group.map((match) => match.essayPromptId),
      promptSnippets: group.map((match) => match.promptSnippet),
      evidenceSnippets: group
        .map((match) => match.evidenceSnippet)
        .filter((snippet): snippet is string => Boolean(snippet)),
    }));
}

function reviewFlagsForCanonicalGroups(groups: CanonicalPromptGroup[]) {
  if (groups.length === 0) return [];
  return ['duplicate_canonical_prompt_match_requires_review'];
}

function reviewFlagsForPromptMatch(
  match: PromptMatch,
  groups: CanonicalPromptGroup[],
) {
  const key = canonicalPromptKey(match.promptSnippet);
  return groups.some((group) => group.canonicalPromptKey === key)
    ? ['duplicate_canonical_prompt_match_requires_review']
    : [];
}

function canonicalPromptKey(text: string | null | undefined) {
  return normalizeText(
    String(text ?? '')
      .replace(/\([^)]*\bwords?\b[^)]*\)/gi, ' ')
      .replace(/\b\d+\s*(?:-|to)?\s*\d*\s*words?\b/gi, ' '),
  );
}

function extractText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function findLatestValidation() {
  if (!fs.existsSync(REPORT_ROOT)) return null;
  const latest = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) => /^essay-prompt-source-validation-.+\.json$/.test(file))
    .map((file) => ({
      file,
      mtimeMs: fs.statSync(path.join(REPORT_ROOT, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return latest ? path.join(REPORT_ROOT, latest.file) : null;
}

function resolveInputPath(value: string) {
  if (path.isAbsolute(value)) return value;
  const candidates = [
    path.resolve(process.cwd(), value),
    path.resolve(API_ROOT, value),
    path.resolve(API_ROOT, '..', '..', value),
  ];
  return (
    candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[1]
  );
}

function firstNonNull<T>(items: Array<T | null | undefined>) {
  return items.find((item): item is T => item !== null && item !== undefined);
}

function numberSummary(
  summary: Record<string, unknown> | undefined,
  key: string,
) {
  const value = summary?.[key];
  return typeof value === 'number' ? value : 0;
}

function inferApplicationYear(cycleSignals: string[]) {
  const years = cycleSignals
    .flatMap((signal) => signal.match(/\b20(2[4-9]|3[0-2])\b/g) ?? [])
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year));
  return years.length ? Math.max(...years) : null;
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeText(text: string | null | undefined) {
  return String(text ?? '')
    .replace(/[\uFB00-\uFB04]/g, (ligature) => {
      const map: Record<string, string> = {
        '\uFB00': 'ff',
        '\uFB01': 'fi',
        '\uFB02': 'fl',
        '\uFB03': 'ffi',
        '\uFB04': 'ffl',
      };
      return map[ligature] ?? ligature;
    })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const rows = Array.isArray(report.rows) ? (report.rows as StagingRow[]) : [];
  const lines = [
    '# Essay Prompt Source Review Staging Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Validation: ${report.validation ?? 'none'}`,
    '',
    '## Summary',
    '',
    `- Validated candidate rows: ${report.summary?.validatedCandidateRows ?? 0}`,
    `- Accepted for reviewer queue: ${report.summary?.acceptedForReviewerQueue ?? 0}`,
    `- Blocked from reviewer queue: ${report.summary?.blockedFromReviewerQueue ?? 0}`,
    `- Staged source rows: ${report.summary?.stagedSourceRows ?? 0}`,
    `- Canonical duplicate prompt groups: ${report.summary?.canonicalDuplicatePromptGroups ?? 0}`,
    '',
    '## Review Contract',
    '',
    '- Staging rows are not DB writes and do not make prompts public-visible.',
    '- Reviewer approval must confirm source family, cycle year, prompt text, word limits, and required flags.',
    '- Use staged `EssayPromptSource` candidates only through an approved admin/review workflow.',
    '',
    '## Staging Rows',
    '',
    '| School | Accepted | Source Rows | Source | Blockers |',
    '| --- | --- | ---: | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${escapeMarkdown(row.schoolName)} | ${row.acceptedForReviewerQueue ? 'yes' : 'no'} | ${row.stagedSourceRows} | ${escapeMarkdown(row.sourceUrl)} | ${escapeMarkdown(row.blockerReasons.join('; ') || 'none')} |`,
    ),
    '',
    '## Source Row Candidates',
    '',
    '| School | Prompt ID | Confidence | Source Type | Canonical Key | Review Flags | Evidence |',
    '| --- | --- | ---: | --- | --- | --- | --- |',
    ...rows
      .flatMap((row) => row.sourceRowCandidates)
      .map(
        (candidate) =>
          `| ${escapeMarkdown(candidate.schoolName)} | ${candidate.essayPromptId} | ${candidate.confidence} | ${candidate.sourceType} | ${escapeMarkdown(candidate.canonicalPromptKey)} | ${escapeMarkdown(candidate.reviewFlags.join('; ') || 'none')} | ${escapeMarkdown(candidate.evidenceSnippet ?? '')} |`,
      ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderCsv(rows: StagingRow[]) {
  const header = [
    'schoolId',
    'schoolName',
    'applicationYear',
    'sourceUrl',
    'acceptedForReviewerQueue',
    'stagedSourceRows',
    'blockerReasons',
    'reviewFlags',
    'essayPromptId',
    'canonicalPromptKey',
    'candidateReviewFlags',
    'sourceType',
    'confidence',
    'rawContentSha256',
    'scrapedAt',
    'evidenceSnippet',
  ];
  const lines = rows.flatMap((row) =>
    row.sourceRowCandidates.map((candidate) =>
      [
        row.schoolId,
        row.schoolName,
        row.applicationYear ?? '',
        row.sourceUrl,
        row.acceptedForReviewerQueue,
        row.stagedSourceRows,
        row.blockerReasons.join('|'),
        row.reviewFlags.join('|'),
        candidate.essayPromptId,
        candidate.canonicalPromptKey,
        candidate.reviewFlags.join('|'),
        candidate.sourceType,
        candidate.confidence,
        candidate.rawContentSha256,
        candidate.scrapedAt ?? '',
        candidate.evidenceSnippet ?? '',
      ]
        .map(csvCell)
        .join(','),
    ),
  );
  return `${[header.join(','), ...lines].join('\n')}\n`;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, '\\|');
}

function printSummary(args: Args, report: Record<string, any>) {
  console.log(`Essay prompt source review staging status: ${report.status}`);
  console.log(
    `Validated candidate rows: ${report.summary?.validatedCandidateRows ?? 0}`,
  );
  console.log(
    `Accepted for reviewer queue: ${report.summary?.acceptedForReviewerQueue ?? 0}`,
  );
  console.log(`Staged source rows: ${report.summary?.stagedSourceRows ?? 0}`);
  console.log(`JSON: ${args.out}`);
  console.log(`Markdown: ${args.markdown}`);
  console.log(`CSV: ${args.csv}`);
}

main();
