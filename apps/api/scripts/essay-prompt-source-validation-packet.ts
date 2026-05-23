#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'SOURCE_VALIDATION_PACKET_READY'
  | 'PASS_NO_SOURCE_CANDIDATES'
  | 'BLOCKED_SOURCE_RECOVERY_MISSING';

type FetchStatus =
  | 'reachable_html'
  | 'reachable_non_html'
  | 'fetch_failed'
  | 'blocked'
  | 'skipped_invalid_url';

type EvidenceStatus =
  | 'candidate_validated_for_review'
  | 'prompt_match_needs_review'
  | 'reachable_context_only'
  | 'reachable_no_prompt_match'
  | 'non_html_review'
  | 'blocked_or_fetch_failed'
  | 'candidate_only_unchecked';

interface Args {
  sourceRecovery: string | null;
  out: string;
  markdown: string;
  csv: string;
  offsetSchools: number;
  limitSchools: number;
  maxCandidatesPerSchool: number;
  timeoutMs: number;
  maxBytes: number;
  followLinkedCandidates: number;
  userAgent: string;
}

interface SourceRecoveryReport {
  generatedAt?: string;
  applicationYear?: number | null;
  status?: string;
  rows?: SchoolSourceRecoveryRow[];
  summary?: Record<string, unknown>;
}

interface SchoolSourceRecoveryRow {
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  applicationYear: number | null;
  promptCount: number;
  criticalPromptCount: number;
  promptSamples: PromptSample[];
  candidateSources: CandidateSource[];
  recommendedAction: string;
  reviewDisposition: string;
}

interface PromptSample {
  essayPromptId: string;
  type: string;
  wordLimit: number | null;
  isRequired: boolean | null;
  promptSnippet: string | null;
  route: string;
}

interface CandidateSource {
  sourceType: string;
  sourceUrl: string;
  sourceQuality: string;
  evidenceStatus: string;
  priority: number;
  reason: string;
  reviewAction: string;
}

interface CandidateValidationRow {
  candidateDepth: number;
  parentSourceUrl: string | null;
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  applicationYear: number | null;
  promptCount: number;
  criticalPromptCount: number;
  sourceType: string;
  sourceQuality: string;
  sourceUrl: string;
  priority: number;
  fetchStatus: FetchStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  contentType: string | null;
  bytesRead: number;
  truncated: boolean;
  error: string | null;
  promptMatchCount: number;
  matchedPromptIds: string[];
  promptMatches: PromptMatch[];
  linkCandidates: LinkCandidate[];
  cycleSignals: string[];
  promptLanguageSignals: string[];
  evidenceStatus: EvidenceStatus;
  recommendedAction: string;
  reviewDisposition: string;
}

interface PromptMatch {
  essayPromptId: string;
  promptSnippet: string;
  matchKind: 'exact_phrase' | 'normalized_phrase';
  evidenceSnippet: string | null;
}

interface LinkCandidate {
  url: string;
  text: string;
  score: number;
  reasons: string[];
}

interface FetchResult {
  fetchStatus: FetchStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  contentType: string | null;
  text: string;
  bytesRead: number;
  truncated: boolean;
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
      path.join(REPORT_ROOT, `essay-prompt-source-validation-${stamp}.json`),
    )!,
  );
  const sourceRecovery = get('--source-recovery');
  return {
    sourceRecovery: sourceRecovery
      ? path.resolve(API_ROOT, sourceRecovery)
      : findLatestSourceRecovery(),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    offsetSchools: Number(get('--offset-schools', '0')),
    limitSchools: Number(get('--limit-schools', '20')),
    maxCandidatesPerSchool: Number(get('--max-candidates-per-school', '3')),
    timeoutMs: Number(get('--timeout-ms', '10000')),
    maxBytes: Number(get('--max-bytes', `${750 * 1024}`)),
    followLinkedCandidates: Number(get('--follow-linked-candidates', '0')),
    userAgent:
      get(
        '--user-agent',
        'Mozilla/5.0 (compatible; StudyAbroadPlatformDataAudit/1.0; +https://example.invalid/data-audit)',
      ) ?? '',
  };
}

