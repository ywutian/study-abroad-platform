#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type HandoffStatus =
  | 'DATABASE_SCHEMA_OPERATOR_HANDOFF_READY'
  | 'DATABASE_SCHEMA_OPERATOR_HANDOFF_READY_WITH_BLOCKERS'
  | 'BLOCKED_HANDOFF_INPUT_MISSING'
  | 'BLOCKED_HANDOFF_UNMAPPED_ROWS';

interface Args {
  schemaDisposition: string | null;
  schemaWorklist: string | null;
  migrationReconciliation: string | null;
  restoreCandidateBundle: string | null;
  baselineProposal: string | null;
  out: string;
  markdown: string;
  csv: string;
}

interface Artifact {
  path: string | null;
  found: boolean;
  generatedAt: string | null;
  status: string | null;
  summary: Record<string, unknown>;
  rows: Record<string, unknown>[];
  raw: Record<string, unknown>;
}

interface HandoffRow {
  phase: string;
  sequence: number;
  objectType: string | null;
  blocker: string | null;
  closureState: string | null;
  disposition: string | null;
  operatorAction: string;
  codexCanExecute: false;
  releaseImpact: string | null;
  migration: string | null;
  model: string | null;
  table: string | null;
  column: string | null;
  restoreCandidatePath: string | null;
  dbChecksum: string | null;
  recoveredSqlSha256: string | null;
  evidence: string[];
}

interface BaselineProposalGuidance {
  status: string | null;
  nextCampaignId: string | null;
  nextCampaignReason: string | null;
  externalCandidateIntakeStatus: string | null;
  externalCandidateIntakeRoot: string | null;
  externalCandidateManifestPath: string | null;
  externalCandidateManifestDigestPath: string | null;
  externalCandidateManifestSha256: string | null;
  externalCandidateManifestSizeBytes: number;
  externalCandidateFilesPresent: number;
  externalCandidateSqlFilesPresent: number;
  externalCandidateArchiveFilesPresent: number;
  externalCandidateGeneratedIntakeFilesPresent: number;
  externalCandidateFiles: string[];
  externalCandidateRequestJsonPath: string | null;
  externalCandidateRequestMarkdownPath: string | null;
  externalCandidateStatusJsonPath: string | null;
  externalCandidateStatusMarkdownPath: string | null;
  externalCandidateVerificationCommand: string | null;
  externalCandidateAcceptedArchiveNames: string[];
  externalCandidateVerificationChecklist: string[];
  externalCandidateSearchedRoots: string[];
  externalCandidateTargetRows: ExternalCandidateTargetRow[];
  exactSqlArtifactMatches: number;
  localArtifactSearchStatus: string | null;
  externalArtifactPacketStatus: string | null;
  baselineResolutionStatus: string | null;
  backupEvidencePacketStatus: string | null;
  baselineApprovalRequestStatus: string | null;
}

