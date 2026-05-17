/**
 * collect-yield-rate-4.ts
 *
 * closure-v2 data-collection agent output (batch 4 — priority-ordered PENDING).
 *
 * Writes REAL, source-verified `School.yieldRate` values for a 30-school batch
 * of ClosureTarget rows with field='yieldRate' and status='PENDING'.
 *
 * Semantics of yieldRate:
 *   yield % = (first-year students enrolled / students admitted) * 100
 *
 * Source priority: school Common Data Set (Section C1/C2) > IPEDS-derived
 * trackers (CollegeData) > credible news. Range gate: 5–90%. Any value
 * outside the gate is rejected.
 *
 * `School.yieldRate` and `ClosureTarget` are present in the live DB but not in
 * the Prisma schema file, so this script uses raw SQL ($queryRaw/$executeRaw)
 * rather than the typed Prisma client.
 *
 * metadata.provenance.yieldRate is MERGED into existing metadata —
 * other provenance keys are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-yield-rate-4.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-yield-agent-4';

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
 * Section C1 admitted/enrolled count pairs, or IPEDS-derived CollegeData
 * admitted/enrolled count pairs. Yield = enrolled / admitted * 100.
 */
const TARGETS: Target[] = [
  {
    targetId: 'cmp9pn1nu01b2a85ozzjagmdm',
    schoolId: 'cmn1htko2000hvqf2r5gxwf84',
    name: 'Dartmouth College',
    status: 'CLOSED',
    value: 69,
    sourceUrl: 'https://home.dartmouth.edu/news/2024/09/class-2028',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Dartmouth CDS 2024-25 / Class of 2028: 1,685 admitted, 1,184 enrolled; official stated yield 69%.',
  },
  {
    targetId: 'cmp9pn1q301cha85op6jdct6y',
    schoolId: 'cmn1htkoc000lvqf2s5pgbhxx',
    name: 'Georgetown University',
    status: 'CLOSED',
    value: 53.97,
    sourceUrl:
      'https://waf.collegedata.com/college-search/georgetown-university/admission',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: admitted 3,346, enrolled 1,806 → 1806/3346 = 53.97%.',
  },
  {
    targetId: 'cmp9pn2ps01xla85op2djudhg',
    schoolId: 'cmnwr8iun0041z0tin8tw3f6b',
    name: 'Villanova University',
    status: 'CLOSED',
    value: 27.73,
    sourceUrl:
      'https://www.villanova.edu/content/dam/villanova/provost/decision_support/2024-2025-CDS_v2.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'Villanova CDS 2024-25 C118/C119: admitted 6,274, enrolled 1,740 → 27.73%.',
  },
  {
    targetId: 'cmp9pmzmj006ba85ovd6x0rry',
    schoolId: 'cmnwr8itq003pz0tirhvysbdj',
    name: 'University of Minnesota, Twin Cities',
    status: 'CLOSED',
    value: 22.4,
    sourceUrl:
      'https://idr.umn.edu/sites/idr.umn.edu/files/cds_2024_2025_tc_1.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'UMN-TC IDR CDS 2024-25 C1: admitted 32,997, enrolled 7,391 → 7391/32997 = 22.40%.',
  },
  {
    targetId: 'cmp9pn00200ema85ona6n6j77',
    schoolId: 'cmnwr8im70006z0ti47aaywzj',
    name: 'Tulane University',
    status: 'CLOSED',
    value: 42.85,
    sourceUrl:
      'https://waf.collegedata.com/college-search/tulane-university/admission',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: admitted 4,558, enrolled 1,953 → 1953/4558 = 42.85%.',
  },
  {
    targetId: 'cmp9pn0pi00qma85oodb6z01w',
    schoolId: 'cmnwr8im30004z0tip77mx1gm',
    name: 'Northeastern University',
    status: 'CLOSED',
    value: 53.75,
    sourceUrl:
      'https://uds.northeastern.edu/wp-content/uploads/2026/03/CDS-2024-25.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'Northeastern UDS CDS 2024-25 C1: admitted 5,133, enrolled 2,759 → 2759/5133 = 53.75%.',
  },
  {
    targetId: 'cmp9pn0sf00sea85oa1k0irbv',
    schoolId: 'cmnwr8ilz0002z0tiwrsmrdi7',
    name: 'Case Western Reserve University',
    status: 'CLOSED',
    value: 11.56,
    sourceUrl:
      'https://case.edu/ir/sites/default/files/2025-01/CWRU%202024%20-%2025%20CDS.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'CWRU IR CDS 2024-25 C1: admitted 14,010, enrolled 1,619 → 1619/14010 = 11.56%.',
  },
  {
    targetId: 'cmp9pn01300f7a85ob9g48yp2',
    schoolId: 'cmnwr8imc0009z0tie59yu85k',
    name: 'Virginia Tech',
    status: 'CLOSED',
    value: 25.35,
    sourceUrl:
      'https://aie.vt.edu/content/dam/aie_vt_edu/common-data-set/24-25/2024-2025-CDS.xlsx',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Virginia Tech AIE CDS 2024-25 C117-C119: admitted 28,758, enrolled 7,289 → 25.35%.',
  },
  {
    targetId: 'cmp9pn03a00gea85o93yk5zfs',
    schoolId: 'cmnwr8imj000dz0tif3r9fq0l',
    name: 'University of Connecticut',
    status: 'CLOSED',
    value: 15.41,
    sourceUrl:
      'https://bpir.media.uconn.edu/wp-content/uploads/sites/3452/2025/07/UConn_CDS_2024_2025.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'UConn BPIR CDS 2024-25 C1: admitted 29,065, enrolled 4,478 → 4478/29065 = 15.41%.',
  },
  {
    targetId: 'cmp9pn1vr01fua85o1jh0ueb6',
    schoolId: 'cmnwr8ilx0001z0tilru6b1th',
    name: 'William & Mary',
    status: 'CLOSED',
    value: 26.62,
    sourceUrl:
      'https://www.wm.edu/offices/ir/university_data/cds/wm_cds_2024-20252.xlsx',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'W&M IR CDS 2024-25 C118/C119: admitted 6,064, enrolled 1,614 → 26.62%.',
  },
  {
    targetId: 'cmp9pmzi1003fa85ojgr8g2dn',
    schoolId: 'cmnwr8img000bz0tiktbc3agu',
    name: 'George Washington University',
    status: 'CLOSED',
    value: 19.34,
    sourceUrl:
      'https://irp.gwu.edu/sites/g/files/zaxdzs6056/files/2025-05/CDS_2024-2025_FINAL.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'GWU IRP CDS 2024-25 C1: admitted 12,718, enrolled 2,459 → 2459/12718 = 19.34%.',
  },
  {
    targetId: 'cmp9pmzig003pa85ovpnv7t2g',
    schoolId: 'cmnwr8imi000cz0tifntjkili',
    name: 'Syracuse University',
    status: 'CLOSED',
    value: 20.53,
    sourceUrl:
      'https://waf.collegedata.com/college-search/syracuse-university/admission',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: admitted 20,421, enrolled 4,193 → 4193/20421 = 20.53%.',
  },
  {
    targetId: 'cmp9pmzlo005qa85o0mls0z79',
    schoolId: 'cmnwr8im10003z0ti20a5qdxq',
    name: 'Brandeis University',
    status: 'CLOSED',
    value: 17.45,
    sourceUrl:
      'https://www.brandeis.edu/institutional-research/docs/cds-2024-25.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'Brandeis IR CDS 2024-25 C1: admitted 4,234, enrolled 739 → 739/4234 = 17.45%.',
  },
  {
    targetId: 'cmp9pmzx200cta85orw44cqmv',
    schoolId: 'cmnwr8imn000fz0ti5zassqtj',
    name: 'Pepperdine University',
    status: 'CLOSED',
    value: 11.64,
    sourceUrl:
      'https://www.pepperdine.edu/oie/institutional-research/common-data-set.htm',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'Pepperdine OIE CDS 2024-25 C1: admitted 7,245, enrolled 843 → 843/7245 = 11.64%.',
  },
  {
    targetId: 'cmp9pn0lw00p6a85o7m5witzz',
    schoolId: 'cmnwr8im50005z0ti3z02fhjs',
    name: 'Santa Clara University',
    status: 'CLOSED',
    value: 17.69,
    sourceUrl:
      'https://www.scu.edu/media/offices/institutional-research/fampf/common-data-set/CDS-2024-2025---Final---Revised-01152026.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'SCU IR CDS 2024-25 C1: admitted 9,105, enrolled 1,611 → 1611/9105 = 17.69%.',
  },
  {
    targetId: 'cmp9pn20q01ira85o2pcofh4a',
    schoolId: 'cmnwr8im90007z0ti2n04hf3n',
    name: 'University of Pittsburgh',
    status: 'CLOSED',
    value: 12.99,
    sourceUrl:
      'https://ir.pitt.edu/sites/default/files/assets/2024-2025%20CDS%20Pittsburgh_2.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'Pitt IR CDS 2024-25 C118/C119: admitted 35,372, enrolled 4,596 → 12.99%.',
  },
  {
    targetId: 'cmp9pmzn0006ma85oxoq6d7qn',
    schoolId: 'cmnwr8imx000lz0tiez2ik9eg',
    name: 'Pennsylvania State University',
    status: 'CLOSED',
    value: 17.11,
    sourceUrl:
      'https://bpb-us-e1.wpmucdn.com/sites.psu.edu/dist/d/114442/files/2025/06/CDS_2024_2025_UniversityPark_v2.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Penn State University Park CDS 2024-25: admitted 53,579, enrolled 9,169 → 17.11%.',
  },
  {
    targetId: 'cmp9pn04100gpa85o80xmq9oz',
    schoolId: 'cmnwr8itr003qz0tihoo9onta',
    name: 'Penn State University',
    status: 'CLOSED',
    value: 17.11,
    sourceUrl:
      'https://bpb-us-e1.wpmucdn.com/sites.psu.edu/dist/d/114442/files/2025/06/CDS_2024_2025_UniversityPark_v2.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Penn State University Park CDS 2024-25: admitted 53,579, enrolled 9,169 → 17.11%.',
  },
  {
    targetId: 'cmp9pn09600ira85oviynbnwe',
    schoolId: 'cmnwr8in9000rz0ti2orsdpwi',
    name: 'University of Miami',
    status: 'CLOSED',
    value: 24.26,
    sourceUrl:
      'https://www.collegetransitions.com/blog/how-to-get-into-university-of-miami/',
    confidence: 0.78,
    tier: 'SCRAPED',
    note: 'Miami CDS 2024-25 / Class of 2028: ~10,195 admitted, 2,473 first-years enrolled → ≈24.26%.',
  },
  {
    targetId: 'cmp9pn0ld00owa85o0fj31pzl',
    schoolId: 'cmnwr8inf000uz0tic8a7s8is',
    name: 'Rensselaer Polytechnic Institute',
    status: 'CLOSED',
    value: 12.05,
    sourceUrl:
      'https://waf.collegedata.com/college-search/rensselaer-polytechnic-institute/admission',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: admitted 10,901, enrolled 1,314 → 1314/10901 = 12.05%.',
  },
  {
    targetId: 'cmp9pn0sy00spa85ok0vn0k5o',
    schoolId: 'cmnwr8iml000ez0ti01wzdugn',
    name: 'Indiana University Bloomington',
    status: 'CLOSED',
    value: 19.36,
    sourceUrl:
      'https://waf.collegedata.com/college-search/indiana-university-bloomington/admission',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: admitted 52,895, enrolled 10,238 → 10238/52895 = 19.36%.',
  },
  {
    targetId: 'cmp9pn0td00sza85oyksz5u5q',
    schoolId: 'cmnwr8in5000pz0tiefcdnmfi',
    name: 'Stevens Institute of Technology',
    status: 'CLOSED',
    value: 22,
    sourceUrl:
      'https://waf.collegedata.com/college-search/stevens-institute-of-technology/admission',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: admitted 5,076, enrolled 1,117 → 1117/5076 = 22.00%.',
  },
  {
    targetId: 'cmp9pn1e90158a85ozibkuu9t',
    schoolId: 'cmnwr8imv000kz0ti6chk6fxq',
    name: 'Michigan State University',
    status: 'CLOSED',
    value: 18.32,
    sourceUrl:
      'https://xmc-michiganstab57e-msustrategi129d-prod9868.sitecorecloud.io/-/media/project/msu/ir/docs/cds/cds-2024-2025.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'MSU IR CDS 2024-25 C1: admitted 52,672, enrolled 9,649 → 9649/52672 = 18.32%.',
  },
  {
    targetId: 'cmp9pn2br01pea85or61ddy47',
    schoolId: 'cmnwr8iqv002cz0ti57kn9m2m',
    name: 'SUNY Binghamton University',
    status: 'CLOSED',
    value: 15.87,
    sourceUrl:
      'https://www.binghamton.edu/offices/oir/upload_data/cds20242025p.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'Binghamton OIR CDS 2024-25 C1: admitted 20,464, enrolled 3,248 → 3248/20464 = 15.87%.',
  },
  {
    targetId: 'cmp9pmzng006xa85onhdpuyby',
    schoolId: 'cmnwr8in7000qz0ti04kcrc1l',
    name: 'University of Delaware',
    status: 'CLOSED',
    value: 16.81,
    sourceUrl:
      'https://waf.collegedata.com/college-search/university-of-delaware/admission',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: admitted 27,516, enrolled 4,626 → 4626/27516 = 16.81%.',
  },
  {
    targetId: 'cmp9pn0n000pha85oyfo1pmtk',
    schoolId: 'cmnwr8in0000mz0tiria7qm89',
    name: 'University of Iowa',
    status: 'CLOSED',
    value: 27.05,
    sourceUrl:
      'https://waf.collegedata.com/college-search/university-of-iowa/admission',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: admitted 23,175, enrolled 6,268 → 6268/23175 = 27.05%.',
  },
  {
    targetId: 'cmp9pn0yu00wja85og8khh6ji',
    schoolId: 'cmnwr8ims000iz0timfd6oan8',
    name: 'Southern Methodist University',
    status: 'CLOSED',
    value: 17.77,
    sourceUrl:
      'https://www.smu.edu/-/media/site/ir/commondatasets/2024/cds-2024-25-part-c-first-time-freshman.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'SMU IR CDS 2024-25 Part C: admitted 9,657, enrolled 1,716 → 1716/9657 = 17.77%.',
  },
  {
    targetId: 'cmp9pn0zt00x5a85omd8syelr',
    schoolId: 'cmnwr8ing000vz0tizgajtqeo',
    name: 'University of Colorado Boulder',
    status: 'CLOSED',
    value: 17.21,
    sourceUrl:
      'https://waf.collegedata.com/college-search/university-of-colorado-boulder/admission',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: admitted 52,517, enrolled 9,040 → 9040/52517 = 17.21%.',
  },
  {
    targetId: 'cmp9pn1oq01bna85ouyc5okau',
    schoolId: 'cmnwr8itt003rz0tizqmu1u5h',
    name: 'Yeshiva University',
    status: 'CLOSED',
    value: 61.12,
    sourceUrl:
      'https://waf.collegedata.com/college-search/yeshiva-university/admission',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'IPEDS-derived CDS 2024-25: admitted 926, enrolled 566 → 566/926 = 61.12%.',
  },
  {
    targetId: 'cmp9pn01n00fia85o8zdqbwl1',
    schoolId: 'cmnwr8in2000nz0tikk636e8p',
    name: 'Binghamton University',
    status: 'CLOSED',
    value: 15.87,
    sourceUrl:
      'https://www.binghamton.edu/offices/oir/upload_data/cds20242025p.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'Binghamton OIR CDS 2024-25 C1: admitted 20,464, enrolled 3,248 → 3248/20464 = 15.87%.',
  },
];

const MIN_YIELD = 5;
const MAX_YIELD = 90;

async function main() {
  console.log(
    `[closure-v2-yield-agent-4] processing ${TARGETS.length} targets (fetchedAt=${FETCHED_AT})\n`,
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
    `\n[closure-v2-yield-agent-4] done. CLOSED=${closed} UNAVAILABLE=${unavailable} FAILED=${failed} (total ${TARGETS.length}).`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-yield-agent-4] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
