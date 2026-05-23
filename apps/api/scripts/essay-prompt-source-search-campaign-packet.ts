#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'ESSAY_PROMPT_SOURCE_SEARCH_CAMPAIGN_READY'
  | 'PASS_NO_SOURCE_SEARCH_ROWS'
  | 'BLOCKED_SOURCE_SEARCH_INPUTS_MISSING';

type RecommendedAction =
  | 'review-source-family-mismatch-before-source-approval'
  | 'resolve-identity-conflicts-before-source-approval'
  | 'review-validated-source-before-write'
  | 'validate-ranked-linked-source-candidates'
  | 'manual-inspect-reachable-prompt-language-pages'
  | 'manual-deep-search-official-application-page'
  | 'retry-blocked-candidates-or-external-source-search'
  | 'manual-official-source-search-or-terminal';

interface Args {
  worklist: string | null;
  sourceRecovery: string | null;
  sourceValidation: string | null;
  essayPromptDisposition: string | null;
  identityConflictResolution: string | null;
  sourceManualCheck: string[];
  sourceFamilyMismatchReview: string[];
  out: string;
  markdown: string;
  csv: string;
  limitSchools: number;
  maxPromptsPerSchool: number;
}

interface PromptRef {
  essayPromptId: string;
  type: string;
  severity: string;
  route: string;
  promptSnippet: string | null;
}

interface CandidateSource {
  sourceType?: string;
  sourceUrl?: string;
  sourceQuality?: string;
  priority?: number;
  reviewAction?: string;
}

interface RecoveryRow {
  schoolId: string;
  schoolName: string;
  usNewsRank?: number | null;
  applicationYear?: number | null;
  promptCount?: number;
  criticalPromptCount?: number;
  promptSamples?: Array<{
    essayPromptId: string;
    type: string;
    promptSnippet?: string | null;
    route?: string;
  }>;
  candidateSources?: CandidateSource[];
}

interface ValidationRow {
  schoolId: string;
  schoolName: string;
  sourceUrl: string;
  fetchStatus?: string;
  evidenceStatus?: string;
  promptMatchCount?: number;
  matchedPromptIds?: string[];
  cycleSignals?: string[];
  promptLanguageSignals?: string[];
  linkCandidates?: Array<Record<string, unknown>>;
}

interface DispositionRow {
  essayPromptId: string;
  schoolId: string;
  schoolName: string;
  year?: number;
  type?: string;
  severity?: string;
  gap?: string;
  action?: string;
  disposition?: string;
  closureState?: string;
  nextAction?: string;
}

interface IdentityResolutionRow {
  essayPromptId: string;
  assignedSchoolId?: string;
  assignedSchoolName?: string;
  matchedSchoolId?: string;
  matchedSchoolName?: string;
  schoolIdentityRelation?: string;
  schoolIdentityRelationSignals?: string[];
  resolutionDisposition?: string;
  recommendedAction?: string;
}

interface SourceManualCheckReport {
  target?: {
    schoolId?: string;
    schoolName?: string;
  };
  summary?: {
    checkedUrls?: number;
    validatedSourceUrls?: number;
    officialContextNoPromptMatchUrls?: number;
    promptMatchCount?: number;
    matchedPromptIds?: string[];
    promptRows?: number;
    sourceFamilyMismatchReview?: boolean;
  };
}

interface SourceFamilyMismatchReviewReport {
  status?: string;
  target?: {
    schoolId?: string;
    schoolName?: string;
  };
  summary?: {
    emittedRows?: number;
    blockedRows?: number;
    reviewRows?: number;
    sourceFamilyMismatchReview?: boolean;
  };
  rows?: Array<{
    essayPromptId?: string;
    schoolId?: string;
    schoolName?: string;
  }>;
}

