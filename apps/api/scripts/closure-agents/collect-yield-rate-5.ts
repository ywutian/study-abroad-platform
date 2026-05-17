/**
 * collect-yield-rate-5.ts
 *
 * closure-v2 data-collection agent output (batch 5 — OFFSET 60).
 *
 * Writes REAL, source-verified `School.yieldRate` values for a 30-school batch
 * of ClosureTarget rows with field='yieldRate' and status='PENDING'.
 *
 * Semantics of yieldRate:
 *   yield % = (first-year students enrolled / students admitted) * 100
 *
 * Source priority: school Common Data Set (Section C1/C2) > IPEDS-derived
 * trackers (CollegeData / collegetuitioncompare / Data USA) > credible news.
 * Range gate: 5–90%. Any value outside the gate is rejected.
 *
 * `School.yieldRate` and `ClosureTarget` are present in the live DB but not in
 * the Prisma schema file, so this script uses raw SQL ($queryRaw/$executeRaw)
 * rather than the typed Prisma client.
 *
 * metadata.provenance.yieldRate is MERGED into existing metadata —
 * other provenance keys are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-yield-rate-5.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-yield-agent-5';

type Status = 'CLOSED' | 'UNAVAILABLE' | 'FAILED';
type Tier = 'SCRAPED' | 'OFFICIAL';

interface Target {
  targetId: string;
  schoolId: string;
  name: string;
  status: Status;
  /** Yield % — required when status='CLOSED', else null. */
  value: number | null;
  sourceUrl: string | null;
  confidence: number | null;
  tier: Tier | null;
  /** Arithmetic / provenance basis. */
  note: string;
}

/**
 * Every CLOSED entry is backed by IPEDS-derived admitted/enrolled count pairs
 * (collegetuitioncompare, 2024-25 cycle) and, where available, corroborated by
 * official institutional figures.
 */
