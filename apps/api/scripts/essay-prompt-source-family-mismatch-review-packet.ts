#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'ESSAY_PROMPT_SOURCE_FAMILY_MISMATCH_REVIEW_READY'
  | 'PASS_NO_SOURCE_FAMILY_MISMATCH'
  | 'BLOCKED_MANUAL_CHECK_PACKET_MISSING';

type MismatchDisposition =
  | 'review_prompt_owner_or_reject'
  | 'review_terminal_official_source_exhausted'
  | 'review_untrusted_source_or_official_conflict'
  | 'review_cross_school_prompt_owner_conflict';

interface Args {
  manualCheck: string | null;
  out: string;
  markdown: string;
  csv: string;
  limit: number;
}

interface ManualCheckReport {
  generatedAt?: string;
  status?: string;
  target?: {
    schoolId?: string;
    schoolName?: string;
    sourceSearchPromptRows?: number;
    sourceSearchRecommendedAction?: string;
    promptSamples?: PromptSample[];
  };
  summary?: {
    checkedUrls?: number;
    reachableHtmlUrls?: number;
    validatedSourceUrls?: number;
    officialContextNoPromptMatchUrls?: number;
    promptMatchCount?: number;
    sourceFamilyMismatchReview?: boolean;
    partialSourceFamilyMismatchPromptRows?: number;
    unmatchedCurrentValidatedPromptIds?: string[];
    blockedRows?: number;
  };
  rows?: CheckedUrl[];
  nextCampaign?: Record<string, unknown>;
}

interface PromptSample {
  essayPromptId: string;
  type: string;
  severity?: 'critical' | 'warning' | 'info';
  route?: string;
  promptSnippet: string | null;
}

interface CheckedUrl {
  sourceUrl: string;
  finalUrl: string | null;
  fetchStatus: string;
  httpStatus: number | null;
  evidenceStatus: string;
  recommendedAction: string;
  matchedPromptIds?: string[];
  promptLanguageSignals?: string[];
  cycleSignals?: string[];
  promptMatchCount?: number;
  evidenceSnippets?: string[];
}

interface ReviewRow {
  essayPromptId: string;
  schoolId: string;
  schoolName: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  route: string | null;
  promptSnippet: string | null;
  closureState: 'review';
  mismatchDisposition: MismatchDisposition;
  reviewerQueue: 'essay_prompt_source_family_mismatch_review';
  recommendedAction: string;
  consumerPolicy: {
    publicEssayPrompts: 'hide_until_source_family_resolved';
    timelineTasks: 'hide_until_source_family_resolved';
    chatContext: 'do_not_use_as_school_prompt_fact';
    adminReview: 'show_official_context_no_prompt_match';
  };
  candidateOnlyEvidence: {
    checkedUrls: string[];
    finalUrls: string[];
    trustedValidatedSourceUrls: string[];
    untrustedValidatedSourceUrls: string[];
    crossSchoolPromptMatchSourceUrls: string[];
    promptLanguageSignals: string[];
    cycleSignals: string[];
    evidenceSnippets: string[];
    officialContextNoPromptMatchUrls: number;
    promptMatchCount: number;
  };
  requiredReviewerChecks: string[];
  prohibitedActions: string[];
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
      path.join(
        REPORT_ROOT,
        `essay-prompt-source-family-mismatch-review-${stamp}.json`,
      ),
    )!,
  );
  const manualCheck = get('--manual-check');
  return {
    manualCheck: manualCheck
      ? resolveInputPath(manualCheck)
      : findLatest(/^essay-prompt-source-manual-check-.+\.json$/),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    limit: Number(get('--limit', '500')),
  };
}

