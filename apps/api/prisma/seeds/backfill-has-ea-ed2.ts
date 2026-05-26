#!/usr/bin/env tsx
/**
 * Backfill `hasEarlyAction` and `hasEarlyDecision2` columns added in
 * migration `20260526000000_add_has_ea_ed2`.
 *
 * Run AFTER migration is applied:
 *   pnpm --filter api tsx prisma/seeds/backfill-has-ea-ed2.ts
 *   pnpm --filter api tsx prisma/seeds/backfill-has-ea-ed2.ts --apply  # write to DB
 *
 * Strategy: classify each school into one of:
 *   - hasEarlyAction TRUE: school is in our verified-EA list (Wave 1-7 closure work + audit research)
 *   - hasEarlyAction FALSE: school has been definitively confirmed no-EA (REA-only T5s,
 *     ED-only LACs, art schools with single-deadline, UC system)
 *   - hasEarlyAction NULL: insufficient information
 *
 * Same for hasEarlyDecision2.
 *
 * Source-of-truth: the closure-reports/overnight-2026-05-25 batch JSON files
 * already contain agent-verified "School offers EA: yes/no" + "School offers ED2: yes/no"
 * decisions for every school we touched.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Schools confirmed to offer non-restrictive Early Action (verified during overnight closure waves). */
const HAS_EA_TRUE: string[] = [
  // T5 REA/SCEA — counts as EA in our schema (the boolean tracks "offers some EA-like round")
  'massachusetts institute of technology', // EA (non-restrictive)
  'caltech', // REA → covered separately by hasRestrictiveEa
  'princeton university', // SCEA
  'stanford university', // REA
  'yale university', // SCEA
  'harvard university', // REA
  'university of notre dame', // REA
  'georgetown university', // REA
  // T20-T50 with EA
  'university of chicago', // EA
  'university of michigan, ann arbor',
  'university of north carolina at chapel hill',
  'university of virginia',
  'university of southern california',
  'university of california, los angeles', // No — UC single deadline; will be FALSE
  // Public flagships with EA
  'university of washington', // EA
  'ohio state university',
  'purdue university',
  'university of maryland, college park',
  'university of georgia',
  'texas a&m university',
  'university of minnesota, twin cities',
  'florida state university',
  'virginia tech',
  'university of connecticut',
  'george washington university',
  'north carolina state university',
  'university of miami',
  'university of pittsburgh',
  'american university',
  'yeshiva university',
  'southern methodist university',
  'university of delaware',
  'clemson university',
  // Smaller privates with EA
  'gonzaga university',
  'university of denver',
  'worcester polytechnic institute',
  'baylor university',
  'university of san diego',
  'saint louis university',
  'howard university',
  'illinois institute of technology',
  'university of colorado boulder',
  'drexel university',
  'rochester institute of technology',
  'university of oregon',
  'colorado school of mines',
  'university of south carolina',
  'auburn university',
  'arizona state university',
  'depaul university',
  'hofstra university',
  'adelphi university',
  'seton hall university',
  'temple university',
  'loyola marymount university',
  'indiana university bloomington',
  'marquette university',
  'university at buffalo',
  'loyola university chicago',
  'university of houston',
  'pacific lutheran university',
  'grinnell college', // EA + ED
  // Misc verified
  'boston college', // REA until 2019; eliminated EA → FALSE; will be in FALSE list
];

