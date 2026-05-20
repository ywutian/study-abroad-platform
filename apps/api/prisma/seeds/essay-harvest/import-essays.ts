/**
 * Import harvested admission essays from public archives (JHU, Hamilton, Conn College, etc.)
 * into AdmissionCase rows. Each row: visibility=ANONYMOUS, reviewStatus=APPROVED so it shows
 * in the essay gallery.
 *
 * Usage from apps/api:  npx tsx scripts/essay-harvest/import-essays.ts
 */
import {
  PrismaClient,
  AdmissionResult,
  EssayType,
  Visibility,
  DataReviewStatus,
  VerificationLevel,
} from '@prisma/client';
import { JHU_ESSAYS, type EssayRecord } from './data-jhu';
import { JHU_ESSAYS_2 } from './data-jhu2';
import { JHU_ESSAYS_3 } from './data-jhu3';
import { JHU_ESSAYS_4 } from './data-jhu4';
import { HAMILTON_ESSAYS } from './data-hamilton';
import { HAMILTON_ESSAYS_2 } from './data-hamilton2';
import { HAMILTON_ESSAYS_3 } from './data-hamilton3';
import { MIT_HARVARD_ESSAYS } from './data-mit-harvard';
import { PREPMAVEN_ESSAYS } from './data-prepmaven';
import { COLLEGEVINE_ESSAYS } from './data-collegevine';
import { STANFORD_USC_ESSAYS } from './data-stanford-usc';
import { FINAL_ESSAYS } from './data-final';
import { COLLEGEESSAYGUY_ESSAYS } from './data-collegeessayguy';
import { SHEMMASSIAN_ESSAYS } from './data-shemmassian';

const prisma = new PrismaClient();

const SYSTEM_USER_ID = 'cmpcmnz0o0000bz4aj811imep'; // top-cases@system.local
const IMPORT_BATCH_ID = `essay-archive-import-${new Date().toISOString().slice(0, 10)}`;

const ALL_ESSAYS: EssayRecord[] = [
  ...JHU_ESSAYS,
  ...JHU_ESSAYS_2,
  ...JHU_ESSAYS_3,
  ...JHU_ESSAYS_4,
  ...HAMILTON_ESSAYS,
  ...HAMILTON_ESSAYS_2,
  ...HAMILTON_ESSAYS_3,
  ...MIT_HARVARD_ESSAYS,
  ...PREPMAVEN_ESSAYS,
  ...COLLEGEVINE_ESSAYS,
  ...STANFORD_USC_ESSAYS,
  ...FINAL_ESSAYS,
  ...COLLEGEESSAYGUY_ESSAYS,
  ...SHEMMASSIAN_ESSAYS,
];

// Strip author names from essay content to anonymize (only at obvious signoff positions).
function anonymizeEssay(text: string): string {
  return text.trim();
}

async function main() {
  console.log(`Loaded ${ALL_ESSAYS.length} essay records in memory`);

  // School lookup: ALL US schools. The earlier `id: { startsWith: 'cmpb8h' }`
  // filter was a dev-DB-specific guard against "Reddit-pollution" rows that
  // shared a different cuid prefix. On any other database (staging, prod,
  // fresh dev), no rows match that prefix — so the seed silently inserts
  // ZERO essays. (Root cause of: prod gallery stuck at 5 after PR #246/#247.)
  // We still scope to country='US' since every harvested essay is to a US
  // school. Name normalization in findSchoolId handles ambiguous matches.
  const schools = await prisma.school.findMany({
    where: { country: 'US' },
    select: { id: true, name: true },
  });
  console.log(`Found ${schools.length} US schools`);

  function findSchoolId(name: string, aliases: string[] = []): string | null {
    const candidates = [name, ...aliases].map((n) => n.toLowerCase().trim());
    // Pass 1: exact match on any candidate.
    for (const cand of candidates) {
      const exact = schools.find((s) => s.name.toLowerCase() === cand);
      if (exact) return exact.id;
    }
    // Pass 2: partial match, but require both strings to be at least 8
    // chars long to avoid pathological matches (e.g. "USC" ⊂
    // "University of Southern California" is fine, but "MIT" ⊂ "MIT
    // Lincoln Laboratory" is not).
    for (const cand of candidates) {
      if (cand.length < 8) continue;
      const partial = schools.find((s) => {
        const sn = s.name.toLowerCase();
        if (sn.length < 8) return false;
        return sn.includes(cand) || cand.includes(sn);
      });
      if (partial) return partial.id;
    }
    return null;
  }

  let inserted = 0;
  let skipped = 0;
  let updated = 0;

  for (const rec of ALL_ESSAYS) {
    const schoolId = findSchoolId(rec.schoolName);
    if (!schoolId) {
      console.warn(`SKIP — no school match: ${rec.schoolName}`);
      skipped++;
      continue;
    }
    const cleanedContent = anonymizeEssay(rec.essayContent);
    if (cleanedContent.length < 200) {
      console.warn(
        `SKIP — too short (${cleanedContent.length} chars) ${rec.schoolName}`,
      );
      skipped++;
      continue;
    }

    const sourceTag = `source:${rec.sourceUrl}#${rec.authorFirstName || 'anon'}`;
    const existing = await prisma.admissionCase.findFirst({
      where: { schoolId, tags: { has: sourceTag } },
      select: { id: true },
    });
    if (existing) {
      await prisma.admissionCase.update({
        where: { id: existing.id },
        data: {
          essayContent: cleanedContent,
          essayPrompt: rec.essayPrompt || null,
          essayType: rec.essayType as EssayType,
          visibility: Visibility.ANONYMOUS,
          reviewStatus: DataReviewStatus.APPROVED,
        },
      });
      updated++;
      continue;
    }

    await prisma.admissionCase.create({
      data: {
        userId: SYSTEM_USER_ID,
        schoolId,
        year: rec.year,
        result: rec.result as AdmissionResult,
        essayType: rec.essayType as EssayType,
        essayPrompt: rec.essayPrompt || null,
        essayContent: cleanedContent,
        visibility: Visibility.ANONYMOUS,
        reviewStatus: DataReviewStatus.APPROVED,
        source: 'public_essay_archive',
        importBatchId: IMPORT_BATCH_ID,
        tags: [sourceTag, ...(rec.tags || [])],
        qualityScore: 85,
        verificationLevel: VerificationLevel.L2,
        verifiedBy: 'public_aggregation',
      },
    });
    inserted++;
  }

  console.log(`\n=== Import complete ===`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated:  ${updated}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Batch ID: ${IMPORT_BATCH_ID}`);

  // Final visibility check
  const visible = await prisma.admissionCase.count({
    where: {
      visibility: { in: [Visibility.PUBLIC, Visibility.ANONYMOUS] },
      essayContent: { not: null },
      reviewStatus: {
        in: [DataReviewStatus.AUTO_APPROVED, DataReviewStatus.APPROVED],
      },
    },
  });
  console.log(`Gallery-visible cases now: ${visible}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