function main() {
  const args = parseArgs();
  if (!args.manualCheck || !fs.existsSync(args.manualCheck)) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-essay-prompt-source-family-mismatch-review',
      status: 'BLOCKED_MANUAL_CHECK_PACKET_MISSING' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      notificationAllowedByThisPlan: false,
      sourceArtifacts: {
        manualCheck: args.manualCheck,
      },
      summary: {
        sourceFamilyMismatchReview: false,
        promptRows: 0,
        emittedRows: 0,
        allRowsHaveDisposition: false,
        blockedRows: 1,
      },
      nextCampaign: {
        id: 'essay_prompt_source_manual_check',
        reason:
          'Run audit:essay-prompt-source-manual-check before building source-family mismatch review rows.',
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    return;
  }

  const manualCheck = readJson<ManualCheckReport>(args.manualCheck);
  const sourceFamilyMismatchReview =
    manualCheck.summary?.sourceFamilyMismatchReview === true;
  const promptSamples = manualCheck.target?.promptSamples ?? [];
  const matchedPromptIds = new Set(
    (manualCheck.rows ?? []).flatMap((row) => row.matchedPromptIds ?? []),
  );
  const partialMismatchPromptIds = new Set(
    manualCheck.summary?.unmatchedCurrentValidatedPromptIds ?? [],
  );
  const manualPartialSourceFamilyMismatchReview =
    (manualCheck.summary?.partialSourceFamilyMismatchPromptRows ?? 0) > 0 &&
    partialMismatchPromptIds.size > 0;
  const trustedMatchedPromptIds = trustedValidatedMatchedPromptIds(
    manualCheck.rows ?? [],
  );
  const untrustedMatchedPromptIds = untrustedValidatedMatchedPromptIds(
    manualCheck.rows ?? [],
  );
  const crossSchoolMatchedPromptIds = crossSchoolMatchedPromptIdsFor(
    manualCheck.rows ?? [],
  );
  const partialSourceFamilyMismatchReview =
    !sourceFamilyMismatchReview &&
    promptSamples.some(
      (prompt) => !trustedMatchedPromptIds.has(prompt.essayPromptId),
    ) &&
    hasOfficialPromptContext(manualCheck.rows ?? []);
  const untrustedValidatedSourceReview =
    hasOnlyUntrustedValidatedSourcesWithOfficialContextNoMatch(
      manualCheck.rows ?? [],
    );
  const promptsForReview =
    sourceFamilyMismatchReview && manualPartialSourceFamilyMismatchReview
      ? promptSamples.filter((prompt) =>
          promptNeedsPartialOrUntrustedReview(
            prompt.essayPromptId,
            partialMismatchPromptIds,
            trustedMatchedPromptIds,
            untrustedMatchedPromptIds,
            crossSchoolMatchedPromptIds,
          ),
        )
      : sourceFamilyMismatchReview
        ? promptSamples.filter(
            (prompt) =>
              !trustedMatchedPromptIds.has(prompt.essayPromptId) ||
              crossSchoolMatchedPromptIds.has(prompt.essayPromptId),
          )
        : partialSourceFamilyMismatchReview || untrustedValidatedSourceReview
          ? promptSamples.filter(
              (prompt) => !trustedMatchedPromptIds.has(prompt.essayPromptId),
            )
          : [];
  const hasMismatchReview =
    sourceFamilyMismatchReview ||
    partialSourceFamilyMismatchReview ||
    untrustedValidatedSourceReview;
  const rows = hasMismatchReview
    ? promptsForReview
        .slice(0, args.limit)
        .map((prompt) =>
          buildReviewRow(
            prompt,
            manualCheck.target?.schoolId ?? 'unknown',
            manualCheck.target?.schoolName ?? 'unknown',
            manualCheck.rows ?? [],
            untrustedMatchedPromptIds,
            crossSchoolMatchedPromptIds,
          ),
        )
    : [];
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-source-family-mismatch-review',
    status: (hasMismatchReview
      ? 'ESSAY_PROMPT_SOURCE_FAMILY_MISMATCH_REVIEW_READY'
      : 'PASS_NO_SOURCE_FAMILY_MISMATCH') satisfies PacketStatus,
    destructiveDbWriteAllowedByThisPlan: false,
    notificationAllowedByThisPlan: false,
    sourceArtifacts: {
      manualCheck: summarizeInput(args.manualCheck, manualCheck),
    },
    target: {
      schoolId: manualCheck.target?.schoolId ?? null,
      schoolName: manualCheck.target?.schoolName ?? null,
      sourceSearchPromptRows: manualCheck.target?.sourceSearchPromptRows ?? 0,
      sourceSearchRecommendedAction:
        manualCheck.target?.sourceSearchRecommendedAction ?? null,
    },
    summary: {
      sourceFamilyMismatchReview: hasMismatchReview,
      fullSourceFamilyMismatchReview:
        sourceFamilyMismatchReview &&
        !manualPartialSourceFamilyMismatchReview &&
        !untrustedValidatedSourceReview,
      partialSourceFamilyMismatchReview:
        partialSourceFamilyMismatchReview ||
        manualPartialSourceFamilyMismatchReview,
      untrustedValidatedSourceReview,
      manualCheckStatus: manualCheck.status ?? null,
      checkedUrls: manualCheck.summary?.checkedUrls ?? 0,
      reachableHtmlUrls: manualCheck.summary?.reachableHtmlUrls ?? 0,
      validatedSourceUrls: manualCheck.summary?.validatedSourceUrls ?? 0,
      trustedValidatedSourceUrls: countTrustedValidatedSourceUrls(
        manualCheck.rows ?? [],
      ),
      untrustedValidatedSourceUrls: countUntrustedValidatedSourceUrls(
        manualCheck.rows ?? [],
      ),
      crossSchoolPromptMatchUrls: crossSchoolPromptMatchCount(
        manualCheck.rows ?? [],
      ),
      officialContextNoPromptMatchUrls:
        manualCheck.summary?.officialContextNoPromptMatchUrls ?? 0,
      promptMatchCount: manualCheck.summary?.promptMatchCount ?? 0,
      promptRows: promptSamples.length,
      matchedPromptRows: matchedPromptIds.size,
      unmatchedPromptRows: Math.max(
        0,
        promptSamples.length - matchedPromptIds.size,
      ),
      emittedRows: rows.length,
      allRowsHaveDisposition: true,
      blockedRows: 0,
      duplicatePromptSnippetRows: duplicatePromptSnippetRows(promptSamples),
      terminalCandidateRows: rows.filter(
        (row) =>
          row.mismatchDisposition ===
          'review_terminal_official_source_exhausted',
      ).length,
      reviewRows: rows.length,
      byMismatchDisposition: countBy(rows, (row) => row.mismatchDisposition),
      byRecommendedAction: countBy(rows, (row) => row.recommendedAction),
    },
    reviewContract: {
      mismatchReviewDoesNotApproveSources: true,
      mismatchReviewDoesNotWriteDb: true,
      candidateEvidenceStatus: 'official_context_no_prompt_match_review_only',
      acceptedResolutionRequires: [
        'reviewer confirms whether assigned school truly owns these prompts',
        'reviewer records official prompt source URL, raw evidence hash, cycle year, and rationale before source approval',
        'reviewer rejects, reassigns, or terminalizes prompt rows when official source family does not match',
      ],
      prohibitedActions: [
        'do not create EssayPromptSource rows from official context/no-match evidence',
        'do not expose mismatched prompts to public essay, timeline, or chat consumers',
        'do not infer the correct school or terminal status without reviewer workflow evidence',
      ],
    },
    nextCampaign: buildNextCampaign(rows, hasMismatchReview),
    rows,
  };
  writeReport(args, report);
  printSummary(args, report);
}