async function main() {
  const args = parseArgs();
  if (!args.sourceRecovery || !fs.existsSync(args.sourceRecovery)) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-essay-prompt-source-validation',
      status: 'BLOCKED_SOURCE_RECOVERY_MISSING' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      sourceRecovery: args.sourceRecovery,
      summary: {
        checkedSchools: 0,
        checkedCandidates: 0,
        validatedCandidates: 0,
      },
      reviewContract: reviewContract(),
      nextCampaign: {
        id: 'essay_prompt_source_recovery',
        reason: 'Run source recovery before validating candidate URLs.',
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    return;
  }

  const sourceRecovery = JSON.parse(
    fs.readFileSync(args.sourceRecovery, 'utf8'),
  ) as SourceRecoveryReport;
  const eligibleSchoolRows = (sourceRecovery.rows ?? [])
    .filter((row) => row.candidateSources?.length > 0)
    .sort(compareSourceRecoveryRows);
  const offsetSchools = Math.max(0, args.offsetSchools);
  const schoolRows = eligibleSchoolRows.slice(
    offsetSchools,
    offsetSchools + args.limitSchools,
  );
  const rows: CandidateValidationRow[] = [];

  for (const school of schoolRows) {
    const candidates = school.candidateSources
      .slice()
      .sort((a, b) => b.priority - a.priority)
      .slice(0, args.maxCandidatesPerSchool);
    for (const candidate of candidates) {
      rows.push(await validateCandidate(args, school, candidate, 0, null));
    }
  }

  if (args.followLinkedCandidates > 0) {
    const linkedJobs = buildLinkedValidationJobs(rows, schoolRows).slice(
      0,
      args.followLinkedCandidates,
    );
    for (const job of linkedJobs) {
      rows.push(
        await validateCandidate(
          args,
          job.school,
          job.candidate,
          1,
          job.parentSourceUrl,
        ),
      );
    }
  }

  const summary = buildSummary(rows, schoolRows.length);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-source-validation',
    status: (rows.length > 0
      ? 'SOURCE_VALIDATION_PACKET_READY'
      : 'PASS_NO_SOURCE_CANDIDATES') satisfies PacketStatus,
    destructiveDbWriteAllowedByThisPlan: false,
    sourceRecovery: path.relative(API_ROOT, args.sourceRecovery),
    sourceRecoveryGeneratedAt: sourceRecovery.generatedAt ?? null,
    sourceRecoveryStatus: sourceRecovery.status ?? null,
    applicationYear: sourceRecovery.applicationYear ?? null,
    limits: {
      offsetSchools,
      limitSchools: args.limitSchools,
      eligibleSchools: eligibleSchoolRows.length,
      maxCandidatesPerSchool: args.maxCandidatesPerSchool,
      timeoutMs: args.timeoutMs,
      maxBytes: args.maxBytes,
      followLinkedCandidates: args.followLinkedCandidates,
    },
    summary,
    reviewContract: reviewContract(),
    nextCampaign: buildNextCampaign(rows, schoolRows),
    rows,
  };

  writeReport(args, report);
  printSummary(args, report);
}