interface ExternalCandidateTargetRow {
  migration: string | null;
  sourceKind: string | null;
  targetMigrationPath: string | null;
  requiredSha256: string | null;
  requestSubject: string | null;
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
  const optionalPath = (name: string, pattern: RegExp) => {
    const value = get(name);
    return value ? path.resolve(API_ROOT, value) : findLatest(pattern);
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(REPORT_ROOT, `database-schema-operator-handoff-${stamp}.json`),
    )!,
  );
  return {
    schemaDisposition: optionalPath(
      '--schema-disposition',
      /^database-schema-disposition-.+\.json$/,
    ),
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
    baselineProposal: optionalPath(
      '--baseline-proposal',
      /^database-migration-baseline-proposal-.+\.json$/,
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
  const artifacts = {
    schemaDisposition: readArtifact(args.schemaDisposition),
    schemaWorklist: readArtifact(args.schemaWorklist),
    migrationReconciliation: readArtifact(args.migrationReconciliation),
    restoreCandidateBundle: readArtifact(args.restoreCandidateBundle),
    baselineProposal: readArtifact(args.baselineProposal),
  };

  if (!artifacts.schemaDisposition.found) {
    const report = buildBlockedReport(
      args,
      'BLOCKED_HANDOFF_INPUT_MISSING',
      artifacts,
      'database-schema-disposition artifact is required',
    );
    writeReport(args, report);
    printSummary(args, report);
    process.exitCode = 1;
    return;
  }

  const restoreByMigration = new Map(
    arrayRecords(artifacts.restoreCandidateBundle.raw.staged).map((row) => [
      stringOrNull(row.migration),
      row,
    ]),
  );
  const baselineGuidance = buildBaselineProposalGuidance(
    artifacts.baselineProposal,
  );
  const reconciliationByMigration = new Map(
    artifacts.migrationReconciliation.rows.map((row) => [
      stringOrNull(row.migration),
      row,
    ]),
  );
  const rows = artifacts.schemaDisposition.rows.map((row) =>
    buildHandoffRow(
      row,
      restoreByMigration,
      reconciliationByMigration,
      baselineGuidance,
    ),
  );
  const unmappedRows = rows.filter((row) => row.phase === '00_unmapped');
  const blockingRows = rows.filter(
    (row) => row.releaseImpact === 'blocks-db-backed-closure',
  );
  const status: HandoffStatus =
    unmappedRows.length > 0
      ? 'BLOCKED_HANDOFF_UNMAPPED_ROWS'
      : blockingRows.length > 0
        ? 'DATABASE_SCHEMA_OPERATOR_HANDOFF_READY_WITH_BLOCKERS'
        : 'DATABASE_SCHEMA_OPERATOR_HANDOFF_READY';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-schema-operator-handoff',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    writesToPrismaMigrationDir: false,
    artifacts: summarizeArtifacts(artifacts),
    summary: {
      totalRows: rows.length,
      blockingRows: blockingRows.length,
      unmappedRows: unmappedRows.length,
      restoreCandidateRows: countWhere(
        rows,
        (row) => row.phase === '01_review_checksum_matched_restore_candidate',
      ),
      unrecoverableMigrationRows: countWhere(
        rows,
        (row) => row.phase === '02_external_artifact_or_baseline_review',
      ),
      extraObjectReviewRows: countWhere(
        rows,
        (row) => row.phase === '03_review_extra_db_object_drift',
      ),
      currentRepoApplyRows: countWhere(
        rows,
        (row) =>
          row.phase === '04_apply_current_repo_migration_after_history_closed',
      ),
      baselineProposalStatus: baselineGuidance.status,
      baselineProposalNextCampaign: baselineGuidance.nextCampaignId,
      externalCandidateIntakeStatus:
        baselineGuidance.externalCandidateIntakeStatus,
      externalCandidateIntakeRoot: baselineGuidance.externalCandidateIntakeRoot,
      externalCandidateManifestPath:
        baselineGuidance.externalCandidateManifestPath,
      externalCandidateManifestDigestPath:
        baselineGuidance.externalCandidateManifestDigestPath,
      externalCandidateManifestSha256:
        baselineGuidance.externalCandidateManifestSha256,
      externalCandidateManifestSizeBytes:
        baselineGuidance.externalCandidateManifestSizeBytes,
      externalCandidateFilesPresent:
        baselineGuidance.externalCandidateFilesPresent,
      externalCandidateSqlFilesPresent:
        baselineGuidance.externalCandidateSqlFilesPresent,
      externalCandidateArchiveFilesPresent:
        baselineGuidance.externalCandidateArchiveFilesPresent,
      externalCandidateGeneratedIntakeFilesPresent:
        baselineGuidance.externalCandidateGeneratedIntakeFilesPresent,
      externalCandidateFiles: baselineGuidance.externalCandidateFiles,
      externalCandidateRequestJsonPath:
        baselineGuidance.externalCandidateRequestJsonPath,
      externalCandidateRequestMarkdownPath:
        baselineGuidance.externalCandidateRequestMarkdownPath,
      externalCandidateStatusJsonPath:
        baselineGuidance.externalCandidateStatusJsonPath,
      externalCandidateStatusMarkdownPath:
        baselineGuidance.externalCandidateStatusMarkdownPath,
      externalCandidateVerificationCommand:
        baselineGuidance.externalCandidateVerificationCommand,
      externalCandidateAcceptedArchiveNames:
        baselineGuidance.externalCandidateAcceptedArchiveNames,
      externalCandidateVerificationChecklist:
        baselineGuidance.externalCandidateVerificationChecklist,
      externalCandidateSearchedRoots:
        baselineGuidance.externalCandidateSearchedRoots,
      externalCandidateTargetRows: baselineGuidance.externalCandidateTargetRows,
      exactSqlArtifactMatches: baselineGuidance.exactSqlArtifactMatches,
      localArtifactSearchStatus: baselineGuidance.localArtifactSearchStatus,
      externalArtifactPacketStatus:
        baselineGuidance.externalArtifactPacketStatus,
      baselineResolutionStatus: baselineGuidance.baselineResolutionStatus,
      backupEvidencePacketStatus: baselineGuidance.backupEvidencePacketStatus,
      baselineApprovalRequestStatus:
        baselineGuidance.baselineApprovalRequestStatus,
      byPhase: countBy(rows, (row) => row.phase),
      byOperatorAction: countBy(rows, (row) => row.operatorAction),
    },
    baselineProposalGuidance: baselineGuidance,
    recommendedSequence: buildRecommendedSequence(baselineGuidance),
    guardrails: {
      codexMayDo:
        'Generate read-only evidence, review packets, checksums, and operator handoff artifacts.',
      codexMustNotDo:
        'Do not run prisma migrate deploy/dev/resolve, db push, pg_restore, SQL restore, or copy staged migrations into prisma/migrations without explicit operator approval.',
    },
    nextCampaign: buildNextCampaign(rows, baselineGuidance),
    rows,
  };
  writeReport(args, report);
  printSummary(args, report);
  if (unmappedRows.length > 0) process.exitCode = 1;
}