interface CampaignRow {
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  applicationYear: number | null;
  sourceSearchPromptRows: number;
  criticalPromptRows: number;
  identityConflictRows: number;
  recommendedAction: RecommendedAction;
  campaignState:
    | 'source_search'
    | 'conflict_review'
    | 'review_validated'
    | 'source_family_mismatch_review';
  score: number;
  promptSamples: PromptRef[];
  candidateSummary: {
    recoveryCandidates: number;
    officialCandidates: number;
    commonAppCandidates: number;
    configuredCandidates: number;
  };
  validationSummary: {
    checkedCandidates: number;
    reachableCandidates: number;
    blockedOrFailedCandidates: number;
    contextOnlyCandidates: number;
    noPromptMatchCandidates: number;
    promptMatchCandidates: number;
    linkedSourceCandidates: number;
    cycleSignalCandidates: number;
    promptLanguageSignalCandidates: number;
  };
  topCandidateUrls: string[];
  topLinkedCandidates: Array<{
    linkedUrl: string;
    score: number;
    reasons: string[];
  }>;
  identityConflicts: Array<{
    essayPromptId: string;
    matchedSchoolName: string | null;
    schoolIdentityRelation: string | null;
    resolutionDisposition: string | null;
    recommendedAction: string | null;
  }>;
  sourceFamilyMismatchReview: {
    status: string | null;
    reviewRows: number;
    blockedRows: number;
    manualCheckedUrls: number;
    manualValidatedSourceUrls: number;
    officialContextNoPromptMatchUrls: number;
    manualPromptMatchCount: number;
    manualMatchedPromptRows: number;
    sourceFamilyMismatchReview: boolean;
  };
  consumerPolicy: {
    publicEssayPrompts: 'keep_hidden_until_source_row_and_identity_review';
    timeline: 'keep_hidden_until_source_row_and_identity_review';
    chatContext: 'do_not_quote_prompt_without_source';
    adminReview: 'show_source_search_campaign';
  };
  requiredEvidence: string[];
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
  const values = (name: string) => {
    const found: string[] = [];
    for (let index = 0; index < argv.length; index += 1) {
      const arg = argv[index];
      if (arg.startsWith(`${name}=`)) found.push(arg.slice(name.length + 1));
      if (arg === name && argv[index + 1]) found.push(argv[index + 1]);
    }
    return found;
  };
  const optionalPath = (name: string, pattern: RegExp) => {
    const value = get(name);
    return value ? resolveInputPath(value) : findLatest(pattern);
  };
  const optionalPathList = (name: string, pattern: RegExp) => {
    const explicit = values(name).map(resolveInputPath);
    if (explicit.length > 0) return explicit;
    const latest = findLatest(pattern);
    return latest ? [latest] : [];
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(
        REPORT_ROOT,
        `essay-prompt-source-search-campaign-${stamp}.json`,
      ),
    )!,
  );
  return {
    worklist: optionalPath('--worklist', /^essay-prompt-worklist-.+\.json$/),
    sourceRecovery: optionalPath(
      '--source-recovery',
      /^essay-prompt-source-recovery-.+\.json$/,
    ),
    sourceValidation: optionalPath(
      '--source-validation',
      /^essay-prompt-source-validation-rollup-.+\.json$/,
    ),
    essayPromptDisposition: optionalPath(
      '--essay-prompt-disposition',
      /^essay-prompt-disposition-.+\.json$/,
    ),
    identityConflictResolution: optionalPath(
      '--identity-conflict-resolution',
      /^essay-prompt-identity-conflict-resolution-.+\.json$/,
    ),
    sourceManualCheck: optionalPathList(
      '--source-manual-check',
      /^essay-prompt-source-manual-check-.+\.json$/,
    ),
    sourceFamilyMismatchReview: optionalPathList(
      '--source-family-mismatch-review',
      /^essay-prompt-source-family-mismatch-review-.+\.json$/,
    ),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    limitSchools: Number(get('--limit-schools', '250')),
    maxPromptsPerSchool: Number(get('--max-prompts-per-school', '12')),
  };
}

