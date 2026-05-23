#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'ESSAY_PROMPT_REVIEW_QUEUE_READY'
  | 'PASS_NO_ESSAY_PROMPT_REVIEW_ROWS'
  | 'BLOCKED_REVIEW_QUEUE_INPUTS_MISSING';

type QueueType =
  | 'identity_conflict_review'
  | 'source_family_mismatch_review'
  | 'validated_source_review'
  | 'validated_source_blocked';

interface Args {
  sourceSearchCampaign: string | null;
  sourceFamilyMismatchReviews: string[];
  sourceReviewStaging: string | null;
  sourceReviewApproval: string | null;
  sourceWritePlan: string | null;
  identityConflictResolution: string | null;
  out: string;
  markdown: string;
  csv: string;
  limit: number;
}

interface ClosureReport {
  generatedAt?: string;
  status?: string;
  summary?: Record<string, unknown>;
  nextCampaign?: Record<string, unknown>;
  rows?: any[];
}

interface ReviewQueueRow {
  queueId: string;
  queueType: QueueType;
  queueState: 'review' | 'blocked';
  releaseRiskScore: number;
  schoolId: string | null;
  schoolName: string | null;
  essayPromptId: string | null;
  applicationYear: number | null;
  severity: string;
  route: string | null;
  promptSnippet: string | null;
  sourceUrl: string | null;
  sourceQuality: string | null;
  evidenceSnippet: string | null;
  confidence: number | null;
  recommendedAction: string;
  primaryBlocker: string;
  consumerPolicy: Record<string, unknown>;
  requiredReviewerChecks: string[];
  prohibitedActions: string[];
  allowedOutcomes: string[];
  evidence: Record<string, unknown>;
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
      path.join(REPORT_ROOT, `essay-prompt-review-queue-${stamp}.json`),
    )!,
  );
  const sourceFamilyMismatchReviews = values(
    '--source-family-mismatch-review',
  ).map(resolveInputPath);
  return {
    sourceSearchCampaign: optionalInput(
      get('--source-search-campaign'),
      /^essay-prompt-source-search-campaign-.+\.json$/,
    ),
    sourceFamilyMismatchReviews:
      sourceFamilyMismatchReviews.length > 0
        ? sourceFamilyMismatchReviews
        : optionalInput(
              get('--source-family-mismatch-review'),
              /^essay-prompt-source-family-mismatch-review-.+\.json$/,
            )
          ? [
              optionalInput(
                get('--source-family-mismatch-review'),
                /^essay-prompt-source-family-mismatch-review-.+\.json$/,
              )!,
            ]
          : [],
    sourceReviewStaging: optionalInput(
      get('--source-review-staging'),
      /^essay-prompt-source-review-staging-.+\.json$/,
    ),
    sourceReviewApproval: optionalInput(
      get('--source-review-approval'),
      /^essay-prompt-source-review-approval-.+\.json$/,
    ),
    sourceWritePlan: optionalInput(
      get('--source-write-plan'),
      /^essay-prompt-source-write-plan-.+\.json$/,
    ),
    identityConflictResolution: optionalInput(
      get('--identity-conflict-resolution'),
      /^essay-prompt-identity-conflict-resolution-.+\.json$/,
    ),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    limit: Number(get('--limit', '1000')),
  };
}

