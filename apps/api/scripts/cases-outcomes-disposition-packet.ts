#!/usr/bin/env tsx
import 'dotenv/config';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type PacketStatus =
  | 'CASES_OUTCOMES_DISPOSITION_READY'
  | 'BLOCKED_UNMAPPED_CASE_OUTCOME_ROWS'
  | 'BLOCKED_DB_QUERY_FAILED';
type ClosureState =
  | 'trusted'
  | 'review'
  | 'diagnostic'
  | 'terminal'
  | 'conflict';
type RowType =
  | 'admission_case'
  | 'outcome_label'
  | 'verification_request'
  | 'prediction_feedback';
type NextAction =
  | 'accept'
  | 'review'
  | 'request-evidence'
  | 'diagnostic-only'
  | 'mark-terminal'
  | 'block-release';
type SourceQuality =
  | 'verified_user_proof_or_admin'
  | 'reviewed_admin_or_import'
  | 'user_self_reported'
  | 'imported_or_public_candidate'
  | 'platform_feedback'
  | 'unknown';
type ProvenanceStatus =
  | 'verified'
  | 'evidence_url'
  | 'evidence_proxy'
  | 'review_metadata'
  | 'missing';

interface Args {
  out: string;
  markdown: string;
  csv: string;
  limitCases: number;
  limitLabels: number;
  limitVerificationRequests: number;
  limitFeedback: number;
  salt: string | null;
}

interface DispositionRow {
  rowType: RowType;
  subjectKey: string;
  userKey?: string;
  caseKey?: string;
  predictionResultKey?: string;
  schoolId?: string | null;
  schoolName?: string | null;
  applicationYear?: number | null;
  round?: string | null;
  result?: string | null;
  reviewStatus?: string | null;
  verificationStatus?: string | null;
  outcomeLabelStatus?: string | null;
  feedbackSentiment?: string | null;
  feedbackCategory?: string | null;
  visibility?: string | null;
  qualityScore?: number | null;
  disposition: string;
  closureState: ClosureState;
  nextAction: NextAction;
  sourceQuality: SourceQuality;
  provenanceStatus: ProvenanceStatus;
  hasSourceUrlOrName: boolean;
  hasEvidenceUrl: boolean;
  hasProofUrl: boolean;
  hasVerificationMetadata: boolean;
  hasEssayContent: boolean;
  consumerPolicy: string;
  evidence: string[];
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const VERIFIED_LABEL_STATUSES = new Set([
  'COUNSELOR_VERIFIED',
  'DOCUMENT_VERIFIED',
]);
const TERMINAL_LABEL_STATUSES = new Set(['REJECTED', 'CENSORED']);

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
      path.join(REPORT_ROOT, `cases-outcomes-disposition-${stamp}.json`),
    )!,
  );
  return {
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    limitCases: Number(get('--limit-cases', '2000')),
    limitLabels: Number(get('--limit-labels', '2000')),
    limitVerificationRequests: Number(
      get('--limit-verification-requests', '2000'),
    ),
    limitFeedback: Number(get('--limit-feedback', '2000')),
    salt: get('--salt') ?? null,
  };
}