function main() {
  const args = parseArgs();
  const missingInputs = [
    inputStatus('--worklist', args.worklist),
    inputStatus('--source-recovery', args.sourceRecovery),
    inputStatus('--source-validation', args.sourceValidation),
    inputStatus('--essay-prompt-disposition', args.essayPromptDisposition),
  ].filter((input) => !input.found);
  if (missingInputs.length > 0) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-essay-prompt-source-search-campaign',
      status: 'BLOCKED_SOURCE_SEARCH_INPUTS_MISSING' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      missingInputs,
      summary: {
        sourceSearchPromptRows: 0,
        emittedSchools: 0,
        blockedRows: missingInputs.length,
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    return;
  }

  const worklist = readJson<{ rows?: any[] }>(args.worklist);
  const sourceRecovery = readJson<{ rows?: RecoveryRow[] }>(
    args.sourceRecovery,
  );
  const sourceValidation = readJson<{ rows?: ValidationRow[] }>(
    args.sourceValidation,
  );
  const essayPromptDisposition = readJson<{ rows?: DispositionRow[] }>(
    args.essayPromptDisposition,
  );
  const identityConflictResolution = readJson<{
    rows?: IdentityResolutionRow[];
  }>(args.identityConflictResolution);
  const sourceManualChecks = args.sourceManualCheck.map((filePath) =>
    readJson<SourceManualCheckReport>(filePath),
  );
  const sourceFamilyMismatchReviews = args.sourceFamilyMismatchReview.map(
    (filePath) => readJson<SourceFamilyMismatchReviewReport>(filePath),
  );

  const sourceSearchRows = (essayPromptDisposition.rows ?? []).filter(
    (row) =>
      row.gap === 'source.rows_missing' && row.closureState === 'source_search',
  );
  const rows = buildCampaignRows({
    sourceSearchRows,
    worklistRows: worklist.rows ?? [],
    recoveryRows: sourceRecovery.rows ?? [],
    validationRows: sourceValidation.rows ?? [],
    identityRows: identityConflictResolution.rows ?? [],
    sourceManualChecks,
    sourceFamilyMismatchReviews,
    maxPromptsPerSchool: args.maxPromptsPerSchool,
  })
    .sort(compareCampaignRows)
    .slice(0, args.limitSchools);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-source-search-campaign',
    status: (sourceSearchRows.length > 0
      ? 'ESSAY_PROMPT_SOURCE_SEARCH_CAMPAIGN_READY'
      : 'PASS_NO_SOURCE_SEARCH_ROWS') satisfies PacketStatus,
    destructiveDbWriteAllowedByThisPlan: false,
    sourceArtifacts: {
      worklist: summarizeInput(args.worklist),
      sourceRecovery: summarizeInput(args.sourceRecovery),
      sourceValidation: summarizeInput(args.sourceValidation),
      essayPromptDisposition: summarizeInput(args.essayPromptDisposition),
      identityConflictResolution: summarizeInput(
        args.identityConflictResolution,
      ),
      sourceManualCheck: args.sourceManualCheck.map(summarizeInput),
      sourceFamilyMismatchReview:
        args.sourceFamilyMismatchReview.map(summarizeInput),
    },
    summary: {
      sourceSearchPromptRows: sourceSearchRows.length,
      emittedSchools: rows.length,
      allSourceSearchRowsHaveCampaign:
        sourceSearchRows.length ===
        rows.reduce((sum, row) => sum + row.sourceSearchPromptRows, 0),
      blockedRows: 0,
      identityConflictPromptRows: rows.reduce(
        (sum, row) => sum + row.identityConflictRows,
        0,
      ),
      byIdentityConflictDisposition: countBy(
        rows.flatMap((row) => row.identityConflicts),
        (row) => row.resolutionDisposition ?? 'unknown',
      ),
      byIdentityRelation: countBy(
        rows.flatMap((row) => row.identityConflicts),
        (row) => row.schoolIdentityRelation ?? 'unknown',
      ),
      sourceFamilyMismatchReviewPromptRows: rows.reduce(
        (sum, row) => sum + row.sourceFamilyMismatchReview.reviewRows,
        0,
      ),
      schoolsWithSourceFamilyMismatchReview: rows.filter(
        (row) => row.sourceFamilyMismatchReview.sourceFamilyMismatchReview,
      ).length,
      schoolsWithLinkedCandidates: rows.filter(
        (row) => row.validationSummary.linkedSourceCandidates > 0,
      ).length,
      schoolsWithPromptLanguageSignals: rows.filter(
        (row) => row.validationSummary.promptLanguageSignalCandidates > 0,
      ).length,
      schoolsMostlyBlocked: rows.filter(
        (row) =>
          row.validationSummary.checkedCandidates > 0 &&
          row.validationSummary.blockedOrFailedCandidates >=
            row.validationSummary.reachableCandidates,
      ).length,
      byRecommendedAction: countBy(rows, (row) => row.recommendedAction),
      newSourceSearchSchools: rows.filter(isNewSourceSearchCampaign).length,
      routedReviewSchools: rows.filter((row) => !isNewSourceSearchCampaign(row))
        .length,
      topCampaigns: rows.slice(0, 10).map((row) => ({
        schoolName: row.schoolName,
        sourceSearchPromptRows: row.sourceSearchPromptRows,
        campaignState: row.campaignState,
        sourceFamilyMismatchReviewRows:
          row.sourceFamilyMismatchReview.reviewRows,
        recommendedAction: row.recommendedAction,
        score: row.score,
      })),
    },
    reviewContract: {
      packetDoesNotFetchOrWriteSources: true,
      candidateEvidenceStatus: 'candidate_only',
      sourceRowsRemainUntrustedUntil: [
        'official or approved source family is confirmed',
        'prompt text or stable equivalent is found in raw source content',
        'cycle year and prompt fields are reviewed',
        'identity conflicts are resolved or terminalized',
        'DB schema compatibility allows an approved write plan',
      ],
      prohibitedActions: [
        'do not mark source-search prompts trusted from campaign rows',
        'do not expose source-less prompts through public essay, timeline, or chat consumers',
        'do not treat Common App generic essay pages as school-specific supplemental prompt evidence',
      ],
    },
    nextCampaign: buildNextCampaign(rows),
    rows,
  };
  writeReport(args, report);
  printSummary(args, report);
}