function buildBlockedReport(
  args: Args,
  status: HandoffStatus,
  artifacts: Record<string, Artifact>,
  blocker: string,
) {
  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-schema-operator-handoff',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    writesToPrismaMigrationDir: false,
    artifacts: summarizeArtifacts(artifacts),
    summary: {
      totalRows: 0,
      blockingRows: 1,
      unmappedRows: 0,
      blocker,
    },
    nextCampaign: {
      id: 'database_schema_disposition_required',
      reason: blocker,
      recommendedAction: 'run-audit-database-schema-disposition',
    },
    rows: [],
  };
}

function buildHandoffRow(
  row: Record<string, unknown>,
  restoreByMigration: Map<string | null, Record<string, unknown>>,
  reconciliationByMigration: Map<string | null, Record<string, unknown>>,
  baselineGuidance: BaselineProposalGuidance,
): HandoffRow {
  const disposition = stringOrNull(row.disposition);
  const migration = stringOrNull(row.migration);
  const restore = migration ? restoreByMigration.get(migration) : null;
  const reconciliation = migration
    ? reconciliationByMigration.get(migration)
    : null;
  return {
    phase: phaseFor(disposition),
    sequence: sequenceFor(disposition),
    objectType: stringOrNull(row.objectType),
    blocker: stringOrNull(row.blocker),
    closureState: stringOrNull(row.closureState),
    disposition,
    operatorAction: operatorActionFor(disposition, baselineGuidance),
    codexCanExecute: false,
    releaseImpact: stringOrNull(row.releaseImpact),
    migration,
    model: stringOrNull(row.model),
    table: stringOrNull(row.table),
    column: stringOrNull(row.column),
    restoreCandidatePath: stringOrNull(restore?.outputPath),
    dbChecksum:
      stringOrNull(restore?.dbChecksum) ??
      stringOrNull(reconciliation?.dbChecksum),
    recoveredSqlSha256:
      stringOrNull(restore?.sha256) ??
      stringOrNull(reconciliation?.recoveredSqlSha256),
    evidence: [
      'database-schema-disposition',
      ...(migration ? [`migration:${migration}`] : []),
      ...(stringOrNull(row.table) ? [`table:${stringOrNull(row.table)}`] : []),
      ...(stringOrNull(row.column)
        ? [`column:${stringOrNull(row.column)}`]
        : []),
      ...(restore ? ['restore-candidate-bundle'] : []),
      ...(reconciliation ? ['migration-history-reconciliation'] : []),
      ...(phaseFor(disposition) === '02_external_artifact_or_baseline_review'
        ? [
            'baseline-proposal',
            ...(baselineGuidance.nextCampaignId
              ? [`baseline-proposal-next:${baselineGuidance.nextCampaignId}`]
              : []),
            ...(baselineGuidance.localArtifactSearchStatus
              ? [
                  `local-artifact-search:${baselineGuidance.localArtifactSearchStatus}`,
                ]
              : []),
            ...(baselineGuidance.externalArtifactPacketStatus
              ? [
                  `external-artifact-packet:${baselineGuidance.externalArtifactPacketStatus}`,
                ]
              : []),
            ...(baselineGuidance.externalCandidateIntakeStatus
              ? [
                  `external-candidate-intake:${baselineGuidance.externalCandidateIntakeStatus}`,
                ]
              : []),
            ...(baselineGuidance.externalCandidateIntakeRoot
              ? [
                  `external-candidate-root:${baselineGuidance.externalCandidateIntakeRoot}`,
                ]
              : []),
            `external-candidate-files-present:${baselineGuidance.externalCandidateFilesPresent}`,
            `external-candidate-sql-files-present:${baselineGuidance.externalCandidateSqlFilesPresent}`,
            `external-candidate-archive-files-present:${baselineGuidance.externalCandidateArchiveFilesPresent}`,
            ...(baselineGuidance.externalCandidateManifestPath
              ? [
                  `external-candidate-manifest:${baselineGuidance.externalCandidateManifestPath}`,
                ]
              : []),
            ...(baselineGuidance.externalCandidateAcceptedArchiveNames.length >
            0
              ? [
                  `external-candidate-archive-shapes:${baselineGuidance.externalCandidateAcceptedArchiveNames.join('|')}`,
                ]
              : []),
            ...(baselineGuidance.externalCandidateSearchedRoots.length > 0
              ? [
                  `external-candidate-searched-roots:${baselineGuidance.externalCandidateSearchedRoots.join('|')}`,
                ]
              : []),
            ...baselineGuidance.externalCandidateTargetRows.flatMap(
              (target) => [
                ...(target.targetMigrationPath
                  ? [
                      `external-candidate-target-path:${target.targetMigrationPath}`,
                    ]
                  : []),
                ...(target.requiredSha256
                  ? [
                      `external-candidate-required-sha256:${target.requiredSha256}`,
                    ]
                  : []),
              ],
            ),
          ]
        : []),
    ],
  };
}

