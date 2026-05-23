#!/usr/bin/env ts-node
/**
 * Audit currently-APPROVED primary CAMPUS_COVER media assets for matches
 * against the architectural-drawing reject term list. Mirrors the runtime
 * filter in school-media.service.ts so we can retroactively flag assets
 * that were approved before the filter was strengthened.
 *
 * Dry-run by default. Use --apply to flip suspects to REJECTED.
 *
 * Usage:
 *   npx ts-node apps/api/scripts/audit-school-media.ts
 *   npx ts-node apps/api/scripts/audit-school-media.ts --apply
 *   npx ts-node apps/api/scripts/audit-school-media.ts --out=./media-audit.json
 *   npx ts-node apps/api/scripts/audit-school-media.ts --source=WIKIMEDIA_COMMONS
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  PrismaClient,
  SchoolMediaSourceType,
  SchoolMediaStatus,
  SchoolMediaType,
} from '@prisma/client';

const prisma = new PrismaClient();

// Keep in sync with WIKIMEDIA_REJECT_TITLE_TERMS in
// apps/api/src/modules/school/school-media.service.ts
const REJECT_TERMS = [
  'annual catalogue',
  'blueprint',
  'bus',
  'catalogue',
  'certificate',
  'cross section',
  'diagram',
  'drawing',
  'elevation',
  'emblem',
  'flag',
  'floor plan',
  'flower',
  'hood',
  'landscape plan',
  'logo',
  'map',
  'marker',
  'mascot',
  'master plan',
  'plaque',
  'regalia',
  'rendering',
  'schematic',
  'seal',
  'sign',
  'site plan',
  'sketch',
  'truck',
  'turtle',
];

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Mirrors normalizeSearchText() in school-media.service.ts
function normalizeSearchText(value: string | undefined | null): string {
  if (!value) return '';
  return safeDecode(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const direct = args.find((a) => a.startsWith(`--${name}=`));
    if (direct) return direct.slice(`--${name}=`.length);
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const has = (name: string) => args.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  return {
    apply: has('apply'),
    out: get('out'),
    source: (get('source') ?? 'WIKIMEDIA_COMMONS') as SchoolMediaSourceType,
  };
}

interface Hit {
  assetId: string;
  schoolId: string;
  schoolName: string;
  schoolNameZh: string | null;
  originalUrl: string | null;
  sourcePageUrl: string | null;
  matchedTerm: string;
}

function findMatch(asset: {
  originalUrl: string | null;
  sourcePageUrl: string | null;
}): string | null {
  const haystack = normalizeSearchText(
    `${asset.originalUrl ?? ''} ${asset.sourcePageUrl ?? ''}`,
  );
  if (!haystack) return null;
  for (const term of REJECT_TERMS) {
    if (haystack.includes(term)) return term;
  }
  return null;
}

async function main() {
  const opts = parseArgs();
  console.log(
    `Audit running — source=${opts.source} apply=${opts.apply} out=${opts.out ?? '(stdout only)'}`,
  );

  const assets = await prisma.schoolMediaAsset.findMany({
    where: {
      type: SchoolMediaType.CAMPUS_COVER,
      status: SchoolMediaStatus.APPROVED,
      isPrimary: true,
      sourceType: opts.source,
    },
    include: {
      school: { select: { id: true, name: true, nameZh: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const hits: Hit[] = [];
  for (const asset of assets) {
    const matchedTerm = findMatch(asset);
    if (!matchedTerm) continue;
    hits.push({
      assetId: asset.id,
      schoolId: asset.schoolId,
      schoolName: asset.school.name,
      schoolNameZh: asset.school.nameZh,
      originalUrl: asset.originalUrl,
      sourcePageUrl: asset.sourcePageUrl,
      matchedTerm,
    });
  }

  console.log(
    `Scanned ${assets.length} approved primary ${opts.source} CAMPUS_COVER assets.`,
  );
  console.log(`Found ${hits.length} suspect asset(s).`);

  if (hits.length > 0) {
    console.table(
      hits.map((h) => ({
        school: h.schoolNameZh
          ? `${h.schoolName} / ${h.schoolNameZh}`
          : h.schoolName,
        matchedTerm: h.matchedTerm,
        originalUrl: h.originalUrl ?? '(none)',
        assetId: h.assetId,
      })),
    );
  }

  if (opts.out) {
    const outPath = path.resolve(opts.out);
    fs.writeFileSync(outPath, JSON.stringify(hits, null, 2));
    console.log(`Wrote JSON report to ${outPath}`);
  }

  if (opts.apply && hits.length > 0) {
    console.log(`\n--apply set — flipping ${hits.length} asset(s) to REJECTED...`);
    const now = new Date();
    for (const hit of hits) {
      await prisma.schoolMediaAsset.update({
        where: { id: hit.assetId },
        data: {
          status: SchoolMediaStatus.REJECTED,
          isPrimary: false,
          failureReason: `Audit: matched reject term "${hit.matchedTerm}"`,
          reviewedAt: now,
        },
      });
      console.log(`  ✓ ${hit.schoolName} (asset=${hit.assetId})`);
    }

    console.log('\nNext step — re-run discovery for impacted schools:');
    const uniqueSchoolIds = [...new Set(hits.map((h) => h.schoolId))];
    for (const id of uniqueSchoolIds) {
      console.log(
        `  npx ts-node apps/api/src/cli/school-media-backfill.ts --schoolId=${id} --source=wikimedia --dry-run=false`,
      );
    }
    console.log(
      '\nThen open /admin/schools → Media Assets Tab → manually approve a campus photo as primary.',
    );
  } else if (!opts.apply && hits.length > 0) {
    console.log('\n(Dry-run — pass --apply to flip these to REJECTED.)');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