function buildReviewRow(
  prompt: PromptSample,
  schoolId: string,
  schoolName: string,
  checkedUrls: CheckedUrl[],
  untrustedMatchedPromptIds: Set<string>,
  crossSchoolMatchedPromptIds: Set<string>,
): ReviewRow {
  const evidence = checkedUrls.filter(
    (row) =>
      row.evidenceStatus === 'official_context_no_prompt_match' ||
      row.evidenceStatus === 'candidate_validated_for_review' ||
      row.evidenceStatus === 'cross_school_prompt_match',
  );
  const promptLanguageSignals = unique(
    evidence.flatMap((row) => row.promptLanguageSignals ?? []),
  );
  const cycleSignals = unique(
    evidence.flatMap((row) => row.cycleSignals ?? []),
  );
  const evidenceSnippets = unique(
    evidence.flatMap((row) => row.evidenceSnippets ?? []),
  ).slice(0, 12);
  const disposition = crossSchoolMatchedPromptIds.has(prompt.essayPromptId)
    ? 'review_cross_school_prompt_owner_conflict'
    : untrustedMatchedPromptIds.has(prompt.essayPromptId)
      ? 'review_untrusted_source_or_official_conflict'
      : chooseDisposition(prompt, evidence);
  return {
    essayPromptId: prompt.essayPromptId,
    schoolId,
    schoolName,
    type: prompt.type,
    severity: prompt.severity ?? 'critical',
    route: prompt.route ?? null,
    promptSnippet: prompt.promptSnippet,
    closureState: 'review',
    mismatchDisposition: disposition,
    reviewerQueue: 'essay_prompt_source_family_mismatch_review',
    recommendedAction:
      disposition === 'review_terminal_official_source_exhausted'
        ? 'review-terminal-or-reject-after-official-source-exhaustion'
        : disposition === 'review_cross_school_prompt_owner_conflict'
          ? 'review-cross-school-prompt-owner-and-reassign-or-reject'
          : 'review-prompt-owner-and-reject-reassign-or-terminalize',
    consumerPolicy: {
      publicEssayPrompts: 'hide_until_source_family_resolved',
      timelineTasks: 'hide_until_source_family_resolved',
      chatContext: 'do_not_use_as_school_prompt_fact',
      adminReview: 'show_official_context_no_prompt_match',
    },
    candidateOnlyEvidence: {
      checkedUrls: evidence.map((row) => row.sourceUrl),
      finalUrls: unique(
        evidence
          .map((row) => row.finalUrl)
          .filter((url): url is string => Boolean(url)),
      ),
      trustedValidatedSourceUrls: trustedValidatedSourceUrls(checkedUrls),
      untrustedValidatedSourceUrls: untrustedValidatedSourceUrls(checkedUrls),
      crossSchoolPromptMatchSourceUrls:
        crossSchoolPromptMatchSourceUrls(checkedUrls),
      promptLanguageSignals,
      cycleSignals,
      evidenceSnippets,
      officialContextNoPromptMatchUrls: checkedUrls.filter(
        (row) =>
          row.evidenceStatus === 'official_context_no_prompt_match' ||
          row.evidenceStatus === 'cross_school_prompt_match',
      ).length,
      promptMatchCount: checkedUrls.reduce(
        (sum, row) => sum + (row.promptMatchCount ?? 0),
        0,
      ),
    },
    requiredReviewerChecks: requiredReviewerChecks(disposition),
    prohibitedActions: [
      'do not approve this source family without prompt text match or reviewer rationale',
      'do not publish this prompt through essay/timeline/chat consumers while source-family review is open',
      'do not treat partial same-school prompt matches as proof for unmatched prompt snippets',
    ],
  };
}

