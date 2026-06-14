#!/usr/bin/env tsx
/**
 * closure-v2 — apply the prediction-closure seed payload to the connected DB.
 *
 *   pnpm exec tsx prisma/seeds/seed-prediction-closure.ts            # apply
 *   pnpm exec tsx prisma/seeds/seed-prediction-closure.ts --dry-run  # report only
 *   pnpm exec tsx prisma/seeds/seed-prediction-closure.ts --file <path>
 *
 * Reads prisma/seeds/data/prediction-closure-latest.json (built by
 * build-prediction-closure-payload.ts) and upserts the closure-v2 fields onto
 * the DB that DATABASE_URL points at — School matched by nameNorm, HighSchool
 * by (name, country, state). Idempotent and additive: it only writes the
 * fields present in the payload and merges closure-v2 provenance into
 * metadata.provenance without clobbering other keys. Unmatched rows are
 * reported, never created.
 *
 * To sync the closure data to staging / prod: point DATABASE_URL at that DB
 * and run this script (CI/CD or manually).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const fileArg = (() => {
  const i = argv.indexOf('--file');
  return i >= 0 ? argv[i + 1] : undefined;
})();

interface SchoolEntry {
  nameNorm: string;
  name: string;
  data: Record<string, unknown>;
  provenance: Record<string, unknown> | null;
}
interface HsEntry {
  name: string;
  country: string;
  state: string | null;
  data: Record<string, unknown>;
}

function mergeProvenance(
  metadata: unknown,
  provenance: Record<string, unknown> | null,
): Prisma.InputJsonValue | undefined {
  if (!provenance) return undefined;
  const meta =
    metadata && typeof metadata === 'object'
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  meta.provenance = {
    ...((meta.provenance as Record<string, unknown>) ?? {}),
    ...provenance,
  };
  return meta as Prisma.InputJsonValue;
}

async function main() {
  const file =
    fileArg ??
    path.resolve(__dirname, 'data', 'prediction-closure-latest.json');
  if (!fs.existsSync(file)) {
    console.error(
      `payload not found: ${file}\nrun build-prediction-closure-payload.ts first.`,
    );
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    cycle: string;
    generatedAt: string;
    schools: SchoolEntry[];
    highSchools: HsEntry[];
  };
  console.log(
    `payload ${payload.cycle} @ ${payload.generatedAt} — ${payload.schools.length} schools, ${payload.highSchools.length} highSchools`,
  );
  console.log(dryRun ? 'DRY RUN — no writes\n' : 'APPLYING\n');

  let schoolApplied = 0;
  let schoolUnmatched = 0;
  for (const entry of payload.schools) {
    let school = await prisma.school.findUnique({
      where: { nameNorm: entry.nameNorm },
      select: { id: true, metadata: true },
    });
    // Fallback: catalog name/normalization drift between the payload's nameNorm
    // and the row's stored nameNorm (e.g. a school seeded by an older catalog, or
    // a payload short-name like "Macalester" vs row "Macalester College"). Match
    // by exact name or an alias entry. This only ADDS matches it would otherwise
    // skip — it never re-targets an already-nameNorm-matched school — so it can't
    // mis-apply data. It is the difference between "school exists on prod with a
    // null acceptanceRate" silently staying 数据不足 vs getting its rate.
    if (!school) {
      school = await prisma.school.findFirst({
        where: { OR: [{ name: entry.name }, { aliases: { has: entry.name } }] },
        select: { id: true, metadata: true },
      });
    }
    if (!school) {
      schoolUnmatched++;
      console.warn(`  UNMATCHED school: ${entry.name} (${entry.nameNorm})`);
      continue;
    }
    if (!dryRun) {
      const metadata = mergeProvenance(school.metadata, entry.provenance);
      await prisma.school.update({
        where: { id: school.id },
        data: {
          ...(entry.data as Prisma.SchoolUpdateInput),
          ...(metadata ? { metadata } : {}),
        },
      });
    }
    schoolApplied++;
  }

  let hsApplied = 0;
  let hsUnmatched = 0;
  for (const entry of payload.highSchools) {
    const hs = await prisma.highSchool.findFirst({
      where: {
        name: entry.name,
        country: entry.country,
        state: entry.state,
      },
      select: { id: true },
    });
    if (!hs) {
      hsUnmatched++;
      console.warn(`  UNMATCHED highSchool: ${entry.name} (${entry.country})`);
      continue;
    }
    if (!dryRun) {
      await prisma.highSchool.update({
        where: { id: hs.id },
        data: entry.data as Prisma.HighSchoolUpdateInput,
      });
    }
    hsApplied++;
  }

  console.log(
    `\nschools:     ${schoolApplied} ${dryRun ? 'matched' : 'applied'}, ${schoolUnmatched} unmatched\n` +
      `highSchools: ${hsApplied} ${dryRun ? 'matched' : 'applied'}, ${hsUnmatched} unmatched`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