function main() {
  const args = parseArgs();
  const sourceSearchCampaign = readOptionalReport(args.sourceSearchCampaign);
  const sourceReviewStaging = readOptionalReport(args.sourceReviewStaging);
  const sourceReviewApproval = readOptionalReport(args.sourceReviewApproval);
  const sourceWritePlan = readOptionalReport(args.sourceWritePlan);
  const identityConflictResolution = readOptionalReport(
    args.identityConflictResolution,
  );
  const sourceFamilyMismatchReports = args.sourceFamilyMismatchReviews
    .map(readOptionalReport)
    .filter((report): report is ClosureReport => Boolean(report));

  const rows = uniqueRows([
    ...buildIdentityRows(identityConflictResolution),
    ...sourceFamilyMismatchReports.flatMap(buildMismatchRows),
    ...buildValidatedRows(sourceReviewStaging),
  ])
    .sort(compareRows)
    .slice(0, args.limit);

  const missingInputs =
    !sourceReviewStaging &&
    sourceFamilyMismatchReports.length === 0 &&
    !identityConflictResolution;
  const summary = buildSummary(rows, {
    sourceSearchCampaign,
    sourceReviewStaging,
    sourceReviewApproval,
    sourceWritePlan,
    identityConflictResolution,
    sourceFamilyMismatchReports,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-review-queue',
    status: missingInputs
      ? ('BLOCKED_REVIEW_QUEUE_INPUTS_MISSING' satisfies PacketStatus)
      : rows.length === 0
        ? ('PASS_NO_ESSAY_PROMPT_REVIEW_ROWS' satisfies PacketStatus)
        : ('ESSAY_PROMPT_REVIEW_QUEUE_READY' satisfies PacketStatus),
    destructiveDbWriteAllowedByThisPlan: false,
    notificationAllowedByThisPlan: false,
    sourceArtifacts: {
      sourceSearchCampaign: args.sourceSearchCampaign,
      sourceFamilyMismatchReviews: args.sourceFamilyMismatchReviews,
      sourceReviewStaging: args.sourceReviewStaging,
      sourceReviewApproval: args.sourceReviewApproval,
      sourceWritePlan: args.sourceWritePlan,
      identityConflictResolution: args.identityConflictResolution,
    },
    reviewContract: {
      noDbWrites: true,
      noPromptReassignment: true,
      noPublicConsumerExposure: true,
      sourceApprovalRequires:
        'approved reviewer workflow plus source-family, cycle-year, raw snapshot, prompt-field, and no-conflict confirmations',
    },
    summary,
    nextCampaign: buildNextCampaign(rows, sourceSearchCampaign),
    rows,
  };

  writeReport(args, report);
  printSummary(args, report);
}

function buildIdentityRows(report: ClosureReport | null): ReviewQueueRow[] {
  return (report?.rows ?? []).map((row) => {
    const relation = stringValue(row.schoolIdentityRelation);
    const recommendedAction = stringValue(row.recommendedAction);
    return {
      queueId: `identity:${stringValue(row.essayPromptId)}`,
      queueType: 'identity_conflict_review',
      queueState: 'review',
      releaseRiskScore: relation === 'distinct_school_identity' ? 1000 : 870,
      schoolId: stringValue(row.assignedSchoolId),
      schoolName: stringValue(row.assignedSchoolName),
      essayPromptId: stringValue(row.essayPromptId),
      applicationYear: numberValue(row.year),
      severity: stringValue(row.severity) ?? 'critical',
      route: stringValue(row.sourcePromptRoute),
      promptSnippet: stringValue(row.evidence?.promptSnippet),
      sourceUrl: null,
      sourceQuality: null,
      evidenceSnippet: firstString(row.evidence?.evidenceSnippets),
      confidence: null,
      recommendedAction:
        recommendedAction ?? 'review-official-source-and-reassign-or-reject',
      primaryBlocker:
        stringValue(row.resolutionDisposition) ??
        'prompt-school identity conflict',
      consumerPolicy: objectValue(row.consumerPolicy),
      requiredReviewerChecks: stringList(row.requiredReviewerChecks),
      prohibitedActions: stringList(row.prohibitedActions),
      allowedOutcomes:
        relation === 'possible_duplicate_same_website_location'
          ? ['merge-school-rows', 'add-alias', 'keep-distinct-with-rationale']
          : ['reassign-prompt-owner', 'reject-prompt', 'keep-with-evidence'],
      evidence: {
        matchedSchoolId: stringValue(row.matchedSchoolId),
        matchedSchoolName: stringValue(row.matchedSchoolName),
        matchedTerms: arrayValue(row.matchedTerms),
        matchConfidence: stringValue(row.matchConfidence),
        schoolIdentityRelation: relation,
        correctionCandidate: row.correctionCandidate ?? null,
      },
    };
  });
}

function buildMismatchRows(report: ClosureReport): ReviewQueueRow[] {
  return (report.rows ?? []).map((row) => {
    const evidence = objectValue(row.candidateOnlyEvidence);
    const recommendedAction =
      stringValue(row.recommendedAction) ??
      'review-prompt-owner-and-reject-reassign-or-terminalize';
    const disposition =
      stringValue(row.mismatchDisposition) ?? 'review_prompt_owner_or_reject';
    const crossSchool =
      disposition.includes('cross_school') ||
      recommendedAction.includes('cross-school');
    return {
      queueId: `mismatch:${stringValue(row.essayPromptId)}`,
      queueType: 'source_family_mismatch_review',
      queueState: 'review',
      releaseRiskScore: crossSchool
        ? 950
        : stringValue(row.severity) === 'critical'
          ? 760
          : 640,
      schoolId: stringValue(row.schoolId),
      schoolName: stringValue(row.schoolName),
      essayPromptId: stringValue(row.essayPromptId),
      applicationYear: numberValue(report.summary?.applicationYear),
      severity: stringValue(row.severity) ?? 'critical',
      route: stringValue(row.route),
      promptSnippet: stringValue(row.promptSnippet),
      sourceUrl: firstString(evidence.checkedUrls),
      sourceQuality:
        Number(evidence.officialContextNoPromptMatchUrls ?? 0) > 0
          ? 'official-context-no-match'
          : 'candidate-only',
      evidenceSnippet: firstString(evidence.evidenceSnippets),
      confidence: null,
      recommendedAction,
      primaryBlocker: disposition,
      consumerPolicy: objectValue(row.consumerPolicy),
      requiredReviewerChecks: stringList(row.requiredReviewerChecks),
      prohibitedActions: stringList(row.prohibitedActions),
      allowedOutcomes: [
        'reject-prompt',
        'reassign-prompt-owner',
        'mark-terminal',
        'approve-only-with-new-official-evidence',
      ],
      evidence: {
        checkedUrls: arrayValue(evidence.checkedUrls),
        finalUrls: arrayValue(evidence.finalUrls),
        trustedValidatedSourceUrls: arrayValue(
          evidence.trustedValidatedSourceUrls,
        ),
        untrustedValidatedSourceUrls: arrayValue(
          evidence.untrustedValidatedSourceUrls,
        ),
        crossSchoolPromptMatchSourceUrls: arrayValue(
          evidence.crossSchoolPromptMatchSourceUrls,
        ),
        promptLanguageSignals: arrayValue(evidence.promptLanguageSignals),
        cycleSignals: arrayValue(evidence.cycleSignals),
        officialContextNoPromptMatchUrls:
          numberValue(evidence.officialContextNoPromptMatchUrls) ?? 0,
        promptMatchCount: numberValue(evidence.promptMatchCount) ?? 0,
        sourceArtifactStatus: report.status ?? null,
      },
    };
  });
}

function buildValidatedRows(report: ClosureReport | null): ReviewQueueRow[] {
  return (report?.rows ?? []).flatMap((row) => {
    const sourceRowCandidates = Array.isArray(row.sourceRowCandidates)
      ? row.sourceRowCandidates
      : [];
    return sourceRowCandidates.map((candidate: any) => {
      const accepted = Boolean(row.acceptedForReviewerQueue);
      const blockerReasons = stringList(row.blockerReasons);
      return {
        queueId: `validated:${stringValue(candidate.essayPromptId)}:${stringValue(row.sourceUrl)}`,
        queueType: accepted
          ? 'validated_source_review'
          : 'validated_source_blocked',
        queueState: accepted ? 'review' : 'blocked',
        releaseRiskScore: accepted ? 520 : 690,
        schoolId: stringValue(candidate.schoolId ?? row.schoolId),
        schoolName: stringValue(candidate.schoolName ?? row.schoolName),
        essayPromptId: stringValue(candidate.essayPromptId),
        applicationYear: numberValue(
          candidate.applicationYear ?? row.applicationYear,
        ),
        severity: accepted ? 'critical' : 'warning',
        route: candidate.essayPromptId
          ? `/admin/essay-prompts/${candidate.essayPromptId}`
          : null,
        promptSnippet: stringValue(candidate.promptSnippet),
        sourceUrl: stringValue(row.sourceUrl),
        sourceQuality: stringValue(row.sourceQuality),
        evidenceSnippet: stringValue(candidate.evidenceSnippet),
        confidence: numberValue(candidate.confidence),
        recommendedAction: accepted
          ? 'review-validated-source-before-write'
          : 'resolve-staging-blockers-before-review',
        primaryBlocker: accepted
          ? 'validated source candidate needs human approval'
          : blockerReasons.join('; ') || 'staging blocker',
        consumerPolicy: {
          publicEssayPrompts: 'hide_until_source_row_written_and_reviewed',
          timelineTasks: 'hide_until_source_row_written_and_reviewed',
          chatContext: 'do_not_quote_prompt_without_approved_source',
          adminReview: accepted
            ? 'show_validated_source_candidate'
            : 'show_staging_blockers',
        },
        requiredReviewerChecks: [
          'source family belongs to assigned school and prompt type',
          'application cycle and effective year are correct',
          'raw source snapshot hash is reviewed',
          'prompt text, required/optional status, and word limit are confirmed',
          'duplicate canonical prompt groups are resolved before approval',
        ],
        prohibitedActions: [
          'do not write EssayPromptSource until approval gate passes',
          'do not publish prompt to public/timeline/chat consumers before write',
          'do not override staging blockers without reviewer rationale',
        ],
        allowedOutcomes: accepted
          ? [
              'approve-source-row',
              'reject-source-candidate',
              'request-more-evidence',
            ]
          : ['find-official-source', 'fix-staging-blocker', 'reject-candidate'],
        evidence: {
          finalUrl: stringValue(row.finalUrl),
          sourceType: stringValue(row.sourceType),
          candidateDepth: numberValue(row.candidateDepth),
          parentSourceUrl: stringValue(row.parentSourceUrl),
          snapshotTextSha256: stringValue(row.snapshotTextSha256),
          rawContentSha256: stringValue(candidate.rawContentSha256),
          snapshotBytesRead: numberValue(row.snapshotBytesRead),
          promptMatchCount: numberValue(row.promptMatchCount),
          cycleSignals: arrayValue(row.cycleSignals),
          promptLanguageSignals: arrayValue(row.promptLanguageSignals),
          blockerReasons,
          reviewFlags: [
            ...stringList(row.reviewFlags),
            ...stringList(candidate.reviewFlags),
          ],
          matchKind: stringValue(candidate.matchKind),
          canonicalPromptKey: stringValue(candidate.canonicalPromptKey),
        },
      };
    });
  });
}

function uniqueRows(rows: ReviewQueueRow[]) {
  const seen = new Set<string>();
  const unique: ReviewQueueRow[] = [];
  for (const row of rows) {
    if (seen.has(row.queueId)) continue;
    seen.add(row.queueId);
    unique.push(row);
  }
  return unique;
}

function compareRows(a: ReviewQueueRow, b: ReviewQueueRow) {
  if (b.releaseRiskScore !== a.releaseRiskScore) {
    return b.releaseRiskScore - a.releaseRiskScore;
  }
  return (a.schoolName ?? '').localeCompare(b.schoolName ?? '');
}

function buildSummary(
  rows: ReviewQueueRow[],
  artifacts: {
    sourceSearchCampaign: ClosureReport | null;
    sourceReviewStaging: ClosureReport | null;
    sourceReviewApproval: ClosureReport | null;
    sourceWritePlan: ClosureReport | null;
    identityConflictResolution: ClosureReport | null;
    sourceFamilyMismatchReports: ClosureReport[];
  },
) {
  const byQueueType = countBy(rows, (row) => row.queueType);
  const byQueueState = countBy(rows, (row) => row.queueState);
  const byRecommendedAction = countBy(rows, (row) => row.recommendedAction);
  const bySourceQuality = countBy(rows, (row) => row.sourceQuality ?? 'none');
  const bySchool = countBy(rows, (row) => row.schoolName ?? 'unknown');
  const schools = new Set(rows.map((row) => row.schoolId).filter(Boolean));
  const promptIds = new Set(
    rows.map((row) => row.essayPromptId).filter(Boolean),
  );
  const topSchools = Object.entries(bySchool)
    .map(([schoolName, rowCount]) => ({ schoolName, rowCount }))
    .sort(
      (a, b) =>
        b.rowCount - a.rowCount || a.schoolName.localeCompare(b.schoolName),
    )
    .slice(0, 15);
  return {
    reviewQueueRows: rows.length,
    schoolsWithReviewRows: schools.size,
    promptIds: promptIds.size,
    sourceFamilyMismatchRows: byQueueType.source_family_mismatch_review ?? 0,
    validatedSourceReviewRows: byQueueType.validated_source_review ?? 0,
    validatedSourceBlockedRows: byQueueType.validated_source_blocked ?? 0,
    identityConflictRows: byQueueType.identity_conflict_review ?? 0,
    blockedRows: byQueueState.blocked ?? 0,
    reviewRows: byQueueState.review ?? 0,
    allRowsHaveConsumerPolicy: rows.every(
      (row) => Object.keys(row.consumerPolicy).length > 0,
    ),
    byQueueType,
    byQueueState,
    byRecommendedAction,
    bySourceQuality,
    topSchools,
    sourceSearchCampaignStatus: artifacts.sourceSearchCampaign?.status ?? null,
    sourceSearchRemainingActions:
      artifacts.sourceSearchCampaign?.summary?.byRecommendedAction ?? null,
    sourceReviewStagingStatus: artifacts.sourceReviewStaging?.status ?? null,
    sourceReviewStagingSummary: artifacts.sourceReviewStaging?.summary ?? null,
    sourceReviewApprovalStatus: artifacts.sourceReviewApproval?.status ?? null,
    sourceWritePlanStatus: artifacts.sourceWritePlan?.status ?? null,
    identityConflictResolutionStatus:
      artifacts.identityConflictResolution?.status ?? null,
    sourceFamilyMismatchArtifactCount:
      artifacts.sourceFamilyMismatchReports.length,
  };
}

function buildNextCampaign(
  rows: ReviewQueueRow[],
  sourceSearchCampaign: ClosureReport | null,
) {
  const top = rows[0];
  if (!top) {
    return {
      id: 'essay_prompt_review_queue_monitor',
      reason:
        'No essay prompt review rows were emitted; continue source-search and disposition monitoring.',
      sourceSearchNextCampaign: sourceSearchCampaign?.nextCampaign ?? null,
    };
  }
  return {
    id: 'essay_prompt_review_queue',
    reason: `${top.schoolName ?? 'Unknown school'} has the highest-risk ${top.queueType} row requiring ${top.recommendedAction}.`,
    schoolId: top.schoolId,
    schoolName: top.schoolName,
    essayPromptId: top.essayPromptId,
    queueType: top.queueType,
    recommendedAction: top.recommendedAction,
    releaseRiskScore: top.releaseRiskScore,
  };
}

function writeReport(args: Args, report: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report));
  fs.writeFileSync(args.csv, renderCsv(report.rows as ReviewQueueRow[]));
}