function promptNeedsPartialOrUntrustedReview(
  essayPromptId: string,
  partialMismatchPromptIds: Set<string>,
  trustedMatchedPromptIds: Set<string>,
  untrustedMatchedPromptIds: Set<string>,
  crossSchoolMatchedPromptIds: Set<string>,
) {
  return (
    partialMismatchPromptIds.has(essayPromptId) ||
    (!trustedMatchedPromptIds.has(essayPromptId) &&
      untrustedMatchedPromptIds.has(essayPromptId)) ||
    crossSchoolMatchedPromptIds.has(essayPromptId)
  );
}

function hasOfficialPromptContext(checkedUrls: CheckedUrl[]) {
  return checkedUrls.some(
    (row) =>
      [
        'candidate_validated_for_review',
        'cross_school_prompt_match',
        'official_context_no_prompt_match',
      ].includes(row.evidenceStatus) &&
      (row.promptLanguageSignals ?? []).length > 0,
  );
}

function hasOnlyUntrustedValidatedSourcesWithOfficialContextNoMatch(
  checkedUrls: CheckedUrl[],
) {
  const validated = checkedUrls.filter(
    (row) => row.evidenceStatus === 'candidate_validated_for_review',
  );
  if (validated.length === 0) return false;
  const hasOfficialContextNoMatch = checkedUrls.some(
    (row) => row.evidenceStatus === 'official_context_no_prompt_match',
  );
  return (
    hasOfficialContextNoMatch &&
    validated.every((row) => !isTrustedManualSourceUrl(row.sourceUrl))
  );
}

function trustedValidatedSourceUrls(checkedUrls: CheckedUrl[]) {
  return unique(
    checkedUrls
      .filter(
        (row) =>
          row.evidenceStatus === 'candidate_validated_for_review' &&
          isTrustedManualSourceUrl(row.sourceUrl),
      )
      .map((row) => row.sourceUrl),
  );
}

function untrustedValidatedSourceUrls(checkedUrls: CheckedUrl[]) {
  return unique(
    checkedUrls
      .filter(
        (row) =>
          row.evidenceStatus === 'candidate_validated_for_review' &&
          !isTrustedManualSourceUrl(row.sourceUrl),
      )
      .map((row) => row.sourceUrl),
  );
}