async function main() {
  const args = parseArgs();
  const prisma = new PrismaClient();
  try {
    const report = await buildReport(prisma, args);
    writeReport(args, report);
    printSummary(args, report);
  } catch (error) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-cases-outcomes-disposition',
      status: 'BLOCKED_DB_QUERY_FAILED' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      prohibitedAutoCalibration: true,
      error: error instanceof Error ? error.message : String(error),
      summary: {
        allRowsHaveDisposition: false,
        unmappedRows: 0,
        blockedRows: 1,
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

async function buildReport(prisma: PrismaClient, args: Args) {
  const salt = args.salt ?? `cases-outcomes:${new Date().toISOString()}`;
  const [
    totalCases,
    verifiedCases,
    casesWithEvidence,
    totalLabels,
    labelsWithEvidence,
    totalVerificationRequests,
    totalFeedback,
    cases,
    labels,
    verificationRequests,
    feedback,
  ] = await Promise.all([
    prisma.admissionCase.count(),
    prisma.admissionCase.count({ where: { isVerified: true } }),
    prisma.admissionCase.count({
      where: {
        OR: [
          { source: { not: null } },
          { importBatchId: { not: null } },
          { reviewedAt: { not: null } },
          { isVerified: true },
          { verifiedAt: { not: null } },
          { essayContent: { not: null } },
          { verificationRequests: { some: {} } },
        ],
      },
    }),
    prisma.predictionOutcomeLabelRecord.count(),
    prisma.predictionOutcomeLabelRecord.count({
      where: { evidenceUrl: { not: null } },
    }),
    prisma.verificationRequest.count(),
    prisma.predictionFeedback.count(),
    prisma.admissionCase.findMany({
      take: args.limitCases,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        userId: true,
        schoolId: true,
        school: { select: { name: true } },
        year: true,
        round: true,
        result: true,
        major: true,
        visibility: true,
        qualityScore: true,
        reviewStatus: true,
        source: true,
        importBatchId: true,
        isVerified: true,
        verifiedAt: true,
        reviewedAt: true,
        essayPrompt: true,
        essayContent: true,
        createdAt: true,
        updatedAt: true,
        verificationRequests: {
          select: {
            id: true,
            status: true,
            proofType: true,
            proofUrl: true,
            reviewedAt: true,
            createdAt: true,
          },
        },
        _count: { select: { views: true, verificationRequests: true } },
      },
    }),
    prisma.predictionOutcomeLabelRecord.findMany({
      take: args.limitLabels,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        predictionResultId: true,
        result: true,
        status: true,
        evidenceUrl: true,
        round: true,
        isFinal: true,
        reportedBy: true,
        resolvedBy: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        predictionResult: {
          select: {
            schoolId: true,
            applicationYear: true,
            applicationRound: true,
            authority: true,
          },
        },
      },
    }),
    prisma.verificationRequest.findMany({
      take: args.limitVerificationRequests,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        userId: true,
        caseId: true,
        proofType: true,
        proofUrl: true,
        status: true,
        reviewerId: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
        case: {
          select: {
            schoolId: true,
            school: { select: { name: true } },
            year: true,
            round: true,
            result: true,
          },
        },
      },
    }),
    prisma.predictionFeedback.findMany({
      take: args.limitFeedback,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        predictionResultId: true,
        userId: true,
        sentiment: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        predictionResult: {
          select: {
            schoolId: true,
            applicationYear: true,
            applicationRound: true,
            authority: true,
          },
        },
      },
    }),
  ]);

  const rows: DispositionRow[] = [
    ...cases.map((row) => caseDispositionRow(row, salt)),
    ...labels.map((row) => labelDispositionRow(row, salt)),
    ...verificationRequests.map((row) => verificationDispositionRow(row, salt)),
    ...feedback.map((row) => feedbackDispositionRow(row, salt)),
  ];
  const unmappedRows = rows.filter((row) => row.disposition === 'unmapped');
  const truncatedRows =
    Math.max(0, totalCases - cases.length) +
    Math.max(0, totalLabels - labels.length) +
    Math.max(0, totalVerificationRequests - verificationRequests.length) +
    Math.max(0, totalFeedback - feedback.length);
  const blockedRows = unmappedRows.length + truncatedRows;
  const status: PacketStatus =
    blockedRows > 0
      ? 'BLOCKED_UNMAPPED_CASE_OUTCOME_ROWS'
      : 'CASES_OUTCOMES_DISPOSITION_READY';
  const caseRows = rows.filter((row) => row.rowType === 'admission_case');
  const labelRows = rows.filter((row) => row.rowType === 'outcome_label');
  const verificationRows = rows.filter(
    (row) => row.rowType === 'verification_request',
  );
  const feedbackRows = rows.filter(
    (row) => row.rowType === 'prediction_feedback',
  );

  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-cases-outcomes-disposition',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    prohibitedAutoCalibration: true,
    privacy: {
      includesUserIds: false,
      includesProofData: false,
      includesEssayContent: false,
      subjectKeyStrategy: 'sha256(report-salted-row-id)',
      userKeyStrategy: 'sha256(report-salted-user-id)',
    },
    limits: {
      cases: args.limitCases,
      labels: args.limitLabels,
      verificationRequests: args.limitVerificationRequests,
      feedback: args.limitFeedback,
      truncatedRows,
    },
    summary: {
      totalRows:
        totalCases + totalLabels + totalVerificationRequests + totalFeedback,
      emittedRows: rows.length,
      allRowsHaveDisposition: unmappedRows.length === 0 && truncatedRows === 0,
      unmappedRows: unmappedRows.length,
      blockedRows,
      truncatedRows,
      admissionCases: totalCases,
      emittedAdmissionCases: caseRows.length,
      verifiedCases,
      casesWithEvidence,
      trustedCaseRows: countWhere(
        caseRows,
        (row) => row.closureState === 'trusted',
      ),
      reviewCaseRows: countWhere(
        caseRows,
        (row) => row.closureState === 'review',
      ),
      diagnosticOnlyCases: countWhere(
        caseRows,
        (row) => row.closureState === 'diagnostic',
      ),
      terminalCaseRows: countWhere(
        caseRows,
        (row) => row.closureState === 'terminal',
      ),
      missingProvenanceCases: countWhere(
        caseRows,
        (row) => row.provenanceStatus === 'missing',
      ),
      pendingReviewCases: countWhere(
        caseRows,
        (row) => row.reviewStatus === 'PENDING_REVIEW',
      ),
      outcomeLabels: totalLabels,
      emittedOutcomeLabels: labelRows.length,
      labelsWithEvidence,
      trustedLabelRows: countWhere(
        labelRows,
        (row) => row.closureState === 'trusted',
      ),
      diagnosticOnlyLabels: countWhere(
        labelRows,
        (row) => row.closureState === 'diagnostic',
      ),
      conflictLabelRows: countWhere(
        labelRows,
        (row) => row.closureState === 'conflict',
      ),
      terminalLabelRows: countWhere(
        labelRows,
        (row) => row.closureState === 'terminal',
      ),
      verificationRequests: totalVerificationRequests,
      emittedVerificationRequests: verificationRows.length,
      predictionFeedback: totalFeedback,
      emittedPredictionFeedback: feedbackRows.length,
      feedbackDiagnosticOnlyRows: feedbackRows.length,
      byDisposition: countBy(rows, (row) => row.disposition),
      byClosureState: countBy(rows, (row) => row.closureState),
      byRowType: countBy(rows, (row) => row.rowType),
      bySourceQuality: countBy(rows, (row) => row.sourceQuality),
      byProvenanceStatus: countBy(rows, (row) => row.provenanceStatus),
      topReviewGroups: topGroups(
        rows.filter((row) => ['review', 'conflict'].includes(row.closureState)),
      ),
      topDiagnosticGroups: topGroups(
        rows.filter((row) => row.closureState === 'diagnostic'),
      ),
    },
    closureContract: {
      verifiedCasesCanSupportDiagnostics:
        'Verified cases and evidence-backed labels can support diagnostic accuracy reports and admin review.',
      communityCasesRemainDiagnostic:
        'Unverified user/community cases are diagnostic/community evidence only and must display weak-state/review signals.',
      noAutoCalibration:
        'No case, outcome label, verification request, or feedback row from this packet is allowed to auto-train or auto-calibrate prediction without a future ADR and approved workflow.',
      privacyGuards: [
        'raw user IDs are hashed by default',
        'verification proofData is never selected',
        'essay prompt/content text is represented only by boolean evidence proxies',
        'feedback notes are not exported',
      ],
    },
    nextCampaign: buildNextCampaign(rows, blockedRows),
    rows,
  };
}

