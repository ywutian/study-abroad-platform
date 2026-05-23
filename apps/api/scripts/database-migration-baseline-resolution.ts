#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';

type ResolutionStatus =
  | 'BLOCKED_DECISION_REQUIRED'
  | 'BLOCKED_EXACT_SQL_REQUIRED'
  | 'BLOCKED_UNRECOVERABLE_MIGRATION_REQUIRED'
  | 'BLOCKED_UNSUPPORTED_TARGET_SCOPE'
  | 'REVIEW_APPROVED_BASELINE_RESOLUTION'
  | 'REVIEW_APPROVED_EXACT_SQL_RESTORE'
  | 'PASS_NO_MISMATCH';

type ResolutionDecision =
  | 'continue-external-search'
  | 'baseline-resolve-local-only'
  | 'baseline-resolve-local-db'
  | 'restore-exact-sql';

type NormalizedResolutionDecision =
  | 'continue-external-search'
  | 'baseline-resolve-local-only'
  | 'restore-exact-sql';

interface Args {
  checksumReview: string;
  externalArtifactPacket: string | null;
  unrecoverableArtifactSearch: string | null;
  out: string;
  markdown: string;
  decision: NormalizedResolutionDecision;
  targetScope: string | null;
  approvedWorkflow: string | null;
  operatorAck: string | null;
  rationale: string | null;
  backupEvidence: string | null;
}

interface ChecksumReviewReport {
  generatedAt: string;
  status: string;
  summary: {
    checksumMismatchRows: number;
    exactMatchLocations: number;
    unresolvedMismatches: number;
  };
  rows: Array<{
    migration: string;
    dbChecksum: string | null;
    selectedRecoveredSqlSha256: string | null;
    exactMatchLocations: Array<Record<string, unknown>>;
    disposition: string;
  }>;
}

interface ExternalArtifactPacketReport {
  generatedAt: string;
  status: string;
  summary?: {
    exactArtifactMatches?: number;
  };
}

interface UnrecoverableArtifactSearchReport {
  generatedAt: string;
  status: string;
  summary?: {
    unrecoverableRows?: number;
    exactArtifactMatches?: number;
  };
  rows?: Array<{
    migration?: string;
    dbChecksum?: string | null;
    artifactSearch?: {
      exactMatches?: Array<Record<string, unknown>>;
    };
  }>;
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const REQUIRED_ACK = 'APPROVED_DATABASE_MIGRATION_BASELINE_RESOLVE';
const SUPPORTED_BASELINE_SCOPES = new Set([
  'local-existing',
  'local-disposable',
  'staging-clone',
]);

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
  const defaultOut = path.join(
    REPORT_ROOT,
    `database-migration-baseline-resolution-${stamp}.json`,
  );
  const out = path.resolve(API_ROOT, get('--out', defaultOut)!);
  const checksumReview = get('--checksum-review');
  const externalArtifactPacket = get('--external-artifact-packet');
  const unrecoverableArtifactSearch = get('--unrecoverable-artifact-search');
  return {
    checksumReview: path.resolve(
      API_ROOT,
      checksumReview ?? findLatestChecksumReview(),
    ),
    externalArtifactPacket: externalArtifactPacket
      ? path.resolve(API_ROOT, externalArtifactPacket)
      : null,
    unrecoverableArtifactSearch: unrecoverableArtifactSearch
      ? path.resolve(API_ROOT, unrecoverableArtifactSearch)
      : findLatestOptional(
          /^database-migration-unrecoverable-artifact-search-.+\.json$/,
        ),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    decision: normalizeDecision(
      (get('--decision', 'continue-external-search') ??
        'continue-external-search') as ResolutionDecision,
    ),
    targetScope: get('--target-scope') ?? null,
    approvedWorkflow: get('--approved-operator-workflow') ?? null,
    operatorAck: get('--operator-ack') ?? null,
    rationale: get('--rationale') ?? null,
    backupEvidence: get('--backup-evidence') ?? null,
  };
}

