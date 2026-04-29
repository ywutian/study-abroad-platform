#!/usr/bin/env ts-node
/**
 * Phase W: Mark schools as PERMANENT_HEURISTIC.
 *
 * Reads scripts/cds-data/known-no-cds.json and updates each school's
 * metadata.provenance.intlAcceptanceRate.permanent flag.
 *
 * Effect: discover-cds-pdfs.ts skips these schools forever; UI shows
 * specific tooltip "{School} doesn't publish residency in CDS".
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

function loadDotEnv() {
  for (const file of [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps/api/.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(t);
      if (!m || process.env[m[1]] != null) continue;
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

loadDotEnv();
const prisma = new PrismaClient();

interface SkipEntry {
  schoolNameNorm: string;
  reason: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepMerge<T extends Record<string, unknown>>(
  a: T,
  b: Record<string, unknown>,
): T {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const file = path.join(process.cwd(), 'scripts/cds-data/known-no-cds.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    schools: SkipEntry[];
  };

  console.log(
    `[${live ? 'LIVE' : 'DRY-RUN'}] Marking ${data.schools.length} schools as PERMANENT_HEURISTIC`,
  );

  const schools = await prisma.school.findMany({
    where: { nameNorm: { in: data.schools.map((s) => s.schoolNameNorm) } },
    select: { id: true, name: true, nameNorm: true, metadata: true },
  });
  const byNorm = new Map(schools.map((s) => [s.nameNorm, s]));

  let updated = 0;
  let notFound = 0;
  for (const entry of data.schools) {
    const school = byNorm.get(entry.schoolNameNorm);
    if (!school) {
      console.log(`  SKIP not found: ${entry.schoolNameNorm}`);
      notFound++;
      continue;
    }
    const oldMeta = (school.metadata as Record<string, unknown>) ?? {};
    const oldProv = (oldMeta.provenance as Record<string, unknown>) ?? {};
    const newMeta = deepMerge(oldMeta, {
      provenance: deepMerge(oldProv, {
        intlAcceptanceRate: {
          source: 'PERMANENT_HEURISTIC',
          tier: 'INFERRED',
          permanent: true,
          reason: entry.reason,
          verifiedAt: new Date().toISOString(),
        },
        oosAcceptanceRate: {
          source: 'PERMANENT_HEURISTIC',
          tier: 'INFERRED',
          permanent: true,
          reason: entry.reason,
          verifiedAt: new Date().toISOString(),
        },
      }),
    });
    if (live) {
      await prisma.school.update({
        where: { id: school.id },
        data: { metadata: newMeta as Prisma.InputJsonValue },
      });
    }
    console.log(`  ${live ? '✓' : '·'} ${school.name}: ${entry.reason}`);
    updated++;
  }
  console.log(`\nDone: ${updated} schools marked, ${notFound} not found in DB`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
