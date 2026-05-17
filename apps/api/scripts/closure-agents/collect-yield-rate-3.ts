/**
 * collect-yield-rate-3.ts
 *
 * closure-v2 data-collection agent output (batch 3 — OFFSET 30).
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
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-yield-rate-3.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-yield-agent-3';

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
 * Every CLOSED entry is backed by published Common Data Set (CDS 2024-25)
 * yield figures or IPEDS-derived admitted/enrolled count pairs.
 */
const TARGETS: Target[] = [
  {
    targetId: 'cmp9pmzfh001oa85ow0c60q7l',
    schoolId: 'cmn1htkoe000mvqf2odaszvmk',
    name: 'University of North Carolina at Chapel Hill',
    status: 'CLOSED',
    value: 45.45,
    sourceUrl: 'https://oira.unc.edu/reports/reports-archives/common-data-set/',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'UNC OIRA CDS 2024-25 / IPEDS-derived: yield ≈45.45% (Class of 2028).',
  },
  {
    targetId: 'cmp9pmzqz0098a85o0zo0mp76',
    schoolId: 'cmn1htkom000pvqf2se90bue1',
    name: 'University of Virginia',
    status: 'CLOSED',
    value: 40,
    sourceUrl:
      'https://ira.virginia.edu/sites/g/files/jsddwu1106/files/2025-03/CDS_2024-2025_508.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'UVA IRA CDS 2024-25 / Class Profile: ≈3,961 first-years enrolled → yield ≈40%.',
  },
  {
    targetId: 'cmp9pn29w01o8a85o7t523s9r',
    schoolId: 'cmn1htkoo000qvqf2jgkrffw1',
    name: 'Washington University in St. Louis',
    status: 'CLOSED',
    value: 46.75,
    sourceUrl: 'https://washu.edu/app/uploads/2025/06/2024-2025-WashU-CDS.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'WashU CDS 2024-25: yield 46.75% (Class of 2028, record-high).',
  },
  {
    targetId: 'cmp9pn1l3019ba85opuxybddj',
    schoolId: 'cmn1htkoh000nvqf2uj3pjgxw',
    name: 'Carnegie Mellon University',
    status: 'CLOSED',
    value: 47,
    sourceUrl: 'https://www.cmu.edu/ira/CDS/cds_2425.html',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'CMU IRA CDS 2024-25: record-high 47% yield (Class of 2028).',
  },
  {
    targetId: 'cmp9pn0hk00mka85oqqc9bz4s',
    schoolId: 'cmn1htkoj000ovqf226pta7or',
    name: 'Emory University',
    status: 'CLOSED',
    value: 40.37,
    sourceUrl:
      'https://provost.emory.edu/planning-administration/_includes/documents/sections/institutional-data/emory-common-data-set-2024-2025.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'Emory CDS 2024-25: yield 40.37% (≈1,438 first-years enrolled / 3,562 admitted).',
  },
  {
    targetId: 'cmp9pmzkb004va85o1lmxjl6d',
    schoolId: 'cmn1htkor000rvqf282ibd6kz',
    name: 'University of California, Davis',
    status: 'CLOSED',
    value: 16.36,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/110644/university-of-california-davis/admission/',
    confidence: 0.82,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: admitted 41,353, enrolled ≈6,767 → 6767/41353 = 16.36%.',
  },
  {
    targetId: 'cmp9pmzpo008da85otw0oj7e7',
    schoolId: 'cmn1htkoz000uvqf2rnozc3fe',
    name: 'University of Southern California',
    status: 'CLOSED',
    value: 43.34,
    sourceUrl:
      'https://oir.usc.edu/common-data-set-archive/common-data-set-2024-2025/',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'USC OIR CDS 2024-25: yield 43.34%.',
  },
  {
    targetId: 'cmp9pmzz100e1a85o5xnyv366',
    schoolId: 'cmn1htkow000tvqf2qc5n3qhd',
    name: 'University of Florida',
    status: 'CLOSED',
    value: 42.2,
    sourceUrl:
      'https://data-apps.ir.aa.ufl.edu/public/cds/CDS_2024-2025_UFMAIN_Post_v1.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'UF IPR CDS 2024-25: yield 42.2% (Class of 2028).',
  },
  {
    targetId: 'cmp9pmzt800apa85obaqytszl',
    schoolId: 'cmn1htkou000svqf2356l4yfj',
    name: 'University of California, San Diego',
    status: 'CLOSED',
    value: 20.41,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/110680/university-of-california-san-diego/admission/',
    confidence: 0.82,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: yield 20.41% (≈7,330 first-years enrolled).',
  },
  {
    targetId: 'cmp9pn19s012ka85o9t93r9sx',
    schoolId: 'cmn1htkp1000vvqf2iogfyk82',
    name: 'University of Texas at Austin',
    status: 'CLOSED',
    value: 47.43,
    sourceUrl: 'https://reports.utexas.edu/common-data-set',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'UT Austin CDS 2024-25: admitted 19,417, enrolled 9,210 → 9210/19417 = 47.43%.',
  },
  {
    targetId: 'cmp9pmzgg0029a85o94uz52w5',
    schoolId: 'cmn1htkp4000wvqf2ah317ku6',
    name: 'Georgia Institute of Technology',
    status: 'CLOSED',
    value: 46,
    sourceUrl:
      'https://irp.gatech.edu/files/CDS/CDS_2024-2025_FINAL_20FEB2025.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Georgia Tech IRP CDS 2024-25: ≈3,850 freshmen enrolled → yield ≈46%.',
  },
  {
    targetId: 'cmp9pmzhn0035a85onxch81dv',
    schoolId: 'cmn1htkp6000xvqf2rhj774d8',
    name: 'University of California, Irvine',
    status: 'CLOSED',
    value: 19.22,
    sourceUrl: 'https://irap.uci.edu/undergraduate-admissions/',
    confidence: 0.82,
    tier: 'SCRAPED',
    note: 'UCI Data Hub / IPEDS-derived CDS 2024-25: yield 19.22% (Class of 2028 ≈6,736 enrolled).',
  },
  {
    targetId: 'cmp9pn09z00j2a85okwzi6t9x',
    schoolId: 'cmn1htkpi0011vqf28xmv4but',
    name: 'University of Wisconsin-Madison',
    status: 'CLOSED',
    value: 28.59,
    sourceUrl: 'https://data.wisc.edu/common-data-set-and-rankings/',
    confidence: 0.83,
    tier: 'SCRAPED',
    note: 'UW-Madison CDS 2024-25 / IPEDS-derived: yield 28.59% (29,782 admitted).',
  },
  {
    targetId: 'cmp9pn1ds014xa85ox0tb7bm2',
    schoolId: 'cmn1htkpe0010vqf2xzzjz779',
    name: 'University of Illinois Urbana-Champaign',
    status: 'CLOSED',
    value: 28.83,
    sourceUrl: 'https://www.dmi.illinois.edu/factsfigures.htm',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'UIUC DMI / IPEDS-derived CDS 2024-25: yield 28.83%.',
  },
  {
    targetId: 'cmp9pn1ql01csa85o9e8p2huq',
    schoolId: 'cmn1htkpb000zvqf2645ltfg6',
    name: 'University of California, Santa Barbara',
    status: 'CLOSED',
    value: 13.78,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/110705/university-of-california-santa-barbara/admission/',
    confidence: 0.82,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: admitted 36,347, enrolled 5,008 → 5008/36347 = 13.78%.',
  },
  {
    targetId: 'cmp9pn0w100ura85ouqdtsstj',
    schoolId: 'cmn1htkp9000yvqf29pcl812t',
    name: 'New York University',
    status: 'CLOSED',
    value: 55.38,
    sourceUrl:
      'https://www.nyu.edu/content/dam/nyu/institutionalResearch/documents/cds-on-website/CDS_2024-2025_Final%20for%20Release_wo%20PART%20H%20(check%20back%20for%20for%20PART%20H).pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'NYU Institutional Research CDS 2024-25: yield 55.38%.',
  },
  {
    targetId: 'cmp9pn0us00tva85olm11jxpi',
    schoolId: 'cmn1htkpl0012vqf28whnvaoj',
    name: 'Boston College',
    status: 'CLOSED',
    value: 43,
    sourceUrl: 'https://www.bc.edu/bc-web/sites/common-data-set.html',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'BC CDS 2024-25 (Class of 2028): yield 43% (up from 41% prior year).',
  },
  {
    targetId: 'cmp9pmzre009ia85otji7i72h',
    schoolId: 'cmn1htkpr0014vqf2w1o1nsyd',
    name: 'Tufts University',
    status: 'CLOSED',
    value: 45,
    sourceUrl:
      'https://provost.tufts.edu/institutionalresearch/wp-content/uploads/sites/5/CDS_2024-2025-1.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Tufts OIR CDS 2024-25: 1,801 freshmen enrolled → yield ≈45%.',
  },
  {
    targetId: 'cmp9pn0bb00joa85odn87y23q',
    schoolId: 'cmn1htkpo0013vqf2byqbw5mb',
    name: 'Rutgers University-New Brunswick',
    status: 'CLOSED',
    value: 20.53,
    sourceUrl:
      'https://www.collegetuitioncompare.com/edu/186380/rutgers-university-new-brunswick/admission/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: Rutgers-NB yield 20.53%.',
  },
  {
    targetId: 'cmp9pmzla005ga85ob4n6bcve',
    schoolId: 'cmn1htkpu0015vqf2kumhyv3t',
    name: 'University of Washington',
    status: 'CLOSED',
    value: 26.6,
    sourceUrl:
      'https://www.washington.edu/opb/uw-data/external-reporting/common-data-set/',
    confidence: 0.82,
    tier: 'SCRAPED',
    note: 'UW OPB CDS 2024-25 / IPEDS-derived: ≈27,000 admitted, ≈7,200 enrolled → yield ≈26.6%.',
  },
  {
    targetId: 'cmp9pmzm20060a85oinq6petl',
    schoolId: 'cmn1htkpw0016vqf20t0lflxm',
    name: 'Boston University',
    status: 'CLOSED',
    value: 37.35,
    sourceUrl: 'https://www.bu.edu/asir/files/2025/03/cds-2025-c.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'BU ASIR CDS 2024-25 (Section C): yield 37.35%.',
  },
  {
    targetId: 'cmp9pmzwn00cja85olled7liz',
    schoolId: 'cmn1htkq30018vqf2xt2csyoe',
    name: 'Purdue University',
    status: 'CLOSED',
    value: 29.2,
    sourceUrl:
      'https://www.purdue.edu/idata/products-services/common-data-set/',
    confidence: 0.83,
    tier: 'OFFICIAL',
    note: 'Purdue iData CDS 2024-25: yield 29.2% (admitted 39,272, ≈11,467 first-years enrolled).',
  },
  {
    targetId: 'cmp9pmzut00bma85or92x3vc4',
    schoolId: 'cmn1htkq00017vqf245v5dk2j',
    name: 'Ohio State University',
    status: 'CLOSED',
    value: 21.78,
    sourceUrl:
      'https://irp.osu.edu/sites/default/files/documents/2025/11/CDS-2024-2025-The-Ohio-State-University-Columbus.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Ohio State IRP CDS 2024-25: yield 21.78% (44,116 admitted).',
  },
  {
    targetId: 'cmp9pmzgv002ka85ouhqzt9k0',
    schoolId: 'cmn1htkq60019vqf2lmijsj2s',
    name: 'University of Maryland, College Park',
    status: 'CLOSED',
    value: 21.63,
    sourceUrl: 'https://www.irpa.umd.edu/InstitutionalData/cds.html',
    confidence: 0.83,
    tier: 'OFFICIAL',
    note: 'UMD IRPA CDS 2024-25: admitted 26,902, enrolled 5,818 → 5818/26902 = 21.63%.',
  },
  {
    targetId: 'cmp9pn0ga00lza85o28egl0cy',
    schoolId: 'cmn1htkqj001dvqf2n8mczcpn',
    name: 'Wake Forest University',
    status: 'CLOSED',
    value: 36.08,
    sourceUrl: 'https://ir.wfu.edu/common-data-set/',
    confidence: 0.83,
    tier: 'OFFICIAL',
    note: 'Wake Forest IR CDS 2024-25 / IPEDS-derived: yield 36.08% (4,056 admitted).',
  },
  {
    targetId: 'cmp9pmzq2008na85o0kc5ick4',
    schoolId: 'cmn1htkq9001avqf25ziy94gn',
    name: 'Lehigh University',
    status: 'CLOSED',
    value: 28,
    sourceUrl: 'https://data.lehigh.edu/common-data-set',
    confidence: 0.78,
    tier: 'SCRAPED',
    note: 'Lehigh Institutional Data CDS 2024-25: 5,289 admitted (Class of 2028); yield ≈28% (up ~5 pts).',
  },
  {
    targetId: 'cmp9pn0wx00vca85og3krbch9',
    schoolId: 'cmn1htkqc001bvqf22zfkx827',
    name: 'Texas A&M University',
    status: 'CLOSED',
    value: 39.91,
    sourceUrl:
      'https://abpa.tamu.edu/getattachment/439f54fe-1105-48af-955a-405775f80872/CDS-2024-2025_TexasA-M.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Texas A&M CDS 2024-25: yield 39.91% (≈12,498 freshmen enrolled).',
  },
  {
    targetId: 'cmp9pn2as01ota85ogxvxp8w3',
    schoolId: 'cmn1htkqf001cvqf2vdqpa1he',
    name: 'University of Georgia',
    status: 'CLOSED',
    value: 38.1,
    sourceUrl: 'https://oir.uga.edu/_resources/files/cds/UGA_CDS_2024-2025.pdf',
    confidence: 0.83,
    tier: 'OFFICIAL',
    note: 'UGA OIR CDS 2024-25: ≈6,150 first-years enrolled / ≈15,900 admitted → yield 38.1%.',
  },
  {
    targetId: 'cmp9pmzot007ta85o6795gc53',
    schoolId: 'cmnwr8ima0008z0ti358pkae1',
    name: 'University of Minnesota Twin Cities',
    status: 'CLOSED',
    value: 22.34,
    sourceUrl:
      'https://idr.umn.edu/sites/idr.umn.edu/files/cds_2024_2025_tc_1.pdf',
    confidence: 0.83,
    tier: 'OFFICIAL',
    note: 'UMN-TC IDR CDS 2024-25: yield 22.34% (33,091 admitted).',
  },
  {
    targetId: 'cmp9pn0wg00v1a85o39g452jo',
    schoolId: 'cmnwr8ilt0000z0ticnudxg0y',
    name: 'University of Rochester',
    status: 'CLOSED',
    value: 15.37,
    sourceUrl:
      'https://www.rochester.edu/provost/wp-content/uploads/2025/06/CDS_2024-2025-completed-for-web.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'University of Rochester Provost CDS 2024-25: yield 15.37%.',
  },
];

const MIN_YIELD = 5;
const MAX_YIELD = 90;

async function main() {
  console.log(
    `[closure-v2-yield-agent-3] processing ${TARGETS.length} targets (fetchedAt=${FETCHED_AT})\n`,
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
    `\n[closure-v2-yield-agent-3] done. CLOSED=${closed} UNAVAILABLE=${unavailable} FAILED=${failed} (total ${TARGETS.length}).`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-yield-agent-3] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
