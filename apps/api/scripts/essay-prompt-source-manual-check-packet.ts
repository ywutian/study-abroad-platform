#!/usr/bin/env tsx
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

type PacketStatus =
  | 'ESSAY_PROMPT_SOURCE_MANUAL_CHECK_READY'
  | 'BLOCKED_MANUAL_CHECK_INPUTS_MISSING'
  | 'PASS_NO_MANUAL_CHECK_CANDIDATES';

interface Args {
  campaign: string | null;
  schoolId: string | null;
  candidateUrls: string[];
  out: string;
  markdown: string;
  csv: string;
  timeoutMs: number;
  maxBytes: number;
}

interface CampaignReport {
  generatedAt?: string;
  status?: string;
  nextCampaign?: {
    schoolId?: string;
    schoolName?: string;
  };
  rows?: CampaignRow[];
}

interface CampaignRow {
  schoolId: string;
  schoolName: string;
  applicationYear?: number | null;
  sourceSearchPromptRows: number;
  recommendedAction: string;
  topCandidateUrls?: string[];
  promptSamples: Array<{
    essayPromptId: string;
    type: string;
    promptSnippet: string | null;
  }>;
}

interface CheckedUrl {
  sourceUrl: string;
  fetchStatus:
    | 'reachable_html'
    | 'reachable_text'
    | 'non_html'
    | 'blocked_or_fetch_failed';
  httpStatus: number | null;
  finalUrl: string | null;
  contentType: string | null;
  bytesRead: number;
  error: string | null;
  promptMatchCount: number;
  matchedPromptIds: string[];
  promptMatches: PromptMatch[];
  promptLanguageSignals: string[];
  cycleSignals: string[];
  evidenceStatus:
    | 'candidate_validated_for_review'
    | 'cross_school_prompt_match'
    | 'historical_prompt_match_requires_review'
    | 'official_context_no_prompt_match'
    | 'untrusted_context_no_prompt_match'
    | 'reachable_no_prompt_signal'
    | 'blocked_or_fetch_failed'
    | 'non_html';
  recommendedAction:
    | 'stage-source-row-for-review'
    | 'review-cross-school-prompt-owner-conflict'
    | 'review-assigned-prompt-family-mismatch-or-terminal'
    | 'review-untrusted-context-or-find-official-source'
    | 'manual-inspect-or-terminal'
    | 'retry-or-external-source-search';
  evidenceSnippets: string[];
}

interface PromptMatch {
  essayPromptId: string;
  promptSnippet: string;
  matchKind: 'normalized_phrase' | 'truncated_prefix_with_prompt_context';
  evidenceSnippet: string;
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
      path.join(REPORT_ROOT, `essay-prompt-source-manual-check-${stamp}.json`),
    )!,
  );
  const campaign = get('--campaign');
  return {
    campaign: campaign
      ? resolveInputPath(campaign)
      : findLatest(/^essay-prompt-source-search-campaign-.+\.json$/),
    schoolId: get('--school-id') ?? null,
    candidateUrls: values('--candidate-url'),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    timeoutMs: Number(get('--timeout-ms', '15000')),
    maxBytes: Number(get('--max-bytes', '750000')),
  };
}