const TARGETS: Target[] = [
  {
    targetId: 'cmp9pn1gh016oa85otfsc3z9p',
    schoolId: 'cmnwr8imr000hz0tik9lqym4i',
    name: 'Fordham University',
    status: 'CLOSED',
    value: 9.83,
    sourceUrl:
      'https://www.fordham.edu/undergraduate-admission/why-fordham/admission-facts/',
    confidence: 0.82,
    tier: 'OFFICIAL',
    note: 'Fordham Undergraduate Admission Facts 2024-25: 25,207 admitted, 2,478 enrolled → 2478/25207 = 9.83%. Corroborated by IPEDS-derived 9.69%.',
  },
  {
    targetId: 'cmp9pmzkt0055a85oh2f0d9by',
    schoolId: 'cmnwr8iuk0040z0ti7p8v604n',
    name: 'Gonzaga University',
    status: 'CLOSED',
    value: 17.48,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/235316/gonzaga-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 7,155 admitted, 1,251 enrolled → 1251/7155 = 17.48%.',
  },
  {
    targetId: 'cmp9pn0o000pra85o8p28hi5t',
    schoolId: 'cmnwr8ind000tz0timgwcy8hj',
    name: 'Loyola Marymount University',
    status: 'CLOSED',
    value: 14.8,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/117946/loyola-marymount-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 10,409 admitted, 1,541 enrolled → 1541/10409 = 14.80%.',
  },
  {
    targetId: 'cmp9pn0k400o2a85ovuu68xzw',
    schoolId: 'cmnwr8itw003sz0ti2fueoy2e',
    name: 'Baylor University',
    status: 'CLOSED',
    value: 14.23,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/223232/baylor-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 24,075 admitted, 3,427 enrolled → 3427/24075 = 14.23%.',
  },
  {
    targetId: 'cmp9pmzod007ia85o1rmwpc4f',
    schoolId: 'cmnwr8io20018z0tizk1tsitd',
    name: 'North Carolina State University',
    status: 'CLOSED',
    value: 31.76,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/199193/north-carolina-state-university-at-raleigh/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 18,385 admitted, 5,839 enrolled → 5839/18385 = 31.76%.',
  },
  {
    targetId: 'cmp9pn28l01nea85oyk3rizpr',
    schoolId: 'cmnwr8ity003tz0tie2nazej1',
    name: 'American University',
    status: 'CLOSED',
    value: 15.62,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/131159/american-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 10,640 admitted, 1,662 enrolled → 1662/10640 = 15.62%.',
  },
  {
    targetId: 'cmp9pn0i100mva85o97bl5you',
    schoolId: 'cmnwr8ins0012z0ti4o8njwhn',
    name: 'Stony Brook University',
    status: 'CLOSED',
    value: 14.75,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/196097/stony-brook-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 27,406 admitted, 4,042 enrolled → 4042/27406 = 14.75%.',
  },
  {
    targetId: 'cmp9pn0gz00maa85ohtgclmu3',
    schoolId: 'cmnwr8imu000jz0ti03zavqgf',
    name: 'University of Massachusetts Amherst',
    status: 'CLOSED',
    value: 17.95,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/166629/university-of-massachusetts-amherst/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 30,020 admitted, 5,388 enrolled → 5388/30020 = 17.95%.',
  },
  {
    targetId: 'cmp9pn1a8012ua85odxx66o6q',
    schoolId: 'cmnwr8inl000yz0ti6wsiqcrv',
    name: 'Marquette University',
    status: 'CLOSED',
    value: 14.13,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/239105/marquette-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 15,212 admitted, 2,149 enrolled → 2149/15212 = 14.13%.',
  },
  {
    targetId: 'cmp9pn0v800u6a85o2by4n233',
    schoolId: 'cmnwr8in3000oz0tih36u19xf',
    name: 'Clemson University',
    status: 'CLOSED',
    value: 20.69,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/217882/clemson-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 23,586 admitted, 4,880 enrolled → 4880/23586 = 20.69%.',
  },
  {
    targetId: 'cmp9pn0an00jda85ofeada060',
    schoolId: 'cmnwr8io00017z0ti5bju2vo7',
    name: 'University at Buffalo',
    status: 'CLOSED',
    value: 14.07,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/196088/university-at-buffalo/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 30,308 admitted, 4,265 enrolled → 4265/30308 = 14.07%.',
  },
  {
    targetId: 'cmp9pn1gz016za85opf2vh50f',
    schoolId: 'cmnwr8inp0010z0tivwogzepz',
    name: 'University of South Florida',
    status: 'CLOSED',
    value: 23.31,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/137351/university-of-south-florida/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 29,621 admitted, 6,904 enrolled → 6904/29621 = 23.31%.',
  },
  {
    targetId: 'cmp9pn07800hxa85ovuqstmn9',
    schoolId: 'cmnwr8io40019z0ti0z11pe98',
    name: 'University of California, Riverside',
    status: 'CLOSED',
    value: 12.23,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/110671/university-of-california-riverside/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 44,343 admitted, 5,422 enrolled → 5422/44343 = 12.23%.',
  },
  {
    targetId: 'cmp9pn1id017ja85osbbj31y1',
    schoolId: 'cmnwr8iuf003zz0ti12pe3iq1',
    name: 'University of San Diego',
    status: 'CLOSED',
    value: 12.39,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/122436/university-of-san-diego/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 8,908 admitted, 1,104 enrolled → 1104/8908 = 12.39%.',
  },
  {
    targetId: 'cmp9pn2hr01t1a85o5v64f1ee',
    schoolId: 'cmnwr8iu0003uz0ti43l07p17',
    name: 'Worcester Polytechnic Institute',
    status: 'CLOSED',
    value: 18.08,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/168421/worcester-polytechnic-institute/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 7,555 admitted, 1,366 enrolled → 1366/7555 = 18.08%.',
  },
  {
    targetId: 'cmp9pn10s00xqa85ovmb5yp29',
    schoolId: 'cmnwr8inq0011z0tims8lt244',
    name: 'Temple University',
    status: 'CLOSED',
    value: 15.19,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/216339/temple-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 31,966 admitted, 4,857 enrolled → 4857/31966 = 15.19%.',
  },
  {
    targetId: 'cmp9pn10800xfa85oq8t4tnf3',
    schoolId: 'cmnwr8ink000xz0tivm4enckb',
    name: 'Drexel University',
    status: 'CLOSED',
    value: 8.09,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/212054/drexel-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 29,182 admitted, 2,399 enrolled → 2399/29182 = 8.09%.',
  },
  {
    targetId: 'cmp9pn0dx00kta85ojyzkrrxs',
    schoolId: 'cmnwr8iud003yz0tinuqfaa54',
    name: 'University of Denver',
    status: 'CLOSED',
    value: 9.15,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/127060/university-of-denver/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 14,618 admitted, 1,337 enrolled → 1337/14618 = 9.15%.',
  },
  {
    targetId: 'cmp9pn1eo015ia85oeeqnkn7c',
    schoolId: 'cmnwr8iua003xz0tio2zj4a4z',
    name: 'Saint Louis University',
    status: 'CLOSED',
    value: 13.86,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/179159/saint-louis-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 11,656 admitted, 1,615 enrolled → 1615/11656 = 13.86%.',
  },
  {
    targetId: 'cmp9pn02p00g3a85o1oujjdhv',
    schoolId: 'cmnwr8iu6003wz0tio3oagiri',
    name: 'Rochester Institute of Technology',
    status: 'CLOSED',
    value: 16.28,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/195003/rochester-institute-of-technology/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 18,682 admitted, 3,042 enrolled → 3042/18682 = 16.28%.',
  },
  {
    targetId: 'cmp9pn1pm01c7a85otnw2rrux',
    schoolId: 'cmnwr8inb000sz0ti3r4uwfjt',
    name: 'Illinois Institute of Technology',
    status: 'CLOSED',
    value: 7.73,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/145725/illinois-institute-of-technology/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 6,710 admitted, 519 enrolled → 519/6710 = 7.73%.',
  },
  {
    targetId: 'cmp9pn2or01x0a85on2dypprf',
    schoolId: 'cmnwr8ime000az0ti9ts1sd20',
    name: 'Colorado School of Mines',
    status: 'CLOSED',
    value: 23.08,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/126775/colorado-school-of-mines/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 6,940 admitted, 1,602 enrolled → 1602/6940 = 23.08%.',
  },
  {
    targetId: 'cmp9pn0ky00oma85oyj6ydrh7',
    schoolId: 'cmnwr8iu3003vz0tig0fa53lf',
    name: 'Howard University',
    status: 'CLOSED',
    value: 19.36,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/131520/howard-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 14,144 admitted, 2,738 enrolled → 2738/14144 = 19.36%.',
  },
  {
    targetId: 'cmp9pn0j200nha85ozicp5hr8',
    schoolId: 'cmnwr8io5001az0tibgs1vu54',
    name: 'University of California, Santa Cruz',
    status: 'CLOSED',
    value: 9.29,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/110714/university-of-california-santa-cruz/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 47,186 admitted, 4,383 enrolled → 4383/47186 = 9.29%.',
  },
  {
    targetId: 'cmp9pmzw800c8a85ocnq6n326',
    schoolId: 'cmnwr8inn000zz0tihkfqe5yc',
    name: 'University of Arizona',
    status: 'CLOSED',
    value: 18.39,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/104179/university-of-arizona/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 50,252 admitted, 9,240 enrolled → 9240/50252 = 18.39%.',
  },
  {
    targetId: 'cmp9pmzsr00aea85o4q75za6d',
    schoolId: 'cmnwr8io7001bz0tihu5wo9mh',
    name: 'Rutgers University-Newark',
    status: 'CLOSED',
    value: 7.07,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/186399/rutgers-university-newark/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 26,254 admitted, 1,857 enrolled → 1857/26254 = 7.07%.',
  },
  {
    targetId: 'cmp9pn0xe00vna85ogq28f6x0',
    schoolId: 'cmnwr8imp000gz0tibbuqx67l',
    name: 'University of California, Merced',
    status: 'CLOSED',
    value: 7.24,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/445188/university-of-california-merced/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 28,906 admitted, 2,093 enrolled → 2093/28906 = 7.24%.',
  },
  {
    targetId: 'cmp9pn1it017ua85ocuau9yd1',
    schoolId: 'cmnwr8inv0014z0ti6jqhq1ga',
    name: 'University of South Carolina',
    status: 'CLOSED',
    value: 22.94,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/218663/university-of-south-carolina/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25 (Columbia): 31,701 admitted, 7,272 enrolled → 7272/31701 = 22.94%.',
  },
  {
    targetId: 'cmp9pn1ca0140a85oqjwl161a',
    schoolId: 'cmnwr8iob001dz0ti3go71xpz',
    name: 'University of Utah',
    status: 'CLOSED',
    value: 26.02,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/230764/university-of-utah/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 23,062 admitted, 6,001 enrolled → 6001/23062 = 26.02%.',
  },
  {
    targetId: 'cmp9pn1r701d3a85oosjdes90',
    schoolId: 'cmnwr8ini000wz0ti57rv9m9o',
    name: 'Auburn University',
    status: 'CLOSED',
    value: 24.14,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/100858/auburn-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 25,284 admitted, 6,103 enrolled → 6103/25284 = 24.14%.',
  },
];

