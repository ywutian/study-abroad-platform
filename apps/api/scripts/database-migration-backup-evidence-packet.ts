#!/usr/bin/env tsx
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

type BackupEvidenceStatus =
  | 'PASS_NO_DB_MIGRATION_BLOCKER'
  | 'BLOCKED_SCOPE_PREFLIGHT_REQUIRED'
  | 'BLOCKED_REMOTE_OR_PRODUCTION_LIKE_TARGET'
  | 'BLOCKED_BACKUP_EVIDENCE_REQUIRED'
  | 'BLOCKED_EVIDENCE_PATH_MISSING'
  | 'REVIEW_BACKUP_OR_DISPOSABLE_TARGET_READY';

interface Args {
  baselineScopePreflight: string | null;
  baselineProposal: string | null;
  targetScope: string | null;
  backupEvidence: string | null;
  backupArtifact: string | null;
  disposableTargetEvidence: string | null;
  stagingCloneEvidence: string | null;
  approvedOperatorWorkflow: string | null;
  out: string;
  markdown: string;
  maxHashBytes: number;
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

interface FileEvidence {
  inputPath: string | null;
  resolvedPath: string | null;
  exists: boolean;
  sizeBytes: number | null;
  modifiedAt: string | null;
  sha256: string | null;
  hashSkippedReason: string | null;
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
        `database-migration-backup-evidence-packet-${stamp}.json`,
      ),
    )!,
  );
  return {
    baselineScopePreflight: optionalPath(
      '--baseline-scope-preflight',
      /^database-migration-baseline-scope-preflight-.+\.json$/,
    ),
    baselineProposal: optionalPath(
      '--baseline-proposal',
      /^database-migration-baseline-proposal-.+\.json$/,
    ),
    targetScope: get('--target-scope') ?? null,
    backupEvidence: get('--backup-evidence') ?? null,
    backupArtifact: get('--backup-artifact') ?? null,
    disposableTargetEvidence: get('--disposable-target-evidence') ?? null,
    stagingCloneEvidence: get('--staging-clone-evidence') ?? null,
    approvedOperatorWorkflow: get('--approved-operator-workflow') ?? null,
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    maxHashBytes: Number(get('--max-hash-bytes', `${512 * 1024 * 1024}`)),
  };
}