function buildCampaignRows(input: {
  sourceSearchRows: DispositionRow[];
  worklistRows: any[];
  recoveryRows: RecoveryRow[];
  validationRows: ValidationRow[];
  identityRows: IdentityResolutionRow[];
  sourceManualChecks: SourceManualCheckReport[];
  sourceFamilyMismatchReviews: SourceFamilyMismatchReviewReport[];
  maxPromptsPerSchool: number;
}): CampaignRow[] {
  const worklistByPrompt = new Map(
    input.worklistRows.map((row) => [row.essayPromptId, row]),
  );
  const recoveryBySchool = new Map(
    input.recoveryRows.map((row) => [row.schoolId, row]),
  );
  const validationBySchool = groupBy(
    input.validationRows,
    (row) => row.schoolId,
  );
  const identityByPrompt = new Map(
    input.identityRows.map((row) => [row.essayPromptId, row]),
  );
  const sourceManualCheckBySchool = summarizeManualCheckBySchool(
    input.sourceManualChecks,
  );
  const sourceFamilyMismatchReviewBySchool =
    summarizeSourceFamilyMismatchReviewBySchool(
      input.sourceFamilyMismatchReviews,
    );
  const bySchool = groupBy(input.sourceSearchRows, (row) => row.schoolId);

  return Array.from(bySchool.entries()).map(([schoolId, schoolRows]) => {
    const first = schoolRows[0];
    const recovery = recoveryBySchool.get(schoolId);
    const validationRows = validationBySchool.get(schoolId) ?? [];
    const promptSamples = schoolRows
      .slice(0, input.maxPromptsPerSchool)
      .map((row) => promptRef(row, worklistByPrompt.get(row.essayPromptId)));
    const identityConflicts = schoolRows
      .map((row) => identityByPrompt.get(row.essayPromptId))
      .filter(isPresent)
      .map((row) => ({
        essayPromptId: row.essayPromptId,
        matchedSchoolName: row.matchedSchoolName ?? null,
        schoolIdentityRelation: row.schoolIdentityRelation ?? null,
        resolutionDisposition: row.resolutionDisposition ?? null,
        recommendedAction: row.recommendedAction ?? null,
      }));
    const validationSummary = summarizeValidation(validationRows);
    const sourceFamilyMismatchReview =
      sourceFamilyMismatchReviewBySchool.get(schoolId);
    const sourceManualCheck = sourceManualCheckBySchool.get(schoolId);
    const mismatchReview = {
      status: sourceFamilyMismatchReview?.status ?? null,
      reviewRows: sourceFamilyMismatchReview?.reviewRows ?? 0,
      blockedRows: sourceFamilyMismatchReview?.blockedRows ?? 0,
      manualCheckedUrls: sourceManualCheck?.manualCheckedUrls ?? 0,
      manualValidatedSourceUrls:
        sourceManualCheck?.manualValidatedSourceUrls ?? 0,
      officialContextNoPromptMatchUrls:
        sourceManualCheck?.officialContextNoPromptMatchUrls ?? 0,
      manualPromptMatchCount: sourceManualCheck?.manualPromptMatchCount ?? 0,
      manualMatchedPromptRows: sourceManualCheck?.manualMatchedPromptRows ?? 0,
      sourceFamilyMismatchReview: Boolean(
        sourceFamilyMismatchReview?.sourceFamilyMismatchReview ||
        sourceManualCheck?.sourceFamilyMismatchReview,
      ),
    };
    const recommendedAction = chooseRecommendedAction(
      identityConflicts.length,
      validationSummary,
      mismatchReview,
    );
    const campaignState = mismatchReview.sourceFamilyMismatchReview
      ? 'source_family_mismatch_review'
      : identityConflicts.length > 0
        ? 'conflict_review'
        : validationSummary.promptMatchCandidates > 0 ||
            mismatchReview.manualPromptMatchCount > 0
          ? 'review_validated'
          : 'source_search';
    const row: CampaignRow = {
      schoolId,
      schoolName: first.schoolName,
      usNewsRank: recovery?.usNewsRank ?? null,
      applicationYear: first.year ?? recovery?.applicationYear ?? null,
      sourceSearchPromptRows: schoolRows.length,
      criticalPromptRows: schoolRows.filter(
        (item) => item.severity === 'critical',
      ).length,
      identityConflictRows: identityConflicts.length,
      recommendedAction,
      campaignState,
      score: 0,
      promptSamples,
      candidateSummary: summarizeCandidates(recovery?.candidateSources ?? []),
      validationSummary,
      topCandidateUrls: (recovery?.candidateSources ?? [])
        .slice(0, 5)
        .map((source) => source.sourceUrl)
        .filter(isString),
      topLinkedCandidates: topLinkedCandidates(validationRows),
      identityConflicts,
      sourceFamilyMismatchReview: mismatchReview,
      consumerPolicy: {
        publicEssayPrompts: 'keep_hidden_until_source_row_and_identity_review',
        timeline: 'keep_hidden_until_source_row_and_identity_review',
        chatContext: 'do_not_quote_prompt_without_source',
        adminReview: 'show_source_search_campaign',
      },
      requiredEvidence: requiredEvidence(recommendedAction),
      prohibitedActions: [
        'do not create EssayPromptSource from this campaign row alone',
        'do not publish source-less verified prompts',
        'do not overwrite prompt-school assignment without reviewer workflow',
      ],
    };
    row.score = scoreCampaign(row);
    return row;
  });
}

