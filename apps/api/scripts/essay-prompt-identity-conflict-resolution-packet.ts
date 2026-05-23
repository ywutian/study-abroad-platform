#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'ESSAY_PROMPT_IDENTITY_CONFLICT_RESOLUTION_READY'
  | 'PASS_NO_IDENTITY_CONFLICTS'
  | 'BLOCKED_IDENTITY_CONFLICT_PACKET_MISSING';

type ResolutionDisposition =
  | 'conflict_reassign_candidate'
  | 'conflict_source_verification_required'
  | 'review_duplicate_school_identity_candidate'
  | 'review_benign_cross_school_context';

interface Args {
  identityConflicts: string | null;
  out: string;
  markdown: string;
  csv: string;
  limit: number;
}

interface IdentityConflictReport {
  generatedAt?: string;
  status?: string;
  applicationYear?: number;
  summary?: Record<string, unknown>;
  rows?: IdentityConflictRow[];
}

interface IdentityConflictRow {
  essayPromptId: string;
  assignedSchoolId: string;
  assignedSchoolName: string;
  matchedSchoolId: string;
  matchedSchoolName: string;
  year: number;
  status: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  closureState: 'conflict' | 'review';
  disposition: string;
  matchedTerm: string;
  matchedTermSource: 'name' | 'alias' | 'derived';
  matchConfidence: 'high' | 'medium';
  evidenceSnippet: string;
  promptSnippet: string;
  hasSourceRows: boolean;
  sourceUrls: string[];
  ownSchoolMentioned: boolean;
  schoolIdentityRelation?:
    | 'possible_duplicate_same_website_location'
    | 'possible_duplicate_same_website'
    | 'distinct_school_identity';
  schoolIdentityRelationSignals?: string[];
  route: string;
  recommendedAction: string;
}

interface ResolutionRow {
  essayPromptId: string;
  year: number;
  type: string;
  status: string;
  assignedSchoolId: string;
  assignedSchoolName: string;
  matchedSchoolId: string;
  matchedSchoolName: string;
  matchedTerms: string[];
  matchConfidence: 'high' | 'medium';
  sourcePromptRoute: string;
  severity: 'critical' | 'warning' | 'info';
  closureState: 'conflict' | 'review';
  schoolIdentityRelation:
    | 'possible_duplicate_same_website_location'
    | 'possible_duplicate_same_website'
    | 'distinct_school_identity'
    | 'unknown';
  schoolIdentityRelationSignals: string[];
  resolutionDisposition: ResolutionDisposition;
  reviewerQueue: 'essay_prompt_identity_conflict_review';
  recommendedAction: string;
  correctionCandidate: CorrectionCandidate | null;
  consumerPolicy: {
    publicEssayPrompts: 'hide_until_source_and_identity_resolved';
    timelineTasks: 'hide_until_source_and_identity_resolved';
    adminReview: 'show_conflict_with_evidence';
    chatContext: 'do_not_use_as_school_fact';
  };
  requiredReviewerChecks: string[];
  prohibitedActions: string[];
  evidence: {
    promptSnippet: string;
    evidenceSnippets: string[];
    hasSourceRows: boolean;
    sourceUrls: string[];
    ownSchoolMentioned: boolean;
  };
}

