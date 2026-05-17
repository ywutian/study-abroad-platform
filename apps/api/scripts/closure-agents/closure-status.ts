#!/usr/bin/env tsx
/**
 * closure-v2 Continuous Closure Engine — status reporter.
 *
 * Read-only. Reports closure % overall, per wave, and per field, plus the
 * highest-priority PENDING targets the scheduler will pick next. Run this any
 * time to see where the engine stands.
 *
 *   pnpm exec tsx scripts/closure-agents/closure-status.ts
 *   pnpm exec tsx scripts/closure-agents/closure-status.ts --json
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const asJson = process.argv.includes('--json');

type Row = { closed: number; total: number };
const pct = (r: Row) =>
  r.total === 0 ? 0 : Math.round((r.closed / r.total) * 1000) / 10;

async function main() {
  const targets = await prisma.closureTarget.findMany({
    select: { wave: true, field: true, status: true, priority: true },
  });

  const isClosed = (s: string) => s === 'CLOSED' || s === 'UNAVAILABLE';
  const overall: Row = { closed: 0, total: targets.length };
  const byWave: Record<string, Row> = {};
  const byField: Record<string, Row> = {};

  for (const t of targets) {
    const closed = isClosed(t.status);
    if (closed) overall.closed++;
    (byWave[t.wave] ??= { closed: 0, total: 0 }).total++;
    (byField[t.field] ??= { closed: 0, total: 0 }).total++;
    if (closed) {
      byWave[t.wave].closed++;
      byField[t.field].closed++;
    }
  }

  const nextUp = await prisma.closureTarget.findMany({
    where: { status: 'PENDING' },
    orderBy: { priority: 'desc' },
    take: 10,
    select: { entityName: true, field: true, priority: true, wave: true },
  });

  if (asJson) {
    console.log(
      JSON.stringify(
        { overall: pct(overall), byWave, byField, overallRaw: overall },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\n=== Closure Engine Status ===`);
  console.log(
    `overall: ${overall.closed}/${overall.total} = ${pct(overall)}%\n`,
  );
  console.log('by wave:');
  for (const [w, r] of Object.entries(byWave).sort())
    console.log(
      `  ${w.padEnd(14)} ${String(pct(r)).padStart(5)}%  (${r.closed}/${r.total})`,
    );
  console.log('\nby field:');
  for (const [f, r] of Object.entries(byField).sort(
    (a, b) => pct(a[1]) - pct(b[1]),
  ))
    console.log(
      `  ${f.padEnd(26)} ${String(pct(r)).padStart(5)}%  (${r.closed}/${r.total})`,
    );
  console.log('\nnext 10 the scheduler will pick (highest priority PENDING):');
  for (const t of nextUp)
    console.log(`  [${t.priority.toFixed(3)}] ${t.field} — ${t.entityName}`);
  console.log();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
