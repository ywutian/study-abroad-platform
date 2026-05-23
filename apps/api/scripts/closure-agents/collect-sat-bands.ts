/**
 * collect-sat-bands.ts
 *
 * closure-v2 SAT-band collection agent.
 *
 * Writes REAL, source-verified `School.sat25` / `School.sat75` (SAT total =
 * Evidence-Based Reading & Writing + Math, 25th / 75th percentile) for a batch
 * of ClosureTarget rows with field IN ('sat25','sat75') and status='PENDING'.
 *
 * Range gate: 400–1600 (SAT total scale). sat25 must be < sat75.
 *
 * Source priority: school Common Data Set (Section C9) > College Board
 * BigFuture / College Scorecard > PrepScholar / CollegeSimply (CDS-derived).
 *
 * Test-blind institutions (entire UC system, entire CSU system) genuinely do
 * NOT report SAT scores in Section C9 — those targets are marked UNAVAILABLE.
 *
 * `School.sat25/sat75` and `ClosureTarget` exist in the live DB but not in the
 * Prisma schema file, so this script uses raw SQL for those.
 *
 * metadata.provenance.<field> is MERGED into existing metadata.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-sat-bands.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-sat-agent';

type Status = 'CLOSED' | 'UNAVAILABLE' | 'FAILED';
type Tier = 'SCRAPED' | 'OFFICIAL';

interface SchoolEntry {
  schoolId: string;
  name: string;
  /** target id for the sat25 row */
  sat25TargetId: string;
  /** target id for the sat75 row */
  sat75TargetId: string;
  status: Status;
  /** SAT total 25th percentile — required when CLOSED, else null. */
  sat25: number | null;
  /** SAT total 75th percentile — required when CLOSED, else null. */
  sat75: number | null;
  sourceUrl: string | null;
  confidence: number | null;
  tier: Tier | null;
  note: string;
}

