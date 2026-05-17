#!/usr/bin/env tsx
/**
 * closure-v2 Continuous Closure Engine — work-queue seeder.
 *
 * Scans the live DB and upserts one `ClosureTarget` row per (entity, field)
 * the engine must close. Already-populated fields are recorded as CLOSED so the
 * baseline closure picture is accurate from tick 0; missing fields land as
 * PENDING with a priority = predictionImpact x rankWeight.
 *
 * Idempotent & create-only on the upsert UPDATE branch — re-running never
 * clobbers engine progress (a CLOSED/UNAVAILABLE row stays as-is).
 *
 *   pnpm exec tsx scripts/closure-agents/seed-closure-targets.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** field -> { wave, predictionImpact 0-1 }. predictionImpact = how much the
 *  counselor engine's accuracy depends on this field. */
const SCHOOL_FIELDS: Record<string, { wave: string; weight: number }> = {
  needBlindInternational: { wave: 'wave-1.2', weight: 0.9 },
  gpaDistribution: { wave: 'wave-1.3', weight: 0.85 },
  act25: { wave: 'wave-1.4', weight: 0.5 },
  act75: { wave: 'wave-1.4', weight: 0.5 },
  transferAcceptanceRate: { wave: 'wave-1.5', weight: 0.3 },
  edAcceptanceRate: { wave: 'wave-6.1', weight: 0.7 },
  eaAcceptanceRate: { wave: 'wave-6.1', weight: 0.6 },
  oosAcceptanceRate: { wave: 'wave-6.1', weight: 0.5 },
  yieldRate: { wave: 'wave-6.1', weight: 0.6 },
  ed2AcceptanceRate: { wave: 'wave-6.1', weight: 0.55 },
  hasRestrictiveEa: { wave: 'wave-6.1', weight: 0.4 },
};

async function main() {
  const schools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      usNewsRank: true,
      isPrivate: true,
      needBlindInternational: true,
      gpaDistribution: true,
      act25: true,
      act75: true,
      transferAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      oosAcceptanceRate: true,
      yieldRate: true,
      ed2AcceptanceRate: true,
      hasRestrictiveEa: true,
    },
  });

  let upserts = 0;
  for (const s of schools) {
    const rankWeight = s.usNewsRank
      ? Math.max(0.2, 1 - s.usNewsRank / 300)
      : 0.3;
    for (const [field, cfg] of Object.entries(SCHOOL_FIELDS)) {
      // Eligibility: out-of-state admit rate only applies to public schools.
      if (field === 'oosAcceptanceRate' && s.isPrivate) continue;
      const value = (s as Record<string, unknown>)[field];
      const isNull = value == null;
      await prisma.closureTarget.upsert({
        where: {
          entityType_entityId_field: {
            entityType: 'School',
            entityId: s.id,
            field,
          },
        },
        create: {
          wave: cfg.wave,
          entityType: 'School',
          entityId: s.id,
          entityName: s.name,
          field,
          status: isNull ? 'PENDING' : 'CLOSED',
          priority: isNull ? cfg.weight * rankWeight : 0,
          tier: isNull ? null : 'OFFICIAL',
        },
        update: {}, // create-only — never clobber engine progress
      });
      upserts++;
    }
  }

  const byStatus = await prisma.closureTarget.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const total = byStatus.reduce((n, r) => n + r._count._all, 0);
  const closed = byStatus.find((r) => r.status === 'CLOSED')?._count._all ?? 0;
  console.log(`closure_targets: ${upserts} upserted, ${total} total`);
  for (const r of byStatus.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${r.status.padEnd(13)} ${r._count._all}`);
  }
  console.log(
    `baseline closure: ${closed}/${total} = ${((closed / total) * 100).toFixed(1)}%`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