function caseDispositionRow(row: any, salt: string): DispositionRow {
  const verificationApproved = row.verificationRequests.some(
    (request: any) => request.status === 'APPROVED',
  );
  const verificationPending = row.verificationRequests.some(
    (request: any) => request.status === 'PENDING',
  );
  const hasSourceUrlOrName =
    nonEmpty(row.source) || nonEmpty(row.importBatchId);
  const hasVerificationMetadata =
    Boolean(row.verifiedAt) || row.verificationRequests.length > 0;
  const hasEssayContent = nonEmpty(row.essayContent);
  const hasReviewMetadata = Boolean(row.reviewedAt);
  const provenanceStatus: ProvenanceStatus =
    row.isVerified || verificationApproved
      ? 'verified'
      : hasVerificationMetadata
        ? 'evidence_proxy'
        : hasSourceUrlOrName || hasEssayContent
          ? 'evidence_proxy'
          : hasReviewMetadata
            ? 'review_metadata'
            : 'missing';
  const disposition = classifyCase(row, verificationApproved);
  const closureState = caseClosureState(disposition);
  return {
    rowType: 'admission_case',
    subjectKey: hashKey(`case:${row.id}`, salt),
    userKey: hashKey(`user:${row.userId}`, salt),
    caseKey: hashKey(`case:${row.id}`, salt),
    schoolId: row.schoolId,
    schoolName: row.school?.name ?? null,
    applicationYear: row.year ?? null,
    round: row.round ?? null,
    result: row.result ?? null,
    reviewStatus: row.reviewStatus ?? null,
    visibility: row.visibility ?? null,
    qualityScore: row.qualityScore ?? null,
    disposition,
    closureState,
    nextAction: nextActionFor(
      closureState,
      provenanceStatus,
      verificationPending,
    ),
    sourceQuality: caseSourceQuality(row, verificationApproved),
    provenanceStatus,
    hasSourceUrlOrName,
    hasEvidenceUrl: false,
    hasProofUrl: row.verificationRequests.some((request: any) =>
      nonEmpty(request.proofUrl),
    ),
    hasVerificationMetadata,
    hasEssayContent,
    consumerPolicy: consumerPolicyForCase(closureState),
    evidence: caseEvidence(row, provenanceStatus, verificationPending),
  };
}