const ENTRIES: SchoolEntry[] = [
  {
    schoolId: 'cmn1htkne0006vqf2quzi0v6h',
    name: 'California Institute of Technology',
    sat25TargetId: 'cmpa290cr00a6hws5fejvka3v',
    sat75TargetId: 'cmpa290ct00a7hws5jbdqkc3q',
    status: 'CLOSED',
    sat25: 1530,
    sat75: 1580,
    sourceUrl: 'https://iro.caltech.edu/documents/31491/Caltech_CDS_2024-2025_May_2025.pdf',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'Caltech CDS 2024-25 Section C9: SAT Composite 25th=1530, 75th=1580.',
  },
  {
    schoolId: 'cmn1htknv000evqf29yjvrstt',
    name: 'University of California, Berkeley',
    sat25TargetId: 'cmpa2914c016qhws5wh2etbhc',
    sat75TargetId: 'cmpa2914e016rhws5wgmvxox6',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'UC system is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmn1htkny000fvqf2jlmz8ej1',
    name: 'University of California, Los Angeles',
    sat25TargetId: 'cmpa290yr00zmhws5u16ml1c9',
    sat75TargetId: 'cmpa290yt00znhws5mbvt3jfn',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'UC system is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmn1htko2000hvqf2r5gxwf84',
    name: 'Dartmouth College',
    sat25TargetId: 'cmpa292t8038thws5kq1eoafh',
    sat75TargetId: 'cmpa292t9038uhws5kt6uyq4w',
    status: 'CLOSED',
    sat25: 1480,
    sat75: 1560,
    sourceUrl: 'https://www.dartmouth.edu/oir/pdfs/cds_2024-2025.pdf',
    confidence: 0.88,
    tier: 'OFFICIAL',
    note: 'Dartmouth CDS 2024-25 Section C9: SAT Composite 25th=1480, 75th=1560.',
  },
  {
    schoolId: 'cmn1htkor000rvqf282ibd6kz',
    name: 'University of California, Davis',
    sat25TargetId: 'cmpa290em00cahws5se8cfz0n',
    sat75TargetId: 'cmpa290eo00cbhws5nzf01hvt',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'UC system is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmn1htkou000svqf2356l4yfj',
    name: 'University of California, San Diego',
    sat25TargetId: 'cmpa290x400xghws5o1a20tdu',
    sat75TargetId: 'cmpa290x600xhhws5niywu8t2',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'UC system is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmn1htkp1000vvqf2iogfyk82',
    name: 'University of Texas at Austin',
    sat25TargetId: 'cmpa292ef02rshws5zj5s7bwr',
    sat75TargetId: 'cmpa292eh02rthws57417qvvf',
    status: 'CLOSED',
    sat25: 1230,
    sat75: 1490,
    sourceUrl:
      'https://www.collegesimply.com/colleges/texas/the-university-of-texas-at-austin/admission-chances-sat-score/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'CDS-derived (UT Austin CDS Section C9): SAT total 25th=1230, 75th=1490.',
  },
  {
    schoolId: 'cmn1htkp6000xvqf2rhj774d8',
    name: 'University of California, Irvine',
    sat25TargetId: 'cmpa290a8007dhws5guhdwyb2',
    sat75TargetId: 'cmpa290aa007ehws59czd1ghh',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'UC system is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmn1htkpb000zvqf2645ltfg6',
    name: 'University of California, Santa Barbara',
    sat25TargetId: 'cmpa292wa03d2hws502c69b69',
    sat75TargetId: 'cmpa292wc03d3hws54os8akzg',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'UC system is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmnwr8im90007z0ti2n04hf3n',
    name: 'University of Pittsburgh',
    sat25TargetId: 'cmpa2937n03s2hws50idcmkud',
    sat75TargetId: 'cmpa2937p03s3hws5xab6k6lk',
    status: 'CLOSED',
    sat25: 1270,
    sat75: 1450,
    sourceUrl: 'https://ir.pitt.edu/sites/default/files/assets/2024-2025%20CDS%20Pittsburgh_2.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Pitt (Pittsburgh campus) CDS 2024-25 Section C9: SAT Composite 25th=1270, 75th=1450.',
  },
  {
    schoolId: 'cmnwr8imp000gz0tibbuqx67l',
    name: 'University of California, Merced',
    sat25TargetId: 'cmpa291ze028ghws5sbl76euh',
    sat75TargetId: 'cmpa291zf028hhws56d1nigq3',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'UC system is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmnwr8inx0015z0tix5dndhpi',
    name: 'Arizona State University',
    sat25TargetId: 'cmpa2904l000yhws5dxhbctf2',
    sat75TargetId: 'cmpa2904o000zhws5h8oz2n0d',
    status: 'CLOSED',
    sat25: 1130,
    sat75: 1360,
    sourceUrl:
      'https://www.collegesimply.com/colleges/arizona/arizona-state-university/admission-chances-sat-score/',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'CDS-derived (ASU CDS Section C9): SAT total 25th=1130, 75th=1360.',
  },
  {
    schoolId: 'cmnwr8io40019z0ti0z11pe98',
    name: 'University of California, Riverside',
    sat25TargetId: 'cmpa291c301g1hws5fdo8cipj',
    sat75TargetId: 'cmpa291c401g2hws5ao7f9b32',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'UC system is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmnwr8io5001az0tibgs1vu54',
    name: 'University of California, Santa Cruz',
    sat25TargetId: 'cmpa291l301rfhws5hpnn02sr',
    sat75TargetId: 'cmpa291l501rghws5suxouddz',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'UC system is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmnwr8io7001bz0tihu5wo9mh',
    name: 'Rutgers University-Newark',
    sat25TargetId: 'cmpa290up00ulhws5u51a17cq',
    sat75TargetId: 'cmpa290uq00umhws5e5jygvlk',
    status: 'CLOSED',
    sat25: 1060,
    sat75: 1290,
    sourceUrl:
      'https://www.collegesimply.com/colleges/new-jersey/rutgers-university-newark/admission-chances-sat-score/',
    confidence: 0.78,
    tier: 'SCRAPED',
    note: 'CDS-derived (Rutgers-Newark CDS Section C9): SAT total 25th=1060, 75th=1290.',
  },
  {
    schoolId: 'cmnwr8ioi001fz0tivlt104p7',
    name: 'Seton Hall University',
    sat25TargetId: 'cmpa2933i03mehws5xsjllnqy',
    sat75TargetId: 'cmpa2933k03mfhws560wloyrz',
    status: 'CLOSED',
    sat25: 1240,
    sat75: 1380,
    sourceUrl:
      'https://www.collegesimply.com/colleges/new-jersey/seton-hall-university/admission-chances-sat-score/',
    confidence: 0.78,
    tier: 'SCRAPED',
    note: 'CDS-derived (Seton Hall CDS Section C9): SAT total 25th=1240, 75th=1380.',
  },
  {
    schoolId: 'cmnwr8iou001jz0tig866z8pb',
    name: 'San Diego State University',
    sat25TargetId: 'cmpa292mv0335hws5slae4u64',
    sat75TargetId: 'cmpa292mw0336hws5omo3y3hz',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'CSU system (incl. SDSU) is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmnwr8ioy001kz0ti85qspr1l',
    name: 'The New School',
    sat25TargetId: 'cmpa291gr01mehws5fzzumsks',
    sat75TargetId: 'cmpa291gt01mfhws5b11sal4a',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'The New School is test-blind — SAT/ACT not considered for admission even if submitted; not reported in CDS Section C9.',
  },
  {
    schoolId: 'cmnwr8ipv001vz0tiqnippgu6',
    name: 'Colorado State University',
    sat25TargetId: 'cmpa2929m02m2hws5p3iwy5wg',
    sat75TargetId: 'cmpa2929o02m3hws5buakws5n',
    status: 'CLOSED',
    sat25: 1070,
    sat75: 1290,
    sourceUrl:
      'https://www.collegesimply.com/colleges/colorado/colorado-state-university-fort-collins/admission-chances-sat-score/',
    confidence: 0.75,
    tier: 'SCRAPED',
    note: 'CDS-derived (Colorado State Fort Collins CDS Section C9): SAT total 25th=1070, 75th=1290.',
  },
  {
    schoolId: 'cmnwr8iq70021z0titshta238',
    name: 'University of Hawaii at Manoa',
    sat25TargetId: 'cmpa292in02xhhws5xu2yt9l1',
    sat75TargetId: 'cmpa292io02xihws52sk50gwb',
    status: 'CLOSED',
    sat25: 1130,
    sat75: 1350,
    sourceUrl: 'https://manoa.hawaii.edu/admissions/freshman/',
    confidence: 0.78,
    tier: 'OFFICIAL',
    note: 'UH Manoa official admissions profile: SAT total middle-50% 25th=1130, 75th=1350.',
  },
  {
    schoolId: 'cmnwr8ird002kz0tifunyipf1',
    name: 'University of North Dakota',
    sat25TargetId: 'cmpa291sp021bhws5h0pbhb9m',
    sat75TargetId: 'cmpa291ss021chws5c88a3nxh',
    status: 'CLOSED',
    sat25: 1130,
    sat75: 1270,
    sourceUrl:
      'https://www.collegesimply.com/colleges/north-dakota/university-of-north-dakota/admission-chances-sat-score/',
    confidence: 0.76,
    tier: 'SCRAPED',
    note: 'CDS-derived (Univ. of North Dakota CDS Section C9): SAT total 25th=1130, 75th=1270.',
  },
  {
    schoolId: 'cmnwr8irx002vz0ti8qpx4iws',
    name: 'California State University, Fullerton',
    sat25TargetId: 'cmpa292ar02nihws5w9aihgdc',
    sat75TargetId: 'cmpa292as02njhws50kxbaj04',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'CSU system (incl. CSU Fullerton) is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmnwr8iry002wz0tiljzfdqu7',
    name: 'California State University, Long Beach',
    sat25TargetId: 'cmpa291az01elhws5tvkmzhhg',
    sat75TargetId: 'cmpa291b101emhws5zwjncgvu',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'CSU system (incl. CSU Long Beach) is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmnwr8ish0036z0tiy3l6tt76',
    name: 'California State University, Northridge',
    sat25TargetId: 'cmpa293ab03uwhws5vcqjs8ao',
    sat75TargetId: 'cmpa293ad03uxhws52d5blpb5',
    status: 'UNAVAILABLE',
    sat25: null,
    sat75: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'CSU system (incl. CSU Northridge) is test-blind — SAT/ACT not considered and not reported in CDS Section C9. No real value exists.',
  },
  {
    schoolId: 'cmnwr8isj0037z0tihc4cw8ue',
    name: 'University of Southern Mississippi',
    sat25TargetId: 'cmpa29120013vhws5e5tyaa81',
    sat75TargetId: 'cmpa29121013whws5p974yhba',
    status: 'CLOSED',
    sat25: 990,
    sat75: 1190,
    sourceUrl:
      'https://www.prepscholar.com/sat/s/colleges/University-of-Southern-Mississippi-SAT-scores-GPA',
    confidence: 0.74,
    tier: 'SCRAPED',
    note: 'CDS-derived (Univ. of Southern Mississippi CDS Section C9): SAT total 25th=990, 75th=1190.',
  },
  {
    schoolId: 'cmnwr8iso003az0tilgsdacqo',
    name: 'University of Wisconsin-Milwaukee',
    sat25TargetId: 'cmpa2931g03jkhws5da1icqhk',
    sat75TargetId: 'cmpa2931h03jlhws5guvwrpkw',
    status: 'CLOSED',
    sat25: 990,
    sat75: 1180,
    sourceUrl: 'https://bigfuture.collegeboard.org/colleges/university-of-wisconsin-milwaukee/admissions',
    confidence: 0.78,
    tier: 'OFFICIAL',
    note: 'College Board BigFuture (IPEDS/CDS-sourced): SAT total middle-50% 25th=990, 75th=1180.',
  },
  {
    schoolId: 'cmnwr8ita003iz0ti7ezibmu3',
    name: 'Georgia State University',
    sat25TargetId: 'cmpa292so0384hws5sxwz0zt7',
    sat75TargetId: 'cmpa292sq0385hws5ldlp3wtp',
    status: 'CLOSED',
    sat25: 1040,
    sat75: 1280,
    sourceUrl:
      'https://www.collegesimply.com/colleges/georgia/georgia-state-university/admission-chances-sat-score/',
    confidence: 0.74,
    tier: 'SCRAPED',
    note: 'CDS-derived (Georgia State CDS Section C9): SAT total 25th=1040, 75th=1280.',
  },
  {
    schoolId: 'cmnwr8itm003nz0tiqazikwxi',
    name: 'Indiana University-Purdue University Indianapolis',
    sat25TargetId: 'cmpa2930903i4hws5e3sgmw1h',
    sat75TargetId: 'cmpa2930b03i5hws54vnobazz',
    status: 'CLOSED',
    sat25: 1040,
    sat75: 1220,
    sourceUrl:
      'https://www.collegesimply.com/colleges/indiana/indiana-university-purdue-university-indianapolis/admission-chances-sat-score/',
    confidence: 0.74,
    tier: 'SCRAPED',
    note: 'CDS-derived (IUPUI / IU Indianapolis CDS Section C9): SAT total 25th=1040, 75th=1220.',
  },
  {
    schoolId: 'cmnwr8iu0003uz0ti43l07p17',
    name: 'Worcester Polytechnic Institute',
    sat25TargetId: 'cmpa293s204dfhws51ppqdirz',
    sat75TargetId: 'cmpa293s404dghws5li5ddgib',
    status: 'CLOSED',
    sat25: 1300,
    sat75: 1460,
    sourceUrl: 'https://www.prepscholar.com/sat/s/colleges/Worcester-Polytechnic-Institute-sat-scores-GPA',
    confidence: 0.8,
    tier: 'SCRAPED',
    note: 'CDS-derived (WPI CDS 2024-25 Section C9): SAT total 25th=1300, 75th=1460.',
  },
  {
    schoolId: 'cmnwr8iua003xz0tio2zj4a4z',
    name: 'Saint Louis University',
    sat25TargetId: 'cmpa292hk02w1hws53ztfe1tf',
    sat75TargetId: 'cmpa292hl02w2hws5syie9quy',
    status: 'CLOSED',
    sat25: 1210,
    sat75: 1400,
    sourceUrl: 'https://www.collegesimply.com/colleges/missouri/saint-louis-university-main-campus/admission-chances-sat-score/',
    confidence: 0.75,
    tier: 'SCRAPED',
    note: 'CDS-derived (Saint Louis University CDS Section C9): SAT total 25th=1210, 75th=1400.',
  },
  {
    schoolId: 'cmnwr8iuf003zz0ti12pe3iq1',
    name: 'University of San Diego',
    sat25TargetId: 'cmpa292l20310hws52jixkrg1',
    sat75TargetId: 'cmpa292l40311hws52abjl1vv',
    status: 'CLOSED',
    sat25: 1200,
    sat75: 1350,
    sourceUrl: 'https://www.sandiego.edu/facts/documents/cds/cds_2024-25.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'University of San Diego CDS 2024-25 Section C9: SAT Composite 25th=1200, 75th=1350.',
  },
];