async function main() {
  const args = parseArgs();
  if (!args.campaign || !fs.existsSync(args.campaign)) {
    const report = blockedReport(args, [
      { input: '--campaign', reason: 'campaign report is missing' },
    ]);
    writeReport(args, report);
    printSummary(args, report);
    return;
  }
  if (args.candidateUrls.length === 0) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-essay-prompt-source-manual-check',
      status: 'PASS_NO_MANUAL_CHECK_CANDIDATES' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      notificationAllowedByThisPlan: false,
      summary: { checkedUrls: 0, blockedRows: 0 },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    return;
  }

  const campaign = readJson<CampaignReport>(args.campaign);
  const schoolId = args.schoolId ?? campaign.nextCampaign?.schoolId ?? null;
  const campaignRow = (campaign.rows ?? []).find(
    (row) => row.schoolId === schoolId,
  );
  if (!schoolId || !campaignRow) {
    const report = blockedReport(args, [
      {
        input: '--school-id',
        reason:
          'school id was not provided and could not be read from nextCampaign',
      },
    ]);
    writeReport(args, report);
    printSummary(args, report);
    return;
  }

  const checkedUrls = await Promise.all(
    args.candidateUrls.map((url) => checkUrl(url, campaignRow, args)),
  );
  const validated = checkedUrls.filter(
    (row) => row.evidenceStatus === 'candidate_validated_for_review',
  );
  const currentValidatedPromptIds = new Set(
    validated.flatMap((row) => row.matchedPromptIds),
  );
  const trustedValidated = validated.filter((row) =>
    isTrustedManualSourceUrl(row.sourceUrl, row.finalUrl),
  );
  const untrustedValidated = validated.filter(
    (row) => !isTrustedManualSourceUrl(row.sourceUrl, row.finalUrl),
  );
  const crossSchoolPromptMatches = checkedUrls.filter(
    (row) => row.evidenceStatus === 'cross_school_prompt_match',
  );
  const historicalPromptMatchReview = checkedUrls.filter(
    (row) => row.evidenceStatus === 'historical_prompt_match_requires_review',
  );
  const officialContextNoMatch = checkedUrls.filter(
    (row) => row.evidenceStatus === 'official_context_no_prompt_match',
  );
  const unmatchedPromptIds = campaignRow.promptSamples
    .map((prompt) => prompt.essayPromptId)
    .filter((promptId) => !currentValidatedPromptIds.has(promptId));
  const partialSourceFamilyMismatchPromptRows =
    validated.length > 0 &&
    unmatchedPromptIds.length > 0 &&
    (officialContextNoMatch.length > 0 ||
      historicalPromptMatchReview.length > 0 ||
      crossSchoolPromptMatches.length > 0)
      ? unmatchedPromptIds.length
      : 0;
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-source-manual-check',
    status: 'ESSAY_PROMPT_SOURCE_MANUAL_CHECK_READY' satisfies PacketStatus,
    destructiveDbWriteAllowedByThisPlan: false,
    notificationAllowedByThisPlan: false,
    sourceArtifacts: {
      campaign: summarizeInput(args.campaign, campaign),
    },
    target: {
      schoolId: campaignRow.schoolId,
      schoolName: campaignRow.schoolName,
      applicationYear: campaignRow.applicationYear ?? null,
      sourceSearchPromptRows: campaignRow.sourceSearchPromptRows,
      sourceSearchRecommendedAction: campaignRow.recommendedAction,
      promptSamples: campaignRow.promptSamples,
    },
    summary: {
      checkedUrls: checkedUrls.length,
      reachableHtmlUrls: checkedUrls.filter(
        (row) => row.fetchStatus === 'reachable_html',
      ).length,
      reachableTextUrls: checkedUrls.filter((row) =>
        ['reachable_html', 'reachable_text'].includes(row.fetchStatus),
      ).length,
      validatedSourceUrls: validated.length,
      trustedValidatedSourceUrls: trustedValidated.length,
      untrustedValidatedSourceUrls: untrustedValidated.length,
      crossSchoolPromptMatchUrls: crossSchoolPromptMatches.length,
      historicalPromptMatchReviewUrls: historicalPromptMatchReview.length,
      officialContextNoPromptMatchUrls: officialContextNoMatch.length,
      blockedOrFailedUrls: checkedUrls.filter(
        (row) => row.fetchStatus === 'blocked_or_fetch_failed',
      ).length,
      promptMatchCount: checkedUrls.reduce(
        (sum, row) => sum + row.promptMatchCount,
        0,
      ),
      matchedPromptIds: unique(
        checkedUrls.flatMap((row) => row.matchedPromptIds),
      ),
      unmatchedCurrentValidatedPromptIds: unmatchedPromptIds,
      partialSourceFamilyMismatchPromptRows,
      sourceFamilyMismatchReview:
        partialSourceFamilyMismatchPromptRows > 0 ||
        (untrustedValidated.length > 0 && officialContextNoMatch.length > 0) ||
        (validated.length === 0 && officialContextNoMatch.length > 0) ||
        historicalPromptMatchReview.length > 0 ||
        crossSchoolPromptMatches.length > 0,
      blockedRows: 0,
      byEvidenceStatus: countBy(checkedUrls, (row) => row.evidenceStatus),
      byRecommendedAction: countBy(checkedUrls, (row) => row.recommendedAction),
    },
    reviewContract: {
      manualCheckDoesNotApproveSources: true,
      candidateEvidenceStatus: 'candidate_only_until_review',
      requiredNextStep:
        validated.length > 0
          ? 'stage validated source rows for reviewer approval'
          : historicalPromptMatchReview.length > 0
            ? 'review historical prompt match before treating it as current-cycle evidence'
            : officialContextNoMatch.length > 0
              ? 'review assigned prompt family against official source context, then reassign/reject/terminalize'
              : 'continue bounded official-source search or mark terminal after checked URLs are exhausted',
      prohibitedActions: [
        'do not create EssayPromptSource rows from this packet alone',
        'do not expose prompts publicly when official context has no prompt match',
        'do not infer reassignment without reviewer workflow',
      ],
    },
    nextCampaign: buildNextCampaign(campaignRow, checkedUrls),
    rows: checkedUrls,
  };
  writeReport(args, report);
  printSummary(args, report);
}