interface CorrectionCandidate {
  type: 'reassign_prompt_to_matched_school';
  targetSchoolId: string;
  targetSchoolName: string;
  confidence: 'candidate_only';
  reason: string;
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
        `essay-prompt-identity-conflict-resolution-${stamp}.json`,
      ),
    )!,
  );
  const identityConflicts = get('--identity-conflicts');
  return {
    identityConflicts: identityConflicts
      ? path.resolve(API_ROOT, identityConflicts)
      : findLatest(/^essay-prompt-identity-conflicts-.+\.json$/),
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
  if (!args.identityConflicts || !fs.existsSync(args.identityConflicts)) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-essay-prompt-identity-conflict-resolution',
      status: 'BLOCKED_IDENTITY_CONFLICT_PACKET_MISSING' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      identityConflicts: args.identityConflicts,
      summary: {
        identityConflictRows: 0,
        emittedRows: 0,
        allRowsHaveDisposition: false,
        blockedRows: 1,
      },
      nextCampaign: {
        id: 'essay_prompt_identity_conflict_detection',
        reason:
          'Run audit:essay-prompt-identity-conflicts before building the resolution packet.',
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    return;
  }

  const source = JSON.parse(
    fs.readFileSync(args.identityConflicts, 'utf8'),
  ) as IdentityConflictReport;
  const sourceRows = source.rows ?? [];
  const rows = groupRows(sourceRows).map(toResolutionRow).slice(0, args.limit);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-identity-conflict-resolution',
    status: (rows.length > 0
      ? 'ESSAY_PROMPT_IDENTITY_CONFLICT_RESOLUTION_READY'
      : 'PASS_NO_IDENTITY_CONFLICTS') satisfies PacketStatus,
    destructiveDbWriteAllowedByThisPlan: false,
    identityConflicts: path.relative(API_ROOT, args.identityConflicts),
    identityConflictsGeneratedAt: source.generatedAt ?? null,
    identityConflictsStatus: source.status ?? null,
    applicationYear: source.applicationYear ?? null,
    limits: {
      requestedRows: args.limit,
      emittedRows: rows.length,
    },
    summary: {
      identityConflictRows: sourceRows.length,
      emittedRows: rows.length,
      allRowsHaveDisposition: true,
      blockedRows: 0,
      conflictRows: rows.filter((row) => row.closureState === 'conflict')
        .length,
      reviewRows: rows.filter((row) => row.closureState === 'review').length,
      correctionCandidateRows: rows.filter((row) => row.correctionCandidate)
        .length,
      byResolutionDisposition: countBy(
        rows,
        (row) => row.resolutionDisposition,
      ),
      bySchoolIdentityRelation: countBy(
        rows,
        (row) => row.schoolIdentityRelation,
      ),
      byAssignedSchool: countBy(rows, (row) => row.assignedSchoolName),
      byMatchedSchool: countBy(rows, (row) => row.matchedSchoolName),
      byRecommendedAction: countBy(rows, (row) => row.recommendedAction),
    },
    reviewContract: {
      candidateEvidenceStatus: 'identity_conflict_resolution_candidate',
      resolutionPacketDoesNotWriteDb: true,
      resolutionPacketDoesNotApproveFacts: true,
      acceptedResolutionRequires: [
        'reviewer confirms official prompt source for assigned school or matched school',
        'reviewer confirms whether the prompt should be reassigned, corrected, rejected, or marked benign',
        'reviewer records workflow ID, source URL, raw evidence hash, and rationale before any DB write',
      ],
      prohibitedActions: [
        'do not reassign EssayPrompt.schoolId from this packet alone',
        'do not create EssayPromptSource rows from identity conflict evidence alone',
        'do not expose conflicted source-less prompts to public essay/timeline/chat consumers',
      ],
    },
    nextCampaign: buildNextCampaign(rows),
    rows,
  };
  writeReport(args, report);
  printSummary(args, report);
}

function groupRows(rows: IdentityConflictRow[]) {
  const byPrompt = new Map<string, IdentityConflictRow[]>();
  for (const row of rows) {
    byPrompt.set(row.essayPromptId, [
      ...(byPrompt.get(row.essayPromptId) ?? []),
      row,
    ]);
  }
  return Array.from(byPrompt.values()).sort(compareGroups);
}

function toResolutionRow(rows: IdentityConflictRow[]): ResolutionRow {
  const sorted = rows.slice().sort(compareConflictRows);
  const primary = sorted[0];
  const resolutionDisposition = chooseDisposition(primary);
  return {
    essayPromptId: primary.essayPromptId,
    year: primary.year,
    type: primary.type,
    status: primary.status,
    assignedSchoolId: primary.assignedSchoolId,
    assignedSchoolName: primary.assignedSchoolName,
    matchedSchoolId: primary.matchedSchoolId,
    matchedSchoolName: primary.matchedSchoolName,
    matchedTerms: Array.from(new Set(sorted.map((row) => row.matchedTerm))),
    matchConfidence: primary.matchConfidence,
    sourcePromptRoute: primary.route,
    severity: primary.severity,
    closureState: primary.closureState,
    schoolIdentityRelation: primary.schoolIdentityRelation ?? 'unknown',
    schoolIdentityRelationSignals: Array.from(
      new Set(sorted.flatMap((row) => row.schoolIdentityRelationSignals ?? [])),
    ),
    resolutionDisposition,
    reviewerQueue: 'essay_prompt_identity_conflict_review',
    recommendedAction: recommendedAction(resolutionDisposition),
    correctionCandidate: buildCorrectionCandidate(
      primary,
      resolutionDisposition,
    ),
    consumerPolicy: {
      publicEssayPrompts: 'hide_until_source_and_identity_resolved',
      timelineTasks: 'hide_until_source_and_identity_resolved',
      adminReview: 'show_conflict_with_evidence',
      chatContext: 'do_not_use_as_school_fact',
    },
    requiredReviewerChecks: requiredReviewerChecks(resolutionDisposition),
    prohibitedActions: [
      'do not approve source rows until prompt-school identity is resolved',
      'do not use this prompt in timeline/chat/public essay consumers while source-less and conflicted',
      'do not infer the correct school without official source evidence',
    ],
    evidence: {
      promptSnippet: primary.promptSnippet,
      evidenceSnippets: Array.from(
        new Set(sorted.map((row) => row.evidenceSnippet)),
      ),
      hasSourceRows: sorted.some((row) => row.hasSourceRows),
      sourceUrls: Array.from(sorted.flatMap((row) => row.sourceUrls ?? [])),
      ownSchoolMentioned: sorted.some((row) => row.ownSchoolMentioned),
    },
  };
}