const MIN_SAT = 400;
const MAX_SAT = 1600;

async function writeProvenance(
  schoolId: string,
  field: 'sat25' | 'sat75',
  value: number,
  e: SchoolEntry,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; metadata: unknown }>>`
    SELECT id, metadata FROM "School" WHERE id = ${schoolId}`;
  if (rows.length === 0) {
    return `school id ${schoolId} not found`;
  }
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
      [field]: {
        value,
        sourceUrl: e.sourceUrl,
        fetchedAt: FETCHED_AT,
        verifiedBy: VERIFIED_BY,
        confidence: e.confidence,
        tier: e.tier,
        note: e.note,
      },
    },
  };

  if (field === 'sat25') {
    await prisma.$executeRaw`
      UPDATE "School"
      SET "sat25" = ${value}, metadata = ${JSON.stringify(mergedMetadata)}::jsonb
      WHERE id = ${schoolId}`;
  } else {
    await prisma.$executeRaw`
      UPDATE "School"
      SET "sat75" = ${value}, metadata = ${JSON.stringify(mergedMetadata)}::jsonb
      WHERE id = ${schoolId}`;
  }
  return null;
}

async function updateTarget(
  targetId: string,
  status: Status,
  e: SchoolEntry,
  lastError: string | null,
) {
  await prisma.$executeRaw`
    UPDATE "ClosureTarget"
    SET status = ${status}::"ClosureTargetStatus",
        "sourceUrl" = ${status === 'CLOSED' ? e.sourceUrl : null},
        confidence = ${status === 'CLOSED' ? e.confidence : null},
        tier = ${status === 'CLOSED' ? e.tier : null},
        attempts = attempts + 1,
        "lastAttemptAt" = ${new Date()},
        "lastError" = ${lastError},
        "updatedAt" = ${new Date()}
    WHERE id = ${targetId}`;
}