function promptRef(row: DispositionRow, worklistRow: any): PromptRef {
  return {
    essayPromptId: row.essayPromptId,
    type: row.type ?? worklistRow?.type ?? 'unknown',
    severity: row.severity ?? worklistRow?.severity ?? 'unknown',
    route: worklistRow?.route ?? `/admin/essay-prompts/${row.essayPromptId}`,
    promptSnippet: worklistRow?.details?.promptSnippet ?? null,
  };
}

function summarizeValidation(
  rows: ValidationRow[],
): CampaignRow['validationSummary'] {
  const actionableLinkedCandidates = linkedCandidatesFromRows(rows);
  return {
    checkedCandidates: rows.length,
    reachableCandidates: rows.filter(
      (row) => row.fetchStatus === 'reachable_html',
    ).length,
    blockedOrFailedCandidates: rows.filter((row) =>
      ['blocked', 'fetch_failed'].includes(row.fetchStatus ?? ''),
    ).length,
    contextOnlyCandidates: rows.filter(
      (row) => row.evidenceStatus === 'reachable_context_only',
    ).length,
    noPromptMatchCandidates: rows.filter(
      (row) => row.evidenceStatus === 'reachable_no_prompt_match',
    ).length,
    promptMatchCandidates: rows.filter((row) => (row.promptMatchCount ?? 0) > 0)
      .length,
    linkedSourceCandidates: actionableLinkedCandidates.length,
    cycleSignalCandidates: rows.filter(
      (row) => (row.cycleSignals ?? []).length > 0,
    ).length,
    promptLanguageSignalCandidates: rows.filter(
      (row) => (row.promptLanguageSignals ?? []).length > 0,
    ).length,
  };
}

function summarizeCandidates(
  candidates: CandidateSource[],
): CampaignRow['candidateSummary'] {
  return {
    recoveryCandidates: candidates.length,
    officialCandidates: candidates.filter(
      (source) => source.sourceQuality === 'official',
    ).length,
    commonAppCandidates: candidates.filter(
      (source) => source.sourceQuality === 'common_app',
    ).length,
    configuredCandidates: candidates.filter(
      (source) => source.sourceQuality === 'configured',
    ).length,
  };
}

function summarizeManualCheckBySchool(reports: SourceManualCheckReport[]) {
  const bySchool = new Map<string, CampaignRow['sourceFamilyMismatchReview']>();
  for (const report of reports) {
    const schoolId = report.target?.schoolId;
    if (!schoolId) continue;
    const existing = bySchool.get(schoolId) ?? emptyMismatchSummary();
    bySchool.set(schoolId, {
      ...existing,
      manualCheckedUrls:
        existing.manualCheckedUrls + asNumber(report.summary?.checkedUrls),
      manualValidatedSourceUrls:
        existing.manualValidatedSourceUrls +
        asNumber(report.summary?.validatedSourceUrls),
      officialContextNoPromptMatchUrls:
        existing.officialContextNoPromptMatchUrls +
        asNumber(report.summary?.officialContextNoPromptMatchUrls),
      manualPromptMatchCount:
        existing.manualPromptMatchCount +
        asNumber(report.summary?.promptMatchCount),
      manualMatchedPromptRows:
        existing.manualMatchedPromptRows +
        new Set(report.summary?.matchedPromptIds ?? []).size,
      sourceFamilyMismatchReview: Boolean(
        existing.sourceFamilyMismatchReview ||
        report.summary?.sourceFamilyMismatchReview,
      ),
    });
  }
  return bySchool;
}