function phaseFor(disposition: string | null) {
  switch (disposition) {
    case 'review_restore_checksum_matched_migration_candidate':
      return '01_review_checksum_matched_restore_candidate';
    case 'review_unrecoverable_migration_history_external_or_baseline_required':
      return '02_external_artifact_or_baseline_review';
    case 'review_extra_db_object_schema_drift':
      return '03_review_extra_db_object_drift';
    case 'block_release_apply_repo_migration_after_operator_approval':
      return '04_apply_current_repo_migration_after_history_closed';
    default:
      return '00_unmapped';
  }
}

function sequenceFor(disposition: string | null) {
  if (!disposition) return 0;
  return Number(phaseFor(disposition).slice(0, 2)) || 0;
}

function operatorActionFor(
  disposition: string | null,
  baselineGuidance: BaselineProposalGuidance,
) {
  switch (disposition) {
    case 'review_restore_checksum_matched_migration_candidate':
      return 'review-staged-restore-candidate-before-copy-or-restore';
    case 'review_unrecoverable_migration_history_external_or_baseline_required':
      if (
        baselineGuidance.nextCampaignId ===
        'database_migration_external_exact_sql_recovery'
      ) {
        return 'request-external-exact-sql-artifact-before-baseline-fallback';
      }
      return 'recover-exact-migration-artifact-or-approve-nonproduction-baseline';
    case 'review_extra_db_object_schema_drift':
      return 'review-extra-db-object-for-schema-drift';
    case 'block_release_apply_repo_migration_after_operator_approval':
      return 'apply-current-repo-migration-after-history-is-closed';
    default:
      return 'map-disposition-before-operator-action';
  }
}

