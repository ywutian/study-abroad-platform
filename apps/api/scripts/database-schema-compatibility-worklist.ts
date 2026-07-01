#!/usr/bin/env tsx
import 'dotenv/config';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

type Severity = 'critical' | 'warning' | 'info';
type WorklistAction =
  'apply-migration-or-align-db' | 'review-extra-db-object' | 'accept';
type WorklistStatus = 'PASS' | 'REVIEW' | 'BLOCKED';

interface Args {
  out: string;
  schemaPath: string;
  dbTimeoutMs: number;
}

interface PrismaField {
  name: string;
  columnName: string;
  type: string;
  isEnum: boolean;
  isList: boolean;
  isOptional: boolean;
}

interface PrismaModel {
  name: string;
  tableName: string;
  fields: PrismaField[];
}

interface DbColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
}

interface MigrationRow {
  id: string;
  checksum: string;
  migration_name: string;
  logs: string | null;
  started_at: Date;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
}

type InspectDatabaseResult =
  | {
      ok: true;
      tables: string[];
      columns: DbColumn[];
      appliedMigrations: MigrationRow[];
      repoMigrations: string[];
    }
  | { ok: false; error: string };

interface WorklistRow {
  domain: 'database_schema_compatibility' | 'database_audit_availability';
  severity: Severity;
  objectType: 'table' | 'column' | 'migration' | 'database';
  blocker:
    | 'missing_table'
    | 'missing_column'
    | 'unapplied_repo_migration'
    | 'applied_migration_missing_from_repo'
    | 'extra_db_table'
    | 'extra_db_column'
    | 'database_unavailable';
  action: WorklistAction;
  status: 'OPEN' | 'REVIEW' | 'ACCEPTED';
  model?: string;
  table?: string;
  prismaField?: string;
  column?: string;
  migration?: string;
  evidence: Record<string, unknown>;
  rationale: string;
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const SCALAR_TYPES = new Set([
  'String',
  'Boolean',
  'Int',
  'BigInt',
  'Float',
  'Decimal',
  'DateTime',
  'Json',
  'Bytes',
]);
const SYSTEM_TABLES = new Set(['_prisma_migrations']);

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
  return {
    out: path.resolve(
      API_ROOT,
      get(
        '--out',
        path.join(
          REPORT_ROOT,
          `database-schema-compatibility-worklist-${stamp}.json`,
        ),
      )!,
    ),
    schemaPath: path.resolve(
      API_ROOT,
      get('--schema', path.join(API_ROOT, 'prisma', 'schema.prisma'))!,
    ),
    dbTimeoutMs: Number(get('--db-timeout-ms', '15000')),
  };
}

async function main() {
  const args = parseArgs();
  const schema = parsePrismaSchema(args.schemaPath);
  const dbResult: InspectDatabaseResult = await withTimeout(
    inspectDatabase(),
    args.dbTimeoutMs,
  ).catch((error) => ({
    ok: false as const,
    error: summarizeError(error),
  }));

  if (dbResult.ok === false) {
    writeReport(args, schema, {
      status: 'BLOCKED',
      database: {
        attempted: true,
        available: false,
        target: redactDatabaseUrl(process.env.DATABASE_URL),
        error: dbResult.error,
      },
      dbSchema: null,
      summary: {
        missingTables: 0,
        missingColumns: 0,
        unappliedRepoMigrations: 0,
        appliedMigrationsMissingFromRepo: 0,
        extraDbTables: 0,
        extraDbColumns: 0,
      },
      rows: [
        {
          domain: 'database_audit_availability',
          severity: 'critical',
          objectType: 'database',
          blocker: 'database_unavailable',
          action: 'apply-migration-or-align-db',
          status: 'OPEN',
          evidence: {
            databaseUrl: redactDatabaseUrl(process.env.DATABASE_URL),
            dbTimeoutMs: args.dbTimeoutMs,
          },
          rationale:
            'Prisma could not connect, so DB-backed P0/P1 closure gates cannot run.',
        },
      ],
    });
    return;
  }

  const rows = buildRows(schema, dbResult);
  const criticalCount = rows.filter(
    (row) => row.severity === 'critical',
  ).length;
  const warningCount = rows.filter((row) => row.severity === 'warning').length;
  const status: WorklistStatus =
    criticalCount > 0 ? 'BLOCKED' : warningCount > 0 ? 'REVIEW' : 'PASS';

  writeReport(args, schema, {
    status,
    database: {
      attempted: true,
      available: true,
      target: redactDatabaseUrl(process.env.DATABASE_URL),
      error: null,
    },
    dbSchema: {
      tableCount: dbResult.tables.length,
      columnCount: dbResult.columns.length,
      appliedMigrationCount: dbResult.appliedMigrations.length,
      latestAppliedMigration:
        dbResult.appliedMigrations.at(-1)?.migration_name ?? null,
      repoMigrationCount: dbResult.repoMigrations.length,
      latestRepoMigration: dbResult.repoMigrations.at(-1) ?? null,
    },
    summary: {
      missingTables: rows.filter((row) => row.blocker === 'missing_table')
        .length,
      missingColumns: rows.filter((row) => row.blocker === 'missing_column')
        .length,
      unappliedRepoMigrations: rows.filter(
        (row) => row.blocker === 'unapplied_repo_migration',
      ).length,
      appliedMigrationsMissingFromRepo: rows.filter(
        (row) => row.blocker === 'applied_migration_missing_from_repo',
      ).length,
      extraDbTables: rows.filter((row) => row.blocker === 'extra_db_table')
        .length,
      extraDbColumns: rows.filter((row) => row.blocker === 'extra_db_column')
        .length,
    },
    rows,
  });
}