function labelDispositionRow(row: any, salt: string): DispositionRow {
  const hasEvidenceUrl = nonEmpty(row.evidenceUrl);
  const hasResolver = nonEmpty(row.resolvedBy) || Boolean(row.resolvedAt);
  const closureState = labelClosureState(
    row.status,
    hasEvidenceUrl,
    hasResolver,
  );
  const disposition = classifyLabel(row.status, hasEvidenceUrl, hasResolver);
  return {
    rowType: 'outcome_label',
    subjectKey: hashKey(`outcome-label:${row.id}`, salt),
    predictionResultKey: hashKey(
      `prediction-result:${row.predictionResultId}`,
      salt,
    ),
    schoolId: row.predictionResult?.schoolId ?? null,
    applicationYear: row.predictionResult?.applicationYear ?? null,
    round: row.round ?? row.predictionResult?.applicationRound ?? null,
    result: row.result ?? null,
    outcomeLabelStatus: row.status ?? null,
    disposition,
    closureState,
    nextAction:
      closureState === 'trusted'
        ? 'accept'
        : closureState === 'terminal'
          ? 'mark-terminal'
          : closureState === 'conflict'
            ? 'review'
            : hasEvidenceUrl
              ? 'review'
              : row.status === 'REQUEST_EVIDENCE'
                ? 'request-evidence'
                : 'diagnostic-only',
    sourceQuality: VERIFIED_LABEL_STATUSES.has(row.status)
      ? 'verified_user_proof_or_admin'
      : 'user_self_reported',
    provenanceStatus: VERIFIED_LABEL_STATUSES.has(row.status)
      ? hasEvidenceUrl || hasResolver
        ? 'verified'
        : 'missing'
      : hasEvidenceUrl
        ? 'evidence_url'
        : hasResolver
          ? 'review_metadata'
          : 'missing',
    hasSourceUrlOrName: false,
    hasEvidenceUrl,
    hasProofUrl: false,
    hasVerificationMetadata: hasResolver,
    hasEssayContent: false,
    consumerPolicy:
      closureState === 'trusted'
        ? 'diagnostic_accuracy_review_allowed_no_auto_calibration'
        : 'diagnostic_only_no_auto_calibration',
    evidence: [
      'PredictionOutcomeLabelRecord',
      `status:${row.status}`,
      ...(hasEvidenceUrl ? ['evidenceUrl:present'] : []),
      ...(hasResolver ? ['resolverMetadata:present'] : []),
      'PREDICTION_CLOSED_LOOP_SOP.md',
      'ADR-0020 no-sample calibration',
    ],
  };
}