function buildBaselineProposalGuidance(
  artifact: Artifact,
): BaselineProposalGuidance {
  const summary = objectRecord(artifact.raw.summary);
  const nextCampaign = objectRecord(artifact.raw.nextCampaign);
  const externalCandidateIntake = objectRecord(
    artifact.raw.externalCandidateIntake,
  );
  const acceptedArchiveNames = stringList(
    externalCandidateIntake.acceptedArchiveNames,
  );
  const verificationChecklist = stringList(
    externalCandidateIntake.verificationChecklist,
  );
  const searchedRoots = stringList(externalCandidateIntake.searchedRoots);
  const manifestPath =
    stringOrNull(externalCandidateIntake.manifestPath) ??
    stringOrNull(summary.externalCandidateManifestPath) ??
    stringOrNull(nextCampaign.manifestPath);
  const manifestDigestPath =
    stringOrNull(externalCandidateIntake.manifestDigestPath) ??
    stringOrNull(summary.externalCandidateManifestDigestPath) ??
    stringOrNull(nextCampaign.manifestDigestPath);
  const manifestSha256 =
    stringOrNull(externalCandidateIntake.manifestSha256) ??
    stringOrNull(summary.externalCandidateManifestSha256) ??
    stringOrNull(nextCampaign.manifestSha256);
  const manifestSizeBytes =
    numberOrZero(externalCandidateIntake.manifestSizeBytes) ||
    numberOrZero(summary.externalCandidateManifestSizeBytes) ||
    numberOrZero(nextCampaign.manifestSizeBytes);
  const candidateFilesPresent =
    numberOrZero(externalCandidateIntake.candidateFilesPresent) ||
    numberOrZero(summary.externalCandidateFilesPresent) ||
    numberOrZero(nextCampaign.candidateFilesPresent);
  const candidateSqlFilesPresent =
    numberOrZero(externalCandidateIntake.candidateSqlFilesPresent) ||
    numberOrZero(summary.externalCandidateSqlFilesPresent) ||
    numberOrZero(nextCampaign.candidateSqlFilesPresent);
  const candidateArchiveFilesPresent =
    numberOrZero(externalCandidateIntake.candidateArchiveFilesPresent) ||
    numberOrZero(summary.externalCandidateArchiveFilesPresent) ||
    numberOrZero(nextCampaign.candidateArchiveFilesPresent);
  const generatedIntakeFilesPresent =
    numberOrZero(externalCandidateIntake.generatedIntakeFilesPresent) ||
    numberOrZero(summary.externalCandidateGeneratedIntakeFilesPresent) ||
    numberOrZero(nextCampaign.generatedIntakeFilesPresent);
  const candidateFiles =
    stringList(externalCandidateIntake.candidateFiles).length > 0
      ? stringList(externalCandidateIntake.candidateFiles)
      : stringList(summary.externalCandidateFiles);
  const requestJsonPath =
    stringOrNull(externalCandidateIntake.requestJsonPath) ??
    stringOrNull(summary.externalCandidateRequestJsonPath) ??
    stringOrNull(nextCampaign.requestJsonPath);
  const requestMarkdownPath =
    stringOrNull(externalCandidateIntake.requestMarkdownPath) ??
    stringOrNull(summary.externalCandidateRequestMarkdownPath) ??
    stringOrNull(nextCampaign.requestMarkdownPath);
  const statusJsonPath =
    stringOrNull(externalCandidateIntake.statusJsonPath) ??
    stringOrNull(summary.externalCandidateStatusJsonPath) ??
    stringOrNull(nextCampaign.statusJsonPath);
  const statusMarkdownPath =
    stringOrNull(externalCandidateIntake.statusMarkdownPath) ??
    stringOrNull(summary.externalCandidateStatusMarkdownPath) ??
    stringOrNull(nextCampaign.statusMarkdownPath);
  const summaryAcceptedArchiveNames = stringList(
    summary.externalCandidateAcceptedArchiveNames,
  );
  const summaryVerificationChecklist = stringList(
    summary.externalCandidateVerificationChecklist,
  );
  const summarySearchedRoots = stringList(
    summary.externalCandidateSearchedRoots,
  );
  const targetRows = candidateTargetRows(externalCandidateIntake.targetRows);
  const summaryTargetRows = candidateTargetRows(
    summary.externalCandidateTargetRows,
  );
  return {
    status: artifact.status,
    nextCampaignId: stringOrNull(nextCampaign.id),
    nextCampaignReason: stringOrNull(nextCampaign.reason),
    externalCandidateIntakeStatus:
      stringOrNull(externalCandidateIntake.status) ??
      stringOrNull(summary.externalCandidateIntakeStatus),
    externalCandidateIntakeRoot:
      stringOrNull(externalCandidateIntake.suggestedCandidateRoot) ??
      stringOrNull(summary.externalCandidateIntakeRoot) ??
      stringOrNull(nextCampaign.candidateRoot),
    externalCandidateManifestPath: manifestPath,
    externalCandidateManifestDigestPath: manifestDigestPath,
    externalCandidateManifestSha256: manifestSha256,
    externalCandidateManifestSizeBytes: manifestSizeBytes,
    externalCandidateFilesPresent: candidateFilesPresent,
    externalCandidateSqlFilesPresent: candidateSqlFilesPresent,
    externalCandidateArchiveFilesPresent: candidateArchiveFilesPresent,
    externalCandidateGeneratedIntakeFilesPresent: generatedIntakeFilesPresent,
    externalCandidateFiles: candidateFiles,
    externalCandidateRequestJsonPath: requestJsonPath,
    externalCandidateRequestMarkdownPath: requestMarkdownPath,
    externalCandidateStatusJsonPath: statusJsonPath,
    externalCandidateStatusMarkdownPath: statusMarkdownPath,
    externalCandidateVerificationCommand:
      stringOrNull(externalCandidateIntake.verificationCommand) ??
      stringOrNull(summary.externalCandidateVerificationCommand) ??
      stringOrNull(nextCampaign.verificationCommand),
    externalCandidateAcceptedArchiveNames:
      acceptedArchiveNames.length > 0
        ? acceptedArchiveNames
        : summaryAcceptedArchiveNames,
    externalCandidateVerificationChecklist:
      verificationChecklist.length > 0
        ? verificationChecklist
        : summaryVerificationChecklist,
    externalCandidateSearchedRoots:
      searchedRoots.length > 0 ? searchedRoots : summarySearchedRoots,
    externalCandidateTargetRows:
      targetRows.length > 0 ? targetRows : summaryTargetRows,
    exactSqlArtifactMatches: numberOrZero(summary.exactSqlArtifactMatches),
    localArtifactSearchStatus: stringOrNull(summary.localArtifactSearchStatus),
    externalArtifactPacketStatus: stringOrNull(
      summary.externalArtifactPacketStatus,
    ),
    baselineResolutionStatus: stringOrNull(summary.baselineResolutionStatus),
    backupEvidencePacketStatus: stringOrNull(
      summary.backupEvidencePacketStatus,
    ),
    baselineApprovalRequestStatus: stringOrNull(
      summary.baselineApprovalRequestStatus,
    ),
  };
}