function chooseDisposition(row: IdentityConflictRow): ResolutionDisposition {
  if (
    row.closureState === 'conflict' &&
    (row.schoolIdentityRelation ===
      'possible_duplicate_same_website_location' ||
      row.schoolIdentityRelation === 'possible_duplicate_same_website')
  ) {
    return 'review_duplicate_school_identity_candidate';
  }
  if (
    row.closureState === 'conflict' &&
    row.matchConfidence === 'high' &&
    !row.ownSchoolMentioned
  ) {
    return 'conflict_reassign_candidate';
  }
  if (row.closureState === 'conflict') {
    return 'conflict_source_verification_required';
  }
  return 'review_benign_cross_school_context';
}

function recommendedAction(disposition: ResolutionDisposition) {
  switch (disposition) {
    case 'conflict_reassign_candidate':
      return 'review-official-source-and-reassign-or-reject';
    case 'conflict_source_verification_required':
      return 'review-official-source-before-source-approval';
    case 'review_duplicate_school_identity_candidate':
      return 'review-merge-school-rows-or-add-alias-before-source-approval';
    case 'review_benign_cross_school_context':
      return 'review-benign-context-with-rationale';
  }
}

function buildCorrectionCandidate(
  row: IdentityConflictRow,
  disposition: ResolutionDisposition,
): CorrectionCandidate | null {
  if (disposition === 'review_duplicate_school_identity_candidate') return null;
  if (disposition !== 'conflict_reassign_candidate') return null;
  return {
    type: 'reassign_prompt_to_matched_school',
    targetSchoolId: row.matchedSchoolId,
    targetSchoolName: row.matchedSchoolName,
    confidence: 'candidate_only',
    reason: `Prompt text mentions ${row.matchedSchoolName} via "${row.matchedTerm}" and does not mention the assigned school identity.`,
  };
}

function requiredReviewerChecks(disposition: ResolutionDisposition) {
  const checks = [
    'official source URL for the prompt owner is captured',
    'raw source snapshot/hash is captured',
    'application year and prompt text match are confirmed',
    'reviewer workflow ID and rationale are recorded',
  ];
  if (disposition === 'conflict_reassign_candidate') {
    checks.push(
      'matched school ownership is confirmed before any reassignment candidate is applied',
    );
  }
  if (disposition === 'review_duplicate_school_identity_candidate') {
    checks.push(
      'reviewer confirms whether the assigned and matched school rows represent the same institution',
      'reviewer records whether to merge school rows, add aliases, or keep distinct identities',
      'prompt ownership is not reassigned until school identity cleanup is resolved',
    );
  }
  if (disposition === 'review_benign_cross_school_context') {
    checks.push('benign mention rationale is recorded before closing review');
  }
  return checks;
}

function compareGroups(a: IdentityConflictRow[], b: IdentityConflictRow[]) {
  return compareConflictRows(
    a.slice().sort(compareConflictRows)[0],
    b.slice().sort(compareConflictRows)[0],
  );
}