function renderMarkdown(report: Record<string, unknown>) {
  const summary = objectValue(report.summary);
  const nextCampaign = objectValue(report.nextCampaign);
  const rows = Array.isArray(report.rows)
    ? (report.rows as ReviewQueueRow[])
    : [];
  const lines = [
    '# Essay Prompt Review Queue',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Review rows: ${summary.reviewQueueRows ?? 0}`,
    `- Blocked rows: ${summary.blockedRows ?? 0}`,
    `- Schools: ${summary.schoolsWithReviewRows ?? 0}`,
    `- Prompt IDs: ${summary.promptIds ?? 0}`,
    `- Next campaign: ${nextCampaign.reason ?? 'none'}`,
    '',
    '## Queue Summary',
    '',
    `- Source-family mismatch rows: ${summary.sourceFamilyMismatchRows ?? 0}`,
    `- Validated source review rows: ${summary.validatedSourceReviewRows ?? 0}`,
    `- Validated source blocked rows: ${summary.validatedSourceBlockedRows ?? 0}`,
    `- Identity conflict rows: ${summary.identityConflictRows ?? 0}`,
    `- Source review approval status: ${summary.sourceReviewApprovalStatus ?? 'unknown'}`,
    `- Source write plan status: ${summary.sourceWritePlanStatus ?? 'unknown'}`,
    '',
    '## Top Rows',
    '',
    '| Risk | Queue | School | Prompt | Action | Blocker |',
    '| ---: | --- | --- | --- | --- | --- |',
    ...rows
      .slice(0, 40)
      .map((row) =>
        [
          row.releaseRiskScore,
          row.queueType,
          row.schoolName ?? '',
          truncate(row.promptSnippet ?? row.essayPromptId ?? '', 80),
          row.recommendedAction,
          truncate(row.primaryBlocker, 80),
        ]
          .map(markdownCell)
          .join(' | '),
      )
      .map((line) => `| ${line} |`),
  ];
  return `${lines.join('\n')}\n`;
}

function renderCsv(rows: ReviewQueueRow[]) {
  const header = [
    'queueId',
    'queueType',
    'queueState',
    'releaseRiskScore',
    'schoolId',
    'schoolName',
    'essayPromptId',
    'applicationYear',
    'severity',
    'route',
    'sourceUrl',
    'sourceQuality',
    'confidence',
    'recommendedAction',
    'primaryBlocker',
    'promptSnippet',
    'evidenceSnippet',
  ];
  return `${[
    header.join(','),
    ...rows.map((row) =>
      header
        .map((key) => csvCell((row as unknown as Record<string, unknown>)[key]))
        .join(','),
    ),
  ].join('\n')}\n`;
}

function printSummary(args: Args, report: Record<string, unknown>) {
  const summary = objectValue(report.summary);
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        csv: args.csv,
        reviewQueueRows: summary.reviewQueueRows ?? 0,
        blockedRows: summary.blockedRows ?? 0,
        sourceFamilyMismatchRows: summary.sourceFamilyMismatchRows ?? 0,
        validatedSourceReviewRows: summary.validatedSourceReviewRows ?? 0,
        identityConflictRows: summary.identityConflictRows ?? 0,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

function optionalInput(value: string | undefined, pattern: RegExp) {
  return value ? resolveInputPath(value) : findLatest(pattern);
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
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return latest ? path.join(REPORT_ROOT, latest.file) : null;
}

function readOptionalReport(reportPath: string | null): ClosureReport | null {
  if (!reportPath || !fs.existsSync(reportPath)) return null;
  return JSON.parse(fs.readFileSync(reportPath, 'utf8')) as ClosureReport;
}

function resolveInputPath(inputPath: string) {
  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(API_ROOT, inputPath);
}

function countBy<T>(values: T[], keyFor: (value: T) => string) {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = keyFor(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function firstString(value: unknown) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return null;
  return value.find((item): item is string => typeof item === 'string') ?? null;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 3))}...`
    : value;
}

function markdownCell(value: unknown) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
}

function csvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

main();