const MIN_YIELD = 5;
const MAX_YIELD = 90;

async function main() {
  console.log(
    `[closure-v2-yield-agent-5] processing ${TARGETS.length} targets (fetchedAt=${FETCHED_AT})\n`,
  );

  let closed = 0;
  let unavailable = 0;
  let failed = 0;

  for (const t of TARGETS) {
    let effectiveStatus: Status = t.status;
    let lastError: string | null = null;

    // Range gate enforcement — defence in depth.
    if (effectiveStatus === 'CLOSED') {
      if (t.value == null || t.value < MIN_YIELD || t.value > MAX_YIELD) {
        effectiveStatus = 'FAILED';
        lastError = `yield ${t.value ?? 'null'}% outside valid range ${MIN_YIELD}-${MAX_YIELD}%`;
      }
    }

    if (effectiveStatus === 'CLOSED' && t.value != null) {
      const rows = await prisma.$queryRaw<
        Array<{ id: string; metadata: unknown }>
      >`SELECT id, metadata FROM "School" WHERE id = ${t.schoolId}`;

      if (rows.length === 0) {
        effectiveStatus = 'FAILED';
        lastError = `school id ${t.schoolId} not found`;
      } else {
        const existingMetadata =
          rows[0].metadata &&
          typeof rows[0].metadata === 'object' &&
          !Array.isArray(rows[0].metadata)
            ? (rows[0].metadata as Record<string, unknown>)
            : {};

        const existingProvenance =
          existingMetadata.provenance &&
          typeof existingMetadata.provenance === 'object' &&
          !Array.isArray(existingMetadata.provenance)
            ? (existingMetadata.provenance as Record<string, unknown>)
            : {};

        const mergedMetadata = {
          ...existingMetadata,
          provenance: {
            ...existingProvenance,
            yieldRate: {
              value: t.value,
              sourceUrl: t.sourceUrl,
              fetchedAt: FETCHED_AT,
              verifiedBy: VERIFIED_BY,
              confidence: t.confidence,
              tier: t.tier,
              note: t.note,
            },
          },
        };

        await prisma.$executeRaw`
          UPDATE "School"
          SET "yieldRate" = ${t.value},
              metadata = ${JSON.stringify(mergedMetadata)}::jsonb
          WHERE id = ${t.schoolId}`;
      }
    }

    // Update ClosureTarget row with outcome + provenance + attempt bookkeeping.
    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = ${effectiveStatus}::"ClosureTargetStatus",
          "sourceUrl" = ${effectiveStatus === 'CLOSED' ? t.sourceUrl : null},
          confidence = ${effectiveStatus === 'CLOSED' ? t.confidence : null},
          tier = ${effectiveStatus === 'CLOSED' ? t.tier : null},
          attempts = attempts + 1,
          "lastAttemptAt" = ${new Date()},
          "lastError" = ${lastError},
          "updatedAt" = ${new Date()}
      WHERE id = ${t.targetId}`;

    if (effectiveStatus === 'CLOSED') {
      closed += 1;
      console.log(`  CLOSED       ${t.name} => ${t.value}%  [${t.sourceUrl}]`);
    } else if (effectiveStatus === 'UNAVAILABLE') {
      unavailable += 1;
      console.log(`  UNAVAILABLE  ${t.name}`);
    } else {
      failed += 1;
      console.log(`  FAILED       ${t.name}  (${lastError})`);
    }
  }

  console.log(
    `\n[closure-v2-yield-agent-5] done. CLOSED=${closed} UNAVAILABLE=${unavailable} FAILED=${failed} (total ${TARGETS.length}).`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-yield-agent-5] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