function trustedValidatedMatchedPromptIds(checkedUrls: CheckedUrl[]) {
  return new Set(
    checkedUrls
      .filter(
        (row) =>
          row.evidenceStatus === 'candidate_validated_for_review' &&
          isTrustedManualSourceUrl(row.sourceUrl),
      )
      .flatMap((row) => row.matchedPromptIds ?? []),
  );
}

function untrustedValidatedMatchedPromptIds(checkedUrls: CheckedUrl[]) {
  return new Set(
    checkedUrls
      .filter(
        (row) =>
          row.evidenceStatus === 'candidate_validated_for_review' &&
          !isTrustedManualSourceUrl(row.sourceUrl),
      )
      .flatMap((row) => row.matchedPromptIds ?? []),
  );
}

function crossSchoolMatchedPromptIdsFor(checkedUrls: CheckedUrl[]) {
  return new Set(
    checkedUrls
      .filter((row) => row.evidenceStatus === 'cross_school_prompt_match')
      .flatMap((row) => row.matchedPromptIds ?? []),
  );
}

function crossSchoolPromptMatchSourceUrls(checkedUrls: CheckedUrl[]) {
  return unique(
    checkedUrls
      .filter((row) => row.evidenceStatus === 'cross_school_prompt_match')
      .map((row) => row.sourceUrl),
  );
}

function crossSchoolPromptMatchCount(checkedUrls: CheckedUrl[]) {
  return crossSchoolPromptMatchSourceUrls(checkedUrls).length;
}

function countTrustedValidatedSourceUrls(checkedUrls: CheckedUrl[]) {
  return trustedValidatedSourceUrls(checkedUrls).length;
}

function countUntrustedValidatedSourceUrls(checkedUrls: CheckedUrl[]) {
  return untrustedValidatedSourceUrls(checkedUrls).length;
}

