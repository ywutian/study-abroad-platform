/**
 * collect-yield-rate-8.ts
 *
 * closure-v2 data-collection agent output (batch 8 — OFFSET 60).
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
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-yield-rate-8.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-yield-agent-8';

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
    targetId: 'cmp9pn1tb01eba85oj2ds8plx',
    schoolId: 'cmnwr8is3002yz0ti9qk8f21x',
    name: 'North Dakota State University',
    status: 'CLOSED',
    value: 32.01,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/200332/north-dakota-state-university-main-campus/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 6,864 admitted, 2,197 enrolled → 2197/6864 = 32.01%.',
  },
  {
    targetId: 'cmp9pn2pa01xba85osxsgmdtn',
    schoolId: 'cmnwr8isc0033z0tibp1hnmdi',
    name: 'University of Massachusetts Lowell',
    status: 'CLOSED',
    value: 18.07,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/166513/university-of-massachusetts-lowell/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 11,444 admitted, 2,068 enrolled → 2068/11444 = 18.07%.',
  },
  {
    targetId: 'cmp9pn0zb00wua85o8oxaqbmx',
    schoolId: 'cmnwr8isa0032z0tiytg48wsw',
    name: 'Wayne State University',
    status: 'CLOSED',
    value: 22.39,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/172644/wayne-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 13,781 admitted, 3,085 enrolled → 3085/13781 = 22.39%.',
  },
  {
    targetId: 'cmp9pn1ju018ga85oden5dxvz',
    schoolId: 'cmnwr8is60030z0timvbtgjwa',
    name: 'University of Akron',
    status: 'CLOSED',
    value: 18.29,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/200800/university-of-akron-main-campus/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 10,755 admitted, 1,967 enrolled → 1967/10755 = 18.29%.',
  },
  {
    targetId: 'cmp9pmzf0001da85od5xj5h7r',
    schoolId: 'cmnwr8is80031z0tizosa0sa8',
    name: 'University of Toledo',
    status: 'CLOSED',
    value: 18.84,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/206084/university-of-toledo/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 10,184 admitted, 1,919 enrolled → 1919/10184 = 18.84%.',
  },
  {
    targetId: 'cmp9pn23y01kia85odkxnsb48',
    schoolId: 'cmnwr8ish0036z0tiy3l6tt76',
    name: 'California State University, Northridge',
    status: 'CLOSED',
    value: 17.97,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/110608/california-state-university-northridge/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 30,842 admitted, 5,543 enrolled → 5543/30842 = 17.97%.',
  },
  {
    targetId: 'cmp9pn1ts01ema85ok6gnnffj',
    schoolId: 'cmnwr8isf0035z0tixudqprxr',
    name: 'New Mexico State University',
    status: 'CLOSED',
    value: 20.64,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/188030/new-mexico-state-university-main-campus/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 11,650 admitted, 2,404 enrolled → 2404/11650 = 20.64%.',
  },
  {
    targetId: 'cmp9pn2fc01rja85ocu6bhe4q',
    schoolId: 'cmnwr8ise0034z0tiwz772kaw',
    name: 'Oklahoma State University',
    status: 'CLOSED',
    value: 26.91,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/207388/oklahoma-state-university-main-campus/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 18,693 admitted, 5,030 enrolled → 5030/18693 = 26.91%.',
  },
  {
    targetId: 'cmp9pmzxj00d4a85ovn7x31bl',
    schoolId: 'cmnwr8isj0037z0tihc4cw8ue',
    name: 'University of Southern Mississippi',
    status: 'CLOSED',
    value: 24.98,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/176372/university-of-southern-mississippi/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 6,986 admitted, 1,745 enrolled → 1745/6986 = 24.98%.',
  },
  {
    targetId: 'cmp9pn2ft01rua85o0qjyu4cv',
    schoolId: 'cmnwr8isl0038z0ti3vw64w98',
    name: 'Northern Illinois University',
    status: 'CLOSED',
    value: 12.06,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/147703/northern-illinois-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 16,505 admitted, 1,991 enrolled → 1991/16505 = 12.06%.',
  },
  {
    targetId: 'cmp9pn1ua01exa85ouu0se01y',
    schoolId: 'cmnwr8isn0039z0tik49prelk',
    name: 'Eastern Michigan University',
    status: 'CLOSED',
    value: 9.71,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/169798/eastern-michigan-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 16,992 admitted, 1,650 enrolled → 1650/16992 = 9.71%.',
  },
  {
    targetId: 'cmp9pn14600zka85onr9as8c8',
    schoolId: 'cmnwr8isr003bz0ti1h6j1c5s',
    name: 'Western Michigan University',
    status: 'CLOSED',
    value: 13.53,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/172699/western-michigan-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 18,359 admitted, 2,484 enrolled → 2484/18359 = 13.53%.',
  },
  {
    targetId: 'cmp9pn1w801g5a85oignr1zmc',
    schoolId: 'cmnwr8iso003az0tilgsdacqo',
    name: 'University of Wisconsin-Milwaukee',
    status: 'CLOSED',
    value: 23.76,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/240453/university-of-wisconsin-milwaukee/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 14,581 admitted, 3,464 enrolled → 3464/14581 = 23.76%.',
  },
  {
    targetId: 'cmp9pmzy200dfa85ongzsy5v0',
    schoolId: 'cmnwr8isv003ez0timrhbjznd',
    name: 'University of Memphis',
    status: 'CLOSED',
    value: 18.06,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/220862/university-of-memphis/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 10,865 admitted, 1,962 enrolled → 1962/10865 = 18.06%.',
  },
  {
    targetId: 'cmp9pn0ii00n6a85orih2reuu',
    schoolId: 'cmnwr8isu003dz0tijwn1m0s0',
    name: 'University of Texas at Arlington',
    status: 'CLOSED',
    value: 26.44,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/228769/the-university-of-texas-at-arlington/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 19,675 admitted, 5,202 enrolled → 5202/19675 = 26.44%.',
  },
  {
    targetId: 'cmp9pn15a0106a85ou87hcnv4',
    schoolId: 'cmnwr8isz003fz0tisq77swxo',
    name: 'University of Texas at San Antonio',
    status: 'CLOSED',
    value: 27.10,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/229027/the-university-of-texas-at-san-antonio/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 22,063 admitted, 5,980 enrolled → 5980/22063 = 27.10%.',
  },
  {
    targetId: 'cmp9pn25d01lda85o6n51o4dt',
    schoolId: 'cmnwr8iss003cz0tia71q9qy1',
    name: 'Idaho State University',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'Idaho State University has an open admission policy — IPEDS reports admissions/yield as [Not applicable] (NCES DFR 2024, unitId 142276). No admitted/enrolled count pair exists to compute yield.',
  },
  {
    targetId: 'cmp9pn1mz01aia85oonc8ymur',
    schoolId: 'cmnwr8ita003iz0ti7ezibmu3',
    name: 'Georgia State University',
    status: 'CLOSED',
    value: 22.69,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/139940/georgia-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 18,543 admitted, 4,208 enrolled → 4208/18543 = 22.69%.',
  },
  {
    targetId: 'cmp9pmziy0040a85omzvgdhex',
    schoolId: 'cmnwr8it2003gz0tixy0e9ok2',
    name: 'Cleveland State University',
    status: 'CLOSED',
    value: 15.66,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/202134/cleveland-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 10,089 admitted, 1,580 enrolled → 1580/10089 = 15.66%.',
  },
  {
    targetId: 'cmp9pn2g801s5a85oafighh0i',
    schoolId: 'cmnwr8it5003hz0tie38swawv',
    name: 'Florida International University',
    status: 'CLOSED',
    value: 29.17,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/133951/florida-international-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 17,957 admitted, 5,238 enrolled → 5238/17957 = 29.17%.',
  },
  {
    targetId: 'cmp9pn2hb01sra85oqczfnxen',
    schoolId: 'cmnwr8ite003jz0tijg7j0avf',
    name: 'University of Massachusetts Boston',
    status: 'CLOSED',
    value: 12.28,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/166638/university-of-massachusetts-boston/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 17,813 admitted, 2,187 enrolled → 2187/17813 = 12.28%.',
  },
  {
    targetId: 'cmp9pn1wq01gga85o58xpdu3o',
    schoolId: 'cmnwr8itg003kz0tikwvhzllw',
    name: 'Old Dominion University',
    status: 'CLOSED',
    value: 19.94,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/232982/old-dominion-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 13,645 admitted, 2,721 enrolled → 2721/13645 = 19.94%.',
  },
  {
    targetId: 'cmp9pn1ur01f8a85on2141ne9',
    schoolId: 'cmnwr8itm003nz0tiqazikwxi',
    name: 'Indiana University-Purdue University Indianapolis',
    status: 'CLOSED',
    value: 24.63,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/151111/indiana-university-purdue-university-indianapolis/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 11,947 admitted, 2,942 enrolled → 2942/11947 = 24.63%.',
  },
  {
    targetId: 'cmp9pn14p00zva85ol1r4mwr0',
    schoolId: 'cmnwr8itk003mz0tirfyu068c',
    name: 'Central Michigan University',
    status: 'CLOSED',
    value: 11.26,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/169248/central-michigan-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 19,732 admitted, 2,222 enrolled → 2222/19732 = 11.26%.',
  },
  {
    targetId: 'cmp9pn2gs01sga85opkhwn860',
    schoolId: 'cmnwr8iti003lz0ti0z9hwm3s',
    name: 'Wright State University',
    status: 'CLOSED',
    value: 20.40,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/206604/wright-state-university-main-campus/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 8,530 admitted, 1,740 enrolled → 1740/8530 = 20.40%.',
  },
  {
    targetId: 'cmp9pn26q01m8a85ovs788re0',
    schoolId: 'cmnwr8ito003oz0tiyojti719',
    name: 'Wichita State University',
    status: 'CLOSED',
    value: 20.08,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/156125/wichita-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 9,316 admitted, 1,871 enrolled → 1871/9316 = 20.08%.',
  },
  {
    targetId: 'cmp9pn1780112a85o88z391ic',
    schoolId: 'cmnwr8iwp0054z0tic1mh49ba',
    name: 'James Madison University',
    status: 'CLOSED',
    value: 18.16,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/232423/james-madison-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 27,482 admitted, 4,990 enrolled → 4990/27482 = 18.16%.',
  },
  {
    targetId: 'cmp9pn2ln01vaa85olszfhwey',
    schoolId: 'cmnwr8iwn0053z0tiokrlwt8f',
    name: 'Appalachian State University',
    status: 'CLOSED',
    value: 18.20,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/197869/appalachian-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 22,188 admitted, 4,038 enrolled → 4038/22188 = 18.20%.',
  },
  {
    targetId: 'cmp9pn1ob01bda85odqcwm9d2',
    schoolId: 'cmnwr8iwq0055z0tivbkk0qbk',
    name: 'University of North Carolina Wilmington',
    status: 'CLOSED',
    value: 21.02,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/199218/university-of-north-carolina-wilmington/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 13,101 admitted, 2,754 enrolled → 2754/13101 = 21.02%.',
  },
  {
    targetId: 'cmp9pn0c600jza85o04kt4tu7',
    schoolId: 'cmnwr8iws0056z0tial92bfrt',
    name: 'Grand Valley State University',
    status: 'CLOSED',
    value: 18.59,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/170082/grand-valley-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 22,464 admitted, 4,175 enrolled → 4175/22464 = 18.59%.',
  },
];

const MIN_YIELD = 5;
const MAX_YIELD = 90;

async function main() {
  console.log(
    `[closure-v2-yield-agent-8] processing ${TARGETS.length} targets (fetchedAt=${FETCHED_AT})\n`,
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
    `\n[closure-v2-yield-agent-8] done. CLOSED=${closed} UNAVAILABLE=${unavailable} FAILED=${failed} (total ${TARGETS.length}).`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-yield-agent-8] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
