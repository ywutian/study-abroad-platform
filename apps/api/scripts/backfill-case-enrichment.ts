/**
 * Backfill script: Migrate existing AdmissionCase data to new structured fields.
 *
 * Extracts structured data from legacy fields (tags, activityList, ranges) into
 * the new JSON and enum columns added by the case enrichment migration.
 *
 * Usage:
 *   npx tsx scripts/backfill-case-enrichment.ts --dry-run    # Preview changes
 *   npx tsx scripts/backfill-case-enrichment.ts --apply       # Apply changes
 */

import { PrismaClient, HighSchoolType, EducationSystem } from '@prisma/client';
import {
  parseActivitiesText,
  parseAwardsText,
  parseTestScoresFromRanges,
  extractDemographicTags,
  extractHighSchoolType,
  extractCurriculumType,
} from '../src/common/utils/import-normalizers';
import { computeCaseQualityScore } from '../src/common/constants/data-formats';

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

interface BackfillStats {
  total: number;
  updated: number;
  skipped: number;
  tagsExtracted: number;
  activitiesParsed: number;
  awardsParsed: number;
  testScoresParsed: number;
  hsTypeExtracted: number;
  curriculumExtracted: number;
  demographicsExtracted: number;
  qualityScoresBefore: Record<string, number>;
  qualityScoresAfter: Record<string, number>;
}

function bucketScore(score: number): string {
  if (score >= 80) return '80-100';
  if (score >= 60) return '60-79';
  if (score >= 40) return '40-59';
  if (score >= 20) return '20-39';
  return '0-19';
}