function verificationDispositionRow(row: any, salt: string): DispositionRow {
  const closureState: ClosureState =
    row.status === 'APPROVED'
      ? 'trusted'
      : row.status === 'REJECTED'
        ? 'terminal'
        : 'review';
  return {
    rowType: 'verification_request',
    subjectKey: hashKey(`verification-request:${row.id}`, salt),
    userKey: hashKey(`user:${row.userId}`, salt),
    caseKey: hashKey(`case:${row.caseId}`, salt),
    schoolId: row.case?.schoolId ?? null,
    schoolName: row.case?.school?.name ?? null,
    applicationYear: row.case?.year ?? null,
    round: row.case?.round ?? null,
    result: row.case?.result ?? null,
    verificationStatus: row.status ?? null,
    disposition:
      row.status === 'APPROVED'
        ? 'trusted_verification_approved'
        : row.status === 'REJECTED'
          ? 'terminal_verification_rejected'
          : 'operator_review_verification_pending',
    closureState,
    nextAction:
      closureState === 'trusted'
        ? 'accept'
        : closureState === 'terminal'
          ? 'mark-terminal'
          : 'review',
    sourceQuality:
      row.status === 'APPROVED'
        ? 'verified_user_proof_or_admin'
        : 'reviewed_admin_or_import',
    provenanceStatus:
      row.status === 'APPROVED'
        ? 'verified'
        : nonEmpty(row.proofUrl)
          ? 'evidence_proxy'
          : 'review_metadata',
    hasSourceUrlOrName: false,
    hasEvidenceUrl: false,
    hasProofUrl: nonEmpty(row.proofUrl),
    hasVerificationMetadata: true,
    hasEssayContent: false,
    consumerPolicy:
      'verification_admin_review_only_until_case_is_marked_verified; no_auto_calibration',
    evidence: [
      'VerificationRequest',
      `status:${row.status}`,
      `proofType:${row.proofType}`,
      ...(nonEmpty(row.proofUrl) ? ['proofUrl:present'] : []),
    ],
  };
}

function feedbackDispositionRow(row: any, salt: string): DispositionRow {
  return {
    rowType: 'prediction_feedback',
    subjectKey: hashKey(`prediction-feedback:${row.id}`, salt),
    userKey: hashKey(`user:${row.userId}`, salt),
    predictionResultKey: hashKey(
      `prediction-result:${row.predictionResultId}`,
      salt,
    ),
    schoolId: row.predictionResult?.schoolId ?? null,
    applicationYear: row.predictionResult?.applicationYear ?? null,
    round: row.predictionResult?.applicationRound ?? null,
    feedbackSentiment: row.sentiment ?? null,
    feedbackCategory: row.category ?? null,
    disposition: 'feedback_diagnostic_only',
    closureState: 'diagnostic',
    nextAction: 'diagnostic-only',
    sourceQuality: 'platform_feedback',
    provenanceStatus: 'evidence_proxy',
    hasSourceUrlOrName: false,
    hasEvidenceUrl: false,
    hasProofUrl: false,
    hasVerificationMetadata: false,
    hasEssayContent: false,
    consumerPolicy:
      'product_feedback_diagnostic_only_no_prediction_training_or_calibration',
    evidence: [
      'PredictionFeedback',
      `sentiment:${row.sentiment}`,
      ...(row.category ? [`category:${row.category}`] : []),
      'ADR-0020 no-sample calibration',
    ],
  };
}

function classifyCase(row: any, verificationApproved: boolean) {
  if (row.reviewStatus === 'REJECTED') return 'terminal_rejected_case';
  if (row.isVerified || row.verifiedAt || verificationApproved) {
    return 'trusted_verified_case';
  }
  if (row.reviewStatus === 'APPROVED') return 'review_approved_unverified_case';
  if (row.reviewStatus === 'PENDING_REVIEW') return 'review_pending_case';
  if (row.reviewStatus === 'AUTO_APPROVED') {
    return hasCaseEvidence(row)
      ? 'community_diagnostic_only'
      : 'review_missing_provenance_case';
  }
  return hasCaseEvidence(row)
    ? 'review_evidence_unclassified_case'
    : 'review_missing_provenance_case';
}

function caseClosureState(disposition: string): ClosureState {
  if (disposition === 'trusted_verified_case') return 'trusted';
  if (disposition === 'terminal_rejected_case') return 'terminal';
  if (disposition === 'community_diagnostic_only') return 'diagnostic';
  return 'review';
}

function labelClosureState(
  status: string,
  hasEvidenceUrl: boolean,
  hasResolver: boolean,
): ClosureState {
  if (status === 'CONFLICTED') return 'conflict';
  if (TERMINAL_LABEL_STATUSES.has(status)) return 'terminal';
  if (VERIFIED_LABEL_STATUSES.has(status) && (hasEvidenceUrl || hasResolver)) {
    return 'trusted';
  }
  if (status === 'REQUEST_EVIDENCE') return 'review';
  if (status === 'SELF_REPORTED')
    return hasEvidenceUrl ? 'review' : 'diagnostic';
  return 'review';
}

