/**
 * collect-yield-rate-6.ts
 *
 * closure-v2 data-collection agent output (batch 6).
 *
 * Writes REAL, source-verified `School.yieldRate` values for a 30-school batch
 * of ClosureTarget rows with field='yieldRate' and status='PENDING'.
 *
 * Semantics of yieldRate:
 *   yield % = (first-year students enrolled / students admitted) * 100
 *
 * Source: IPEDS-derived admitted/enrolled count pairs for the 2024-25 cycle
 * (collegetuitioncompare per-institution admission pages). Range gate 5–90%.
 *
 * `School.yieldRate` and `ClosureTarget` are present in the live DB but not in
 * the Prisma schema file, so this script uses raw SQL ($queryRaw/$executeRaw).
 *
 * metadata.provenance.yieldRate is MERGED into existing metadata —
 * other provenance keys are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-yield-rate-6.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-yield-agent-6';

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
 * (collegetuitioncompare, 2024-25 cycle).
 */
const TARGETS: Target[] = [
  {
    targetId: 'cmp9pn1xo01h0a85osvfsrczn',
    schoolId: 'cmnwr8ioi001fz0tivlt104p7',
    name: 'Seton Hall University',
    status: 'CLOSED',
    value: 8.82,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/186584/seton-hall-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 18,152 admitted, 1,601 enrolled → 1601/18152 = 8.82%.',
  },
  {
    targetId: 'cmp9pn161010ga85oe4zxilkj',
    schoolId: 'cmnwr8ioe001ez0tii04p5pvd',
    name: 'DePaul University',
    status: 'CLOSED',
    value: 10.82,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/144740/depaul-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 23,729 admitted, 2,566 enrolled → 2566/23729 = 10.82%.',
  },
  {
    targetId: 'cmp9pn04q00h0a85oysrkuy7s',
    schoolId: 'cmnwr8int0013z0tiqysdv07w',
    name: 'University of Oregon',
    status: 'CLOSED',
    value: 14.4,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/209551/university-of-oregon/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 35,337 admitted, 5,087 enrolled → 5087/35337 = 14.40%.',
  },
  {
    targetId: 'cmp9pmzrt009sa85owta1t5vf',
    schoolId: 'cmnwr8iol001gz0ticdgvwjkf',
    name: 'University of San Francisco',
    status: 'CLOSED',
    value: 5.99,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/122612/university-of-san-francisco/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 15,358 admitted, 920 enrolled → 920/15358 = 5.99%.',
  },
  {
    targetId: 'cmp9pn05k00hba85okc8hhjn5',
    schoolId: 'cmnwr8ior001iz0tibsba6d2o',
    name: 'University of Kentucky',
    status: 'CLOSED',
    value: 22.23,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/157085/university-of-kentucky/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 29,293 admitted, 6,513 enrolled → 6513/29293 = 22.23%.',
  },
  {
    targetId: 'cmp9pn1jb0185a85ok1id6o9f',
    schoolId: 'cmnwr8iou001jz0tig866z8pb',
    name: 'San Diego State University',
    status: 'CLOSED',
    value: 20.36,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/122409/san-diego-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 32,561 admitted, 6,629 enrolled → 6629/32561 = 20.36%.',
  },
  {
    targetId: 'cmp9pn0ok00q1a85o7baxljca',
    schoolId: 'cmnwr8ioo001hz0tim3isqwz9',
    name: 'Clarkson University',
    status: 'CLOSED',
    value: 9.49,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/190044/clarkson-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 5,153 admitted, 489 enrolled → 489/5153 = 9.49%.',
  },
  {
    targetId: 'cmp9pn0f500lea85o0bw2geys',
    schoolId: 'cmnwr8io8001cz0tivir7q6ki',
    name: 'University of Kansas',
    status: 'CLOSED',
    value: 25.46,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/155317/university-of-kansas/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 20,905 admitted, 5,323 enrolled → 5323/20905 = 25.46%.',
  },
  {
    targetId: 'cmp9pn0el00l3a85ogbw1y9yw',
    schoolId: 'cmnwr8ioy001kz0ti85qspr1l',
    name: 'The New School',
    status: 'CLOSED',
    value: 21.29,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/193654/the-new-school/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 6,238 admitted, 1,328 enrolled → 1328/6238 = 21.29%.',
  },
  {
    targetId: 'cmp9pn21901j2a85ovfdq7821',
    schoolId: 'cmnwr8ip1001lz0ti51lr5gad',
    name: 'University of Alabama',
    status: 'CLOSED',
    value: 18.45,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/100751/the-university-of-alabama/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 43,531 admitted, 8,032 enrolled → 8032/43531 = 18.45%.',
  },
  {
    targetId: 'cmp9pmztn00b0a85ofwn0nept',
    schoolId: 'cmnwr8ip7001nz0ti6qy76djw',
    name: 'University of Missouri',
    status: 'CLOSED',
    value: 30.98,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/178396/university-of-missouri-columbia/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 19,218 admitted, 5,953 enrolled → 5953/19218 = 30.98%.',
  },
  {
    targetId: 'cmp9pmze1000sa85ow53tnl0t',
    schoolId: 'cmnwr8inx0015z0tix5dndhpi',
    name: 'Arizona State University',
    status: 'CLOSED',
    value: 22.11,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/104151/arizona-state-university-tempe/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25 (Tempe): 63,756 admitted, 14,099 enrolled → 14099/63756 = 22.11%.',
  },
  {
    targetId: 'cmp9pmzu600bba85ouuor284t',
    schoolId: 'cmnwr8ip3001mz0til7q2dopw',
    name: 'University of Oklahoma',
    status: 'CLOSED',
    value: 29.33,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/207500/university-of-oklahoma-norman-campus/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25 (Norman): 19,069 admitted, 5,593 enrolled → 5593/19069 = 29.33%.',
  },
  {
    targetId: 'cmp9pn17r011da85osg5fvj0e',
    schoolId: 'cmnwr8iwx0059z0tilcfiwj80',
    name: 'University of Texas at Dallas',
    status: 'CLOSED',
    value: 20.27,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/228787/the-university-of-texas-at-dallas/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 20,704 admitted, 4,196 enrolled → 4196/20704 = 20.27%.',
  },
  {
    targetId: 'cmp9pn1yn01hla85ob80oma83',
    schoolId: 'cmnwr8ipa001oz0tionb7y3gm',
    name: 'Loyola University Chicago',
    status: 'CLOSED',
    value: 8.61,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/146719/loyola-university-chicago/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 32,081 admitted, 2,763 enrolled → 2763/32081 = 8.61%.',
  },
  {
    targetId: 'cmp9pn1ar0135a85ox4f1o99x',
    schoolId: 'cmnwr8ipj001rz0tipapk15or',
    name: 'University of Nebraska-Lincoln',
    status: 'CLOSED',
    value: 29.79,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/181464/university-of-nebraska-lincoln/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 15,609 admitted, 4,650 enrolled → 4650/15609 = 29.79%.',
  },
  {
    targetId: 'cmp9pn12x00yya85oh2nq5an6',
    schoolId: 'cmnwr8ipc001pz0tiz0bgth66',
    name: 'Iowa State University',
    status: 'CLOSED',
    value: 28.84,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/153603/iowa-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 20,475 admitted, 5,906 enrolled → 5906/20475 = 28.84%.',
  },
  {
    targetId: 'cmp9pmzsb00a3a85o7dbh94bm',
    schoolId: 'cmnwr8ipf001qz0ti3d3001d9',
    name: 'University of Tennessee',
    status: 'CLOSED',
    value: 27.37,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/221759/the-university-of-tennessee-knoxville/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25 (Knoxville): 24,863 admitted, 6,804 enrolled → 6804/24863 = 27.37%.',
  },
  {
    targetId: 'cmp9pn0xv00vya85onqth5hvp',
    schoolId: 'cmnwr8ipt001uz0tivghae5e1',
    name: 'University of Cincinnati',
    status: 'CLOSED',
    value: 22.52,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/201885/university-of-cincinnati-main-campus/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 29,242 admitted, 6,584 enrolled → 6584/29242 = 22.52%.',
  },
  {
    targetId: 'cmp9pn11a00y1a85ombebptk9',
    schoolId: 'cmnwr8ipr001tz0ti8x7z840u',
    name: 'University of New Hampshire',
    status: 'CLOSED',
    value: 13.96,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/183044/university-of-new-hampshire-main-campus/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 18,667 admitted, 2,605 enrolled → 2605/18667 = 13.96%.',
  },
  {
    targetId: 'cmp9pn16q010ra85oo4zvvkje',
    schoolId: 'cmnwr8ipv001vz0tiqnippgu6',
    name: 'Colorado State University',
    status: 'CLOSED',
    value: 16.11,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/126818/colorado-state-university-fort-collins/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25 (Fort Collins): 34,057 admitted, 5,485 enrolled → 5485/34057 = 16.11%.',
  },
  {
    targetId: 'cmp9pn0pz00qxa85ok9h8md1v',
    schoolId: 'cmnwr8ipx001wz0timhlbfii2',
    name: 'University of Vermont',
    status: 'CLOSED',
    value: 15.84,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/231174/university-of-vermont/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 17,722 admitted, 2,808 enrolled → 2808/17722 = 15.84%.',
  },
  {
    targetId: 'cmp9pn1rp01dea85oh7mee0e6',
    schoolId: 'cmnwr8ipm001sz0tixvcr2p30',
    name: 'Oregon State University',
    status: 'CLOSED',
    value: 20.4,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/209542/oregon-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 23,418 admitted, 4,778 enrolled → 4778/23418 = 20.40%.',
  },
  {
    targetId: 'cmp9pn22b01jna85oboff1c7x',
    schoolId: 'cmnwr8iq2001zz0tiix4lbz86',
    name: 'University of Houston',
    status: 'CLOSED',
    value: 26.52,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/225511/university-of-houston/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 23,446 admitted, 6,218 enrolled → 6218/23446 = 26.52%.',
  },
  {
    targetId: 'cmp9pn1f5015ta85owj929yhy',
    schoolId: 'cmnwr8iq40020z0tif8l8dxxu',
    name: 'University of Arkansas',
    status: 'CLOSED',
    value: 29.15,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/106397/university-of-arkansas/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25 (Fayetteville): 22,703 admitted, 6,618 enrolled → 6618/22703 = 29.15%.',
  },
  {
    targetId: 'cmp9pn27d01mja85o0ni645gu',
    schoolId: 'cmnwr8ipz001xz0ti9f4tlagk',
    name: 'George Mason University',
    status: 'CLOSED',
    value: 20.22,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/232186/george-mason-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 22,074 admitted, 4,464 enrolled → 4464/22074 = 20.22%.',
  },
  {
    targetId: 'cmp9pn11q00yca85o0umighov',
    schoolId: 'cmnwr8iq1001yz0ti1jb6g7hi',
    name: 'Louisiana State University',
    status: 'CLOSED',
    value: 22.96,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/159391/louisiana-state-university-and-agricultural-and-mechanical-college/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25 (Baton Rouge): 34,513 admitted, 7,925 enrolled → 7925/34513 = 22.96%.',
  },
  {
    targetId: 'cmp9pn1cu014ba85ownb83b62',
    schoolId: 'cmnwr8iny0016z0tiikip2622',
    name: 'Florida State University',
    status: 'CLOSED',
    value: 30.89,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/134097/florida-state-university/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 18,954 admitted, 5,855 enrolled → 5855/18954 = 30.89%.',
  },
  {
    targetId: 'cmp9pn1fl0164a85odxacjg5n',
    schoolId: 'cmnwr8iq70021z0titshta238',
    name: 'University of Hawaii at Manoa',
    status: 'CLOSED',
    value: 21.43,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/141574/university-of-hawaii-at-manoa/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 14,481 admitted, 3,103 enrolled → 3103/14481 = 21.43%.',
  },
  {
    targetId: 'cmp9pn0fs00lpa85ozgflgqre',
    schoolId: 'cmnwr8iqa0022z0ti9ad68xp2',
    name: 'University of Rhode Island',
    status: 'CLOSED',
    value: 15.38,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/217484/university-of-rhode-island/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived 2024-25: 19,475 admitted, 2,995 enrolled → 2995/19475 = 15.38%.',
  },
];

const MIN_YIELD = 5;
const MAX_YIELD = 90;

async function main() {
  console.log(
    `[closure-v2-yield-agent-6] processing ${TARGETS.length} targets (fetchedAt=${FETCHED_AT})\n`,
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
    `\n[closure-v2-yield-agent-6] done. CLOSED=${closed} UNAVAILABLE=${unavailable} FAILED=${failed} (total ${TARGETS.length}).`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-yield-agent-6] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