async function validateCandidate(
  args: Args,
  school: SchoolSourceRecoveryRow,
  candidate: CandidateSource,
  candidateDepth: number,
  parentSourceUrl: string | null,
): Promise<CandidateValidationRow> {
  const fetchResult = await fetchCandidate(candidate.sourceUrl, args);
  const extractedText =
    fetchResult.fetchStatus === 'reachable_html'
      ? extractText(fetchResult.text)
      : fetchResult.text;
  const promptMatches =
    fetchResult.fetchStatus === 'reachable_html'
      ? matchPrompts(extractedText, school.promptSamples)
      : [];
  const linkCandidates =
    fetchResult.fetchStatus === 'reachable_html'
      ? extractLinkCandidates(
          fetchResult.text,
          fetchResult.finalUrl ?? candidate.sourceUrl,
        )
      : [];
  const cycleSignals =
    fetchResult.fetchStatus === 'reachable_html'
      ? findCycleSignals(extractedText, school.applicationYear)
      : [];
  const promptLanguageSignals =
    fetchResult.fetchStatus === 'reachable_html'
      ? findPromptLanguageSignals(extractedText)
      : [];
  const evidenceStatus = classifyEvidence(
    fetchResult,
    promptMatches,
    cycleSignals,
    promptLanguageSignals,
    candidate,
  );
  return {
    candidateDepth,
    parentSourceUrl,
    schoolId: school.schoolId,
    schoolName: school.schoolName,
    usNewsRank: school.usNewsRank,
    applicationYear: school.applicationYear,
    promptCount: school.promptCount,
    criticalPromptCount: school.criticalPromptCount,
    sourceType: candidate.sourceType,
    sourceQuality: candidate.sourceQuality,
    sourceUrl: candidate.sourceUrl,
    priority: candidate.priority,
    fetchStatus: fetchResult.fetchStatus,
    httpStatus: fetchResult.httpStatus,
    finalUrl: fetchResult.finalUrl,
    contentType: fetchResult.contentType,
    bytesRead: fetchResult.bytesRead,
    truncated: fetchResult.truncated,
    error: fetchResult.error,
    promptMatchCount: promptMatches.length,
    matchedPromptIds: promptMatches.map((match) => match.essayPromptId),
    promptMatches,
    linkCandidates,
    cycleSignals,
    promptLanguageSignals,
    evidenceStatus,
    recommendedAction: recommendedAction(evidenceStatus, linkCandidates.length),
    reviewDisposition: reviewDisposition(evidenceStatus),
  };
}