function summarizeSourceFamilyMismatchReviewBySchool(
  reports: SourceFamilyMismatchReviewReport[],
) {
  const bySchool = new Map<string, CampaignRow['sourceFamilyMismatchReview']>();
  for (const report of reports) {
    const targetSchoolId = report.target?.schoolId;
    const rowSchoolIds = Array.from(
      new Set((report.rows ?? []).map((row) => row.schoolId).filter(isString)),
    );
    const schoolIds = targetSchoolId ? [targetSchoolId] : rowSchoolIds;
    const reviewRows = asNumber(
      report.summary?.reviewRows ?? report.summary?.emittedRows,
    );
    const blockedRows = asNumber(report.summary?.blockedRows);
    const sourceFamilyMismatchReview = Boolean(
      report.summary?.sourceFamilyMismatchReview || reviewRows > 0,
    );
    for (const schoolId of schoolIds) {
      const existing = bySchool.get(schoolId) ?? emptyMismatchSummary();
      bySchool.set(schoolId, {
        ...existing,
        status: report.status ?? existing.status,
        reviewRows: existing.reviewRows + reviewRows,
        blockedRows: existing.blockedRows + blockedRows,
        sourceFamilyMismatchReview: Boolean(
          existing.sourceFamilyMismatchReview || sourceFamilyMismatchReview,
        ),
      });
    }
  }
  return bySchool;
}

function chooseRecommendedAction(
  identityConflictRows: number,
  validation: CampaignRow['validationSummary'],
  sourceFamilyMismatchReview: CampaignRow['sourceFamilyMismatchReview'],
): RecommendedAction {
  if (sourceFamilyMismatchReview.sourceFamilyMismatchReview) {
    return 'review-source-family-mismatch-before-source-approval';
  }
  if (identityConflictRows > 0) {
    return 'resolve-identity-conflicts-before-source-approval';
  }
  if (
    validation.promptMatchCandidates > 0 ||
    sourceFamilyMismatchReview.manualPromptMatchCount > 0
  ) {
    return 'review-validated-source-before-write';
  }
  if (validation.linkedSourceCandidates > 0) {
    return 'validate-ranked-linked-source-candidates';
  }
  if (validation.promptLanguageSignalCandidates > 0) {
    return 'manual-inspect-reachable-prompt-language-pages';
  }
  if (validation.contextOnlyCandidates > 0) {
    return 'manual-deep-search-official-application-page';
  }
  if (
    validation.checkedCandidates > 0 &&
    validation.blockedOrFailedCandidates >= validation.reachableCandidates
  ) {
    return 'retry-blocked-candidates-or-external-source-search';
  }
  return 'manual-official-source-search-or-terminal';
}

function requiredEvidence(action: RecommendedAction) {
  switch (action) {
    case 'review-source-family-mismatch-before-source-approval':
      return [
        'source-family mismatch review packet closes prompt rows with reject, reassign, terminal, or approved-source rationale',
        'reviewer confirms whether official context belongs to assigned school and application cycle',
        'public essay, timeline, and chat consumers remain source-gated until review closes',
      ];
    case 'resolve-identity-conflicts-before-source-approval':
      return [
        'reviewer confirms whether conflict is true prompt-owner drift or duplicate school identity',
        'duplicate school identity rows are resolved by merge/alias/keep-distinct rationale before prompt reassignment',
        'true foreign-school prompt rows have official source evidence before reassign/reject actions',
      ];
    case 'review-validated-source-before-write':
      return [
        'validated prompt text match',
        'source-family, cycle-year, raw snapshot, and prompt-field review',
      ];
    case 'validate-ranked-linked-source-candidates':
      return [
        'bounded validation of top linked supplement/application URLs',
        'dedupe by school and normalized URL before staging',
      ];
    case 'manual-inspect-reachable-prompt-language-pages':
      return [
        'manual/source-agent inspection of reachable pages with essay or supplement language',
        'prompt text match or terminal reason if page is contextual only',
      ];
    case 'manual-deep-search-official-application-page':
      return [
        'official admissions/application page inspection',
        'deep links or terminal reason for no public prompt source',
      ];
    case 'retry-blocked-candidates-or-external-source-search':
      return [
        'bounded retry or alternate official path',
        'record checked URLs and terminal reason if repeated failures persist',
      ];
    case 'manual-official-source-search-or-terminal':
      return [
        'manual official-source search',
        'terminal reason if no official or approved source exists',
      ];
  }
}

function scoreCampaign(row: CampaignRow) {
  const rankBonus = row.usNewsRank ? Math.max(0, 80 - row.usNewsRank) : 0;
  const downstreamReviewPenalty =
    row.sourceFamilyMismatchReview.reviewRows > 0 ? 1000 : 0;
  const identityReviewPenalty =
    row.campaignState === 'conflict_review' ? 1000 : 0;
  const validatedReviewPenalty =
    row.campaignState === 'review_validated' ? 800 : 0;
  return Math.max(
    1,
    row.criticalPromptRows * 50 +
      row.sourceSearchPromptRows * 10 +
      row.identityConflictRows * 30 +
      Math.min(40, row.validationSummary.linkedSourceCandidates) +
      row.validationSummary.promptLanguageSignalCandidates * 3 +
      rankBonus -
      downstreamReviewPenalty -
      identityReviewPenalty -
      validatedReviewPenalty,
  );
}