function main() {
  const args = parseArgs();
  const baselineScopePreflight = readArtifact(
    'database_migration_baseline_scope_preflight',
    args.baselineScopePreflight,
  );
  const baselineProposal = readArtifact(
    'database_migration_baseline_proposal',
    args.baselineProposal,
  );
  const backupArtifact = inspectFileEvidence(
    args.backupArtifact,
    args.maxHashBytes,
  );
  const effectiveTargetScope =
    args.targetScope ??
    stringFromSummary(baselineScopePreflight, 'effectiveTargetScope') ??
    stringFromSummary(baselineProposal, 'baselineScopeEffectiveTarget');
  const productionSignalCount =
    numberFromSummary(baselineScopePreflight, 'productionSignalCount') ?? 0;
  const evidenceInputs = buildEvidenceInputs(args, backupArtifact);
  const missingRequiredInputs = buildMissingInputs({
    baselineScopePreflight,
    effectiveTargetScope,
    productionSignalCount,
    evidenceInputs,
    backupArtifact,
  });
  const status = chooseStatus({
    baselineScopePreflight,
    productionSignalCount,
    missingRequiredInputs,
  });
  const baselineResolutionBackupEvidenceArgument =
    buildBaselineResolutionBackupEvidenceArgument({
      args,
      backupArtifact,
      status,
    });
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-migration-backup-evidence-packet',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    prismaResolveOrDeployExecuted: false,
    operatorApprovalGranted: false,
    sourceArtifacts: {
      baselineScopePreflight,
      baselineProposal,
    },
    summary: {
      baselineScopePreflightStatus: baselineScopePreflight.status,
      baselineProposalStatus: baselineProposal.status,
      effectiveTargetScope,
      productionSignalCount,
      backupEvidenceTextProvided: Boolean(args.backupEvidence),
      backupArtifactProvided: Boolean(args.backupArtifact),
      backupArtifactExists: backupArtifact.exists,
      backupArtifactSha256: backupArtifact.sha256,
      disposableTargetEvidenceProvided: Boolean(args.disposableTargetEvidence),
      stagingCloneEvidenceProvided: Boolean(args.stagingCloneEvidence),
      approvedOperatorWorkflowProvided: Boolean(args.approvedOperatorWorkflow),
      missingRequiredInputs: missingRequiredInputs.length,
      readyForBaselineResolutionInput:
        status === 'REVIEW_BACKUP_OR_DISPOSABLE_TARGET_READY',
    },
    backupArtifact,
    evidenceInputs,
    missingRequiredInputs,
    baselineResolutionHandoff: {
      readyForApprovalGate:
        status === 'REVIEW_BACKUP_OR_DISPOSABLE_TARGET_READY',
      backupEvidenceArgument: baselineResolutionBackupEvidenceArgument,
      auditOnlyCommandTemplate:
        `pnpm --filter api audit:database-migration-baseline-resolution -- ` +
        `--checksum-review /tmp/database-migration-checksum-review-latest.json ` +
        `--external-artifact-packet /tmp/database-migration-external-artifact-packet-archive-latest.json ` +
        `--decision baseline-resolve-local-only ` +
        `--target-scope ${effectiveTargetScope ?? '<local-existing|local-disposable|staging-clone>'} ` +
        `--approved-operator-workflow <approved workflow id> ` +
        `--operator-ack ${REQUIRED_ACK} ` +
        `--rationale <why exact SQL cannot be recovered and why this target may be resolved> ` +
        `--backup-evidence ${baselineResolutionBackupEvidenceArgument ?? '<backup/disposable/staging clone evidence>'}`,
    },
    operatorGuardrails: {
      mode: 'read-only',
      productionScopeAllowed: false,
      writeCommandsIntentionallyOmitted: [
        'pg_dump',
        'prisma migrate resolve',
        'prisma migrate deploy',
        'prisma db push',
        'SQL restore',
      ],
      evidenceDoesNotGrantApproval: true,
      requiredApprovalGate: 'audit:database-migration-baseline-resolution',
      requiredAck: REQUIRED_ACK,
    },
    recommendedSequence: buildRecommendedSequence(status),
    nextCampaign: buildNextCampaign(status),
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
      summary:
        raw.summary && typeof raw.summary === 'object'
          ? (raw.summary as Record<string, unknown>)
          : {},
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

function inspectFileEvidence(
  inputPath: string | null,
  maxHashBytes: number,
): FileEvidence {
  if (!inputPath) {
    return {
      inputPath: null,
      resolvedPath: null,
      exists: false,
      sizeBytes: null,
      modifiedAt: null,
      sha256: null,
      hashSkippedReason: null,
      error: null,
    };
  }
  const resolved = path.resolve(API_ROOT, inputPath);
  if (!fs.existsSync(resolved)) {
    return {
      inputPath,
      resolvedPath: path.relative(API_ROOT, resolved),
      exists: false,
      sizeBytes: null,
      modifiedAt: null,
      sha256: null,
      hashSkippedReason: null,
      error: 'Backup artifact path does not exist',
    };
  }
  try {
    const stat = fs.statSync(resolved);
    const isFile = stat.isFile();
    const sha256 =
      isFile && stat.size <= maxHashBytes ? sha256File(resolved) : null;
    return {
      inputPath,
      resolvedPath: path.relative(API_ROOT, resolved),
      exists: isFile,
      sizeBytes: isFile ? stat.size : null,
      modifiedAt: isFile ? stat.mtime.toISOString() : null,
      sha256,
      hashSkippedReason: isFile
        ? stat.size > maxHashBytes
          ? `File exceeds --max-hash-bytes (${maxHashBytes})`
          : null
        : 'Path is not a file',
      error: isFile ? null : 'Backup artifact path is not a file',
    };
  } catch (error) {
    return {
      inputPath,
      resolvedPath: path.relative(API_ROOT, resolved),
      exists: false,
      sizeBytes: null,
      modifiedAt: null,
      sha256: null,
      hashSkippedReason: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sha256File(filePath: string) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function buildEvidenceInputs(args: Args, backupArtifact: FileEvidence) {
  return [
    {
      key: 'backup-evidence-text',
      provided: Boolean(args.backupEvidence),
      valuePreview: preview(args.backupEvidence),
    },
    {
      key: 'backup-artifact',
      provided: backupArtifact.exists,
      valuePreview: backupArtifact.resolvedPath,
      sha256: backupArtifact.sha256,
    },
    {
      key: 'disposable-target-evidence',
      provided: Boolean(args.disposableTargetEvidence),
      valuePreview: preview(args.disposableTargetEvidence),
    },
    {
      key: 'staging-clone-evidence',
      provided: Boolean(args.stagingCloneEvidence),
      valuePreview: preview(args.stagingCloneEvidence),
    },
  ];
}

function buildMissingInputs(input: {
  baselineScopePreflight: Artifact;
  effectiveTargetScope: string | null;
  productionSignalCount: number;
  evidenceInputs: Array<Record<string, unknown>>;
  backupArtifact: FileEvidence;
}) {
  const missing: Array<{
    key: string;
    required: boolean;
    provided: boolean;
    expected: string;
    actual: string | null;
  }> = [];
  if (!input.baselineScopePreflight.exists) {
    missing.push({
      key: 'baseline-scope-preflight',
      required: true,
      provided: false,
      expected: 'read-only baseline scope preflight artifact',
      actual: input.baselineScopePreflight.error,
    });
  }
  if (!input.effectiveTargetScope) {
    missing.push({
      key: 'target-scope',
      required: true,
      provided: false,
      expected: 'local-existing|local-disposable|staging-clone',
      actual: null,
    });
  }
  if (input.productionSignalCount > 0) {
    missing.push({
      key: 'non-production-target-clearance',
      required: true,
      provided: false,
      expected: 'no production-like signals in baseline preflight',
      actual: `${input.productionSignalCount} production-like signals`,
    });
  }
  if (input.backupArtifact.inputPath && !input.backupArtifact.exists) {
    missing.push({
      key: 'backup-artifact-readable',
      required: true,
      provided: false,
      expected: 'existing readable backup artifact file',
      actual: input.backupArtifact.error,
    });
  }
  if (!input.evidenceInputs.some((item) => item.provided === true)) {
    missing.push({
      key: 'backup-or-disposable-target-evidence',
      required: true,
      provided: false,
      expected:
        'backup artifact/text, disposable DB evidence, or staging clone evidence',
      actual: null,
    });
  }
  return missing;
}

function chooseStatus(input: {
  baselineScopePreflight: Artifact;
  productionSignalCount: number;
  missingRequiredInputs: Array<Record<string, unknown>>;
}): BackupEvidenceStatus {
  if (input.baselineScopePreflight.status === 'PASS_NO_DB_MIGRATION_BLOCKER') {
    return 'PASS_NO_DB_MIGRATION_BLOCKER';
  }
  if (!input.baselineScopePreflight.exists) {
    return 'BLOCKED_SCOPE_PREFLIGHT_REQUIRED';
  }
  if (input.productionSignalCount > 0) {
    return 'BLOCKED_REMOTE_OR_PRODUCTION_LIKE_TARGET';
  }
  if (
    input.missingRequiredInputs.some(
      (item) => item.key === 'backup-artifact-readable',
    )
  ) {
    return 'BLOCKED_EVIDENCE_PATH_MISSING';
  }
  if (input.missingRequiredInputs.length > 0) {
    return 'BLOCKED_BACKUP_EVIDENCE_REQUIRED';
  }
  return 'REVIEW_BACKUP_OR_DISPOSABLE_TARGET_READY';
}

function buildBaselineResolutionBackupEvidenceArgument(input: {
  args: Args;
  backupArtifact: FileEvidence;
  status: BackupEvidenceStatus;
}) {
  if (input.status !== 'REVIEW_BACKUP_OR_DISPOSABLE_TARGET_READY') {
    return null;
  }
  if (input.backupArtifact.exists) {
    return [
      `artifact:${input.backupArtifact.resolvedPath}`,
      `sha256:${input.backupArtifact.sha256 ?? 'not-hashed'}`,
      `size:${input.backupArtifact.sizeBytes ?? 'unknown'}`,
    ].join(',');
  }
  return (
    input.args.backupEvidence ??
    input.args.disposableTargetEvidence ??
    input.args.stagingCloneEvidence ??
    null
  );
}

function buildRecommendedSequence(status: BackupEvidenceStatus) {
  if (status === 'PASS_NO_DB_MIGRATION_BLOCKER') {
    return ['Rerun platform data closure audit and resume DB-backed closure.'];
  }
  if (status === 'REVIEW_BACKUP_OR_DISPOSABLE_TARGET_READY') {
    return [
      'Use this packet as backup/disposable-target evidence input only.',
      'Run audit:database-migration-baseline-resolution with the required workflow, acknowledgement, rationale, target scope, and backup evidence.',
      'Do not run Prisma resolve/deploy until the baseline-resolution artifact reaches review-approved status.',
    ];
  }
  if (status === 'BLOCKED_SCOPE_PREFLIGHT_REQUIRED') {
    return [
      'Run audit:database-migration-baseline-scope-preflight first.',
      'Then rerun this packet with the latest scope preflight artifact.',
    ];
  }
  return [
    'Provide backup evidence, an existing backup artifact path, disposable DB evidence, or staging clone evidence.',
    'Rerun this packet; if it reaches review-ready, pass its backup evidence argument into audit:database-migration-baseline-resolution.',
  ];
}

function buildNextCampaign(status: BackupEvidenceStatus) {
  if (status === 'REVIEW_BACKUP_OR_DISPOSABLE_TARGET_READY') {
    return {
      id: 'database_migration_baseline_resolution_approval',
      reason:
        'Backup/disposable target evidence is ready for the explicit baseline-resolution approval gate.',
    };
  }
  if (status === 'PASS_NO_DB_MIGRATION_BLOCKER') {
    return {
      id: 'database_schema_compatibility',
      reason:
        'Rerun DB-backed closure after migration blocker evidence passes.',
    };
  }
  return {
    id: 'database_migration_backup_or_disposable_target_evidence',
    reason:
      'Baseline scope preflight still lacks backup, disposable DB, or staging clone evidence.',
  };
}

function stringFromSummary(artifact: Artifact, key: string) {
  const value = artifact.summary[key];
  return stringOrNull(value);
}

function numberFromSummary(artifact: Artifact, key: string) {
  const value = artifact.summary[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function preview(value: string | null) {
  if (!value) return null;
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function renderMarkdown(report: Record<string, any>) {
  const summary = report.summary as Record<string, unknown>;
  const missing = Array.isArray(report.missingRequiredInputs)
    ? report.missingRequiredInputs
    : [];
  return [
    '# Database Migration Backup Evidence Packet',
    '',
    `Status: ${report.status}`,
    '',
    'This is a read-only evidence packet. It does not run pg_dump, Prisma resolve/deploy, db push, SQL restore, or any database write.',
    '',
    '## Summary',
    '',
    `- Baseline scope preflight: ${summary.baselineScopePreflightStatus ?? 'unknown'}`,
    `- Baseline proposal: ${summary.baselineProposalStatus ?? 'unknown'}`,
    `- Target scope: ${summary.effectiveTargetScope ?? 'unknown'}`,
    `- Production-like signals: ${summary.productionSignalCount ?? 0}`,
    `- Backup evidence text provided: ${summary.backupEvidenceTextProvided ?? false}`,
    `- Backup artifact exists: ${summary.backupArtifactExists ?? false}`,
    `- Disposable target evidence provided: ${summary.disposableTargetEvidenceProvided ?? false}`,
    `- Staging clone evidence provided: ${summary.stagingCloneEvidenceProvided ?? false}`,
    `- Missing required inputs: ${summary.missingRequiredInputs ?? 0}`,
    '',
    '## Missing Inputs',
    '',
    ...renderMissing(missing),
    '',
    '## Baseline Resolution Handoff',
    '',
    `- Ready for approval gate: ${report.baselineResolutionHandoff.readyForApprovalGate}`,
    `- Backup evidence argument: ${report.baselineResolutionHandoff.backupEvidenceArgument ?? '<not ready>'}`,
    `- Command template: ${report.baselineResolutionHandoff.auditOnlyCommandTemplate}`,
    '',
  ].join('\n');
}

function renderMissing(items: Array<Record<string, unknown>>) {
  if (items.length === 0) return ['- None'];
  return items.map(
    (item) =>
      `- ${item.key}: expected=${item.expected}; actual=${item.actual ?? 'missing'}`,
  );
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
        missingRequiredInputs: report.summary.missingRequiredInputs,
        readyForBaselineResolutionInput:
          report.summary.readyForBaselineResolutionInput,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