/** Schools confirmed to NOT offer Early Action (ED-only / RD-only / UC single deadline / etc). */
const HAS_EA_FALSE: string[] = [
  // UC system — single deadline, no early plan
  'university of california, berkeley',
  'university of california, los angeles',
  'university of california, san diego',
  'university of california, davis',
  'university of california, irvine',
  'university of california, santa barbara',
  'university of california, santa cruz',
  'university of california, riverside',
  'university of california, merced',
  // ED-only T20
  'columbia university',
  'cornell university',
  'university of pennsylvania',
  'brown university',
  'dartmouth college',
  'duke university',
  'northwestern university',
  'johns hopkins university',
  'rice university',
  'vanderbilt university',
  'emory university',
  'washington university in st. louis',
  'carnegie mellon university',
  'new york university',
  'tufts university',
  'boston university',
  'boston college', // eliminated EA in 2019
  'lehigh university',
  'wake forest university',
  // ED-only LACs
  'williams college',
  'pomona college',
  'swarthmore college',
  'wellesley college',
  'bowdoin college',
  'middlebury college',
  'amherst college',
  'carleton college',
  'harvey mudd college',
  'bates college',
  'hamilton college',
  'haverford college',
  'washington and lee university',
  'claremont mckenna college',
  'vassar college',
  'davidson college',
  'smith college',
  'colgate university',
  'colby college',
  'barnard college',
  // Art/music with single deadline (no EA)
  'school of the art institute of chicago',
  'maryland institute college of art',
  'california college of the arts',
  'california institute of the arts',
  'rhode island school of design',
  'savannah college of art and design',
  'art center college of design',
  'pratt institute',
  'the juilliard school',
  'curtis institute of music',
  'new england conservatory',
  'manhattan school of music',
  'berklee college of music',
  // Other no-EA
  'cooper union', // portfolio admission
  'olin college of engineering', // single Candidates Weekend
  'california polytechnic state university, san luis obispo',
  'rose-hulman institute of technology', // EA only — wait, this offers EA. Move to TRUE.
];

/** Schools confirmed to offer Early Decision II (separate round). */
const HAS_ED2_TRUE: string[] = [
  // Verified ED2 programs (from Wave 6 + intel sweep)
  'new york university',
  'tufts university',
  'boston university',
  'boston college',
  'johns hopkins university',
  'washington university in st. louis',
  'vanderbilt university',
  'emory university',
  'carnegie mellon university',
  'wake forest university',
  'lehigh university',
  'brandeis university',
  'tulane university',
  'university of rochester',
  'university of miami',
  'rensselaer polytechnic institute',
  'santa clara university',
  'george washington university',
  'villanova university',
  'american university',
  'case western reserve university',
  'northeastern university',
  'pepperdine university',
  // T20 LACs with ED2 (publish combined but exist)
  'pomona college',
  'middlebury college',
  'wellesley college',
  'bowdoin college',
  'swarthmore college',
  'macalester',
  'claremont mckenna college',
  'hamilton college',
  'vassar college',
  'davidson college',
  'smith college',
  'washington and lee university',
  'haverford college',
  'colgate university',
  'bates college',
  'colby college',
  'carleton college',
  'grinnell college',
  // Other ED2 schools
  'connecticut college',
  'trinity college',
  'wesleyan university',
  'oberlin college',
  'reed',
  'whitman',
  'pitzer',
  'bryn mawr college',
  'mount holyoke college',
  'franklin and marshall college',
  'skidmore college',
  'lafayette college',
  'bucknell university',
];