function buildLinkedValidationJobs(
  rows: CandidateValidationRow[],
  schoolRows: SchoolSourceRecoveryRow[],
) {
  const schoolsById = new Map(
    schoolRows.map((school) => [school.schoolId, school]),
  );
  const seen = new Set<string>();
  return rows
    .flatMap((row) => {
      const school = schoolsById.get(row.schoolId);
      if (!school) return [];
      return row.linkCandidates.map((link) => ({
        school,
        parentSourceUrl: row.sourceUrl,
        link,
        candidate: {
          sourceType: 'LINKED_SOURCE_CANDIDATE',
          sourceUrl: link.url,
          sourceQuality: inferLinkedSourceQuality(link.url, row.sourceQuality),
          evidenceStatus: 'candidate_only',
          priority: Math.max(1, link.score),
          reason: `Linked candidate discovered from ${row.sourceUrl}`,
          reviewAction: 'validate-linked-source-candidates',
        } satisfies CandidateSource,
      }));
    })
    .filter((job) => {
      const key = `${job.school.schoolId}:${job.candidate.sourceUrl
        .replace(/\/+$/, '')
        .toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        b.link.score - a.link.score ||
        b.school.criticalPromptCount - a.school.criticalPromptCount ||
        (a.school.usNewsRank ?? Number.MAX_SAFE_INTEGER) -
          (b.school.usNewsRank ?? Number.MAX_SAFE_INTEGER) ||
        a.school.schoolName.localeCompare(b.school.schoolName),
    );
}

function inferLinkedSourceQuality(url: string, parentSourceQuality: string) {
  const normalized = url.toLowerCase();
  if (normalized.includes('commonapp.org')) return 'common_app';
  if (
    parentSourceQuality === 'official' ||
    parentSourceQuality === 'configured'
  ) {
    return parentSourceQuality;
  }
  return 'unknown';
}

async function fetchCandidate(
  sourceUrl: string,
  args: Args,
): Promise<FetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch (error) {
    return {
      fetchStatus: 'skipped_invalid_url',
      httpStatus: null,
      finalUrl: null,
      contentType: null,
      text: '',
      bytesRead: 0,
      truncated: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      fetchStatus: 'skipped_invalid_url',
      httpStatus: null,
      finalUrl: null,
      contentType: null,
      text: '',
      bytesRead: 0,
      truncated: false,
      error: `Unsupported protocol: ${parsed.protocol}`,
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
        fetchStatus: [401, 403, 429].includes(response.status)
          ? 'blocked'
          : 'fetch_failed',
        httpStatus: response.status,
        finalUrl: response.url,
        contentType,
        text: '',
        bytesRead: 0,
        truncated: false,
        error: `HTTP ${response.status}`,
      };
    }
    const isReadableText =
      !contentType ||
      /text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType);
    const body = isReadableText
      ? await readResponseText(response, args.maxBytes)
      : { text: '', bytesRead: 0, truncated: false };
    return {
      fetchStatus: isReadableText ? 'reachable_html' : 'reachable_non_html',
      httpStatus: response.status,
      finalUrl: response.url,
      contentType,
      text: body.text,
      bytesRead: body.bytesRead,
      truncated: body.truncated,
      error: null,
    };
  } catch (error) {
    return {
      fetchStatus:
        error instanceof Error && error.name === 'AbortError'
          ? 'blocked'
          : 'fetch_failed',
      httpStatus: null,
      finalUrl: null,
      contentType: null,
      text: '',
      bytesRead: 0,
      truncated: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
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

function matchPrompts(text: string, prompts: PromptSample[]) {
  const normalizedText = normalizeText(text);
  const matches: PromptMatch[] = [];
  for (const prompt of prompts) {
    const promptSnippet = prompt.promptSnippet?.trim();
    if (!promptSnippet) continue;
    const fragments = promptFragments(promptSnippet);
    const match = fragments
      .map((fragment) => ({
        original: fragment,
        normalized: normalizeText(fragment),
      }))
      .find(
        (fragment) =>
          fragment.normalized.length >= 15 &&
          normalizedText.includes(fragment.normalized),
      );
    if (!match) continue;
    matches.push({
      essayPromptId: prompt.essayPromptId,
      promptSnippet,
      matchKind:
        text.toLowerCase().includes(match.original.toLowerCase()) &&
        match.original.length >= 15
          ? 'exact_phrase'
          : 'normalized_phrase',
      evidenceSnippet: findEvidenceSnippet(text, match.original),
    });
  }
  return dedupePromptMatches(matches);
}

function promptFragments(prompt: string) {
  const fragments = new Set<string>();
  const cleaned = prompt
    .replace(/\(Exact questions not provided in the source\)/gi, '')
    .replace(/^Option\s+[A-Z]:\s*/i, '')
    .trim();
  fragments.add(cleaned);
  if (cleaned.length > 120) fragments.add(cleaned.slice(0, 120));
  const questionParts = cleaned
    .split(/(?<=\?)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of questionParts) fragments.add(part);
  return Array.from(fragments).filter((fragment) => fragment.length >= 15);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[`'"]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findEvidenceSnippet(text: string, fragment: string) {
  const index = text.toLowerCase().indexOf(fragment.toLowerCase());
  if (index < 0) return null;
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + fragment.length + 90);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function dedupePromptMatches(matches: PromptMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    if (seen.has(match.essayPromptId)) return false;
    seen.add(match.essayPromptId);
    return true;
  });
}

function findCycleSignals(text: string, applicationYear: number | null) {
  const signals = new Set<string>();
  const patterns = [
    /\b20\d{2}\s*[-/]\s*(?:20)?\d{2}\b/g,
    /\b(?:fall|spring|summer)\s+20\d{2}\b/gi,
    /\b20\d{2}\s+(?:application|admission|admissions)\b/gi,
    /\b(?:class|entering class)\s+of\s+20\d{2}\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      signals.add(match[0].replace(/\s+/g, ' ').trim());
    }
  }
  if (
    applicationYear &&
    normalizeText(text).includes(String(applicationYear))
  ) {
    signals.add(String(applicationYear));
  }
  return Array.from(signals).slice(0, 12);
}

function findPromptLanguageSignals(text: string) {
  const normalized = normalizeText(text);
  const checks = [
    ['essay', 'essay'],
    ['supplement', 'supplement'],
    ['writing supplement', 'writing supplement'],
    ['short answer', 'short answer'],
    ['word limit', 'word limit'],
    ['common app', 'common app'],
    ['personal insight', 'personal insight'],
    ['application question', 'application question'],
  ];
  return checks
    .filter(([, needle]) => normalized.includes(needle))
    .map(([label]) => label);
}

