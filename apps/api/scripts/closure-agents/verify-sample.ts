#!/usr/bin/env tsx
/**
 * verify-sample.ts — Stratified sample verification of closure data.
 *
 * Picks 20 schools across rank tiers + value-correction extremes,
 * shows their 7 prediction-critical fields + tier + source for spot-checking.
 */
import { PrismaClient } from '@prisma/client';
import { buildNormalizedSchoolProvenance } from '../../src/modules/school/school-provenance.helpers';
import { toSchoolFieldSource } from '@study-abroad/shared/utils';

const prisma = new PrismaClient();

const FIELDS = [
  'acceptanceRate',
  'sat25',
  'sat75',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'edAcceptanceRate',
  'eaAcceptanceRate',
] as const;

// Curated stratified sample across the rank spectrum + special cases
const SAMPLE_NAMES = [
  // Top 10 elites
  'Harvard University',
  'Princeton University',
  'Massachusetts Institute of Technology',
  'Stanford University',
  'Yale University',
  // Top 30 mid-elites
  'Duke University',
  'Northwestern University',
  'Vanderbilt University',
  'University of California, Berkeley',
  // Top 50
  'Carnegie Mellon University',
  'Emory University',
  'University of Virginia',
  // Top 100 publics
  'University of Florida',
  'Georgia Institute of Technology',
  'Ohio State University',
  // Smaller/specialty
  'Harvey Mudd College',
  'Olin College of Engineering',
  // Public flagships that had big OOS corrections
  'California Polytechnic State University, San Luis Obispo',
  'University of Texas at Austin',
  // Recent batches
  'University of Akron',
];

async function main() {
  console.log('━'.repeat(110));
  console.log(
    'Closure Sample Verification — 20 schools across the rank spectrum',
  );
  console.log('━'.repeat(110));

  for (const name of SAMPLE_NAMES) {
    const s = (await prisma.school.findFirst({
      where: { name, country: 'US' },
      select: {
        id: true,
        name: true,
        usNewsRank: true,
        isPrivate: true,
        institutionType: true,
        hasEarlyDecision: true,
        acceptanceRate: true,
        sat25: true,
        sat75: true,
        intlAcceptanceRate: true,
        oosAcceptanceRate: true,
        edAcceptanceRate: true,
        eaAcceptanceRate: true,
        metadata: true,
        dataReviewStatus: true,
      },
    })) as any;
    if (!s) {
      console.log(`\n❌ ${name} — NOT FOUND IN DB`);
      continue;
    }
    const prov = buildNormalizedSchoolProvenance(s);
    console.log('');
    console.log(
      `${s.name} (rank ${s.usNewsRank ?? '—'}, ${s.isPrivate ? 'private' : 'public'}, hasED=${s.hasEarlyDecision})`,
    );
    console.log('─'.repeat(110));
    for (const f of FIELDS) {
      const val = (s as any)[f];
      const valStr =
        val == null
          ? 'NULL'
          : typeof val === 'object' && val.toString
            ? val.toString()
            : String(val);
      const fp = (prov as any)[f];
      const fs = fp ? toSchoolFieldSource(fp) : null;
      const tier = fs?.tier ?? 'NULL';
      const source = fs?.source ?? 'NULL';
      const url = fs?.sourceUrl ?? '';
      const urlShort = url.length > 50 ? '...' + url.slice(-47) : url;
      console.log(
        `  ${f.padEnd(22)} ${String(valStr).padStart(7)}  ${tier.padEnd(12)} ${source.padEnd(28)} ${urlShort}`,
      );
    }
  }

  console.log('');
  console.log('━'.repeat(110));
  console.log(
    'Sample verification complete. Visual review above for anomalies.',
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