function classifyLabel(
  status: string,
  hasEvidenceUrl: boolean,
  hasResolver: boolean,
) {
  if (status === 'CONFLICTED') return 'conflict_outcome_label';
  if (status === 'REJECTED') return 'terminal_rejected_label';
  if (status === 'CENSORED') return 'terminal_censored_label';
  if (VERIFIED_LABEL_STATUSES.has(status)) {
    return hasEvidenceUrl || hasResolver
      ? 'trusted_verified_outcome_label'
      : 'review_missing_verified_label_evidence';
  }
  if (status === 'REQUEST_EVIDENCE') return 'review_evidence_requested_label';
  if (status === 'SELF_REPORTED') {
    return hasEvidenceUrl
      ? 'review_self_reported_with_evidence'
      : 'self_reported_diagnostic_only';
  }
  return 'review_unclassified_outcome_label';
}

function caseSourceQuality(
  row: any,
  verificationApproved: boolean,
): SourceQuality {
  if (row.isVerified || row.verifiedAt || verificationApproved) {
    return 'verified_user_proof_or_admin';
  }
  if (row.reviewStatus === 'APPROVED') return 'reviewed_admin_or_import';
  if (stringOrEmpty(row.source).toLowerCase() === 'user') {
    return 'user_self_reported';
  }
  if (nonEmpty(row.source) || nonEmpty(row.importBatchId)) {
    return 'imported_or_public_candidate';
  }
  return 'unknown';
}

function hasCaseEvidence(row: any) {
  return (
    nonEmpty(row.source) ||
    nonEmpty(row.importBatchId) ||
    Boolean(row.reviewedAt) ||
    Boolean(row.verifiedAt) ||
    nonEmpty(row.essayContent) ||
    row.verificationRequests.length > 0
  );
}

function nextActionFor(
  closureState: ClosureState,
  provenanceStatus: ProvenanceStatus,
  verificationPending: boolean,
): NextAction {
  if (closureState === 'trusted') return 'accept';
  if (closureState === 'terminal') return 'mark-terminal';
  if (closureState === 'diagnostic') return 'diagnostic-only';
  if (verificationPending) return 'review';
  return provenanceStatus === 'missing' ? 'request-evidence' : 'review';
}

function consumerPolicyForCase(closureState: ClosureState) {
  if (closureState === 'trusted') {
    return 'case_gallery_hall_prediction_diagnostics_allowed_with_verified_badge_no_auto_calibration';
  }
  if (closureState === 'diagnostic') {
    return 'community_display_allowed_only_with_weak_state_no_prediction_training_or_calibration';
  }
  if (closureState === 'terminal') {
    return 'do_not_publish_or_calibrate_terminal_case';
  }
  return 'admin_review_required_before_trusted_public_or_diagnostic_use';
}

function caseEvidence(
  row: any,
  provenanceStatus: ProvenanceStatus,
  verificationPending: boolean,
) {
  return [
    'AdmissionCase',
    `reviewStatus:${row.reviewStatus}`,
    `provenance:${provenanceStatus}`,
    ...(row.isVerified ? ['isVerified:true'] : []),
    ...(row.verifiedAt ? ['verifiedAt:present'] : []),
    ...(nonEmpty(row.source) ? ['source:present'] : []),
    ...(nonEmpty(row.importBatchId) ? ['importBatchId:present'] : []),
    ...(nonEmpty(row.essayContent) ? ['essayContent:present'] : []),
    ...(verificationPending ? ['verificationRequest:pending'] : []),
    'PREDICTION_CLOSED_LOOP_SOP.md',
    'ADR-0020 no-sample calibration',
  ];
}

function buildNextCampaign(rows: DispositionRow[], blockedRows: number) {
  if (blockedRows > 0) {
    return {
      id: 'cases_outcomes_disposition_mapping',
      reason: `${blockedRows} case/outcome rows are unmapped or truncated; increase limits or add mapping before closure.`,
    };
  }
  const reviewGroup = topGroups(
    rows.filter((row) => ['review', 'conflict'].includes(row.closureState)),
  )[0];
  if (reviewGroup) {
    return {
      id: 'cases_outcomes_review_queue',
      reason: `${reviewGroup.count} rows need operator review in ${reviewGroup.key}.`,
      group: reviewGroup.key,
    };
  }
  const diagnosticGroup = topGroups(
    rows.filter((row) => row.closureState === 'diagnostic'),
  )[0];
  if (diagnosticGroup) {
    return {
      id: 'cases_outcomes_diagnostic_visibility',
      reason: `${diagnosticGroup.count} rows are diagnostic-only; verify consumers show weak-state badges and do not calibrate.`,
      group: diagnosticGroup.key,
    };
  }
  return {
    id: 'cases_outcomes_monitor',
    reason:
      'All case/outcome rows have explicit dispositions; monitor new rows and rerun packet.',
  };
}

