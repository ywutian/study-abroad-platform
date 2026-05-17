#!/usr/bin/env tsx
/**
 * closure-v2 Continuous Closure Engine — work-queue seeder (comprehensive).
 *
 * Scans the live DB and upserts one `ClosureTarget` row per (entity, field)
 * the engine must close — across the FULL plan scope:
 *   - School: 26 prediction + display fields
 *   - HighSchool: 7 evaluation / curriculum fields
 * Already-populated fields are recorded CLOSED so the baseline is accurate from
 * tick 0; missing fields land PENDING with priority = predictionImpact x weight.
 *
 * Idempotent: the UPDATE branch only flips PENDING -> CLOSED when the field has
 * gained a real value (re-run = sync); engine-set FAILED/NEEDS_REVIEW/UNAVAILABLE
 * are never clobbered.
 *
 *   pnpm exec tsx scripts/closure-agents/seed-closure-targets.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** field -> { wave, predictionImpact 0-1 }. */
const SCHOOL_FIELDS: Record<string, { wave: string; weight: number }> = {
  // --- admit rates ---
  acceptanceRate: { wave: 'wave-0', weight: 1.0 },
  intlAcceptanceRate: { wave: 'wave-0', weight: 0.95 },
  oosAcceptanceRate: { wave: 'wave-6.1', weight: 0.5 },
  transferAcceptanceRate: { wave: 'wave-1.5', weight: 0.3 },
  edAcceptanceRate: { wave: 'wave-6.1', weight: 0.7 },
  eaAcceptanceRate: { wave: 'wave-6.1', weight: 0.6 },
  ed2AcceptanceRate: { wave: 'wave-6.1', weight: 0.5 },
  yieldRate: { wave: 'wave-6.1', weight: 0.6 },
  hasRestrictiveEa: { wave: 'wave-6.1', weight: 0.4 },
  // --- test scores ---
  sat25: { wave: 'wave-0', weight: 0.95 },
  sat75: { wave: 'wave-0', weight: 0.95 },
  satAvg: { wave: 'wave-0', weight: 0.5 },
  act25: { wave: 'wave-1.4', weight: 0.5 },
  act75: { wave: 'wave-1.4', weight: 0.5 },
  actAvg: { wave: 'wave-1.4', weight: 0.4 },
  // --- gpa / aid policy ---
  gpaDistribution: { wave: 'wave-1.3', weight: 0.85 },
  needBlindInternational: { wave: 'wave-1.2', weight: 0.9 },
  // --- outcomes / aid ---
  graduationRate: { wave: 'wave-6.1', weight: 0.45 },
  retentionRate: { wave: 'wave-6.1', weight: 0.4 },
  percentNeedMet: { wave: 'wave-6.1', weight: 0.45 },
  averageNetPrice: { wave: 'wave-6.1', weight: 0.4 },
  studentFacultyRatio: { wave: 'wave-6.7', weight: 0.3 },
  // --- display ---
  description: { wave: 'wave-6.7', weight: 0.25 },
  descriptionZh: { wave: 'wave-6.7', weight: 0.25 },
  totalEnrollment: { wave: 'wave-6.7', weight: 0.3 },
  nicheOverallGrade: { wave: 'wave-6.7', weight: 0.3 },
};

/** HighSchool evaluation + curriculum fields (plan Wave 5). */
const HS_FIELDS: Record<string, { wave: string; weight: number }> = {
  tier: { wave: 'wave-5.1', weight: 0.7 },
  recognition: { wave: 'wave-5.1', weight: 0.6 },
  academicRigor: { wave: 'wave-5.1', weight: 0.6 },
  placementRecord: { wave: 'wave-5.1', weight: 0.65 },
  studentQuality: { wave: 'wave-5.1', weight: 0.55 },
  resources: { wave: 'wave-5.1', weight: 0.5 },
  curriculumSystem: { wave: 'wave-5.2', weight: 0.6 },
};

async function upsertTarget(
  entityType: string,
  entityId: string,
  entityName: string,
  field: string,
  cfg: { wave: string; weight: number },
  value: unknown,
) {
  const isNull = value == null;
  await prisma.closureTarget.upsert({
    where: { entityType_entityId_field: { entityType, entityId, field } },
    create: {
      wave: cfg.wave,
      entityType,
      entityId,
      entityName,
      field,
      status: isNull ? 'PENDING' : 'CLOSED',
      priority: isNull ? cfg.weight : 0,
      tier: isNull ? null : 'OFFICIAL',
    },
    // Re-runnable sync: flip PENDING -> CLOSED once the field has a real value;
    // never clobber engine-set FAILED / NEEDS_REVIEW / UNAVAILABLE.
    update: isNull ? {} : { status: 'CLOSED' },
  });
}

async function main() {
  let upserts = 0;

  // --- School ---
  const schools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      usNewsRank: true,
      isPrivate: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      transferAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      ed2AcceptanceRate: true,
      yieldRate: true,
      hasRestrictiveEa: true,
      sat25: true,
      sat75: true,
      satAvg: true,
      act25: true,
      act75: true,
      actAvg: true,
      gpaDistribution: true,
      needBlindInternational: true,
      graduationRate: true,
      retentionRate: true,
      percentNeedMet: true,
      averageNetPrice: true,
      studentFacultyRatio: true,
      description: true,
      descriptionZh: true,
      totalEnrollment: true,
      nicheOverallGrade: true,
    },
  });
  for (const s of schools) {
    const rankWeight = s.usNewsRank
      ? Math.max(0.2, 1 - s.usNewsRank / 300)
      : 0.3;
    for (const [field, cfg] of Object.entries(SCHOOL_FIELDS)) {
      if (field === 'oosAcceptanceRate' && s.isPrivate) continue;
      await upsertTarget(
        'School',
        s.id,
        s.name,
        field,
        { wave: cfg.wave, weight: cfg.weight * rankWeight },
        (s as Record<string, unknown>)[field],
      );
      upserts++;
    }
  }

  // --- HighSchool ---
  const highSchools = await prisma.highSchool.findMany({
    select: {
      id: true,
      name: true,
      tier: true,
      recognition: true,
      academicRigor: true,
      placementRecord: true,
      studentQuality: true,
      resources: true,
      curriculumSystem: true,
    },
  });
  for (const h of highSchools) {
    for (const [field, cfg] of Object.entries(HS_FIELDS)) {
      await upsertTarget(
        'HighSchool',
        h.id,
        h.name,
        field,
        cfg,
        (h as Record<string, unknown>)[field],
      );
      upserts++;
    }
  }

  const byStatus = await prisma.closureTarget.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const total = byStatus.reduce((n, r) => n + r._count._all, 0);
  // CLOSED (data found) + UNAVAILABLE (verified not published) = terminal-success.
  const closed = byStatus
    .filter((r) => r.status === 'CLOSED' || r.status === 'UNAVAILABLE')
    .reduce((n, r) => n + r._count._all, 0);
  console.log(`closure_targets: ${upserts} upserted, ${total} total`);
  for (const r of byStatus.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${r.status.padEnd(13)} ${r._count._all}`);
  }
  console.log(
    `closure: ${closed}/${total} = ${((closed / total) * 100).toFixed(1)}%`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