function main() {
  const args = parseArgs();
  const checksumReview = JSON.parse(
    fs.readFileSync(args.checksumReview, 'utf8'),
  ) as ChecksumReviewReport;
  const externalArtifactPacket = args.externalArtifactPacket
    ? (JSON.parse(
        fs.readFileSync(args.externalArtifactPacket, 'utf8'),
      ) as ExternalArtifactPacketReport)
    : null;
  const unrecoverableArtifactSearch = args.unrecoverableArtifactSearch
    ? (JSON.parse(
        fs.readFileSync(args.unrecoverableArtifactSearch, 'utf8'),
      ) as UnrecoverableArtifactSearchReport)
    : null;
  const status = chooseStatus(
    args,
    checksumReview,
    externalArtifactPacket,
    unrecoverableArtifactSearch,
  );
  const requiredFields = buildRequiredFields(
    args,
    checksumReview,
    externalArtifactPacket,
    unrecoverableArtifactSearch,
    status,
  );
  const summary = buildSummary(
    args,
    checksumReview,
    externalArtifactPacket,
    unrecoverableArtifactSearch,
    status,
    requiredFields,
  );
  const requiredOperatorInputs = buildRequiredOperatorInputs(
    args,
    checksumReview,
    externalArtifactPacket,
    unrecoverableArtifactSearch,
  );
  const operatorGuardrails = buildOperatorGuardrails();
  const recommendedNextStep = buildRecommendedNextStep(
    status,
    args,
    checksumReview,
    externalArtifactPacket,
    unrecoverableArtifactSearch,
  );
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-migration-baseline-resolution',
    status,
    summary,
    sourceChecksumReview: path.relative(API_ROOT, args.checksumReview),
    sourceExternalArtifactPacket: args.externalArtifactPacket
      ? path.relative(API_ROOT, args.externalArtifactPacket)
      : null,
    sourceUnrecoverableArtifactSearch: args.unrecoverableArtifactSearch
      ? path.relative(API_ROOT, args.unrecoverableArtifactSearch)
      : null,
    checksumReviewGeneratedAt: checksumReview.generatedAt,
    checksumReviewStatus: checksumReview.status,
    externalArtifactPacketGeneratedAt: externalArtifactPacket?.generatedAt,
    externalArtifactPacketStatus: externalArtifactPacket?.status ?? null,
    unrecoverableArtifactSearchGeneratedAt:
      unrecoverableArtifactSearch?.generatedAt,
    unrecoverableArtifactSearchStatus:
      unrecoverableArtifactSearch?.status ?? null,
    decision: args.decision,
    targetScope: args.targetScope,
    destructiveDbWriteAllowedByThisPlan: false,
    approvedOperatorWorkflow: args.approvedWorkflow,
    operatorAckMatchesRequired: args.operatorAck === REQUIRED_ACK,
    rationale: args.rationale,
    backupEvidence: args.backupEvidence,
    requiredAck: REQUIRED_ACK,
    unresolvedMismatches: checksumReview.rows.filter(
      (row) => row.exactMatchLocations.length === 0,
    ),
    requiredFields,
    requiredOperatorInputs,
    operatorGuardrails,
    riskAssessment: buildRiskAssessment(
      status,
      args,
      checksumReview,
      externalArtifactPacket,
      unrecoverableArtifactSearch,
    ),
    recommendedSequence: buildRecommendedSequence(status),
    recommendedNextStep,
    nextCampaign: buildNextCampaign(status),
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  printSummary(args.out, args.markdown, report);
}