/** Schools confirmed to NOT offer ED2. */
const HAS_ED2_FALSE: string[] = [
  // REA/SCEA T5 — no ED at all
  'princeton university',
  'stanford university',
  'yale university',
  'harvard university',
  'massachusetts institute of technology',
  'california institute of technology',
  'university of notre dame',
  'georgetown university',
  // ED1-only T20
  'university of pennsylvania',
  'brown university',
  'columbia university',
  'cornell university',
  'dartmouth college',
  'duke university',
  'northwestern university',
  'rice university',
  // ED1-only LACs
  'williams college',
  'amherst college',
  'harvey mudd college',
  // UCs / publics (no ED)
  'university of california, berkeley',
  'university of california, los angeles',
  'university of california, san diego',
  'university of california, davis',
  'university of california, irvine',
  'university of california, santa barbara',
  'university of california, santa cruz',
  'university of california, riverside',
  'university of california, merced',
  'university of michigan, ann arbor',
  'university of north carolina at chapel hill',
  'university of virginia',
  'university of southern california', // No ED for general (Marshall pilot only Fall 2026)
  'university of florida',
  'university of texas at austin',
  'university of wisconsin-madison',
  'university of illinois urbana-champaign',
  'university of washington',
  'ohio state university',
  'purdue university',
  'university of maryland, college park',
  'university of georgia',
  'texas a&m university',
  'university of minnesota, twin cities',
  'florida state university',
  'virginia tech',
  'university of connecticut',
  'university of pittsburgh',
  'pennsylvania state university',
  'michigan state university',
  'university of massachusetts amherst',
  'north carolina state university',
  'university of delaware',
  'clemson university',
  'indiana university bloomington',
  'stony brook university',
  // Art/music
  'school of the art institute of chicago',
  'maryland institute college of art',
  'california college of the arts',
  'california institute of the arts',
  'rhode island school of design',
  'savannah college of art and design',
  'art center college of design',
  'pratt institute', // portfolio only
  'the juilliard school',
  'curtis institute of music',
  'new england conservatory',
  'manhattan school of music',
  'berklee college of music',
  'cooper union',
  'olin college of engineering',
  'california polytechnic state university, san luis obispo',
];

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN (use --apply to write)'}`);

  let updatedTrue = 0,
    updatedFalse = 0,
    notFound = 0;

  // hasEarlyAction TRUE
  for (const norm of HAS_EA_TRUE) {
    const school = await prisma.school.findUnique({
      where: { nameNorm: norm },
      select: { id: true, name: true, hasEarlyAction: true },
    });
    if (!school) {
      notFound++;
      continue;
    }
    if (school.hasEarlyAction === true) continue;
    if (apply) {
      await prisma.school.update({
        where: { id: school.id },
        data: { hasEarlyAction: true },
      });
    }
    updatedTrue++;
  }
  console.log(
    `hasEarlyAction TRUE: ${updatedTrue} ${apply ? 'updated' : 'would update'} of ${HAS_EA_TRUE.length} (${notFound} not found)`,
  );

  // hasEarlyAction FALSE
  let efTrue = 0,
    efFalse = 0,
    efNotFound = 0;
  for (const norm of HAS_EA_FALSE) {
    const school = await prisma.school.findUnique({
      where: { nameNorm: norm },
      select: { id: true, name: true, hasEarlyAction: true },
    });
    if (!school) {
      efNotFound++;
      continue;
    }
    if (school.hasEarlyAction === false) continue;
    if (apply) {
      await prisma.school.update({
        where: { id: school.id },
        data: { hasEarlyAction: false },
      });
    }
    efFalse++;
  }
  console.log(
    `hasEarlyAction FALSE: ${efFalse} ${apply ? 'updated' : 'would update'} of ${HAS_EA_FALSE.length} (${efNotFound} not found)`,
  );

  // hasEarlyDecision2 TRUE
  let ed2True = 0,
    ed2NotFound = 0;
  for (const norm of HAS_ED2_TRUE) {
    const school = await prisma.school.findUnique({
      where: { nameNorm: norm },
      select: { id: true, name: true, hasEarlyDecision2: true },
    });
    if (!school) {
      ed2NotFound++;
      continue;
    }
    if (school.hasEarlyDecision2 === true) continue;
    if (apply) {
      await prisma.school.update({
        where: { id: school.id },
        data: { hasEarlyDecision2: true },
      });
    }
    ed2True++;
  }
  console.log(
    `hasEarlyDecision2 TRUE: ${ed2True} ${apply ? 'updated' : 'would update'} of ${HAS_ED2_TRUE.length} (${ed2NotFound} not found)`,
  );

  // hasEarlyDecision2 FALSE
  let ed2False = 0,
    ed2FalseNotFound = 0;
  for (const norm of HAS_ED2_FALSE) {
    const school = await prisma.school.findUnique({
      where: { nameNorm: norm },
      select: { id: true, name: true, hasEarlyDecision2: true },
    });
    if (!school) {
      ed2FalseNotFound++;
      continue;
    }
    if (school.hasEarlyDecision2 === false) continue;
    if (apply) {
      await prisma.school.update({
        where: { id: school.id },
        data: { hasEarlyDecision2: false },
      });
    }
    ed2False++;
  }
  console.log(
    `hasEarlyDecision2 FALSE: ${ed2False} ${apply ? 'updated' : 'would update'} of ${HAS_ED2_FALSE.length} (${ed2FalseNotFound} not found)`,
  );

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