async function checkUrl(
  sourceUrl: string,
  campaignRow: CampaignRow,
  args: Args,
): Promise<CheckedUrl> {
  try {
    const response = await fetchWithTimeout(sourceUrl, args.timeoutMs);
    const contentType = response.headers.get('content-type');
    const finalUrl = response.url;
    if (!response.ok) {
      return failedUrl(sourceUrl, response.status, finalUrl, contentType, null);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const truncated = buffer.length > args.maxBytes;
    const bytes = truncated ? buffer.subarray(0, args.maxBytes) : buffer;
    const isPdf =
      /pdf/i.test(contentType ?? '') || /\.pdf([?#].*)?$/i.test(finalUrl);
    if (/html|text/i.test(contentType ?? '')) {
      const boxPdf = await boxSharePdfText(
        sourceUrl,
        finalUrl,
        bytes.toString('utf8'),
        args,
      );
      if (boxPdf) {
        return checkedReadableText({
          sourceUrl,
          fetchStatus: 'reachable_text',
          httpStatus: response.status,
          finalUrl,
          contentType: boxPdf.contentType ?? contentType,
          bytesRead: boxPdf.bytesRead,
          text: boxPdf.text,
          campaignRow,
        });
      }
      return checkedReadableText({
        sourceUrl,
        fetchStatus: 'reachable_html',
        httpStatus: response.status,
        finalUrl,
        contentType,
        bytesRead: bytes.length,
        text: htmlToText(bytes.toString('utf8')),
        campaignRow,
      });
    }
    if (isPdf) {
      const text = extractPdfText(buffer, args.timeoutMs).slice(
        0,
        args.maxBytes,
      );
      if (text.trim().length > 0) {
        return checkedReadableText({
          sourceUrl,
          fetchStatus: 'reachable_text',
          httpStatus: response.status,
          finalUrl,
          contentType,
          bytesRead: buffer.length,
          text,
          campaignRow,
        });
      }
    }
    if (!/html|text/i.test(contentType ?? '')) {
      return {
        ...baseCheckedUrl(sourceUrl),
        fetchStatus: 'non_html',
        httpStatus: response.status,
        finalUrl,
        contentType,
        bytesRead: bytes.length,
        evidenceStatus: 'non_html',
        recommendedAction: 'retry-or-external-source-search',
      };
    }
  } catch (error) {
    return failedUrl(
      sourceUrl,
      null,
      null,
      null,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function boxSharePdfText(
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
  try {
    const response = await fetchWithTimeout(downloadUrl, args.timeoutMs);
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

function checkedReadableText({
  sourceUrl,
  fetchStatus,
  httpStatus,
  finalUrl,
  contentType,
  bytesRead,
  text,
  campaignRow,
}: {
  sourceUrl: string;
  fetchStatus: 'reachable_html' | 'reachable_text';
  httpStatus: number;
  finalUrl: string;
  contentType: string | null;
  bytesRead: number;
  text: string;
  campaignRow: CampaignRow;
}): CheckedUrl {
  const matches = matchPrompts(text, campaignRow.promptSamples);
  const promptLanguageSignals = promptSignals(text);
  const cycleSignals = cycleSignalsFor(text, sourceUrl, finalUrl);
  const evidenceStatus = evidenceStatusFor(
    matches,
    promptLanguageSignals,
    sourceUrl,
    finalUrl,
    campaignRow,
  );
  const evidenceSnippets = evidenceSnippetsFor(
    text,
    matches,
    promptLanguageSignals,
  );
  return {
    ...baseCheckedUrl(sourceUrl),
    fetchStatus,
    httpStatus,
    finalUrl,
    contentType,
    bytesRead,
    promptMatchCount: matches.length,
    matchedPromptIds: matches.map((match) => match.essayPromptId),
    promptMatches: matches,
    promptLanguageSignals,
    cycleSignals,
    evidenceStatus,
    recommendedAction: recommendedActionFor(evidenceStatus),
    evidenceSnippets,
  };
}

function fetchWithTimeout(sourceUrl: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(sourceUrl, {
    signal: controller.signal,
    redirect: 'follow',
    headers: {
      'user-agent':
        'Mozilla/5.0 platform-data-closure-audit/1.0 (+read-only source validation)',
      accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
    },
  }).finally(() => clearTimeout(timeout));
}

function matchPrompts(
  text: string,
  prompts: CampaignRow['promptSamples'],
): PromptMatch[] {
  const normalizedText = normalizeText(text);
  return prompts
    .map((prompt) => {
      const matchedVariant = promptMatchVariants(
        prompt.promptSnippet,
        normalizedText,
      ).find((variant) => normalizedText.includes(variant.normalized));
      return matchedVariant
        ? {
            prompt,
            matchedVariant,
          }
        : null;
    })
    .filter(
      (
        match,
      ): match is {
        prompt: CampaignRow['promptSamples'][number];
        matchedVariant: {
          raw: string;
          normalized: string;
          matchKind: PromptMatch['matchKind'];
        };
      } => Boolean(match),
    )
    .map(({ prompt, matchedVariant }) => ({
      essayPromptId: prompt.essayPromptId,
      promptSnippet: prompt.promptSnippet ?? '',
      matchKind: matchedVariant.matchKind,
      evidenceSnippet: matchedVariant.raw,
    }));
}

function promptMatchVariants(snippet: string | null, normalizedText: string) {
  if (isLikelyTruncatedPromptSnippet(snippet)) {
    return promptEquivalentVariants(snippet ?? '')
      .flatMap((variant) => [
        truncatedPromptPrefixVariant(variant, normalizedText),
        ...completeSentenceContextVariants(variant, normalizedText),
      ])
      .filter(
        (
          variant,
        ): variant is {
          raw: string;
          normalized: string;
          matchKind: 'truncated_prefix_with_prompt_context';
        } => Boolean(variant),
      );
  }
  const candidates = unique(
    [snippet, stripOptionLabel(snippet), extractOptionPrompt(snippet)]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => promptEquivalentVariants(value)),
  );
  return candidates
    .map((raw) => ({
      raw,
      normalized: normalizeText(raw),
      matchKind: 'normalized_phrase' as const,
    }))
    .filter((variant) => variant.normalized.length >= 12);
}

function isLikelyTruncatedPromptSnippet(snippet: string | null) {
  if (!snippet) return false;
  const trimmed = snippet.trim();
  if (trimmed.length < 145) return false;
  return !/[.!?")\]]$/.test(trimmed);
}

function truncatedPromptPrefixVariant(
  snippet: string | null,
  normalizedText: string,
) {
  if (!snippet) return null;
  const raw = snippet.trim();
  const normalized = normalizeText(raw);
  if (normalized.length < 50) return null;
  if (!normalizedText.includes(normalized)) return null;
  if (!hasPromptContextNear(normalizedText, normalized)) return null;
  return {
    raw,
    normalized,
    matchKind: 'truncated_prefix_with_prompt_context' as const,
  };
}

function completeSentenceContextVariants(
  snippet: string | null,
  normalizedText: string,
) {
  if (!snippet) return [];
  const sentences = snippet.trim().match(/[^.!?]+[.!?]/g) ?? [];
  return unique(
    [sentences.slice(0, 1).join(' '), sentences.slice(0, 2).join(' ')]
      .map((raw) => raw.trim())
      .filter((raw) => raw.length > 0),
  )
    .map((raw) => {
      const normalized = normalizeText(raw);
      if (normalized.length < 50) return null;
      if (!normalizedText.includes(normalized)) return null;
      if (!hasPromptContextNear(normalizedText, normalized)) return null;
      return {
        raw,
        normalized,
        matchKind: 'truncated_prefix_with_prompt_context' as const,
      };
    })
    .filter(
      (
        variant,
      ): variant is {
        raw: string;
        normalized: string;
        matchKind: 'truncated_prefix_with_prompt_context';
      } => Boolean(variant),
    );
}

function hasPromptContextNear(
  normalizedText: string,
  normalizedPrompt: string,
) {
  const index = normalizedText.indexOf(normalizedPrompt);
  if (index < 0) return false;
  const start = Math.max(0, index - 2000);
  const end = Math.min(
    normalizedText.length,
    index + normalizedPrompt.length + 2000,
  );
  const nearby = normalizedText.slice(start, end);
  const promptContextMarkers = [
    'writing supplement',
    'supplemental essay',
    'supplemental essays',
    'essay prompt',
    'essay prompts',
    'prompt below',
    'prompts and respond',
    'respond in 300 words',
    '250 word response',
    'response to the question',
    'words or less',
    'short answer',
    'short answer questions',
    'short essay',
    'essay requirements',
    'brief essays',
    'supplemental writing questions',
    'writing questions',
    'additional writing prompts',
    'asked three questions',
    'word limit',
    'question has a word limit',
    'answer each prompt',
    'ut prosim profile',
    'video or writing supplemental materials',
    'writing supplemental materials',
    'common application',
    'coalition application',
  ];
  return promptContextMarkers.some((marker) =>
    nearby.includes(normalizeText(marker)),
  );
}

function stripOptionLabel(snippet: string | null) {
  if (!snippet) return null;
  return snippet.replace(/^option\s+[a-z0-9]+[:.)-]\s*/i, '').trim();
}

function extractOptionPrompt(snippet: string | null) {
  if (!snippet) return null;
  const match = snippet.match(/\boption\s+[a-z0-9]+[:.)-]\s*(.+)$/i);
  return match?.[1]?.trim() || null;
}

function andOrEquivalentPromptVariants(raw: string) {
  const variants = [raw];
  const expanded = raw.replace(/\bor\b/gi, 'and/or');
  if (expanded !== raw) variants.push(expanded);
  const collapsed = raw.replace(/\band\s*\/\s*or\b/gi, 'or');
  if (collapsed !== raw) variants.push(collapsed);
  return unique(variants);
}

function promptEquivalentVariants(raw: string) {
  const variants = andOrEquivalentPromptVariants(raw);
  for (const value of [...variants]) {
    const wideRange = value.replace(
      /values a variety of perspectives/gi,
      'values a wide range of perspectives',
    );
    if (wideRange !== value) variants.push(wideRange);
    const variety = value.replace(
      /values a wide range of perspectives/gi,
      'values a variety of perspectives',
    );
    if (variety !== value) variants.push(variety);
    const diversity = value.replace(
      /values a variety of perspectives|values a wide range of perspectives/gi,
      'values diversity of perspectives',
    );
    if (diversity !== value) variants.push(diversity);
    const georgetownBriefEssay = value.replace(
      /please submit a brief essay,\s*either personal or creative,\s*which/gi,
      'please submit a brief personal or creative essay which',
    );
    if (georgetownBriefEssay !== value) variants.push(georgetownBriefEssay);
  }
  return unique(variants);
}

function evidenceSnippetsFor(
  text: string,
  matches: PromptMatch[],
  promptLanguageSignals: string[],
) {
  const shouldCaptureContext =
    matches.length > 0 || promptLanguageSignals.length > 0;
  return unique(
    [
      ...matches.map((match) => match.evidenceSnippet),
      ...(shouldCaptureContext ? promptContextSnippets(text) : []),
      ...promptLanguageSignals.slice(0, 5),
    ]
      .map((snippet) => snippet.replace(/\s+/g, ' ').trim())
      .filter((snippet) => snippet.length > 0),
  ).slice(0, 12);
}

function promptContextSnippets(text: string) {
  const lower = text.toLowerCase();
  const markers = [
    'fall 2026 supplemental application essays',
    'required stem academic interest question',
    'required short essay questions',
    'your stem past',
    'creativity in action question',
    'optional academic short answer question',
    'supplemental application prompts',
    'supplemental application essays',
    'supplemental essays',
    'supplemental questions',
    'optional short-answer prompts',
    'optional short answer prompts',
    'supplemental writing questions',
    'writing questions',
    'additional writing prompts',
    'short answer questions',
    'short essay',
    'essay requirements',
    'brief essays',
    'video or writing supplement',
    'optional: submit video or writing supplemental materials',
    'scholarship writing supplement',
    'application essay prompts',
    'essay questions',
    'essay question',
    'available application essay prompts',
    'personal statement on the application',
    'holistic admissions process',
    '250 words or less',
    'max 2-minute video',
    '90-second video',
    'common application',
  ];
  return unique(
    markers
      .map((marker) => {
        const index = lower.indexOf(marker.toLowerCase());
        if (index < 0) return null;
        const start = Math.max(0, index - 280);
        const end = Math.min(text.length, index + marker.length + 720);
        return text.slice(start, end);
      })
      .filter((snippet): snippet is string => Boolean(snippet)),
  );
}

function promptSignals(text: string) {
  const normalized = normalizeText(text);
  const signals = [
    'personal insight questions',
    'writing supplement',
    'supplemental essays',
    'supplemental questions',
    'short answer questions',
    'short essay',
    'essay requirements',
    'brief essays',
    'essay prompts',
    'essay questions',
    'essay question',
    'video or writing supplement',
    'writing supplemental materials',
    'scholarship writing supplement',
    'signature scholar programs',
    '250 words or less',
    'respond to any four',
    'maximum of 350 words',
    'common application',
    'uc application',
  ];
  return signals.filter((signal) => normalized.includes(signal));
}

function cycleSignalsFor(text: string, ...context: Array<string | null>) {
  const haystack = [text, ...context.filter(Boolean)].join(' ');
  const matches = [
    ...(haystack.match(/\b20\d{2}\s*[-/]\s*(?:20)?\d{2}\b/g) ?? []),
    ...(haystack.match(/\b(?:fall|spring|summer)\s+20\d{2}\b/gi) ?? []),
    ...(haystack.match(/\b20(2[4-9]|3[0-2])\b/g) ?? []),
  ];
  return unique(
    matches.map((match) => match.replace(/\s+/g, ' ').trim()),
  ).slice(0, 12);
}

function evidenceStatusFor(
  matches: Array<{ essayPromptId: string }>,
  promptLanguageSignals: string[],
  sourceUrl: string,
  finalUrl: string | null,
  campaignRow: CampaignRow,
): CheckedUrl['evidenceStatus'] {
  if (matches.length > 0) {
    if (isCrossSchoolPromptMatch(sourceUrl, finalUrl, campaignRow)) {
      return 'cross_school_prompt_match';
    }
    if (isHistoricalSourceUrl(sourceUrl, finalUrl, campaignRow)) {
      return 'historical_prompt_match_requires_review';
    }
    return 'candidate_validated_for_review';
  }
  if (promptLanguageSignals.length > 0) {
    if (isUntrustedSecondarySource(sourceUrl, finalUrl)) {
      return 'untrusted_context_no_prompt_match';
    }
    return 'official_context_no_prompt_match';
  }
  return 'reachable_no_prompt_signal';
}

function isHistoricalSourceUrl(
  sourceUrl: string,
  finalUrl: string | null,
  campaignRow: CampaignRow,
) {
  const applicationYear = campaignRow.applicationYear;
  if (!applicationYear) return false;
  const pathYears = [sourceUrl, finalUrl]
    .filter((url): url is string => Boolean(url))
    .flatMap((url) => {
      try {
        const parsed = new URL(url);
        return Array.from(
          parsed.pathname.matchAll(/(?:^|\/)(20\d{2})(?:\/|-|$)/g),
        ).map((match) => Number(match[1]));
      } catch {
        return [];
      }
    });
  return pathYears.some((year) => year < applicationYear - 2);
}

function isCrossSchoolPromptMatch(
  sourceUrl: string,
  finalUrl: string | null,
  campaignRow: CampaignRow,
) {
  const hosts = [sourceUrl, finalUrl]
    .filter((url): url is string => Boolean(url))
    .map((url) => safeHost(url));
  if (hosts.some((host) => isCommonAppHost(host))) return false;
  const eduHosts = hosts.filter((host) => host.endsWith('.edu'));
  if (eduHosts.length === 0) return false;
  if (
    eduHosts.some((host) =>
      (campaignRow.topCandidateUrls ?? []).some(
        (url) => safeHost(url) && hostMatches(host, safeHost(url)),
      ),
    )
  ) {
    return false;
  }
  const targetAliases = schoolHostAliases(campaignRow.schoolName);
  if (
    eduHosts.some((host) =>
      targetAliases.some((alias) => alias.length >= 3 && host.includes(alias)),
    )
  ) {
    return false;
  }
  return true;
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function hostMatches(host: string, candidateHost: string) {
  return (
    host === candidateHost ||
    host.endsWith(`.${candidateHost}`) ||
    candidateHost.endsWith(`.${host}`)
  );
}

function isCommonAppHost(host: string) {
  return host === 'commonapp.org' || host.endsWith('.commonapp.org');
}

function isQuestBridgeHost(host: string) {
  return host === 'questbridge.org' || host.endsWith('.questbridge.org');
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
  const aliases = [...tokens, acronym];
  if (/\bminnesota\b/.test(normalized)) {
    aliases.push('umn');
  }
  return unique(aliases.filter(Boolean));
}

function isUntrustedSecondarySource(
  sourceUrl: string,
  finalUrl: string | null,
) {
  const hosts = [sourceUrl, finalUrl]
    .filter((url): url is string => Boolean(url))
    .map((url) => {
      try {
        return new URL(url).hostname.toLowerCase();
      } catch {
        return '';
      }
    });
  const untrustedHosts = [
    'collegevine.com',
    'collegeessayguy.com',
    'clastify.com',
    'nextadmit.com',
    'empowerly.com',
    'studocu.com',
    'scribd.com',
    'reddit.com',
  ];
  return hosts.some((host) =>
    untrustedHosts.some(
      (untrustedHost) =>
        host === untrustedHost || host.endsWith(`.${untrustedHost}`),
    ),
  );
}

function recommendedActionFor(
  evidenceStatus: CheckedUrl['evidenceStatus'],
): CheckedUrl['recommendedAction'] {
  switch (evidenceStatus) {
    case 'candidate_validated_for_review':
      return 'stage-source-row-for-review';
    case 'cross_school_prompt_match':
      return 'review-cross-school-prompt-owner-conflict';
    case 'historical_prompt_match_requires_review':
    case 'official_context_no_prompt_match':
      return 'review-assigned-prompt-family-mismatch-or-terminal';
    case 'untrusted_context_no_prompt_match':
      return 'review-untrusted-context-or-find-official-source';
    case 'reachable_no_prompt_signal':
      return 'manual-inspect-or-terminal';
    case 'blocked_or_fetch_failed':
    case 'non_html':
      return 'retry-or-external-source-search';
  }
}

function buildNextCampaign(campaignRow: CampaignRow, rows: CheckedUrl[]) {
  const validated = rows.filter(
    (row) => row.evidenceStatus === 'candidate_validated_for_review',
  );
  const trustedValidated = validated.filter((row) =>
    isTrustedManualSourceUrl(row.sourceUrl, row.finalUrl),
  );
  const untrustedValidated = validated.filter(
    (row) => !isTrustedManualSourceUrl(row.sourceUrl, row.finalUrl),
  );
  const mismatch = rows.filter(
    (row) =>
      row.evidenceStatus === 'official_context_no_prompt_match' ||
      row.evidenceStatus === 'historical_prompt_match_requires_review' ||
      row.evidenceStatus === 'cross_school_prompt_match',
  );
  if (trustedValidated.length > 0) {
    return {
      id: 'essay_prompt_source_review',
      reason: `${campaignRow.schoolName} has ${trustedValidated.length} trusted manually checked source URLs with prompt matches; stage source rows for reviewer approval.`,
      schoolId: campaignRow.schoolId,
      schoolName: campaignRow.schoolName,
      recommendedAction: 'stage-source-row-for-review',
    };
  }
  if (untrustedValidated.length > 0 && mismatch.length > 0) {
    return {
      id: 'essay_prompt_source_family_mismatch_review',
      reason: `${campaignRow.schoolName} has untrusted prompt matches but official prompt-context pages did not match assigned prompt snippets; review source family before approval.`,
      schoolId: campaignRow.schoolId,
      schoolName: campaignRow.schoolName,
      recommendedAction: 'review-untrusted-context-or-find-official-source',
    };
  }
  if (mismatch.length > 0) {
    return {
      id: 'essay_prompt_source_family_mismatch_review',
      reason: `${campaignRow.schoolName} official prompt-context pages did not match ${campaignRow.sourceSearchPromptRows} assigned prompt snippets; review assignment, reject, or terminalize before further source approval.`,
      schoolId: campaignRow.schoolId,
      schoolName: campaignRow.schoolName,
      recommendedAction: 'review-assigned-prompt-family-mismatch-or-terminal',
    };
  }
  return {
    id: 'essay_prompt_source_manual_search_continue',
    reason: `${campaignRow.schoolName} manual source candidates did not validate; continue official source search or mark terminal with checked URLs.`,
    schoolId: campaignRow.schoolId,
    schoolName: campaignRow.schoolName,
    recommendedAction: 'manual-inspect-or-terminal',
  };
}

function isTrustedManualSourceUrl(sourceUrl: string, finalUrl: string | null) {
  const hosts = [sourceUrl, finalUrl]
    .filter((url): url is string => Boolean(url))
    .map((url) => safeHost(url));
  return hosts.some(
    (host) =>
      isCommonAppHost(host) ||
      isQuestBridgeHost(host) ||
      host.endsWith('.edu') ||
      host.endsWith('.ucf.edu') ||
      host.endsWith('.umich.edu'),
  );
}

function failedUrl(
  sourceUrl: string,
  httpStatus: number | null,
  finalUrl: string | null,
  contentType: string | null,
  error: string | null,
): CheckedUrl {
  return {
    ...baseCheckedUrl(sourceUrl),
    fetchStatus: 'blocked_or_fetch_failed',
    httpStatus,
    finalUrl,
    contentType,
    error: error ?? (httpStatus ? `HTTP ${httpStatus}` : 'fetch failed'),
    evidenceStatus: 'blocked_or_fetch_failed',
    recommendedAction: 'retry-or-external-source-search',
  };
}

function baseCheckedUrl(sourceUrl: string): CheckedUrl {
  return {
    sourceUrl,
    fetchStatus: 'blocked_or_fetch_failed',
    httpStatus: null,
    finalUrl: null,
    contentType: null,
    bytesRead: 0,
    error: null,
    promptMatchCount: 0,
    matchedPromptIds: [],
    promptMatches: [],
    promptLanguageSignals: [],
    cycleSignals: [],
    evidenceStatus: 'blocked_or_fetch_failed',
    recommendedAction: 'retry-or-external-source-search',
    evidenceSnippets: [],
  };
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

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(text: string) {
  return text
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
    .replace(/\([^)]{1,120}\)/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function blockedReport(
  args: Args,
  missingInputs: Array<{ input: string; reason: string }>,
) {
  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-source-manual-check',
    status: 'BLOCKED_MANUAL_CHECK_INPUTS_MISSING' satisfies PacketStatus,
    destructiveDbWriteAllowedByThisPlan: false,
    notificationAllowedByThisPlan: false,
    missingInputs,
    summary: {
      checkedUrls: 0,
      blockedRows: missingInputs.length,
    },
    rows: [],
  };
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const rows = Array.isArray(report.rows) ? (report.rows as CheckedUrl[]) : [];
  return `${[
    '# Essay Prompt Source Manual Check Packet',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    '',
    '## Target',
    '',
    `- School: ${report.target?.schoolName ?? 'unknown'}`,
    `- Source-search prompt rows: ${report.target?.sourceSearchPromptRows ?? 0}`,
    '',
    '## Summary',
    '',
    `- Checked URLs: ${report.summary?.checkedUrls ?? 0}`,
    `- Reachable HTML URLs: ${report.summary?.reachableHtmlUrls ?? 0}`,
    `- Readable text URLs: ${report.summary?.reachableTextUrls ?? report.summary?.reachableHtmlUrls ?? 0}`,
    `- Validated source URLs: ${report.summary?.validatedSourceUrls ?? 0}`,
    `- Cross-school prompt match URLs: ${report.summary?.crossSchoolPromptMatchUrls ?? 0}`,
    `- Official context/no prompt match URLs: ${report.summary?.officialContextNoPromptMatchUrls ?? 0}`,
    `- Source-family mismatch review: ${report.summary?.sourceFamilyMismatchReview ?? false}`,
    '',
    '## Next Campaign',
    '',
    `- ${report.nextCampaign?.reason ?? 'Continue manual source checks.'}`,
    '',
    '## Checked URLs',
    '',
    '| URL | Status | Evidence | Action |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${escapeMarkdown(row.sourceUrl)} | ${row.fetchStatus} | ${row.evidenceStatus} | ${row.recommendedAction} |`,
    ),
    '',
    '## Review Contract',
    '',
    '- This packet does not approve sources or write `EssayPromptSource` rows.',
    '- If official prompt-context pages do not match assigned prompt snippets, review prompt-school assignment before more source approval work.',
  ].join('\n')}\n`;
}

function renderCsv(rows: CheckedUrl[]) {
  const headers = [
    'sourceUrl',
    'fetchStatus',
    'httpStatus',
    'evidenceStatus',
    'recommendedAction',
    'promptMatchCount',
    'matchedPromptIds',
    'promptLanguageSignals',
    'cycleSignals',
  ];
  return `${[
    headers.join(','),
    ...rows.map((row) =>
      [
        row.sourceUrl,
        row.fetchStatus,
        row.httpStatus ?? '',
        row.evidenceStatus,
        row.recommendedAction,
        row.promptMatchCount,
        row.matchedPromptIds.join('|'),
        row.promptLanguageSignals.join('|'),
        row.cycleSignals.join('|'),
      ]
        .map(csvCell)
        .join(','),
    ),
  ].join('\n')}\n`;
}

function printSummary(
  args: Args,
  report: {
    status: string;
    summary: Record<string, unknown>;
    nextCampaign?: Record<string, unknown>;
  },
) {
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        csv: args.csv,
        checkedUrls: report.summary.checkedUrls,
        validatedSourceUrls: report.summary.validatedSourceUrls,
        sourceFamilyMismatchReview: report.summary.sourceFamilyMismatchReview,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

function summarizeInput(filePath: string | null, report: CampaignReport) {
  return {
    path: filePath ? path.relative(API_ROOT, filePath) : null,
    generatedAt: report.generatedAt ?? null,
    status: report.status ?? null,
    nextCampaign: report.nextCampaign ?? null,
  };
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

function readJson<T>(filePath: string | null): T {
  if (!filePath) return {} as T;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function countBy<T>(rows: T[], keyFn: (row: T) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = keyFn(row) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
