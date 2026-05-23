#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';

type PlanStatus =
  | 'PASS'
  | 'REVIEW'
  | 'READY_FOR_CONTROLLED_MIGRATE_DEPLOY'
  | 'BLOCKED_DATABASE_UNAVAILABLE'
  | 'BLOCKED_DIVERGENT_MIGRATION_HISTORY'
  | 'BLOCKED_SCHEMA_DRIFT_WITHOUT_REPO_MIGRATION';

type SchemaBlocker =
  | 'missing_table'
  | 'missing_column'
  | 'unapplied_repo_migration'
  | 'applied_migration_missing_from_repo'
  | 'extra_db_table'
  | 'extra_db_column'
  | 'database_unavailable';

interface Args {
  worklist: string;
  out: string;
  markdown: string;
}

interface WorklistRow {
  blocker: SchemaBlocker;
  objectType: string;
  model?: string;
  table?: string;
  column?: string;
  prismaField?: string;
  migration?: string;
  severity?: string;
  status?: string;
}

interface WorklistReport {
  generatedAt: string;
  status: string;
  inputs?: {
    database?: Record<string, unknown>;
    prismaSchema?: Record<string, unknown>;
  };
  dbSchema?: {
    latestAppliedMigration?: string | null;
    latestRepoMigration?: string | null;
    appliedMigrationCount?: number;
    repoMigrationCount?: number;
  } | null;
  summary?: Record<string, number>;
  rows: WorklistRow[];
}

interface MigrationSignal {
  migration: string;
  createsTables: string[];
  addsColumns: Array<{ table: string; column: string }>;
  touchesTables: string[];
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
  const defaultOut = path.join(
    REPORT_ROOT,
    `database-schema-alignment-plan-${stamp}.json`,
  );
  const out = path.resolve(API_ROOT, get('--out', defaultOut)!);
  const worklist = get('--worklist');
  return {
    worklist: path.resolve(API_ROOT, worklist ?? findLatestSchemaWorklist()),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
  };
}

function main() {
  const args = parseArgs();
  const report = JSON.parse(
    fs.readFileSync(args.worklist, 'utf8'),
  ) as WorklistReport;
  const repoMigrations = listRepoMigrations();
  const migrationSignals = repoMigrations.map(readMigrationSignal);
  const rows = report.rows ?? [];
  const rowsByBlocker = groupRowsByBlocker(rows);
  const unappliedMigrations = rowsByBlocker.unapplied_repo_migration
    .map((row) => row.migration)
    .filter(isPresent)
    .sort();
  const appliedMigrationsMissingFromRepo =
    rowsByBlocker.applied_migration_missing_from_repo
      .map((row) => row.migration)
      .filter(isPresent)
      .sort();
  const missingTables = rowsByBlocker.missing_table;
  const missingColumns = rowsByBlocker.missing_column;
  const migrationBackedMissingTables = annotateMissingTables(
    missingTables,
    migrationSignals,
    unappliedMigrations,
  );
  const migrationBackedMissingColumns = annotateMissingColumns(
    missingColumns,
    migrationSignals,
    unappliedMigrations,
  );
  const missingObjectsWithoutRepoMigration = [
    ...migrationBackedMissingTables.filter(
      (item) => item.coveredByMigrations.length === 0,
    ),
    ...migrationBackedMissingColumns.filter(
      (item) => item.coveredByMigrations.length === 0,
    ),
  ];

  const lastCommonMigration = findLastCommonMigration(
    repoMigrations,
    new Set(unappliedMigrations),
  );
  const status = chooseStatus({
    rowsByBlocker,
    unappliedMigrations,
    appliedMigrationsMissingFromRepo,
    missingObjectsWithoutRepoMigration,
  });
  const plan = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-schema-alignment-plan',
    status,
    sourceWorklist: path.relative(API_ROOT, args.worklist),
    inputs: {
      database: report.inputs?.database ?? null,
      prismaSchema: report.inputs?.prismaSchema ?? null,
      dbSchema: report.dbSchema ?? null,
      worklistGeneratedAt: report.generatedAt,
      worklistStatus: report.status,
    },
    summary: {
      rows: rows.length,
      missingTables: missingTables.length,
      missingColumns: missingColumns.length,
      unappliedRepoMigrations: unappliedMigrations.length,
      appliedMigrationsMissingFromRepo: appliedMigrationsMissingFromRepo.length,
      missingObjectsWithoutRepoMigration:
        missingObjectsWithoutRepoMigration.length,
      lastCommonMigration,
      firstUnappliedRepoMigration: unappliedMigrations[0] ?? null,
      latestRepoMigration: repoMigrations.at(-1) ?? null,
    },
    riskAssessment: buildRiskAssessment({
      status,
      rowsByBlocker,
      missingObjectsWithoutRepoMigration,
      lastCommonMigration,
    }),
    migrationCoverage: {
      missingTables: migrationBackedMissingTables,
      missingColumns: migrationBackedMissingColumns,
    },
    migrationHistory: {
      unappliedRepoMigrations: unappliedMigrations,
      appliedMigrationsMissingFromRepo,
    },
    recommendedSequence: buildRecommendedSequence(status),
    verificationCommands: buildVerificationCommands(args.worklist),
    nextCampaign:
      status === 'PASS'
        ? {
            id: 'platform-data-closure-audit',
            reason:
              'Schema alignment plan has no blocking rows; rerun the platform audit and continue with the next P0/P1 data domain.',
          }
        : {
            id: 'database_schema_compatibility',
            reason:
              'DB-backed data campaigns remain blocked until schema compatibility is resolved or explicitly reviewed.',
          },
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(plan, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(plan), 'utf8');
  printSummary(args.out, args.markdown, plan);
}

