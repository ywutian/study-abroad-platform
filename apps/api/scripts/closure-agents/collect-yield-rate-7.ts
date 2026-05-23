/**
 * collect-yield-rate-7.ts
 *
 * closure-v2 data-collection agent output (batch 7 — OFFSET 30).
 *
 * Writes REAL, source-verified `School.yieldRate` values for a 30-school batch
 * of ClosureTarget rows with field='yieldRate' and status='PENDING'.
 *
 * Semantics of yieldRate:
 *   yield % = (first-year students enrolled / students admitted) * 100
 *
 * Source priority: school Common Data Set (Section C1/C2) > IPEDS-derived
 * trackers (CollegeTuitionCompare) > credible news.
 * Range gate: 5–90%. Any value outside the gate is rejected.
 *
 * `School.yieldRate` and `ClosureTarget` are present in the live DB but not in
 * the Prisma schema file, so this script uses raw SQL ($queryRaw/$executeRaw)
 * rather than the typed Prisma client.
 *
 * metadata.provenance.yieldRate is MERGED into existing metadata —
 * other provenance keys are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-yield-rate-7.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-yield-agent-7';

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
 * (collegetuitioncompare, 2024-25 cycle) — yield = enrolled / admitted.
 */
const TARGETS: Target[] = [
  {
    targetId: 'cmp9pn13f00z9a85opwk2v4kh',
    schoolId: 'cmnwr8iqf0024z0tiy29w0e1z',
    name: 'Missouri University of Science and Technology',
    status: 'CLOSED',
    value: 20.94,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/178411/missouri-university-of-science-and-technology/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 6,059 admitted, 1,269 enrolled → 1269/6059 = 20.94%.',
  },
  {
    targetId: 'cmp9pn1sc01dpa85osrb2kfed',
    schoolId: 'cmnwr8iqh0025z0ti7z1ynz4s',
    name: 'Washington State University',
    status: 'CLOSED',
    value: 19.72,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/236939/washington-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 22,060 admitted, 4,350 enrolled → 4350/22060 = 19.72%.',
  },
  {
    targetId: 'cmp9pn0vn00uha85ozeuq8xoi',
    schoolId: 'cmnwr8iqc0023z0ti60klqjhy',
    name: 'Kansas State University',
    status: 'CLOSED',
    value: 27.48,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/155399/kansas-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 12,669 admitted, 3,482 enrolled → 3482/12669 = 27.48%.',
  },
  {
    targetId: 'cmp9pn23f01k7a85opydozjsh',
    schoolId: 'cmnwr8iqi0026z0tin3vtpw1p',
    name: 'University of Maine',
    status: 'CLOSED',
    value: 15.42,
    sourceUrl: 'https://www.collegetuitioncompare.com/edu/161253/university-of-maine/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 13,572 admitted, 2,093 enrolled → 2093/13572 = 15.42%.',
  },
  {
    targetId: 'cmp9pn0yd00w9a85ohl5h847a',
    schoolId: 'cmnwr8iqk0027z0ti3qm7r15o',
    name: 'University of Central Florida',
    status: 'CLOSED',
    value: 33.5,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/132903/university-of-central-florida/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 24,653 admitted, 8,259 enrolled → 8259/24653 = 33.50%.',
  },
  {
    targetId: 'cmp9pn27s01mua85o4lvjqblb',
    schoolId: 'cmnwr8iqm0028z0ti63txqxzg',
    name: 'Illinois State University',
    status: 'CLOSED',
    value: 22.53,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/145813/illinois-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 19,017 admitted, 4,285 enrolled → 4285/19017 = 22.53%.',
  },
  {
    targetId: 'cmp9pn0qk00r8a85oy99mj0jp',
    schoolId: 'cmnwr8iqr002az0ti1une85dx',
    name: 'Rowan University',
    status: 'CLOSED',
    value: 23.04,
    sourceUrl: 'https://www.collegetuitioncompare.com/edu/184782/rowan-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 15,216 admitted, 3,506 enrolled → 3506/15216 = 23.04%.',
  },
  {
    targetId: 'cmp9pn189011na85od0p1q4be',
    schoolId: 'cmnwr8iqp0029z0ti2wbplonv',
    name: 'Hofstra University',
    status: 'CLOSED',
    value: 10.3,
    sourceUrl: 'https://www.collegetuitioncompare.com/edu/191649/hofstra-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 17,035 admitted, 1,754 enrolled → 1754/17035 = 10.30%.',
  },
  {
    targetId: 'cmp9pn1z401hva85oi2m5wpmb',
    schoolId: 'cmnwr8iqt002bz0ti5efot7m8',
    name: 'Adelphi University',
    status: 'CLOSED',
    value: 10.34,
    sourceUrl: 'https://www.collegetuitioncompare.com/edu/188429/adelphi-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 12,987 admitted, 1,343 enrolled → 1343/12987 = 10.34%.',
  },
  {
    targetId: 'cmp9pn1dc014ma85od59bf6wz',
    schoolId: 'cmnwr8iqy002ez0tizit8vwvw',
    name: 'Ohio University',
    status: 'CLOSED',
    value: 19.22,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/204857/ohio-university-main-campus/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 23,360 admitted, 4,489 enrolled → 4489/23360 = 19.22%.',
  },
  {
    targetId: 'cmp9pn0p200qca85onuby0xem',
    schoolId: 'cmnwr8iqx002dz0tigsxpge66',
    name: 'Mississippi State University',
    status: 'CLOSED',
    value: 19.84,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/176080/mississippi-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 18,125 admitted, 3,596 enrolled → 3596/18125 = 19.84%.',
  },
  {
    targetId: 'cmp9pn2c901ppa85o3fm72skj',
    schoolId: 'cmnwr8ir0002fz0tiuxlv8v32',
    name: 'Kent State University',
    status: 'CLOSED',
    value: 20.26,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/203517/kent-state-university-at-kent/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 21,248 admitted, 4,304 enrolled → 4304/21248 = 20.26%.',
  },
  {
    targetId: 'cmp9pn1zq01i6a85oi1gvvmiz',
    schoolId: 'cmnwr8ir7002iz0ti11f0voua',
    name: 'University of Wyoming',
    status: 'CLOSED',
    value: 23.81,
    sourceUrl: 'https://www.collegetuitioncompare.com/edu/240727/university-of-wyoming/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 6,023 admitted, 1,434 enrolled → 1434/6023 = 23.81%.',
  },
  {
    targetId: 'cmp9pn1su01e0a85oqdhsxuzk',
    schoolId: 'cmnwr8ir2002gz0tih2v6dubi',
    name: 'University of New Mexico',
    status: 'CLOSED',
    value: 31.19,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/187985/university-of-new-mexico-main-campus/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 11,678 admitted, 3,642 enrolled → 3642/11678 = 31.19%.',
  },
  {
    targetId: 'cmp9pn0jm00nsa85o2ezinget',
    schoolId: 'cmnwr8ir4002hz0tibdz0myoo',
    name: 'Ball State University',
    status: 'CLOSED',
    value: 20.44,
    sourceUrl: 'https://www.collegetuitioncompare.com/edu/150136/ball-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 18,034 admitted, 3,686 enrolled → 3686/18034 = 20.44%.',
  },
  {
    targetId: 'cmp9pn2cs01q0a85oz6gckqy9',
    schoolId: 'cmnwr8ira002jz0tib0nkhdsx',
    name: 'West Virginia University',
    status: 'CLOSED',
    value: 24.77,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/238032/west-virginia-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 16,669 admitted, 4,129 enrolled → 4129/16669 = 24.77%.',
  },
  {
    targetId: 'cmp9pn0rg00rta85ovc54f1eg',
    schoolId: 'cmnwr8ird002kz0tifunyipf1',
    name: 'University of North Dakota',
    status: 'CLOSED',
    value: 34.71,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/200280/university-of-north-dakota/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 6,353 admitted, 2,205 enrolled → 2205/6353 = 34.71%.',
  },
  {
    targetId: 'cmp9pn2db01qba85oy4dja7vo',
    schoolId: 'cmnwr8irj002nz0tief4railh',
    name: 'University of Nevada, Reno',
    status: 'CLOSED',
    value: 26.45,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/182290/university-of-nevada-reno/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 13,032 admitted, 3,447 enrolled → 3447/13032 = 26.45%.',
  },
  {
    targetId: 'cmp9pn0uc00tla85oujandlnw',
    schoolId: 'cmnwr8irf002lz0titpd5mufz',
    name: 'University of South Dakota',
    status: 'CLOSED',
    value: 24.07,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/219471/university-of-south-dakota/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 5,892 admitted, 1,418 enrolled → 1418/5892 = 24.07%.',
  },
  {
    targetId: 'cmp9pn0tu00taa85orapf7cct',
    schoolId: 'cmnwr8irh002mz0tik8qulubb',
    name: 'Montana State University',
    status: 'CLOSED',
    value: 20.31,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/180461/montana-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 17,786 admitted, 3,612 enrolled → 3612/17786 = 20.31%.',
  },
  {
    targetId: 'cmp9pn1va01fja85ozr7rn33k',
    schoolId: 'cmnwr8irn002pz0tihyw561a7',
    name: 'Texas Tech University',
    status: 'CLOSED',
    value: 27.13,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/229115/texas-tech-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 24,958 admitted, 6,772 enrolled → 6772/24958 = 27.13%.',
  },
  {
    targetId: 'cmp9pn18s011ya85owrwcdaxb',
    schoolId: 'cmnwr8irl002oz0tiyc5w37jx',
    name: 'Portland State University',
    status: 'CLOSED',
    value: 18.21,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/209807/portland-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 8,248 admitted, 1,502 enrolled → 1502/8248 = 18.21%.',
  },
  {
    targetId: 'cmp9pn2dv01qma85o6k5l44i1',
    schoolId: 'cmnwr8iro002qz0tiayclu6c9',
    name: 'University of Idaho',
    status: 'CLOSED',
    value: 19.94,
    sourceUrl: 'https://www.collegetuitioncompare.com/edu/142285/university-of-idaho/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 10,154 admitted, 2,025 enrolled → 2025/10154 = 19.94%.',
  },
  {
    targetId: 'cmp9pn1kp0191a85omrzpmxc4',
    schoolId: 'cmnwr8irs002sz0ti22brcgol',
    name: 'University of Nevada, Las Vegas',
    status: 'CLOSED',
    value: 36.19,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/182281/university-of-nevada-las-vegas/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 12,242 admitted, 4,430 enrolled → 4430/12242 = 36.19%.',
  },
  {
    targetId: 'cmp9pn1lj019ma85oc5515ggj',
    schoolId: 'cmnwr8irt002tz0tiua8akwdq',
    name: 'San Jose State University',
    status: 'CLOSED',
    value: 14.65,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/122755/san-jose-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 31,419 admitted, 4,604 enrolled → 4604/31419 = 14.65%.',
  },
  {
    targetId: 'cmp9pn1y701hba85o8wvv5g9e',
    schoolId: 'cmnwr8irq002rz0ti2ejl7chb',
    name: 'University of North Texas',
    status: 'CLOSED',
    value: 24.21,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/227216/university-of-north-texas/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 27,793 admitted, 6,730 enrolled → 6730/27793 = 24.21%.',
  },
  {
    targetId: 'cmp9pn12b00yna85oz8gp5d1t',
    schoolId: 'cmnwr8irv002uz0tic1bpn6g4',
    name: 'Bowling Green State University',
    status: 'CLOSED',
    value: 20.56,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/201441/bowling-green-state-university-main-campus/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 17,125 admitted, 3,521 enrolled → 3521/17125 = 20.56%.',
  },
  {
    targetId: 'cmp9pn06f00hma85op126kxz0',
    schoolId: 'cmnwr8iry002wz0tiljzfdqu7',
    name: 'California State University, Long Beach',
    status: 'CLOSED',
    value: 16.68,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/110583/california-state-university-long-beach/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 38,854 admitted, 6,482 enrolled → 6482/38854 = 16.68%.',
  },
  {
    targetId: 'cmp9pn19d0129a85oz2yu01dy',
    schoolId: 'cmnwr8irx002vz0ti8qpx4iws',
    name: 'California State University, Fullerton',
    status: 'CLOSED',
    value: 14.21,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/110565/california-state-university-fullerton/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 48,482 admitted, 6,887 enrolled → 6887/48482 = 14.21%.',
  },
  {
    targetId: 'cmp9pn2eu01r8a85on4nbtgzp',
    schoolId: 'cmnwr8is4002zz0ti7l7rukwt',
    name: 'South Dakota State University',
    status: 'CLOSED',
    value: 34.06,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/219356/south-dakota-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 7,166 admitted, 2,441 enrolled → 2441/7166 = 34.06%.',
  },
];

const MIN_YIELD = 5;
const MAX_YIELD = 90;

async function main() {
  console.log(
    `[closure-v2-yield-agent-7] processing ${TARGETS.length} targets (fetchedAt=${FETCHED_AT})\n`,
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
          rows[0].metadata && typeof rows[0].metadata === 'object' && !Array.isArray(rows[0].metadata)
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
    `\n[closure-v2-yield-agent-7] done. CLOSED=${closed} UNAVAILABLE=${unavailable} FAILED=${failed} (total ${TARGETS.length}).`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-yield-agent-7] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
