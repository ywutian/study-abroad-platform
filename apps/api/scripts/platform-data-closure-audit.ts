#!/usr/bin/env tsx
import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  FULL_FIELD_AUDIT_SPECS,
  OPEN_DATA_STATUSES,
  TERMINAL_DATA_STATUSES,
  type FullFieldAuditSpec,
} from './lib/field-source-matrix';

type MetricStatus = 'pass' | 'warn' | 'fail' | 'unknown';
type NextAction =
  | 'accept'
  | 'review'
  | 'refresh'
  | 'backfill'
  | 'mark-terminal'
  | 'block-release';
type AuditBucket =
  | 'trustedUsable'
  | 'missingProvenance'
  | 'stale'
  | 'conflict'
  | 'missingConsumerVerification'
  | 'terminal'
  | 'needsReview';

interface Args {
  out: string;
  noDb: boolean;
  failOnOpen: boolean;
  maxFileBytes: number;
  maxJsonNodes: number;
  applicationYear: number;
  staleDays: number;
  dbTimeoutMs: number;
  schemaWorklist: string | null;
  databaseSchemaDisposition: string | null;
  databaseSchemaOperatorHandoff: string | null;
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
  baselineProposal: string | null;
  schoolConsumerVisibility: string | null;
  schoolConsumerVisibilityDisposition: string | null;
  consumerFactSafety: string | null;
  schoolAnchorDisposition: string | null;
  schoolMediaDisposition: string | null;
  profileReadinessDisposition: string | null;
  profileReadinessConsumerClosure: string | null;
  profileReadinessDeliveryMonitor: string | null;
  profileReadinessTargetDeliveryMonitor: string[];
  profileReadinessCampaignStackMonitor: string | null;
  profileReadinessTimelineSourceClosure: string | null;
  profileReadinessTimelineSourceAction: string | null;
  casesOutcomesDisposition: string | null;
  aiMemoryDisposition: string | null;
  essaySourceRecovery: string | null;
  essaySourceValidation: string | null;
  essaySourceSearchCampaign: string | null;
  essaySourceManualCheck: string[];
  essaySourceFamilyMismatchReview: string[];
  essaySourceReviewStaging: string | null;
  essaySourceReviewApproval: string | null;
  essaySourceWritePlan: string | null;
  essaySourceApprovalMonitor: string | null;
  essayReviewQueue: string | null;
  essayReviewAction: string | null;
  essayPromptDisposition: string | null;
  essayPromptIdentityConflicts: string | null;
  essayPromptIdentityConflictResolution: string | null;
}

interface Metric {
  status: MetricStatus;
  score: number | null;
  summary: string;
}

interface DomainAudit {
  id: string;
  label: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  source: 'db' | 'files' | 'code' | 'mixed';
  counts: Record<string, unknown>;
  categories: Record<AuditBucket, number>;
  coverage: Metric;
  freshness: Metric;
  sourceQuality: Metric;
  provenance: Metric;
  conflicts: Metric;
  consumerClosure: Metric;
  nextAction: NextAction;
  blockers: string[];
  evidence: string[];
}

interface FileInventory {
  root: string;
  exists: boolean;
  totalFiles: number;
  totalBytes: number;
  byExtension: Record<string, number>;
  parsedJsonFiles: number;
  parsedCsvFiles: number;
  parseErrors: Array<{ file: string; error: string }>;
  skippedLargeFiles: Array<{ file: string; sizeBytes: number }>;
  recordCountEstimate: number;
  sourceSignalCount: number;
  evidenceSignalCount: number;
  yearSignalCount: number;
  qualitySignalCount: number;
  statusCounts: Record<string, number>;
  domainHints: Record<string, number>;
  sampleFiles: Array<{
    file: string;
    sizeBytes: number;
    kind: string;
    recordCountEstimate?: number;
    keys?: string[];
  }>;
}

interface DbAuditResult {
  available: boolean;
  error?: string;
  domains: DomainAudit[];
}

interface ReadinessDeliveryEvidence {
  reportFound: boolean;
  reportName: string | null;
  rows: number;
  blockedRows: number;
  includesUserIds: boolean | null;
  endpointExists: boolean;
  serviceExists: boolean;
  sharedRouteExists: boolean;
  userReadinessEndpointExists: boolean;
  schoolListAddFirstConsumerAligned: boolean;
}

interface LiveDeliveryGateEvidence {
  reportFound: boolean;
  reportName: string | null;
  status: string | null;
  blockedChannels: string[];
  blockers: string[];
  includesUserIds: boolean | null;
  hasNotificationPreferenceModel: boolean | null;
  hasNotificationPreferenceFields: boolean | null;
  hasNotificationPreferenceApi: boolean | null;
  hasReadinessLiveChannelConsentJoin: boolean | null;
}

interface ClosureArtifactSummary {
  kind: string;
  reportFound: boolean;
  path: string | null;
  generatedAt: string | null;
  status: string | null;
  summary: unknown;
  nextCampaign: unknown;
  rows: number | null;
  error: string | null;
}

interface DatabaseRecoveryEvidence {
  schemaWorklist: ClosureArtifactSummary;
  schemaDisposition: ClosureArtifactSummary;
  schemaOperatorHandoff: ClosureArtifactSummary;
  migrationReconciliation: ClosureArtifactSummary;
  restoreCandidateBundle: ClosureArtifactSummary;
  checksumReview: ClosureArtifactSummary;
  checksumVariantAnalysis: ClosureArtifactSummary;
  unrecoverableArtifactSearch: ClosureArtifactSummary;
  localArtifactSearch: ClosureArtifactSummary;
  externalArtifactPacket: ClosureArtifactSummary;
  baselineResolution: ClosureArtifactSummary;
  baselineScopePreflight: ClosureArtifactSummary;
  backupEvidencePacket: ClosureArtifactSummary;
  baselineApprovalRequest: ClosureArtifactSummary;
  baselineProposal: ClosureArtifactSummary;
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const FILE_ROOTS = [
  path.join(API_ROOT, 'scripts', 'data'),
  path.join(API_ROOT, 'scripts', 'cds-data'),
  path.join(API_ROOT, 'scripts', 'closure-reports'),
];
const METHOD_DOCS = [
  'docs/PLATFORM_DATA_FIELD_MATRIX.md',
  'docs/PLATFORM_DATA_INTELLIGENCE_EXECUTION_PLAN.md',
  'docs/SCHOOL_DATA_COLLECTION_SOP.md',
  'docs/PREDICTION_ACCURACY_STRATEGY.md',
  'docs/PREDICTION_CLOSED_LOOP_SOP.md',
  'docs/APPLICATION_ANALYSIS_WORKFLOW_SOP.md',
  'docs/DATA_SOURCES.md',
  'docs/QA_RELEASE_GATE_SOP.md',
  'docs/adr/0017-school-data-provenance.md',
  'docs/adr/0020-prediction-no-sample-calibration.md',
];
const US_COUNTRIES = ['US', 'United States', 'United States of America'];
const DAY_MS = 24 * 60 * 60 * 1000;
const DATABASE_RECOVERY_BLOCKING_STATUSES = new Set([
  'BLOCKED',
  'BLOCKED_SCHEMA_WORKLIST_MISSING',
  'BLOCKED_UNMAPPED_DATABASE_SCHEMA_ROWS',
  'BLOCKED_DIVERGENT_MIGRATION_HISTORY',
  'BLOCKED_SCHEMA_DRIFT_WITHOUT_REPO_MIGRATION',
  'BLOCKED_UNRECOVERABLE_MIGRATION_HISTORY',
  'STAGED_RESTORE_CANDIDATES_WITH_BLOCKERS',
  'BLOCKED_EXACT_SQL_NOT_FOUND',
  'BLOCKED_NO_VARIANT_MATCH',
  'BLOCKED_RECONCILIATION_MISSING',
  'BLOCKED_EXTERNAL_ARTIFACT_REQUIRED',
  'BLOCKED_DECISION_REQUIRED',
  'BLOCKED_DATABASE_UNAVAILABLE',
  'BLOCKED_REMOTE_OR_PRODUCTION_LIKE_TARGET',
  'BLOCKED_UNSUPPORTED_TARGET_SCOPE',
  'BLOCKED_SCOPE_PREFLIGHT_REQUIRED',
  'BLOCKED_BACKUP_EVIDENCE_REQUIRED',
  'BLOCKED_EVIDENCE_PATH_MISSING',
  'BLOCKED_APPROVAL_REQUEST_INPUTS_MISSING',
  'BLOCKED_BACKUP_EVIDENCE_NOT_READY',
  'BLOCKED_UNEXPECTED_APPROVAL_STATE',
  'BLOCKED_INSUFFICIENT_EVIDENCE',
  'BASELINE_PROPOSAL_READY_REVIEW_REQUIRED',
]);
const REVIEW_ONLY_LIVE_DELIVERY_BLOCKERS = new Set([
  'channel_disabled_by_policy',
  'recipient_user_ids_redacted',
]);

const emptyBuckets = (): Record<AuditBucket, number> => ({
  trustedUsable: 0,
  missingProvenance: 0,
  stale: 0,
  conflict: 0,
  missingConsumerVerification: 0,
  terminal: 0,
  needsReview: 0,
});

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
  const has = (name: string) => argv.includes(name);
  const optionalPath = (name: string) => {
    const value = get(name);
    return value ? path.resolve(API_ROOT, value) : null;
  };
  const optionalPathList = (name: string) =>
    values(name).map((value) => path.resolve(API_ROOT, value));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    out: path.resolve(
      API_ROOT,
      get(
        '--out',
        path.join(REPORT_ROOT, `platform-data-closure-audit-${stamp}.json`),
      )!,
    ),
    noDb: has('--no-db'),
    failOnOpen: has('--fail-on-open'),
    maxFileBytes: Number(get('--max-file-bytes', `${12 * 1024 * 1024}`)),
    maxJsonNodes: Number(get('--max-json-nodes', '25000')),
    applicationYear: Number(
      get('--application-year', `${new Date().getFullYear()}`),
    ),
    staleDays: Number(get('--stale-days', '365')),
    dbTimeoutMs: Number(get('--db-timeout-ms', '15000')),
    schemaWorklist: optionalPath('--schema-worklist'),
    databaseSchemaDisposition: optionalPath('--database-schema-disposition'),
    databaseSchemaOperatorHandoff: optionalPath(
      '--database-schema-operator-handoff',
    ),
    migrationReconciliation: optionalPath('--migration-reconciliation'),
    restoreCandidateBundle: optionalPath('--restore-candidate-bundle'),
    checksumReview: optionalPath('--checksum-review'),
    checksumVariantAnalysis: optionalPath('--checksum-variant-analysis'),
    unrecoverableArtifactSearch: optionalPath(
      '--unrecoverable-artifact-search',
    ),
    localArtifactSearch: optionalPath('--local-artifact-search'),
    externalArtifactPacket: optionalPath('--external-artifact-packet'),
    baselineResolution: optionalPath('--baseline-resolution'),
    baselineScopePreflight: optionalPath('--baseline-scope-preflight'),
    backupEvidencePacket: optionalPath('--backup-evidence-packet'),
    baselineApprovalRequest: optionalPath('--baseline-approval-request'),
    baselineProposal: optionalPath('--baseline-proposal'),
    schoolConsumerVisibility: optionalPath('--school-consumer-visibility'),
    schoolConsumerVisibilityDisposition: optionalPath(
      '--school-consumer-visibility-disposition',
    ),
    consumerFactSafety: optionalPath('--consumer-fact-safety'),
    schoolAnchorDisposition: optionalPath('--school-anchor-disposition'),
    schoolMediaDisposition: optionalPath('--school-media-disposition'),
    profileReadinessDisposition: optionalPath(
      '--profile-readiness-disposition',
    ),
    profileReadinessConsumerClosure: optionalPath(
      '--profile-readiness-consumer-closure',
    ),
    profileReadinessDeliveryMonitor: optionalPath(
      '--profile-readiness-delivery-monitor',
    ),
    profileReadinessTargetDeliveryMonitor: optionalPathList(
      '--profile-readiness-target-delivery-monitor',
    ),
    profileReadinessCampaignStackMonitor: optionalPath(
      '--profile-readiness-campaign-stack-monitor',
    ),
    profileReadinessTimelineSourceClosure: optionalPath(
      '--profile-readiness-timeline-source-closure',
    ),
    profileReadinessTimelineSourceAction: optionalPath(
      '--profile-readiness-timeline-source-action',
    ),
    casesOutcomesDisposition: optionalPath('--cases-outcomes-disposition'),
    aiMemoryDisposition: optionalPath('--ai-memory-disposition'),
    essaySourceRecovery: optionalPath('--essay-source-recovery'),
    essaySourceValidation: optionalPath('--essay-source-validation'),
    essaySourceSearchCampaign: optionalPath('--essay-source-search-campaign'),
    essaySourceManualCheck: optionalPathList('--essay-source-manual-check'),
    essaySourceFamilyMismatchReview: optionalPathList(
      '--essay-source-family-mismatch-review',
    ),
    essaySourceReviewStaging: optionalPath('--essay-source-review-staging'),
    essaySourceReviewApproval: optionalPath('--essay-source-review-approval'),
    essaySourceWritePlan: optionalPath('--essay-source-write-plan'),
    essaySourceApprovalMonitor: optionalPath('--essay-source-approval-monitor'),
    essayReviewQueue: optionalPath('--essay-review-queue'),
    essayReviewAction: optionalPath('--essay-review-action'),
    essayPromptDisposition: optionalPath('--essay-prompt-disposition'),
    essayPromptIdentityConflicts: optionalPath(
      '--essay-prompt-identity-conflicts',
    ),
    essayPromptIdentityConflictResolution: optionalPath(
      '--essay-prompt-identity-conflict-resolution',
    ),
  };
}

