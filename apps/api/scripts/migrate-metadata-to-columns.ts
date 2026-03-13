/**
 * Enterprise data backfill: promotes high-value fields from metadata JSON
 * (bigfuture.* / appily.*) to first-class schema columns.
 *
 * Non-destructive — original metadata is preserved. Writes provenance tracking.
 *
 * Usage:
 *   npx ts-node scripts/migrate-metadata-to-columns.ts              # dry-run (default)
 *   npx ts-node scripts/migrate-metadata-to-columns.ts --apply      # execute writes
 *   npx ts-node scripts/migrate-metadata-to-columns.ts --apply --force          # overwrite existing
 *   npx ts-node scripts/migrate-metadata-to-columns.ts --apply --batch-size=50  # custom batch
 *   npx ts-node scripts/migrate-metadata-to-columns.ts --apply --limit=100      # limit schools
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MigrationConfig {
  dryRun: boolean;
  force: boolean;
  batchSize: number;
  limit: number;
}

interface FieldStats {
  written: number;
  skippedExisting: number;
  skippedNull: number;
}

interface MigrationReport {
  config: MigrationConfig;
  timing: { startedAt: string; finishedAt: string; durationMs: number };
  counts: {
    total: number;
    processed: number;
    migrated: number;
    skipped: number;
    errors: number;
  };
  fieldStats: Record<string, FieldStats>;
  errors: Array<{ schoolId: string; schoolName: string; error: string }>;
  verification: {
    passed: boolean;
    checks: Array<{
      field: string;
      source: string;
      metadataCount: number;
      columnCount: number;
      match: boolean;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Field mapping: metadata path → column name, type, priority source
// ---------------------------------------------------------------------------

interface FieldMapping {
  metaSource: 'bigfuture' | 'appily';
  metaKey: string;
  column: string;
  type: 'int' | 'decimal' | 'boolean';
  priority: number; // lower = higher priority
}

const FIELD_MAPPINGS: FieldMapping[] = [
  // BigFuture fields (priority 1)
  {
    metaSource: 'bigfuture',
    metaKey: 'retentionRate',
    column: 'retentionRate',
    type: 'decimal',
    priority: 1,
  },
  {
    metaSource: 'bigfuture',
    metaKey: 'studentFacultyRatio',
    column: 'studentFacultyRatio',
    type: 'int',
    priority: 1,
  },
  {
    metaSource: 'bigfuture',
    metaKey: 'percentNeedMet',
    column: 'percentNeedMet',
    type: 'decimal',
    priority: 1,
  },
  {
    metaSource: 'bigfuture',
    metaKey: 'averageAidPackage',
    column: 'averageAidPackage',
    type: 'int',
    priority: 1,
  },
  {
    metaSource: 'bigfuture',
    metaKey: 'applicationFee',
    column: 'applicationFee',
    type: 'int',
    priority: 1,
  },
  {
    metaSource: 'bigfuture',
    metaKey: 'feeWaiverAvailable',
    column: 'feeWaiverAvailable',
    type: 'boolean',
    priority: 1,
  },
  {
    metaSource: 'bigfuture',
    metaKey: 'acceptsCommonApp',
    column: 'acceptsCommonApp',
    type: 'boolean',
    priority: 1,
  },
  {
    metaSource: 'bigfuture',
    metaKey: 'acceptsCoalition',
    column: 'acceptsCoalition',
    type: 'boolean',
    priority: 1,
  },

  // Appily exclusive fields (priority 1)
  {
    metaSource: 'appily',
    metaKey: 'averageNetPrice',
    column: 'averageNetPrice',
    type: 'int',
    priority: 1,
  },
  {
    metaSource: 'appily',
    metaKey: 'loanDefaultRate',
    column: 'loanDefaultRate',
    type: 'decimal',
    priority: 1,
  },
  {
    metaSource: 'appily',
    metaKey: 'monthlyLoanPayment',
    column: 'monthlyLoanPayment',
    type: 'int',
    priority: 1,
  },
  {
    metaSource: 'appily',
    metaKey: 'countriesRepresented',
    column: 'countriesRepresented',
    type: 'int',
    priority: 1,
  },
  {
    metaSource: 'appily',
    metaKey: 'studentOrgsCount',
    column: 'studentOrgsCount',
    type: 'int',
    priority: 1,
  },
  {
    metaSource: 'appily',
    metaKey: 'roomAndBoard',
    column: 'roomAndBoard',
    type: 'int',
    priority: 1,
  },
  {
    metaSource: 'appily',
    metaKey: 'salary6YrPostGrad',
    column: 'salary6YrPostGrad',
    type: 'int',
    priority: 1,
  },

  // Appily fallback fields (priority 2 — only if BigFuture didn't set them)
  {
    metaSource: 'appily',
    metaKey: 'studentFacultyRatio',
    column: 'studentFacultyRatio',
    type: 'int',
    priority: 2,
  },
  {
    metaSource: 'appily',
    metaKey: 'averageAid',
    column: 'averageAidPackage',
    type: 'int',
    priority: 2,
  },
];

// Sort by priority so higher-priority sources are processed first
const SORTED_MAPPINGS = [...FIELD_MAPPINGS].sort(
  (a, b) => a.priority - b.priority,
);

// All unique target columns
const ALL_COLUMNS = [...new Set(FIELD_MAPPINGS.map((m) => m.column))];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);
  return {
    dryRun: !args.includes('--apply'),
    force: args.includes('--force'),
    batchSize:
      parseInt(
        args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] ?? '100',
        10,
      ) || 100,
    limit:
      parseInt(
        args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0',
        10,
      ) || Infinity,
  };
}

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

function coerceValue(
  raw: unknown,
  type: 'int' | 'decimal' | 'boolean',
): number | boolean | Prisma.Decimal | null {
  if (raw == null) return null;
  if (type === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (raw === 'true' || raw === 1) return true;
    if (raw === 'false' || raw === 0) return false;
    return null;
  }
  if (type === 'int') {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    return Number.isNaN(n) ? null : Math.round(n);
  }
  if (type === 'decimal') {
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
    return Number.isNaN(n) ? null : new Prisma.Decimal(n);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main migration logic
// ---------------------------------------------------------------------------

async function migrate(config: MigrationConfig): Promise<MigrationReport> {
  const startedAt = new Date();
  const now = startedAt.toISOString();

  const report: MigrationReport = {
    config,
    timing: { startedAt: now, finishedAt: '', durationMs: 0 },
    counts: { total: 0, processed: 0, migrated: 0, skipped: 0, errors: 0 },
    fieldStats: {},
    errors: [],
    verification: { passed: true, checks: [] },
  };

  // Initialize field stats
  for (const col of ALL_COLUMNS) {
    report.fieldStats[col] = { written: 0, skippedExisting: 0, skippedNull: 0 };
  }

  // -----------------------------------------------------------------------
  // 1. Fetch schools with metadata + current column values
  // -----------------------------------------------------------------------
  const schools = (await prisma.school.findMany({
    where: { metadata: { not: Prisma.DbNull } },
    ...(config.limit < Infinity ? { take: config.limit } : {}),
  })) as Array<Record<string, any>>;

  report.counts.total = schools.length;

  console.log(
    `\n${config.dryRun ? '🔍 DRY-RUN MODE' : '✏️  APPLY MODE'}${config.force ? ' (--force: overwrite existing)' : ''}`,
  );
  console.log(
    `Found ${schools.length} schools with metadata (batch size: ${config.batchSize})\n`,
  );

  // -----------------------------------------------------------------------
  // 2. Process in batches
  // -----------------------------------------------------------------------
  for (let i = 0; i < schools.length; i += config.batchSize) {
    const batch = schools.slice(i, i + config.batchSize);
    const batchStart = Date.now();

    const updates: Array<{
      id: string;
      data: Record<string, any>;
      metadataUpdate: Record<string, any>;
    }> = [];

    for (const school of batch) {
      try {
        const meta = school.metadata as Record<string, any>;
        if (!meta) {
          report.counts.skipped++;
          continue;
        }

        const bf = meta.bigfuture || {};
        const ap = meta.appily || {};
        const sources: Record<string, Record<string, unknown>> = {
          bigfuture: bf,
          appily: ap,
        };

        const updateData: Record<string, any> = {};
        const provenanceEntries: Record<string, any> = {};
        const alreadySet = new Set<string>();

        for (const mapping of SORTED_MAPPINGS) {
          const sourceData = sources[mapping.metaSource];
          const rawValue = sourceData?.[mapping.metaKey];
          const coerced = coerceValue(rawValue, mapping.type);

          if (coerced == null) {
            report.fieldStats[mapping.column].skippedNull++;
            continue;
          }

          // Skip if we already wrote this column from a higher-priority source
          if (alreadySet.has(mapping.column)) {
            continue;
          }

          // Check if column already has a value
          const currentValue = school[mapping.column];
          if (currentValue != null && !config.force) {
            report.fieldStats[mapping.column].skippedExisting++;
            alreadySet.add(mapping.column);
            continue;
          }

          updateData[mapping.column] = coerced;
          alreadySet.add(mapping.column);
          report.fieldStats[mapping.column].written++;

          provenanceEntries[mapping.column] = {
            source: 'MIGRATION_BACKFILL',
            originalSource: mapping.metaSource,
            at: now,
          };
        }

        if (Object.keys(updateData).length === 0) {
          report.counts.skipped++;
          continue;
        }

        report.counts.migrated++;

        // Build metadata update with provenance
        const existingProvenance = meta.provenance || {};
        const metadataUpdate = {
          ...meta,
          provenance: { ...existingProvenance, ...provenanceEntries },
        };

        updates.push({ id: school.id, data: updateData, metadataUpdate });
      } catch (err) {
        report.counts.errors++;
        report.errors.push({
          schoolId: school.id,
          schoolName: school.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Execute batch write
    if (!config.dryRun && updates.length > 0) {
      try {
        await prisma.$transaction(
          updates.map((u) =>
            prisma.school.update({
              where: { id: u.id },
              data: {
                ...u.data,
                metadata: u.metadataUpdate as any,
              },
            }),
          ),
        );
      } catch (err) {
        // If batch fails, try individual updates
        for (const u of updates) {
          try {
            await prisma.school.update({
              where: { id: u.id },
              data: {
                ...u.data,
                metadata: u.metadataUpdate as any,
              },
            });
          } catch (individualErr) {
            report.counts.errors++;
            report.errors.push({
              schoolId: u.id,
              schoolName: '',
              error:
                individualErr instanceof Error
                  ? individualErr.message
                  : String(individualErr),
            });
          }
        }
      }
    }

    report.counts.processed += batch.length;
    const elapsed = ((Date.now() - batchStart) / 1000).toFixed(1);
    const pct = ((report.counts.processed / report.counts.total) * 100).toFixed(
      1,
    );
    console.log(
      `  [${report.counts.processed}/${report.counts.total}] ${pct}% | ` +
        `migrated: ${report.counts.migrated} | skipped: ${report.counts.skipped} | ` +
        `errors: ${report.counts.errors} | ${elapsed}s`,
    );
  }

  // -----------------------------------------------------------------------
  // 3. Verification phase
  // -----------------------------------------------------------------------
  console.log('\n--- Verification ---');

  const verificationChecks: Array<{
    field: string;
    source: string;
    jsonPath: string;
  }> = [
    {
      field: 'retentionRate',
      source: 'bigfuture',
      jsonPath: "metadata->'bigfuture'->>'retentionRate'",
    },
    {
      field: 'studentFacultyRatio',
      source: 'bigfuture',
      jsonPath: "metadata->'bigfuture'->>'studentFacultyRatio'",
    },
    {
      field: 'percentNeedMet',
      source: 'bigfuture',
      jsonPath: "metadata->'bigfuture'->>'percentNeedMet'",
    },
    {
      field: 'averageAidPackage',
      source: 'bigfuture',
      jsonPath: "metadata->'bigfuture'->>'averageAidPackage'",
    },
    {
      field: 'applicationFee',
      source: 'bigfuture',
      jsonPath: "metadata->'bigfuture'->>'applicationFee'",
    },
    {
      field: 'feeWaiverAvailable',
      source: 'bigfuture',
      jsonPath: "metadata->'bigfuture'->>'feeWaiverAvailable'",
    },
    {
      field: 'acceptsCommonApp',
      source: 'bigfuture',
      jsonPath: "metadata->'bigfuture'->>'acceptsCommonApp'",
    },
    {
      field: 'acceptsCoalition',
      source: 'bigfuture',
      jsonPath: "metadata->'bigfuture'->>'acceptsCoalition'",
    },
    {
      field: 'averageNetPrice',
      source: 'appily',
      jsonPath: "metadata->'appily'->>'averageNetPrice'",
    },
    {
      field: 'loanDefaultRate',
      source: 'appily',
      jsonPath: "metadata->'appily'->>'loanDefaultRate'",
    },
    {
      field: 'monthlyLoanPayment',
      source: 'appily',
      jsonPath: "metadata->'appily'->>'monthlyLoanPayment'",
    },
    {
      field: 'countriesRepresented',
      source: 'appily',
      jsonPath: "metadata->'appily'->>'countriesRepresented'",
    },
    {
      field: 'studentOrgsCount',
      source: 'appily',
      jsonPath: "metadata->'appily'->>'studentOrgsCount'",
    },
    {
      field: 'roomAndBoard',
      source: 'appily',
      jsonPath: "metadata->'appily'->>'roomAndBoard'",
    },
    {
      field: 'salary6YrPostGrad',
      source: 'appily',
      jsonPath: "metadata->'appily'->>'salary6YrPostGrad'",
    },
  ];

  for (const check of verificationChecks) {
    try {
      const result = await prisma.$queryRawUnsafe<
        Array<{ metadata_count: bigint; column_count: bigint }>
      >(`
          SELECT
            COUNT(*) FILTER (WHERE ${check.jsonPath} IS NOT NULL) as metadata_count,
            COUNT(*) FILTER (WHERE "${check.field}" IS NOT NULL) as column_count
          FROM "School"
        `);

      const metadataCount = Number(result[0].metadata_count);
      const columnCount = Number(result[0].column_count);
      const match = columnCount >= metadataCount;

      report.verification.checks.push({
        field: check.field,
        source: check.source,
        metadataCount,
        columnCount,
        match,
      });

      if (!match) report.verification.passed = false;

      const icon = match ? '✅' : '❌';
      console.log(
        `  ${icon} ${check.field}: metadata=${metadataCount}, column=${columnCount}${!match ? ' MISMATCH' : ''}`,
      );
    } catch {
      console.log(`  ⚠️  ${check.field}: verification query failed`);
    }
  }

  // -----------------------------------------------------------------------
  // 4. Finalize report
  // -----------------------------------------------------------------------
  const finishedAt = new Date();
  report.timing.finishedAt = finishedAt.toISOString();
  report.timing.durationMs = finishedAt.getTime() - startedAt.getTime();

  return report;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const config = parseArgs();

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Metadata → Column Migration (Enterprise)       ║');
  console.log('╚══════════════════════════════════════════════════╝');

  const report = await migrate(config);

  // Print summary
  console.log('\n=== Migration Summary ===');
  console.log(`  Mode: ${config.dryRun ? 'DRY-RUN (no writes)' : 'APPLIED'}`);
  console.log(`  Duration: ${(report.timing.durationMs / 1000).toFixed(1)}s`);
  console.log(`  Total: ${report.counts.total}`);
  console.log(`  Migrated: ${report.counts.migrated}`);
  console.log(`  Skipped: ${report.counts.skipped}`);
  console.log(`  Errors: ${report.counts.errors}`);

  // Field-level stats
  console.log('\n--- Field Stats ---');
  for (const [field, stats] of Object.entries(report.fieldStats)) {
    if (stats.written > 0 || stats.skippedExisting > 0) {
      console.log(
        `  ${field}: written=${stats.written}, skippedExisting=${stats.skippedExisting}, skippedNull=${stats.skippedNull}`,
      );
    }
  }

  // Verification result
  console.log(
    `\nVerification: ${report.verification.passed ? '✅ PASSED' : '❌ FAILED'}`,
  );

  if (report.errors.length > 0) {
    console.log(`\n--- Errors (${report.errors.length}) ---`);
    for (const err of report.errors.slice(0, 10)) {
      console.log(`  ${err.schoolId} (${err.schoolName}): ${err.error}`);
    }
    if (report.errors.length > 10) {
      console.log(`  ... and ${report.errors.length - 10} more`);
    }
  }

  // Output JSON report to stderr (so stdout stays clean for piping)
  console.error('\n--- JSON Report ---');
  console.error(JSON.stringify(report, null, 2));

  if (config.dryRun) {
    console.log('\n💡 This was a dry-run. Pass --apply to execute writes.');
  }

  process.exit(report.counts.errors > 0 ? 1 : 0);
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