function isTrustedManualSourceUrl(sourceUrl: string) {
  let host = '';
  try {
    host = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  return (
    host === 'commonapp.org' ||
    host.endsWith('.commonapp.org') ||
    host === 'questbridge.org' ||
    host.endsWith('.questbridge.org') ||
    host.endsWith('.edu')
  );
}

function chooseDisposition(
  prompt: PromptSample,
  evidence: CheckedUrl[],
): MismatchDisposition {
  const snippet = normalizeText(prompt.promptSnippet ?? '');
  const hasOfficialContext =
    evidence.length > 0 &&
    evidence.some((row) => (row.promptLanguageSignals ?? []).length > 0);
  if (hasOfficialContext && snippet.length > 0) {
    return 'review_prompt_owner_or_reject';
  }
  return 'review_terminal_official_source_exhausted';
}

function requiredReviewerChecks(disposition: MismatchDisposition) {
  const checks = [
    'official prompt source family is confirmed for the assigned school and application cycle',
    'prompt text, word limit, and required/optional status are verified against raw source evidence',
    'reviewer workflow ID and rationale are recorded before any prompt/source write',
    'consumer source gates remain active until review closes',
  ];
  if (disposition === 'review_prompt_owner_or_reject') {
    checks.push(
      'reviewer decides whether each prompt belongs to another source family, should be rejected, or should be terminalized',
    );
  }
  if (disposition === 'review_terminal_official_source_exhausted') {
    checks.push(
      'checked official URLs are attached as terminal-search evidence if no matching prompt can be found',
    );
  }
  if (disposition === 'review_untrusted_source_or_official_conflict') {
    checks.push(
      'reviewer compares third-party prompt matches against official/Common App no-match evidence before any source row can be approved',
    );
  }
  if (disposition === 'review_cross_school_prompt_owner_conflict') {
    checks.push(
      'reviewer confirms whether the matched prompt belongs to another institution before reject, reassign, or source approval actions',
    );
  }
  return checks;
}

function duplicatePromptSnippetRows(prompts: PromptSample[]) {
  const counts = countBy(prompts, (prompt) =>
    normalizeText(prompt.promptSnippet ?? ''),
  );
  return prompts.filter((prompt) => {
    const key = normalizeText(prompt.promptSnippet ?? '');
    return key.length > 0 && (counts[key] ?? 0) > 1;
  }).length;
}

function buildNextCampaign(
  rows: ReviewRow[],
  sourceFamilyMismatchReview: boolean,
) {
  const first = rows[0];
  if (!first) {
    return {
      id: 'essay_prompt_source_search_continue',
      reason:
        'No source-family mismatch rows require reviewer routing; continue source validation/search campaigns.',
    };
  }
  return {
    id: 'essay_prompt_source_family_mismatch_reviewer_queue',
    reason: `${first.schoolName} has ${rows.length} prompt rows whose checked official prompt-context URLs did not match assigned prompt snippets.`,
    schoolId: first.schoolId,
    schoolName: first.schoolName,
    topEssayPromptId: first.essayPromptId,
    sourceFamilyMismatchReview,
    recommendedAction: first.recommendedAction,
  };
}

function writeReport(args: Args, report: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report as any), 'utf8');
  fs.writeFileSync(args.csv, renderCsv((report as any).rows ?? []), 'utf8');

  if (args.out.startsWith(REPORT_ROOT)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportBase = path.join(
    REPORT_ROOT,
    `essay-prompt-source-family-mismatch-review-${stamp}`,
  );
  fs.mkdirSync(REPORT_ROOT, { recursive: true });
  fs.writeFileSync(
    `${reportBase}.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  fs.writeFileSync(`${reportBase}.md`, renderMarkdown(report as any), 'utf8');
  fs.writeFileSync(`${reportBase}.csv`, renderCsv((report as any).rows ?? []));
}

function renderMarkdown(report: {
  generatedAt: string;
  status: string;
  target?: Record<string, unknown>;
  summary: Record<string, unknown>;
  nextCampaign: Record<string, unknown>;
  rows: ReviewRow[];
}) {
  const contextEvidence = unique(
    report.rows.flatMap((row) => row.candidateOnlyEvidence.evidenceSnippets),
  ).slice(0, 6);
  return [
    '# Essay Prompt Source Family Mismatch Review Packet',
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
    `- Source-family mismatch review: ${report.summary.sourceFamilyMismatchReview}`,
    `- Prompt rows: ${report.summary.promptRows}`,
    `- Review rows: ${report.summary.emittedRows}`,
    `- Official context/no prompt match URLs: ${report.summary.officialContextNoPromptMatchUrls}`,
    `- Untrusted validated source URLs: ${report.summary.untrustedValidatedSourceUrls ?? 0}`,
    `- Duplicate prompt snippet rows: ${report.summary.duplicatePromptSnippetRows}`,
    '',
    '## Next Campaign',
    '',
    `- ${report.nextCampaign.reason ?? 'Continue essay prompt source closure.'}`,
    '',
    '## Context Evidence',
    '',
    contextEvidence.length === 0
      ? '- None'
      : contextEvidence
          .map((snippet) => `- ${escapeMarkdown(snippet).slice(0, 500)}`)
          .join('\n'),
    '',
    '## Reviewer Queue',
    '',
    report.rows.length === 0
      ? '- None'
      : report.rows
          .slice(0, 30)
          .map(
            (row) =>
              `- ${row.severity.toUpperCase()} ${row.schoolName}: ${row.promptSnippet ?? row.essayPromptId} -> ${row.mismatchDisposition}`,
          )
          .join('\n'),
    '',
    '## Review Contract',
    '',
    '- This packet is read-only and does not reject, reassign, approve, or write prompt/source rows.',
    '- Official prompt context with no prompt-text match is review evidence only.',
    '- Public essay, timeline, and chat consumers must keep these prompts hidden until source-family review closes.',
    '',
  ].join('\n');
}

function renderCsv(rows: ReviewRow[]) {
  const headers = [
    'essayPromptId',
    'schoolId',
    'schoolName',
    'type',
    'severity',
    'route',
    'promptSnippet',
    'closureState',
    'mismatchDisposition',
    'recommendedAction',
  ];
  return `${[
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => csvCell((row as any)[header])).join(','),
    ),
  ].join('\n')}\n`;
}

function summarizeInput(filePath: string | null, report: ManualCheckReport) {
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

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = getKey(row) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function csvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ''
      : Array.isArray(value)
        ? value.join('|')
        : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
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
        reviewRows: report.summary.emittedRows,
        blockedRows: report.summary.blockedRows,
        sourceFamilyMismatchReview: report.summary.sourceFamilyMismatchReview,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
