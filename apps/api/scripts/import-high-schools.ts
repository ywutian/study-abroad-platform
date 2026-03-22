/**
 * High School Batch Import Script
 *
 * Reads scraped high school data from JSON and imports into the database.
 * Uses upsert logic to avoid duplicates.
 *
 * Usage:
 *   npx ts-node scripts/import-high-schools.ts [--file=path/to/schools.json] [--apply]
 *
 * Default file: scripts/data/scraped-high-schools.json
 *
 * Without --apply: dry run (shows what would be imported)
 * With --apply: writes to database
 */

import { PrismaClient, HighSchoolType } from '@prisma/client';
import { computeHsQualityScore } from '@study-abroad/shared/scoring';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const VALID_TYPES = new Set<string>(Object.values(HighSchoolType));

interface ScrapedSchool {
  name: string;
  nameZh?: string;
  abbreviation?: string;
  country: string;
  state?: string;
  city?: string;
  type: string;
  website?: string;
  nicheGrade?: string;
  nicheUrl?: string;
  source?: string;
  // Optional evaluation dimensions
  recognition?: number;
  academicRigor?: number;
  placementRecord?: number;
  studentQuality?: number;
  resources?: number;
  gradeInflation?: string;
  avgSatScore?: number;
  avgIbScore?: number;
  annualTop30Count?: number;
  description?: string;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const fileArg = args.find((a) => a.startsWith('--file='));
  const filePath = fileArg
    ? fileArg.split('=')[1]
    : path.join(__dirname, 'data', 'scraped-high-schools.json');

  console.log('📥 High School Batch Import');
  console.log('='.repeat(50));
  console.log(`  File: ${filePath}`);
  console.log(`  Mode: ${apply ? '📝 APPLY' : '👀 DRY RUN'}`);
  console.log('');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    console.log('   Run scrape-niche-high-schools.ts first to generate data.');
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const schools: ScrapedSchool[] = JSON.parse(raw);
  console.log(`📋 Loaded ${schools.length} schools from file\n`);

  // Validate types
  const validSchools = schools.filter((s) => {
    if (!VALID_TYPES.has(s.type)) {
      console.log(`  ⚠️ Skipping "${s.name}" — invalid type: ${s.type}`);
      return false;
    }
    return true;
  });

  console.log(`✅ ${validSchools.length} schools with valid types\n`);

  // Check for existing schools
  const existingSchools = await prisma.highSchool.findMany({
    select: { name: true, country: true },
  });
  const existingSet = new Set(
    existingSchools.map(
      (s) => `${s.name.toLowerCase()}|${s.country.toLowerCase()}`,
    ),
  );

  let newCount = 0;
  let existingCount = 0;
  let created = 0;
  let errors = 0;

  for (const school of validSchools) {
    const key = `${school.name.toLowerCase()}|${school.country.toLowerCase()}`;
    if (existingSet.has(key)) {
      existingCount++;
      continue;
    }

    newCount++;

    if (!apply) {
      console.log(
        `  📝 Would create: ${school.name} (${school.country}, ${school.type})`,
      );
      continue;
    }

    try {
      const tier = school.recognition ? computeTier(school) : 3;
      const quality = computeHsQualityScore({
        name: school.name,
        country: school.country,
        type: school.type,
        state: school.state,
        city: school.city,
        nameZh: school.nameZh,
        tier,
        recognition: school.recognition,
        academicRigor: school.academicRigor,
        placementRecord: school.placementRecord,
        studentQuality: school.studentQuality,
        resources: school.resources,
        gradeInflation: school.gradeInflation,
        evaluatedBy: school.recognition ? 'import' : undefined,
        website: school.website,
        avgSatScore: school.avgSatScore,
        avgIbScore: school.avgIbScore,
      });

      await prisma.highSchool.create({
        data: {
          name: school.name,
          nameZh: school.nameZh ?? undefined,
          abbreviation: school.abbreviation ?? undefined,
          country: school.country,
          state: school.state ?? undefined,
          city: school.city ?? undefined,
          type: school.type as HighSchoolType,
          tier,
          description: school.description ?? undefined,
          website: school.website ?? undefined,
          recognition: school.recognition ?? undefined,
          academicRigor: school.academicRigor ?? undefined,
          placementRecord: school.placementRecord ?? undefined,
          studentQuality: school.studentQuality ?? undefined,
          resources: school.resources ?? undefined,
          gradeInflation: school.gradeInflation ?? undefined,
          avgSatScore: school.avgSatScore ?? undefined,
          avgIbScore: school.avgIbScore ?? undefined,
          annualTop30Count: school.annualTop30Count ?? undefined,
          qualityScore: quality.score,
          qualityGrade: quality.grade,
          hsImpactEnabled: quality.grade !== 'D',
          evaluatedAt: school.recognition ? new Date() : undefined,
          evaluatedBy: school.recognition ? 'import' : undefined,
        },
      });
      created++;
      console.log(`  ✅ Created: ${school.name}`);
    } catch (error) {
      errors++;
      console.log(
        `  ❌ Error creating "${school.name}": ${(error as Error).message}`,
      );
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`  📋 Total in file: ${schools.length}`);
  console.log(`  ⏩ Already in DB: ${existingCount}`);
  console.log(`  🆕 New schools: ${newCount}`);
  if (apply) {
    console.log(`  ✅ Created: ${created}`);
    console.log(`  ❌ Errors: ${errors}`);
  } else if (newCount > 0) {
    console.log('\n💡 Run with --apply to import into database');
  }

  await prisma.$disconnect();
}

function computeTier(school: ScrapedSchool): number {
  const {
    recognition,
    academicRigor,
    placementRecord,
    studentQuality,
    resources,
  } = school;
  if (
    !recognition ||
    !academicRigor ||
    !placementRecord ||
    !studentQuality ||
    !resources
  ) {
    return 3;
  }
  const raw =
    recognition * 0.3 +
    academicRigor * 0.25 +
    placementRecord * 0.25 +
    studentQuality * 0.1 +
    resources * 0.1;
  return Math.round(Math.max(1, Math.min(5, raw)));
}

main().catch(console.error);