function topLinkedCandidates(rows: ValidationRow[]) {
  return dedupeLinkedCandidates(linkedCandidatesFromRows(rows))
    .filter((candidate) => candidate.linkedUrl)
    .sort((a, b) => b.score - a.score || a.linkedUrl.localeCompare(b.linkedUrl))
    .slice(0, 5);
}

function linkedCandidatesFromRows(rows: ValidationRow[]) {
  return rows
    .flatMap((row) =>
      (row.linkCandidates ?? []).map((candidate) => ({
        linkedUrl: String(candidate.linkedUrl ?? candidate.url ?? ''),
        score: Number(candidate.score ?? 0),
        reasons: Array.isArray(candidate.reasons)
          ? candidate.reasons.map(String)
          : [],
      })),
    )
    .filter(isActionableLinkedCandidate);
}

function isActionableLinkedCandidate(candidate: {
  linkedUrl: string;
  reasons: string[];
}) {
  const url = candidate.linkedUrl.toLowerCase();
  const reasons = candidate.reasons.map((reason) => reason.toLowerCase());
  if (/catalog|financialaid|financial-aid|faq|about\/faq/.test(url)) {
    return false;
  }
  return (
    /admission|admissions|apply|application|commonapp|common-app|supplement|essay|writing-supplement/.test(
      url,
    ) ||
    reasons.some((reason) =>
      [
        'essay',
        'supplement',
        'common-app',
        'apply',
        'first-year-admission',
      ].includes(reason),
    )
  );
}

function dedupeLinkedCandidates(
  candidates: CampaignRow['topLinkedCandidates'],
) {
  const byUrl = new Map<string, CampaignRow['topLinkedCandidates'][number]>();
  for (const candidate of candidates) {
    const key = normalizeUrl(candidate.linkedUrl);
    const existing = byUrl.get(key);
    if (!existing || candidate.score > existing.score) {
      byUrl.set(key, candidate);
    }
  }
  return Array.from(byUrl.values());
}

function buildNextCampaign(rows: CampaignRow[]) {
  if (rows.length === 0) {
    return {
      id: 'essay_prompt_source_search_monitor',
      reason: 'No essay prompt source-search rows remain after disposition.',
    };
  }
  const top = rows.find(isNewSourceSearchCampaign);
  if (!top) {
    const byState = countBy(rows, (row) => row.campaignState);
    const reviewRows = rows.reduce(
      (sum, row) => sum + row.sourceSearchPromptRows,
      0,
    );
    return {
      id: 'essay_prompt_source_review_monitor',
      reason: `${reviewRows} source-search prompt rows are already routed into review/approval lanes; monitor reviewer queue, approval gate, write-plan, and DB compatibility instead of reopening source search.`,
      sourceSearchPromptRows: reviewRows,
      campaignStates: byState,
      recommendedAction: 'monitor-routed-review-lanes-before-new-source-search',
    };
  }
  return {
    id: 'essay_prompt_source_search_campaign',
    reason: `${top.schoolName} has ${top.sourceSearchPromptRows} source-search prompt rows; next action is ${top.recommendedAction}.`,
    schoolId: top.schoolId,
    schoolName: top.schoolName,
    sourceSearchPromptRows: top.sourceSearchPromptRows,
    recommendedAction: top.recommendedAction,
    campaignState: top.campaignState,
    sourceFamilyMismatchReviewRows: top.sourceFamilyMismatchReview.reviewRows,
    score: top.score,
  };
}

function isNewSourceSearchCampaign(row: CampaignRow) {
  return (
    row.campaignState === 'source_search' &&
    [
      'validate-ranked-linked-source-candidates',
      'manual-inspect-reachable-prompt-language-pages',
      'manual-deep-search-official-application-page',
      'retry-blocked-candidates-or-external-source-search',
      'manual-official-source-search-or-terminal',
    ].includes(row.recommendedAction)
  );
}

function compareCampaignRows(a: CampaignRow, b: CampaignRow) {
  return (
    b.score - a.score ||
    b.criticalPromptRows - a.criticalPromptRows ||
    b.sourceSearchPromptRows - a.sourceSearchPromptRows ||
    (a.usNewsRank ?? Number.MAX_SAFE_INTEGER) -
      (b.usNewsRank ?? Number.MAX_SAFE_INTEGER) ||
    a.schoolName.localeCompare(b.schoolName)
  );
}

function inputStatus(label: string, filePath: string | null) {
  return {
    label,
    path: filePath,
    found: Boolean(filePath && fs.existsSync(filePath)),
  };
}

