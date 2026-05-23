#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';

type ApprovalRequestStatus =
  | 'PASS_NO_DB_MIGRATION_BLOCKER'
  | 'BLOCKED_APPROVAL_REQUEST_INPUTS_MISSING'
  | 'BLOCKED_BACKUP_EVIDENCE_NOT_READY'
  | 'BLOCKED_UNEXPECTED_APPROVAL_STATE'
  | 'REVIEW_OPERATOR_APPROVAL_REQUIRED'
  | 'REVIEW_APPROVED_BASELINE_RESOLUTION';

interface Args {
  baselineProposal: string | null;
  baselineResolution: string | null;
  backupEvidencePacket: string | null;
  baselineScopePreflight: string | null;
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
  raw: Record<string, unknown>;
  error: string | null;
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const REQUIRED_ACK = 'APPROVED_DATABASE_MIGRATION_BASELINE_RESOLVE';

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
        `database-migration-baseline-approval-request-${stamp}.json`,
      ),
    )!,
  );
  return {
    baselineProposal: optionalPath(
      '--baseline-proposal',
      /^database-migration-baseline-proposal-.+\.json$/,
    ),
    baselineResolution: optionalPath(
      '--baseline-resolution',
      /^database-migration-baseline-resolution-.+\.json$/,
    ),
    backupEvidencePacket: optionalPath(
      '--backup-evidence-packet',
      /^database-migration-backup-evidence-packet-.+\.json$/,
    ),
    baselineScopePreflight: optionalPath(
      '--baseline-scope-preflight',
      /^database-migration-baseline-scope-preflight-.+\.json$/,
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
    baselineProposal: readArtifact(
      'database_migration_baseline_proposal',
      args.baselineProposal,
    ),
    baselineResolution: readArtifact(
      'database_migration_baseline_resolution',
      args.baselineResolution,
    ),
    backupEvidencePacket: readArtifact(
      'database_migration_backup_evidence_packet',
      args.backupEvidencePacket,
    ),
    baselineScopePreflight: readArtifact(
      'database_migration_baseline_scope_preflight',
      args.baselineScopePreflight,
    ),
  };
  const missingArtifacts = Object.values(artifacts)
    .filter((artifact) => !artifact.exists)
    .map((artifact) => ({
      kind: artifact.kind,
      path: artifact.path,
      error: artifact.error,
    }));
  const missingApprovalInputs = extractMissingApprovalInputs(
    artifacts.baselineResolution,
  );
  const effectiveMissingApprovalInputs = buildEffectiveMissingApprovalInputs(
    artifacts,
    missingApprovalInputs,
  );
  const externalCandidateIntake = buildExternalCandidateIntake(
    artifacts.baselineProposal,
  );
  const approvalReadiness = buildApprovalReadiness(
    artifacts,
    missingArtifacts,
    effectiveMissingApprovalInputs,
  );
  const status = chooseStatus(approvalReadiness);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-migration-baseline-approval-request',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    prismaResolveOrDeployExecuted: false,
    operatorApprovalGranted: status === 'REVIEW_APPROVED_BASELINE_RESOLUTION',
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
    summary: {
      baselineProposalStatus: artifacts.baselineProposal.status,
      baselineResolutionStatus: artifacts.baselineResolution.status,
      backupEvidencePacketStatus: artifacts.backupEvidencePacket.status,
      baselineScopePreflightStatus: artifacts.baselineScopePreflight.status,
      exactSqlArtifactMatches: numberFromSummary(
        artifacts.baselineProposal,
        'exactSqlArtifactMatches',
      ),
      openMigrationBlockers: numberFromSummary(
        artifacts.baselineProposal,
        'openMigrationBlockers',
      ),
      unrecoverableRows: numberFromSummary(
        artifacts.baselineProposal,
        'unrecoverableRows',
      ),
      unresolvedChecksumMismatches: numberFromSummary(
        artifacts.baselineProposal,
        'unresolvedChecksumMismatches',
      ),
      effectiveTargetScope:
        stringFromSummary(artifacts.baselineProposal, 'baselineTargetScope') ??
        stringFromSummary(
          artifacts.baselineProposal,
          'baselineScopeEffectiveTarget',
        ) ??
        stringFromSummary(
          artifacts.baselineScopePreflight,
          'effectiveTargetScope',
        ),
      backupEvidenceReady: booleanFromSummary(
        artifacts.backupEvidencePacket,
        'readyForBaselineResolutionInput',
      ),
      backupArtifactExists: booleanFromSummary(
        artifacts.backupEvidencePacket,
        'backupArtifactExists',
      ),
      externalCandidateIntakeStatus: externalCandidateIntake.status,
      externalCandidateIntakeRoot:
        externalCandidateIntake.suggestedCandidateRoot,
      externalCandidateManifestPath: externalCandidateIntake.manifestPath,
      externalCandidateManifestDigestPath:
        externalCandidateIntake.manifestDigestPath,
      externalCandidateManifestSha256: externalCandidateIntake.manifestSha256,
      externalCandidateManifestSizeBytes:
        externalCandidateIntake.manifestSizeBytes,
      externalCandidateRequestJsonPath: externalCandidateIntake.requestJsonPath,
      externalCandidateRequestMarkdownPath:
        externalCandidateIntake.requestMarkdownPath,
      externalCandidateStatusJsonPath: externalCandidateIntake.statusJsonPath,
      externalCandidateStatusMarkdownPath:
        externalCandidateIntake.statusMarkdownPath,
      externalCandidateManifestSourceReportPath:
        externalCandidateIntake.sourceReportPath,
      externalCandidateManifestSourceMarkdownPath:
        externalCandidateIntake.sourceMarkdownPath,
      externalCandidateVerificationCommand:
        externalCandidateIntake.verificationCommand,
      externalCandidateAcceptedArchiveNames:
        externalCandidateIntake.acceptedArchiveNames,
      externalCandidateVerificationChecklist:
        externalCandidateIntake.verificationChecklist,
      externalCandidateSearchedRoots: externalCandidateIntake.searchedRoots,
      externalCandidateTargetRows: externalCandidateIntake.targetRows,
      missingArtifacts: missingArtifacts.length,
      missingApprovalInputs: effectiveMissingApprovalInputs.length,
      approvalRequestReady: status === 'REVIEW_OPERATOR_APPROVAL_REQUIRED',
      approvalAlreadyGranted: status === 'REVIEW_APPROVED_BASELINE_RESOLUTION',
      dbWriteAllowed: false,
    },
    missingArtifacts,
    missingApprovalInputs: effectiveMissingApprovalInputs,
    approvalReadiness,
    externalCandidateIntake,
    approvalChecklist: buildApprovalChecklist(
      artifacts,
      externalCandidateIntake,
    ),
    operatorHandoff: buildOperatorHandoff(
      artifacts,
      effectiveMissingApprovalInputs,
      externalCandidateIntake,
    ),
    operatorGuardrails: {
      mode: 'read-only',
      requiredAck: REQUIRED_ACK,
      productionScopeAllowed: false,
      writeCommandsIntentionallyOmitted: [
        'prisma migrate resolve',
        'prisma migrate deploy',
        'prisma db push',
        'SQL restore',
        'pg_restore',
      ],
      approvalRequestDoesNotGrantPermission: true,
      doNotProceedUnlessBaselineResolutionIsReviewApproved: true,
    },
    nextCampaign: buildNextCampaign(status, externalCandidateIntake),
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  printSummary(args.out, args.markdown, report);
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

function readArtifact(kind: string, artifactPath: string | null): Artifact {
  if (!artifactPath) {
    return {
      kind,
      path: null,
      exists: false,
      generatedAt: null,
      status: null,
      summary: {},
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
      raw: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function extractMissingApprovalInputs(baselineResolution: Artifact) {
  const requiredFields = Array.isArray(baselineResolution.raw.requiredFields)
    ? baselineResolution.raw.requiredFields.filter(
        (value): value is string => typeof value === 'string',
      )
    : [];
  const requiredOperatorInputs = Array.isArray(
    baselineResolution.raw.requiredOperatorInputs,
  )
    ? baselineResolution.raw.requiredOperatorInputs
    : [];
  const unprovidedInputs = requiredOperatorInputs
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null &&
        typeof item === 'object' &&
        item.required === true &&
        item.provided !== true,
    )
    .map((item) => stringOrNull(item.key) ?? 'unknown');
  return Array.from(
    new Set([...requiredFields, ...unprovidedInputs].map(normalizeInputKey)),
  );
}

function normalizeInputKey(input: string) {
  if (input === 'approved-operator-workflow') {
    return '--approved-operator-workflow';
  }
  if (input === 'operator-ack') {
    return `--operator-ack ${REQUIRED_ACK}`;
  }
  return input;
}

function buildEffectiveMissingApprovalInputs(
  artifacts: Record<string, Artifact>,
  missingApprovalInputs: string[],
) {
  const openMigrationBlockers =
    numberFromSummary(artifacts.baselineProposal, 'openMigrationBlockers') ?? 0;
  const exactSqlArtifactMatches =
    numberFromSummary(artifacts.baselineProposal, 'exactSqlArtifactMatches') ??
    0;
  const baselineResolutionPassWithoutDbClosure =
    artifacts.baselineResolution.status === 'PASS_NO_MISMATCH' &&
    openMigrationBlockers > 0;

  if (
    missingApprovalInputs.length === 0 &&
    baselineResolutionPassWithoutDbClosure &&
    exactSqlArtifactMatches === 0
  ) {
    return [
      '--approved-operator-workflow',
      `--operator-ack ${REQUIRED_ACK}`,
      '--rationale <why exact SQL cannot be recovered and why this target may be resolved>',
    ];
  }

  return missingApprovalInputs;
}

function buildApprovalReadiness(
  artifacts: Record<string, Artifact>,
  missingArtifacts: Array<Record<string, unknown>>,
  missingApprovalInputs: string[],
) {
  const backupReady = booleanFromSummary(
    artifacts.backupEvidencePacket,
    'readyForBaselineResolutionInput',
  );
  const baselineApproved =
    artifacts.baselineResolution.status ===
    'REVIEW_APPROVED_BASELINE_RESOLUTION';
  const openMigrationBlockers =
    numberFromSummary(artifacts.baselineProposal, 'openMigrationBlockers') ?? 0;
  const unrecoverableRows =
    numberFromSummary(artifacts.baselineProposal, 'unrecoverableRows') ?? 0;
  const approvalInputsAreExpectedOnly =
    missingApprovalInputs.length > 0 &&
    missingApprovalInputs.every((input) =>
      [
        '--approved-operator-workflow',
        'approved-operator-workflow',
        `--operator-ack ${REQUIRED_ACK}`,
        'operator-ack',
        '--rationale <why exact SQL cannot be recovered and why this target may be resolved>',
        'rationale',
      ].includes(input),
    );
  return {
    artifactsComplete: missingArtifacts.length === 0,
    backupEvidenceReady: backupReady,
    baselineResolutionStatus: artifacts.baselineResolution.status,
    baselineApproved,
    openMigrationBlockers,
    unrecoverableRows,
    missingApprovalInputs,
    approvalInputsAreExpectedOnly,
    exactSqlRecoveryExhausted:
      numberFromSummary(
        artifacts.baselineProposal,
        'exactSqlArtifactMatches',
      ) === 0,
    unresolvedChecksumMismatches:
      numberFromSummary(
        artifacts.baselineProposal,
        'unresolvedChecksumMismatches',
      ) ?? null,
  };
}

function chooseStatus(
  readiness: ReturnType<typeof buildApprovalReadiness>,
): ApprovalRequestStatus {
  if (
    readiness.baselineResolutionStatus === 'PASS_NO_MISMATCH' &&
    readiness.openMigrationBlockers === 0
  ) {
    return 'PASS_NO_DB_MIGRATION_BLOCKER';
  }
  if (!readiness.artifactsComplete) {
    return 'BLOCKED_APPROVAL_REQUEST_INPUTS_MISSING';
  }
  if (!readiness.backupEvidenceReady) {
    return 'BLOCKED_BACKUP_EVIDENCE_NOT_READY';
  }
  if (readiness.baselineApproved) {
    return 'REVIEW_APPROVED_BASELINE_RESOLUTION';
  }
  if (readiness.approvalInputsAreExpectedOnly) {
    return 'REVIEW_OPERATOR_APPROVAL_REQUIRED';
  }
  return 'BLOCKED_UNEXPECTED_APPROVAL_STATE';
}

function buildExternalCandidateIntake(artifact: Artifact) {
  const intake = objectOrEmpty(artifact.raw.externalCandidateIntake);
  const nextCampaign = objectOrEmpty(artifact.raw.nextCampaign);
  const summaryTargetRows = candidateTargetRows(
    artifact.summary.externalCandidateTargetRows,
  );
  const intakeTargetRows = candidateTargetRows(intake.targetRows);
  const campaignTargetRows = candidateTargetRows(nextCampaign.targetRows);
  const manifestPath =
    stringOrNull(intake.manifestPath) ??
    stringOrNull(artifact.summary.externalCandidateManifestPath) ??
    stringOrNull(nextCampaign.manifestPath);
  const manifestDigestPath =
    stringOrNull(intake.manifestDigestPath) ??
    stringOrNull(artifact.summary.externalCandidateManifestDigestPath) ??
    stringOrNull(nextCampaign.manifestDigestPath);
  const sourceReportPath =
    stringOrNull(intake.sourceReportPath) ??
    stringOrNull(artifact.summary.externalCandidateManifestSourceReportPath);
  const sourceMarkdownPath =
    stringOrNull(intake.sourceMarkdownPath) ??
    stringOrNull(artifact.summary.externalCandidateManifestSourceMarkdownPath);
  const manifestSha256 =
    stringOrNull(intake.manifestSha256) ??
    stringOrNull(artifact.summary.externalCandidateManifestSha256) ??
    stringOrNull(nextCampaign.manifestSha256);
  const manifestSizeBytes =
    numberOrNull(intake.manifestSizeBytes) ??
    numberOrNull(artifact.summary.externalCandidateManifestSizeBytes) ??
    numberOrNull(nextCampaign.manifestSizeBytes);
  const requestJsonPath =
    stringOrNull(intake.requestJsonPath) ??
    stringOrNull(artifact.summary.externalCandidateRequestJsonPath) ??
    stringOrNull(nextCampaign.requestJsonPath);
  const requestMarkdownPath =
    stringOrNull(intake.requestMarkdownPath) ??
    stringOrNull(artifact.summary.externalCandidateRequestMarkdownPath) ??
    stringOrNull(nextCampaign.requestMarkdownPath);
  const statusJsonPath =
    stringOrNull(intake.statusJsonPath) ??
    stringOrNull(artifact.summary.externalCandidateStatusJsonPath) ??
    stringOrNull(nextCampaign.statusJsonPath);
  const statusMarkdownPath =
    stringOrNull(intake.statusMarkdownPath) ??
    stringOrNull(artifact.summary.externalCandidateStatusMarkdownPath) ??
    stringOrNull(nextCampaign.statusMarkdownPath);
  const acceptedArchiveNames = stringList(intake.acceptedArchiveNames);
  const summaryAcceptedArchiveNames = stringList(
    artifact.summary.externalCandidateAcceptedArchiveNames,
  );
  const campaignAcceptedArchiveNames = stringList(
    nextCampaign.acceptedArchiveNames,
  );
  const verificationChecklist = stringList(intake.verificationChecklist);
  const summaryVerificationChecklist = stringList(
    artifact.summary.externalCandidateVerificationChecklist,
  );
  const searchedRoots = stringList(intake.searchedRoots);
  const summarySearchedRoots = stringList(
    artifact.summary.externalCandidateSearchedRoots,
  );
  return {
    sourceArtifactPath: artifact.path,
    sourceArtifactStatus: artifact.status,
    status:
      stringOrNull(intake.status) ??
      stringFromSummary(artifact, 'externalCandidateIntakeStatus'),
    candidateFilesPresent:
      numberOrNull(intake.candidateFilesPresent) ??
      numberOrNull(artifact.summary.externalCandidateFilesPresent) ??
      numberOrNull(nextCampaign.candidateFilesPresent),
    candidateSqlFilesPresent:
      numberOrNull(intake.candidateSqlFilesPresent) ??
      numberOrNull(artifact.summary.externalCandidateSqlFilesPresent) ??
      numberOrNull(nextCampaign.candidateSqlFilesPresent),
    candidateArchiveFilesPresent:
      numberOrNull(intake.candidateArchiveFilesPresent) ??
      numberOrNull(artifact.summary.externalCandidateArchiveFilesPresent) ??
      numberOrNull(nextCampaign.candidateArchiveFilesPresent),
    generatedIntakeFilesPresent:
      numberOrNull(intake.generatedIntakeFilesPresent) ??
      numberOrNull(
        artifact.summary.externalCandidateGeneratedIntakeFilesPresent,
      ) ??
      numberOrNull(nextCampaign.generatedIntakeFilesPresent),
    candidateFiles:
      stringList(intake.candidateFiles).length > 0
        ? stringList(intake.candidateFiles)
        : stringList(artifact.summary.externalCandidateFiles),
    suggestedCandidateRoot:
      stringOrNull(intake.suggestedCandidateRoot) ??
      stringFromSummary(artifact, 'externalCandidateIntakeRoot') ??
      stringOrNull(nextCampaign.candidateRoot),
    manifestPath,
    manifestDigestPath,
    manifestSha256,
    manifestSizeBytes,
    requestJsonPath,
    requestMarkdownPath,
    statusJsonPath,
    statusMarkdownPath,
    sourceReportPath,
    sourceMarkdownPath,
    acceptedFileNames: stringList(intake.acceptedFileNames),
    acceptedArchiveNames:
      acceptedArchiveNames.length > 0
        ? acceptedArchiveNames
        : summaryAcceptedArchiveNames.length > 0
          ? summaryAcceptedArchiveNames
          : campaignAcceptedArchiveNames,
    verificationCommand:
      stringOrNull(intake.verificationCommand) ??
      stringFromSummary(artifact, 'externalCandidateVerificationCommand') ??
      stringOrNull(nextCampaign.verificationCommand),
    guardrail: stringOrNull(intake.guardrail),
    verificationChecklist:
      verificationChecklist.length > 0
        ? verificationChecklist
        : summaryVerificationChecklist,
    searchedRoots:
      searchedRoots.length > 0 ? searchedRoots : summarySearchedRoots,
    targetRows:
      intakeTargetRows.length > 0
        ? intakeTargetRows
        : summaryTargetRows.length > 0
          ? summaryTargetRows
          : campaignTargetRows,
  };
}

function buildApprovalChecklist(
  artifacts: Record<string, Artifact>,
  externalCandidateIntake: ReturnType<typeof buildExternalCandidateIntake>,
) {
  return [
    {
      key: 'exact-sql-exhausted',
      status:
        numberFromSummary(
          artifacts.baselineProposal,
          'exactSqlArtifactMatches',
        ) === 0
          ? 'ready'
          : 'review-exact-sql-first',
      evidence: {
        checksumReviewStatus: stringFromSummary(
          artifacts.baselineProposal,
          'checksumReviewStatus',
        ),
        checksumVariantAnalysisStatus: stringFromSummary(
          artifacts.baselineProposal,
          'checksumVariantAnalysisStatus',
        ),
        localArtifactSearchStatus: stringFromSummary(
          artifacts.baselineProposal,
          'localArtifactSearchStatus',
        ),
        externalArtifactPacketStatus: stringFromSummary(
          artifacts.baselineProposal,
          'externalArtifactPacketStatus',
        ),
        exactSqlArtifactMatches: numberFromSummary(
          artifacts.baselineProposal,
          'exactSqlArtifactMatches',
        ),
        externalCandidateIntakeStatus: externalCandidateIntake.status,
        externalCandidateFilesPresent:
          externalCandidateIntake.candidateFilesPresent,
        externalCandidateSqlFilesPresent:
          externalCandidateIntake.candidateSqlFilesPresent,
        externalCandidateArchiveFilesPresent:
          externalCandidateIntake.candidateArchiveFilesPresent,
        externalCandidateGeneratedIntakeFilesPresent:
          externalCandidateIntake.generatedIntakeFilesPresent,
        externalCandidateFiles: externalCandidateIntake.candidateFiles,
        externalCandidateIntakeRoot:
          externalCandidateIntake.suggestedCandidateRoot,
        externalCandidateManifestPath: externalCandidateIntake.manifestPath,
        externalCandidateManifestDigestPath:
          externalCandidateIntake.manifestDigestPath,
        externalCandidateManifestSha256: externalCandidateIntake.manifestSha256,
        externalCandidateManifestSizeBytes:
          externalCandidateIntake.manifestSizeBytes,
        externalCandidateRequestJsonPath:
          externalCandidateIntake.requestJsonPath,
        externalCandidateRequestMarkdownPath:
          externalCandidateIntake.requestMarkdownPath,
        externalCandidateStatusJsonPath: externalCandidateIntake.statusJsonPath,
        externalCandidateStatusMarkdownPath:
          externalCandidateIntake.statusMarkdownPath,
        externalCandidateManifestSourceReportPath:
          externalCandidateIntake.sourceReportPath,
        externalCandidateManifestSourceMarkdownPath:
          externalCandidateIntake.sourceMarkdownPath,
        externalCandidateVerificationCommand:
          externalCandidateIntake.verificationCommand,
        externalCandidateAcceptedArchiveNames:
          externalCandidateIntake.acceptedArchiveNames,
        externalCandidateTargetRows: externalCandidateIntake.targetRows,
      },
    },
    {
      key: 'target-scope-cleared',
      status:
        numberFromSummary(
          artifacts.baselineScopePreflight,
          'productionSignalCount',
        ) === 0
          ? 'ready'
          : 'blocked-production-like-signal',
      evidence: {
        targetScope:
          stringFromSummary(
            artifacts.baselineScopePreflight,
            'effectiveTargetScope',
          ) ??
          stringFromSummary(artifacts.baselineProposal, 'baselineTargetScope'),
        productionSignalCount: numberFromSummary(
          artifacts.baselineScopePreflight,
          'productionSignalCount',
        ),
      },
    },
    {
      key: 'backup-evidence-ready',
      status: booleanFromSummary(
        artifacts.backupEvidencePacket,
        'readyForBaselineResolutionInput',
      )
        ? 'ready'
        : 'blocked',
      evidence: {
        backupArtifactExists: booleanFromSummary(
          artifacts.backupEvidencePacket,
          'backupArtifactExists',
        ),
        backupArtifactSha256: stringFromSummary(
          artifacts.backupEvidencePacket,
          'backupArtifactSha256',
        ),
      },
    },
    {
      key: 'baseline-resolution-approval',
      status:
        artifacts.baselineResolution.status ===
        'REVIEW_APPROVED_BASELINE_RESOLUTION'
          ? 'approved'
          : 'operator-input-required',
      evidence: {
        baselineResolutionStatus: artifacts.baselineResolution.status,
        missingRequiredFields: numberFromSummary(
          artifacts.baselineResolution,
          'missingRequiredFields',
        ),
      },
    },
  ];
}

function buildOperatorHandoff(
  artifacts: Record<string, Artifact>,
  missingApprovalInputs: string[],
  externalCandidateIntake: ReturnType<typeof buildExternalCandidateIntake>,
) {
  const backupEvidenceArgument = stringOrNull(
    objectOrEmpty(artifacts.backupEvidencePacket.raw.baselineResolutionHandoff)
      .backupEvidenceArgument,
  );
  const targetScope =
    stringFromSummary(artifacts.baselineProposal, 'baselineTargetScope') ??
    stringFromSummary(
      artifacts.baselineScopePreflight,
      'effectiveTargetScope',
    ) ??
    '<local-existing|local-disposable|staging-clone>';
  const rationale =
    'Exact SQL remains unrecovered after checksum review, variant analysis, local search, and archive-aware external artifact scan; target is local/staging scoped and backup evidence is attached for review.';
  const unrecoverableOnly =
    artifacts.baselineResolution.status === 'PASS_NO_MISMATCH' &&
    (numberFromSummary(artifacts.baselineProposal, 'unrecoverableRows') ?? 0) >
      0;
  return {
    requiredHumanInputs: missingApprovalInputs,
    requiredAck: REQUIRED_ACK,
    exactSqlCandidateIntake: externalCandidateIntake,
    auditOnlyCommandTemplate: unrecoverableOnly
      ? [
          'Attach an approved operator workflow id, the exact acknowledgement, and rationale to the baseline proposal before any out-of-band Prisma resolve/deploy review.',
          externalCandidateIntake.suggestedCandidateRoot
            ? `Before fallback approval, place any external exact-SQL candidate in ${externalCandidateIntake.suggestedCandidateRoot}.`
            : null,
          externalCandidateIntake.manifestPath
            ? `Use target manifest: ${externalCandidateIntake.manifestPath}.`
            : null,
          externalCandidateIntake.manifestDigestPath
            ? `Use manifest digest sidecar: ${externalCandidateIntake.manifestDigestPath}.`
            : null,
          externalCandidateIntake.manifestSha256
            ? `Target manifest SHA-256: ${externalCandidateIntake.manifestSha256}.`
            : null,
          externalCandidateIntake.requestMarkdownPath
            ? `Forward exact-SQL request: ${externalCandidateIntake.requestMarkdownPath}.`
            : null,
          externalCandidateIntake.statusMarkdownPath
            ? `Check current intake status: ${externalCandidateIntake.statusMarkdownPath}.`
            : null,
          externalCandidateIntake.sourceReportPath
            ? `Manifest source report: ${externalCandidateIntake.sourceReportPath}.`
            : null,
          externalCandidateIntake.verificationCommand
            ? `Verify candidates with: ${externalCandidateIntake.verificationCommand}`
            : null,
          ...externalCandidateIntake.targetRows.map(
            (target) =>
              `Exact-SQL target: ${target.targetMigrationPath ?? 'unknown'} sha256=${target.requiredSha256 ?? 'unknown'}.`,
          ),
          externalCandidateIntake.acceptedArchiveNames.length > 0
            ? `Accepted archive candidates: ${externalCandidateIntake.acceptedArchiveNames.join(', ')}.`
            : null,
          `Required acknowledgement: ${REQUIRED_ACK}`,
          `Target scope: ${targetScope}`,
          `Backup evidence: ${backupEvidenceArgument ?? '<backup evidence argument>'}`,
        ]
          .filter((line): line is string => typeof line === 'string')
          .join(' ')
      : `pnpm --filter api audit:database-migration-baseline-resolution -- ` +
        `--checksum-review /tmp/database-migration-checksum-review-latest.json ` +
        `--external-artifact-packet /tmp/database-migration-external-artifact-packet-archive-latest.json ` +
        `--decision baseline-resolve-local-only ` +
        `--target-scope ${targetScope} ` +
        `--approved-operator-workflow <approved workflow id> ` +
        `--operator-ack ${REQUIRED_ACK} ` +
        `--rationale ${JSON.stringify(rationale)} ` +
        `--backup-evidence ${JSON.stringify(backupEvidenceArgument ?? '<backup evidence argument>')}`,
    approvalNote: unrecoverableOnly
      ? 'This handoff only records the remaining human approval inputs for unrecoverable migration history. It still does not run Prisma resolve/deploy.'
      : 'This command only creates a review-approved baseline-resolution artifact when a human supplies the workflow id and exact acknowledgement. It still does not run Prisma resolve/deploy.',
  };
}

function buildNextCampaign(
  status: ApprovalRequestStatus,
  externalCandidateIntake: ReturnType<typeof buildExternalCandidateIntake>,
) {
  if (status === 'REVIEW_OPERATOR_APPROVAL_REQUIRED') {
    return {
      id: 'database_migration_operator_approval',
      reason:
        'All non-approval baseline evidence is present for the fallback path; exact SQL recovery remains preferred before any human baseline acknowledgement.',
      preferredPriorCampaign: 'database_migration_external_exact_sql_recovery',
      candidateRoot: externalCandidateIntake.suggestedCandidateRoot,
      manifestPath: externalCandidateIntake.manifestPath,
      manifestDigestPath: externalCandidateIntake.manifestDigestPath,
      manifestSha256: externalCandidateIntake.manifestSha256,
      manifestSizeBytes: externalCandidateIntake.manifestSizeBytes,
      requestJsonPath: externalCandidateIntake.requestJsonPath,
      requestMarkdownPath: externalCandidateIntake.requestMarkdownPath,
      statusJsonPath: externalCandidateIntake.statusJsonPath,
      statusMarkdownPath: externalCandidateIntake.statusMarkdownPath,
      candidateFilesPresent: externalCandidateIntake.candidateFilesPresent,
      candidateSqlFilesPresent:
        externalCandidateIntake.candidateSqlFilesPresent,
      candidateArchiveFilesPresent:
        externalCandidateIntake.candidateArchiveFilesPresent,
      generatedIntakeFilesPresent:
        externalCandidateIntake.generatedIntakeFilesPresent,
      verificationCommand: externalCandidateIntake.verificationCommand,
      acceptedArchiveNames: externalCandidateIntake.acceptedArchiveNames,
      targetRows: externalCandidateIntake.targetRows,
    };
  }
  if (status === 'REVIEW_APPROVED_BASELINE_RESOLUTION') {
    return {
      id: 'database_migration_baseline_operator_review',
      reason:
        'Baseline resolution is review-approved; operator resolve/deploy and rerun evidence are required outside read-only scripts.',
    };
  }
  return {
    id: 'database_migration_baseline_approval_request',
    reason:
      'Baseline approval request cannot be handed off until required evidence artifacts and backup readiness are present.',
    preferredPriorCampaign: 'database_migration_external_exact_sql_recovery',
    candidateRoot: externalCandidateIntake.suggestedCandidateRoot,
    manifestPath: externalCandidateIntake.manifestPath,
    manifestDigestPath: externalCandidateIntake.manifestDigestPath,
    manifestSha256: externalCandidateIntake.manifestSha256,
    manifestSizeBytes: externalCandidateIntake.manifestSizeBytes,
    requestJsonPath: externalCandidateIntake.requestJsonPath,
    requestMarkdownPath: externalCandidateIntake.requestMarkdownPath,
    statusJsonPath: externalCandidateIntake.statusJsonPath,
    statusMarkdownPath: externalCandidateIntake.statusMarkdownPath,
    candidateFilesPresent: externalCandidateIntake.candidateFilesPresent,
    candidateSqlFilesPresent: externalCandidateIntake.candidateSqlFilesPresent,
    candidateArchiveFilesPresent:
      externalCandidateIntake.candidateArchiveFilesPresent,
    generatedIntakeFilesPresent:
      externalCandidateIntake.generatedIntakeFilesPresent,
    verificationCommand: externalCandidateIntake.verificationCommand,
    acceptedArchiveNames: externalCandidateIntake.acceptedArchiveNames,
    targetRows: externalCandidateIntake.targetRows,
  };
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value.filter(
            (item): item is string =>
              typeof item === 'string' && item.trim().length > 0,
          ),
        ),
      )
    : [];
}

function stringFromSummary(artifact: Artifact, key: string) {
  return stringOrNull(artifact.summary[key]);
}

function numberFromSummary(artifact: Artifact, key: string) {
  const value = artifact.summary[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function booleanFromSummary(artifact: Artifact, key: string) {
  return artifact.summary[key] === true;
}

function candidateTargetRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (row): row is Record<string, unknown> =>
        row !== null && typeof row === 'object',
    )
    .map((row) => ({
      migration: stringOrNull(row.migration),
      requestSubject: stringOrNull(row.requestSubject),
      sourceKind: stringOrNull(row.sourceKind),
      targetMigrationPath: stringOrNull(row.targetMigrationPath),
      requiredSha256: stringOrNull(row.requiredSha256),
    }))
    .filter(
      (row) =>
        row.migration ||
        row.requestSubject ||
        row.sourceKind ||
        row.targetMigrationPath ||
        row.requiredSha256,
    );
}

function renderMarkdown(report: Record<string, any>) {
  const summary = report.summary as Record<string, unknown>;
  const externalCandidateIntake = objectOrEmpty(report.externalCandidateIntake);
  const externalCandidateTargetRows = candidateTargetRows(
    externalCandidateIntake.targetRows,
  );
  const lines = [
    '# Database Migration Baseline Approval Request Packet',
    '',
    `Status: ${report.status}`,
    '',
    'This is a read-only approval request packet. It does not approve a baseline decision, run Prisma resolve/deploy, restore SQL, or write to the database.',
    '',
    '## Summary',
    '',
    `- Baseline proposal: ${summary.baselineProposalStatus ?? 'unknown'}`,
    `- Baseline resolution: ${summary.baselineResolutionStatus ?? 'unknown'}`,
    `- Backup evidence packet: ${summary.backupEvidencePacketStatus ?? 'unknown'}`,
    `- Target scope: ${summary.effectiveTargetScope ?? 'unknown'}`,
    `- Exact SQL artifact matches: ${summary.exactSqlArtifactMatches ?? 'unknown'}`,
    `- Open migration blockers: ${summary.openMigrationBlockers ?? 'unknown'}`,
    `- Unrecoverable rows: ${summary.unrecoverableRows ?? 'unknown'}`,
    `- Unresolved checksum mismatches: ${summary.unresolvedChecksumMismatches ?? 'unknown'}`,
    `- Backup evidence ready: ${summary.backupEvidenceReady ?? false}`,
    `- Missing approval inputs: ${summary.missingApprovalInputs ?? 0}`,
    '',
    '## External Exact SQL Candidate Intake',
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
    `- Accepted archive names: ${stringList(externalCandidateIntake.acceptedArchiveNames).join(', ') || 'unknown'}`,
    `- Verification command: ${externalCandidateIntake.verificationCommand ?? 'unknown'}`,
    `- Searched roots: ${stringList(externalCandidateIntake.searchedRoots).join(', ') || 'unknown'}`,
    `- Candidate files: ${stringList(externalCandidateIntake.candidateFiles).join(', ') || 'none'}`,
    '- Verification checklist:',
    ...renderList(
      stringList(externalCandidateIntake.verificationChecklist),
    ).map((line) => `  ${line}`),
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
    '## Missing Approval Inputs',
    '',
    ...renderList(report.missingApprovalInputs ?? []),
    '',
    '## Approval Checklist',
    '',
    ...report.approvalChecklist.map(
      (item: Record<string, unknown>) => `- ${item.key}: ${item.status}`,
    ),
    '',
    '## Operator Handoff',
    '',
    `- Required acknowledgement: ${report.operatorHandoff.requiredAck}`,
    `- Audit-only command: ${report.operatorHandoff.auditOnlyCommandTemplate}`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderList(items: string[]) {
  if (items.length === 0) return ['- None'];
  return items.map((item) => `- ${item}`);
}

function printSummary(
  out: string,
  markdown: string,
  report: Record<string, any>,
) {
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out,
        markdown,
        missingApprovalInputs: report.summary.missingApprovalInputs,
        approvalRequestReady: report.summary.approvalRequestReady,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