async function backfill(dryRun: boolean): Promise<BackfillStats> {
  const stats: BackfillStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    tagsExtracted: 0,
    activitiesParsed: 0,
    awardsParsed: 0,
    testScoresParsed: 0,
    hsTypeExtracted: 0,
    curriculumExtracted: 0,
    demographicsExtracted: 0,
    qualityScoresBefore: {},
    qualityScoresAfter: {},
  };

  const totalCount = await prisma.admissionCase.count();
  console.log(`Found ${totalCount} cases to process`);
  stats.total = totalCount;

  let cursor: string | undefined;

  while (true) {
    const cases = await prisma.admissionCase.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      include: { school: { select: { id: true, name: true } } },
    });

    if (cases.length === 0) break;
    cursor = cases[cases.length - 1].id;

    for (const c of cases) {
      const oldBucket = bucketScore(c.qualityScore ?? 0);
      stats.qualityScoresBefore[oldBucket] =
        (stats.qualityScoresBefore[oldBucket] || 0) + 1;

      // Skip if already has structured data
      if (c.testScores || c.activities || c.awards) {
        stats.skipped++;
        stats.qualityScoresAfter[oldBucket] =
          (stats.qualityScoresAfter[oldBucket] || 0) + 1;
        continue;
      }

      const updates: Record<string, any> = {};
      let changed = false;

      // 1. Parse test scores from ranges
      const testScores = parseTestScoresFromRanges(
        c.satRange ?? undefined,
        c.actRange ?? undefined,
        c.toeflRange ?? undefined,
      );
      if (testScores.length > 0) {
        updates.testScores = testScores;
        stats.testScoresParsed += testScores.length;
        changed = true;
      }

      // 2. Parse activities from activityList text
      if (c.activityList) {
        const activities = parseActivitiesText(c.activityList);
        if (activities.length > 0) {
          updates.activities = activities;
          stats.activitiesParsed += activities.length;
          changed = true;
        }
      }

      // 3. Extract structured data from tags
      const tags = (c.tags as string[]) || [];
      if (tags.length > 0) {
        // Extract high school type
        const { hsType, remaining: afterHs } = extractHighSchoolType(tags);
        if (hsType && !c.highSchoolType) {
          updates.highSchoolType = hsType;
          stats.hsTypeExtracted++;
          changed = true;
        }

        // Extract curriculum type
        const { curriculum, remaining: afterCurr } =
          extractCurriculumType(afterHs);
        if (curriculum && !c.curriculumType) {
          updates.curriculumType = curriculum;
          stats.curriculumExtracted++;
          changed = true;
        }

        // Extract demographic tags
        const { demographics, remaining: cleanTags } =
          extractDemographicTags(afterCurr);
        if (
          demographics.length > 0 &&
          (!c.demographicTags || c.demographicTags.length === 0)
        ) {
          updates.demographicTags = demographics;
          stats.demographicsExtracted += demographics.length;
          changed = true;
        }

        // Update tags to remove extracted ones
        if (cleanTags.length < tags.length) {
          updates.tags = cleanTags;
          stats.tagsExtracted += tags.length - cleanTags.length;
        }
      }

      // 4. Infer awards from tag hints (e.g., "national_award")
      if (tags.some((t) => t.includes('award') || t.includes('olympiad'))) {
        const awardHints = tags.filter(
          (t) => t.includes('award') || t.includes('olympiad'),
        );
        const awards = awardHints.map((hint) => {
          const isNational = hint.includes('national');
          const isInternational = hint.includes('international');
          return {
            name: hint.replace(/_/g, ' '),
            level: isInternational
              ? 'international'
              : isNational
                ? 'national'
                : ('school' as const),
          };
        });
        if (awards.length > 0 && !updates.awards) {
          updates.awards = awards;
          stats.awardsParsed += awards.length;
          changed = true;
        }
      }

      // 5. Recompute quality score
      if (changed) {
        const newQuality = computeCaseQualityScore({
          source: (c.source as any) || 'legacy',
          schoolName: c.school?.name || c.schoolId,
          year: c.year,
          result: c.result as any,
          round: c.round as any,
          major: c.major || undefined,
          gpa: c.gpaRange ? { range: c.gpaRange, scale: 4 } : undefined,
          sat: c.satRange ? { range: c.satRange } : undefined,
          act: c.actRange ? { range: c.actRange } : undefined,
          toefl: c.toeflRange ? { range: c.toeflRange } : undefined,
          tags: updates.tags || (c.tags as string[]) || [],
          testScores: updates.testScores,
          activities: updates.activities,
          awards: updates.awards,
          highSchoolType: updates.highSchoolType || c.highSchoolType,
          curriculumType: updates.curriculumType || c.curriculumType,
          demographicTags: updates.demographicTags || c.demographicTags,
          narrative: c.narrative || undefined,
          isVerified: c.isVerified,
        });
        updates.qualityScore = newQuality;

        const newBucket = bucketScore(newQuality);
        stats.qualityScoresAfter[newBucket] =
          (stats.qualityScoresAfter[newBucket] || 0) + 1;

        if (!dryRun) {
          await prisma.admissionCase.update({
            where: { id: c.id },
            data: updates,
          });
        }
        stats.updated++;
      } else {
        stats.skipped++;
        stats.qualityScoresAfter[oldBucket] =
          (stats.qualityScoresAfter[oldBucket] || 0) + 1;
      }
    }

    console.log(
      `Processed ${stats.updated + stats.skipped}/${totalCount} (updated: ${stats.updated}, skipped: ${stats.skipped})`,
    );
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');

  if (dryRun) {
    console.log('=== DRY RUN MODE (use --apply to write changes) ===\n');
  } else {
    console.log('=== APPLY MODE — writing changes to database ===\n');
  }

  try {
    const stats = await backfill(dryRun);

    console.log('\n=== Backfill Summary ===');
    console.log(`Total cases:         ${stats.total}`);
    console.log(`Updated:             ${stats.updated}`);
    console.log(`Skipped:             ${stats.skipped}`);
    console.log(`Test scores parsed:  ${stats.testScoresParsed}`);
    console.log(`Activities parsed:   ${stats.activitiesParsed}`);
    console.log(`Awards parsed:       ${stats.awardsParsed}`);
    console.log(`HS type extracted:   ${stats.hsTypeExtracted}`);
    console.log(`Curriculum extracted: ${stats.curriculumExtracted}`);
    console.log(`Demographics extracted: ${stats.demographicsExtracted}`);
    console.log(`Tags migrated:       ${stats.tagsExtracted}`);

    console.log('\n--- Quality Score Distribution ---');
    console.log('Before:');
    for (const [bucket, count] of Object.entries(
      stats.qualityScoresBefore,
    ).sort()) {
      console.log(`  ${bucket}: ${count}`);
    }
    console.log('After:');
    for (const [bucket, count] of Object.entries(
      stats.qualityScoresAfter,
    ).sort()) {
      console.log(`  ${bucket}: ${count}`);
    }

    if (dryRun) {
      console.log(
        '\n(Dry run — no changes written. Run with --apply to commit.)',
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