function compareConflictRows(a: IdentityConflictRow, b: IdentityConflictRow) {
  return (
    severityWeight(b.severity) - severityWeight(a.severity) ||
    closureWeight(b.closureState) - closureWeight(a.closureState) ||
    confidenceWeight(b.matchConfidence) - confidenceWeight(a.matchConfidence) ||
    a.assignedSchoolName.localeCompare(b.assignedSchoolName) ||
    a.matchedSchoolName.localeCompare(b.matchedSchoolName)
  );
}

function severityWeight(severity: IdentityConflictRow['severity']) {
  if (severity === 'critical') return 5;
  if (severity === 'warning') return 3;
  return 1;
}

function closureWeight(state: IdentityConflictRow['closureState']) {
  return state === 'conflict' ? 2 : 1;
}

function confidenceWeight(confidence: IdentityConflictRow['matchConfidence']) {
  return confidence === 'high' ? 2 : 1;
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = getKey(row) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function buildNextCampaign(rows: ResolutionRow[]) {
  const top = rows[0];
  if (!top) {
    return {
      id: 'essay_prompt_source_validation_continue',
      reason:
        'No identity conflicts require resolution; continue source validation and source-row review.',
    };
  }
  return {
    id: 'essay_prompt_identity_conflict_reviewer_queue',
    reason: `${top.assignedSchoolName} prompt has a ${top.resolutionDisposition} row; reviewer must resolve identity before source approval.`,
    essayPromptId: top.essayPromptId,
    assignedSchoolId: top.assignedSchoolId,
    assignedSchoolName: top.assignedSchoolName,
    matchedSchoolId: top.matchedSchoolId,
    matchedSchoolName: top.matchedSchoolName,
    recommendedAction: top.recommendedAction,
  };
}

function writeReport(args: Args, report: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report as any));
  fs.writeFileSync(args.csv, renderCsv((report as any).rows ?? []));

  if (args.out.startsWith(REPORT_ROOT)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportBase = path.join(
    REPORT_ROOT,
    `essay-prompt-identity-conflict-resolution-${stamp}`,
  );
  fs.mkdirSync(REPORT_ROOT, { recursive: true });
  fs.writeFileSync(
    `${reportBase}.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  fs.writeFileSync(`${reportBase}.md`, renderMarkdown(report as any));
  fs.writeFileSync(`${reportBase}.csv`, renderCsv((report as any).rows ?? []));
}

function renderMarkdown(report: {
  generatedAt: string;
  status: string;
  summary: Record<string, unknown>;
  nextCampaign: Record<string, unknown>;
  rows: ResolutionRow[];
}) {
  return [
    '# Essay Prompt Identity Conflict Resolution Packet',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Identity conflict rows: ${report.summary.identityConflictRows}`,
    `- Resolution rows: ${report.summary.emittedRows}`,
    `- Correction candidates: ${report.summary.correctionCandidateRows}`,
    `- Blocked rows: ${report.summary.blockedRows}`,
    '',
    '## Next Campaign',
    '',
    `- ${report.nextCampaign.reason ?? 'Continue essay prompt source closure.'}`,
    '',
    '## Reviewer Queue',
    '',
    report.rows.length === 0
      ? '- None'
      : report.rows
          .slice(0, 30)
          .map(
            (row) =>
              `- ${row.severity.toUpperCase()} ${row.assignedSchoolName} -> ${row.matchedSchoolName}: ${row.resolutionDisposition} (${row.recommendedAction})`,
          )
          .join('\n'),
    '',
    '## Review Contract',
    '',
    '- This packet is read-only and does not reassign, reject, approve, or write prompt data.',
    '- Public essay, timeline, and chat consumers must keep conflicted source-less prompts hidden.',
    '- Reviewers must attach official source evidence and workflow rationale before any correction.',
    '',
  ].join('\n');
}

function renderCsv(rows: ResolutionRow[]) {
  const headers = [
    'essayPromptId',
    'assignedSchoolName',
    'matchedSchoolName',
    'year',
    'status',
    'type',
    'severity',
    'closureState',
    'resolutionDisposition',
    'recommendedAction',
    'sourcePromptRoute',
  ];
  return [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => csvCell((row as any)[header])).join(','),
    ),
  ].join('\n');
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

function printSummary(
  args: Args,
  report: {
    status: string;
    summary: Record<string, unknown>;
    nextCampaign: Record<string, unknown>;
  },
) {
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        csv: args.csv,
        resolutionRows: report.summary.emittedRows,
        correctionCandidates: report.summary.correctionCandidateRows,
        blockedRows: report.summary.blockedRows,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