function extractLinkCandidates(html: string, baseUrl: string) {
  const candidates: LinkCandidate[] = [];
  const linkPattern =
    /<a\s+[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const href = decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? '');
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) continue;
    let url: string;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    const text = extractText(match[4] ?? '').slice(0, 160);
    const scored = scoreLinkCandidate(url, text);
    if (scored.score < 20) continue;
    candidates.push({ url, text, ...scored });
  }
  const bestByUrl = new Map<string, LinkCandidate>();
  for (const candidate of candidates) {
    const key = candidate.url.replace(/\/+$/, '').toLowerCase();
    const existing = bestByUrl.get(key);
    if (!existing || candidate.score > existing.score) {
      bestByUrl.set(key, candidate);
    }
  }
  return Array.from(bestByUrl.values())
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, 10);
}

function scoreLinkCandidate(url: string, text: string) {
  const normalized = normalizeText(`${url} ${text}`);
  const reasons: string[] = [];
  let score = 0;
  const add = (reason: string, points: number) => {
    reasons.push(reason);
    score += points;
  };
  if (/essay|essays/.test(normalized)) add('essay', 60);
  if (/supplement|supplemental/.test(normalized)) add('supplement', 55);
  if (/writing/.test(normalized)) add('writing', 45);
  if (/prompt|question|questions/.test(normalized))
    add('prompt-or-question', 45);
  if (/short answer|shortanswer/.test(normalized)) add('short-answer', 40);
  if (/application requirements|apply requirements/.test(normalized)) {
    add('application-requirements', 30);
  }
  if (/common app|commonapp/.test(normalized)) add('common-app', 30);
  if (/first year|firstyear|undergraduate admission/.test(normalized)) {
    add('first-year-admission', 18);
  }
  if (/\bapply\b|application/.test(normalized)) add('apply', 16);
  if (/transfer/.test(normalized)) add('transfer-lower-priority', -140);
  if (/arts supplement|art supplement/.test(normalized)) {
    add('arts-supplement-lower-priority', -55);
  }
  if (/graduate/.test(normalized)) add('graduate-lower-priority', -120);
  return { score, reasons };
}

function classifyEvidence(
  fetchResult: FetchResult,
  promptMatches: PromptMatch[],
  cycleSignals: string[],
  promptLanguageSignals: string[],
  candidate: CandidateSource,
): EvidenceStatus {
  if (
    fetchResult.fetchStatus === 'fetch_failed' ||
    fetchResult.fetchStatus === 'blocked' ||
    fetchResult.fetchStatus === 'skipped_invalid_url'
  ) {
    return 'blocked_or_fetch_failed';
  }
  if (fetchResult.fetchStatus === 'reachable_non_html')
    return 'non_html_review';
  if (promptMatches.length > 0) {
    return trustedSourceFamily(candidate.sourceQuality) &&
      promptLanguageSignals.length > 0
      ? 'candidate_validated_for_review'
      : 'prompt_match_needs_review';
  }
  if (cycleSignals.length > 0 || promptLanguageSignals.length > 0) {
    return 'reachable_context_only';
  }
  if (fetchResult.fetchStatus === 'reachable_html') {
    return 'reachable_no_prompt_match';
  }
  return 'candidate_only_unchecked';
}

function trustedSourceFamily(sourceQuality: string) {
  return ['official', 'common_app', 'configured'].includes(
    sourceQuality.toLowerCase(),
  );
}

function recommendedAction(status: EvidenceStatus, linkCandidateCount = 0) {
  switch (status) {
    case 'candidate_validated_for_review':
      return 'stage-source-row-for-review';
    case 'prompt_match_needs_review':
      return 'manual-source-family-review';
    case 'reachable_context_only':
      return linkCandidateCount > 0
        ? 'validate-linked-source-candidates'
        : 'inspect-page-or-linked-application';
    case 'reachable_no_prompt_match':
      return linkCandidateCount > 0
        ? 'validate-linked-source-candidates'
        : 'refine-source-search';
    case 'non_html_review':
      return 'manual-non-html-review';
    case 'blocked_or_fetch_failed':
      return 'retry-or-manual-source-search';
    case 'candidate_only_unchecked':
      return 'continue-validation';
  }
}