function buildRecommendedSequence(baselineGuidance: BaselineProposalGuidance) {
  if (
    baselineGuidance.nextCampaignId ===
    'database_migration_external_exact_sql_recovery'
  ) {
    return [
      'Request the exact applied migration.sql from deployment artifacts, backups, CI release bundles, or teammate clones.',
      baselineGuidance.externalCandidateIntakeRoot
        ? `Place any candidate artifact in ${baselineGuidance.externalCandidateIntakeRoot} before considering baseline fallback.`
        : 'Place any candidate artifact in a local directory before considering baseline fallback.',
      baselineGuidance.externalCandidateManifestPath
        ? `Use the machine-readable target manifest at ${baselineGuidance.externalCandidateManifestPath} when preparing candidate artifacts.`
        : 'Use the latest external artifact packet to confirm the active target checksum before preparing candidate artifacts.',
      baselineGuidance.externalCandidateManifestDigestPath
        ? `Use the digest sidecar at ${baselineGuidance.externalCandidateManifestDigestPath} to verify the target manifest handed to artifact owners.`
        : 'Use the latest external artifact packet digest to verify the target manifest handed to artifact owners.',
      baselineGuidance.externalCandidateManifestSha256
        ? `Confirm TARGETS.json SHA-256 stays ${baselineGuidance.externalCandidateManifestSha256} before handing it to artifact owners.`
        : 'Confirm the target manifest digest from the latest external artifact packet before handing it to artifact owners.',
      baselineGuidance.externalCandidateRequestMarkdownPath
        ? `Forward the exact SQL request packet at ${baselineGuidance.externalCandidateRequestMarkdownPath} to deployment artifact, backup, CI artifact, or teammate-clone owners.`
        : 'Forward the latest exact SQL request packet to deployment artifact, backup, CI artifact, or teammate-clone owners.',
      baselineGuidance.externalCandidateStatusMarkdownPath
        ? `Check the current intake status at ${baselineGuidance.externalCandidateStatusMarkdownPath} after candidates are dropped.`
        : 'Check the current candidate intake status after candidates are dropped.',
      baselineGuidance.externalCandidateVerificationCommand
        ? `Verify candidate artifacts with: ${baselineGuidance.externalCandidateVerificationCommand}`
        : 'Rerun the local/external artifact search packets after any candidate artifact is provided.',
      ...(baselineGuidance.externalCandidateAcceptedArchiveNames.length > 0
        ? [
            `Accepted archive candidate shapes: ${baselineGuidance.externalCandidateAcceptedArchiveNames.join(', ')}.`,
          ]
        : []),
      ...baselineGuidance.externalCandidateTargetRows.map(
        (target) =>
          `Candidate target: ${target.migration ?? 'unknown'} at ${target.targetMigrationPath ?? 'unknown'} must match SHA-256 ${target.requiredSha256 ?? 'unknown'}.`,
      ),
      ...(baselineGuidance.externalCandidateVerificationChecklist.length > 0
        ? [
            `Candidate verification checklist: ${baselineGuidance.externalCandidateVerificationChecklist.join(' | ')}`,
          ]
        : []),
      'Use non-production baseline/resolve only after exact SQL recovery is exhausted and backup/disposable/staging-clone evidence is attached.',
      'Only after migration history is reviewed, apply or align the current repo migration that creates user_notification_preferences.',
      'Rerun database-schema-compatibility, database-schema-disposition, operator handoff, and platform-data-closure audits.',
    ];
  }
  return [
    'Review checksum-matched migration restore candidates outside the live Prisma migrations directory.',
    'Recover the unrecoverable DB-applied migration from external artifact/team clone, or document an approved non-production baseline decision outside this script.',
    'Only after migration history is reviewed, apply or align the current repo migration that creates user_notification_preferences.',
    'Rerun database-schema-compatibility, database-schema-disposition, and platform-data-closure audits.',
  ];
}

