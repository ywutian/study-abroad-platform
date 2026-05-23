#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';

type ProposalStatus =
  | 'PASS_NO_DB_MIGRATION_BLOCKER'
  | 'REVIEW_EXACT_SQL_ARTIFACT_FOUND'
  | 'REVIEW_APPROVED_EXACT_SQL_RESTORE'
  | 'REVIEW_APPROVED_BASELINE_RESOLUTION'
  | 'BASELINE_PROPOSAL_READY_REVIEW_REQUIRED'
  | 'BLOCKED_INSUFFICIENT_EVIDENCE';

interface Args {
  schemaWorklist: string | null;
  migrationReconciliation: string | null;
  restoreCandidateBundle: string | null;
  checksumReview: string | null;
  checksumVariantAnalysis: string | null;
  unrecoverableArtifactSearch: string | null;
  localArtifactSearch: string | null;
  externalArtifactPacket: string | null;
  baselineResolution: string | null;
  baselineScopePreflight: string | null;
  backupEvidencePacket: string | null;
  baselineApprovalRequest: string | null;
  out: string;
  markdown: string;
}

interface Artifact {
  kind: string;
  path: string | null;
  exists: boolean;
  generatedAt: string | null;
  status: string | null;
  summary: Record<string, unknown>;
  rows: unknown[];
  raw: Record<string, unknown>;
  error: string | null;
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const REQUIRED_ACK = 'APPROVED_DATABASE_MIGRATION_BASELINE_RESOLVE';
const SUPPORTED_BASELINE_SCOPES = [
  'local-existing',
  'local-disposable',
  'staging-clone',
];

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
  const optionalPath = (name: string, pattern: RegExp) => {
    const value = get(name);
    return value ? path.resolve(API_ROOT, value) : findLatest(pattern);
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(
        REPORT_ROOT,
        `database-migration-baseline-proposal-${stamp}.json`,
      ),
    )!,
  );

  return {
    schemaWorklist: optionalPath(
      '--schema-worklist',
      /^database-schema-compatibility-worklist-.+\.json$/,
    ),
    migrationReconciliation: optionalPath(
      '--migration-reconciliation',
      /^database-migration-history-reconciliation-.+\.json$/,
    ),
    restoreCandidateBundle: optionalPath(
      '--restore-candidate-bundle',
      /^database-migration-restore-candidate-bundle-.+\.json$/,
    ),
    checksumReview: optionalPath(
      '--checksum-review',
      /^database-migration-checksum-review-.+\.json$/,
    ),
    checksumVariantAnalysis: optionalPath(
      '--checksum-variant-analysis',
      /^database-migration-checksum-variant-analysis-.+\.json$/,
    ),
    unrecoverableArtifactSearch: optionalPath(
      '--unrecoverable-artifact-search',
      /^database-migration-unrecoverable-artifact-search-.+\.json$/,
    ),
    localArtifactSearch: optionalPath(
      '--local-artifact-search',
      /^database-migration-local-artifact-search-.+\.json$/,
    ),
    externalArtifactPacket: optionalPath(
      '--external-artifact-packet',
      /^database-migration-external-artifact-packet-.+\.json$/,
    ),
    baselineResolution: optionalPath(
      '--baseline-resolution',
      /^database-migration-baseline-resolution-.+\.json$/,
    ),
    baselineScopePreflight: optionalPath(
      '--baseline-scope-preflight',
      /^database-migration-baseline-scope-preflight-.+\.json$/,
    ),
    backupEvidencePacket: optionalPath(
      '--backup-evidence-packet',
      /^database-migration-backup-evidence-packet-.+\.json$/,
    ),
    baselineApprovalRequest: optionalPath(
      '--baseline-approval-request',
      /^database-migration-baseline-approval-request-.+\.json$/,
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
  const artifacts = {
    schemaWorklist: readArtifact(
      'database_schema_compatibility_worklist',
      args.schemaWorklist,
    ),
    migrationReconciliation: readArtifact(
      'database_migration_history_reconciliation',
      args.migrationReconciliation,
    ),
    restoreCandidateBundle: readArtifact(
      'database_migration_restore_candidate_bundle',
      args.restoreCandidateBundle,
    ),
    checksumReview: readArtifact(
      'database_migration_checksum_review',
      args.checksumReview,
    ),
    checksumVariantAnalysis: readArtifact(
      'database_migration_checksum_variant_analysis',
      args.checksumVariantAnalysis,
    ),
    unrecoverableArtifactSearch: readArtifact(
      'database_migration_unrecoverable_artifact_search',
      args.unrecoverableArtifactSearch,
    ),
    localArtifactSearch: readArtifact(
      'database_migration_local_artifact_search',
      args.localArtifactSearch,
    ),
    externalArtifactPacket: readArtifact(
      'database_migration_external_artifact_packet',
      args.externalArtifactPacket,
    ),
    baselineResolution: readArtifact(
      'database_migration_baseline_resolution',
      args.baselineResolution,
    ),
    baselineScopePreflight: readArtifact(
      'database_migration_baseline_scope_preflight',
      args.baselineScopePreflight,
    ),
    backupEvidencePacket: readArtifact(
      'database_migration_backup_evidence_packet',
      args.backupEvidencePacket,
    ),
    baselineApprovalRequest: readArtifact(
      'database_migration_baseline_approval_request',
      args.baselineApprovalRequest,
    ),
  };
  const summary = buildSummary(artifacts);
  const unresolvedMismatches = extractUnresolvedMismatches(
    artifacts.checksumReview,
  );
  const migrationHistoryBlockers = extractMigrationHistoryBlockers(
    artifacts.migrationReconciliation,
  );
  const baselineDecisionHandoff = buildBaselineDecisionHandoff(
    artifacts.baselineResolution,
  );
  const externalCandidateIntake = buildExternalCandidateIntake(
    artifacts.externalArtifactPacket,
  );
  const missingEvidence = buildMissingEvidence(artifacts, summary);
  const status = chooseStatus(
    summary,
    artifacts.baselineResolution.status,
    missingEvidence,
  );
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-migration-baseline-proposal',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    operatorApprovalGranted: baselineDecisionHandoff.approvalReady,
    prismaResolveOrDeployExecuted: false,
    sourceArtifacts: Object.fromEntries(
      Object.entries(artifacts).map(([key, artifact]) => [
        key,
        {
          path: artifact.path,
          exists: artifact.exists,
          status: artifact.status,
          generatedAt: artifact.generatedAt,
          error: artifact.error,
        },
      ]),
    ),
    summary,
    externalCandidateIntake,
    baselineDecisionHandoff,
    migrationHistoryBlockers,
    unresolvedMismatches,
    missingEvidence,
    decisionPacket: buildDecisionPacket(args, status, [
      ...migrationHistoryBlockers,
      ...unresolvedMismatches,
    ]),
    recommendedSequence: buildRecommendedSequence(status),
    nextCampaign: buildNextCampaign(status, summary),
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  printSummary(args.out, args.markdown, report);
}

function readArtifact(kind: string, artifactPath: string | null): Artifact {
  if (!artifactPath) {
    return {
      kind,
      path: null,
      exists: false,
      generatedAt: null,
      status: null,
      summary: {},
      rows: [],
      raw: {},
      error: 'No artifact path provided and no latest report was found',
    };
  }
  const resolved = path.resolve(API_ROOT, artifactPath);
  if (!fs.existsSync(resolved)) {
    return {
      kind,
      path: path.relative(API_ROOT, resolved),
      exists: false,
      generatedAt: null,
      status: null,
      summary: {},
      rows: [],
      raw: {},
      error: 'Artifact path does not exist',
    };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf8')) as Record<
      string,
      unknown
    >;
    return {
      kind,
      path: path.relative(API_ROOT, resolved),
      exists: true,
      generatedAt: stringOrNull(raw.generatedAt),
      status: stringOrNull(raw.status),
      summary: objectOrEmpty(raw.summary),
      rows: Array.isArray(raw.rows) ? raw.rows : [],
      raw,
      error: null,
    };
  } catch (error) {
    return {
      kind,
      path: path.relative(API_ROOT, resolved),
      exists: false,
      generatedAt: null,
      status: null,
      summary: {},
      rows: [],
      raw: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

function buildSummary(artifacts: Record<string, Artifact>) {
  const checksumRows = extractUnresolvedMismatches(artifacts.checksumReview);
  const localMatches = numberFromSummary(
    artifacts.localArtifactSearch,
    'exactMatches',
  );
  const externalMatches = numberFromSummary(
    artifacts.externalArtifactPacket,
    'exactArtifactMatches',
  );
  const unrecoverableArtifactMatches = numberFromSummary(
    artifacts.unrecoverableArtifactSearch,
    'exactArtifactMatches',
  );
  const variantMatches = numberFromSummary(
    artifacts.checksumVariantAnalysis,
    'exactVariantMatches',
  );
  const externalCandidateIntake = objectOrEmpty(
    artifacts.externalArtifactPacket.raw.candidateIntake,
  );
  const appliedMigrationsMissingFromRepo = numberFromSummary(
    artifacts.schemaWorklist,
    'appliedMigrationsMissingFromRepo',
  );
  const unappliedRepoMigrations = numberFromSummary(
    artifacts.schemaWorklist,
    'unappliedRepoMigrations',
  );
  const restoreBundleBlockedRows = numberFromSummary(
    artifacts.restoreCandidateBundle,
    'blockedRows',
  );
  const unrecoverableRows = Math.max(
    numberFromSummary(artifacts.migrationReconciliation, 'unrecoverable'),
    numberFromSummary(artifacts.restoreCandidateBundle, 'unrecoverableRows'),
    numberFromSummary(
      artifacts.unrecoverableArtifactSearch,
      'unrecoverableRows',
    ),
  );
  const openMigrationBlockers =
    appliedMigrationsMissingFromRepo +
    unappliedRepoMigrations +
    restoreBundleBlockedRows +
    checksumRows.length;
  return {
    schemaWorklistStatus: artifacts.schemaWorklist.status,
    schemaRows: artifacts.schemaWorklist.rows.length,
    missingTables: numberFromSummary(artifacts.schemaWorklist, 'missingTables'),
    missingColumns: numberFromSummary(
      artifacts.schemaWorklist,
      'missingColumns',
    ),
    unappliedRepoMigrations,
    appliedMigrationsMissingFromRepo,
    openMigrationBlockers,
    reconciliationStatus: artifacts.migrationReconciliation.status,
    recoverableFromGit: numberFromSummary(
      artifacts.migrationReconciliation,
      'recoverableFromGit',
    ),
    unrecoverableRows,
    checksumMatchedRows: numberFromSummary(
      artifacts.migrationReconciliation,
      'checksumMatches',
    ),
    checksumMismatchRows: numberFromSummary(
      artifacts.migrationReconciliation,
      'checksumMismatches',
    ),
    restoreBundleStatus: artifacts.restoreCandidateBundle.status,
    stagedRestoreCandidates: numberFromSummary(
      artifacts.restoreCandidateBundle,
      'stagedRestoreCandidates',
    ),
    restoreBundleBlockedRows,
    checksumReviewStatus: artifacts.checksumReview.status,
    unresolvedChecksumMismatches: checksumRows.length,
    checksumVariantAnalysisStatus: artifacts.checksumVariantAnalysis.status,
    checksumVariantChecks: numberFromSummary(
      artifacts.checksumVariantAnalysis,
      'variantChecks',
    ),
    checksumVariantExactMatches: variantMatches,
    checksumVariantUnresolved: numberFromSummary(
      artifacts.checksumVariantAnalysis,
      'unresolvedAfterVariantAnalysis',
    ),
    unrecoverableArtifactSearchStatus:
      artifacts.unrecoverableArtifactSearch.status,
    unrecoverableArtifactMatches,
    unrecoverableArtifactsScanned: numberFromSummary(
      artifacts.unrecoverableArtifactSearch,
      'filesScanned',
    ),
    unrecoverableArchivesScanned: numberFromSummary(
      artifacts.unrecoverableArtifactSearch,
      'archivesScanned',
    ),
    unrecoverableArchiveEntriesScanned: numberFromSummary(
      artifacts.unrecoverableArtifactSearch,
      'archiveEntriesScanned',
    ),
    localArtifactSearchStatus: artifacts.localArtifactSearch.status,
    localCandidateFilesRead: numberFromSummary(
      artifacts.localArtifactSearch,
      'candidateFilesRead',
    ),
    externalArtifactPacketStatus: artifacts.externalArtifactPacket.status,
    externalFilesScanned: numberFromSummary(
      artifacts.externalArtifactPacket,
      'filesScanned',
    ),
    externalArchivesScanned: numberFromSummary(
      artifacts.externalArtifactPacket,
      'archivesScanned',
    ),
    externalArchiveEntriesScanned: numberFromSummary(
      artifacts.externalArtifactPacket,
      'archiveEntriesScanned',
    ),
    externalCandidateIntakeStatus: stringOrNull(externalCandidateIntake.status),
    externalCandidateFilesPresent: numberFromObject(
      externalCandidateIntake,
      'candidateFilesPresent',
    ),
    externalCandidateSqlFilesPresent: numberFromObject(
      externalCandidateIntake,
      'candidateSqlFilesPresent',
    ),
    externalCandidateArchiveFilesPresent: numberFromObject(
      externalCandidateIntake,
      'candidateArchiveFilesPresent',
    ),
    externalCandidateGeneratedIntakeFilesPresent: numberFromObject(
      externalCandidateIntake,
      'generatedIntakeFilesPresent',
    ),
    externalCandidateFiles: stringList(externalCandidateIntake.candidateFiles),
    externalCandidateIntakeRoot: stringOrNull(
      externalCandidateIntake.suggestedCandidateRoot,
    ),
    externalCandidateManifestPath: stringOrNull(
      externalCandidateIntake.manifestPath,
    ),
    externalCandidateManifestDigestPath: stringOrNull(
      externalCandidateIntake.manifestDigestPath,
    ),
    externalCandidateManifestSha256: stringOrNull(
      externalCandidateIntake.manifestSha256,
    ),
    externalCandidateManifestSizeBytes:
      externalCandidateIntake.manifestSizeBytes,
    externalCandidateRequestJsonPath: stringOrNull(
      externalCandidateIntake.requestJsonPath,
    ),
    externalCandidateRequestMarkdownPath: stringOrNull(
      externalCandidateIntake.requestMarkdownPath,
    ),
    externalCandidateStatusJsonPath: stringOrNull(
      externalCandidateIntake.statusJsonPath,
    ),
    externalCandidateStatusMarkdownPath: stringOrNull(
      externalCandidateIntake.statusMarkdownPath,
    ),
    externalCandidateManifestSourceReportPath: stringOrNull(
      externalCandidateIntake.sourceReportPath,
    ),
    externalCandidateManifestSourceMarkdownPath: stringOrNull(
      externalCandidateIntake.sourceMarkdownPath,
    ),
    externalCandidateVerificationCommand: stringOrNull(
      externalCandidateIntake.verificationCommand,
    ),
    externalCandidateAcceptedArchiveNames: stringList(
      externalCandidateIntake.acceptedArchiveNames,
    ),
    externalCandidateVerificationChecklist: stringList(
      externalCandidateIntake.verificationChecklist,
    ),
    externalCandidateSearchedRoots: stringList(
      externalCandidateIntake.searchedRoots,
    ),
    externalCandidateTargetRows: candidateTargetRows(
      externalCandidateIntake.targetRows,
    ),
    exactSqlArtifactMatches:
      localMatches +
      externalMatches +
      variantMatches +
      unrecoverableArtifactMatches,
    baselineResolutionStatus: artifacts.baselineResolution.status,
    baselineDecision: stringOrNull(artifacts.baselineResolution.raw.decision),
    baselineTargetScope: stringOrNull(
      artifacts.baselineResolution.raw.targetScope,
    ),
    baselineApprovalReady: booleanFromObject(
      objectOrEmpty(artifacts.baselineResolution.raw.summary),
      'approvalReady',
    ),
    baselineMissingRequiredFields: numberFromObject(
      objectOrEmpty(artifacts.baselineResolution.raw.summary),
      'missingRequiredFields',
    ),
    baselineDbWriteAllowed: booleanFromObject(
      objectOrEmpty(artifacts.baselineResolution.raw.summary),
      'destructiveDbWriteAllowedByThisPlan',
    ),
    baselineScopePreflightStatus: artifacts.baselineScopePreflight.status,
    baselineScopeEffectiveTarget: stringOrNull(
      artifacts.baselineScopePreflight.raw.summary &&
        typeof artifacts.baselineScopePreflight.raw.summary === 'object'
        ? (
            artifacts.baselineScopePreflight.raw.summary as Record<
              string,
              unknown
            >
          ).effectiveTargetScope
        : null,
    ),
    baselineScopeMissingInputs: numberFromObject(
      objectOrEmpty(artifacts.baselineScopePreflight.raw.summary),
      'missingRequiredInputs',
    ),
    baselineScopeBackupEvidenceProvided: booleanFromObject(
      objectOrEmpty(artifacts.baselineScopePreflight.raw.summary),
      'backupEvidenceProvided',
    ),
    backupEvidencePacketStatus: artifacts.backupEvidencePacket.status,
    backupEvidenceReady: booleanFromObject(
      objectOrEmpty(artifacts.backupEvidencePacket.raw.summary),
      'readyForBaselineResolutionInput',
    ),
    backupEvidenceMissingInputs: numberFromObject(
      objectOrEmpty(artifacts.backupEvidencePacket.raw.summary),
      'missingRequiredInputs',
    ),
    backupArtifactExists: booleanFromObject(
      objectOrEmpty(artifacts.backupEvidencePacket.raw.summary),
      'backupArtifactExists',
    ),
    baselineApprovalRequestStatus: artifacts.baselineApprovalRequest.status,
    baselineApprovalRequestReady: booleanFromObject(
      objectOrEmpty(artifacts.baselineApprovalRequest.raw.summary),
      'approvalRequestReady',
    ),
    baselineApprovalMissingInputs: numberFromObject(
      objectOrEmpty(artifacts.baselineApprovalRequest.raw.summary),
      'missingApprovalInputs',
    ),
    baselineRequiredFields: Array.isArray(
      artifacts.baselineResolution.raw.requiredFields,
    )
      ? artifacts.baselineResolution.raw.requiredFields
      : [],
  };
}

function buildExternalCandidateIntake(artifact: Artifact) {
  const intake = objectOrEmpty(artifact.raw.candidateIntake);
  const acceptedFileNames = Array.isArray(intake.acceptedFileNames)
    ? intake.acceptedFileNames.filter((item): item is string => {
        return typeof item === 'string' && item.trim().length > 0;
      })
    : [];
  const acceptedArchiveNames = stringList(intake.acceptedArchiveNames);
  const verificationChecklist = stringList(intake.verificationChecklist);
  const searchedRoots = stringList(intake.searchedRoots);
  const targetRows = candidateTargetRows(intake.targetRows);
  return {
    sourceArtifactPath: artifact.path,
    sourceArtifactStatus: artifact.status,
    status: stringOrNull(intake.status),
    candidateFilesPresent: numberOrNull(intake.candidateFilesPresent),
    candidateSqlFilesPresent: numberOrNull(intake.candidateSqlFilesPresent),
    candidateArchiveFilesPresent: numberOrNull(
      intake.candidateArchiveFilesPresent,
    ),
    generatedIntakeFilesPresent: numberOrNull(
      intake.generatedIntakeFilesPresent,
    ),
    candidateFiles: stringList(intake.candidateFiles),
    suggestedCandidateRoot: stringOrNull(intake.suggestedCandidateRoot),
    manifestPath: stringOrNull(intake.manifestPath),
    manifestDigestPath: stringOrNull(intake.manifestDigestPath),
    manifestSha256: stringOrNull(intake.manifestSha256),
    manifestSizeBytes: numberOrNull(intake.manifestSizeBytes),
    requestJsonPath: stringOrNull(intake.requestJsonPath),
    requestMarkdownPath: stringOrNull(intake.requestMarkdownPath),
    statusJsonPath: stringOrNull(intake.statusJsonPath),
    statusMarkdownPath: stringOrNull(intake.statusMarkdownPath),
    sourceReportPath: stringOrNull(intake.sourceReportPath),
    sourceMarkdownPath: stringOrNull(intake.sourceMarkdownPath),
    acceptedFileNames,
    acceptedArchiveNames,
    verificationCommand: stringOrNull(intake.verificationCommand),
    guardrail: stringOrNull(intake.guardrail),
    verificationChecklist,
    searchedRoots,
    targetRows,
  };
}

function extractUnresolvedMismatches(artifact: Artifact) {
  return artifact.rows
    .filter((row): row is Record<string, unknown> => {
      if (!row || typeof row !== 'object') return false;
      const exactLocations = (row as Record<string, unknown>)
        .exactMatchLocations;
      return !Array.isArray(exactLocations) || exactLocations.length === 0;
    })
    .map((row) => ({
      migration: stringOrNull(row.migration),
      dbChecksum: stringOrNull(row.dbChecksum),
      selectedRecoveredFromSpec: stringOrNull(row.selectedRecoveredFromSpec),
      selectedRecoveredSqlSha256: stringOrNull(row.selectedRecoveredSqlSha256),
      disposition: stringOrNull(row.disposition),
      decisionRequired: stringOrNull(row.decisionRequired),
    }));
}

function extractMigrationHistoryBlockers(artifact: Artifact) {
  return artifact.rows
    .filter((row): row is Record<string, unknown> => {
      if (!row || typeof row !== 'object') return false;
      const disposition = stringOrNull(
        (row as Record<string, unknown>).disposition,
      );
      return Boolean(disposition && disposition !== 'already-present');
    })
    .map((row) => ({
      migration: stringOrNull(row.migration),
      dbChecksum: stringOrNull(row.dbChecksum),
      selectedRecoveredFromSpec: stringOrNull(row.selectedRecoveredFromSpec),
      selectedRecoveredSqlSha256: stringOrNull(
        row.selectedRecoveredSqlSha256 ?? row.recoveredSqlSha256,
      ),
      disposition: stringOrNull(row.disposition),
      decisionRequired:
        stringOrNull(row.decisionRequired) ??
        (row.disposition === 'unrecoverable'
          ? 'recover-exact-sql-from-external-artifact-or-approve-nonproduction-baseline'
          : 'review-and-restore-checksum-matched-migration-sql'),
    }));
}

function buildMissingEvidence(
  artifacts: Record<string, Artifact>,
  summary: Record<string, unknown>,
) {
  const required = [
    artifacts.schemaWorklist,
    artifacts.migrationReconciliation,
    artifacts.restoreCandidateBundle,
    artifacts.checksumReview,
    artifacts.baselineResolution,
  ];
  if (numberValue(summary.unrecoverableRows) > 0) {
    required.push(artifacts.unrecoverableArtifactSearch);
  }
  if (
    numberValue(summary.openMigrationBlockers) > 0 &&
    numberValue(summary.exactSqlArtifactMatches) === 0
  ) {
    required.push(artifacts.checksumVariantAnalysis);
    required.push(artifacts.localArtifactSearch);
    required.push(artifacts.externalArtifactPacket);
  }
  return required
    .filter((artifact) => !artifact.exists)
    .map((artifact) => ({
      kind: artifact.kind,
      path: artifact.path,
      error: artifact.error,
    }));
}

function chooseStatus(
  summary: Record<string, unknown>,
  baselineResolutionStatus: string | null,
  missingEvidence: Array<Record<string, unknown>>,
): ProposalStatus {
  const openMigrationBlockers = numberValue(summary.openMigrationBlockers);
  const exactSqlArtifactMatches = numberValue(summary.exactSqlArtifactMatches);
  if (openMigrationBlockers === 0) return 'PASS_NO_DB_MIGRATION_BLOCKER';
  if (missingEvidence.length > 0) return 'BLOCKED_INSUFFICIENT_EVIDENCE';
  if (baselineResolutionStatus === 'REVIEW_APPROVED_EXACT_SQL_RESTORE') {
    return 'REVIEW_APPROVED_EXACT_SQL_RESTORE';
  }
  if (exactSqlArtifactMatches > 0) return 'REVIEW_EXACT_SQL_ARTIFACT_FOUND';
  if (baselineResolutionStatus === 'REVIEW_APPROVED_BASELINE_RESOLUTION') {
    return 'REVIEW_APPROVED_BASELINE_RESOLUTION';
  }
  return 'BASELINE_PROPOSAL_READY_REVIEW_REQUIRED';
}

function buildBaselineDecisionHandoff(artifact: Artifact) {
  const summary = objectOrEmpty(artifact.raw.summary);
  return {
    status: artifact.status,
    generatedAt: artifact.generatedAt,
    path: artifact.path,
    approvalReady: booleanFromObject(summary, 'approvalReady'),
    destructiveDbWriteAllowedByThisPlan: booleanFromObject(
      summary,
      'destructiveDbWriteAllowedByThisPlan',
    ),
    summary,
    requiredOperatorInputs: Array.isArray(artifact.raw.requiredOperatorInputs)
      ? artifact.raw.requiredOperatorInputs
      : [],
    operatorGuardrails: objectOrEmpty(artifact.raw.operatorGuardrails),
    recommendedNextStep: objectOrEmpty(artifact.raw.recommendedNextStep),
  };
}

function buildDecisionPacket(
  args: Args,
  status: ProposalStatus,
  openMigrationRows: Array<Record<string, unknown>>,
) {
  const evidenceArgs = buildBaselineResolutionEvidenceArgs(args);
  const exactRestoreReview =
    status === 'REVIEW_EXACT_SQL_ARTIFACT_FOUND' ||
    status === 'REVIEW_APPROVED_EXACT_SQL_RESTORE';
  const requiredHumanInputs = exactRestoreReview
    ? [
        '--decision restore-exact-sql',
        '--approved-operator-workflow <approved workflow id>',
        `--operator-ack ${REQUIRED_ACK}`,
        '--rationale <why this exact SQL artifact is trusted for restore review>',
      ]
    : [
        '--decision baseline-resolve-local-only',
        `--target-scope <${SUPPORTED_BASELINE_SCOPES.join('|')}>`,
        '--approved-operator-workflow <approved workflow id>',
        `--operator-ack ${REQUIRED_ACK}`,
        '--rationale <why exact SQL cannot be recovered and why this target may be resolved>',
        '--backup-evidence <backup, disposable DB, or staging clone evidence>',
      ];
  const auditOnlyCommandTemplate = exactRestoreReview
    ? `pnpm --filter api audit:database-migration-baseline-resolution -- ${evidenceArgs} --decision restore-exact-sql --approved-operator-workflow <id> --operator-ack ${REQUIRED_ACK} --rationale <text> --out /tmp/database-migration-baseline-resolution-exact-sql-approved.json`
    : `pnpm --filter api audit:database-migration-baseline-resolution -- ${evidenceArgs} --decision baseline-resolve-local-only --target-scope <local-existing|local-disposable|staging-clone> --approved-operator-workflow <id> --operator-ack ${REQUIRED_ACK} --rationale <text> --backup-evidence <text> --out /tmp/database-migration-baseline-resolution-approved.json`;
  return {
    purpose:
      'Consolidate exact-SQL exhaustion evidence before a human operator chooses external restore or non-production baseline resolve.',
    preferredPath:
      status === 'REVIEW_EXACT_SQL_ARTIFACT_FOUND'
        ? 'review-and-restore-exact-sql-artifact'
        : 'continue-external-search-or-baseline-resolve-local-only',
    prohibitedScopes: ['production'],
    supportedBaselineTargetScopes: SUPPORTED_BASELINE_SCOPES,
    requiredAck: REQUIRED_ACK,
    requiredHumanInputs,
    unresolvedMigrations: openMigrationRows.map((row) => row.migration),
    auditOnlyCommandTemplate,
    platformAuditCommandTemplate: `pnpm --filter api audit:platform-data-closure -- --schema-worklist ${args.schemaWorklist ?? '<schema-worklist.json>'} --migration-reconciliation ${args.migrationReconciliation ?? '<reconciliation.json>'} --restore-candidate-bundle ${args.restoreCandidateBundle ?? '<restore-bundle.json>'} --checksum-review ${args.checksumReview ?? '<checksum-review.json>'} --checksum-variant-analysis ${args.checksumVariantAnalysis ?? '<checksum-variant-analysis.json>'} --unrecoverable-artifact-search ${args.unrecoverableArtifactSearch ?? '<unrecoverable-artifact-search.json>'} --local-artifact-search ${args.localArtifactSearch ?? '<local-artifact-search.json>'} --external-artifact-packet ${args.externalArtifactPacket ?? '<external-artifact-packet.json>'} --baseline-resolution ${args.baselineResolution ?? '<baseline-resolution.json>'} --baseline-scope-preflight ${args.baselineScopePreflight ?? '<baseline-scope-preflight.json>'} --backup-evidence-packet ${args.backupEvidencePacket ?? '<backup-evidence-packet.json>'} --baseline-approval-request ${args.baselineApprovalRequest ?? '<baseline-approval-request.json>'} --baseline-proposal ${args.out}`,
    writeCommandsIntentionallyOmitted:
      'This proposal packet does not include prisma migrate resolve, migrate deploy, db push, SQL restore, or migration-directory writes.',
  };
}

function buildBaselineResolutionEvidenceArgs(args: Args) {
  const values = [
    `--checksum-review ${args.checksumReview ?? '<checksum-review.json>'}`,
    `--external-artifact-packet ${args.externalArtifactPacket ?? '<external-artifact-packet.json>'}`,
  ];
  if (args.unrecoverableArtifactSearch) {
    values.push(
      `--unrecoverable-artifact-search ${args.unrecoverableArtifactSearch}`,
    );
  }
  return values.join(' ');
}

function buildRecommendedSequence(status: ProposalStatus) {
  if (status === 'PASS_NO_DB_MIGRATION_BLOCKER') {
    return [
      'Rerun schema compatibility and platform closure audit.',
      'Continue with the next DB-backed P0/P1 data worklist.',
    ];
  }
  if (status === 'REVIEW_EXACT_SQL_ARTIFACT_FOUND') {
    return [
      'Review the exact SQL artifact candidate and restore it through an approved migration-history workflow.',
      'Rerun migration reconciliation, checksum review, local/external artifact checks, and platform closure audit.',
    ];
  }
  if (status === 'REVIEW_APPROVED_EXACT_SQL_RESTORE') {
    return [
      'Use the approved exact-SQL restore artifact as operator review evidence.',
      'Restore the exact SQL migration only through the approved migration-history workflow outside this read-only script.',
      'Rerun migration reconciliation, checksum review, schema compatibility, and platform closure audit.',
    ];
  }
  if (status === 'REVIEW_APPROVED_BASELINE_RESOLUTION') {
    return [
      'Use the approved non-production baseline-resolution artifact as operator review evidence.',
      'Run any Prisma resolve/deploy step only outside this read-only script, on the approved target scope, after backup/clone confirmation.',
      'Rerun schema compatibility, migration reconciliation, checksum review, and platform closure audit.',
    ];
  }
  if (status === 'BLOCKED_INSUFFICIENT_EVIDENCE') {
    return [
      'Regenerate the missing schema/migration recovery artifacts.',
      'Rerun this proposal packet after schema worklist, reconciliation, checksum review, local/external artifact search, and baseline resolution reports exist.',
    ];
  }
  return [
    'Request the exact applied SQL from deployment artifacts, backups, or teammate clones.',
    'If exact SQL remains unrecoverable, obtain an explicit non-production baseline/resolve approval using the required acknowledgement and backup evidence.',
    'Only after an external restore or approved resolve decision, rerun the DB compatibility chain and platform closure audit.',
  ];
}

function buildNextCampaign(
  status: ProposalStatus,
  summary?: Record<string, unknown>,
) {
  if (status === 'PASS_NO_DB_MIGRATION_BLOCKER') {
    return {
      id: 'database_schema_compatibility',
      reason:
        'Migration blocker cleared in evidence; rerun the DB-backed closure gate.',
    };
  }
  if (status === 'REVIEW_EXACT_SQL_ARTIFACT_FOUND') {
    return {
      id: 'database_migration_exact_sql_restore_review',
      reason:
        'An exact SQL artifact candidate exists and should be reviewed before any baseline path.',
    };
  }
  if (status === 'REVIEW_APPROVED_EXACT_SQL_RESTORE') {
    return {
      id: 'database_migration_exact_sql_restore_operator_review',
      reason:
        'An exact SQL restore approval artifact exists; operator restore and rerun evidence are now required.',
    };
  }
  if (status === 'REVIEW_APPROVED_BASELINE_RESOLUTION') {
    return {
      id: 'database_migration_baseline_operator_review',
      reason:
        'A non-production baseline approval artifact exists; operator resolve/deploy and rerun evidence are now required.',
    };
  }
  if (status === 'BLOCKED_INSUFFICIENT_EVIDENCE') {
    return {
      id: 'database_migration_recovery_artifact_regeneration',
      reason:
        'The baseline proposal cannot be evaluated until required recovery artifacts exist.',
    };
  }
  if (
    status === 'BASELINE_PROPOSAL_READY_REVIEW_REQUIRED' &&
    summary?.baselineApprovalRequestStatus ===
      'REVIEW_OPERATOR_APPROVAL_REQUIRED'
  ) {
    return {
      id: 'database_migration_operator_approval',
      reason:
        'The approval request packet is ready; a human workflow id and exact acknowledgement are now the remaining blocker.',
    };
  }
  if (
    status === 'BASELINE_PROPOSAL_READY_REVIEW_REQUIRED' &&
    numberValue(summary?.exactSqlArtifactMatches) === 0 &&
    (summary?.localArtifactSearchStatus === 'BLOCKED_EXACT_SQL_NOT_FOUND' ||
      summary?.externalArtifactPacketStatus ===
        'BLOCKED_EXTERNAL_ARTIFACT_REQUIRED' ||
      summary?.unrecoverableArtifactSearchStatus ===
        'UNRECOVERABLE_ARTIFACT_SEARCH_READY_NO_MATCH')
  ) {
    return {
      id: 'database_migration_external_exact_sql_recovery',
      reason:
        'Exact SQL is still unrecovered after checksum, variant, local, unrecoverable, and external artifact evidence; request deployment/backup/team-clone artifacts before baseline fallback.',
      candidateRoot: summary?.externalCandidateIntakeRoot ?? null,
      manifestPath: summary?.externalCandidateManifestPath ?? null,
      manifestDigestPath: summary?.externalCandidateManifestDigestPath ?? null,
      manifestSha256: summary?.externalCandidateManifestSha256 ?? null,
      manifestSizeBytes: summary?.externalCandidateManifestSizeBytes ?? null,
      requestJsonPath: summary?.externalCandidateRequestJsonPath ?? null,
      requestMarkdownPath:
        summary?.externalCandidateRequestMarkdownPath ?? null,
      statusJsonPath: summary?.externalCandidateStatusJsonPath ?? null,
      statusMarkdownPath: summary?.externalCandidateStatusMarkdownPath ?? null,
      candidateFilesPresent: summary?.externalCandidateFilesPresent ?? null,
      candidateSqlFilesPresent:
        summary?.externalCandidateSqlFilesPresent ?? null,
      candidateArchiveFilesPresent:
        summary?.externalCandidateArchiveFilesPresent ?? null,
      generatedIntakeFilesPresent:
        summary?.externalCandidateGeneratedIntakeFilesPresent ?? null,
      verificationCommand:
        summary?.externalCandidateVerificationCommand ?? null,
      acceptedArchiveNames:
        summary?.externalCandidateAcceptedArchiveNames ?? [],
      targetRows: candidateTargetRows(summary?.externalCandidateTargetRows),
    };
  }
  if (
    status === 'BASELINE_PROPOSAL_READY_REVIEW_REQUIRED' &&
    summary?.backupEvidencePacketStatus === 'BLOCKED_BACKUP_EVIDENCE_REQUIRED'
  ) {
    return {
      id: 'database_migration_backup_or_disposable_target_evidence',
      reason:
        'Baseline scope preflight identified a local existing target, but backup/disposable/staging-clone evidence is still missing.',
    };
  }
  if (
    status === 'BASELINE_PROPOSAL_READY_REVIEW_REQUIRED' &&
    summary?.backupEvidencePacketStatus ===
      'REVIEW_BACKUP_OR_DISPOSABLE_TARGET_READY'
  ) {
    return {
      id: 'database_migration_baseline_resolution_approval',
      reason:
        'Backup/disposable target evidence is ready; the explicit baseline-resolution approval gate is the next blocker.',
    };
  }
  return {
    id: 'database_migration_external_artifact_or_baseline_approval',
    reason:
      'Exact SQL was not found locally; an external artifact or explicit non-production baseline approval is now the blocking decision.',
  };
}

function renderMarkdown(report: Record<string, any>) {
  const summary = report.summary as Record<string, unknown>;
  const externalCandidateIntake = objectOrEmpty(report.externalCandidateIntake);
  const externalCandidateTargetRows = candidateTargetRows(
    externalCandidateIntake.targetRows,
  );
  const lines = [
    '# Database Migration Baseline Proposal Packet',
    '',
    `Status: ${report.status}`,
    '',
    'This is a read-only proposal packet. It does not restore migration files, run Prisma resolve/deploy, or write to the database.',
    '',
    '## Summary',
    '',
    `- Schema worklist: ${summary.schemaWorklistStatus ?? 'unknown'} (${summary.schemaRows ?? 0} rows)`,
    `- Missing tables/columns: ${summary.missingTables ?? 0}/${summary.missingColumns ?? 0}`,
    `- Unapplied repo migrations: ${summary.unappliedRepoMigrations ?? 0}`,
    `- DB-applied migrations missing from repo: ${summary.appliedMigrationsMissingFromRepo ?? 0}`,
    `- Open migration blockers: ${summary.openMigrationBlockers ?? 0}`,
    `- Reconciliation: ${summary.reconciliationStatus ?? 'unknown'}; checksum matches/mismatches: ${summary.checksumMatchedRows ?? 0}/${summary.checksumMismatchRows ?? 0}`,
    `- Unrecoverable migration rows: ${summary.unrecoverableRows ?? 0}`,
    `- Restore bundle: ${summary.restoreBundleStatus ?? 'unknown'}; staged/blocked: ${summary.stagedRestoreCandidates ?? 0}/${summary.restoreBundleBlockedRows ?? 0}`,
    `- Checksum review: ${summary.checksumReviewStatus ?? 'unknown'}; unresolved mismatches: ${summary.unresolvedChecksumMismatches ?? 0}`,
    `- Checksum variant analysis: ${summary.checksumVariantAnalysisStatus ?? 'unknown'}; checks=${summary.checksumVariantChecks ?? 0}; exact variant matches=${summary.checksumVariantExactMatches ?? 0}`,
    `- Unrecoverable artifact search: ${summary.unrecoverableArtifactSearchStatus ?? 'unknown'}; exact matches=${summary.unrecoverableArtifactMatches ?? 0}; archives=${summary.unrecoverableArchivesScanned ?? 0}; archive entries=${summary.unrecoverableArchiveEntriesScanned ?? 0}`,
    `- Local/external exact SQL matches: ${summary.exactSqlArtifactMatches ?? 0}`,
    `- Baseline resolution: ${summary.baselineResolutionStatus ?? 'unknown'}; decision=${summary.baselineDecision ?? 'unknown'}; approvalReady=${summary.baselineApprovalReady ?? false}; missingInputs=${summary.baselineMissingRequiredFields ?? 0}; dbWriteAllowed=${summary.baselineDbWriteAllowed ?? false}`,
    `- Baseline scope preflight: ${summary.baselineScopePreflightStatus ?? 'unknown'}; target=${summary.baselineScopeEffectiveTarget ?? 'unknown'}; missingInputs=${summary.baselineScopeMissingInputs ?? 0}; backupEvidence=${summary.baselineScopeBackupEvidenceProvided ?? false}`,
    `- Backup evidence packet: ${summary.backupEvidencePacketStatus ?? 'unknown'}; ready=${summary.backupEvidenceReady ?? false}; missingInputs=${summary.backupEvidenceMissingInputs ?? 0}; artifactExists=${summary.backupArtifactExists ?? false}`,
    `- Baseline approval request: ${summary.baselineApprovalRequestStatus ?? 'unknown'}; ready=${summary.baselineApprovalRequestReady ?? false}; missingInputs=${summary.baselineApprovalMissingInputs ?? 0}`,
    '',
    '## External Candidate Intake',
    '',
    `- Status: ${externalCandidateIntake.status ?? 'unknown'}`,
    `- Suggested candidate root: ${externalCandidateIntake.suggestedCandidateRoot ?? 'unknown'}`,
    `- Machine-readable target manifest: ${externalCandidateIntake.manifestPath ?? 'unknown'}`,
    `- Target manifest digest sidecar: ${externalCandidateIntake.manifestDigestPath ?? 'unknown'}`,
    `- Target manifest SHA-256: ${externalCandidateIntake.manifestSha256 ?? 'unknown'}`,
    `- Target manifest size bytes: ${externalCandidateIntake.manifestSizeBytes ?? 'unknown'}`,
    `- Exact SQL request JSON: ${externalCandidateIntake.requestJsonPath ?? 'unknown'}`,
    `- Exact SQL request Markdown: ${externalCandidateIntake.requestMarkdownPath ?? 'unknown'}`,
    `- Intake status JSON: ${externalCandidateIntake.statusJsonPath ?? 'unknown'}`,
    `- Intake status Markdown: ${externalCandidateIntake.statusMarkdownPath ?? 'unknown'}`,
    `- Candidate files present: ${externalCandidateIntake.candidateFilesPresent ?? 'unknown'}`,
    `- Candidate SQL files present: ${externalCandidateIntake.candidateSqlFilesPresent ?? 'unknown'}`,
    `- Candidate archive files present: ${externalCandidateIntake.candidateArchiveFilesPresent ?? 'unknown'}`,
    `- Generated intake files present: ${externalCandidateIntake.generatedIntakeFilesPresent ?? 'unknown'}`,
    `- Manifest source report: ${externalCandidateIntake.sourceReportPath ?? 'unknown'}`,
    `- Manifest source Markdown: ${externalCandidateIntake.sourceMarkdownPath ?? 'unknown'}`,
    `- Accepted file names: ${Array.isArray(externalCandidateIntake.acceptedFileNames) ? externalCandidateIntake.acceptedFileNames.join(', ') : 'unknown'}`,
    `- Accepted archive names: ${Array.isArray(externalCandidateIntake.acceptedArchiveNames) ? externalCandidateIntake.acceptedArchiveNames.join(', ') : 'unknown'}`,
    `- Verification command: ${externalCandidateIntake.verificationCommand ?? 'unknown'}`,
    `- Guardrail: ${externalCandidateIntake.guardrail ?? 'unknown'}`,
    `- Searched roots: ${Array.isArray(externalCandidateIntake.searchedRoots) ? externalCandidateIntake.searchedRoots.join(', ') : 'unknown'}`,
    `- Candidate files: ${Array.isArray(externalCandidateIntake.candidateFiles) && externalCandidateIntake.candidateFiles.length > 0 ? externalCandidateIntake.candidateFiles.join(', ') : 'none'}`,
    '- Verification checklist:',
    ...(Array.isArray(externalCandidateIntake.verificationChecklist) &&
    externalCandidateIntake.verificationChecklist.length > 0
      ? externalCandidateIntake.verificationChecklist.map(
          (item: unknown) => `  - ${item}`,
        )
      : ['  - unknown']),
    '',
    '### Candidate Intake Targets',
    '',
    ...(externalCandidateTargetRows.length > 0
      ? externalCandidateTargetRows.flatMap((target) => [
          `- Migration: ${target.migration ?? 'unknown'}`,
          `  - Request subject: ${target.requestSubject ?? 'unknown'}`,
          `  - Source kind: ${target.sourceKind ?? 'unknown'}`,
          `  - Target path: ${target.targetMigrationPath ?? 'unknown'}`,
          `  - Required SHA-256: ${target.requiredSha256 ?? 'unknown'}`,
        ])
      : ['- unknown']),
    '',
    '## Open Migration History Rows',
    '',
    ...renderUnresolvedRows(report.migrationHistoryBlockers ?? []),
    '',
    '## Unresolved Checksum Mismatches',
    '',
    ...renderUnresolvedRows(report.unresolvedMismatches ?? []),
    '',
    '## Baseline Decision Handoff',
    '',
    ...renderBaselineDecisionHandoff(report.baselineDecisionHandoff),
    '',
    '## Required Human Inputs',
    '',
    ...report.decisionPacket.requiredHumanInputs.map(
      (item: string) => `- ${item}`,
    ),
    '',
    '## Recommended Sequence',
    '',
    ...report.recommendedSequence.map((item: string) => `- ${item}`),
  ];
  return `${lines.join('\n')}\n`;
}

function renderBaselineDecisionHandoff(handoff: Record<string, any>) {
  const summary = objectOrEmpty(handoff.summary);
  const guardrails = objectOrEmpty(handoff.operatorGuardrails);
  const nextStep = objectOrEmpty(handoff.recommendedNextStep);
  const inputs = Array.isArray(handoff.requiredOperatorInputs)
    ? handoff.requiredOperatorInputs
    : [];
  return [
    `- Status: ${handoff.status ?? 'unknown'}`,
    `- Approval ready: ${String(handoff.approvalReady ?? false)}`,
    `- DB writes allowed by this proposal: ${String(handoff.destructiveDbWriteAllowedByThisPlan ?? false)}`,
    `- Decision: ${summary.decision ?? 'unknown'}`,
    `- Missing required fields: ${summary.missingRequiredFields ?? 0}`,
    `- Recommended next step: ${nextStep.id ?? 'unknown'} - ${nextStep.action ?? 'continue review'}`,
    `- Guardrail omitted write commands: ${Array.isArray(guardrails.writeCommandsIntentionallyOmitted) ? guardrails.writeCommandsIntentionallyOmitted.join(', ') : 'none'}`,
    ...inputs.map((input: Record<string, unknown>) =>
      [
        `- Operator input ${input.key ?? 'unknown'}`,
        `  - required: ${String(input.required ?? false)}`,
        `  - provided: ${String(input.provided ?? false)}`,
        `  - expected: ${input.expected ?? 'unknown'}`,
        `  - actual: ${input.actual ?? 'none'}`,
      ].join('\n'),
    ),
  ];
}

function renderUnresolvedRows(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return ['- None'];
  return rows.map(
    (row) =>
      `- ${row.migration ?? 'unknown'}: dbChecksum=${row.dbChecksum ?? 'unknown'}, recoveredSha=${row.selectedRecoveredSqlSha256 ?? 'unknown'}, disposition=${row.disposition ?? 'unknown'}`,
  );
}

function numberFromSummary(artifact: Artifact, key: string) {
  const value = artifact.summary[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function numberFromObject(value: Record<string, unknown>, key: string) {
  const next = value[key];
  return typeof next === 'number' && Number.isFinite(next) ? next : 0;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function booleanFromObject(value: Record<string, unknown>, key: string) {
  return value[key] === true;
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0,
      )
    : [];
}

function candidateTargetRows(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter(
          (row): row is Record<string, unknown> =>
            row !== null && typeof row === 'object' && !Array.isArray(row),
        )
        .map((row) => ({
          migration: stringOrNull(row.migration),
          sourceKind: stringOrNull(row.sourceKind),
          targetMigrationPath: stringOrNull(row.targetMigrationPath),
          requiredSha256: stringOrNull(row.requiredSha256),
          requestSubject: stringOrNull(row.requestSubject),
        }))
    : [];
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function printSummary(
  out: string,
  markdown: string,
  report: Record<string, any>,
) {
  console.log(`Database migration baseline proposal status: ${report.status}`);
  console.log(
    `Unresolved checksum mismatches: ${report.summary.unresolvedChecksumMismatches}`,
  );
  console.log(
    `Open migration blockers: ${report.summary.openMigrationBlockers}`,
  );
  console.log(
    `Exact SQL artifact matches: ${report.summary.exactSqlArtifactMatches}`,
  );
  console.log(`JSON: ${out}`);
  console.log(`Markdown: ${markdown}`);
}

main();