function findLatestSchemaWorklist() {
  if (!fs.existsSync(REPORT_ROOT)) {
    throw new Error(
      'No --worklist provided and scripts/closure-reports does not exist',
    );
  }
  const latest = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) =>
      /^database-schema-compatibility-worklist-.+\.json$/.test(file),
    )
    .map((file) => ({
      file,
      mtimeMs: fs.statSync(path.join(REPORT_ROOT, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  if (!latest) {
    throw new Error('No --worklist provided and no schema worklist found');
  }
  return path.join(REPORT_ROOT, latest.file);
}

function groupRowsByBlocker(rows: WorklistRow[]) {
  const buckets: Record<SchemaBlocker, WorklistRow[]> = {
    missing_table: [],
    missing_column: [],
    unapplied_repo_migration: [],
    applied_migration_missing_from_repo: [],
    extra_db_table: [],
    extra_db_column: [],
    database_unavailable: [],
  };
  for (const row of rows) {
    if (row.blocker in buckets) buckets[row.blocker].push(row);
  }
  return buckets;
}

function listRepoMigrations() {
  const migrationRoot = path.join(API_ROOT, 'prisma', 'migrations');
  if (!fs.existsSync(migrationRoot)) return [];
  return fs
    .readdirSync(migrationRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function readMigrationSignal(migration: string): MigrationSignal {
  const sqlPath = path.join(
    API_ROOT,
    'prisma',
    'migrations',
    migration,
    'migration.sql',
  );
  const sql = fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, 'utf8') : '';
  const createsTables = collectMatches(
    sql,
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w]+"?)/gi,
  ).map(unquoteIdent);
  const addsColumns = Array.from(
    sql.matchAll(/ALTER\s+TABLE\s+("?[\w]+"?)([\s\S]*?);/gi),
  ).flatMap((tableMatch) => {
    const table = unquoteIdent(tableMatch[1]);
    const body = tableMatch[2];
    return Array.from(
      body.matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w]+"?)/gi),
    ).map((columnMatch) => ({
      table,
      column: unquoteIdent(columnMatch[1]),
    }));
  });
  const touchesTables = Array.from(
    new Set([
      ...createsTables,
      ...addsColumns.map((column) => column.table),
      ...collectMatches(sql, /ALTER\s+TABLE\s+("?[\w]+"?)/gi).map(unquoteIdent),
      ...collectMatches(sql, /CREATE\s+INDEX.+?\s+ON\s+("?[\w]+"?)/gi).map(
        unquoteIdent,
      ),
    ]),
  ).sort();
  return { migration, createsTables, addsColumns, touchesTables };
}

function collectMatches(sql: string, regex: RegExp) {
  return Array.from(sql.matchAll(regex)).map((match) => match[1]);
}

function unquoteIdent(identifier: string) {
  return identifier.replace(/^"|"$/g, '');
}

function annotateMissingTables(
  rows: WorklistRow[],
  signals: MigrationSignal[],
  unappliedMigrations: string[],
) {
  const unapplied = new Set(unappliedMigrations);
  return rows
    .map((row) => {
      const table = row.table ?? '';
      const coveredByMigrations = signals
        .filter(
          (signal) =>
            unapplied.has(signal.migration) &&
            (signal.createsTables.includes(table) ||
              signal.touchesTables.includes(table)),
        )
        .map((signal) => signal.migration);
      return {
        table,
        model: row.model ?? null,
        coveredByMigrations,
        disposition:
          coveredByMigrations.length > 0
            ? 'migration-backed'
            : 'manual-schema-review',
      };
    })
    .sort(compareCoverageRows);
}

function annotateMissingColumns(
  rows: WorklistRow[],
  signals: MigrationSignal[],
  unappliedMigrations: string[],
) {
  const unapplied = new Set(unappliedMigrations);
  return rows
    .map((row) => {
      const table = row.table ?? '';
      const column = row.column ?? '';
      const coveredByMigrations = signals
        .filter(
          (signal) =>
            unapplied.has(signal.migration) &&
            signal.addsColumns.some(
              (added) => added.table === table && added.column === column,
            ),
        )
        .map((signal) => signal.migration);
      return {
        table,
        column,
        model: row.model ?? null,
        prismaField: row.prismaField ?? null,
        coveredByMigrations,
        disposition:
          coveredByMigrations.length > 0
            ? 'migration-backed'
            : 'manual-schema-review',
      };
    })
    .sort(compareCoverageRows);
}

function compareCoverageRows(
  a: { table: string; column?: string },
  b: { table: string; column?: string },
) {
  return (
    a.table.localeCompare(b.table) ||
    (a.column ?? '').localeCompare(b.column ?? '')
  );
}

function findLastCommonMigration(
  repoMigrations: string[],
  unappliedMigrations: Set<string>,
) {
  return (
    repoMigrations
      .filter((migration) => !unappliedMigrations.has(migration))
      .at(-1) ?? null
  );
}

function chooseStatus(input: {
  rowsByBlocker: Record<SchemaBlocker, WorklistRow[]>;
  unappliedMigrations: string[];
  appliedMigrationsMissingFromRepo: string[];
  missingObjectsWithoutRepoMigration: unknown[];
}): PlanStatus {
  if (input.rowsByBlocker.database_unavailable.length > 0) {
    return 'BLOCKED_DATABASE_UNAVAILABLE';
  }
  if (input.appliedMigrationsMissingFromRepo.length > 0) {
    return 'BLOCKED_DIVERGENT_MIGRATION_HISTORY';
  }
  if (input.missingObjectsWithoutRepoMigration.length > 0) {
    return 'BLOCKED_SCHEMA_DRIFT_WITHOUT_REPO_MIGRATION';
  }
  if (input.unappliedMigrations.length > 0) {
    return 'READY_FOR_CONTROLLED_MIGRATE_DEPLOY';
  }
  if (
    input.rowsByBlocker.extra_db_table.length > 0 ||
    input.rowsByBlocker.extra_db_column.length > 0
  ) {
    return 'REVIEW';
  }
  return 'PASS';
}

function buildRiskAssessment(input: {
  status: PlanStatus;
  rowsByBlocker: Record<SchemaBlocker, WorklistRow[]>;
  missingObjectsWithoutRepoMigration: unknown[];
  lastCommonMigration: string | null;
}) {
  const risks: string[] = [];
  const blockers: string[] = [];
  if (input.status === 'BLOCKED_DATABASE_UNAVAILABLE') {
    blockers.push('The configured database target is not reachable.');
  }
  if (input.rowsByBlocker.applied_migration_missing_from_repo.length > 0) {
    blockers.push(
      'The target database has applied migrations that are absent from the repo migration directory.',
    );
    risks.push(
      'Blindly running migrate deploy against a valuable database could compound a divergent migration history.',
    );
  }
  if (input.rowsByBlocker.unapplied_repo_migration.length > 0) {
    blockers.push(
      `${input.rowsByBlocker.unapplied_repo_migration.length} repo migrations are not recorded as applied in the target database.`,
    );
  }
  if (input.missingObjectsWithoutRepoMigration.length > 0) {
    blockers.push(
      `${input.missingObjectsWithoutRepoMigration.length} missing schema objects were not matched to an unapplied migration SQL signal.`,
    );
  }
  if (input.lastCommonMigration) {
    risks.push(`Last common migration: ${input.lastCommonMigration}.`);
  }
  return {
    destructiveDbWriteAllowedByThisPlan: false,
    blockers,
    risks,
    decision:
      input.status === 'READY_FOR_CONTROLLED_MIGRATE_DEPLOY'
        ? 'A controlled migration deploy can be reviewed after backup/clone confirmation.'
        : input.status === 'PASS'
          ? 'No schema alignment action is required before rerunning DB-backed audits.'
          : 'Resolve or explicitly review blockers before DB-backed data closure can proceed.',
  };
}

function buildRecommendedSequence(status: PlanStatus) {
  if (status === 'BLOCKED_DATABASE_UNAVAILABLE') {
    return [
      'Start or repoint the configured Postgres target.',
      'Rerun audit:database-schema-compatibility against the intended database.',
      'Generate this alignment plan again from the fresh worklist.',
    ];
  }
  const base = [
    'Confirm the target database is the intended local/staging database, not production.',
    'Create a backup or disposable clone before any schema write.',
  ];
  if (status === 'BLOCKED_DIVERGENT_MIGRATION_HISTORY') {
    return [
      ...base,
      'Restore or review the DB-applied migration files that are missing from the repo, or document an explicit baseline/resolve decision.',
      'Do not run migrate deploy against valuable data until migration history divergence is resolved.',
      'After reconciliation, rerun audit:database-schema-compatibility and this alignment plan.',
    ];
  }
  if (status === 'READY_FOR_CONTROLLED_MIGRATE_DEPLOY') {
    return [
      ...base,
      'Review the unapplied migration SQL range.',
      'Run migrate deploy only on the approved local/staging target.',
      'Rerun schema compatibility, platform closure, and the previously blocked DB-backed worklists.',
    ];
  }
  if (status === 'BLOCKED_SCHEMA_DRIFT_WITHOUT_REPO_MIGRATION') {
    return [
      ...base,
      'Inspect missing tables/columns that were not matched to migration SQL.',
      'Create or restore the missing migration source before applying schema changes.',
      'Rerun schema compatibility after migration source is complete.',
    ];
  }
  if (status === 'REVIEW') {
    return [
      'Review extra DB objects and either accept them as local-only or reconcile schema/docs.',
      'Rerun platform data closure after disposition is recorded.',
    ];
  }
  return ['Rerun platform data closure and continue the next P0/P1 campaign.'];
}

function buildVerificationCommands(worklist: string) {
  return [
    'pnpm --filter api audit:database-schema-compatibility -- --out /tmp/database-schema-compatibility.json --db-timeout-ms 8000',
    `pnpm --filter api audit:database-schema-alignment-plan -- --worklist ${worklist} --out /tmp/database-schema-alignment-plan.json`,
    'pnpm --filter api audit:platform-data-closure -- --out /tmp/platform-data-closure.json --db-timeout-ms 8000',
    'pnpm --filter api audit:profile-readiness-worklist -- --out /tmp/profile-readiness-worklist.json --limit 3000',
  ];
}

function renderMarkdown(plan: ReturnType<typeof buildPlanShape>) {
  const lines = [
    '# Database Schema Alignment Plan',
    '',
    `Status: ${plan.status}`,
    `Generated at: ${plan.generatedAt}`,
    `Source worklist: ${plan.sourceWorklist}`,
    '',
    '## Summary',
    '',
    `- Rows: ${plan.summary.rows}`,
    `- Missing tables: ${plan.summary.missingTables}`,
    `- Missing columns: ${plan.summary.missingColumns}`,
    `- Unapplied repo migrations: ${plan.summary.unappliedRepoMigrations}`,
    `- Applied migrations missing from repo: ${plan.summary.appliedMigrationsMissingFromRepo}`,
    `- Missing objects without repo migration signal: ${plan.summary.missingObjectsWithoutRepoMigration}`,
    `- Last common migration: ${plan.summary.lastCommonMigration ?? 'unknown'}`,
    '',
    '## Risk Assessment',
    '',
    `- Destructive DB write allowed by this plan: ${plan.riskAssessment.destructiveDbWriteAllowedByThisPlan}`,
    `- Decision: ${plan.riskAssessment.decision}`,
    ...plan.riskAssessment.blockers.map((item) => `- Blocker: ${item}`),
    ...plan.riskAssessment.risks.map((item) => `- Risk: ${item}`),
    '',
    '## Recommended Sequence',
    '',
    ...plan.recommendedSequence.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Verification Commands',
    '',
    ...plan.verificationCommands.map((command) => `- \`${command}\``),
    '',
    '## Top Migration History Rows',
    '',
    ...plan.migrationHistory.unappliedRepoMigrations
      .slice(0, 20)
      .map((migration) => `- Unapplied repo migration: ${migration}`),
    ...plan.migrationHistory.appliedMigrationsMissingFromRepo
      .slice(0, 20)
      .map(
        (migration) => `- Applied DB migration missing from repo: ${migration}`,
      ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function buildPlanShape() {
  return {
    generatedAt: '',
    status: 'PASS' as PlanStatus,
    sourceWorklist: '',
    summary: {
      rows: 0,
      missingTables: 0,
      missingColumns: 0,
      unappliedRepoMigrations: 0,
      appliedMigrationsMissingFromRepo: 0,
      missingObjectsWithoutRepoMigration: 0,
      lastCommonMigration: null as string | null,
      firstUnappliedRepoMigration: null as string | null,
      latestRepoMigration: null as string | null,
    },
    riskAssessment: {
      destructiveDbWriteAllowedByThisPlan: false,
      blockers: [] as string[],
      risks: [] as string[],
      decision: '',
    },
    recommendedSequence: [] as string[],
    verificationCommands: [] as string[],
    migrationHistory: {
      unappliedRepoMigrations: [] as string[],
      appliedMigrationsMissingFromRepo: [] as string[],
    },
  };
}

function printSummary(
  out: string,
  markdown: string,
  plan: ReturnType<typeof buildPlanShape>,
) {
  console.log(
    [
      `Database schema alignment plan status: ${plan.status}`,
      `Rows: ${plan.summary.rows}`,
      `Unapplied repo migrations: ${plan.summary.unappliedRepoMigrations}`,
      `Applied migrations missing from repo: ${plan.summary.appliedMigrationsMissingFromRepo}`,
      `Missing objects without repo migration signal: ${plan.summary.missingObjectsWithoutRepoMigration}`,
      `JSON: ${out}`,
      `Markdown: ${markdown}`,
    ].join('\n'),
  );
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined && value !== '';
}

main();