function topGroups(rows: DispositionRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.rowType}:${row.disposition}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, 12);
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function countWhere<T>(items: T[], predicate: (item: T) => boolean) {
  return items.filter(predicate).length;
}

function hashKey(value: string, salt: string) {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${value}`)
    .digest('hex')
    .slice(0, 24);
}

function nonEmpty(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const summary = report.summary ?? {};
  const reviewGroups = Array.isArray(summary.topReviewGroups)
    ? summary.topReviewGroups
    : [];
  const diagnosticGroups = Array.isArray(summary.topDiagnosticGroups)
    ? summary.topDiagnosticGroups
    : [];
  return [
    '# Cases And Outcomes Disposition Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total rows: ${summary.totalRows ?? 0}`,
    `- Emitted rows: ${summary.emittedRows ?? 0}`,
    `- Admission cases: ${summary.admissionCases ?? 0}`,
    `- Verified cases: ${summary.verifiedCases ?? 0}`,
    `- Outcome labels: ${summary.outcomeLabels ?? 0}`,
    `- Verification requests: ${summary.verificationRequests ?? 0}`,
    `- Prediction feedback: ${summary.predictionFeedback ?? 0}`,
    `- Unmapped rows: ${summary.unmappedRows ?? 0}`,
    `- Truncated rows: ${summary.truncatedRows ?? 0}`,
    '',
    '## Contract',
    '',
    '- This packet is read-only and does not write DB rows.',
    '- It exports anonymized keys, not raw user IDs.',
    '- It does not export verification proof data, essay content, or feedback notes.',
    '- Cases, labels, and feedback remain diagnostic-only for prediction unless a future ADR approves another workflow.',
    '',
    '## Top Review Groups',
    '',
    '| Group | Rows |',
    '| --- | ---: |',
    ...(reviewGroups.length
      ? reviewGroups.map(
          (group: any) => `| ${escapeMarkdown(group.key)} | ${group.count} |`,
        )
      : ['| None | 0 |']),
    '',
    '## Top Diagnostic Groups',
    '',
    '| Group | Rows |',
    '| --- | ---: |',
    ...(diagnosticGroups.length
      ? diagnosticGroups.map(
          (group: any) => `| ${escapeMarkdown(group.key)} | ${group.count} |`,
        )
      : ['| None | 0 |']),
    '',
  ].join('\n');
}

function renderCsv(rows: DispositionRow[]) {
  const header = [
    'rowType',
    'subjectKey',
    'userKey',
    'caseKey',
    'predictionResultKey',
    'schoolId',
    'schoolName',
    'applicationYear',
    'round',
    'result',
    'reviewStatus',
    'verificationStatus',
    'outcomeLabelStatus',
    'feedbackSentiment',
    'feedbackCategory',
    'disposition',
    'closureState',
    'nextAction',
    'sourceQuality',
    'provenanceStatus',
    'consumerPolicy',
  ];
  const lines = rows.map((row) =>
    [
      row.rowType,
      row.subjectKey,
      row.userKey ?? '',
      row.caseKey ?? '',
      row.predictionResultKey ?? '',
      row.schoolId ?? '',
      row.schoolName ?? '',
      row.applicationYear ?? '',
      row.round ?? '',
      row.result ?? '',
      row.reviewStatus ?? '',
      row.verificationStatus ?? '',
      row.outcomeLabelStatus ?? '',
      row.feedbackSentiment ?? '',
      row.feedbackCategory ?? '',
      row.disposition,
      row.closureState,
      row.nextAction,
      row.sourceQuality,
      row.provenanceStatus,
      row.consumerPolicy,
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
  return String(value ?? '').replace(/\|/g, '\\|');
}

function printSummary(args: Args, report: Record<string, any>) {
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        csv: args.csv,
        totalRows: report.summary?.totalRows ?? 0,
        emittedRows: report.summary?.emittedRows ?? 0,
        blockedRows: report.summary?.blockedRows ?? 0,
        byClosureState: report.summary?.byClosureState ?? {},
        byDisposition: report.summary?.byDisposition ?? {},
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
