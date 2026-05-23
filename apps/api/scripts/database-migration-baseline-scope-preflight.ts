#!/usr/bin/env tsx
import 'dotenv/config';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

type PreflightStatus =
  | 'PASS_NO_DB_MIGRATION_BLOCKER'
  | 'BLOCKED_DATABASE_UNAVAILABLE'
  | 'BLOCKED_REMOTE_OR_PRODUCTION_LIKE_TARGET'
  | 'BLOCKED_UNSUPPORTED_TARGET_SCOPE'
  | 'BLOCKED_BACKUP_EVIDENCE_REQUIRED'
  | 'REVIEW_BASELINE_SCOPE_PREFLIGHT_READY';

type TargetScope = 'local-existing' | 'local-disposable' | 'staging-clone';

interface Args {
  schemaWorklist: string | null;
  baselineProposal: string | null;
  out: string;
  markdown: string;
  targetScope: TargetScope | null;
  backupEvidence: string | null;
  dbTimeoutMs: number;
}

interface Artifact {
  path: string | null;
  exists: boolean;
  status: string | null;
  summary: Record<string, unknown>;
  error: string | null;
}

interface DbFingerprint {
  ok: true;
  databaseName: string | null;
  currentUser: string | null;
  serverAddress: string | null;
  serverPort: number | null;
  postgresVersion: string | null;
  isInRecovery: boolean | null;
  databaseSizeBytes: number | null;
  publicTableCount: number;
  estimatedRowCount: number;
  prismaMigrationCount: number | null;
  latestPrismaMigrations: Array<{
    migrationName: string;
    finishedAt: string | null;
    checksum: string | null;
  }>;
}

type DbFingerprintResult = DbFingerprint | { ok: false; error: string };

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const SUPPORTED_SCOPES = new Set<TargetScope>([
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
        `database-migration-baseline-scope-preflight-${stamp}.json`,
      ),
    )!,
  );
  return {
    schemaWorklist: optionalPath(
      '--schema-worklist',
      /^database-schema-compatibility-worklist-.+\.json$/,
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
    targetScope: normalizeScope(get('--target-scope') ?? null),
    backupEvidence: get('--backup-evidence') ?? null,
    dbTimeoutMs: Number(get('--db-timeout-ms', '15000')),
  };
}