function buildNextCampaign(
  rows: HandoffRow[],
  baselineGuidance: BaselineProposalGuidance,
) {
  const unrecoverable = rows.find(
    (row) => row.phase === '02_external_artifact_or_baseline_review',
  );
  if (unrecoverable) {
    if (
      baselineGuidance.nextCampaignId ===
      'database_migration_external_exact_sql_recovery'
    ) {
      return {
        id: 'database_migration_external_exact_sql_recovery',
        reason:
          baselineGuidance.nextCampaignReason ??
          'Exact SQL is still unrecovered after local and external evidence; request deployment/backup/team-clone artifacts before baseline fallback.',
        migration: unrecoverable.migration,
        recommendedAction:
          'request-exact-sql-from-deployment-backup-or-team-clone',
        candidateManifestPath: baselineGuidance.externalCandidateManifestPath,
        candidateManifestDigestPath:
          baselineGuidance.externalCandidateManifestDigestPath,
        candidateManifestSha256:
          baselineGuidance.externalCandidateManifestSha256,
        candidateFilesPresent: baselineGuidance.externalCandidateFilesPresent,
        candidateSqlFilesPresent:
          baselineGuidance.externalCandidateSqlFilesPresent,
        candidateArchiveFilesPresent:
          baselineGuidance.externalCandidateArchiveFilesPresent,
        candidateRequestMarkdownPath:
          baselineGuidance.externalCandidateRequestMarkdownPath,
        candidateStatusMarkdownPath:
          baselineGuidance.externalCandidateStatusMarkdownPath,
      };
    }
    return {
      id: 'database_migration_unrecoverable_history_handoff',
      reason:
        'A DB-applied migration is missing from the repo and not recoverable from local git history.',
      migration: unrecoverable.migration,
      recommendedAction:
        'recover-exact-sql-from-external-artifact-or-approve-nonproduction-baseline',
    };
  }
  const restore = rows.find(
    (row) => row.phase === '01_review_checksum_matched_restore_candidate',
  );
  if (restore) {
    return {
      id: 'database_migration_restore_candidate_review',
      reason:
        'Checksum-matched migration SQL candidates are staged for review.',
      migration: restore.migration,
      recommendedAction: 'review-staged-restore-candidates',
    };
  }
  const apply = rows.find(
    (row) =>
      row.phase === '04_apply_current_repo_migration_after_history_closed',
  );
  if (apply) {
    return {
      id: 'database_schema_apply_current_repo_migration',
      reason:
        'Current repo migration must be applied after migration history is closed.',
      migration: apply.migration,
      table: apply.table,
      recommendedAction: 'operator-apply-or-align-current-repo-migration',
    };
  }
  return {
    id: 'database_schema_review_extra_objects',
    reason: 'Only review-only schema drift rows remain.',
    recommendedAction: 'review-extra-db-objects',
  };
}

function readArtifact(filePath: string | null): Artifact {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      path: filePath,
      found: false,
      generatedAt: null,
      status: null,
      summary: {},
      rows: [],
      raw: {},
    };
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
    string,
    unknown
  >;
  return {
    path: path.relative(API_ROOT, filePath),
    found: true,
    generatedAt: stringOrNull(raw.generatedAt),
    status: stringOrNull(raw.status),
    summary: objectRecord(raw.summary),
    rows: Array.isArray(raw.rows) ? raw.rows.filter(isRecord) : [],
    raw,
  };
}

function summarizeArtifacts(artifacts: Record<string, Artifact>) {
  return Object.fromEntries(
    Object.entries(artifacts).map(([key, artifact]) => [
      key,
      {
        path: artifact.path,
        found: artifact.found,
        generatedAt: artifact.generatedAt,
        status: artifact.status,
        summary: artifact.summary,
      },
    ]),
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

function arrayRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
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

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0,
      )
    : [];
}