function reviewDisposition(status: EvidenceStatus) {
  switch (status) {
    case 'candidate_validated_for_review':
    case 'prompt_match_needs_review':
      return 'review-evidence-before-write';
    case 'reachable_context_only':
      return 'review-linked-source';
    case 'reachable_no_prompt_match':
      return 'candidate-not-enough-evidence';
    case 'non_html_review':
      return 'manual-review-required';
    case 'blocked_or_fetch_failed':
      return 'blocked-or-terminal-if-repeated';
    case 'candidate_only_unchecked':
      return 'unchecked';
  }
}

function buildSummary(rows: CandidateValidationRow[], checkedSchools: number) {
  const validated = rows.filter(
    (row) => row.evidenceStatus === 'candidate_validated_for_review',
  );
  return {
    checkedSchools,
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
      (sum, row) => sum + row.promptMatchCount,
      0,
    ),
    cycleSignalCandidates: rows.filter((row) => row.cycleSignals.length > 0)
      .length,
    promptLanguageSignalCandidates: rows.filter(
      (row) => row.promptLanguageSignals.length > 0,
    ).length,
    linkedSourceCandidateRows: rows.filter(
      (row) => row.linkCandidates.length > 0,
    ).length,
    linkedSourceCandidates: rows.reduce(
      (sum, row) => sum + row.linkCandidates.length,
      0,
    ),
    followedLinkedCandidates: rows.filter((row) => row.candidateDepth > 0)
      .length,
    byFetchStatus: countBy(rows, (row) => row.fetchStatus),
    byEvidenceStatus: countBy(rows, (row) => row.evidenceStatus),
    byCandidateDepth: countBy(rows, (row) => String(row.candidateDepth)),
    topValidatedSchools: Array.from(
      new Set(validated.map((row) => row.schoolName)),
    ).slice(0, 10),
    topLinkedSourceCandidates: rows
      .flatMap((row) =>
        row.linkCandidates.map((link) => ({
          schoolName: row.schoolName,
          sourceUrl: row.sourceUrl,
          linkedUrl: link.url,
          score: link.score,
          reasons: link.reasons,
        })),
      )
      .sort(
        (a, b) => b.score - a.score || a.schoolName.localeCompare(b.schoolName),
      )
      .slice(0, 10),
  };
}

function buildNextCampaign(
  rows: CandidateValidationRow[],
  schoolRows: SchoolSourceRecoveryRow[],
) {
  const validated = rows
    .filter((row) => row.evidenceStatus === 'candidate_validated_for_review')
    .sort(compareValidationRows)[0];
  if (validated) {
    return {
      id: 'essay_prompt_source_review',
      reason: `${validated.schoolName} has a candidate URL with prompt text matches; review before creating staging EssayPromptSource rows.`,
      schoolId: validated.schoolId,
      schoolName: validated.schoolName,
      sourceUrl: validated.sourceUrl,
      promptMatchCount: validated.promptMatchCount,
      recommendedAction: validated.recommendedAction,
    };
  }
  const linkedCandidate = rows
    .filter((row) => row.linkCandidates.length > 0)
    .sort(compareValidationRows)[0];
  if (linkedCandidate) {
    const topLink = linkedCandidate.linkCandidates[0];
    return {
      id: 'essay_prompt_link_candidate_validation',
      reason: `${linkedCandidate.schoolName} has linked source candidates from a reachable admissions page; validate ${topLink.url}.`,
      schoolId: linkedCandidate.schoolId,
      schoolName: linkedCandidate.schoolName,
      sourceUrl: topLink.url,
      recommendedAction: linkedCandidate.recommendedAction,
    };
  }
  const contextOnly = rows
    .filter((row) => row.evidenceStatus === 'reachable_context_only')
    .sort(compareValidationRows)[0];
  if (contextOnly) {
    return {
      id: 'essay_prompt_link_inspection',
      reason: `${contextOnly.schoolName} has reachable admissions context but no prompt match; inspect linked application pages or Common App.`,
      schoolId: contextOnly.schoolId,
      schoolName: contextOnly.schoolName,
      sourceUrl: contextOnly.sourceUrl,
      recommendedAction: contextOnly.recommendedAction,
    };
  }
  const [topSchool] = schoolRows;
  return {
    id: 'essay_prompt_source_search_refinement',
    reason: topSchool
      ? `${topSchool.schoolName} still lacks validated prompt evidence; refine official/Common App source search.`
      : 'No source candidates were available for validation.',
    schoolId: topSchool?.schoolId ?? null,
    schoolName: topSchool?.schoolName ?? null,
    recommendedAction: 'refine-source-search',
  };
}