function findLatestChecksumReview() {
  if (!fs.existsSync(REPORT_ROOT)) {
    throw new Error(
      'No --checksum-review provided and scripts/closure-reports does not exist',
    );
  }
  const latest = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) =>
      /^database-migration-checksum-review-.+\.json$/.test(file),
    )
    .map((file) => ({
      file,
      mtimeMs: fs.statSync(path.join(REPORT_ROOT, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  if (!latest) {
    throw new Error('No --checksum-review provided and no report found');
  }
  return path.join(REPORT_ROOT, latest.file);
}

function findLatestOptional(pattern: RegExp) {
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

function chooseStatus(
  args: Args,
  checksumReview: ChecksumReviewReport,
  externalArtifactPacket: ExternalArtifactPacketReport | null,
  unrecoverableArtifactSearch: UnrecoverableArtifactSearchReport | null,
): ResolutionStatus {
  if (
    checksumReview.summary.checksumMismatchRows === 0 &&
    unresolvedUnrecoverableMigrations(unrecoverableArtifactSearch) === 0
  ) {
    return 'PASS_NO_MISMATCH';
  }
  if (args.decision === 'restore-exact-sql') {
    return combinedExactArtifactMatches(
      checksumReview,
      externalArtifactPacket,
      unrecoverableArtifactSearch,
    ) > 0 && hasApproval(args, false)
      ? 'REVIEW_APPROVED_EXACT_SQL_RESTORE'
      : 'BLOCKED_EXACT_SQL_REQUIRED';
  }
  if (unresolvedUnrecoverableMigrations(unrecoverableArtifactSearch) > 0) {
    return 'BLOCKED_UNRECOVERABLE_MIGRATION_REQUIRED';
  }
  if (args.decision !== 'baseline-resolve-local-only') {
    return 'BLOCKED_DECISION_REQUIRED';
  }
  if (!args.targetScope || !SUPPORTED_BASELINE_SCOPES.has(args.targetScope)) {
    return 'BLOCKED_UNSUPPORTED_TARGET_SCOPE';
  }
  return hasApproval(args, true)
    ? 'REVIEW_APPROVED_BASELINE_RESOLUTION'
    : 'BLOCKED_DECISION_REQUIRED';
}

function hasApproval(args: Args, requireBackup: boolean) {
  return Boolean(
    args.approvedWorkflow &&
    args.operatorAck === REQUIRED_ACK &&
    args.rationale &&
    (!requireBackup || args.backupEvidence),
  );
}

function buildRequiredFields(
  args: Args,
  checksumReview: ChecksumReviewReport,
  externalArtifactPacket: ExternalArtifactPacketReport | null,
  unrecoverableArtifactSearch: UnrecoverableArtifactSearchReport | null,
  status: ResolutionStatus,
) {
  if (status.startsWith('REVIEW_APPROVED') || status === 'PASS_NO_MISMATCH') {
    return [];
  }
  const fields = [];
  const combinedExactMatches = combinedExactArtifactMatches(
    checksumReview,
    externalArtifactPacket,
    unrecoverableArtifactSearch,
  );
  const unresolvedUnrecoverable = unresolvedUnrecoverableMigrations(
    unrecoverableArtifactSearch,
  );
  if (
    checksumReview.summary.unresolvedMismatches > 0 &&
    args.decision === 'continue-external-search'
  ) {
    fields.push(
      combinedExactMatches > 0
        ? 'restore-exact-sql decision or explicit baseline/resolve decision'
        : 'external exact SQL artifact, or explicit baseline/resolve decision',
    );
  }
  if (
    unresolvedUnrecoverable > 0 &&
    args.decision === 'continue-external-search'
  ) {
    fields.push(
      'external exact SQL artifact for unrecoverable migration history, or explicit baseline/resolve decision',
    );
  }
  if (args.decision === 'baseline-resolve-local-only') {
    if (!args.targetScope) fields.push('--target-scope');
    if (args.targetScope && !SUPPORTED_BASELINE_SCOPES.has(args.targetScope)) {
      fields.push(
        'supported --target-scope: local-existing, local-disposable, staging-clone',
      );
    }
    if (!args.approvedWorkflow) fields.push('--approved-operator-workflow');
    if (args.operatorAck !== REQUIRED_ACK) {
      fields.push(`--operator-ack ${REQUIRED_ACK}`);
    }
    if (!args.rationale) fields.push('--rationale');
    if (!args.backupEvidence) fields.push('--backup-evidence');
  }
  if (args.decision === 'restore-exact-sql') {
    if (combinedExactMatches === 0) {
      fields.push(
        'checksum review or external artifact packet with exact SQL artifact match > 0',
      );
    }
    if (!args.approvedWorkflow) fields.push('--approved-operator-workflow');
    if (args.operatorAck !== REQUIRED_ACK) {
      fields.push(`--operator-ack ${REQUIRED_ACK}`);
    }
    if (!args.rationale) fields.push('--rationale');
  }
  return fields;
}

function buildSummary(
  args: Args,
  checksumReview: ChecksumReviewReport,
  externalArtifactPacket: ExternalArtifactPacketReport | null,
  unrecoverableArtifactSearch: UnrecoverableArtifactSearchReport | null,
  status: ResolutionStatus,
  requiredFields: string[],
) {
  const externalExactArtifactMatches = getExternalExactArtifactMatches(
    externalArtifactPacket,
  );
  const unrecoverableRows = getUnrecoverableRows(unrecoverableArtifactSearch);
  const unrecoverableExactArtifactMatches =
    getUnrecoverableExactArtifactMatches(unrecoverableArtifactSearch);
  return {
    checksumReviewStatus: checksumReview.status,
    externalArtifactPacketStatus: externalArtifactPacket?.status ?? null,
    unrecoverableArtifactSearchStatus:
      unrecoverableArtifactSearch?.status ?? null,
    checksumMismatchRows: checksumReview.summary.checksumMismatchRows,
    unresolvedChecksumMismatches: checksumReview.summary.unresolvedMismatches,
    unrecoverableMigrationRows: unrecoverableRows,
    unresolvedUnrecoverableMigrations: unresolvedUnrecoverableMigrations(
      unrecoverableArtifactSearch,
    ),
    exactMatchLocations: checksumReview.summary.exactMatchLocations,
    externalExactArtifactMatches,
    unrecoverableExactArtifactMatches,
    combinedExactArtifactMatches:
      checksumReview.summary.exactMatchLocations +
      externalExactArtifactMatches +
      unrecoverableExactArtifactMatches,
    decision: args.decision,
    targetScope: args.targetScope,
    approvalReady: status.startsWith('REVIEW_APPROVED'),
    missingRequiredFields: requiredFields.length,
    productionScopeAllowed: false,
    destructiveDbWriteAllowedByThisPlan: false,
  };
}

function buildRequiredOperatorInputs(
  args: Args,
  checksumReview: ChecksumReviewReport,
  externalArtifactPacket: ExternalArtifactPacketReport | null,
  unrecoverableArtifactSearch: UnrecoverableArtifactSearchReport | null,
) {
  const externalExactArtifactMatches = getExternalExactArtifactMatches(
    externalArtifactPacket,
  );
  const unrecoverableExactArtifactMatches =
    getUnrecoverableExactArtifactMatches(unrecoverableArtifactSearch);
  const combinedExactMatches =
    checksumReview.summary.exactMatchLocations +
    externalExactArtifactMatches +
    unrecoverableExactArtifactMatches;
  const unresolvedMismatches = checksumReview.summary.unresolvedMismatches;
  const unresolvedUnrecoverable = unresolvedUnrecoverableMigrations(
    unrecoverableArtifactSearch,
  );
  const baselineSelected = args.decision === 'baseline-resolve-local-only';
  const restoreSelected = args.decision === 'restore-exact-sql';
  return [
    {
      key: 'external-exact-sql-or-baseline-decision',
      requiredWhen: 'checksum mismatch has no local exact SQL match',
      required: unresolvedMismatches > 0,
      provided: combinedExactMatches > 0 || baselineSelected || restoreSelected,
      expected:
        'exact SQL artifact match, restore-exact-sql decision, or baseline-resolve-local-only decision',
      actual:
        combinedExactMatches > 0
          ? [
              checksumReview.summary.exactMatchLocations > 0
                ? 'checksum-review'
                : null,
              externalExactArtifactMatches > 0
                ? 'external-artifact-packet'
                : null,
              unrecoverableExactArtifactMatches > 0
                ? 'unrecoverable-artifact-search'
                : null,
            ]
              .filter(Boolean)
              .join('+')
          : args.decision,
    },
    {
      key: 'unrecoverable-migration-external-artifact-or-baseline-decision',
      requiredWhen:
        'DB-applied migration is missing from repo and unrecoverable from local git history',
      required: unresolvedUnrecoverable > 0,
      provided:
        unrecoverableExactArtifactMatches > 0 ||
        baselineSelected ||
        restoreSelected,
      expected:
        'exact SQL artifact for unrecoverable migration, restore-exact-sql decision, or baseline-resolve-local-only decision',
      actual:
        unrecoverableExactArtifactMatches > 0
          ? 'unrecoverable-artifact-search'
          : args.decision,
    },
    {
      key: 'target-scope',
      requiredWhen: 'baseline-resolve-local-only',
      required: baselineSelected,
      provided:
        Boolean(args.targetScope) &&
        SUPPORTED_BASELINE_SCOPES.has(args.targetScope ?? ''),
      expected: Array.from(SUPPORTED_BASELINE_SCOPES).join('|'),
      actual: args.targetScope,
    },
    {
      key: 'approved-operator-workflow',
      requiredWhen: 'baseline-resolve-local-only or restore-exact-sql',
      required: baselineSelected || restoreSelected,
      provided: Boolean(args.approvedWorkflow),
      expected: 'approved workflow id',
      actual: args.approvedWorkflow,
    },
    {
      key: 'operator-ack',
      requiredWhen: 'baseline-resolve-local-only or restore-exact-sql',
      required: baselineSelected || restoreSelected,
      provided: args.operatorAck === REQUIRED_ACK,
      expected: REQUIRED_ACK,
      actual: args.operatorAck,
    },
    {
      key: 'rationale',
      requiredWhen: 'baseline-resolve-local-only or restore-exact-sql',
      required: baselineSelected || restoreSelected,
      provided: Boolean(args.rationale),
      expected: 'operator rationale',
      actual: args.rationale ? 'provided' : null,
    },
    {
      key: 'backup-evidence',
      requiredWhen: 'baseline-resolve-local-only',
      required: baselineSelected,
      provided: Boolean(args.backupEvidence),
      expected: 'backup, disposable DB, or staging clone evidence',
      actual: args.backupEvidence ? 'provided' : null,
    },
  ];
}

function buildOperatorGuardrails() {
  return {
    mode: 'read-only',
    productionScopeAllowed: false,
    supportedBaselineScopes: Array.from(SUPPORTED_BASELINE_SCOPES),
    requiredAck: REQUIRED_ACK,
    destructiveDbWriteAllowedByThisPlan: false,
    writeCommandsIntentionallyOmitted: [
      'prisma migrate resolve',
      'prisma migrate deploy',
      'prisma db push',
      'SQL restore',
      'migration-directory writes',
    ],
    evidenceMustRemainAttached: [
      'schema compatibility worklist',
      'migration reconciliation',
      'checksum review',
      'local artifact search',
      'external artifact packet',
      'baseline resolution artifact',
    ],
  };
}

function buildRiskAssessment(
  status: ResolutionStatus,
  args: Args,
  checksumReview: ChecksumReviewReport,
  externalArtifactPacket: ExternalArtifactPacketReport | null,
  unrecoverableArtifactSearch: UnrecoverableArtifactSearchReport | null,
) {
  const externalExactArtifactMatches = getExternalExactArtifactMatches(
    externalArtifactPacket,
  );
  const unrecoverableExactArtifactMatches =
    getUnrecoverableExactArtifactMatches(unrecoverableArtifactSearch);
  return {
    unresolvedChecksumMismatches: checksumReview.summary.unresolvedMismatches,
    unresolvedUnrecoverableMigrations: unresolvedUnrecoverableMigrations(
      unrecoverableArtifactSearch,
    ),
    exactMatchLocations: checksumReview.summary.exactMatchLocations,
    externalExactArtifactMatches,
    unrecoverableExactArtifactMatches,
    combinedExactArtifactMatches:
      checksumReview.summary.exactMatchLocations +
      externalExactArtifactMatches +
      unrecoverableExactArtifactMatches,
    decisionIsApproved: status.startsWith('REVIEW_APPROVED'),
    productionScopeAllowed: false,
    destructiveDbWriteAllowedByThisPlan: false,
    notes:
      status === 'REVIEW_APPROVED_BASELINE_RESOLUTION'
        ? [
            'This is only an approval artifact. It does not run prisma migrate resolve, migrate deploy, or any DB write.',
            `Approved target scope: ${args.targetScope}.`,
          ]
        : [
            'Do not run prisma migrate resolve, migrate deploy, or db push against valuable data while this blocker remains unresolved.',
          ],
  };
}

function buildRecommendedNextStep(
  status: ResolutionStatus,
  args: Args,
  checksumReview: ChecksumReviewReport,
  externalArtifactPacket: ExternalArtifactPacketReport | null,
  unrecoverableArtifactSearch: UnrecoverableArtifactSearchReport | null,
) {
  const baseEvidenceArgs = buildEvidenceArgTemplate(args);
  if (status === 'PASS_NO_MISMATCH') {
    return {
      id: 'rerun-schema-compatibility',
      action: 'rerun DB schema compatibility and platform closure audit',
    };
  }
  if (status === 'REVIEW_APPROVED_BASELINE_RESOLUTION') {
    return {
      id: 'operator-review-baseline-resolution',
      action:
        'review this artifact, then run any Prisma resolve/deploy step outside the audit script on the approved target only',
      targetScope: args.targetScope,
    };
  }
  if (status === 'REVIEW_APPROVED_EXACT_SQL_RESTORE') {
    return {
      id: 'operator-review-exact-sql-restore',
      action:
        'restore the exact SQL migration through the approved migration-history workflow, then rerun reconciliation',
    };
  }
  if (
    combinedExactArtifactMatches(
      checksumReview,
      externalArtifactPacket,
      unrecoverableArtifactSearch,
    ) > 0
  ) {
    return {
      id: 'approve-exact-sql-restore-review',
      action:
        'rerun with --decision restore-exact-sql plus workflow, acknowledgement, and rationale',
      auditOnlyCommandTemplate: `pnpm --filter api audit:database-migration-baseline-resolution -- ${baseEvidenceArgs} --decision restore-exact-sql --approved-operator-workflow <id> --operator-ack ${REQUIRED_ACK} --rationale <text>`,
    };
  }
  return {
    id: 'external-artifact-or-baseline-approval',
    action:
      'continue external exact SQL recovery or obtain explicit non-production baseline approval',
    auditOnlyCommandTemplate: `pnpm --filter api audit:database-migration-baseline-resolution -- ${baseEvidenceArgs} --decision baseline-resolve-local-only --target-scope <local-existing|local-disposable|staging-clone> --approved-operator-workflow <id> --operator-ack ${REQUIRED_ACK} --rationale <text> --backup-evidence <text>`,
  };
}

function buildEvidenceArgTemplate(args: Args) {
  return [
    `--checksum-review ${path.relative(API_ROOT, args.checksumReview)}`,
    args.externalArtifactPacket
      ? `--external-artifact-packet ${path.relative(API_ROOT, args.externalArtifactPacket)}`
      : null,
    args.unrecoverableArtifactSearch
      ? `--unrecoverable-artifact-search ${path.relative(API_ROOT, args.unrecoverableArtifactSearch)}`
      : null,
  ]
    .filter(Boolean)
    .join(' ');
}

function combinedExactArtifactMatches(
  checksumReview: ChecksumReviewReport,
  externalArtifactPacket: ExternalArtifactPacketReport | null,
  unrecoverableArtifactSearch?: UnrecoverableArtifactSearchReport | null,
) {
  return (
    checksumReview.summary.exactMatchLocations +
    getExternalExactArtifactMatches(externalArtifactPacket) +
    getUnrecoverableExactArtifactMatches(unrecoverableArtifactSearch ?? null)
  );
}

function getExternalExactArtifactMatches(
  externalArtifactPacket: ExternalArtifactPacketReport | null,
) {
  const count = externalArtifactPacket?.summary?.exactArtifactMatches;
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

function getUnrecoverableRows(
  unrecoverableArtifactSearch: UnrecoverableArtifactSearchReport | null,
) {
  const count = unrecoverableArtifactSearch?.summary?.unrecoverableRows;
  return typeof count === 'number' && Number.isFinite(count)
    ? count
    : (unrecoverableArtifactSearch?.rows?.length ?? 0);
}

function getUnrecoverableExactArtifactMatches(
  unrecoverableArtifactSearch: UnrecoverableArtifactSearchReport | null,
) {
  const count = unrecoverableArtifactSearch?.summary?.exactArtifactMatches;
  if (typeof count === 'number' && Number.isFinite(count)) return count;
  return (
    unrecoverableArtifactSearch?.rows?.reduce(
      (sum, row) => sum + (row.artifactSearch?.exactMatches?.length ?? 0),
      0,
    ) ?? 0
  );
}

function unresolvedUnrecoverableMigrations(
  unrecoverableArtifactSearch: UnrecoverableArtifactSearchReport | null,
) {
  return Math.max(
    0,
    getUnrecoverableRows(unrecoverableArtifactSearch) -
      getUnrecoverableExactArtifactMatches(unrecoverableArtifactSearch),
  );
}

function buildRecommendedSequence(status: ResolutionStatus) {
  if (status === 'PASS_NO_MISMATCH') {
    return ['Rerun schema compatibility and schema alignment planning.'];
  }
  if (status === 'REVIEW_APPROVED_BASELINE_RESOLUTION') {
    return [
      'Use this artifact as review evidence for the chosen local/staging baseline resolve path.',
      'Run any Prisma resolve/deploy step only outside this script, on the approved target, after backup/clone confirmation.',
      'Rerun schema compatibility, migration reconciliation, checksum review, and schema alignment planning.',
    ];
  }
  if (status === 'REVIEW_APPROVED_EXACT_SQL_RESTORE') {
    return [
      'Restore the exact SQL migration file through an approved migration-history workflow.',
      'Rerun migration reconciliation and checksum review.',
      'Continue to schema alignment planning only after mismatch clears.',
    ];
  }
  return [
    'Continue external artifact/backup lookup for the exact applied SQL, or choose an explicit baseline resolve path.',
    `For baseline resolve, rerun with --decision baseline-resolve-local-only --target-scope <${Array.from(SUPPORTED_BASELINE_SCOPES).join('|')}> --approved-operator-workflow <id> --operator-ack ${REQUIRED_ACK} --rationale <text> --backup-evidence <text>.`,
    'Do not apply schema migrations to valuable data until this decision artifact is approved.',
  ];
}

function buildNextCampaign(status: ResolutionStatus) {
  if (status.startsWith('REVIEW_APPROVED') || status === 'PASS_NO_MISMATCH') {
    return {
      id: 'database_schema_compatibility',
      reason:
        'Resolution artifact exists; rerun schema compatibility and continue the controlled migration alignment path.',
    };
  }
  return {
    id: 'database_migration_baseline_resolution',
    reason:
      'Migration history still needs exact SQL recovery or explicit baseline/resolve approval.',
  };
}

function normalizeDecision(
  decision: ResolutionDecision,
): NormalizedResolutionDecision {
  if (decision === 'baseline-resolve-local-db') {
    return 'baseline-resolve-local-only';
  }
  return decision;
}

function renderMarkdown(report: {
  generatedAt: string;
  status: ResolutionStatus;
  summary: Record<string, unknown>;
  decision: NormalizedResolutionDecision;
  targetScope: string | null;
  requiredAck: string;
  requiredFields: string[];
  requiredOperatorInputs: Array<{
    key: string;
    required: boolean;
    provided: boolean;
    expected: string;
    actual: string | null;
  }>;
  operatorGuardrails: ReturnType<typeof buildOperatorGuardrails>;
  recommendedNextStep: Record<string, unknown>;
  unresolvedMismatches: Array<{
    migration: string;
    dbChecksum: string | null;
    selectedRecoveredSqlSha256: string | null;
  }>;
  recommendedSequence: string[];
}) {
  const lines = [
    '# Database Migration Baseline Resolution',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Decision: ${report.decision}`,
    `Target scope: ${report.targetScope ?? 'none'}`,
    `Required ack: ${report.requiredAck}`,
    '',
    '## Summary',
    '',
    `- Checksum review: ${String(report.summary.checksumReviewStatus ?? 'unknown')}`,
    `- External artifact packet: ${String(report.summary.externalArtifactPacketStatus ?? 'not provided')}`,
    `- Unrecoverable artifact search: ${String(report.summary.unrecoverableArtifactSearchStatus ?? 'not provided')}`,
    `- Mismatches/unresolved/checksum-review exact/external exact/combined exact: ${String(report.summary.checksumMismatchRows ?? 0)}/${String(report.summary.unresolvedChecksumMismatches ?? 0)}/${String(report.summary.exactMatchLocations ?? 0)}/${String(report.summary.externalExactArtifactMatches ?? 0)}/${String(report.summary.combinedExactArtifactMatches ?? 0)}`,
    `- Unrecoverable migration rows/unresolved/exact matches: ${String(report.summary.unrecoverableMigrationRows ?? 0)}/${String(report.summary.unresolvedUnrecoverableMigrations ?? 0)}/${String(report.summary.unrecoverableExactArtifactMatches ?? 0)}`,
    `- Approval ready: ${String(report.summary.approvalReady ?? false)}`,
    `- Missing required fields: ${String(report.summary.missingRequiredFields ?? 0)}`,
    `- DB writes allowed by this artifact: ${String(report.summary.destructiveDbWriteAllowedByThisPlan ?? false)}`,
    '',
    '## Required Fields',
    '',
    ...(report.requiredFields.length
      ? report.requiredFields.map((field) => `- ${field}`)
      : ['- none']),
    '',
    '## Operator Inputs',
    '',
    ...report.requiredOperatorInputs.map((input) =>
      [
        `- ${input.key}`,
        `  - required: ${input.required}`,
        `  - provided: ${input.provided}`,
        `  - expected: ${input.expected}`,
        `  - actual: ${input.actual ?? 'none'}`,
      ].join('\n'),
    ),
    '',
    '## Guardrails',
    '',
    `- Mode: ${report.operatorGuardrails.mode}`,
    `- Production scope allowed: ${report.operatorGuardrails.productionScopeAllowed}`,
    `- Destructive DB write allowed by this artifact: ${report.operatorGuardrails.destructiveDbWriteAllowedByThisPlan}`,
    `- Supported baseline scopes: ${report.operatorGuardrails.supportedBaselineScopes.join(', ')}`,
    `- Omitted write commands: ${report.operatorGuardrails.writeCommandsIntentionallyOmitted.join(', ')}`,
    '',
    '## Unresolved Mismatches',
    '',
    ...report.unresolvedMismatches.map((row) =>
      [
        `- ${row.migration}`,
        `  - DB checksum: ${row.dbChecksum}`,
        `  - recovered SQL SHA-256: ${row.selectedRecoveredSqlSha256}`,
      ].join('\n'),
    ),
    '',
    '## Recommended Sequence',
    '',
    ...report.recommendedSequence.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Recommended Next Step',
    '',
    `- ${String(report.recommendedNextStep.id ?? 'unknown')}: ${String(report.recommendedNextStep.action ?? 'continue review')}`,
    ...(report.recommendedNextStep.auditOnlyCommandTemplate
      ? [
          `- Audit-only command: ${String(report.recommendedNextStep.auditOnlyCommandTemplate)}`,
        ]
      : []),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function printSummary(
  out: string,
  markdown: string,
  report: {
    status: ResolutionStatus;
    decision: NormalizedResolutionDecision;
    requiredFields: string[];
  },
) {
  console.log(
    [
      `Database migration baseline resolution status: ${report.status}`,
      `Decision: ${report.decision}`,
      `Required fields: ${report.requiredFields.length}`,
      `JSON: ${out}`,
      `Markdown: ${markdown}`,
    ].join('\n'),
  );
}

main();