function candidateTargetRows(value: unknown): ExternalCandidateTargetRow[] {
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

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const summary = report.summary ?? {};
  const phases = Object.entries(summary.byPhase ?? {});
  const acceptedArchiveNames = stringList(
    summary.externalCandidateAcceptedArchiveNames,
  );
  const searchedRoots = stringList(summary.externalCandidateSearchedRoots);
  const verificationChecklist = stringList(
    summary.externalCandidateVerificationChecklist,
  );
  const targetRows = candidateTargetRows(summary.externalCandidateTargetRows);
  return [
    '# Database Schema Operator Handoff',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total rows: ${summary.totalRows ?? 0}`,
    `- Blocking rows: ${summary.blockingRows ?? 0}`,
    `- Restore candidate rows: ${summary.restoreCandidateRows ?? 0}`,
    `- Unrecoverable migration rows: ${summary.unrecoverableMigrationRows ?? 0}`,
    `- Current repo apply rows: ${summary.currentRepoApplyRows ?? 0}`,
    `- Baseline proposal next campaign: ${summary.baselineProposalNextCampaign ?? 'unknown'}`,
    `- External candidate intake: ${summary.externalCandidateIntakeStatus ?? 'unknown'}`,
    `- External candidate root: ${summary.externalCandidateIntakeRoot ?? 'unknown'}`,
    `- External candidate target manifest: ${summary.externalCandidateManifestPath ?? 'unknown'}`,
    `- External candidate target manifest digest sidecar: ${summary.externalCandidateManifestDigestPath ?? 'unknown'}`,
    `- External candidate target manifest SHA-256: ${summary.externalCandidateManifestSha256 ?? 'unknown'}`,
    `- External candidate target manifest size bytes: ${summary.externalCandidateManifestSizeBytes ?? 'unknown'}`,
    `- External candidate files present: ${summary.externalCandidateFilesPresent ?? 'unknown'}`,
    `- External candidate SQL files present: ${summary.externalCandidateSqlFilesPresent ?? 'unknown'}`,
    `- External candidate archive files present: ${summary.externalCandidateArchiveFilesPresent ?? 'unknown'}`,
    `- External generated intake files present: ${summary.externalCandidateGeneratedIntakeFilesPresent ?? 'unknown'}`,
    `- External exact SQL request JSON: ${summary.externalCandidateRequestJsonPath ?? 'unknown'}`,
    `- External exact SQL request Markdown: ${summary.externalCandidateRequestMarkdownPath ?? 'unknown'}`,
    `- External intake status JSON: ${summary.externalCandidateStatusJsonPath ?? 'unknown'}`,
    `- External intake status Markdown: ${summary.externalCandidateStatusMarkdownPath ?? 'unknown'}`,
    `- External candidate verification command: ${summary.externalCandidateVerificationCommand ?? 'unknown'}`,
    `- External candidate accepted archive names: ${acceptedArchiveNames.length > 0 ? acceptedArchiveNames.join(', ') : 'unknown'}`,
    `- External candidate searched roots: ${searchedRoots.length > 0 ? searchedRoots.join(', ') : 'unknown'}`,
    `- External candidate files: ${stringList(summary.externalCandidateFiles).join(', ') || 'none'}`,
    `- Exact SQL artifact matches: ${summary.exactSqlArtifactMatches ?? 0}`,
    `- Local artifact search: ${summary.localArtifactSearchStatus ?? 'unknown'}`,
    `- External artifact packet: ${summary.externalArtifactPacketStatus ?? 'unknown'}`,
    '- External candidate verification checklist:',
    ...(verificationChecklist.length > 0
      ? verificationChecklist.map((item) => `  - ${item}`)
      : ['  - unknown']),
    '- External candidate target rows:',
    ...(targetRows.length > 0
      ? targetRows.map(
          (target) =>
            `  - ${target.migration ?? 'unknown'}: path=${target.targetMigrationPath ?? 'unknown'}; requiredSha256=${target.requiredSha256 ?? 'unknown'}`,
        )
      : ['  - unknown']),
    '',
    '## Guardrails',
    '',
    `- Codex may do: ${report.guardrails?.codexMayDo ?? 'read-only evidence'}`,
    `- Codex must not do: ${report.guardrails?.codexMustNotDo ?? 'DB or migration writes'}`,
    '',
    '## Phases',
    '',
    '| Phase | Rows |',
    '| --- | ---: |',
    ...(phases.length
      ? phases.map(([key, count]) => `| ${escapeMarkdown(key)} | ${count} |`)
      : ['| None | 0 |']),
    '',
  ].join('\n');
}

function renderCsv(rows: HandoffRow[]) {
  const header = [
    'phase',
    'sequence',
    'objectType',
    'blocker',
    'closureState',
    'disposition',
    'operatorAction',
    'releaseImpact',
    'migration',
    'model',
    'table',
    'column',
    'restoreCandidatePath',
    'dbChecksum',
    'recoveredSqlSha256',
  ];
  const lines = rows.map((row) =>
    [
      row.phase,
      row.sequence,
      row.objectType ?? '',
      row.blocker ?? '',
      row.closureState ?? '',
      row.disposition ?? '',
      row.operatorAction,
      row.releaseImpact ?? '',
      row.migration ?? '',
      row.model ?? '',
      row.table ?? '',
      row.column ?? '',
      row.restoreCandidatePath ?? '',
      row.dbChecksum ?? '',
      row.recoveredSqlSha256 ?? '',
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
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        csv: args.csv,
        totalRows: report.summary?.totalRows ?? 0,
        blockingRows: report.summary?.blockingRows ?? 0,
        restoreCandidateRows: report.summary?.restoreCandidateRows ?? 0,
        unrecoverableMigrationRows:
          report.summary?.unrecoverableMigrationRows ?? 0,
        currentRepoApplyRows: report.summary?.currentRepoApplyRows ?? 0,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