function compareSourceRecoveryRows(
  a: SchoolSourceRecoveryRow,
  b: SchoolSourceRecoveryRow,
) {
  return (
    b.criticalPromptCount - a.criticalPromptCount ||
    b.promptCount - a.promptCount ||
    (a.usNewsRank ?? Number.MAX_SAFE_INTEGER) -
      (b.usNewsRank ?? Number.MAX_SAFE_INTEGER) ||
    a.schoolName.localeCompare(b.schoolName)
  );
}

function compareValidationRows(
  a: CandidateValidationRow,
  b: CandidateValidationRow,
) {
  return (
    b.promptMatchCount - a.promptMatchCount ||
    b.criticalPromptCount - a.criticalPromptCount ||
    b.promptCount - a.promptCount ||
    (a.usNewsRank ?? Number.MAX_SAFE_INTEGER) -
      (b.usNewsRank ?? Number.MAX_SAFE_INTEGER) ||
    b.priority - a.priority ||
    a.schoolName.localeCompare(b.schoolName)
  );
}

function reviewContract() {
  return {
    validationEvidenceStatus:
      'candidate_validated_for_review means the fetched page text matched prompt snippets, not that the source is trusted/accepted.',
    acceptedEvidenceRequires: [
      'reviewer confirms the page is an approved source family for the school or application system',
      'raw source content or snapshot is retained with sourceUrl, fetchedAt, applicationYear, confidence, and review status',
      'word limit, required flag, and prompt text conflicts are routed to review rather than overwritten',
      'public/timeline consumers continue to require verified prompts with EssayPromptSource.sourceUrl',
    ],
    prohibitedActions: [
      'do not write EssayPromptSource rows from this validation packet without review',
      'do not mark source-less prompts trusted usable',
      'do not bypass the source-gated public/timeline consumer checks',
    ],
  };
}