async function main() {
  const args = parseArgs();
  const fileInventories = FILE_ROOTS.map((root) => auditFileRoot(root, args));
  const docs = METHOD_DOCS.map((docPath) => ({
    path: docPath,
    exists: fs.existsSync(path.resolve(path.dirname(API_ROOT), '..', docPath)),
  }));

  const dbAudit = args.noDb
    ? ({
        available: false,
        error: 'Skipped by --no-db',
        domains: [],
      } satisfies DbAuditResult)
    : await withTimeout(auditDb(args), args.dbTimeoutMs).catch((error) => ({
        available: false,
        error: error instanceof Error ? error.message : String(error),
        domains: [],
      }));

  const fileDomains = buildFileDomains(fileInventories);
  const databaseBlockerDomains =
    !args.noDb && !dbAudit.available
      ? [buildDatabaseAvailabilityDomain(dbAudit.error, args)]
      : [];
  const dbDerivedDomainIds = new Set(
    [...databaseBlockerDomains, ...dbAudit.domains].map((domain) => domain.id),
  );
  const staticArtifactDomains = buildStaticArtifactDomains(args).filter(
    (domain) => !dbDerivedDomainIds.has(domain.id),
  );
  const domains = [
    ...databaseBlockerDomains,
    ...dbAudit.domains,
    ...staticArtifactDomains,
    ...fileDomains,
  ];
  const topCampaigns = rankCampaigns(domains);
  const bucketTotals = domains.reduce((totals, domain) => {
    for (const [bucket, count] of Object.entries(domain.categories)) {
      totals[bucket as AuditBucket] += count;
    }
    return totals;
  }, emptyBuckets());
  const blockers = domains.flatMap((domain) =>
    domain.blockers.map((blocker) => ({
      domain: domain.id,
      priority: domain.priority,
      blocker,
    })),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only',
    applicationYear: args.applicationYear,
    staleDays: args.staleDays,
    inputs: {
      database: {
        attempted: !args.noDb,
        available: dbAudit.available,
        error: dbAudit.error ?? null,
      },
      fileRoots: fileInventories.map((root) => ({
        root: path.relative(API_ROOT, root.root),
        exists: root.exists,
        totalFiles: root.totalFiles,
        totalBytes: root.totalBytes,
      })),
      methodDocs: docs,
    },
    gate: {
      pass:
        blockers.length === 0 &&
        bucketTotals.conflict === 0 &&
        bucketTotals.needsReview === 0 &&
        bucketTotals.missingProvenance === 0,
      status:
        blockers.length > 0 || bucketTotals.conflict > 0
          ? 'OPEN'
          : bucketTotals.needsReview > 0 || bucketTotals.missingProvenance > 0
            ? 'REVIEW'
            : 'PASS',
      blockerCount: blockers.length,
      blockers,
    },
    bucketTotals,
    domains,
    fileInventories,
    topCampaigns,
    codexReview: buildCodexReview(domains, topCampaigns, dbAudit.available),
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  printSummary(args.out, domains, topCampaigns, report.gate.status);
  if (args.failOnOpen && report.gate.status === 'OPEN') process.exitCode = 2;
}

async function auditDb(args: Args): Promise<DbAuditResult> {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    try {
      const domains = await buildDbDomains(prisma, args);
      return { available: true, domains };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      const message = summarizePrismaAuditError(rawMessage);
      return {
        available: true,
        error: message,
        domains: [
          buildDatabaseSchemaCompatibilityDomain(message, rawMessage, args),
        ],
      };
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

function summarizePrismaAuditError(error: string) {
  const missingTable = error.match(/The table `([^`]+)` does not exist/);
  if (missingTable) {
    return `Current database is missing table ${missingTable[1]} required by the current Prisma schema`;
  }
  const missingColumn = error.match(/The column `([^`]+)` does not exist/);
  if (missingColumn) {
    return `Current database is missing column ${missingColumn[1]} required by the current Prisma schema`;
  }
  const lines = error
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? error;
}

function buildDatabaseAvailabilityDomain(
  error: string | undefined,
  args: Args,
): DomainAudit {
  const categories = emptyBuckets();
  categories.missingConsumerVerification = 1;
  categories.needsReview = 1;
  const summary = error
    ? `Prisma database audit failed: ${error}`
    : 'Prisma database audit failed without an error message';
  const recoveryEvidence = auditDatabaseRecoveryEvidence(args);
  return {
    id: 'database_audit_availability',
    label: 'Prisma DB availability for platform data closure',
    priority: 'P0',
    source: 'db',
    counts: {
      attempted: true,
      available: false,
      error: error ?? null,
      recoveryEvidence,
    },
    categories,
    coverage: failMetric(summary),
    freshness: unknownMetric('DB-backed freshness gates could not run'),
    sourceQuality: unknownMetric(
      'DB-backed source-quality gates could not run',
    ),
    provenance: failMetric(
      'DB-backed provenance checks could not run for school, essay, deadline, profile, case, memory, operations, security, or governance domains',
    ),
    conflicts: unknownMetric('DB/file conflict checks could not run'),
    consumerClosure: failMetric(
      'DB-backed consumer closure cannot be verified while Prisma is unavailable',
    ),
    nextAction: 'block-release',
    blockers: [summary],
    evidence: [
      'DATABASE_URL',
      'PrismaClient.$connect',
      'platform-data-closure-audit',
      ...formatDatabaseRecoveryEvidence(recoveryEvidence),
    ],
  };
}

function buildDatabaseSchemaCompatibilityDomain(
  error: string,
  rawError?: string,
  args?: Args,
): DomainAudit {
  const categories = emptyBuckets();
  categories.conflict = 1;
  categories.missingConsumerVerification = 1;
  categories.needsReview = 1;
  const recoveryEvidence = args ? auditDatabaseRecoveryEvidence(args) : null;
  const recoveryBlockers = buildDatabaseRecoveryBlockers(recoveryEvidence);
  return {
    id: 'database_schema_compatibility',
    label: 'Prisma DB schema compatibility for platform data closure',
    priority: 'P0',
    source: 'db',
    counts: {
      connected: true,
      schemaCompatible: false,
      error,
      rawError: rawError ?? null,
      recoveryEvidence,
    },
    categories,
    coverage: failMetric(
      `Prisma database connected but schema audit failed: ${error}`,
    ),
    freshness: unknownMetric(
      'DB-backed freshness gates could not run against the current schema',
    ),
    sourceQuality: unknownMetric(
      'DB-backed source-quality gates could not run against the current schema',
    ),
    provenance: failMetric(
      'DB-backed provenance checks are blocked because the database schema does not match the current Prisma client',
    ),
    conflicts: failMetric(
      'Database schema is incompatible with current code-generated Prisma queries',
    ),
    consumerClosure: failMetric(
      'DB-backed consumer closure cannot be verified until migrations/schema are aligned',
    ),
    nextAction: 'block-release',
    blockers: [
      `Prisma schema compatibility failed: ${error}`,
      ...recoveryBlockers,
    ],
    evidence: [
      'DATABASE_URL',
      'PrismaClient.$connect',
      'Prisma query execution',
      'platform-data-closure-audit',
      ...formatDatabaseRecoveryEvidence(recoveryEvidence),
    ],
  };
}

function auditDatabaseRecoveryEvidence(args: Args): DatabaseRecoveryEvidence {
  return {
    schemaWorklist: readClosureArtifact(
      'database_schema_compatibility_worklist',
      args.schemaWorklist ??
        findLatestClosureReport(
          /^database-schema-compatibility-worklist-.+\.json$/,
        ),
    ),
    schemaDisposition: readClosureArtifact(
      'database_schema_disposition',
      args.databaseSchemaDisposition ??
        findLatestClosureReport(/^database-schema-disposition-.+\.json$/),
    ),
    schemaOperatorHandoff: readClosureArtifact(
      'database_schema_operator_handoff',
      args.databaseSchemaOperatorHandoff ??
        findLatestClosureReport(/^database-schema-operator-handoff-.+\.json$/),
    ),
    migrationReconciliation: readClosureArtifact(
      'database_migration_history_reconciliation',
      args.migrationReconciliation ??
        findLatestClosureReport(
          /^database-migration-history-reconciliation-.+\.json$/,
        ),
    ),
    restoreCandidateBundle: readClosureArtifact(
      'database_migration_restore_candidate_bundle',
      args.restoreCandidateBundle ??
        findLatestClosureReport(
          /^database-migration-restore-candidate-bundle-.+\.json$/,
        ),
    ),
    checksumReview: readClosureArtifact(
      'database_migration_checksum_review',
      args.checksumReview ??
        findLatestClosureReport(
          /^database-migration-checksum-review-.+\.json$/,
        ),
    ),
    checksumVariantAnalysis: readClosureArtifact(
      'database_migration_checksum_variant_analysis',
      args.checksumVariantAnalysis ??
        findLatestClosureReport(
          /^database-migration-checksum-variant-analysis-.+\.json$/,
        ),
    ),
    unrecoverableArtifactSearch: readClosureArtifact(
      'database_migration_unrecoverable_artifact_search',
      args.unrecoverableArtifactSearch ??
        findLatestClosureReport(
          /^database-migration-unrecoverable-artifact-search-.+\.json$/,
        ),
    ),
    localArtifactSearch: readClosureArtifact(
      'database_migration_local_artifact_search',
      args.localArtifactSearch ??
        findLatestClosureReport(
          /^database-migration-local-artifact-search-.+\.json$/,
        ),
    ),
    externalArtifactPacket: readClosureArtifact(
      'database_migration_external_artifact_packet',
      args.externalArtifactPacket ??
        findLatestClosureReport(
          /^database-migration-external-artifact-packet-.+\.json$/,
        ),
    ),
    baselineResolution: readClosureArtifact(
      'database_migration_baseline_resolution',
      args.baselineResolution ??
        findLatestClosureReport(
          /^database-migration-baseline-resolution-.+\.json$/,
        ),
    ),
    baselineScopePreflight: readClosureArtifact(
      'database_migration_baseline_scope_preflight',
      args.baselineScopePreflight ??
        findLatestClosureReport(
          /^database-migration-baseline-scope-preflight-.+\.json$/,
        ),
    ),
    backupEvidencePacket: readClosureArtifact(
      'database_migration_backup_evidence_packet',
      args.backupEvidencePacket ??
        findLatestClosureReport(
          /^database-migration-backup-evidence-packet-.+\.json$/,
        ),
    ),
    baselineApprovalRequest: readClosureArtifact(
      'database_migration_baseline_approval_request',
      args.baselineApprovalRequest ??
        findLatestClosureReport(
          /^database-migration-baseline-approval-request-.+\.json$/,
        ),
    ),
    baselineProposal: readClosureArtifact(
      'database_migration_baseline_proposal',
      args.baselineProposal ??
        findLatestClosureReport(
          /^database-migration-baseline-proposal-.+\.json$/,
        ),
    ),
  };
}

function readClosureArtifact(
  kind: string,
  reportPath: string | null,
): ClosureArtifactSummary {
  if (!reportPath) {
    return {
      kind,
      reportFound: false,
      path: null,
      generatedAt: null,
      status: null,
      summary: null,
      nextCampaign: null,
      rows: null,
      error: null,
    };
  }
  if (!fs.existsSync(reportPath)) {
    return {
      kind,
      reportFound: false,
      path: reportPath,
      generatedAt: null,
      status: null,
      summary: null,
      nextCampaign: null,
      rows: null,
      error: 'Report path does not exist',
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Record<
      string,
      unknown
    >;
    return {
      kind,
      reportFound: true,
      path: path.relative(API_ROOT, reportPath),
      generatedAt:
        typeof parsed.generatedAt === 'string' ? parsed.generatedAt : null,
      status: typeof parsed.status === 'string' ? parsed.status : null,
      summary: parsed.summary ?? null,
      nextCampaign: parsed.nextCampaign ?? null,
      rows: Array.isArray(parsed.rows) ? parsed.rows.length : null,
      error: null,
    };
  } catch (error) {
    return {
      kind,
      reportFound: false,
      path: path.relative(API_ROOT, reportPath),
      generatedAt: null,
      status: null,
      summary: null,
      nextCampaign: null,
      rows: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readClosureArtifacts(
  kind: string,
  reportPaths: string[],
  fallbackPath: string | null,
): ClosureArtifactSummary {
  const paths =
    reportPaths.length > 0 ? reportPaths : fallbackPath ? [fallbackPath] : [];
  if (paths.length === 0) return readClosureArtifact(kind, null);
  const artifacts = paths.map((reportPath) =>
    readClosureArtifact(kind, reportPath),
  );
  if (artifacts.length === 1) return artifacts[0];
  const foundArtifacts = artifacts.filter((artifact) => artifact.reportFound);
  if (foundArtifacts.length === 0) {
    return {
      ...artifacts[0],
      path: paths
        .map((reportPath) => path.relative(API_ROOT, reportPath))
        .join(', '),
      error:
        artifacts
          .map((artifact) => artifact.error)
          .filter(Boolean)
          .join('; ') || null,
    };
  }
  const summaries = foundArtifacts.map((artifact) =>
    objectSummary(artifact.summary),
  );
  return {
    kind,
    reportFound: true,
    path: foundArtifacts
      .map((artifact) => artifact.path)
      .filter(isString)
      .join(', '),
    generatedAt: latestIso(
      foundArtifacts.map((artifact) => artifact.generatedAt).filter(isString),
    ),
    status:
      new Set(foundArtifacts.map((artifact) => artifact.status)).size === 1
        ? foundArtifacts[0].status
        : `MULTI_ARTIFACTS_${foundArtifacts.length}`,
    summary: aggregateSummaries(summaries),
    nextCampaign: foundArtifacts
      .map((artifact) => artifact.nextCampaign)
      .filter(Boolean),
    rows: foundArtifacts.reduce(
      (sum, artifact) => sum + (artifact.rows ?? 0),
      0,
    ),
    error:
      artifacts
        .map((artifact) => artifact.error)
        .filter(Boolean)
        .join('; ') || null,
  };
}

function findLatestClosureReport(pattern: RegExp) {
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

function buildDatabaseRecoveryBlockers(
  evidence: DatabaseRecoveryEvidence | null,
) {
  if (!evidence) return [];
  const blockers: string[] = [];
  const addIfBlocking = (
    key: keyof DatabaseRecoveryEvidence,
    artifact: ClosureArtifactSummary,
    label: string,
    formatter = formatArtifactSummary,
  ) => {
    if (
      !artifact.reportFound ||
      !isDatabaseRecoveryArtifactBlocking(evidence, key, artifact.status)
    ) {
      return;
    }
    blockers.push(
      `${label} status ${artifact.status ?? 'unknown'} (${formatter(artifact.summary)})`,
    );
  };
  addIfBlocking('schemaWorklist', evidence.schemaWorklist, 'Schema worklist');
  addIfBlocking(
    'schemaDisposition',
    evidence.schemaDisposition,
    'Schema disposition',
  );
  addIfBlocking(
    'schemaOperatorHandoff',
    evidence.schemaOperatorHandoff,
    'Schema operator handoff',
  );
  addIfBlocking(
    'migrationReconciliation',
    evidence.migrationReconciliation,
    'Migration reconciliation',
  );
  addIfBlocking(
    'restoreCandidateBundle',
    evidence.restoreCandidateBundle,
    'Restore candidate bundle',
  );
  addIfBlocking('checksumReview', evidence.checksumReview, 'Checksum review');
  addIfBlocking(
    'checksumVariantAnalysis',
    evidence.checksumVariantAnalysis,
    'Checksum variant analysis',
  );
  addIfBlocking(
    'unrecoverableArtifactSearch',
    evidence.unrecoverableArtifactSearch,
    'Unrecoverable artifact search',
  );
  addIfBlocking(
    'localArtifactSearch',
    evidence.localArtifactSearch,
    'Local artifact search',
  );
  addIfBlocking(
    'externalArtifactPacket',
    evidence.externalArtifactPacket,
    'External artifact packet',
  );
  addIfBlocking(
    'baselineResolution',
    evidence.baselineResolution,
    'Baseline resolution',
    formatBaselineResolutionSummary,
  );
  addIfBlocking(
    'baselineScopePreflight',
    evidence.baselineScopePreflight,
    'Baseline scope preflight',
  );
  addIfBlocking(
    'backupEvidencePacket',
    evidence.backupEvidencePacket,
    'Backup evidence packet',
  );
  addIfBlocking(
    'baselineApprovalRequest',
    evidence.baselineApprovalRequest,
    'Baseline approval request',
  );
  addIfBlocking(
    'baselineProposal',
    evidence.baselineProposal,
    'Baseline proposal',
  );
  const nextActionBlocker = formatDatabaseRecoveryNextActionBlocker(evidence);
  if (nextActionBlocker && blockers.length > 0) {
    return [`${nextActionBlocker}; ${blockers[0]}`, ...blockers.slice(1)];
  }
  if (nextActionBlocker) return [nextActionBlocker];
  return blockers;
}

function formatDatabaseRecoveryEvidence(
  evidence: DatabaseRecoveryEvidence | null,
) {
  if (!evidence) return [];
  return [
    ...formatDatabaseRecoveryNextActionEvidence(evidence),
    ...Object.values(evidence)
      .filter((artifact) => artifact.reportFound)
      .map(
        (artifact) =>
          `${artifact.kind}: ${artifact.status ?? 'unknown'} (${artifact.path})`,
      ),
  ];
}

function formatDatabaseRecoveryNextActionBlocker(
  evidence: DatabaseRecoveryEvidence,
) {
  const nextAction = databaseRecoveryNextAction(evidence);
  if (!nextAction) return null;
  const details = [
    nextAction.migration ? `migration=${nextAction.migration}` : null,
    nextAction.candidateStatus
      ? `candidateStatus=${nextAction.candidateStatus}`
      : null,
    nextAction.candidateRoot
      ? `candidateRoot=${nextAction.candidateRoot}`
      : null,
    nextAction.candidateManifestPath
      ? `candidateManifest=${nextAction.candidateManifestPath}`
      : null,
    nextAction.candidateManifestDigestPath
      ? `candidateManifestDigest=${nextAction.candidateManifestDigestPath}`
      : null,
    nextAction.candidateManifestSha256
      ? `candidateManifestSha256=${nextAction.candidateManifestSha256}`
      : null,
    typeof nextAction.candidateFilesPresent === 'number'
      ? `candidateFiles=${nextAction.candidateFilesPresent}`
      : null,
    typeof nextAction.candidateSqlFilesPresent === 'number'
      ? `candidateSqlFiles=${nextAction.candidateSqlFilesPresent}`
      : null,
    typeof nextAction.candidateArchiveFilesPresent === 'number'
      ? `candidateArchiveFiles=${nextAction.candidateArchiveFilesPresent}`
      : null,
    nextAction.candidateRequestMarkdownPath
      ? `candidateRequest=${nextAction.candidateRequestMarkdownPath}`
      : null,
    nextAction.candidateStatusMarkdownPath
      ? `candidateStatusReport=${nextAction.candidateStatusMarkdownPath}`
      : null,
    nextAction.verificationCommand
      ? `verify=${nextAction.verificationCommand}`
      : null,
    nextAction.candidateTargetRows[0]?.targetMigrationPath
      ? `targetPath=${nextAction.candidateTargetRows[0].targetMigrationPath}`
      : null,
    nextAction.candidateTargetRows[0]?.requiredSha256
      ? `requiredSha256=${nextAction.candidateTargetRows[0].requiredSha256}`
      : null,
    nextAction.candidateAcceptedArchiveNames.length > 0
      ? `acceptedArchives=${nextAction.candidateAcceptedArchiveNames.join(', ')}`
      : null,
  ].filter(isString);
  return `Database migration recovery next campaign ${nextAction.id}${details.length ? ` (${details.join('; ')})` : ''}`;
}

function formatDatabaseRecoveryNextActionEvidence(
  evidence: DatabaseRecoveryEvidence,
) {
  const nextAction = databaseRecoveryNextAction(evidence);
  if (!nextAction) return [];
  return [
    `database_schema_operator_handoff_next_campaign:${nextAction.id}`,
    nextAction.migration
      ? `database_schema_operator_handoff_migration:${nextAction.migration}`
      : null,
    nextAction.recommendedAction
      ? `database_schema_operator_handoff_recommended_action:${nextAction.recommendedAction}`
      : null,
    nextAction.candidateStatus
      ? `database_schema_operator_handoff_candidate_status:${nextAction.candidateStatus}`
      : null,
    nextAction.candidateRoot
      ? `database_schema_operator_handoff_candidate_root:${nextAction.candidateRoot}`
      : null,
    nextAction.candidateManifestPath
      ? `database_schema_operator_handoff_candidate_manifest:${nextAction.candidateManifestPath}`
      : null,
    nextAction.candidateManifestDigestPath
      ? `database_schema_operator_handoff_candidate_manifest_digest:${nextAction.candidateManifestDigestPath}`
      : null,
    nextAction.candidateManifestSha256
      ? `database_schema_operator_handoff_candidate_manifest_sha256:${nextAction.candidateManifestSha256}`
      : null,
    typeof nextAction.candidateFilesPresent === 'number'
      ? `database_schema_operator_handoff_candidate_files_present:${nextAction.candidateFilesPresent}`
      : null,
    typeof nextAction.candidateSqlFilesPresent === 'number'
      ? `database_schema_operator_handoff_candidate_sql_files_present:${nextAction.candidateSqlFilesPresent}`
      : null,
    typeof nextAction.candidateArchiveFilesPresent === 'number'
      ? `database_schema_operator_handoff_candidate_archive_files_present:${nextAction.candidateArchiveFilesPresent}`
      : null,
    nextAction.candidateRequestJsonPath
      ? `database_schema_operator_handoff_candidate_request_json:${nextAction.candidateRequestJsonPath}`
      : null,
    nextAction.candidateRequestMarkdownPath
      ? `database_schema_operator_handoff_candidate_request_markdown:${nextAction.candidateRequestMarkdownPath}`
      : null,
    nextAction.candidateStatusJsonPath
      ? `database_schema_operator_handoff_candidate_status_json:${nextAction.candidateStatusJsonPath}`
      : null,
    nextAction.candidateStatusMarkdownPath
      ? `database_schema_operator_handoff_candidate_status_markdown:${nextAction.candidateStatusMarkdownPath}`
      : null,
    nextAction.verificationCommand
      ? `database_schema_operator_handoff_verification_command:${nextAction.verificationCommand}`
      : null,
    nextAction.candidateAcceptedArchiveNames.length > 0
      ? `database_schema_operator_handoff_accepted_archive_names:${nextAction.candidateAcceptedArchiveNames.join('|')}`
      : null,
    nextAction.candidateSearchedRoots.length > 0
      ? `database_schema_operator_handoff_candidate_searched_roots:${nextAction.candidateSearchedRoots.join('|')}`
      : null,
    nextAction.candidateVerificationChecklist.length > 0
      ? `database_schema_operator_handoff_candidate_verification_checklist:${nextAction.candidateVerificationChecklist.join('|')}`
      : null,
    nextAction.candidateTargetRows.length > 0
      ? `database_schema_operator_handoff_candidate_target_paths:${nextAction.candidateTargetRows
          .map((row) => row.targetMigrationPath)
          .filter(isString)
          .join('|')}`
      : null,
    nextAction.candidateTargetRows.length > 0
      ? `database_schema_operator_handoff_candidate_required_sha256:${nextAction.candidateTargetRows
          .map((row) => row.requiredSha256)
          .filter(isString)
          .join('|')}`
      : null,
  ].filter(isString);
}

function databaseRecoveryNextAction(evidence: DatabaseRecoveryEvidence) {
  const handoffSummary = objectSummary(evidence.schemaOperatorHandoff.summary);
  const baselineProposalSummary = objectSummary(
    evidence.baselineProposal.summary,
  );
  const handoffNextCampaign = objectSummary(
    evidence.schemaOperatorHandoff.nextCampaign,
  );
  const baselineProposalNextCampaign = objectSummary(
    evidence.baselineProposal.nextCampaign,
  );
  const externalPacketNextCampaign = objectSummary(
    evidence.externalArtifactPacket.nextCampaign,
  );
  const handoffAcceptedArchiveNames = summaryStringList(
    handoffSummary,
    'externalCandidateAcceptedArchiveNames',
  );
  const baselineAcceptedArchiveNames = summaryStringList(
    baselineProposalSummary,
    'externalCandidateAcceptedArchiveNames',
  );
  const handoffSearchedRoots = summaryStringList(
    handoffSummary,
    'externalCandidateSearchedRoots',
  );
  const baselineSearchedRoots = summaryStringList(
    baselineProposalSummary,
    'externalCandidateSearchedRoots',
  );
  const candidateManifestPath =
    stringSummary(handoffSummary, 'externalCandidateManifestPath') ??
    stringSummary(baselineProposalSummary, 'externalCandidateManifestPath') ??
    stringSummary(handoffNextCampaign, 'candidateManifestPath') ??
    stringSummary(baselineProposalNextCampaign, 'manifestPath');
  const candidateManifestDigestPath =
    stringSummary(handoffSummary, 'externalCandidateManifestDigestPath') ??
    stringSummary(
      baselineProposalSummary,
      'externalCandidateManifestDigestPath',
    ) ??
    stringSummary(handoffNextCampaign, 'candidateManifestDigestPath') ??
    stringSummary(baselineProposalNextCampaign, 'manifestDigestPath');
  const candidateManifestSha256 =
    stringSummary(handoffSummary, 'externalCandidateManifestSha256') ??
    stringSummary(baselineProposalSummary, 'externalCandidateManifestSha256') ??
    stringSummary(handoffNextCampaign, 'candidateManifestSha256') ??
    stringSummary(baselineProposalNextCampaign, 'manifestSha256');
  const candidateFilesPresent =
    optionalNumberSummary(handoffSummary, 'externalCandidateFilesPresent') ??
    optionalNumberSummary(
      baselineProposalSummary,
      'externalCandidateFilesPresent',
    ) ??
    optionalNumberSummary(handoffNextCampaign, 'candidateFilesPresent') ??
    optionalNumberSummary(
      baselineProposalNextCampaign,
      'candidateFilesPresent',
    );
  const candidateSqlFilesPresent =
    optionalNumberSummary(handoffSummary, 'externalCandidateSqlFilesPresent') ??
    optionalNumberSummary(
      baselineProposalSummary,
      'externalCandidateSqlFilesPresent',
    ) ??
    optionalNumberSummary(handoffNextCampaign, 'candidateSqlFilesPresent') ??
    optionalNumberSummary(
      baselineProposalNextCampaign,
      'candidateSqlFilesPresent',
    );
  const candidateArchiveFilesPresent =
    optionalNumberSummary(
      handoffSummary,
      'externalCandidateArchiveFilesPresent',
    ) ??
    optionalNumberSummary(
      baselineProposalSummary,
      'externalCandidateArchiveFilesPresent',
    ) ??
    optionalNumberSummary(
      handoffNextCampaign,
      'candidateArchiveFilesPresent',
    ) ??
    optionalNumberSummary(
      baselineProposalNextCampaign,
      'candidateArchiveFilesPresent',
    );
  const candidateRequestJsonPath =
    stringSummary(handoffSummary, 'externalCandidateRequestJsonPath') ??
    stringSummary(
      baselineProposalSummary,
      'externalCandidateRequestJsonPath',
    ) ??
    stringSummary(handoffNextCampaign, 'candidateRequestJsonPath') ??
    stringSummary(baselineProposalNextCampaign, 'requestJsonPath');
  const candidateRequestMarkdownPath =
    stringSummary(handoffSummary, 'externalCandidateRequestMarkdownPath') ??
    stringSummary(
      baselineProposalSummary,
      'externalCandidateRequestMarkdownPath',
    ) ??
    stringSummary(handoffNextCampaign, 'candidateRequestMarkdownPath') ??
    stringSummary(baselineProposalNextCampaign, 'requestMarkdownPath');
  const candidateStatusJsonPath =
    stringSummary(handoffSummary, 'externalCandidateStatusJsonPath') ??
    stringSummary(baselineProposalSummary, 'externalCandidateStatusJsonPath') ??
    stringSummary(handoffNextCampaign, 'candidateStatusJsonPath') ??
    stringSummary(baselineProposalNextCampaign, 'statusJsonPath');
  const candidateStatusMarkdownPath =
    stringSummary(handoffSummary, 'externalCandidateStatusMarkdownPath') ??
    stringSummary(
      baselineProposalSummary,
      'externalCandidateStatusMarkdownPath',
    ) ??
    stringSummary(handoffNextCampaign, 'candidateStatusMarkdownPath') ??
    stringSummary(baselineProposalNextCampaign, 'statusMarkdownPath');
  const handoffVerificationChecklist = summaryStringList(
    handoffSummary,
    'externalCandidateVerificationChecklist',
  );
  const baselineVerificationChecklist = summaryStringList(
    baselineProposalSummary,
    'externalCandidateVerificationChecklist',
  );
  const handoffTargetRows = summaryTargetRows(
    handoffSummary,
    'externalCandidateTargetRows',
  );
  const baselineTargetRows = summaryTargetRows(
    baselineProposalSummary,
    'externalCandidateTargetRows',
  );
  const id =
    stringSummary(handoffSummary, 'baselineProposalNextCampaign') ??
    stringSummary(handoffNextCampaign, 'id') ??
    stringSummary(baselineProposalNextCampaign, 'id') ??
    stringSummary(externalPacketNextCampaign, 'id');
  if (!id) return null;
  return {
    id,
    migration:
      stringSummary(handoffNextCampaign, 'migration') ??
      stringSummary(baselineProposalNextCampaign, 'migration') ??
      stringSummary(externalPacketNextCampaign, 'migration'),
    reason:
      stringSummary(handoffNextCampaign, 'reason') ??
      stringSummary(baselineProposalNextCampaign, 'reason') ??
      stringSummary(externalPacketNextCampaign, 'reason'),
    recommendedAction:
      stringSummary(handoffNextCampaign, 'recommendedAction') ??
      stringSummary(baselineProposalNextCampaign, 'recommendedAction') ??
      stringSummary(externalPacketNextCampaign, 'recommendedAction'),
    candidateStatus:
      stringSummary(handoffSummary, 'externalCandidateIntakeStatus') ??
      stringSummary(baselineProposalSummary, 'externalCandidateIntakeStatus'),
    candidateRoot:
      stringSummary(handoffSummary, 'externalCandidateIntakeRoot') ??
      stringSummary(baselineProposalSummary, 'externalCandidateIntakeRoot'),
    candidateManifestPath,
    candidateManifestDigestPath,
    candidateManifestSha256,
    candidateFilesPresent,
    candidateSqlFilesPresent,
    candidateArchiveFilesPresent,
    candidateRequestJsonPath,
    candidateRequestMarkdownPath,
    candidateStatusJsonPath,
    candidateStatusMarkdownPath,
    verificationCommand:
      stringSummary(handoffSummary, 'externalCandidateVerificationCommand') ??
      stringSummary(
        baselineProposalSummary,
        'externalCandidateVerificationCommand',
      ),
    candidateAcceptedArchiveNames:
      handoffAcceptedArchiveNames.length > 0
        ? handoffAcceptedArchiveNames
        : baselineAcceptedArchiveNames,
    candidateSearchedRoots:
      handoffSearchedRoots.length > 0
        ? handoffSearchedRoots
        : baselineSearchedRoots,
    candidateVerificationChecklist:
      handoffVerificationChecklist.length > 0
        ? handoffVerificationChecklist
        : baselineVerificationChecklist,
    candidateTargetRows:
      handoffTargetRows.length > 0 ? handoffTargetRows : baselineTargetRows,
  };
}

function formatArtifactSummary(summary: unknown) {
  if (!summary || typeof summary !== 'object') return 'no summary';
  return Object.entries(summary as Record<string, unknown>)
    .slice(0, 4)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');
}

function formatBaselineResolutionSummary(summary: unknown) {
  const value = objectSummary(summary);
  if (Object.keys(value).length === 0) return 'no summary';
  return [
    `decision=${stringSummary(value, 'decision') ?? 'unknown'}`,
    `unresolvedMismatches=${numberSummary(value, 'unresolvedChecksumMismatches')}`,
    `exactMatches=${numberSummary(value, 'exactMatchLocations')}`,
    `missingRequiredFields=${numberSummary(value, 'missingRequiredFields')}`,
    `approvalReady=${booleanSummary(value, 'approvalReady')}`,
    `dbWriteAllowed=${booleanSummary(value, 'destructiveDbWriteAllowedByThisPlan')}`,
  ].join(', ');
}

function buildStaticArtifactDomains(args: Args): DomainAudit[] {
  const domains: DomainAudit[] = [];
  const databaseRecoveryEvidence = auditDatabaseRecoveryEvidence(args);
  if (hasDatabaseRecoveryArtifact(databaseRecoveryEvidence)) {
    domains.push(buildDatabaseRecoveryArtifactDomain(databaseRecoveryEvidence));
  }

  const schoolConsumerVisibility = readClosureArtifact(
    'school_data_consumer_visibility',
    args.schoolConsumerVisibility ??
      findLatestClosureReport(/^school-data-consumer-visibility-.+\.json$/),
  );
  const schoolConsumerVisibilityDisposition = readClosureArtifact(
    'school_data_consumer_visibility_disposition',
    args.schoolConsumerVisibilityDisposition ??
      findLatestClosureReport(
        /^school-data-consumer-visibility-disposition-.+\.json$/,
      ),
  );
  if (schoolConsumerVisibility.reportFound) {
    domains.push(
      buildSchoolConsumerVisibilityDomain(
        schoolConsumerVisibility,
        schoolConsumerVisibilityDisposition,
      ),
    );
  }
  const consumerFactSafety = readClosureArtifact(
    'consumer_fact_safety',
    args.consumerFactSafety ??
      findLatestClosureReport(/^consumer-fact-safety-worklist-.+\.json$/),
  );
  if (consumerFactSafety.reportFound) {
    domains.push(buildConsumerFactSafetyDomain(consumerFactSafety));
  }
  return domains;
}

function hasDatabaseRecoveryArtifact(evidence: DatabaseRecoveryEvidence) {
  return Object.values(evidence).some((artifact) => artifact.reportFound);
}

function buildDatabaseRecoveryArtifactDomain(
  evidence: DatabaseRecoveryEvidence,
): DomainAudit {
  const schemaStatus = normalizeArtifactStatus(evidence.schemaWorklist.status);
  const artifactStatuses = Object.entries(evidence)
    .filter(([, artifact]) => artifact.reportFound)
    .map(([key, artifact]) => ({
      key,
      status: normalizeArtifactStatus(artifact.status),
      summary: artifact.summary,
    }));
  const hasBlockingArtifact =
    schemaStatus === 'BLOCKED' ||
    artifactStatuses.some(({ key, status }) =>
      isDatabaseRecoveryArtifactBlocking(evidence, key, status),
    );
  const hasReviewArtifact = artifactStatuses.some(
    ({ status }) =>
      status.length > 0 &&
      ![
        'PASS',
        'PASS_NO_DB_MIGRATION_BLOCKER',
        'ACCEPTED',
        'EXACT_SQL_ARTIFACT_FOUND',
      ].includes(status),
  );
  const categories = emptyBuckets();
  if (hasBlockingArtifact) {
    categories.conflict = 1;
    categories.missingConsumerVerification = 1;
    categories.needsReview = 1;
  } else if (hasReviewArtifact) {
    categories.needsReview = 1;
  } else {
    categories.trustedUsable = 1;
  }
  const statusSummary = artifactStatuses
    .map(({ key, status }) => `${key}=${status || 'unknown'}`)
    .join(', ');
  const blockers = hasBlockingArtifact
    ? buildDatabaseRecoveryBlockers(evidence)
    : [];

  return {
    id: 'database_schema_compatibility',
    label: 'Prisma DB schema compatibility for platform data closure',
    priority: 'P0',
    source: 'mixed',
    counts: {
      recoveryEvidence: evidence,
      artifactStatuses,
    },
    categories,
    coverage: hasBlockingArtifact
      ? failMetric(
          `Read-only DB schema/migration artifacts are not closed: ${statusSummary}`,
        )
      : hasReviewArtifact
        ? warnMetric(
            `Read-only DB schema/migration artifacts require review: ${statusSummary}`,
          )
        : passMetric(
            `Read-only DB schema/migration artifacts are closed: ${statusSummary}`,
          ),
    freshness: passMetric(
      'Database recovery gate is based on the supplied latest read-only artifacts',
    ),
    sourceQuality: hasBlockingArtifact
      ? failMetric(
          'Migration recovery evidence is incomplete or requires a baseline decision',
        )
      : hasReviewArtifact
        ? warnMetric('Migration recovery evidence requires review')
        : passMetric('Migration recovery evidence is accepted'),
    provenance: hasBlockingArtifact
      ? failMetric(
          'Schema compatibility provenance is blocked by unresolved migration history evidence',
        )
      : hasReviewArtifact
        ? warnMetric('Schema compatibility provenance requires review')
        : passMetric('Schema compatibility provenance is closed'),
    conflicts: hasBlockingArtifact
      ? failMetric(
          'Current DB migration history conflicts with the repository migration set',
        )
      : hasReviewArtifact
        ? warnMetric('DB migration artifact review is still open')
        : passMetric('No DB migration artifact conflicts detected'),
    consumerClosure: hasBlockingArtifact
      ? failMetric(
          'DB-backed consumer closure cannot be trusted until schema/migration artifacts close',
        )
      : hasReviewArtifact
        ? warnMetric('DB-backed consumer closure requires artifact review')
        : passMetric('DB-backed consumer closure artifacts are accepted'),
    nextAction: hasBlockingArtifact
      ? 'block-release'
      : hasReviewArtifact
        ? 'review'
        : 'accept',
    blockers,
    evidence: formatDatabaseRecoveryEvidence(evidence),
  };
}

function normalizeArtifactStatus(status: string | null) {
  return (status ?? '').trim().toUpperCase();
}

function isDatabaseRecoveryBlockingStatus(status: string | null) {
  return DATABASE_RECOVERY_BLOCKING_STATUSES.has(
    normalizeArtifactStatus(status),
  );
}

function isDatabaseRecoveryArtifactBlocking(
  evidence: DatabaseRecoveryEvidence,
  key: string,
  status: string | null,
) {
  const normalizedStatus = normalizeArtifactStatus(status);
  if (
    key === 'baselineScopePreflight' &&
    normalizedStatus === 'BLOCKED_BACKUP_EVIDENCE_REQUIRED' &&
    hasReadyBackupEvidence(evidence.backupEvidencePacket)
  ) {
    return false;
  }
  return DATABASE_RECOVERY_BLOCKING_STATUSES.has(normalizedStatus);
}

function hasReadyBackupEvidence(artifact: ClosureArtifactSummary) {
  if (!artifact.reportFound) return false;
  const summary = objectSummary(artifact.summary);
  return (
    normalizeArtifactStatus(artifact.status) ===
      'REVIEW_BACKUP_OR_DISPOSABLE_TARGET_READY' ||
    (summary.readyForBaselineResolutionInput === true &&
      numberSummary(summary, 'missingRequiredInputs') === 0)
  );
}

function buildSchoolConsumerVisibilityDomain(
  artifact: ClosureArtifactSummary,
  dispositionArtifact?: ClosureArtifactSummary,
): DomainAudit {
  const summary = objectSummary(artifact.summary);
  const dispositionSummary = objectSummary(dispositionArtifact?.summary);
  const reviewRows = numberSummary(summary, 'reviewRows');
  const criticalReviewRows = numberSummary(summary, 'criticalReviewRows');
  const dispositionReviewRows = numberSummary(dispositionSummary, 'reviewRows');
  const dispositionCriticalReviewRows = numberSummary(
    dispositionSummary,
    'criticalReviewRows',
  );
  const dispositionClosed =
    Boolean(dispositionArtifact?.reportFound) &&
    normalizeArtifactStatus(dispositionArtifact?.status ?? null) ===
      'SCHOOL_CONSUMER_VISIBILITY_DISPOSITION_READY' &&
    booleanSummary(dispositionSummary, 'allRowsHaveDisposition') === 'true' &&
    numberSummary(dispositionSummary, 'blockedRows') === 0;
  const missingConsumerReferences = numberSummary(
    summary,
    'missingConsumerReferences',
  );
  const missingProvenanceVisibility = numberSummary(
    summary,
    'missingProvenanceVisibility',
  );
  const missingWeakStateVisibility = numberSummary(
    summary,
    'missingWeakStateVisibility',
  );
  const rows = numberSummary(summary, 'rows');
  const acceptedRows = numberSummary(summary, 'acceptedRows');
  const categories = emptyBuckets();
  categories.trustedUsable = acceptedRows;
  categories.missingConsumerVerification =
    missingConsumerReferences + missingWeakStateVisibility;
  categories.missingProvenance = missingProvenanceVisibility;
  categories.needsReview = dispositionClosed
    ? dispositionReviewRows
    : reviewRows;
  return {
    id: 'school_data_consumer_visibility',
    label: 'School data consumer visibility checks',
    priority: 'P0',
    source: 'code',
    counts: {
      artifact,
      dispositionArtifact,
      rows,
      acceptedRows,
      reviewRows,
      criticalReviewRows,
      dispositionReviewRows,
      dispositionCriticalReviewRows,
      dispositionClosed,
      missingConsumerReferences,
      missingProvenanceVisibility,
      missingWeakStateVisibility,
    },
    categories,
    coverage: ratioMetric(
      acceptedRows,
      Math.max(1, rows),
      'school field/surface consumer-visibility rows accepted',
      0.95,
      0.8,
    ),
    freshness: passMetric(
      'Static consumer visibility is based on current repository code',
    ),
    sourceQuality:
      missingProvenanceVisibility === 0
        ? passMetric('No static provenance-visibility gaps found')
        : warnMetric(
            `${missingProvenanceVisibility} school field/surface rows reference sourced facts without provenance visibility signals`,
          ),
    provenance:
      missingProvenanceVisibility === 0
        ? passMetric(
            'Referenced school facts include provenance visibility signals',
          )
        : warnMetric(
            `${missingProvenanceVisibility} referenced school fact rows need source/provenance visibility review`,
          ),
    conflicts: passMetric(
      'Static consumer visibility worklist does not detect DB value conflicts',
    ),
    consumerClosure:
      reviewRows === 0
        ? passMetric(
            'All expected school field/surface rows have visibility evidence',
          )
        : dispositionClosed
          ? warnMetric(
              `${dispositionReviewRows} school field/surface rows have explicit consumer visibility dispositions`,
            )
          : warnMetric(
              `${reviewRows} school field/surface rows need consumer visibility review`,
            ),
    nextAction: reviewRows > 0 ? 'review' : 'accept',
    blockers:
      criticalReviewRows > 0 && !dispositionClosed
        ? [
            `${criticalReviewRows} critical school-data consumer visibility rows require review`,
          ]
        : [],
    evidence: [
      artifact.path ?? 'school-data-consumer-visibility report',
      `school_data_consumer_visibility: ${artifact.status ?? 'unknown'}`,
      ...(dispositionArtifact?.reportFound
        ? [
            `school_data_consumer_visibility_disposition: ${dispositionArtifact.status ?? 'unknown'}`,
            `school_data_consumer_visibility_disposition_closed: ${dispositionClosed}`,
            `school_data_consumer_visibility_disposition_review_rows: ${dispositionReviewRows}`,
          ]
        : []),
    ],
  };
}

function buildConsumerFactSafetyDomain(
  artifact: ClosureArtifactSummary,
): DomainAudit {
  const summary = objectSummary(artifact.summary);
  const totalRows = numberSummary(summary, 'totalRows');
  const trustedRows = numberSummary(summary, 'trustedRows');
  const reviewRows = numberSummary(summary, 'reviewRows');
  const blockedRows = numberSummary(summary, 'blockedRows');
  const highRiskBlockedRows = numberSummary(summary, 'highRiskBlockedRows');
  const missingSourceGateRows = numberSummary(summary, 'missingSourceGateRows');
  const missingFreshnessGateRows = numberSummary(
    summary,
    'missingFreshnessGateRows',
  );
  const missingConflictGateRows = numberSummary(
    summary,
    'missingConflictGateRows',
  );
  const missingWeakStateGateRows = numberSummary(
    summary,
    'missingWeakStateGateRows',
  );
  const unsafeSignalRows = numberSummary(summary, 'unsafeSignalRows');
  const categories = emptyBuckets();
  categories.trustedUsable = trustedRows;
  categories.missingProvenance = missingSourceGateRows;
  categories.stale = missingFreshnessGateRows;
  categories.conflict = missingConflictGateRows;
  categories.missingConsumerVerification =
    missingWeakStateGateRows + unsafeSignalRows;
  categories.needsReview = reviewRows + blockedRows;
  const status = normalizeArtifactStatus(artifact.status);
  const isBlocked =
    status === 'BLOCKED_CONSUMER_FACT_SAFETY' || highRiskBlockedRows > 0;
  const hasReview = reviewRows > 0 || blockedRows > 0;

  return {
    id: 'consumer_fact_safety',
    label:
      'Runtime consumer fact safety for prediction, recommendation, essay, timeline, chat, school-list, and application analysis',
    priority: 'P0',
    source: 'code',
    counts: {
      artifact,
      totalRows,
      trustedRows,
      reviewRows,
      blockedRows,
      highRiskBlockedRows,
      missingSourceGateRows,
      missingFreshnessGateRows,
      missingConflictGateRows,
      missingWeakStateGateRows,
      unsafeSignalRows,
    },
    categories,
    coverage: ratioMetric(
      trustedRows,
      Math.max(1, totalRows),
      'runtime consumer fact-safety rows trusted',
      0.95,
      0.8,
    ),
    freshness:
      missingFreshnessGateRows === 0
        ? passMetric('No runtime consumer freshness-gate gaps detected')
        : warnMetric(
            `${missingFreshnessGateRows} runtime consumer rows lack freshness or cycle-year gates`,
          ),
    sourceQuality:
      missingSourceGateRows === 0
        ? passMetric('No runtime consumer source-gate gaps detected')
        : failMetric(
            `${missingSourceGateRows} runtime consumer rows lack source/provenance gates`,
          ),
    provenance:
      missingSourceGateRows === 0
        ? passMetric(
            'Runtime consumer rows have configured source/provenance gate signals',
          )
        : failMetric(
            `${missingSourceGateRows} runtime consumer rows need source/provenance gate review`,
          ),
    conflicts:
      missingConflictGateRows === 0
        ? passMetric('No runtime consumer conflict-gate gaps detected')
        : warnMetric(
            `${missingConflictGateRows} runtime consumer rows lack conflict/review/terminal gates`,
          ),
    consumerClosure:
      blockedRows === 0 && reviewRows === 0
        ? passMetric('All configured runtime consumer fact-safety rows passed')
        : isBlocked
          ? failMetric(
              `${blockedRows} runtime consumer fact-safety rows are blocked; ${highRiskBlockedRows} are high-risk`,
            )
          : warnMetric(
              `${reviewRows} runtime consumer fact-safety rows require review`,
            ),
    nextAction: isBlocked ? 'block-release' : hasReview ? 'review' : 'accept',
    blockers: isBlocked
      ? [
          `${highRiskBlockedRows || blockedRows} high-risk runtime consumer fact-safety rows block release`,
        ]
      : [],
    evidence: [
      artifact.path ?? 'consumer-fact-safety report',
      `consumer_fact_safety: ${artifact.status ?? 'unknown'}`,
      `consumer_fact_safety_rows: ${totalRows}`,
      `consumer_fact_safety_blocked: ${blockedRows}`,
      `consumer_fact_safety_high_risk_blocked: ${highRiskBlockedRows}`,
      `consumer_fact_safety_missing_source_gate: ${missingSourceGateRows}`,
    ],
  };
}

function objectSummary(summary: unknown) {
  return summary && typeof summary === 'object' && !Array.isArray(summary)
    ? (summary as Record<string, unknown>)
    : {};
}

function aggregateSummaries(summaries: Array<Record<string, unknown>>) {
  const aggregate: Record<string, unknown> = {
    artifactCount: summaries.length,
  };
  for (const summary of summaries) {
    for (const [key, value] of Object.entries(summary)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        aggregate[key] = asNumber(aggregate[key]) + value;
        continue;
      }
      if (typeof value === 'boolean') {
        aggregate[key] = Boolean(aggregate[key]) || value;
        continue;
      }
      if (Array.isArray(value)) {
        aggregate[key] = Array.from(
          new Set([
            ...(Array.isArray(aggregate[key]) ? aggregate[key] : []),
            ...value,
          ]),
        );
        continue;
      }
      if (value && typeof value === 'object') {
        aggregate[key] = aggregateNestedSummary(
          record(aggregate[key]),
          record(value),
        );
      }
    }
  }
  return aggregate;
}

function aggregateNestedSummary(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
) {
  const aggregate = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      aggregate[key] = asNumber(aggregate[key]) + value;
    } else if (typeof value === 'boolean') {
      aggregate[key] = Boolean(aggregate[key]) || value;
    } else if (typeof value === 'string' && !(key in aggregate)) {
      aggregate[key] = value;
    }
  }
  return aggregate;
}

function latestIso(values: string[]) {
  return values.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

function numberSummary(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function optionalNumberSummary(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringSummary(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function summaryStringList(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => isString(item))
    : [];
}

function summaryTargetRows(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
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

function booleanSummary(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
  return typeof value === 'boolean' ? String(value) : 'unknown';
}

async function buildDbDomains(
  prisma: PrismaClient,
  args: Args,
): Promise<DomainAudit[]> {
  const db = prisma as unknown as Record<string, any>;
  const [
    schoolDomain,
    mediaDomain,
    essayDomain,
    deadlineDomain,
    profileDomain,
    caseDomain,
    memoryDomain,
    notificationDomain,
    operationsDomain,
    securityDomain,
    benchmarkDomain,
  ] = await Promise.all([
    auditSchoolDomain(prisma, args),
    auditSchoolMediaDomain(db, args),
    auditEssayDomain(db, args),
    auditDeadlinePolicyDomain(db, args),
    auditProfileDomain(db, args),
    auditCaseOutcomeDomain(db, args),
    auditAiMemoryDomain(db, args),
    auditNotificationDomain(),
    auditOperationsDomain(db),
    auditSecurityDomain(db),
    auditBenchmarkGovernanceDomain(db),
  ]);
  return [
    schoolDomain,
    mediaDomain,
    essayDomain,
    deadlineDomain,
    profileDomain,
    caseDomain,
    memoryDomain,
    notificationDomain,
    operationsDomain,
    securityDomain,
    benchmarkDomain,
  ];
}

async function auditSchoolDomain(
  prisma: PrismaClient,
  args: Args,
): Promise<DomainAudit> {
  const schools = await prisma.school.findMany({
    where: { country: { in: US_COUNTRIES } },
    orderBy: [{ usNewsRank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      usNewsRank: true,
      metadata: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      transferAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      hasEarlyDecision: true,
      sat25: true,
      sat75: true,
      satAvg: true,
      satMath25: true,
      satMath75: true,
      satReading25: true,
      satReading75: true,
      act25: true,
      act75: true,
      actAvg: true,
      gpaDistribution: true,
      tuition: true,
      roomAndBoard: true,
      averageAidPackage: true,
      averageNetPrice: true,
      percentNeedMet: true,
      applicationFee: true,
      feeWaiverAvailable: true,
      acceptsCommonApp: true,
      acceptsCoalition: true,
      testOptional: true,
      testingPolicy: true,
      graduationRate: true,
      retentionRate: true,
      salary6YrPostGrad: true,
      avgSalary: true,
      loanDefaultRate: true,
      monthlyLoanPayment: true,
      totalEnrollment: true,
      studentFacultyRatio: true,
      intlStudentPct: true,
      countriesRepresented: true,
      studentOrgsCount: true,
      nicheOverallGrade: true,
      nicheSafetyGrade: true,
      nicheLifeGrade: true,
      nicheFoodGrade: true,
      description: true,
      descriptionZh: true,
      _count: {
        select: {
          cdsAdmitBands: true,
          programs: true,
          deadlines: true,
          essayPrompts: true,
          rankings: true,
          communityRatings: true,
          cases: true,
        },
      },
    },
  });
  const totals = Object.fromEntries(
    FULL_FIELD_AUDIT_SPECS.map((spec) => [
      spec.key,
      {
        real: 0,
        secondary: 0,
        heuristic: 0,
        terminal: 0,
        legacyValue: 0,
        open: 0,
        missing: 0,
      },
    ]),
  ) as Record<string, Record<string, number>>;
  let stale = 0;
  for (const school of schools) {
    for (const spec of FULL_FIELD_AUDIT_SPECS) {
      const result = classifySchoolField(
        school as Record<string, unknown>,
        spec,
      );
      totals[spec.key][result.bucket] += 1;
      if (isStale(result.verifiedAt, args.staleDays)) stale += 1;
    }
  }
  const totalSlots = schools.length * FULL_FIELD_AUDIT_SPECS.length;
  const trusted = sumFieldBuckets(totals, ['real', 'secondary']);
  const usable = sumFieldBuckets(totals, [
    'real',
    'secondary',
    'heuristic',
    'terminal',
    'legacyValue',
  ]);
  const open = sumFieldBuckets(totals, ['open', 'missing']);
  const legacy = sumFieldBuckets(totals, ['legacyValue']);
  const terminal = sumFieldBuckets(totals, ['terminal']);
  const topOpenFields = Object.entries(totals)
    .map(([field, values]) => ({
      field,
      open: values.open + values.missing,
      missing: values.missing,
    }))
    .sort((a, b) => b.open - a.open)
    .slice(0, 10);
  const schoolAnchorDisposition = readClosureArtifact(
    'school_anchor_disposition',
    args.schoolAnchorDisposition ??
      findLatestClosureReport(/^school-anchor-disposition-.+\.json$/),
  );
  const dispositionSummary = objectSummary(schoolAnchorDisposition.summary);
  const closureStateSummary = objectSummary(dispositionSummary.byClosureState);
  const dispositionClosed =
    schoolAnchorDisposition.reportFound &&
    normalizeArtifactStatus(schoolAnchorDisposition.status) ===
      'SCHOOL_ANCHOR_DISPOSITION_READY' &&
    booleanSummary(dispositionSummary, 'allRowsHaveDisposition') === 'true' &&
    numberSummary(dispositionSummary, 'unmappedRows') === 0 &&
    numberSummary(dispositionSummary, 'blockedRows') === 0;
  const dispositionReviewRows =
    numberSummary(closureStateSummary, 'review') +
    numberSummary(closureStateSummary, 'source_search');
  const dispositionSourceSearchRows = numberSummary(
    dispositionSummary,
    'needsSourceSearchRows',
  );
  const dispositionCandidateReviewRows = numberSummary(
    dispositionSummary,
    'candidateReviewRows',
  );
  const dispositionLegacyReviewRows = numberSummary(
    dispositionSummary,
    'legacyReviewRows',
  );
  const dispositionHeuristicReviewRows = numberSummary(
    dispositionSummary,
    'heuristicReviewRows',
  );
  const categories = emptyBuckets();
  categories.trustedUsable = trusted;
  categories.needsReview = dispositionClosed
    ? dispositionReviewRows
    : sumFieldBuckets(totals, ['open']);
  categories.missingProvenance = legacy;
  categories.terminal = terminal;
  categories.stale = stale;
  const rawOpenBlockers = topOpenFields
    .filter((field) => field.open > 0)
    .slice(0, 5)
    .map(
      (field) =>
        `${field.field} has ${field.open} open/missing US school slots`,
    );
  const dispositionBlockers =
    schoolAnchorDisposition.reportFound && !dispositionClosed
      ? [
          `School anchor disposition status ${schoolAnchorDisposition.status ?? 'unknown'} (${formatArtifactSummary(schoolAnchorDisposition.summary)})`,
        ]
      : [];
  const blockers =
    open > 0 && !dispositionClosed
      ? [...dispositionBlockers, ...rawOpenBlockers]
      : dispositionBlockers;
  return {
    id: 'school_facts_admission_anchors',
    label: 'School facts, admission anchors, aid, outcomes, campus life',
    priority: 'P0',
    source: 'mixed',
    counts: {
      schools: schools.length,
      fields: FULL_FIELD_AUDIT_SPECS.length,
      totalSlots,
      trusted,
      usable,
      open,
      stale,
      byField: totals,
      topOpenFields,
      schoolAnchorDisposition,
    },
    categories,
    coverage: ratioMetric(usable, totalSlots, 'usable school data slots'),
    freshness:
      stale === 0
        ? passMetric('No stale verifiedAt signals found')
        : warnMetric(
            `${stale} school field sources are older than ${args.staleDays} days`,
          ),
    sourceQuality: ratioMetric(
      trusted,
      totalSlots,
      'official/secondary sourced school slots',
      0.65,
      0.4,
    ),
    provenance: dispositionClosed
      ? dispositionReviewRows > 0
        ? warnMetric(
            `${numberSummary(dispositionSummary, 'emittedRows')} school anchor worklist rows have explicit dispositions; ${dispositionCandidateReviewRows} candidate-evidence rows, ${dispositionSourceSearchRows} source-search rows, ${dispositionLegacyReviewRows} legacy rows, and ${dispositionHeuristicReviewRows} heuristic rows remain in review`,
          )
        : passMetric(
            `${numberSummary(dispositionSummary, 'emittedRows')} school anchor worklist rows have trusted or terminal dispositions`,
          )
      : legacy === 0
        ? passMetric('No legacy-value-only school slots detected')
        : warnMetric(
            `${legacy} school slots have values without audit-grade provenance`,
          ),
    conflicts: passMetric(
      'No direct DB/file conflict pass implemented for school rows yet',
    ),
    consumerClosure: dispositionClosed
      ? passMetric(
          'School anchor disposition packet assigns consumer policies for trusted, review, source-search, and terminal rows',
        )
      : ratioMetric(
          schools.length -
            topOpenFields.filter((field) => isPredictionCritical(field.field))
              .length,
          Math.max(1, schools.length),
          'prediction/school-page critical coverage proxy',
          0.95,
          0.8,
        ),
    nextAction:
      open > 0 || legacy > 0 || dispositionReviewRows > 0
        ? dispositionClosed
          ? 'review'
          : 'backfill'
        : 'accept',
    blockers,
    evidence: [
      'FULL_FIELD_AUDIT_SPECS',
      'School.metadata.provenance',
      'docs/SCHOOL_DATA_COLLECTION_SOP.md',
      'docs/adr/0017-school-data-provenance.md',
      ...(schoolAnchorDisposition.reportFound
        ? [
            `school_anchor_disposition: ${schoolAnchorDisposition.status ?? 'unknown'}`,
          ]
        : []),
    ],
  };
}

async function auditSchoolMediaDomain(
  db: Record<string, any>,
  args: Args,
): Promise<DomainAudit> {
  const [total, approvedPrimary, byStatus, bySourceType] = await Promise.all([
    count(db, 'schoolMediaAsset'),
    count(db, 'schoolMediaAsset', { where: { status: 'APPROVED' } }),
    group(db, 'schoolMediaAsset', 'status'),
    group(db, 'schoolMediaAsset', 'sourceType'),
  ]);
  const primaryCover = await count(db, 'schoolMediaAsset', {
    where: { isPrimary: true, status: 'APPROVED', type: 'CAMPUS_COVER' },
  });
  const categories = emptyBuckets();
  categories.trustedUsable = approvedPrimary;
  categories.needsReview =
    (byStatus.CANDIDATE ?? 0) + (byStatus.UNDER_REVIEW ?? 0);
  categories.terminal = byStatus.REJECTED ?? 0;
  const mediaDisposition = readClosureArtifact(
    'school_media_disposition',
    args.schoolMediaDisposition ??
      findLatestClosureReport(/^school-media-disposition-.+\.json$/),
  );
  const dispositionSummary = objectSummary(mediaDisposition.summary);
  const dispositionSourceSearchRows = numberSummary(
    dispositionSummary,
    'sourceSearchRows',
  );
  const dispositionReviewRows = numberSummary(dispositionSummary, 'reviewRows');
  const dispositionConflictRows = numberSummary(
    dispositionSummary,
    'conflictRows',
  );
  const dispositionBlockedRows = numberSummary(
    dispositionSummary,
    'blockedRows',
  );
  const dispositionReady =
    mediaDisposition.reportFound &&
    mediaDisposition.status === 'SCHOOL_MEDIA_DISPOSITION_READY' &&
    dispositionSummary.allRowsHaveDisposition === true &&
    dispositionBlockedRows === 0;
  if (mediaDisposition.reportFound) {
    categories.missingProvenance += dispositionSourceSearchRows;
    categories.needsReview += dispositionReviewRows;
    categories.conflict += dispositionConflictRows;
  }
  const blockers: string[] = [];
  if (primaryCover === 0 && !dispositionReady) {
    blockers.push(
      'No approved primary campus covers found in SchoolMediaAsset',
    );
  }
  if (
    mediaDisposition.reportFound &&
    normalizeArtifactStatus(mediaDisposition.status).startsWith('BLOCKED')
  ) {
    blockers.push(
      `School media disposition status ${mediaDisposition.status ?? 'unknown'} (${formatArtifactSummary(mediaDisposition.summary)})`,
    );
  }
  return {
    id: 'school_media',
    label: 'School media assets and campus covers',
    priority: 'P1',
    source: 'mixed',
    counts: {
      total,
      approvedPrimary,
      primaryCover,
      byStatus,
      bySourceType,
      mediaDisposition,
    },
    categories,
    coverage: ratioMetric(
      approvedPrimary,
      Math.max(1, total),
      'approved media assets',
      0.7,
      0.4,
    ),
    freshness: unknownMetric(
      'Media freshness is source/license driven, not date-gated yet',
    ),
    sourceQuality:
      primaryCover > 0
        ? passMetric(`${primaryCover} approved primary campus covers`)
        : dispositionReady
          ? warnMetric(
              `${dispositionSourceSearchRows} media rows have source-search dispositions; no approved primary covers yet`,
            )
          : failMetric('No approved primary campus covers'),
    provenance:
      approvedPrimary > 0
        ? passMetric(
            `${approvedPrimary} approved assets with license/attribution review proxy`,
          )
        : dispositionReady
          ? warnMetric(
              'Missing campus-cover provenance is dispositioned for source discovery',
            )
          : failMetric('No approved media provenance available'),
    conflicts: passMetric('Rejected assets are isolated by status'),
    consumerClosure:
      primaryCover > 0
        ? passMetric(`${primaryCover} school card/detail primary cover proxies`)
        : dispositionReady
          ? warnMetric(
              'School media consumers must use placeholder/fallback policy until approved covers exist',
            )
          : failMetric('No school card/detail primary cover proxy'),
    nextAction:
      categories.needsReview > 0
        ? 'review'
        : primaryCover > 0
          ? 'accept'
          : 'backfill',
    blockers,
    evidence: [
      'SchoolMediaAsset',
      'docs/SCHOOL_MEDIA_RUNBOOK.md',
      ...(mediaDisposition.reportFound
        ? [
            `school_media_disposition: ${mediaDisposition.status ?? 'unknown'} (${mediaDisposition.path})`,
          ]
        : []),
    ],
  };
}

async function auditEssayDomain(
  db: Record<string, any>,
  args: Args,
): Promise<DomainAudit> {
  const consumerSafety = inspectEssayPromptConsumerSafety();
  const sourceRecovery = readClosureArtifact(
    'essay_prompt_source_recovery',
    args.essaySourceRecovery ??
      findLatestClosureReport(/^essay-prompt-source-recovery-.+\.json$/),
  );
  const sourceValidation = readClosureArtifact(
    'essay_prompt_source_validation',
    args.essaySourceValidation ??
      findLatestClosureReport(/^essay-prompt-source-validation-.+\.json$/),
  );
  const sourceSearchCampaign = readClosureArtifact(
    'essay_prompt_source_search_campaign',
    args.essaySourceSearchCampaign ??
      findLatestClosureReport(/^essay-prompt-source-search-campaign-.+\.json$/),
  );
  const sourceManualCheck = readClosureArtifacts(
    'essay_prompt_source_manual_check',
    args.essaySourceManualCheck,
    findLatestClosureReport(/^essay-prompt-source-manual-check-.+\.json$/),
  );
  const sourceFamilyMismatchReview = readClosureArtifacts(
    'essay_prompt_source_family_mismatch_review',
    args.essaySourceFamilyMismatchReview,
    findLatestClosureReport(
      /^essay-prompt-source-family-mismatch-review-.+\.json$/,
    ),
  );
  const sourceReviewStaging = readClosureArtifact(
    'essay_prompt_source_review_staging',
    args.essaySourceReviewStaging ??
      findLatestClosureReport(/^essay-prompt-source-review-staging-.+\.json$/),
  );
  const sourceReviewApproval = readClosureArtifact(
    'essay_prompt_source_review_approval',
    args.essaySourceReviewApproval ??
      findLatestClosureReport(/^essay-prompt-source-review-approval-.+\.json$/),
  );
  const sourceWritePlan = readClosureArtifact(
    'essay_prompt_source_write_plan',
    args.essaySourceWritePlan ??
      findLatestClosureReport(/^essay-prompt-source-write-plan-.+\.json$/),
  );
  const sourceApprovalMonitor = readClosureArtifact(
    'essay_prompt_source_approval_monitor',
    args.essaySourceApprovalMonitor ??
      findLatestClosureReport(
        /^essay-prompt-source-approval-monitor-.+\.json$/,
      ),
  );
  const essayReviewQueue = readClosureArtifact(
    'essay_prompt_review_queue',
    args.essayReviewQueue ??
      findLatestClosureReport(/^essay-prompt-review-queue-.+\.json$/),
  );
  const essayReviewAction = readClosureArtifact(
    'essay_prompt_review_action',
    args.essayReviewAction ??
      findLatestClosureReport(/^essay-prompt-review-action-.+\.json$/),
  );
  const essayPromptDisposition = readClosureArtifact(
    'essay_prompt_disposition',
    args.essayPromptDisposition ??
      findLatestClosureReport(/^essay-prompt-disposition-.+\.json$/),
  );
  const essayPromptIdentityConflicts = readClosureArtifact(
    'essay_prompt_identity_conflicts',
    args.essayPromptIdentityConflicts ??
      findLatestClosureReport(/^essay-prompt-identity-conflicts-.+\.json$/),
  );
  const essayPromptIdentityConflictResolution = readClosureArtifact(
    'essay_prompt_identity_conflict_resolution',
    args.essayPromptIdentityConflictResolution ??
      findLatestClosureReport(
        /^essay-prompt-identity-conflict-resolution-.+\.json$/,
      ),
  );
  const dispositionSummary = objectSummary(essayPromptDisposition.summary);
  const sourceSearchCampaignSummary = objectSummary(
    sourceSearchCampaign.summary,
  );
  const sourceManualCheckSummary = objectSummary(sourceManualCheck.summary);
  const sourceFamilyMismatchReviewSummary = objectSummary(
    sourceFamilyMismatchReview.summary,
  );
  const sourceReviewApprovalSummary = objectSummary(
    sourceReviewApproval.summary,
  );
  const sourceWritePlanSummary = objectSummary(sourceWritePlan.summary);
  const sourceApprovalMonitorSummary = objectSummary(
    sourceApprovalMonitor.summary,
  );
  const essayReviewQueueSummary = objectSummary(essayReviewQueue.summary);
  const essayReviewActionSummary = objectSummary(essayReviewAction.summary);
  const identityConflictSummary = objectSummary(
    essayPromptIdentityConflicts.summary,
  );
  const identityResolutionSummary = objectSummary(
    essayPromptIdentityConflictResolution.summary,
  );
  const closureStateSummary = objectSummary(dispositionSummary.byClosureState);
  const dispositionClosed =
    essayPromptDisposition.reportFound &&
    normalizeArtifactStatus(essayPromptDisposition.status) ===
      'ESSAY_PROMPT_DISPOSITION_READY' &&
    booleanSummary(dispositionSummary, 'allRowsHaveDisposition') === 'true' &&
    numberSummary(dispositionSummary, 'unmappedRows') === 0 &&
    numberSummary(dispositionSummary, 'blockedRows') === 0;
  const dispositionReviewRows =
    numberSummary(closureStateSummary, 'review') +
    numberSummary(closureStateSummary, 'source_search');
  const dispositionSourceSearchRows = numberSummary(
    dispositionSummary,
    'sourceSearchRows',
  );
  const dispositionDbSchemaBlockedRows = numberSummary(
    dispositionSummary,
    'dbSchemaBlockedRows',
  );
  const identityConflictRows = numberSummary(
    identityConflictSummary,
    'conflictRows',
  );
  const identityReviewRows = numberSummary(
    identityConflictSummary,
    'reviewRows',
  );
  const identityResolutionClosed =
    essayPromptIdentityConflictResolution.reportFound &&
    normalizeArtifactStatus(essayPromptIdentityConflictResolution.status) ===
      'ESSAY_PROMPT_IDENTITY_CONFLICT_RESOLUTION_READY' &&
    booleanSummary(identityResolutionSummary, 'allRowsHaveDisposition') ===
      'true' &&
    numberSummary(identityResolutionSummary, 'blockedRows') === 0;
  const [
    total,
    currentYear,
    verifiedCurrent,
    sourceBackedVerifiedCurrent,
    withoutSources,
    sourceCount,
    auditCount,
    byStatus,
    byType,
    pipelineByStatus,
  ] = await Promise.all([
    count(db, 'essayPrompt'),
    count(db, 'essayPrompt', { where: { year: args.applicationYear } }),
    count(db, 'essayPrompt', {
      where: { year: args.applicationYear, status: 'VERIFIED' },
    }),
    count(db, 'essayPrompt', {
      where: {
        year: args.applicationYear,
        status: 'VERIFIED',
        sources: { some: { sourceUrl: { not: null } } },
      },
    }),
    count(db, 'essayPrompt', { where: { sources: { none: {} } } }),
    count(db, 'essayPromptSource'),
    count(db, 'essayPromptAudit'),
    group(db, 'essayPrompt', 'status'),
    group(db, 'essayPrompt', 'type'),
    group(db, 'essayPipelineRun', 'status'),
  ]);
  const staleSources = await count(db, 'essayPromptSource', {
    where: {
      scrapedAt: { lt: new Date(Date.now() - args.staleDays * DAY_MS) },
    },
  });
  const categories = emptyBuckets();
  categories.trustedUsable = sourceBackedVerifiedCurrent;
  categories.missingProvenance = withoutSources;
  categories.stale = staleSources;
  categories.needsReview = dispositionClosed
    ? dispositionReviewRows + identityReviewRows
    : (byStatus.PENDING ?? 0) + (pipelineByStatus.FAILED ?? 0);
  categories.conflict = identityConflictRows;
  categories.terminal = byStatus.REJECTED ?? 0;
  return {
    id: 'essay_prompts',
    label: 'Essay prompts, sources, pipeline runs, prompt audits',
    priority: 'P0',
    source: 'db',
    counts: {
      total,
      currentYear: args.applicationYear,
      currentYearPrompts: currentYear,
      verifiedCurrent,
      sourceBackedVerifiedCurrent,
      withoutSources,
      sourceCount,
      auditCount,
      staleSources,
      consumerSafety,
      sourceRecovery,
      sourceValidation,
      sourceSearchCampaign,
      sourceManualCheck,
      sourceFamilyMismatchReview,
      sourceReviewStaging,
      sourceReviewApproval,
      sourceWritePlan,
      sourceApprovalMonitor,
      essayReviewQueue,
      essayReviewAction,
      essayPromptDisposition,
      essayPromptIdentityConflicts,
      essayPromptIdentityConflictResolution,
      byStatus,
      byType,
      pipelineByStatus,
    },
    categories,
    coverage: ratioMetric(
      sourceBackedVerifiedCurrent,
      Math.max(1, currentYear),
      'source-backed verified current-year prompts',
      0.9,
      0.65,
    ),
    freshness:
      staleSources === 0
        ? passMetric('No stale essay prompt sources found')
        : warnMetric(
            `${staleSources} essay sources older than ${args.staleDays} days`,
          ),
    sourceQuality:
      withoutSources === 0
        ? passMetric('All essay prompts have at least one source')
        : dispositionClosed
          ? warnMetric(
              `${withoutSources} essay prompts have no source rows yet, but ${numberSummary(dispositionSummary, 'sourceGapRows')} source-gap rows have explicit source-search/review/write-blocked dispositions${sourceSearchCampaign.reportFound ? `; ${numberSummary(sourceSearchCampaignSummary, 'sourceSearchPromptRows')} source-search rows are split into ${numberSummary(sourceSearchCampaignSummary, 'emittedSchools')} follow-up school campaigns` : ''}${sourceManualCheck.reportFound ? `; manual checks covered ${numberSummary(sourceManualCheckSummary, 'checkedUrls')} official candidate URLs with ${numberSummary(sourceManualCheckSummary, 'officialContextNoPromptMatchUrls')} official-context/no-match URLs` : ''}${sourceFamilyMismatchReview.reportFound ? `; source-family mismatch review routed ${numberSummary(sourceFamilyMismatchReviewSummary, 'emittedRows')} prompt rows` : ''}${essayReviewQueue.reportFound ? `; reviewer queue packet has ${numberSummary(essayReviewQueueSummary, 'reviewQueueRows')} rows across ${numberSummary(essayReviewQueueSummary, 'schoolsWithReviewRows')} schools` : ''}${sourceApprovalMonitor.reportFound ? `; source approval monitor is ${sourceApprovalMonitor.status ?? 'unknown'} with ${numberSummary(sourceApprovalMonitorSummary, 'pendingRows')} pending hash-only rows` : ''}`,
            )
          : failMetric(`${withoutSources} essay prompts have no source rows`),
    provenance:
      sourceCount > 0
        ? passMetric(`${sourceCount} EssayPromptSource rows available`)
        : failMetric('No EssayPromptSource rows found'),
    conflicts:
      identityConflictRows > 0
        ? identityResolutionClosed
          ? warnMetric(
              `${identityConflictRows} essay prompt identity conflict rows have explicit reviewer resolution dispositions`,
            )
          : warnMetric(
              `${identityConflictRows} essay prompt identity conflict rows require school/prompt review before source approval`,
            )
        : passMetric(
            essayPromptIdentityConflicts.reportFound
              ? 'Essay prompt identity conflict packet found no high-confidence conflicts'
              : 'Prompt conflicts are represented by audit/review status, not direct overwrite',
          ),
    consumerClosure:
      consumerSafety.publicListSourceGate &&
      consumerSafety.publicSingleSourceGate &&
      consumerSafety.publicSchoolSourceGate &&
      consumerSafety.timelineSourceGate
        ? sourceBackedVerifiedCurrent > 0
          ? passMetric(
              `${sourceBackedVerifiedCurrent} source-backed current-year prompts can be served through source-gated public/timeline consumers`,
            )
          : dispositionClosed
            ? warnMetric(
                `Essay public/timeline consumers are source-gated; ${withoutSources} prompts remain hidden until source rows are written or reviewed`,
              )
            : failMetric(
                'Essay public/timeline consumers are source-gated, but 0 source-backed current-year prompts are available',
              )
        : failMetric(
            `Essay prompt consumers missing source gates: ${consumerSafety.missingGates.join(', ')}`,
          ),
    nextAction:
      withoutSources > 0 ||
      categories.needsReview > 0 ||
      categories.conflict > 0
        ? 'review'
        : staleSources > 0
          ? 'refresh'
          : 'accept',
    blockers: [
      ...(essayPromptDisposition.reportFound && !dispositionClosed
        ? [
            `Essay prompt disposition status ${essayPromptDisposition.status ?? 'unknown'} (${formatArtifactSummary(essayPromptDisposition.summary)})`,
          ]
        : []),
      ...(withoutSources > 0 && !dispositionClosed
        ? [`${withoutSources} essay prompts have no source evidence`]
        : []),
      ...(verifiedCurrent > sourceBackedVerifiedCurrent && !dispositionClosed
        ? [
            `${verifiedCurrent - sourceBackedVerifiedCurrent} verified current-year prompts are not source-backed and will be hidden from public/timeline consumers`,
          ]
        : []),
      ...(withoutSources > 0 &&
      !dispositionClosed &&
      !sourceRecovery.reportFound
        ? ['Essay prompt source recovery packet is missing']
        : []),
      ...(withoutSources > 0 &&
      !dispositionClosed &&
      sourceRecovery.reportFound &&
      !sourceValidation.reportFound
        ? ['Essay prompt source validation packet is missing']
        : []),
      ...(withoutSources > 0 &&
      !dispositionClosed &&
      sourceValidation.reportFound &&
      !sourceReviewStaging.reportFound
        ? ['Essay prompt source review staging packet is missing']
        : []),
      ...(withoutSources > 0 &&
      !dispositionClosed &&
      sourceReviewStaging.reportFound &&
      !sourceReviewApproval.reportFound
        ? ['Essay prompt source review approval gate is missing']
        : []),
      ...(withoutSources > 0 &&
      !dispositionClosed &&
      sourceReviewApproval.reportFound &&
      !sourceWritePlan.reportFound
        ? ['Essay prompt source write plan is missing']
        : []),
      ...(withoutSources > 0 &&
      !dispositionClosed &&
      sourceReviewStaging.reportFound &&
      !essayReviewQueue.reportFound
        ? ['Essay prompt review queue packet is missing']
        : []),
      ...(sourceWritePlan.reportFound &&
      sourceWritePlan.status?.startsWith('BLOCKED') &&
      !dispositionClosed
        ? [`Essay prompt source write plan status ${sourceWritePlan.status}`]
        : []),
      ...(identityConflictRows > 0 && !identityResolutionClosed
        ? [
            `Essay prompt identity conflict packet found ${identityConflictRows} high-confidence prompt-school conflict rows`,
          ]
        : []),
      ...(essayPromptIdentityConflictResolution.reportFound &&
      !identityResolutionClosed
        ? [
            `Essay prompt identity conflict resolution status ${essayPromptIdentityConflictResolution.status ?? 'unknown'} (${formatArtifactSummary(essayPromptIdentityConflictResolution.summary)})`,
          ]
        : []),
      ...consumerSafety.missingGates.map(
        (gate) => `Essay prompt consumer source gate missing: ${gate}`,
      ),
      ...(currentYear === 0
        ? [
            `No essay prompts found for application year ${args.applicationYear}`,
          ]
        : []),
    ],
    evidence: [
      'EssayPrompt',
      'EssayPromptSource',
      'EssayPromptAudit',
      ...consumerSafety.evidence,
      ...(sourceRecovery.reportFound
        ? [`essay-prompt-source-recovery:${sourceRecovery.status ?? 'unknown'}`]
        : []),
      ...(sourceValidation.reportFound
        ? [
            `essay-prompt-source-validation:${sourceValidation.status ?? 'unknown'}`,
          ]
        : []),
      ...(sourceSearchCampaign.reportFound
        ? [
            `essay-prompt-source-search-campaign:${sourceSearchCampaign.status ?? 'unknown'}`,
            `essay-prompt-source-search-campaign-prompt-rows:${numberSummary(sourceSearchCampaignSummary, 'sourceSearchPromptRows')}`,
            `essay-prompt-source-search-campaign-schools:${numberSummary(sourceSearchCampaignSummary, 'emittedSchools')}`,
          ]
        : []),
      ...(sourceManualCheck.reportFound
        ? [
            `essay-prompt-source-manual-check:${sourceManualCheck.status ?? 'unknown'}`,
            `essay-prompt-source-manual-check-checked-urls:${numberSummary(sourceManualCheckSummary, 'checkedUrls')}`,
            `essay-prompt-source-manual-check-mismatch-review:${booleanSummary(sourceManualCheckSummary, 'sourceFamilyMismatchReview')}`,
          ]
        : []),
      ...(sourceFamilyMismatchReview.reportFound
        ? [
            `essay-prompt-source-family-mismatch-review:${sourceFamilyMismatchReview.status ?? 'unknown'}`,
            `essay-prompt-source-family-mismatch-review-rows:${numberSummary(sourceFamilyMismatchReviewSummary, 'emittedRows')}`,
            `essay-prompt-source-family-mismatch-review-blocked:${numberSummary(sourceFamilyMismatchReviewSummary, 'blockedRows')}`,
          ]
        : []),
      ...(sourceReviewStaging.reportFound
        ? [
            `essay-prompt-source-review-staging:${sourceReviewStaging.status ?? 'unknown'}`,
          ]
        : []),
      ...(sourceReviewApproval.reportFound
        ? [
            `essay-prompt-source-review-approval:${sourceReviewApproval.status ?? 'unknown'}`,
            `essay-prompt-source-review-approval-reviewer-rows:${numberSummary(sourceReviewApprovalSummary, 'reviewerQueueRows')}`,
            `essay-prompt-source-review-approval-source-rows:${numberSummary(sourceReviewApprovalSummary, 'reviewerQueueSourceRows')}`,
            `essay-prompt-source-review-approval-unconstrained-source-rows:${numberSummary(sourceReviewApprovalSummary, 'unconstrainedReviewerQueueSourceRows')}`,
            `essay-prompt-source-review-approval-review-action-constrained:${booleanSummary(sourceReviewApprovalSummary, 'reviewActionConstraintApplied')}`,
            `essay-prompt-source-review-approval-review-action-eligible-source-rows:${numberSummary(sourceReviewApprovalSummary, 'reviewActionEligibleSourceRows')}`,
            `essay-prompt-source-review-approval-review-action-excluded-source-rows:${numberSummary(sourceReviewApprovalSummary, 'reviewActionExcludedSourceRows')}`,
            `essay-prompt-source-review-approval-request-rows:${numberSummary(sourceReviewApprovalSummary, 'approvalRequestRows')}`,
            `essay-prompt-source-review-approval-request-prompt-ids:${numberSummary(sourceReviewApprovalSummary, 'approvalRequestPromptIds')}`,
            `essay-prompt-source-review-approval-request-source-urls:${numberSummary(sourceReviewApprovalSummary, 'approvalRequestSourceUrls')}`,
          ]
        : []),
      ...(sourceWritePlan.reportFound
        ? [
            `essay-prompt-source-write-plan:${sourceWritePlan.status ?? 'unknown'}`,
            `essay-prompt-source-write-plan-approved-source-rows:${numberSummary(sourceWritePlanSummary, 'approvedSourceRows')}`,
            `essay-prompt-source-write-plan-unique-candidates:${numberSummary(sourceWritePlanSummary, 'uniqueWriteCandidates')}`,
            `essay-prompt-source-write-plan-pending-approval-request-rows:${numberSummary(sourceWritePlanSummary, 'pendingApprovalRequestRows')}`,
            `essay-prompt-source-write-plan-pending-approval-unique-candidates:${numberSummary(sourceWritePlanSummary, 'pendingApprovalUniqueCandidates')}`,
            `essay-prompt-source-write-plan-pending-approval-schema-blocked:${booleanSummary(sourceWritePlanSummary, 'pendingApprovalSchemaBlocked')}`,
          ]
        : []),
      ...(sourceApprovalMonitor.reportFound
        ? [
            `essay-prompt-source-approval-monitor:${sourceApprovalMonitor.status ?? 'unknown'}`,
            `essay-prompt-source-approval-monitor-pending-rows:${numberSummary(sourceApprovalMonitorSummary, 'pendingRows')}`,
            `essay-prompt-source-approval-monitor-approval-request-rows:${numberSummary(sourceApprovalMonitorSummary, 'approvalRequestRows')}`,
            `essay-prompt-source-approval-monitor-write-plan-pending:${numberSummary(sourceApprovalMonitorSummary, 'writePlanPendingApprovalCandidates')}`,
            `essay-prompt-source-approval-monitor-schema-blocked:${booleanSummary(sourceApprovalMonitorSummary, 'writePlanSchemaBlocked')}`,
            `essay-prompt-source-approval-monitor-consumer-gate-closed:${booleanSummary(sourceApprovalMonitorSummary, 'reviewActionConsumerGateClosed')}`,
          ]
        : []),
      ...(essayReviewQueue.reportFound
        ? [
            `essay-prompt-review-queue:${essayReviewQueue.status ?? 'unknown'}`,
            `essay-prompt-review-queue-rows:${numberSummary(essayReviewQueueSummary, 'reviewQueueRows')}`,
            `essay-prompt-review-queue-blocked:${numberSummary(essayReviewQueueSummary, 'blockedRows')}`,
          ]
        : []),
      ...(essayReviewAction.reportFound
        ? [
            `essay-prompt-review-action:${essayReviewAction.status ?? 'unknown'}`,
            `essay-prompt-review-action-outcome:${String(essayReviewActionSummary.recommendedOutcome ?? 'unknown')}`,
            `essay-prompt-review-action-target-rows:${numberSummary(essayReviewActionSummary, 'targetRows')}`,
            `essay-prompt-review-action-selection-offset:${numberSummary(essayReviewActionSummary, 'selectionOffset')}`,
            `essay-prompt-review-action-selection-limit:${numberSummary(essayReviewActionSummary, 'selectionLimit')}`,
            `essay-prompt-review-action-candidate-urls:${numberSummary(essayReviewActionSummary, 'candidateUrls')}`,
            `essay-prompt-review-action-source-recovery-candidate-urls:${numberSummary(essayReviewActionSummary, 'sourceRecoveryCandidateUrls')}`,
            `essay-prompt-review-action-checked-sources:${numberSummary(essayReviewActionSummary, 'checkedSources')}`,
            `essay-prompt-review-action-targets-with-source-recovery-candidates:${numberSummary(essayReviewActionSummary, 'targetsWithSourceRecoveryCandidates')}`,
            `essay-prompt-review-action-targets-without-candidate-urls:${numberSummary(essayReviewActionSummary, 'targetsWithoutCandidateUrls')}`,
            `essay-prompt-review-action-targets-without-checked-sources:${numberSummary(essayReviewActionSummary, 'targetsWithoutCheckedSources')}`,
            `essay-prompt-review-action-targets-with-official-matches:${numberSummary(essayReviewActionSummary, 'targetsWithOfficialPromptMatches')}`,
            `essay-prompt-review-action-targets-with-matched-school-official-matches:${numberSummary(essayReviewActionSummary, 'targetsWithMatchedSchoolOfficialPromptMatches')}`,
            `essay-prompt-review-action-targets-with-cross-school-official-matches:${numberSummary(essayReviewActionSummary, 'targetsWithCrossSchoolOfficialPromptMatches')}`,
            `essay-prompt-review-action-checked-source-target-links:${numberSummary(essayReviewActionSummary, 'checkedSourceTargetLinks')}`,
            `essay-prompt-review-action-all-sources-linked-to-targets:${booleanSummary(essayReviewActionSummary, 'allCheckedSourcesLinkedToTargets')}`,
            `essay-prompt-review-action-official-prompt-matches:${numberSummary(essayReviewActionSummary, 'officialPromptMatches')}`,
            `essay-prompt-review-action-assigned-school-official-matches:${numberSummary(essayReviewActionSummary, 'assignedSchoolOfficialPromptMatches')}`,
            `essay-prompt-review-action-cross-school-official-matches:${numberSummary(essayReviewActionSummary, 'crossSchoolOfficialPromptMatches')}`,
            `essay-prompt-review-action-consumer-gate-closed:${booleanSummary(essayReviewActionSummary, 'consumerGateClosed')}`,
          ]
        : []),
      ...(essayPromptDisposition.reportFound
        ? [
            `essay-prompt-disposition:${essayPromptDisposition.status ?? 'unknown'}`,
            `essay-prompt-disposition-db-schema-blocked-rows:${dispositionDbSchemaBlockedRows}`,
            `essay-prompt-disposition-source-search-rows:${dispositionSourceSearchRows}`,
          ]
        : []),
      ...(essayPromptIdentityConflicts.reportFound
        ? [
            `essay-prompt-identity-conflicts:${essayPromptIdentityConflicts.status ?? 'unknown'}`,
            `essay-prompt-identity-conflicts-conflict-rows:${identityConflictRows}`,
            `essay-prompt-identity-conflicts-review-rows:${identityReviewRows}`,
          ]
        : []),
      ...(essayPromptIdentityConflictResolution.reportFound
        ? [
            `essay-prompt-identity-conflict-resolution:${essayPromptIdentityConflictResolution.status ?? 'unknown'}`,
            `essay-prompt-identity-conflict-resolution-closed:${identityResolutionClosed}`,
            `essay-prompt-identity-conflict-resolution-rows:${numberSummary(identityResolutionSummary, 'emittedRows')}`,
          ]
        : []),
    ],
  };
}

async function auditDeadlinePolicyDomain(
  db: Record<string, any>,
  args: Args,
): Promise<DomainAudit> {
  const [
    deadlineTotal,
    currentDeadlines,
    manualDeadlines,
    scrapedDeadlines,
    policyTotal,
    approvedPolicy,
    expiredPolicy,
    byPolicyStatus,
    byPolicyDimension,
  ] = await Promise.all([
    count(db, 'schoolDeadline'),
    count(db, 'schoolDeadline', { where: { year: args.applicationYear } }),
    count(db, 'schoolDeadline', { where: { source: 'MANUAL' } }),
    count(db, 'schoolDeadline', { where: { source: { not: 'MANUAL' } } }),
    count(db, 'schoolPolicyEvidence'),
    count(db, 'schoolPolicyEvidence', { where: { status: 'APPROVED' } }),
    count(db, 'schoolPolicyEvidence', {
      where: { expiresAt: { lt: new Date() } },
    }),
    group(db, 'schoolPolicyEvidence', 'status'),
    group(db, 'schoolPolicyEvidence', 'policyDimension'),
  ]);
  const categories = emptyBuckets();
  categories.trustedUsable = currentDeadlines + approvedPolicy;
  categories.missingProvenance = manualDeadlines;
  categories.stale = expiredPolicy;
  categories.needsReview =
    (byPolicyStatus.DRAFT ?? 0) + (byPolicyStatus.UNDER_REVIEW ?? 0);
  categories.terminal = byPolicyStatus.REJECTED ?? 0;
  return {
    id: 'deadlines_application_policy',
    label: 'Deadlines, rounds, school policy evidence',
    priority: 'P0',
    source: 'db',
    counts: {
      deadlineTotal,
      currentYear: args.applicationYear,
      currentDeadlines,
      manualDeadlines,
      scrapedDeadlines,
      policyTotal,
      approvedPolicy,
      expiredPolicy,
      byPolicyStatus,
      byPolicyDimension,
    },
    categories,
    coverage: metricFromCount(
      currentDeadlines,
      `current-year SchoolDeadline rows for ${args.applicationYear}`,
    ),
    freshness:
      expiredPolicy === 0
        ? passMetric('No expired policy evidence found')
        : failMetric(
            `${expiredPolicy} approved/draft policy evidence rows are expired`,
          ),
    sourceQuality: ratioMetric(
      scrapedDeadlines + approvedPolicy,
      Math.max(1, deadlineTotal + policyTotal),
      'non-manual deadline/policy evidence proxy',
      0.55,
      0.25,
    ),
    provenance:
      manualDeadlines === 0
        ? passMetric('No manual-only deadlines found')
        : warnMetric(
            `${manualDeadlines} deadline rows are manual-source and need evidence review`,
          ),
    conflicts:
      expiredPolicy > 0
        ? warnMetric(
            'Expired policy evidence can conflict with runtime application analysis',
          )
        : passMetric('No expired policy conflict proxy found'),
    consumerClosure: metricFromCount(
      currentDeadlines,
      'timeline/dashboard/application-analysis deadline proxy',
    ),
    nextAction:
      expiredPolicy > 0
        ? 'refresh'
        : manualDeadlines > 0 || categories.needsReview > 0
          ? 'review'
          : 'accept',
    blockers: [
      ...(currentDeadlines === 0
        ? [`No current-year SchoolDeadline rows for ${args.applicationYear}`]
        : []),
      ...(expiredPolicy > 0
        ? [`${expiredPolicy} SchoolPolicyEvidence rows are expired`]
        : []),
    ],
    evidence: [
      'SchoolDeadline',
      'SchoolPolicyEvidence',
      'APPLICATION_ANALYSIS_WORKFLOW_SOP.md',
    ],
  };
}

async function auditProfileDomain(
  db: Record<string, any>,
  args: Args,
): Promise<DomainAudit> {
  const [
    profiles,
    gpaProfiles,
    nationalityProfiles,
    testScoreProfiles,
    activityProfiles,
    linkedActivityProfiles,
    awardProfiles,
    linkedAwardProfiles,
    educationProfiles,
    semesterGpaProfiles,
    schoolListItems,
    schoolListMissingRound,
    timelines,
  ] = await Promise.all([
    count(db, 'profile'),
    count(db, 'profile', { where: { gpa: { not: null } } }),
    count(db, 'profile', { where: { nationality: { not: null } } }),
    distinctCount(db, 'testScore', 'profileId'),
    distinctCount(db, 'activity', 'profileId'),
    distinctCount(db, 'activity', 'profileId', {
      where: { activityTemplateId: { not: null } },
    }),
    distinctCount(db, 'award', 'profileId'),
    distinctCount(db, 'award', 'profileId', {
      where: { competitionId: { not: null } },
    }),
    distinctCount(db, 'education', 'profileId'),
    distinctCount(db, 'semesterGpa', 'profileId'),
    count(db, 'schoolListItem'),
    count(db, 'schoolListItem', { where: { round: null } }),
    count(db, 'applicationTimeline'),
  ]);
  const readinessDelivery = auditReadinessDeliveryEvidence();
  const readinessDisposition = readClosureArtifact(
    'profile_readiness_disposition',
    args.profileReadinessDisposition ??
      findLatestClosureReport(/^profile-readiness-disposition-.+\.json$/),
  );
  const readinessConsumerClosure = readClosureArtifact(
    'profile_readiness_consumer_closure',
    args.profileReadinessConsumerClosure ??
      findLatestClosureReport(/^profile-readiness-consumer-closure-.+\.json$/),
  );
  const readinessDeliveryMonitor = readClosureArtifact(
    'profile_readiness_delivery_monitor',
    args.profileReadinessDeliveryMonitor ??
      findLatestClosureReport(/^profile-readiness-delivery-monitor-.+\.json$/),
  );
  const readinessTargetDeliveryMonitor = readClosureArtifacts(
    'profile_readiness_target_delivery_monitor',
    args.profileReadinessTargetDeliveryMonitor,
    findLatestClosureReport(
      /^profile-readiness-target-delivery-monitor-.+\.json$/,
    ),
  );
  const readinessCampaignStackMonitor = readClosureArtifact(
    'profile_readiness_campaign_stack_monitor',
    args.profileReadinessCampaignStackMonitor ??
      findLatestClosureReport(
        /^profile-readiness-campaign-stack-monitor-.+\.json$/,
      ),
  );
  const readinessTimelineSourceClosure = readClosureArtifact(
    'profile_readiness_timeline_source_closure',
    args.profileReadinessTimelineSourceClosure ??
      findLatestClosureReport(
        /^profile-readiness-timeline-source-closure-.+\.json$/,
      ),
  );
  const readinessTimelineSourceAction = readClosureArtifact(
    'profile_readiness_timeline_source_action',
    args.profileReadinessTimelineSourceAction ??
      findLatestClosureReport(
        /^profile-readiness-timeline-source-action-.+\.json$/,
      ),
  );
  const dispositionSummary = objectSummary(readinessDisposition.summary);
  const consumerClosureSummary = objectSummary(
    readinessConsumerClosure.summary,
  );
  const deliveryMonitorSummary = objectSummary(
    readinessDeliveryMonitor.summary,
  );
  const targetDeliveryMonitorSummary = objectSummary(
    readinessTargetDeliveryMonitor.summary,
  );
  const targetDeliveryMonitorGroups = summaryStringList(
    targetDeliveryMonitorSummary,
    'targetCampaignGroups',
  );
  const targetDeliveryMonitorGroupLabel =
    targetDeliveryMonitorGroups.length > 0
      ? targetDeliveryMonitorGroups.join(',')
      : String(targetDeliveryMonitorSummary.topCampaignGroup ?? 'unknown');
  const campaignStackMonitorSummary = objectSummary(
    readinessCampaignStackMonitor.summary,
  );
  const timelineSourceClosureSummary = objectSummary(
    readinessTimelineSourceClosure.summary,
  );
  const timelineSourceActionSummary = objectSummary(
    readinessTimelineSourceAction.summary,
  );
  const dispositionClosed =
    readinessDisposition.reportFound &&
    normalizeArtifactStatus(readinessDisposition.status) ===
      'READINESS_DISPOSITION_PACKET_READY' &&
    booleanSummary(dispositionSummary, 'allOpenRowsHaveDisposition') ===
      'true' &&
    numberSummary(dispositionSummary, 'unmappedRows') === 0 &&
    numberSummary(dispositionSummary, 'blockedRows') === 0;
  const readinessConsumerClosureClosed =
    readinessConsumerClosure.reportFound &&
    [
      'READINESS_CONSUMER_CLOSURE_READY',
      'READINESS_CONSUMER_CLOSURE_REVIEW',
    ].includes(normalizeArtifactStatus(readinessConsumerClosure.status)) &&
    numberSummary(consumerClosureSummary, 'failedChecks') === 0;
  const readinessDeliveryMonitorClosed =
    readinessDeliveryMonitor.reportFound &&
    [
      'READINESS_DELIVERY_MONITOR_ACTIVE',
      'READINESS_DELIVERY_MONITOR_COMPLETE',
    ].includes(normalizeArtifactStatus(readinessDeliveryMonitor.status)) &&
    numberSummary(deliveryMonitorSummary, 'failedChecks') === 0;
  const readinessTimelineSourceClosureClosed =
    readinessTimelineSourceClosure.reportFound &&
    [
      'PROFILE_READINESS_TIMELINE_SOURCE_CLOSURE_READY',
      'PROFILE_READINESS_TIMELINE_SOURCE_CLOSURE_REVIEW',
    ].includes(
      normalizeArtifactStatus(readinessTimelineSourceClosure.status),
    ) &&
    numberSummary(timelineSourceClosureSummary, 'blockedRows') === 0 &&
    booleanSummary(
      timelineSourceClosureSummary,
      'allRowsHaveConsumerPolicy',
    ) === 'true';
  const readinessDeliveryClosed =
    readinessDelivery.reportFound &&
    readinessDelivery.rows > 0 &&
    readinessDelivery.blockedRows === 0 &&
    readinessDelivery.includesUserIds === false &&
    readinessDelivery.endpointExists &&
    readinessDelivery.serviceExists &&
    readinessDelivery.sharedRouteExists &&
    readinessDelivery.userReadinessEndpointExists &&
    readinessDelivery.schoolListAddFirstConsumerAligned;
  const signalSlots = profiles * 6;
  const filledSignals =
    gpaProfiles +
    nationalityProfiles +
    testScoreProfiles +
    activityProfiles +
    awardProfiles +
    educationProfiles;
  const categories = emptyBuckets();
  categories.trustedUsable = filledSignals;
  categories.needsReview = Math.max(0, signalSlots - filledSignals);
  categories.missingConsumerVerification =
    schoolListMissingRound +
    numberSummary(timelineSourceClosureSummary, 'blockedRows') +
    (readinessDeliveryClosed &&
    readinessConsumerClosureClosed &&
    readinessTimelineSourceClosureClosed
      ? 0
      : profiles);
  const timelineRatio = timelines / Math.max(1, schoolListItems);
  const blockers: string[] = [];
  if (profiles > 0 && gpaProfiles === 0) {
    blockers.push('No profiles have GPA anchors');
  }
  if (!readinessDelivery.userReadinessEndpointExists) {
    blockers.push('Profile readiness user endpoint is missing');
  }
  if (!readinessDelivery.schoolListAddFirstConsumerAligned) {
    blockers.push(
      'Profile readiness consumer does not expose school_list.add_first',
    );
  }
  if (
    readinessTimelineSourceClosure.reportFound &&
    numberSummary(timelineSourceClosureSummary, 'blockedRows') > 0
  ) {
    blockers.push(
      `Profile readiness timeline/source closure has ${numberSummary(timelineSourceClosureSummary, 'blockedRows')} blocked consumer rows`,
    );
  }
  return {
    id: 'applicant_profile_readiness',
    label: 'Applicant profile readiness, school list, timeline coverage',
    priority: 'P0',
    source: 'db',
    counts: {
      profiles,
      gpaProfiles,
      nationalityProfiles,
      testScoreProfiles,
      activityProfiles,
      linkedActivityProfiles,
      awardProfiles,
      linkedAwardProfiles,
      educationProfiles,
      semesterGpaProfiles,
      schoolListItems,
      schoolListMissingRound,
      timelines,
      signalSlots,
      filledSignals,
      readinessDelivery,
      readinessDisposition,
      readinessConsumerClosure,
      readinessDeliveryMonitor,
      readinessTargetDeliveryMonitor,
      readinessCampaignStackMonitor,
      readinessTimelineSourceClosure,
      readinessTimelineSourceAction,
    },
    categories,
    coverage: ratioMetric(
      filledSignals,
      Math.max(1, signalSlots),
      'profile signal fill slots',
      0.75,
      0.45,
    ),
    freshness: unknownMetric(
      'Profile data is runtime user-entered; freshness is not date-gated here',
    ),
    sourceQuality: passMetric('Profile data is first-party user-entered'),
    provenance: dispositionClosed
      ? passMetric(
          `${numberSummary(dispositionSummary, 'dispositionRows')} open first-party readiness rows have explicit user/operator/system dispositions`,
        )
      : warnMetric(
          'Profile completeness has readiness signals, but missing first-party gaps still need an explicit disposition packet',
        ),
    conflicts:
      schoolListMissingRound > 0
        ? warnMetric(
            `${schoolListMissingRound} school-list items have no application round`,
          )
        : passMetric('School-list round coverage proxy is clean'),
    consumerClosure:
      readinessDeliveryClosed &&
      dispositionClosed &&
      readinessConsumerClosureClosed &&
      readinessDeliveryMonitorClosed &&
      readinessTimelineSourceClosureClosed &&
      timelineRatio < 0.8
        ? warnMetric(
            `Readiness delivery, disposition, consumer-closure, delivery monitor, and timeline/source packets are consumable (${readinessDelivery.rows} delivery rows, ${numberSummary(dispositionSummary, 'dispositionRows')} disposition rows, ${numberSummary(consumerClosureSummary, 'passedChecks')}/${numberSummary(consumerClosureSummary, 'totalChecks')} consumer checks, ${numberSummary(deliveryMonitorSummary, 'pendingRows')} monitored pending rows, ${numberSummary(timelineSourceClosureSummary, 'totalRows')} timeline/source rows); timeline proxy remains ${timelines}/${Math.max(1, schoolListItems)}${readinessCampaignStackMonitor.reportFound ? `; campaign stack monitor tracks ${numberSummary(campaignStackMonitorSummary, 'trackedGroups')} groups with ${numberSummary(campaignStackMonitorSummary, 'readyParallelUserPromptGroups')} ready parallel user-prompt groups` : ''}${readinessTargetDeliveryMonitor.reportFound ? `; target delivery monitor covers ${targetDeliveryMonitorGroupLabel} with ${numberSummary(targetDeliveryMonitorSummary, 'pendingRows')} pending rows` : ''}`,
          )
        : readinessDeliveryClosed &&
            dispositionClosed &&
            readinessConsumerClosureClosed &&
            readinessDeliveryMonitorClosed &&
            readinessTimelineSourceClosureClosed
          ? passMetric(
              `Readiness delivery, disposition, consumer-closure, delivery monitor, and timeline/source packets are consumable; timeline proxy is ${timelines}/${Math.max(1, schoolListItems)}`,
            )
          : readinessDeliveryClosed &&
              dispositionClosed &&
              readinessConsumerClosureClosed &&
              readinessDeliveryMonitorClosed
            ? warnMetric(
                `Readiness delivery, disposition, and consumer-closure packets are consumable, but timeline/source closure is missing or blocked (${numberSummary(timelineSourceClosureSummary, 'blockedRows')} blocked rows)`,
              )
            : readinessDeliveryClosed &&
                dispositionClosed &&
                readinessConsumerClosureClosed
              ? warnMetric(
                  `Readiness delivery, disposition, and consumer-closure packets are consumable, but delivery monitor is missing or blocked (${readinessDeliveryMonitor.status ?? 'missing'})`,
                )
              : readinessDeliveryClosed && dispositionClosed
                ? warnMetric(
                    'Readiness admin delivery and disposition packets are consumable, but consumer-closure packet is missing or blocked',
                  )
                : readinessDeliveryClosed
                  ? warnMetric(
                      `Readiness admin delivery surface is consumable (${readinessDelivery.rows} rows, ${readinessDelivery.blockedRows} blocked), but disposition packet is missing or blocked`,
                    )
                  : ratioMetric(
                      timelines,
                      Math.max(1, schoolListItems),
                      'timeline rows per school-list item proxy',
                      0.8,
                      0.45,
                    ),
    nextAction:
      schoolListMissingRound > 0 || categories.needsReview > 0
        ? dispositionClosed
          ? 'review'
          : 'backfill'
        : 'accept',
    blockers,
    evidence: [
      'ProfileReadinessService',
      'GET /profiles/me/readiness',
      'GET /admin/profile-readiness/delivery-package',
      'profile-readiness-admin-delivery-*.json',
      'profile-readiness-disposition-*.json',
      'profile-readiness-consumer-closure-*.json',
      'profile-readiness-delivery-monitor-*.json',
      'profile-readiness-target-delivery-monitor-*.json',
      'profile-readiness-campaign-stack-monitor-*.json',
      'profile-readiness-timeline-source-closure-*.json',
      'profile-readiness-timeline-source-action-*.json',
      ...(readinessConsumerClosure.reportFound
        ? [
            `profile-readiness-consumer-closure:${readinessConsumerClosure.status ?? 'unknown'}`,
            `profile-readiness-consumer-closure-top-campaign:${String(consumerClosureSummary.topCampaignGroup ?? 'unknown')}`,
            `profile-readiness-consumer-closure-top-campaign-delivery-rows:${numberSummary(consumerClosureSummary, 'topCampaignDeliveryRows')}`,
            `profile-readiness-consumer-closure-top-campaign-ready-rows:${numberSummary(consumerClosureSummary, 'topCampaignReadyRows')}`,
            `profile-readiness-consumer-closure-top-campaign-anonymized:${booleanSummary(consumerClosureSummary, 'topCampaignAnonymized')}`,
          ]
        : []),
      ...(readinessDeliveryMonitor.reportFound
        ? [
            `profile-readiness-delivery-monitor:${readinessDeliveryMonitor.status ?? 'unknown'}`,
            `profile-readiness-delivery-monitor-top-campaign:${String(deliveryMonitorSummary.topCampaignGroup ?? 'unknown')}`,
            `profile-readiness-delivery-monitor-pending-rows:${numberSummary(deliveryMonitorSummary, 'pendingRows')}`,
            `profile-readiness-delivery-monitor-ready-preview-rows:${numberSummary(deliveryMonitorSummary, 'readyPreviewRows')}`,
            `profile-readiness-delivery-monitor-unique-preview-recipients:${numberSummary(deliveryMonitorSummary, 'uniquePreviewRecipients')}`,
            `profile-readiness-delivery-monitor-anonymized:${booleanSummary(deliveryMonitorSummary, 'topCampaignAnonymized')}`,
          ]
        : []),
      ...(readinessTargetDeliveryMonitor.reportFound
        ? [
            `profile-readiness-target-delivery-monitor:${readinessTargetDeliveryMonitor.status ?? 'unknown'}`,
            `profile-readiness-target-delivery-monitor-groups:${targetDeliveryMonitorGroupLabel}`,
            `profile-readiness-target-delivery-monitor-selection:${summaryStringList(targetDeliveryMonitorSummary, 'targetMonitorSelectionSources').join(',') || String(targetDeliveryMonitorSummary.campaignSelectionSource ?? 'unknown')}`,
            `profile-readiness-target-delivery-monitor-pending-rows:${numberSummary(targetDeliveryMonitorSummary, 'pendingRows')}`,
            `profile-readiness-target-delivery-monitor-ready-preview-rows:${numberSummary(targetDeliveryMonitorSummary, 'readyPreviewRows')}`,
            `profile-readiness-target-delivery-monitor-anonymized:${booleanSummary(targetDeliveryMonitorSummary, 'topCampaignAnonymized')}`,
            `profile-readiness-target-delivery-monitor-anonymized-failures:${numberSummary(targetDeliveryMonitorSummary, 'targetMonitorAnonymizedFailures')}`,
            `profile-readiness-target-delivery-monitor-failed-checks:${numberSummary(targetDeliveryMonitorSummary, 'failedChecks')}`,
          ]
        : []),
      ...(readinessCampaignStackMonitor.reportFound
        ? [
            `profile-readiness-campaign-stack-monitor:${readinessCampaignStackMonitor.status ?? 'unknown'}`,
            `profile-readiness-campaign-stack-monitor-tracked-groups:${numberSummary(campaignStackMonitorSummary, 'trackedGroups')}`,
            `profile-readiness-campaign-stack-monitor-monitored-groups:${numberSummary(campaignStackMonitorSummary, 'monitoredCampaignGroups')}`,
            `profile-readiness-campaign-stack-monitor-target-monitored-groups:${numberSummary(campaignStackMonitorSummary, 'targetMonitoredGroups')}`,
            `profile-readiness-campaign-stack-monitor-unmonitored-groups:${numberSummary(campaignStackMonitorSummary, 'unmonitoredCampaignGroups')}`,
            `profile-readiness-campaign-stack-monitor-ready-parallel-groups:${numberSummary(campaignStackMonitorSummary, 'readyParallelUserPromptGroups')}`,
            `profile-readiness-campaign-stack-monitor-ready-unmonitored-parallel-groups:${numberSummary(campaignStackMonitorSummary, 'readyUnmonitoredParallelUserPromptGroups')}`,
            `profile-readiness-campaign-stack-monitor-ready-unmonitored-parallel-rows:${numberSummary(campaignStackMonitorSummary, 'readyUnmonitoredParallelUserPromptRows')}`,
            `profile-readiness-campaign-stack-monitor-active-group:${String(campaignStackMonitorSummary.activeTopCampaignGroup ?? 'unknown')}`,
            `profile-readiness-campaign-stack-monitor-next-parallel-group:${String(campaignStackMonitorSummary.nextParallelReadyGroup ?? 'none')}`,
            `profile-readiness-campaign-stack-monitor-failed-checks:${numberSummary(campaignStackMonitorSummary, 'failedChecks')}`,
          ]
        : []),
      ...(readinessTimelineSourceClosure.reportFound
        ? [
            `profile-readiness-timeline-source-closure:${readinessTimelineSourceClosure.status ?? 'unknown'}`,
            `profile-readiness-timeline-source-closure-rows:${numberSummary(timelineSourceClosureSummary, 'totalRows')}`,
            `profile-readiness-timeline-source-closure-blocked:${numberSummary(timelineSourceClosureSummary, 'blockedRows')}`,
          ]
        : []),
      ...(readinessTimelineSourceAction.reportFound
        ? [
            `profile-readiness-timeline-source-action:${readinessTimelineSourceAction.status ?? 'unknown'}`,
            `profile-readiness-timeline-source-action-outcome:${String(timelineSourceActionSummary.recommendedOutcome ?? 'unknown')}`,
            `profile-readiness-timeline-source-action-candidates:${numberSummary(timelineSourceActionSummary, 'sourceBackedPromptCandidates')}`,
            `profile-readiness-timeline-source-action-deadline-rows:${numberSummary(timelineSourceActionSummary, 'deadlineRows')}`,
            `profile-readiness-timeline-source-action-deadline-source-url-candidates:${numberSummary(timelineSourceActionSummary, 'deadlineSourceUrlCandidateRows')}`,
            `profile-readiness-timeline-source-action-deadline-missing-source-url:${numberSummary(timelineSourceActionSummary, 'deadlineMissingSourceUrlRows')}`,
            `profile-readiness-timeline-source-action-deadline-fallback-rows:${numberSummary(timelineSourceActionSummary, 'deadlineFallbackRows')}`,
            `profile-readiness-timeline-source-action-metadata-fallback-rows:${numberSummary(timelineSourceActionSummary, 'metadataFallbackRows')}`,
            `profile-readiness-timeline-source-action-default-deadline-fallback-rows:${numberSummary(timelineSourceActionSummary, 'defaultDeadlineFallbackRows')}`,
            `profile-readiness-timeline-source-action-school-list-essay-count-rows:${numberSummary(timelineSourceActionSummary, 'schoolListEssayCountRows')}`,
            `profile-readiness-timeline-source-action-school-list-essay-count-source-backed-rows:${numberSummary(timelineSourceActionSummary, 'schoolListEssayCountRowsWithSourceBacked')}`,
            `profile-readiness-timeline-source-action-school-list-essay-count-zero-source-backed-rows:${numberSummary(timelineSourceActionSummary, 'schoolListEssayCountRowsWithZeroSourceBacked')}`,
            `profile-readiness-timeline-source-action-global-event-rows:${numberSummary(timelineSourceActionSummary, 'globalEventRows')}`,
            `profile-readiness-timeline-source-action-global-event-missing-url-rows:${numberSummary(timelineSourceActionSummary, 'globalEventRowsMissingUrl')}`,
            `profile-readiness-timeline-source-action-global-event-with-url-rows:${numberSummary(timelineSourceActionSummary, 'globalEventRowsWithUrl')}`,
          ]
        : []),
    ],
  };
}

function auditReadinessDeliveryEvidence(): ReadinessDeliveryEvidence {
  const empty: ReadinessDeliveryEvidence = {
    reportFound: false,
    reportName: null,
    rows: 0,
    blockedRows: 0,
    includesUserIds: null,
    endpointExists: fs.existsSync(
      path.join(
        API_ROOT,
        'src',
        'modules',
        'admin',
        'admin-profile-readiness-delivery.controller.ts',
      ),
    ),
    serviceExists: fs.existsSync(
      path.join(
        API_ROOT,
        'src',
        'modules',
        'admin',
        'admin-profile-readiness-delivery.service.ts',
      ),
    ),
    sharedRouteExists: fileContains(
      path.resolve(
        API_ROOT,
        '..',
        '..',
        'packages',
        'shared',
        'src',
        'constants',
        'api-routes.ts',
      ),
      'profileReadinessDeliveryPackage',
    ),
    userReadinessEndpointExists:
      fileContains(
        path.join(
          API_ROOT,
          'src',
          'modules',
          'profile',
          'profile.controller.ts',
        ),
        "Get('me/readiness')",
      ) &&
      fileContains(
        path.resolve(
          API_ROOT,
          '..',
          '..',
          'packages',
          'shared',
          'src',
          'constants',
          'api-routes.ts',
        ),
        'readiness: ()',
      ),
    schoolListAddFirstConsumerAligned:
      fileContains(
        path.join(
          API_ROOT,
          'src',
          'modules',
          'profile',
          'profile-readiness.service.ts',
        ),
        'school_list.add_first',
      ) &&
      !fileContains(
        path.join(
          API_ROOT,
          'src',
          'modules',
          'profile',
          'profile-readiness.service.ts',
        ),
        "schoolList.length === 0 ? ['school_list.min_count']",
      ),
  };

  if (!fs.existsSync(REPORT_ROOT)) return empty;
  const reports = fs
    .readdirSync(REPORT_ROOT)
    .filter(
      (name) =>
        name.startsWith('profile-readiness-admin-delivery-') &&
        name.endsWith('.json'),
    )
    .map((name) => {
      const reportPath = path.join(REPORT_ROOT, name);
      return { name, reportPath, mtimeMs: fs.statSync(reportPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));
  const latest = reports[0];
  if (!latest) return empty;

  try {
    const report = JSON.parse(fs.readFileSync(latest.reportPath, 'utf8')) as {
      rows?: Array<{ status?: string }>;
      privacy?: { includesUserIds?: boolean };
      summary?: { byStatus?: Record<string, number>; openRows?: number };
    };
    const rows = Array.isArray(report.rows) ? report.rows : [];
    return {
      ...empty,
      reportFound: true,
      reportName: latest.name,
      rows: rows.length || Number(report.summary?.openRows ?? 0),
      blockedRows:
        Number(report.summary?.byStatus?.blocked_missing_copy ?? 0) ||
        rows.filter((row) => row.status === 'blocked_missing_copy').length,
      includesUserIds:
        typeof report.privacy?.includesUserIds === 'boolean'
          ? report.privacy.includesUserIds
          : null,
    };
  } catch {
    return {
      ...empty,
      reportFound: true,
      reportName: latest.name,
    };
  }
}

function fileContains(filePath: string, needle: string) {
  try {
    return fs.readFileSync(filePath, 'utf8').includes(needle);
  } catch {
    return false;
  }
}

function inspectEssayPromptConsumerSafety() {
  const servicePath = path.join(
    API_ROOT,
    'src',
    'modules',
    'essay',
    'essay-prompt.service.ts',
  );
  const controllerPath = path.join(
    API_ROOT,
    'src',
    'modules',
    'essay',
    'essay-prompt.controller.ts',
  );
  const timelinePath = path.join(
    API_ROOT,
    'src',
    'modules',
    'timeline',
    'timeline-application.service.ts',
  );
  const serviceText = safeReadText(servicePath);
  const controllerText = safeReadText(controllerPath);
  const timelineText = safeReadText(timelinePath);

  const publicListSourceGate =
    serviceText.includes('findAllPublic') &&
    serviceText.includes('requireSourceEvidence: true') &&
    controllerText.includes('findAllPublic(query)');
  const publicSingleSourceGate =
    serviceText.includes('findOnePublic') &&
    serviceText.includes('SOURCE_BACKED_PROMPT_WHERE') &&
    serviceText.includes('status: EssayStatus.VERIFIED');
  const publicSchoolSourceGate =
    serviceText.includes('async findBySchool') &&
    serviceText.includes('...SOURCE_BACKED_PROMPT_WHERE');
  const timelineSourceGate =
    timelineText.includes("status: 'VERIFIED'") &&
    timelineText.includes('sources: { some: { sourceUrl: { not: null } } }');
  const gateMap = {
    publicListSourceGate,
    publicSingleSourceGate,
    publicSchoolSourceGate,
    timelineSourceGate,
  };
  const missingGates = Object.entries(gateMap)
    .filter(([, present]) => !present)
    .map(([gate]) => gate);

  return {
    ...gateMap,
    missingGates,
    evidence: [
      `essay-public-list-source-gate=${publicListSourceGate}`,
      `essay-public-single-source-gate=${publicSingleSourceGate}`,
      `essay-public-school-source-gate=${publicSchoolSourceGate}`,
      `timeline-essay-prompt-source-gate=${timelineSourceGate}`,
    ],
  };
}

function safeReadText(filePath: string) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function auditCaseOutcomeDomain(
  db: Record<string, any>,
  args: Args,
): Promise<DomainAudit> {
  const [
    cases,
    verifiedCases,
    casesWithEvidence,
    byReviewStatus,
    outcomeLabels,
    labelByStatus,
    labelsWithEvidence,
    verificationRequests,
    verificationByStatus,
    predictionFeedback,
  ] = await Promise.all([
    count(db, 'admissionCase'),
    count(db, 'admissionCase', { where: { isVerified: true } }),
    count(db, 'admissionCase', {
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
    group(db, 'admissionCase', 'reviewStatus'),
    count(db, 'predictionOutcomeLabelRecord'),
    group(db, 'predictionOutcomeLabelRecord', 'status'),
    count(db, 'predictionOutcomeLabelRecord', {
      where: { evidenceUrl: { not: null } },
    }),
    count(db, 'verificationRequest'),
    group(db, 'verificationRequest', 'status'),
    count(db, 'predictionFeedback'),
  ]);
  const casesOutcomesDisposition = readClosureArtifact(
    'cases_outcomes_disposition',
    args.casesOutcomesDisposition ??
      findLatestClosureReport(/^cases-outcomes-disposition-.+\.json$/),
  );
  const dispositionSummary = objectSummary(casesOutcomesDisposition.summary);
  const closureStateSummary = objectSummary(dispositionSummary.byClosureState);
  const dispositionClosed =
    casesOutcomesDisposition.reportFound &&
    normalizeArtifactStatus(casesOutcomesDisposition.status) ===
      'CASES_OUTCOMES_DISPOSITION_READY' &&
    booleanSummary(dispositionSummary, 'allRowsHaveDisposition') === 'true' &&
    numberSummary(dispositionSummary, 'unmappedRows') === 0 &&
    numberSummary(dispositionSummary, 'blockedRows') === 0;
  const dispositionReviewRows =
    numberSummary(closureStateSummary, 'review') +
    numberSummary(closureStateSummary, 'conflict');
  const dispositionConflictRows = numberSummary(
    closureStateSummary,
    'conflict',
  );
  const dispositionTerminalRows = numberSummary(
    closureStateSummary,
    'terminal',
  );
  const dispositionMissingProvenanceCases = numberSummary(
    dispositionSummary,
    'missingProvenanceCases',
  );
  const categories = emptyBuckets();
  categories.trustedUsable = dispositionClosed
    ? numberSummary(closureStateSummary, 'trusted')
    : verifiedCases + labelsWithEvidence;
  categories.needsReview = dispositionClosed
    ? dispositionReviewRows
    : (byReviewStatus.PENDING_REVIEW ?? 0) + (labelByStatus.SELF_REPORTED ?? 0);
  categories.missingProvenance = dispositionClosed
    ? dispositionMissingProvenanceCases
    : Math.max(0, cases - casesWithEvidence);
  categories.conflict = dispositionClosed
    ? dispositionConflictRows
    : (labelByStatus.CONFLICTED ?? 0);
  categories.terminal = dispositionClosed
    ? dispositionTerminalRows
    : (byReviewStatus.REJECTED ?? 0) + (verificationByStatus.REJECTED ?? 0);
  const dispositionBlockers =
    casesOutcomesDisposition.reportFound && !dispositionClosed
      ? [
          `Cases/outcomes disposition status ${casesOutcomesDisposition.status ?? 'unknown'} (${formatArtifactSummary(casesOutcomesDisposition.summary)})`,
        ]
      : [];
  return {
    id: 'cases_outcomes_feedback',
    label: 'Admission cases, outcome labels, verification, feedback',
    priority: 'P0',
    source: 'db',
    counts: {
      cases,
      verifiedCases,
      casesWithEvidence,
      byReviewStatus,
      outcomeLabels,
      labelByStatus,
      labelsWithEvidence,
      verificationRequests,
      verificationByStatus,
      predictionFeedback,
      casesOutcomesDisposition,
    },
    categories,
    coverage: metricFromCount(cases, 'admission cases'),
    freshness: unknownMetric(
      'Cases are cycle-scoped; this pass does not apply a global stale date',
    ),
    sourceQuality: ratioMetric(
      verifiedCases,
      Math.max(1, cases),
      'verified admission cases',
      0.4,
      0.1,
    ),
    provenance: dispositionClosed
      ? dispositionMissingProvenanceCases > 0
        ? warnMetric(
            `${numberSummary(dispositionSummary, 'emittedRows')} case/outcome/verification/feedback rows have explicit dispositions; ${dispositionMissingProvenanceCases} case rows still need provenance or review`,
          )
        : passMetric(
            `${numberSummary(dispositionSummary, 'emittedRows')} case/outcome/verification/feedback rows have explicit dispositions`,
          )
      : ratioMetric(
          casesWithEvidence,
          Math.max(1, cases),
          'cases with source/evidence proxy',
          0.75,
          0.45,
        ),
    conflicts:
      dispositionClosed && dispositionConflictRows > 0
        ? warnMetric(
            `${dispositionConflictRows} case/outcome rows have explicit conflict dispositions`,
          )
        : (labelByStatus.CONFLICTED ?? 0) > 0
          ? failMetric(
              `${labelByStatus.CONFLICTED} outcome labels are conflicted`,
            )
          : passMetric('No conflicted outcome labels found'),
    consumerClosure: dispositionClosed
      ? passMetric(
          'Cases/outcomes disposition packet confirms diagnostic-only consumer policy and no auto-calibration',
        )
      : warnMetric(
          'Outcome data is diagnostic only and must not auto-calibrate prediction',
        ),
    nextAction:
      categories.needsReview > 0 || categories.conflict > 0
        ? 'review'
        : 'accept',
    blockers: [
      ...dispositionBlockers,
      ...((labelByStatus.CONFLICTED ?? 0) > 0 && !dispositionClosed
        ? [`${labelByStatus.CONFLICTED} conflicted outcome labels`]
        : []),
    ],
    evidence: [
      'PREDICTION_CLOSED_LOOP_SOP.md',
      'ADR-0020 no-sample calibration',
      ...(casesOutcomesDisposition.reportFound
        ? [
            `cases_outcomes_disposition: ${casesOutcomesDisposition.status ?? 'unknown'}`,
          ]
        : []),
    ],
  };
}

async function auditAiMemoryDomain(
  db: Record<string, any>,
  args: Args,
): Promise<DomainAudit> {
  const [
    conversations,
    messages,
    memories,
    memoriesNoExpiry,
    memoryByType,
    memoryByCategory,
    preferences,
    routeEmbeddings,
  ] = await Promise.all([
    count(db, 'agentConversation'),
    count(db, 'agentMessage'),
    count(db, 'memory'),
    count(db, 'memory', { where: { expiresAt: null } }),
    group(db, 'memory', 'type'),
    group(db, 'memory', 'category'),
    count(db, 'userAIPreference'),
    count(db, 'agentRouteEmbedding'),
  ]);
  const aiMemoryDisposition = readClosureArtifact(
    'ai_memory_disposition',
    args.aiMemoryDisposition ??
      findLatestClosureReport(/^ai-memory-disposition-.+\.json$/),
  );
  const dispositionSummary = objectSummary(aiMemoryDisposition.summary);
  const closureStateSummary = objectSummary(dispositionSummary.byClosureState);
  const dispositionClosed =
    aiMemoryDisposition.reportFound &&
    normalizeArtifactStatus(aiMemoryDisposition.status) ===
      'AI_MEMORY_DISPOSITION_READY' &&
    booleanSummary(dispositionSummary, 'allRowsHaveDisposition') === 'true' &&
    numberSummary(dispositionSummary, 'unmappedRows') === 0 &&
    numberSummary(dispositionSummary, 'blockedRows') === 0;
  const dispositionReviewRows =
    numberSummary(closureStateSummary, 'review') +
    numberSummary(closureStateSummary, 'conflict');
  const dispositionTerminalRows = numberSummary(
    closureStateSummary,
    'terminal',
  );
  const missingConsentRows = numberSummary(
    dispositionSummary,
    'missingConsentRows',
  );
  const missingProvenanceRows = numberSummary(
    dispositionSummary,
    'missingProvenanceRows',
  );
  const highSensitivityRows = numberSummary(
    dispositionSummary,
    'highSensitivityRows',
  );
  const conflictDispositionRows = numberSummary(
    closureStateSummary,
    'conflict',
  );
  const categories = emptyBuckets();
  categories.trustedUsable = dispositionClosed
    ? numberSummary(closureStateSummary, 'trusted') +
      conversations +
      preferences +
      routeEmbeddings
    : conversations + preferences + routeEmbeddings;
  categories.needsReview = dispositionClosed
    ? dispositionReviewRows
    : memoriesNoExpiry;
  categories.missingProvenance = dispositionClosed
    ? missingProvenanceRows + missingConsentRows
    : memories;
  categories.conflict = dispositionClosed ? conflictDispositionRows : 0;
  categories.terminal = dispositionClosed ? dispositionTerminalRows : 0;
  const dispositionBlockers =
    aiMemoryDisposition.reportFound && !dispositionClosed
      ? [
          `AI memory disposition status ${aiMemoryDisposition.status ?? 'unknown'} (${formatArtifactSummary(aiMemoryDisposition.summary)})`,
        ]
      : [];
  return {
    id: 'ai_memory_chat_context',
    label: 'AI memory, conversations, route embeddings, preferences',
    priority: 'P1',
    source: 'db',
    counts: {
      conversations,
      messages,
      memories,
      memoriesNoExpiry,
      memoryByType,
      memoryByCategory,
      preferences,
      routeEmbeddings,
      aiMemoryDisposition,
    },
    categories,
    coverage: metricFromCount(
      conversations + memories + preferences,
      'AI personalization records',
    ),
    freshness:
      dispositionClosed && memoriesNoExpiry > 0
        ? warnMetric(
            `${memoriesNoExpiry} memories have no expiry; disposition packet routes retention review`,
          )
        : memoriesNoExpiry === 0
          ? passMetric('All memories have expiry')
          : warnMetric(`${memoriesNoExpiry} memories have no expiry`),
    sourceQuality: dispositionClosed
      ? highSensitivityRows > 0
        ? warnMetric(
            `${highSensitivityRows} high-sensitivity memories have explicit sensitivity dispositions`,
          )
        : passMetric('AI memory sensitivity dispositions are explicit')
      : warnMetric('Memory facts require sensitivity/source-category contract'),
    provenance: dispositionClosed
      ? missingProvenanceRows + missingConsentRows > 0
        ? warnMetric(
            `${numberSummary(dispositionSummary, 'emittedRows')} memory rows have explicit dispositions; ${missingProvenanceRows} lack source metadata and ${missingConsentRows} lack preference rows`,
          )
        : passMetric(
            `${numberSummary(dispositionSummary, 'emittedRows')} memory rows have source, consent, retention, and sensitivity dispositions`,
          )
      : warnMetric(
          'Memory metadata must carry source category and consent semantics',
        ),
    conflicts:
      dispositionClosed && conflictDispositionRows > 0
        ? warnMetric(
            `${conflictDispositionRows} memory conflict dispositions found`,
          )
        : passMetric(
            dispositionClosed
              ? 'No memory conflict dispositions found'
              : 'No memory conflict service result is included in this aggregate pass',
          ),
    consumerClosure: metricFromCount(messages, 'agent chat consumption proxy'),
    nextAction:
      categories.needsReview > 0 || categories.conflict > 0
        ? 'review'
        : 'accept',
    blockers: dispositionBlockers,
    evidence: [
      'AI_AGENT_MEMORY_SYSTEM_SPEC.md',
      'Memory',
      'AgentConversation',
      ...(aiMemoryDisposition.reportFound
        ? [`ai_memory_disposition: ${aiMemoryDisposition.status ?? 'unknown'}`]
        : []),
    ],
  };
}

async function auditNotificationDomain(): Promise<DomainAudit> {
  const servicePath = path.join(
    API_ROOT,
    'src',
    'modules',
    'notification',
    'notification.service.ts',
  );
  const source = fs.existsSync(servicePath)
    ? fs.readFileSync(servicePath, 'utf8')
    : '';
  const redisSignals = countMatches(
    source,
    /redis|notifications:|unread_count:|push_tokens?|notification_push_tokens/gi,
  );
  const liveGate = auditLiveDeliveryGateEvidence();
  const adrExists = fs.existsSync(
    path.resolve(
      API_ROOT,
      '..',
      '..',
      'docs',
      'adr',
      '0021-notification-retention-and-readiness-delivery.md',
    ),
  );
  const categories = emptyBuckets();
  categories.needsReview = 1;
  categories.missingConsumerVerification =
    liveGate.status === 'BLOCKED_FOR_LIVE_DELIVERY'
      ? 1
      : redisSignals > 0
        ? 1
        : 0;
  const liveDeliveryReleaseBlockers =
    liveGate.status === 'BLOCKED_FOR_LIVE_DELIVERY'
      ? liveGate.blockers.filter(
          (blocker) => !REVIEW_ONLY_LIVE_DELIVERY_BLOCKERS.has(blocker),
        )
      : [];
  return {
    id: 'notifications_reminders',
    label: 'Notifications, push tokens, reminders',
    priority: 'P1',
    source: 'mixed',
    counts: {
      adr0021Exists: adrExists,
      redisSignals,
      liveDeliveryGate: liveGate,
      servicePath: path.relative(API_ROOT, servicePath),
    },
    categories,
    coverage:
      redisSignals > 0
        ? warnMetric(
            'Notification service exists but feed persistence is Redis/code-level',
          )
        : failMetric('No notification service signals found'),
    freshness: warnMetric('Notification retention depends on Redis TTL policy'),
    sourceQuality: unknownMetric(
      'Runtime event producers are not audited in DB aggregate pass',
    ),
    provenance: adrExists
      ? warnMetric(
          liveGate.hasReadinessLiveChannelConsentJoin
            ? 'ADR-0021 documents Redis as ephemeral delivery cache; readiness preference and push-token consent join exists'
            : 'ADR-0021 documents Redis as ephemeral delivery cache; live readiness delivery still needs preference consent join evidence',
        )
      : failMetric('No notification persistence/preference ADR detected'),
    conflicts:
      liveGate.status === 'BLOCKED_FOR_LIVE_DELIVERY'
        ? warnMetric(
            `Live readiness delivery blocked for ${liveGate.blockedChannels.join(', ')}`,
          )
        : warnMetric(
            'Redis-only feed remains ephemeral by ADR; owning data models hold durable closure',
          ),
    consumerClosure: warnMetric(
      liveGate.reportFound
        ? `Live delivery gate ${liveGate.status}: ${liveGate.blockers.slice(0, 4).join(', ')}`
        : 'Push/feed consumer closure needs runtime journey verification',
    ),
    nextAction: 'review',
    blockers: liveGate.reportFound
      ? liveDeliveryReleaseBlockers.map(
          (blocker) => `Live readiness delivery: ${blocker}`,
        )
      : ['Run audit:profile-readiness-live-delivery-gate'],
    evidence: [
      'NotificationService source scan',
      'docs/adr/0021-notification-retention-and-readiness-delivery.md',
      'profile-readiness-live-delivery-gate-*.json',
      'PLATFORM_DATA_FIELD_MATRIX notification gap',
    ],
  };
}

function auditLiveDeliveryGateEvidence(): LiveDeliveryGateEvidence {
  const empty: LiveDeliveryGateEvidence = {
    reportFound: false,
    reportName: null,
    status: null,
    blockedChannels: [],
    blockers: [],
    includesUserIds: null,
    hasNotificationPreferenceModel: null,
    hasNotificationPreferenceFields: null,
    hasNotificationPreferenceApi: null,
    hasReadinessLiveChannelConsentJoin: null,
  };
  const latest = findLatestReport('profile-readiness-live-delivery-gate-');
  if (!latest) return empty;
  try {
    const report = JSON.parse(fs.readFileSync(latest.reportPath, 'utf8')) as {
      status?: string;
      summary?: {
        blockedChannels?: string[];
        blockers?: string[];
        includesUserIds?: boolean;
      };
      codeEvidence?: {
        hasNotificationPreferenceModel?: boolean;
        hasNotificationPreferenceFields?: boolean;
        hasNotificationPreferenceApi?: boolean;
        hasReadinessLiveChannelConsentJoin?: boolean;
      };
    };
    return {
      reportFound: true,
      reportName: latest.name,
      status: report.status ?? null,
      blockedChannels: report.summary?.blockedChannels ?? [],
      blockers: report.summary?.blockers ?? [],
      includesUserIds:
        typeof report.summary?.includesUserIds === 'boolean'
          ? report.summary.includesUserIds
          : null,
      hasNotificationPreferenceModel:
        typeof report.codeEvidence?.hasNotificationPreferenceModel === 'boolean'
          ? report.codeEvidence.hasNotificationPreferenceModel
          : null,
      hasNotificationPreferenceFields:
        typeof report.codeEvidence?.hasNotificationPreferenceFields ===
        'boolean'
          ? report.codeEvidence.hasNotificationPreferenceFields
          : null,
      hasNotificationPreferenceApi:
        typeof report.codeEvidence?.hasNotificationPreferenceApi === 'boolean'
          ? report.codeEvidence.hasNotificationPreferenceApi
          : null,
      hasReadinessLiveChannelConsentJoin:
        typeof report.codeEvidence?.hasReadinessLiveChannelConsentJoin ===
        'boolean'
          ? report.codeEvidence.hasReadinessLiveChannelConsentJoin
          : null,
    };
  } catch {
    return { ...empty, reportFound: true, reportName: latest.name };
  }
}

function findLatestReport(prefix: string) {
  if (!fs.existsSync(REPORT_ROOT)) return null;
  return (
    fs
      .readdirSync(REPORT_ROOT)
      .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
      .map((name) => {
        const reportPath = path.join(REPORT_ROOT, name);
        return { name, reportPath, mtimeMs: fs.statSync(reportPath).mtimeMs };
      })
      .sort(
        (a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name),
      )[0] ?? null
  );
}

async function auditOperationsDomain(
  db: Record<string, any>,
): Promise<DomainAudit> {
  const [
    points,
    payments,
    paymentsByStatus,
    featureFlags,
    enabledFeatureFlags,
    quotas,
  ] = await Promise.all([
    count(db, 'pointHistory'),
    count(db, 'payment'),
    group(db, 'payment', 'status'),
    count(db, 'featureFlag'),
    count(db, 'featureFlag', { where: { enabled: true } }),
    count(db, 'agentQuota'),
  ]);
  const failedPayments =
    (paymentsByStatus.FAILED ?? 0) + (paymentsByStatus.PENDING ?? 0);
  const categories = emptyBuckets();
  categories.trustedUsable = points + (paymentsByStatus.SUCCESS ?? 0) + quotas;
  categories.needsReview = failedPayments;
  categories.missingConsumerVerification = enabledFeatureFlags;
  return {
    id: 'operations_entitlements',
    label: 'Points, payments, feature flags, quotas',
    priority: 'P2',
    source: 'db',
    counts: {
      points,
      payments,
      paymentsByStatus,
      featureFlags,
      enabledFeatureFlags,
      quotas,
    },
    categories,
    coverage: metricFromCount(
      points + payments + featureFlags + quotas,
      'operations records',
    ),
    freshness: unknownMetric(
      'Runtime operational records are not globally stale-gated',
    ),
    sourceQuality: passMetric(
      'Operations records are first-party system/payment events',
    ),
    provenance:
      payments > 0
        ? passMetric(
            'Payment metadata/idempotency fields are present in schema',
          )
        : warnMetric('No payment records found for entitlement audit'),
    conflicts:
      failedPayments > 0
        ? warnMetric(`${failedPayments} payments are pending/failed`)
        : passMetric('No pending/failed payment rows found'),
    consumerClosure: warnMetric(
      'Feature/entitlement journeys need release-gate verification',
    ),
    nextAction: failedPayments > 0 ? 'review' : 'accept',
    blockers: [],
    evidence: ['Payment', 'PointHistory', 'FeatureFlag', 'AgentQuota'],
  };
}

async function auditSecurityDomain(
  db: Record<string, any>,
): Promise<DomainAudit> {
  const [
    vaultItems,
    apiKeys,
    revokedApiKeys,
    auditLogs,
    reports,
    reportsByStatus,
    securityEvents,
    unresolvedSecurityEvents,
  ] = await Promise.all([
    count(db, 'vaultItem'),
    count(db, 'mcpApiKey'),
    count(db, 'mcpApiKey', { where: { isRevoked: true } }),
    count(db, 'auditLog'),
    count(db, 'report'),
    group(db, 'report', 'status'),
    count(db, 'agentSecurityEvent'),
    count(db, 'agentSecurityEvent', { where: { resolved: false } }),
  ]);
  const categories = emptyBuckets();
  categories.trustedUsable = auditLogs + revokedApiKeys;
  categories.needsReview =
    unresolvedSecurityEvents + (reportsByStatus.PENDING ?? 0);
  categories.missingConsumerVerification = vaultItems + apiKeys;
  return {
    id: 'security_privacy_compliance',
    label: 'Vault, API keys, audit logs, reports, security events',
    priority: 'P0',
    source: 'db',
    counts: {
      vaultItems,
      apiKeys,
      revokedApiKeys,
      auditLogs,
      reports,
      reportsByStatus,
      securityEvents,
      unresolvedSecurityEvents,
    },
    categories,
    coverage: metricFromCount(
      auditLogs + reports + securityEvents + apiKeys + vaultItems,
      'security/compliance records',
    ),
    freshness:
      unresolvedSecurityEvents === 0
        ? passMetric('No unresolved security events found')
        : failMetric(`${unresolvedSecurityEvents} unresolved security events`),
    sourceQuality: passMetric(
      'Security records are first-party system/user/admin events',
    ),
    provenance:
      auditLogs > 0
        ? passMetric('AuditLog rows exist')
        : warnMetric('No AuditLog rows found'),
    conflicts:
      unresolvedSecurityEvents > 0
        ? failMetric('Unresolved security events block full data closure')
        : passMetric('No unresolved security-event conflict proxy'),
    consumerClosure: warnMetric(
      'Privacy/export/delete journeys require release-gate verification',
    ),
    nextAction: unresolvedSecurityEvents > 0 ? 'block-release' : 'accept',
    blockers:
      unresolvedSecurityEvents > 0
        ? [`${unresolvedSecurityEvents} unresolved AgentSecurityEvent rows`]
        : [],
    evidence: [
      'VaultItem',
      'McpApiKey',
      'AuditLog',
      'Report',
      'AgentSecurityEvent',
    ],
  };
}

async function auditBenchmarkGovernanceDomain(
  db: Record<string, any>,
): Promise<DomainAudit> {
  const [
    benchmarkProfiles,
    competitorSources,
    enabledSources,
    competitorRuns,
    runsByStatus,
    competitorPredictions,
    predictionsByStatus,
    sourceObservations,
    observationsByStatus,
    stagingRows,
    stagingByStatus,
    stagingByType,
  ] = await Promise.all([
    count(db, 'benchmarkProfile'),
    count(db, 'competitorSource'),
    count(db, 'competitorSource', { where: { enabled: true } }),
    count(db, 'competitorRun'),
    group(db, 'competitorRun', 'status'),
    count(db, 'competitorPrediction'),
    group(db, 'competitorPrediction', 'status'),
    count(db, 'predictionSourceObservation'),
    group(db, 'predictionSourceObservation', 'status'),
    count(db, 'dataImportStaging'),
    group(db, 'dataImportStaging', 'status'),
    group(db, 'dataImportStaging', 'dataType'),
  ]);
  const pendingGovernance =
    (runsByStatus.PENDING ?? 0) +
    (runsByStatus.RUNNING ?? 0) +
    (predictionsByStatus.PENDING ?? 0) +
    (observationsByStatus.RAW ?? 0) +
    (observationsByStatus.REVIEW ?? 0) +
    (stagingByStatus.PENDING ?? 0);
  const categories = emptyBuckets();
  categories.trustedUsable =
    (observationsByStatus.APPROVED ?? 0) + (stagingByStatus.MERGED ?? 0);
  categories.needsReview = pendingGovernance;
  categories.conflict =
    (observationsByStatus.REJECTED ?? 0) + (stagingByStatus.REJECTED ?? 0);
  return {
    id: 'benchmark_ingestion_governance',
    label: 'Competitor benchmark, source observations, import staging',
    priority: 'P3',
    source: 'db',
    counts: {
      benchmarkProfiles,
      competitorSources,
      enabledSources,
      competitorRuns,
      runsByStatus,
      competitorPredictions,
      predictionsByStatus,
      sourceObservations,
      observationsByStatus,
      stagingRows,
      stagingByStatus,
      stagingByType,
    },
    categories,
    coverage: metricFromCount(
      sourceObservations + stagingRows + competitorPredictions,
      'governance/benchmark records',
    ),
    freshness: unknownMetric('Benchmark/staging freshness is campaign-scoped'),
    sourceQuality: warnMetric(
      'Benchmark sources require active session/ToS review before use',
    ),
    provenance: metricFromCount(
      sourceObservations + stagingRows,
      'observation/staging provenance rows',
    ),
    conflicts:
      categories.conflict > 0
        ? warnMetric(`${categories.conflict} rejected governance/staging rows`)
        : passMetric('No rejected governance/staging rows found'),
    consumerClosure: warnMetric(
      'Benchmark results are internal-only and must not surface to applicants',
    ),
    nextAction: pendingGovernance > 0 ? 'review' : 'accept',
    blockers: [],
    evidence: [
      'DataImportStaging',
      'PredictionSourceObservation',
      'COMPETITOR_BENCHMARK_RUNBOOK.md',
    ],
  };
}

function auditFileRoot(root: string, args: Args): FileInventory {
  const inventory: FileInventory = {
    root,
    exists: fs.existsSync(root),
    totalFiles: 0,
    totalBytes: 0,
    byExtension: {},
    parsedJsonFiles: 0,
    parsedCsvFiles: 0,
    parseErrors: [],
    skippedLargeFiles: [],
    recordCountEstimate: 0,
    sourceSignalCount: 0,
    evidenceSignalCount: 0,
    yearSignalCount: 0,
    qualitySignalCount: 0,
    statusCounts: {},
    domainHints: {},
    sampleFiles: [],
  };
  if (!inventory.exists) return inventory;

  for (const file of walkFiles(root)) {
    const ext = path.extname(file).toLowerCase();
    if (!['.json', '.csv', '.md'].includes(ext)) continue;
    const stat = fs.statSync(file);
    inventory.totalFiles += 1;
    inventory.totalBytes += stat.size;
    inventory.byExtension[ext] = (inventory.byExtension[ext] ?? 0) + 1;
    addDomainHint(inventory, file);
    if (stat.size > args.maxFileBytes) {
      inventory.skippedLargeFiles.push({
        file: path.relative(API_ROOT, file),
        sizeBytes: stat.size,
      });
      continue;
    }
    try {
      if (ext === '.json') summarizeJsonFile(file, stat.size, inventory, args);
      else if (ext === '.csv') summarizeCsvFile(file, stat.size, inventory);
      else summarizeMarkdownFile(file, stat.size, inventory);
    } catch (error) {
      inventory.parseErrors.push({
        file: path.relative(API_ROOT, file),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  inventory.sampleFiles = inventory.sampleFiles.slice(0, 25);
  return inventory;
}

function buildFileDomains(inventories: FileInventory[]): DomainAudit[] {
  const totalFiles = inventories.reduce(
    (sum, root) => sum + root.totalFiles,
    0,
  );
  const totalBytes = inventories.reduce(
    (sum, root) => sum + root.totalBytes,
    0,
  );
  const sourceSignals = inventories.reduce(
    (sum, root) => sum + root.sourceSignalCount,
    0,
  );
  const evidenceSignals = inventories.reduce(
    (sum, root) => sum + root.evidenceSignalCount,
    0,
  );
  const qualitySignals = inventories.reduce(
    (sum, root) => sum + root.qualitySignalCount,
    0,
  );
  const parseErrors = inventories.reduce(
    (sum, root) => sum + root.parseErrors.length,
    0,
  );
  const skippedLarge = inventories.reduce(
    (sum, root) => sum + root.skippedLargeFiles.length,
    0,
  );
  const categories = emptyBuckets();
  categories.trustedUsable = sourceSignals + evidenceSignals;
  categories.missingProvenance = Math.max(0, totalFiles - sourceSignals);
  categories.needsReview = parseErrors + skippedLarge;
  categories.missingConsumerVerification = qualitySignals > 0 ? 0 : totalFiles;
  return [
    {
      id: 'repository_data_assets',
      label: 'Repository JSON/CSV/CDS/closure report inventory',
      priority: 'P0',
      source: 'files',
      counts: {
        totalFiles,
        totalBytes,
        recordCountEstimate: inventories.reduce(
          (sum, root) => sum + root.recordCountEstimate,
          0,
        ),
        sourceSignals,
        evidenceSignals,
        qualitySignals,
        parseErrors,
        skippedLarge,
        roots: inventories.map((root) => ({
          root: path.relative(API_ROOT, root.root),
          totalFiles: root.totalFiles,
          totalBytes: root.totalBytes,
          byExtension: root.byExtension,
          domainHints: root.domainHints,
        })),
      },
      categories,
      coverage: metricFromCount(totalFiles, 'repository data files'),
      freshness: warnMetric(
        'File-level freshness is inferred from filenames; DB cycle checks own freshness',
      ),
      sourceQuality:
        sourceSignals > 0
          ? passMetric(
              `${sourceSignals} source/url-like signals found in existing files`,
            )
          : failMetric(
              'No source/url-like signals found in repository data assets',
            ),
      provenance:
        evidenceSignals > 0
          ? passMetric(
              `${evidenceSignals} evidence/provenance-like signals found`,
            )
          : warnMetric(
              'No evidence/provenance-like signals found in parsed file sample',
            ),
      conflicts:
        parseErrors > 0
          ? warnMetric(`${parseErrors} files failed parsing`)
          : passMetric('No parse errors in parsed file set'),
      consumerClosure: warnMetric(
        'File assets require DB/API consumer reconciliation before full closure',
      ),
      nextAction: parseErrors > 0 || skippedLarge > 0 ? 'review' : 'accept',
      blockers:
        parseErrors > 0
          ? [`${parseErrors} repository data files failed parsing`]
          : [],
      evidence: [
        'apps/api/scripts/data',
        'apps/api/scripts/cds-data',
        'apps/api/scripts/closure-reports',
      ],
    },
  ];
}

function summarizeJsonFile(
  file: string,
  sizeBytes: number,
  inventory: FileInventory,
  args: Args,
) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  inventory.parsedJsonFiles += 1;
  const keys = topLevelKeys(parsed);
  const recordCountEstimate = estimateRecordCount(parsed);
  inventory.recordCountEstimate += recordCountEstimate;
  const signals = collectJsonSignals(parsed, args.maxJsonNodes);
  inventory.sourceSignalCount += signals.source;
  inventory.evidenceSignalCount += signals.evidence;
  inventory.yearSignalCount += signals.year;
  inventory.qualitySignalCount += signals.quality;
  mergeCounts(inventory.statusCounts, signals.statusCounts);
  inventory.sampleFiles.push({
    file: path.relative(API_ROOT, file),
    sizeBytes,
    kind: 'json',
    recordCountEstimate,
    keys,
  });
}

function summarizeCsvFile(
  file: string,
  sizeBytes: number,
  inventory: FileInventory,
) {
  const text = fs.readFileSync(file, 'utf8');
  const [headerLine = ''] = text.split(/\r?\n/, 1);
  const headers = headerLine
    .split(',')
    .map((header) => header.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
  const rows = Math.max(0, text.split(/\r?\n/).filter(Boolean).length - 1);
  inventory.parsedCsvFiles += 1;
  inventory.recordCountEstimate += rows;
  for (const header of headers) {
    addHeaderSignal(header, inventory);
  }
  inventory.sampleFiles.push({
    file: path.relative(API_ROOT, file),
    sizeBytes,
    kind: 'csv',
    recordCountEstimate: rows,
    keys: headers.slice(0, 20),
  });
}

function summarizeMarkdownFile(
  file: string,
  sizeBytes: number,
  inventory: FileInventory,
) {
  const text = fs.readFileSync(file, 'utf8');
  inventory.sourceSignalCount += countMatches(text, /https?:\/\//g);
  inventory.evidenceSignalCount += countMatches(
    text,
    /provenance|evidence|source|citation|verified|review/gi,
  );
  inventory.qualitySignalCount += countMatches(
    text,
    /gate|quality|coverage|closure|freshness|conflict|terminal/gi,
  );
  inventory.sampleFiles.push({
    file: path.relative(API_ROOT, file),
    sizeBytes,
    kind: 'markdown',
  });
}

function collectJsonSignals(value: unknown, maxNodes: number) {
  const statusCounts: Record<string, number> = {};
  const signals = {
    source: 0,
    evidence: 0,
    year: 0,
    quality: 0,
    statusCounts,
  };
  let visited = 0;
  const visit = (item: unknown) => {
    if (visited >= maxNodes) return;
    visited += 1;
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    for (const [key, child] of Object.entries(
      item as Record<string, unknown>,
    )) {
      const lower = key.toLowerCase();
      if (isSourceKey(lower)) signals.source += 1;
      if (isEvidenceKey(lower)) signals.evidence += 1;
      if (isYearKey(lower)) signals.year += 1;
      if (isQualityKey(lower)) signals.quality += 1;
      if (
        lower === 'status' ||
        lower === 'reviewstatus' ||
        lower === 'realdatastatus'
      ) {
        const status = String(child ?? 'null');
        statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      }
      visit(child);
    }
  };
  visit(value);
  return signals;
}

function addHeaderSignal(header: string, inventory: FileInventory) {
  const lower = header.toLowerCase();
  if (isSourceKey(lower)) inventory.sourceSignalCount += 1;
  if (isEvidenceKey(lower)) inventory.evidenceSignalCount += 1;
  if (isYearKey(lower)) inventory.yearSignalCount += 1;
  if (isQualityKey(lower)) inventory.qualitySignalCount += 1;
}

function isSourceKey(key: string) {
  return (
    key.includes('source') ||
    key.includes('url') ||
    key.includes('citation') ||
    key.includes('license')
  );
}

function isEvidenceKey(key: string) {
  return (
    key.includes('evidence') ||
    key.includes('provenance') ||
    key.includes('rawcontent') ||
    key.includes('rawdata') ||
    key.includes('reviewed')
  );
}

function isYearKey(key: string) {
  return (
    key === 'year' || key.includes('datayear') || key.includes('cycleyear')
  );
}

function isQualityKey(key: string) {
  return (
    key.includes('confidence') ||
    key.includes('quality') ||
    key.includes('status') ||
    key.includes('terminal') ||
    key.includes('conflict')
  );
}

function addDomainHint(inventory: FileInventory, file: string) {
  const name = path.basename(file).toLowerCase();
  const hints: Array<[string, RegExp]> = [
    ['school', /school|cds|scorecard|ipeds|niche|ranking/],
    ['essay', /essay|prompt/],
    ['deadline_policy', /deadline|policy|c21|ed|ea|needblind/],
    ['profile_case', /profile|case|verification|review/],
    ['program', /program|cip|major/],
    ['closure', /closure|coverage|audit|diagnose/],
    ['benchmark', /benchmark|competitor/],
  ];
  for (const [hint, pattern] of hints) {
    if (pattern.test(name)) {
      inventory.domainHints[hint] = (inventory.domainHints[hint] ?? 0) + 1;
    }
  }
}

function classifySchoolField(
  school: Record<string, unknown>,
  spec: FullFieldAuditSpec,
) {
  const provenance = fieldProvenance(school.metadata, spec.key);
  const rawStatus = statusFromProvenance(provenance);
  const value = valueFor(school, spec);
  const hasUsableValue = hasValue(value, spec);
  let bucket:
    | 'real'
    | 'secondary'
    | 'heuristic'
    | 'terminal'
    | 'legacyValue'
    | 'open'
    | 'missing' = 'missing';

  if (rawStatus && OPEN_DATA_STATUSES.includes(rawStatus as never)) {
    bucket = 'open';
  } else if (rawStatus && TERMINAL_DATA_STATUSES.includes(rawStatus as never)) {
    bucket = 'terminal';
  } else if (hasUsableValue && rawStatus === 'VERIFIED_SECONDARY') {
    bucket = 'secondary';
  } else if (
    hasUsableValue &&
    (rawStatus === 'HEURISTIC_FILL' || rawStatus === 'PERMANENT_HEURISTIC')
  ) {
    bucket = 'heuristic';
  } else if (
    hasUsableValue &&
    (rawStatus === 'VERIFIED_REAL' || rawStatus === 'OFFICIAL_REAL_LEGACY')
  ) {
    bucket = 'real';
  } else if (hasUsableValue) {
    bucket = 'legacyValue';
  } else if (spec.userGenerated && !hasUsableValue) {
    bucket = 'terminal';
  }

  return {
    field: spec.key,
    value,
    bucket,
    status: rawStatus,
    source: stringOrNull(provenance.source),
    sourceUrl: stringOrNull(provenance.sourceUrl),
    verifiedAt:
      stringOrNull(provenance.verifiedAt) ??
      stringOrNull(provenance.fetchedAt) ??
      stringOrNull(provenance.reviewedAt),
  };
}

function fieldProvenance(metadata: unknown, field: string) {
  const meta = record(metadata);
  const provenance = record(meta.provenance);
  return record(provenance[field]);
}

function valueFor(school: Record<string, unknown>, spec: FullFieldAuditSpec) {
  if (spec.kind === 'relation') {
    const counts = record(school._count);
    return spec.relationCount ? counts[spec.relationCount] : null;
  }
  const value = school[spec.key];
  if (value instanceof Prisma.Decimal)
    return (value as Prisma.Decimal).toNumber();
  return value ?? null;
}

function hasValue(value: unknown, spec: FullFieldAuditSpec) {
  if (value == null) return false;
  if (typeof value === 'boolean') return true;
  if (spec.kind === 'relation') return Number(value) > 0;
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.length > 0;
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string')
    return value.trim().length > 0 && value !== 'UNKNOWN';
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

function statusFromProvenance(provenance: Record<string, unknown>) {
  const candidates = [
    provenance.realDataStatus,
    provenance.status,
    provenance.tier,
    provenance.source,
  ]
    .map((value) => (typeof value === 'string' ? value.toUpperCase() : null))
    .filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (
      OPEN_DATA_STATUSES.includes(candidate as never) ||
      TERMINAL_DATA_STATUSES.includes(candidate as never) ||
      candidate === 'VERIFIED_REAL' ||
      candidate === 'VERIFIED_SECONDARY' ||
      candidate === 'OFFICIAL_REAL_LEGACY' ||
      candidate === 'HEURISTIC_FILL'
    ) {
      return candidate;
    }
    if (candidate.includes('HEURISTIC')) return 'HEURISTIC_FILL';
    if (candidate.includes('SECONDARY')) return 'VERIFIED_SECONDARY';
    if (
      candidate.includes('OFFICIAL') ||
      candidate.includes('CDS') ||
      candidate.includes('IPEDS') ||
      candidate.includes('SCORECARD')
    ) {
      return 'VERIFIED_REAL';
    }
  }
  return null;
}

async function count(
  db: Record<string, any>,
  model: string,
  args?: Record<string, unknown>,
) {
  if (!db[model]?.count) return 0;
  return Number(await db[model].count(args ?? {}));
}

async function group(db: Record<string, any>, model: string, field: string) {
  if (!db[model]?.groupBy) return {};
  const rows = await db[model].groupBy({
    by: [field],
    _count: { _all: true },
  });
  return Object.fromEntries(
    rows.map((row: Record<string, unknown>) => [
      String(row[field] ?? 'null'),
      Number(record(row._count)._all ?? 0),
    ]),
  ) as Record<string, number>;
}

async function distinctCount(
  db: Record<string, any>,
  model: string,
  field: string,
  args: Record<string, unknown> = {},
) {
  if (!db[model]?.findMany) return 0;
  const rows = await db[model].findMany({
    ...args,
    distinct: [field],
    select: { [field]: true },
  });
  return rows.length;
}

function topLevelKeys(value: unknown) {
  if (Array.isArray(value)) {
    const first = value.find((item) => item && typeof item === 'object');
    return first && !Array.isArray(first)
      ? Object.keys(first as Record<string, unknown>).slice(0, 20)
      : [];
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).slice(0, 20);
  }
  return [];
}

function estimateRecordCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 1;
  const obj = value as Record<string, unknown>;
  for (const key of [
    'items',
    'schools',
    'records',
    'rows',
    'data',
    'targets',
  ]) {
    if (Array.isArray(obj[key])) return obj[key].length;
  }
  return 1;
}

function walkFiles(root: string): string[] {
  const output: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) output.push(full);
    }
  };
  visit(root);
  return output;
}

function rankCampaigns(domains: DomainAudit[]) {
  const priorityWeight = { P0: 4, P1: 3, P2: 2, P3: 1 };
  return domains
    .map((domain) => {
      const risk =
        domain.categories.conflict * 5 +
        domain.categories.needsReview * 3 +
        domain.categories.missingProvenance * 2 +
        domain.categories.stale * 2 +
        domain.categories.missingConsumerVerification;
      const blockerBoost = domain.blockers.length * 10;
      const blockReleaseBoost =
        domain.nextAction === 'block-release' ? 1_000_000 : 0;
      return {
        domain: domain.id,
        label: domain.label,
        priority: domain.priority,
        nextAction: domain.nextAction,
        score:
          blockReleaseBoost +
          priorityWeight[domain.priority] * (risk + blockerBoost + 1),
        reason:
          domain.blockers[0] ??
          domain.coverage.summary ??
          'Continue closure verification',
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function buildCodexReview(
  domains: DomainAudit[],
  campaigns: ReturnType<typeof rankCampaigns>,
  dbAvailable: boolean,
) {
  const openDomains = domains.filter((domain) =>
    ['review', 'refresh', 'backfill', 'block-release'].includes(
      domain.nextAction,
    ),
  );
  return {
    closed: openDomains.length === 0 && dbAvailable,
    verdict: dbAvailable
      ? openDomains.length === 0
        ? 'All audited domains are provisionally closed.'
        : 'Platform data is not closed yet; continue the ranked campaigns.'
      : 'Database audit did not run, so this report is file-only and cannot close the goal.',
    requiredNextCampaign: campaigns[0] ?? null,
    reviewNotes: [
      'Read-only aggregate pass only; no facts were written to the database.',
      'Cases and prediction feedback remain diagnostic only under ADR-0020.',
      'Repository files must be reconciled to DB/API consumers before they count as closed.',
    ],
  };
}

function printSummary(
  out: string,
  domains: DomainAudit[],
  campaigns: ReturnType<typeof rankCampaigns>,
  status: string,
) {
  console.log(`Platform data closure audit: ${out}`);
  console.log(`Gate: ${status}`);
  for (const domain of domains) {
    console.log(
      `${domain.priority} ${domain.id}: ${domain.nextAction} | coverage=${domain.coverage.status} provenance=${domain.provenance.status} consumer=${domain.consumerClosure.status}`,
    );
  }
  console.log('Top campaigns:');
  for (const campaign of campaigns.slice(0, 5)) {
    console.log(
      `- ${campaign.domain} (${campaign.nextAction}, score=${campaign.score}): ${campaign.reason}`,
    );
  }
}

function metricFromCount(countValue: number, label: string): Metric {
  return countValue > 0
    ? passMetric(`${countValue} ${label}`)
    : failMetric(`No ${label}`);
}

function ratioMetric(
  numerator: number,
  denominator: number,
  label: string,
  passAt = 0.85,
  warnAt = 0.55,
): Metric {
  const ratio = denominator > 0 ? numerator / denominator : 0;
  const pct = Math.round(ratio * 1000) / 10;
  const summary = `${numerator}/${denominator} ${label} (${pct}%)`;
  if (ratio >= passAt) return { status: 'pass', score: ratio, summary };
  if (ratio >= warnAt) return { status: 'warn', score: ratio, summary };
  return { status: 'fail', score: ratio, summary };
}

function passMetric(summary: string): Metric {
  return { status: 'pass', score: 1, summary };
}

function warnMetric(summary: string): Metric {
  return { status: 'warn', score: 0.5, summary };
}

function failMetric(summary: string): Metric {
  return { status: 'fail', score: 0, summary };
}

function unknownMetric(summary: string): Metric {
  return { status: 'unknown', score: null, summary };
}

function sumFieldBuckets(
  totals: Record<string, Record<string, number>>,
  buckets: string[],
) {
  return Object.values(totals).reduce(
    (sum, field) =>
      sum +
      buckets.reduce((fieldSum, bucket) => fieldSum + (field[bucket] ?? 0), 0),
    0,
  );
}

function isPredictionCritical(field: string) {
  return [
    'acceptanceRate',
    'intlAcceptanceRate',
    'oosAcceptanceRate',
    'transferAcceptanceRate',
    'edAcceptanceRate',
    'eaAcceptanceRate',
    'sat25',
    'sat75',
    'act25',
    'act75',
    'gpaDistribution',
    'deadlines',
    'essayPrompts',
  ].includes(field);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isStale(value: string | null, staleDays: number) {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && Date.now() - time > staleDays * DAY_MS;
}

function mergeCounts(
  target: Record<string, number>,
  source: Record<string, number>,
) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