function summarizeInput(filePath: string | null) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { path: filePath, found: false };
  }
  const report = readJson<Record<string, unknown>>(filePath);
  return {
    path: path.relative(API_ROOT, filePath),
    found: true,
    generatedAt: report.generatedAt ?? null,
    status: report.status ?? null,
    summary: report.summary ?? null,
  };
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const rows = Array.isArray(report.rows) ? (report.rows as CampaignRow[]) : [];
  return `${[
    '# Essay Prompt Source Search Campaign Packet',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Source-search prompt rows: ${report.summary?.sourceSearchPromptRows ?? 0}`,
    `- Schools emitted: ${report.summary?.emittedSchools ?? 0}`,
    `- Identity-conflict prompt rows: ${report.summary?.identityConflictPromptRows ?? 0}`,
    `- Source-family mismatch review prompt rows: ${report.summary?.sourceFamilyMismatchReviewPromptRows ?? 0}`,
    `- Schools with source-family mismatch review: ${report.summary?.schoolsWithSourceFamilyMismatchReview ?? 0}`,
    `- Schools with linked candidates: ${report.summary?.schoolsWithLinkedCandidates ?? 0}`,
    `- Schools mostly blocked/fetch-failed: ${report.summary?.schoolsMostlyBlocked ?? 0}`,
    '',
    '## Next Campaign',
    '',
    `- ${report.nextCampaign?.reason ?? 'Continue essay source-search monitoring.'}`,
    '',
    '## Top Campaign Rows',
    '',
    '| School | Prompts | Action | Top linked/candidate URL |',
    '| --- | ---: | --- | --- |',
    ...rows.slice(0, 40).map((row) => {
      const topUrl =
        row.topLinkedCandidates[0]?.linkedUrl ?? row.topCandidateUrls[0] ?? '';
      return `| ${escapeMarkdown(row.schoolName)} | ${row.sourceSearchPromptRows} | ${row.recommendedAction} | ${escapeMarkdown(topUrl || 'manual search')} |`;
    }),
    '',
    '## Review Contract',
    '',
    '- This packet is source-search planning only; it does not fetch new pages or write source rows.',
    '- Public essay, timeline, and chat consumers must keep source-less prompts hidden.',
    '- Common App generic pages are context unless the school-specific prompt text is verified.',
  ].join('\n')}\n`;
}

function renderCsv(rows: CampaignRow[]) {
  const headers = [
    'schoolId',
    'schoolName',
    'sourceSearchPromptRows',
    'criticalPromptRows',
    'identityConflictRows',
    'identityConflictDispositions',
    'identityRelations',
    'sourceFamilyMismatchReviewRows',
    'campaignState',
    'recommendedAction',
    'score',
    'checkedCandidates',
    'linkedSourceCandidates',
    'topLinkedUrl',
    'topCandidateUrl',
    'promptIds',
  ];
  return `${[
    headers.join(','),
    ...rows.map((row) =>
      [
        row.schoolId,
        row.schoolName,
        row.sourceSearchPromptRows,
        row.criticalPromptRows,
        row.identityConflictRows,
        unique(
          row.identityConflicts
            .map((conflict) => conflict.resolutionDisposition)
            .filter(isString),
        ).join('|'),
        unique(
          row.identityConflicts
            .map((conflict) => conflict.schoolIdentityRelation)
            .filter(isString),
        ).join('|'),
        row.sourceFamilyMismatchReview.reviewRows,
        row.campaignState,
        row.recommendedAction,
        row.score,
        row.validationSummary.checkedCandidates,
        row.validationSummary.linkedSourceCandidates,
        row.topLinkedCandidates[0]?.linkedUrl ?? '',
        row.topCandidateUrls[0] ?? '',
        row.promptSamples.map((prompt) => prompt.essayPromptId).join('|'),
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
        sourceSearchPromptRows: report.summary.sourceSearchPromptRows,
        emittedSchools: report.summary.emittedSchools,
        identityConflictPromptRows: report.summary.identityConflictPromptRows,
        sourceFamilyMismatchReviewPromptRows:
          report.summary.sourceFamilyMismatchReviewPromptRows,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
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

function groupBy<T>(rows: T[], keyFn: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return groups;
}

function countBy<T>(rows: T[], keyFn: (row: T) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = keyFn(row) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, '').toLowerCase();
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function emptyMismatchSummary(): CampaignRow['sourceFamilyMismatchReview'] {
  return {
    status: null,
    reviewRows: 0,
    blockedRows: 0,
    manualCheckedUrls: 0,
    manualValidatedSourceUrls: 0,
    officialContextNoPromptMatchUrls: 0,
    manualPromptMatchCount: 0,
    manualMatchedPromptRows: 0,
    sourceFamilyMismatchReview: false,
  };
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

main();