function findLatestSourceRecovery() {
  if (!fs.existsSync(REPORT_ROOT)) return null;
  const latest = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) => /^essay-prompt-source-recovery-.+\.json$/.test(file))
    .map((file) => ({
      file,
      mtimeMs: fs.statSync(path.join(REPORT_ROOT, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return latest ? path.join(REPORT_ROOT, latest.file) : null;
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
  const rows = Array.isArray(report.rows)
    ? (report.rows as CandidateValidationRow[])
    : [];
  const validated = rows.filter(
    (row) => row.evidenceStatus === 'candidate_validated_for_review',
  );
  const lines = [
    '# Essay Prompt Source Validation Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Source recovery: ${report.sourceRecovery ?? 'none'}`,
    '',
    '## Summary',
    '',
    `- School offset: ${report.limits?.offsetSchools ?? 0}`,
    `- Eligible schools: ${report.limits?.eligibleSchools ?? 'unknown'}`,
    `- Checked schools: ${report.summary?.checkedSchools ?? 0}`,
    `- Checked candidates: ${report.summary?.checkedCandidates ?? 0}`,
    `- Reachable HTML candidates: ${report.summary?.reachableCandidates ?? 0}`,
    `- Validated candidates for review: ${report.summary?.validatedCandidates ?? 0}`,
    `- Prompt-match candidates: ${report.summary?.promptMatchCandidates ?? 0}`,
    `- Linked source candidates: ${report.summary?.linkedSourceCandidates ?? 0}`,
    `- Blocked/failed candidates: ${report.summary?.blockedOrFailedCandidates ?? 0}`,
    '',
    '## Review Contract',
    '',
    '- Fetched prompt matches are review candidates, not accepted facts.',
    '- Do not write `EssayPromptSource` rows or expose prompts publicly from this packet alone.',
    '- Accepted evidence still needs source family, raw snapshot, cycle year, confidence, and review status.',
    '',
    '## Validated Candidate Rows',
    '',
    '| School | Matches | Source | Action |',
    '| --- | ---: | --- | --- |',
    ...(validated.length > 0
      ? validated
          .slice(0, 40)
          .map((row) =>
            [
              `| ${escapeMarkdown(row.schoolName)}`,
              row.promptMatchCount,
              escapeMarkdown(row.sourceUrl),
              `${row.recommendedAction} |`,
            ].join(' | '),
          )
      : ['| None | 0 | n/a | refine-source-search |']),
    '',
    '## Linked Source Candidate Rows',
    '',
    '| School | Link Score | Linked Source | Reasons |',
    '| --- | ---: | --- | --- |',
    ...rows
      .flatMap((row) =>
        row.linkCandidates.map((link) => ({
          schoolName: row.schoolName,
          ...link,
        })),
      )
      .sort(
        (a, b) => b.score - a.score || a.schoolName.localeCompare(b.schoolName),
      )
      .slice(0, 60)
      .map(
        (link) =>
          `| ${escapeMarkdown(link.schoolName)} | ${link.score} | ${escapeMarkdown(link.url)} | ${escapeMarkdown(link.reasons.join('|'))} |`,
      ),
    '',
    '## Checked Candidate Rows',
    '',
    '| School | Fetch | Evidence | Matches | Source |',
    '| --- | --- | --- | ---: | --- |',
    ...rows
      .slice(0, 80)
      .map((row) =>
        [
          `| ${escapeMarkdown(row.schoolName)}`,
          row.fetchStatus,
          row.evidenceStatus,
          row.promptMatchCount,
          `${escapeMarkdown(row.sourceUrl)} |`,
        ].join(' | '),
      ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderCsv(rows: CandidateValidationRow[]) {
  const header = [
    'schoolId',
    'schoolName',
    'applicationYear',
    'candidateDepth',
    'parentSourceUrl',
    'sourceType',
    'sourceQuality',
    'sourceUrl',
    'fetchStatus',
    'httpStatus',
    'finalUrl',
    'contentType',
    'bytesRead',
    'promptMatchCount',
    'matchedPromptIds',
    'linkCandidateCount',
    'topLinkCandidate',
    'cycleSignals',
    'promptLanguageSignals',
    'evidenceStatus',
    'recommendedAction',
    'reviewDisposition',
    'error',
  ];
  const lines = rows.map((row) =>
    [
      row.schoolId,
      row.schoolName,
      row.applicationYear ?? '',
      row.candidateDepth,
      row.parentSourceUrl ?? '',
      row.sourceType,
      row.sourceQuality,
      row.sourceUrl,
      row.fetchStatus,
      row.httpStatus ?? '',
      row.finalUrl ?? '',
      row.contentType ?? '',
      row.bytesRead,
      row.promptMatchCount,
      row.matchedPromptIds.join('|'),
      row.linkCandidates.length,
      row.linkCandidates[0]?.url ?? '',
      row.cycleSignals.join('|'),
      row.promptLanguageSignals.join('|'),
      row.evidenceStatus,
      row.recommendedAction,
      row.reviewDisposition,
      row.error ?? '',
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
  return value.replace(/\|/g, '\\|');
}

function printSummary(args: Args, report: Record<string, any>) {
  console.log(`Essay prompt source validation status: ${report.status}`);
  console.log(`Checked schools: ${report.summary?.checkedSchools ?? 0}`);
  console.log(`Checked candidates: ${report.summary?.checkedCandidates ?? 0}`);
  console.log(
    `Validated candidates: ${report.summary?.validatedCandidates ?? 0}`,
  );
  console.log(
    `Prompt-match candidates: ${report.summary?.promptMatchCandidates ?? 0}`,
  );
  console.log(
    `Linked source candidates: ${report.summary?.linkedSourceCandidates ?? 0}`,
  );
  console.log(`JSON: ${args.out}`);
  console.log(`Markdown: ${args.markdown}`);
  console.log(`CSV: ${args.csv}`);
}

main();
