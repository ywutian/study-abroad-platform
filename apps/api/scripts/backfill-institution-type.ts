#!/usr/bin/env tsx
/**
 * Backfill School.institutionType based on:
 * 1. nameNorm patterns (music conservatories)
 * 2. SchoolRanking.list = 'ART_DESIGN' (art schools)
 * 3. isPrivate + size heuristics for liberal arts vs research
 */
import 'dotenv/config';
import { PrismaClient, InstitutionType } from '@prisma/client';

const prisma = new PrismaClient();

// Known music conservatories by nameNorm substring
const CONSERVATORY_PATTERNS = [
  'conservatory', 'juilliard', 'berklee', 'curtis institute',
  'manhattan school of music', 'new england conservatory',
  'oberlin conservatory', 'san francisco conservatory',
  'peabody', 'eastman school',
];

// Known art/design schools by nameNorm substring
const ART_DESIGN_PATTERNS = [
  'school of the art institute', 'rhode island school of design',
  'california institute of the arts', 'calarts',
  'california college of the arts', 'pratt institute',
  'savannah college of art', 'scad',
  'parsons', 'school of visual arts', 'sva',
  'maryland institute', 'mica',
  'cranbrook', 'art center college',
];

// Known specialty schools
const SPECIALTY_PATTERNS = [
  'military', 'naval academy', 'air force academy', 'west point',
  'merchant marine', 'coast guard academy',
  'theological', 'seminary',
];

function classifyByName(nameNorm: string): InstitutionType | null {
  const n = nameNorm.toLowerCase();
  if (CONSERVATORY_PATTERNS.some(p => n.includes(p))) return InstitutionType.MUSIC_CONSERVATORY;
  if (ART_DESIGN_PATTERNS.some(p => n.includes(p))) return InstitutionType.ART_DESIGN;
  if (SPECIALTY_PATTERNS.some(p => n.includes(p))) return InstitutionType.SPECIALTY;
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`🏛 Institution Type Backfill | ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  const schools = await prisma.school.findMany({
    where: { country: 'US' },
    select: {
      id: true, nameNorm: true, isPrivate: true,
      totalEnrollment: true, usNewsRank: true,
      institutionType: true,
      rankings: { select: { list: true }, take: 5 },
    },
  });

  // Find schools with ART_DESIGN ranking
  const artDesignByRanking = new Set(
    schools
      .filter(s => s.rankings.some(r => r.list?.toUpperCase().includes('ART')))
      .map(s => s.id),
  );

  const stats: Record<InstitutionType, number> = {
    RESEARCH_UNIVERSITY: 0, LIBERAL_ARTS: 0,
    ART_DESIGN: 0, MUSIC_CONSERVATORY: 0, SPECIALTY: 0,
  };

  let updated = 0;
  let skipped = 0;

  for (const school of schools) {
    // Determine type
    let type: InstitutionType;

    const nameType = classifyByName(school.nameNorm);
    if (nameType) {
      type = nameType;
    } else if (artDesignByRanking.has(school.id)) {
      type = InstitutionType.ART_DESIGN;
    } else if (!school.isPrivate) {
      // Public schools are research universities
      type = InstitutionType.RESEARCH_UNIVERSITY;
    } else if (school.totalEnrollment && school.totalEnrollment < 3000) {
      // Small private = liberal arts
      type = InstitutionType.LIBERAL_ARTS;
    } else {
      // Large private = research university
      type = InstitutionType.RESEARCH_UNIVERSITY;
    }

    stats[type]++;

    if (school.institutionType === type) {
      skipped++;
      continue;
    }

    if (!dryRun) {
      await prisma.school.update({
        where: { id: school.id },
        data: { institutionType: type },
      });
    }
    updated++;
  }

  console.log('=== BACKFILL RESULTS ===');
  for (const [type, count] of Object.entries(stats)) {
    console.log(`  ${type.padEnd(25)} ${count}`);
  }
  console.log(`\nUpdated: ${updated} | Skipped (already set): ${skipped}`);

  if (dryRun) {
    console.log('\n[DRY RUN] No changes made.');
  } else {
    console.log('\n✅ Done.');
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