async function main() {
  console.log(
    `[closure-v2-sat-agent] processing ${ENTRIES.length} schools (${ENTRIES.length * 2} targets) fetchedAt=${FETCHED_AT}\n`,
  );

  let closed = 0;
  let unavailable = 0;
  let failed = 0;

  for (const e of ENTRIES) {
    let effectiveStatus: Status = e.status;
    let lastError: string | null = null;

    // Range gate — defence in depth.
    if (effectiveStatus === 'CLOSED') {
      if (
        e.sat25 == null ||
        e.sat75 == null ||
        e.sat25 < MIN_SAT ||
        e.sat25 > MAX_SAT ||
        e.sat75 < MIN_SAT ||
        e.sat75 > MAX_SAT
      ) {
        effectiveStatus = 'FAILED';
        lastError = `SAT band [${e.sat25 ?? 'null'}, ${e.sat75 ?? 'null'}] outside valid range ${MIN_SAT}-${MAX_SAT}`;
      } else if (e.sat25 >= e.sat75) {
        effectiveStatus = 'FAILED';
        lastError = `sat25 (${e.sat25}) must be < sat75 (${e.sat75})`;
      }
    }

    if (effectiveStatus === 'CLOSED' && e.sat25 != null && e.sat75 != null) {
      const err25 = await writeProvenance(e.schoolId, 'sat25', e.sat25, e);
      const err75 = err25 ? null : await writeProvenance(e.schoolId, 'sat75', e.sat75, e);
      const err = err25 ?? err75;
      if (err) {
        effectiveStatus = 'FAILED';
        lastError = err;
      }
    }

    await updateTarget(e.sat25TargetId, effectiveStatus, e, lastError);
    await updateTarget(e.sat75TargetId, effectiveStatus, e, lastError);

    if (effectiveStatus === 'CLOSED') {
      closed += 1;
      console.log(`  CLOSED       ${e.name} => sat25=${e.sat25} sat75=${e.sat75}  [${e.sourceUrl}]`);
    } else if (effectiveStatus === 'UNAVAILABLE') {
      unavailable += 1;
      console.log(`  UNAVAILABLE  ${e.name}  (${e.note})`);
    } else {
      failed += 1;
      console.log(`  FAILED       ${e.name}  (${lastError})`);
    }
  }

  console.log(
    `\n[closure-v2-sat-agent] done. CLOSED=${closed} UNAVAILABLE=${unavailable} FAILED=${failed} schools (${ENTRIES.length * 2} targets total).`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-sat-agent] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