function parsePrismaSchema(schemaPath: string) {
  const content = fs.readFileSync(schemaPath, 'utf8');
  const enumNames = new Set(
    Array.from(content.matchAll(/^enum\s+(\w+)\s*\{/gm)).map(
      (match) => match[1],
    ),
  );
  const lines = content.split(/\r?\n/);
  const models: PrismaModel[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const start = stripComment(lines[index])
      .trim()
      .match(/^model\s+(\w+)\s*\{/);
    if (!start) continue;

    const modelName = start[1];
    const block: string[] = [];
    index += 1;
    while (index < lines.length && stripComment(lines[index]).trim() !== '}') {
      block.push(lines[index]);
      index += 1;
    }

    if (block.some((line) => stripComment(line).trim() === '@@ignore')) {
      continue;
    }

    const tableName =
      block
        .map((line) =>
          stripComment(line)
            .trim()
            .match(/@@map\("([^"]+)"\)/),
        )
        .find(Boolean)?.[1] ?? modelName;

    const fields = block.flatMap((line) => {
      const field = parsePrismaField(line, enumNames);
      return field ? [field] : [];
    });
    models.push({ name: modelName, tableName, fields });
  }

  return {
    path: schemaPath,
    enumCount: enumNames.size,
    models,
    scalarFieldCount: models.reduce(
      (sum, model) => sum + model.fields.length,
      0,
    ),
  };
}

function parsePrismaField(
  line: string,
  enumNames: Set<string>,
): PrismaField | null {
  const stripped = stripComment(line).trim();
  if (!stripped || stripped.startsWith('@@') || stripped.startsWith('@')) {
    return null;
  }

  const parts = stripped.split(/\s+/);
  if (parts.length < 2) return null;
  const [name, rawType] = parts;
  if (!/^\w+$/.test(name)) return null;
  if (stripped.includes('@ignore') || stripped.includes('@relation'))
    return null;

  const isList = rawType.includes('[]');
  const isOptional = rawType.endsWith('?');
  const baseType = rawType.replace(/[?\[\]]/g, '');
  const isUnsupported = rawType.startsWith('Unsupported(');
  const isEnum = enumNames.has(baseType);
  const isScalar = SCALAR_TYPES.has(baseType) || isEnum || isUnsupported;
  if (!isScalar) return null;

  const columnName = stripped.match(/@map\("([^"]+)"\)/)?.[1] ?? name;
  return {
    name,
    columnName,
    type: isUnsupported ? rawType : baseType,
    isEnum,
    isList,
    isOptional,
  };
}

function stripComment(line: string) {
  const index = line.indexOf('//');
  return index >= 0 ? line.slice(0, index) : line;
}

async function inspectDatabase() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `;
    const columns = await prisma.$queryRaw<DbColumn[]>`
      SELECT table_name, column_name, data_type, udt_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name ASC, ordinal_position ASC
    `;
    const tableNames = new Set(tables.map((table) => table.table_name));
    const appliedMigrations = tableNames.has('_prisma_migrations')
      ? await prisma.$queryRaw<MigrationRow[]>`
          SELECT id, checksum, migration_name, logs, started_at, finished_at, rolled_back_at, applied_steps_count
          FROM "_prisma_migrations"
          WHERE rolled_back_at IS NULL
          ORDER BY started_at ASC
        `
      : [];

    return {
      ok: true as const,
      tables: tables.map((table) => table.table_name),
      columns,
      appliedMigrations,
      repoMigrations: listRepoMigrations(),
    };
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

function buildRows(
  schema: ReturnType<typeof parsePrismaSchema>,
  db: Awaited<ReturnType<typeof inspectDatabase>>,
): WorklistRow[] {
  if (!db.ok) return [];

  const rows: WorklistRow[] = [];
  const dbTables = new Set(db.tables);
  const dbColumnsByTable = new Map<string, Set<string>>();
  const expectedColumnsByTable = new Map<string, Set<string>>();
  for (const column of db.columns) {
    const current =
      dbColumnsByTable.get(column.table_name) ?? new Set<string>();
    current.add(column.column_name);
    dbColumnsByTable.set(column.table_name, current);
  }

  for (const model of schema.models) {
    expectedColumnsByTable.set(
      model.tableName,
      new Set(model.fields.map((field) => field.columnName)),
    );
    if (!dbTables.has(model.tableName)) {
      rows.push({
        domain: 'database_schema_compatibility',
        severity: 'critical',
        objectType: 'table',
        blocker: 'missing_table',
        action: 'apply-migration-or-align-db',
        status: 'OPEN',
        model: model.name,
        table: model.tableName,
        evidence: {
          prismaModel: model.name,
          expectedTable: model.tableName,
          expectedColumns: model.fields.length,
        },
        rationale:
          'The Prisma model has no matching database table, so generated Prisma queries can fail before data closure audits run.',
      });
      continue;
    }

    const dbColumns =
      dbColumnsByTable.get(model.tableName) ?? new Set<string>();
    for (const field of model.fields) {
      if (dbColumns.has(field.columnName)) continue;
      rows.push({
        domain: 'database_schema_compatibility',
        severity: 'critical',
        objectType: 'column',
        blocker: 'missing_column',
        action: 'apply-migration-or-align-db',
        status: 'OPEN',
        model: model.name,
        table: model.tableName,
        prismaField: field.name,
        column: field.columnName,
        evidence: {
          prismaModel: model.name,
          prismaField: field.name,
          prismaType: field.type,
          expectedColumn: field.columnName,
        },
        rationale:
          'The Prisma field has no matching database column, so DB-backed campaign worklists can abort mid-query.',
      });
    }
  }

  const appliedMigrationNames = new Set(
    db.appliedMigrations.map((migration) => migration.migration_name),
  );
  const repoMigrationNames = new Set(db.repoMigrations);
  for (const migration of db.repoMigrations) {
    if (appliedMigrationNames.has(migration)) continue;
    rows.push({
      domain: 'database_schema_compatibility',
      severity: 'critical',
      objectType: 'migration',
      blocker: 'unapplied_repo_migration',
      action: 'apply-migration-or-align-db',
      status: 'OPEN',
      migration,
      evidence: {
        migration,
        latestAppliedMigration:
          db.appliedMigrations.at(-1)?.migration_name ?? null,
      },
      rationale:
        'A repo migration is not recorded in the target database migration table.',
    });
  }
  for (const migration of db.appliedMigrations) {
    if (repoMigrationNames.has(migration.migration_name)) continue;
    rows.push({
      domain: 'database_schema_compatibility',
      severity: 'warning',
      objectType: 'migration',
      blocker: 'applied_migration_missing_from_repo',
      action: 'review-extra-db-object',
      status: 'REVIEW',
      migration: migration.migration_name,
      evidence: {
        migration: migration.migration_name,
        checksum: migration.checksum,
        startedAt: migration.started_at,
        finishedAt: migration.finished_at,
        appliedStepsCount: migration.applied_steps_count,
        logsPresent: Boolean(migration.logs),
      },
      rationale:
        'The target database records an applied migration that is not present in the current repo migrations directory.',
    });
  }

  const expectedTables = new Set(schema.models.map((model) => model.tableName));
  for (const table of db.tables) {
    if (expectedTables.has(table) || SYSTEM_TABLES.has(table)) continue;
    rows.push({
      domain: 'database_schema_compatibility',
      severity: 'warning',
      objectType: 'table',
      blocker: 'extra_db_table',
      action: 'review-extra-db-object',
      status: 'REVIEW',
      table,
      evidence: { table },
      rationale:
        'The database has a table that is not represented by the current Prisma schema.',
    });
  }

  for (const [table, dbColumns] of Array.from(dbColumnsByTable.entries())) {
    if (!expectedTables.has(table)) continue;
    const expectedColumns =
      expectedColumnsByTable.get(table) ?? new Set<string>();
    for (const column of dbColumns) {
      if (expectedColumns.has(column)) continue;
      rows.push({
        domain: 'database_schema_compatibility',
        severity: 'warning',
        objectType: 'column',
        blocker: 'extra_db_column',
        action: 'review-extra-db-object',
        status: 'REVIEW',
        table,
        column,
        evidence: { table, column },
        rationale:
          'The database has a column that is not represented by the current Prisma schema.',
      });
    }
  }

  return rows.sort(compareRows);
}

function compareRows(a: WorklistRow, b: WorklistRow) {
  return (
    severityWeight(b.severity) - severityWeight(a.severity) ||
    blockerWeight(a.blocker) - blockerWeight(b.blocker) ||
    (a.table ?? '').localeCompare(b.table ?? '') ||
    (a.column ?? '').localeCompare(b.column ?? '') ||
    (a.migration ?? '').localeCompare(b.migration ?? '')
  );
}

function severityWeight(severity: Severity) {
  if (severity === 'critical') return 5;
  if (severity === 'warning') return 3;
  return 1;
}

function blockerWeight(blocker: WorklistRow['blocker']) {
  const order: Record<WorklistRow['blocker'], number> = {
    database_unavailable: 0,
    missing_table: 1,
    missing_column: 2,
    unapplied_repo_migration: 3,
    applied_migration_missing_from_repo: 4,
    extra_db_table: 5,
    extra_db_column: 6,
  };
  return order[blocker];
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

function writeReport(
  args: Args,
  schema: ReturnType<typeof parsePrismaSchema>,
  result: {
    status: WorklistStatus;
    database: Record<string, unknown>;
    dbSchema: Record<string, unknown> | null;
    summary: Record<string, number>;
    rows: WorklistRow[];
  },
) {
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-database-schema-compatibility-worklist',
    status: result.status,
    nextAction:
      result.status === 'BLOCKED'
        ? 'block-release'
        : result.status === 'REVIEW'
          ? 'review'
          : 'accept',
    inputs: {
      prismaSchema: {
        path: path.relative(API_ROOT, schema.path),
        modelCount: schema.models.length,
        scalarFieldCount: schema.scalarFieldCount,
        enumCount: schema.enumCount,
      },
      database: result.database,
    },
    dbSchema: result.dbSchema,
    summary: result.summary,
    topBlockers: result.rows.slice(0, 20).map((row) => ({
      blocker: row.blocker,
      objectType: row.objectType,
      table: row.table ?? null,
      column: row.column ?? null,
      model: row.model ?? null,
      migration: row.migration ?? null,
      severity: row.severity,
      action: row.action,
    })),
    rows: result.rows,
    nextCampaign:
      result.status === 'PASS'
        ? {
            id: 'platform-data-closure-audit',
            reason:
              'Database schema matches the current Prisma model/column surface; rerun platform closure audit and continue with the next P0/P1 data domain.',
          }
        : {
            id:
              result.rows[0]?.domain === 'database_audit_availability'
                ? 'database_audit_availability'
                : 'database_schema_compatibility',
            reason:
              result.status === 'BLOCKED'
                ? 'DB-backed data closure is blocked until the target database can connect and match the current Prisma schema.'
                : 'Review extra DB objects before treating schema compatibility as fully closed.',
          },
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  printSummary(args.out, report);
}

function printSummary(
  out: string,
  report: {
    status: WorklistStatus;
    summary: Record<string, number>;
    rows: WorklistRow[];
  },
) {
  const summary = report.summary;
  console.log(
    [
      `Database schema compatibility status: ${report.status}`,
      `Rows: ${report.rows.length}`,
      `Missing tables: ${summary.missingTables}`,
      `Missing columns: ${summary.missingColumns}`,
      `Unapplied migrations: ${summary.unappliedRepoMigrations}`,
      `Applied migrations missing from repo: ${summary.appliedMigrationsMissingFromRepo}`,
      `Extra DB tables: ${summary.extraDbTables}`,
      `Extra DB columns: ${summary.extraDbColumns}`,
      `Report: ${out}`,
    ].join('\n'),
  );
}

function redactDatabaseUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port || null,
      database: url.pathname.replace(/^\//, '') || null,
      schema: url.searchParams.get('schema') ?? 'public',
      userPresent: Boolean(url.username),
      passwordPresent: Boolean(url.password),
    };
  } catch {
    return { parseable: false, present: true };
  }
}

function summarizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const missingTable = message.match(/The table `([^`]+)` does not exist/);
  if (missingTable) {
    return `Current database is missing table ${missingTable[1]} required by the current Prisma schema`;
  }
  const missingColumn = message.match(/The column `([^`]+)` does not exist/);
  if (missingColumn) {
    return `Current database is missing column ${missingColumn[1]} required by the current Prisma schema`;
  }
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? message;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`Timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