async function main() {
  const args = parseArgs();
  const schemaWorklist = readArtifact(args.schemaWorklist);
  const baselineProposal = readArtifact(args.baselineProposal);
  const dbUrl = parseDatabaseUrl(process.env.DATABASE_URL);
  const inferredScope = inferTargetScope(dbUrl);
  const requestedScope = args.targetScope;
  const effectiveScope = requestedScope ?? inferredScope.scope;
  const dbFingerprint = await withTimeout(
    inspectDatabase(),
    args.dbTimeoutMs,
  ).catch((error) => ({
    ok: false as const,
    error: error instanceof Error ? error.message : String(error),
  }));
  const productionSignals = buildProductionSignals(
    dbUrl,
    dbFingerprint,
    inferredScope,
  );
  const missingInputs = buildMissingInputs({
    effectiveScope,
    requestedScope,
    backupEvidence: args.backupEvidence,
    dbFingerprint,
    productionSignals,
  });
  const status = chooseStatus({
    schemaWorklist,
    baselineProposal,
    dbFingerprint,
    effectiveScope,
    productionSignals,
    missingInputs,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-migration-baseline-scope-preflight',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    prismaResolveOrDeployExecuted: false,
    operatorApprovalGranted: false,
    sourceArtifacts: {
      schemaWorklist,
      baselineProposal,
    },
    databaseTarget: {
      sanitizedUrl: redactDatabaseUrl(process.env.DATABASE_URL),
      parsed: dbUrl
        ? {
            protocol: dbUrl.protocol,
            host: dbUrl.host,
            port: dbUrl.port,
            database: dbUrl.database,
            isLocalHost: dbUrl.isLocalHost,
          }
        : null,
      fingerprint: dbFingerprint,
    },
    summary: {
      schemaWorklistStatus: schemaWorklist.status,
      baselineProposalStatus: baselineProposal.status,
      inferredTargetScope: inferredScope.scope,
      inferredTargetReason: inferredScope.reason,
      requestedTargetScope: requestedScope,
      effectiveTargetScope: effectiveScope,
      productionSignalCount: productionSignals.length,
      backupEvidenceProvided: Boolean(args.backupEvidence),
      dbReadable: dbFingerprint.ok,
      dataBearing:
        dbFingerprint.ok &&
        (dbFingerprint.publicTableCount > 0 ||
          dbFingerprint.estimatedRowCount > 0 ||
          (dbFingerprint.prismaMigrationCount ?? 0) > 0),
      publicTableCount: dbFingerprint.ok ? dbFingerprint.publicTableCount : 0,
      estimatedRowCount: dbFingerprint.ok ? dbFingerprint.estimatedRowCount : 0,
      prismaMigrationCount: dbFingerprint.ok
        ? dbFingerprint.prismaMigrationCount
        : null,
      missingRequiredInputs: missingInputs.length,
    },
    productionSignals,
    missingRequiredInputs: missingInputs,
    baselineResolutionInputHint: buildBaselineResolutionInputHint(
      status,
      effectiveScope,
      args.backupEvidence,
    ),
    operatorGuardrails: {
      productionScopeAllowed: false,
      supportedTargetScopes: Array.from(SUPPORTED_SCOPES),
      requiresSeparateApprovalGate:
        'audit:database-migration-baseline-resolution',
      writeCommandsIntentionallyOmitted: [
        'prisma migrate resolve',
        'prisma migrate deploy',
        'prisma db push',
        'SQL restore',
        'pg_dump data export',
      ],
    },
    recommendedSequence: buildRecommendedSequence(status),
    nextCampaign: buildNextCampaign(status),
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  printSummary(args.out, args.markdown, report);
}

function normalizeScope(value: string | null): TargetScope | null {
  if (!value) return null;
  return SUPPORTED_SCOPES.has(value as TargetScope)
    ? (value as TargetScope)
    : null;
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

function readArtifact(artifactPath: string | null): Artifact {
  if (!artifactPath) {
    return {
      path: null,
      exists: false,
      status: null,
      summary: {},
      error: 'No artifact path provided and no latest report was found',
    };
  }
  if (!fs.existsSync(artifactPath)) {
    return {
      path: path.relative(API_ROOT, artifactPath),
      exists: false,
      status: null,
      summary: {},
      error: 'Artifact path does not exist',
    };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as Record<
      string,
      unknown
    >;
    return {
      path: path.relative(API_ROOT, artifactPath),
      exists: true,
      status: typeof raw.status === 'string' ? raw.status : null,
      summary:
        raw.summary && typeof raw.summary === 'object'
          ? (raw.summary as Record<string, unknown>)
          : {},
      error: null,
    };
  } catch (error) {
    return {
      path: path.relative(API_ROOT, artifactPath),
      exists: false,
      status: null,
      summary: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseDatabaseUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const host = url.hostname;
    return {
      protocol: url.protocol.replace(/:$/, ''),
      host,
      port: url.port || null,
      database,
      isLocalHost: isLocalHost(host),
    };
  } catch {
    return null;
  }
}

function isLocalHost(host: string | null | undefined) {
  return ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host ?? '');
}

function inferTargetScope(dbUrl: ReturnType<typeof parseDatabaseUrl>) {
  if (!dbUrl) {
    return {
      scope: null as TargetScope | null,
      reason: 'DATABASE_URL is missing or unparsable',
    };
  }
  if (dbUrl.isLocalHost) {
    return {
      scope: 'local-existing' as TargetScope,
      reason: 'DATABASE_URL host is local',
    };
  }
  if (containsAny(`${dbUrl.host} ${dbUrl.database}`, ['staging', 'stage'])) {
    return {
      scope: 'staging-clone' as TargetScope,
      reason: 'DATABASE_URL contains staging-like host or database name',
    };
  }
  return {
    scope: null as TargetScope | null,
    reason:
      'DATABASE_URL is remote or production-like; baseline scope must be explicit and non-production',
  };
}

async function inspectDatabase(): Promise<DbFingerprintResult> {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const [identity] = await prisma.$queryRawUnsafe<
      Array<{
        database_name: string | null;
        current_user: string | null;
        server_address: string | null;
        server_port: number | null;
        postgres_version: string | null;
        is_in_recovery: boolean | null;
        database_size_bytes: bigint | number | null;
      }>
    >(
      `select current_database() as database_name,
              current_user as current_user,
              inet_server_addr()::text as server_address,
              inet_server_port() as server_port,
              version() as postgres_version,
              pg_is_in_recovery() as is_in_recovery,
              pg_database_size(current_database()) as database_size_bytes`,
    );
    const [tableStats] = await prisma.$queryRawUnsafe<
      Array<{
        public_table_count: bigint | number;
        estimated_row_count: string;
      }>
    >(
      `select count(*) as public_table_count,
              coalesce(sum(greatest(n_live_tup, 0)), 0)::text as estimated_row_count
         from pg_stat_user_tables
        where schemaname = 'public'`,
    );
    const [migrationTable] = await prisma.$queryRawUnsafe<
      Array<{ exists: boolean }>
    >(
      `select exists (
         select 1
           from information_schema.tables
          where table_schema = 'public'
            and table_name = '_prisma_migrations'
       ) as exists`,
    );
    const latestPrismaMigrations = migrationTable?.exists
      ? await prisma.$queryRawUnsafe<
          Array<{
            migration_name: string;
            finished_at: Date | null;
            checksum: string | null;
          }>
        >(
          `select migration_name, finished_at, checksum
             from "_prisma_migrations"
            order by finished_at desc nulls last, started_at desc
            limit 5`,
        )
      : [];
    const [migrationCount] = migrationTable?.exists
      ? await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
          `select count(*) as count from "_prisma_migrations"`,
        )
      : [{ count: null }];
    return {
      ok: true,
      databaseName: identity?.database_name ?? null,
      currentUser: identity?.current_user ?? null,
      serverAddress: identity?.server_address ?? null,
      serverPort: numberOrNull(identity?.server_port),
      postgresVersion: identity?.postgres_version ?? null,
      isInRecovery: identity?.is_in_recovery ?? null,
      databaseSizeBytes: numberOrNull(identity?.database_size_bytes),
      publicTableCount: numberOrZero(tableStats?.public_table_count),
      estimatedRowCount: Number(tableStats?.estimated_row_count ?? 0),
      prismaMigrationCount: numberOrNull(migrationCount?.count),
      latestPrismaMigrations: latestPrismaMigrations.map((row) => ({
        migrationName: row.migration_name,
        finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
        checksum: row.checksum,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

function buildProductionSignals(
  dbUrl: ReturnType<typeof parseDatabaseUrl>,
  dbFingerprint: DbFingerprintResult,
  inferredScope: { scope: TargetScope | null; reason: string },
) {
  const signals: Array<{ key: string; severity: string; detail: string }> = [];
  const searchable = [
    dbUrl?.host,
    dbUrl?.database,
    dbFingerprint.ok ? dbFingerprint.databaseName : null,
    process.env.NODE_ENV,
    process.env.VERCEL_ENV,
    process.env.RAILWAY_ENVIRONMENT,
  ]
    .filter(Boolean)
    .join(' ');
  if (!dbUrl) {
    signals.push({
      key: 'database-url-unparsed',
      severity: 'critical',
      detail: 'DATABASE_URL is missing or could not be parsed',
    });
  } else if (!dbUrl.isLocalHost && inferredScope.scope !== 'staging-clone') {
    signals.push({
      key: 'remote-database-target',
      severity: 'critical',
      detail: `DATABASE_URL host is ${dbUrl.host}`,
    });
  }
  if (
    containsAny(searchable, [
      'prod',
      'production',
      'live',
      'primary',
      'railway',
      'render',
      'neon',
      'supabase',
      'rds',
      'amazonaws',
    ])
  ) {
    signals.push({
      key: 'production-like-name-or-host',
      severity: 'critical',
      detail:
        'Target metadata contains production-like or managed-hosting terms',
    });
  }
  return signals;
}

function buildMissingInputs(input: {
  effectiveScope: TargetScope | null;
  requestedScope: TargetScope | null;
  backupEvidence: string | null;
  dbFingerprint: DbFingerprintResult;
  productionSignals: Array<{ key: string; severity: string; detail: string }>;
}) {
  const missing: Array<{
    key: string;
    required: boolean;
    provided: boolean;
    expected: string;
    actual: string | null;
  }> = [];
  if (!input.effectiveScope) {
    missing.push({
      key: 'target-scope',
      required: true,
      provided: false,
      expected: 'local-existing|local-disposable|staging-clone',
      actual: input.requestedScope,
    });
  }
  if (!input.dbFingerprint.ok) {
    missing.push({
      key: 'readable-database-fingerprint',
      required: true,
      provided: false,
      expected: 'read-only pg_catalog fingerprint',
      actual: 'unavailable',
    });
  }
  if (!input.backupEvidence) {
    missing.push({
      key: 'backup-or-disposable-target-evidence',
      required: true,
      provided: false,
      expected: 'backup path, disposable DB note, or staging clone evidence',
      actual: null,
    });
  }
  if (input.productionSignals.length > 0) {
    missing.push({
      key: 'non-production-target-clearance',
      required: true,
      provided: false,
      expected: 'no production-like signals',
      actual: input.productionSignals.map((signal) => signal.key).join(', '),
    });
  }
  return missing;
}

function chooseStatus(input: {
  schemaWorklist: Artifact;
  baselineProposal: Artifact;
  dbFingerprint: DbFingerprintResult;
  effectiveScope: TargetScope | null;
  productionSignals: Array<{ key: string; severity: string; detail: string }>;
  missingInputs: Array<Record<string, unknown>>;
}): PreflightStatus {
  if (input.schemaWorklist.status === 'PASS')
    return 'PASS_NO_DB_MIGRATION_BLOCKER';
  if (!input.dbFingerprint.ok) return 'BLOCKED_DATABASE_UNAVAILABLE';
  if (!input.effectiveScope) return 'BLOCKED_UNSUPPORTED_TARGET_SCOPE';
  if (input.productionSignals.length > 0) {
    return 'BLOCKED_REMOTE_OR_PRODUCTION_LIKE_TARGET';
  }
  if (
    input.missingInputs.some(
      (item) => item.key === 'backup-or-disposable-target-evidence',
    )
  ) {
    return 'BLOCKED_BACKUP_EVIDENCE_REQUIRED';
  }
  return 'REVIEW_BASELINE_SCOPE_PREFLIGHT_READY';
}

function buildBaselineResolutionInputHint(
  status: PreflightStatus,
  effectiveScope: TargetScope | null,
  backupEvidence: string | null,
) {
  const scope =
    effectiveScope ?? '<local-existing|local-disposable|staging-clone>';
  return {
    readyForApprovalGate: status === 'REVIEW_BASELINE_SCOPE_PREFLIGHT_READY',
    auditOnlyCommandTemplate:
      `pnpm --filter api audit:database-migration-baseline-resolution -- ` +
      `--checksum-review /tmp/database-migration-checksum-review-latest.json ` +
      `--external-artifact-packet /tmp/database-migration-external-artifact-packet-archive-latest.json ` +
      `--decision baseline-resolve-local-only ` +
      `--target-scope ${scope} ` +
      `--approved-operator-workflow <approved workflow id> ` +
      `--operator-ack APPROVED_DATABASE_MIGRATION_BASELINE_RESOLVE ` +
      `--rationale <why exact SQL cannot be recovered and why this target may be resolved> ` +
      `--backup-evidence ${backupEvidence ? '<provided backup evidence>' : '<backup/disposable/staging clone evidence>'}`,
  };
}

function buildRecommendedSequence(status: PreflightStatus) {
  if (status === 'PASS_NO_DB_MIGRATION_BLOCKER') {
    return [
      'Rerun platform data closure audit and continue DB-backed campaigns.',
    ];
  }
  if (status === 'BLOCKED_DATABASE_UNAVAILABLE') {
    return [
      'Make the target database reachable before a baseline scope can be evaluated.',
      'Rerun this preflight before any baseline-resolution approval attempt.',
    ];
  }
  if (
    status === 'BLOCKED_REMOTE_OR_PRODUCTION_LIKE_TARGET' ||
    status === 'BLOCKED_UNSUPPORTED_TARGET_SCOPE'
  ) {
    return [
      'Use only a local existing DB, local disposable DB, or staging clone for baseline review.',
      'Do not run Prisma resolve/deploy against production or remote unknown targets.',
    ];
  }
  if (status === 'BLOCKED_BACKUP_EVIDENCE_REQUIRED') {
    return [
      'Attach backup evidence, disposable DB evidence, or staging clone evidence.',
      'Then rerun this preflight and the baseline-resolution gate with explicit operator approval inputs.',
    ];
  }
  return [
    'Use this preflight as supporting evidence for the separate baseline-resolution approval gate.',
    'Run any Prisma resolve/deploy steps only outside read-only audit scripts and only after approval.',
    'Rerun schema compatibility and platform closure audit after operator action.',
  ];
}

function buildNextCampaign(status: PreflightStatus) {
  if (status === 'REVIEW_BASELINE_SCOPE_PREFLIGHT_READY') {
    return {
      id: 'database_migration_baseline_resolution_approval',
      reason:
        'Baseline target scope preflight is ready; explicit operator approval gate is still required.',
    };
  }
  if (status === 'BLOCKED_BACKUP_EVIDENCE_REQUIRED') {
    return {
      id: 'database_migration_backup_or_disposable_target_evidence',
      reason:
        'The target appears non-production, but backup/disposable/staging-clone evidence is missing.',
    };
  }
  return {
    id: 'database_migration_external_artifact_or_baseline_approval',
    reason:
      'Exact SQL is still absent and baseline scope is not yet ready for approval.',
  };
}

function renderMarkdown(report: Record<string, any>) {
  const summary = report.summary as Record<string, unknown>;
  const lines = [
    '# Database Migration Baseline Scope Preflight',
    '',
    `Status: ${report.status}`,
    '',
    'This is read-only. It does not approve a baseline, restore migration files, dump data, or run Prisma resolve/deploy.',
    '',
    '## Summary',
    '',
    `- Schema worklist: ${summary.schemaWorklistStatus ?? 'unknown'}`,
    `- Baseline proposal: ${summary.baselineProposalStatus ?? 'unknown'}`,
    `- Inferred target scope: ${summary.inferredTargetScope ?? 'unknown'} (${summary.inferredTargetReason ?? 'unknown'})`,
    `- Effective target scope: ${summary.effectiveTargetScope ?? 'unknown'}`,
    `- DB readable: ${summary.dbReadable}`,
    `- Data bearing: ${summary.dataBearing}`,
    `- Public tables / estimated rows: ${summary.publicTableCount ?? 0}/${summary.estimatedRowCount ?? 0}`,
    `- Backup evidence provided: ${summary.backupEvidenceProvided}`,
    `- Production signal count: ${summary.productionSignalCount ?? 0}`,
    `- Missing required inputs: ${summary.missingRequiredInputs ?? 0}`,
    '',
    '## Missing Required Inputs',
    '',
    ...(report.missingRequiredInputs.length
      ? report.missingRequiredInputs.map(
          (item: Record<string, unknown>) =>
            `- ${item.key}: expected ${item.expected}; actual ${item.actual ?? 'missing'}`,
        )
      : ['- none']),
    '',
    '## Recommended Sequence',
    '',
    ...report.recommendedSequence.map((item: string) => `- ${item}`),
  ];
  return `${lines.join('\n')}\n`;
}

function printSummary(
  out: string,
  markdown: string,
  report: { status: string; summary: Record<string, unknown> },
) {
  console.log(
    [
      `Database migration baseline scope preflight status: ${report.status}`,
      `Effective target scope: ${report.summary.effectiveTargetScope}`,
      `Missing required inputs: ${report.summary.missingRequiredInputs}`,
      `JSON: ${out}`,
      `Markdown: ${markdown}`,
    ].join('\n'),
  );
}

function redactDatabaseUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.password) url.password = 'REDACTED';
    if (url.username) url.username = 'REDACTED';
    return url.toString();
  } catch {
    return '<unparseable DATABASE_URL>';
  }
}

function containsAny(value: string, needles: string[]) {
  const lower = value.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function numberOrZero(value: unknown) {
  return Number(value ?? 0);
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

main();
