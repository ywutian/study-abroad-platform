#!/usr/bin/env tsx
/**
 * closure-v2 — ONE-COMMAND full update.
 *
 *   pnpm --filter api closure:update              # sync + status + next actions
 *   pnpm --filter api closure:update --reopen-stale   # also re-open stale CLOSED
 *   pnpm --filter api closure:update --json       # machine-readable summary
 *
 * What it does (the whole programmatic side of the Continuous Closure Engine):
 *   1. SYNC   — re-seed the ClosureTarget queue from the live DB: enqueue any
 *               newly imported School / HighSchool rows, flip PENDING→CLOSED for
 *               fields that have since gained a value.
 *   2. REOPEN — (with --reopen-stale) re-open CLOSED targets older than the
 *               freshness window so the engine refreshes them.
 *   3. STATUS — print closure % overall / per-wave / per-field.
 *   4. NEXT   — print exactly what still needs collection and how to dispatch it.
 *
 * Data COLLECTION for PENDING targets is not programmatic here — it is done by
 * Claude collection agents (real WebSearch/WebFetch/CDS parsing). Step 4 prints
 * the precise dispatch recipe. The in-API ClosureSchedulerService runs steps
 * 1-3 automatically on a timer; this command is the manual equivalent.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const asJson = process.argv.includes('--json');
const reopenStale = process.argv.includes('--reopen-stale');
const freshnessDays = Number(process.env.CLOSURE_FRESHNESS_DAYS) || 365;
const here = path.dirname(new URL(import.meta.url).pathname);

function run(label: string, scriptPath: string) {
  if (!asJson) console.log(`\n=== ${label} ===`);
  execSync(`pnpm exec tsx ${scriptPath}`, {
    stdio: asJson ? 'pipe' : 'inherit',
    cwd: path.resolve(here, '../..'),
  });
}

async function main() {
  // 1. SYNC — seed-closure-targets.ts lives in prisma/seeds/closure-agents/
  // (relocated so it ships into the prod Docker image — see migrate.sh).
  run(
    '1/4 SYNC queue',
    path.resolve(
      here,
      '../../prisma/seeds/closure-agents/seed-closure-targets.ts',
    ),
  );

  // 2. REOPEN stale
  let reopened = 0;
  if (reopenStale) {
    const cutoff = new Date(Date.now() - freshnessDays * 86_400_000);
    const res = await prisma.closureTarget.updateMany({
      where: { status: 'CLOSED', updatedAt: { lt: cutoff } },
      data: { status: 'PENDING' },
    });
    reopened = res.count;
    if (!asJson)
      console.log(
        `\n=== 2/4 REOPEN stale ===\n  re-opened ${reopened} CLOSED targets older than ${freshnessDays}d`,
      );
  }

  // 3. STATUS
  run('3/4 STATUS', path.resolve(here, 'closure-status.ts'));

  // 4. NEXT ACTIONS
  const pending = await prisma.closureTarget.groupBy({
    by: ['field'],
    where: { status: 'PENDING' },
    _count: { _all: true },
  });
  const totalPending = pending.reduce((n, r) => n + r._count._all, 0);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          reopened,
          totalPending,
          pendingByField: Object.fromEntries(
            pending.map((p) => [p.field, p._count._all]),
          ),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`\n=== 4/4 NEXT ACTIONS ===`);
    if (totalPending === 0) {
      console.log(
        '  ✅ PENDING = 0 — closure complete. Nothing to collect.\n' +
          '  Re-run with --reopen-stale periodically (or let ClosureSchedulerService do it)\n' +
          '  to refresh data past the freshness window.',
      );
    } else {
      console.log(`  ${totalPending} targets need collection:`);
      for (const p of pending.sort((a, b) => b._count._all - a._count._all)) {
        console.log(`    ${p.field.padEnd(26)} ${p._count._all}`);
      }
      console.log(
        '\n  To collect: dispatch one Claude collection agent per field, each\n' +
          '  following the prompt pattern in scripts/closure-agents/collect-*.ts —\n' +
          '  real WebSearch/WebFetch/CDS parsing, write School/HighSchool field +\n' +
          '  metadata.provenance + ClosureTarget status. Then re-run closure:update.\n' +
          '  (See docs/PREDICTION_CLOSURE_V2_ARCHITECTURE.md → "Running an update".)',
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
