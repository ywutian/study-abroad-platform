/**
 * collect-ed-rate-3.ts
 *
 * closure-v2 data-collection agent output (agent 3).
 *
 * Collects REAL, source-verified `School.edAcceptanceRate` (Early Decision admit
 * rate, as a percentage) for one claimed batch of `ClosureTarget` rows where
 * field='edAcceptanceRate' and status='PENDING'.
 *
 * Semantics:
 *   CLOSED      → the school has a binding Early Decision program AND a credible
 *                 source publishes a current institution-wide ED admit rate
 *                 inside the 1–80% range. `School.edAcceptanceRate` is written
 *                 and `metadata.provenance.edAcceptanceRate` is merged.
 *   UNAVAILABLE → the field is genuinely not applicable / not obtainable:
 *                 (a) the school has NO binding ED program (Early Action,
 *                     rolling, or no early plan), OR
 *                 (b) the school HAS ED but publishes no current institution-wide
 *                     ED admit rate from a credible source.
 *                 `School.edAcceptanceRate` is left NULL — never fabricated.
 *   FAILED      → research could not determine the school's early-plan status.
 *
 * Batch research result (30 schools claimed — all large public universities):
 *   - 1 CLOSED:   University of Connecticut (~60% ED, Class of 2029 — UConn's
 *     inaugural binding Early Decision cycle for fall 2025 entry).
 *   - 29 UNAVAILABLE: every other school in the batch is a public university
 *     that offers only non-binding Early Action and/or rolling admission and has
 *     NO binding Early Decision program. (The two UMN and two Penn State rows are
 *     duplicate ClosureTarget entries for the same institutions.)
 *   - 0 FAILED.
 *
 * metadata.provenance.edAcceptanceRate is MERGED into existing metadata; other
 * provenance keys are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-ed-rate-3.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-ed-agent-3';

/**
 * A school for which a real, current, institution-wide ED admit rate was
 * verified from a credible source.
 */
interface Resolved {
  targetId: string;
  schoolId: string;
  name: string;
  rate: number; // ED admit rate as percentage, range-gated 1–80
  sourceUrl: string;
  confidence: number; // 0.6–1.0
  tier: 'SCRAPED' | 'OFFICIAL';
}

/**
 * A target that is genuinely UNAVAILABLE (no ED program, or ED but no published
 * rate) or FAILED (status undeterminable). No School field is written for these.
 */
interface Unresolved {
  targetId: string;
  name: string;
  status: 'UNAVAILABLE' | 'FAILED';
  reason: string;
  sourceUrl: string;
}

const RESOLVED: Resolved[] = [
  {
    // UConn launched its first-ever binding Early Decision plan for fall 2025
    // (Class of 2029). UConn confirmed it received ~1,500 ED applications and
    // offered admission to ~60% of them. Inside the 1–80% range gate.
    targetId: 'cmp9pn03400gba85oyi0uqrr7',
    schoolId: 'cmnwr8imj000dz0tif3r9fq0l',
    name: 'University of Connecticut',
    rate: 60,
    sourceUrl:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/university-of-connecticut-early-decision-admission-statistics/',
    confidence: 0.75,
    tier: 'SCRAPED',
  },
];

const UNRESOLVED: Unresolved[] = [
  {
    targetId: 'cmp9pmzt300ama85oo2k2qrfb',
    name: 'University of California, San Diego',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of California system has a single Nov 30 application deadline and offers no Early Decision or Early Action plan.',
    sourceUrl: 'https://admissions.ucsd.edu/applying/index.html',
  },
  {
    targetId: 'cmp9pmzyy00dya85o93xhzltj',
    name: 'University of Florida',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UF offers only a single Nov 1 first-year application deadline with no Early Decision option.',
    sourceUrl: 'https://admissions.ufl.edu/apply/freshman/',
  },
  {
    targetId: 'cmp9pn19o012ha85o5g2xwjsz',
    name: 'University of Texas at Austin',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UT Austin offers a priority Dec 1 deadline and a final Dec 1 deadline but no Early Decision plan.',
    sourceUrl: 'https://admissions.utexas.edu/apply/freshman-deadlines/',
  },
  {
    targetId: 'cmp9pmzgb0026a85o25ayq838',
    name: 'Georgia Institute of Technology',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Georgia Tech offers only non-binding Early Action (Early Action 1 and 2) and Regular Decision.',
    sourceUrl:
      'https://admission.gatech.edu/first-year/deadlines-requirements/',
  },
  {
    targetId: 'cmp9pmzhj0032a85obao74gmm',
    name: 'University of California, Irvine',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of California system has a single Nov 30 application deadline and offers no Early Decision or Early Action plan.',
    sourceUrl: 'https://www.admissions.uci.edu/apply/freshman/',
  },
  {
    targetId: 'cmp9pn09s00iza85oihothv9x',
    name: 'University of Wisconsin-Madison',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UW-Madison offers only non-binding Early Action (Nov 1) and Regular Decision.',
    sourceUrl: 'https://admissions.wisc.edu/apply/first-year/',
  },
  {
    targetId: 'cmp9pn1dn014ua85ot8f4ftuq',
    name: 'University of Illinois Urbana-Champaign',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UIUC offers only non-binding Early Action and Regular Decision.',
    sourceUrl: 'https://admissions.illinois.edu/Apply/Freshman/dates',
  },
  {
    targetId: 'cmp9pn1qg01cpa85olw5ksx8j',
    name: 'University of California, Santa Barbara',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of California system has a single Nov 30 application deadline and offers no Early Decision or Early Action plan.',
    sourceUrl:
      'https://admissions.sa.ucsb.edu/how-to-apply/first-year-applicants',
  },
  {
    targetId: 'cmp9pmzl6005da85omb7ujsrq',
    name: 'University of Washington',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UW has a single Nov 15 first-year application deadline with no Early Decision or Early Action plan.',
    sourceUrl: 'https://admit.washington.edu/apply/freshman/',
  },
  {
    targetId: 'cmp9pn0b500jla85o53l2gmmu',
    name: 'Rutgers University-New Brunswick',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Rutgers offers only non-binding Early Action (Nov 1) and Regular Decision.',
    sourceUrl:
      'https://admissions.rutgers.edu/apply/dates-deadlines/new-brunswick',
  },
  {
    targetId: 'cmp9pmzul00bja85obipzdjkn',
    name: 'Ohio State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Ohio State offers only a non-binding Early Action / priority Nov 1 deadline and a Feb 1 Regular Decision deadline.',
    sourceUrl: 'https://undergrad.osu.edu/apply/first-year',
  },
  {
    targetId: 'cmp9pmzwj00cga85o6l0nni4o',
    name: 'Purdue University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Purdue offers only non-binding Early Action (Nov 1) and Regular Decision.',
    sourceUrl: 'https://www.admissions.purdue.edu/apply/applicationprocess.php',
  },
  {
    targetId: 'cmp9pmzgr002ha85o7hlwtv5t',
    name: 'University of Maryland, College Park',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UMD offers only a non-binding Early Action (Nov 1) deadline and a Regular Decision (Jan 15) deadline.',
    sourceUrl: 'https://admissions.umd.edu/apply/first-year-applicants',
  },
  {
    targetId: 'cmp9pn0wt00v9a85oy63mqxsx',
    name: 'Texas A&M University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Texas A&M offers a priority Dec 1 deadline and a final application deadline but no Early Decision plan.',
    sourceUrl: 'https://admissions.tamu.edu/apply/freshman/dates-deadlines',
  },
  {
    targetId: 'cmp9pn2an01oqa85oibhnyi7u',
    name: 'University of Georgia',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UGA offers only non-binding Early Action (Oct 15) and Regular Decision (Jan 1).',
    sourceUrl:
      'https://www.admissions.uga.edu/apply/first-year-applicant-information/',
  },
  {
    targetId: 'cmp9pmzop007qa85oy7cqpd9o',
    name: 'University of Minnesota Twin Cities',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Minnesota Twin Cities offers only non-binding Early Action (Nov 1) and rolling Regular Decision.',
    sourceUrl: 'https://admissions.tc.umn.edu/apply/freshman-application',
  },
  {
    targetId: 'cmp9pmzmf0068a85o2paefi16',
    name: 'University of Minnesota, Twin Cities',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Minnesota Twin Cities offers only non-binding Early Action (Nov 1) and rolling Regular Decision. (Duplicate ClosureTarget for the same institution.)',
    sourceUrl: 'https://admissions.tc.umn.edu/apply/freshman-application',
  },
  {
    targetId: 'cmp9pn00y00f4a85ow1gu9fts',
    name: 'Virginia Tech',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Virginia Tech discontinued Early Decision starting with the 2023-24 cycle and now offers only non-binding Early Action and Regular Decision.',
    sourceUrl:
      'https://www.vt.edu/admissions/undergraduate/apply/decision-plans.html',
  },
  {
    targetId: 'cmp9pn20l01ioa85owxfb852p',
    name: 'University of Pittsburgh',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Pittsburgh uses rolling admission with no Early Decision or Early Action plan.',
    sourceUrl: 'https://admissions.pitt.edu/first-year-student/',
  },
  {
    targetId: 'cmp9pmzmw006ja85o070ybacq',
    name: 'Pennsylvania State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Penn State uses rolling admission with a non-binding Nov 1 priority deadline and no Early Decision plan.',
    sourceUrl: 'https://admissions.psu.edu/apply/timeline/',
  },
  {
    targetId: 'cmp9pn03t00gma85o8r77kid1',
    name: 'Penn State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Penn State uses rolling admission with a non-binding Nov 1 priority deadline and no Early Decision plan. (Duplicate ClosureTarget for the same institution.)',
    sourceUrl: 'https://admissions.psu.edu/apply/timeline/',
  },
  {
    targetId: 'cmp9pn0ss00sma85orp78x4b7',
    name: 'Indiana University Bloomington',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — IU Bloomington offers only non-binding Early Action (Nov 1) and Regular Decision (Feb 1).',
    sourceUrl: 'https://admissions.indiana.edu/apply/deadlines.html',
  },
  {
    targetId: 'cmp9pn1e50155a85om1uvitzu',
    name: 'Michigan State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — MSU uses rolling admission with a non-binding Nov 1 priority deadline and no Early Decision plan.',
    sourceUrl: 'https://admissions.msu.edu/apply/first-year/',
  },
  {
    targetId: 'cmp9pn2bn01pba85oxvhhkjb8',
    name: 'SUNY Binghamton University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Binghamton University offers only non-binding Early Action (Nov 1) and Regular Decision (Jan 15).',
    sourceUrl:
      'https://www.binghamton.edu/admissions/undergraduate/apply/freshman/',
  },
  {
    targetId: 'cmp9pmznb006ua85o94um9era',
    name: 'University of Delaware',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Delaware offers only non-binding Early Action (Nov 1) and Regular Decision.',
    sourceUrl:
      'https://www.udel.edu/apply/undergraduate-admissions/apply-to-ud/preparing-to-apply/',
  },
  {
    targetId: 'cmp9pn0mq00pea85oidr8nazt',
    name: 'University of Iowa',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Iowa uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://admissions.uiowa.edu/apply/first-year-students',
  },
  {
    targetId: 'cmp9pn0zp00x2a85o3u8pk83d',
    name: 'University of Colorado Boulder',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — CU Boulder offers only non-binding Early Action (Nov 15) and Regular Decision (Jan 15).',
    sourceUrl:
      'https://www.colorado.edu/admissions/undergraduate/apply/first-year-applicants',
  },
  {
    targetId: 'cmp9pn01h00ffa85ou3bl12do',
    name: 'Binghamton University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Binghamton University offers only non-binding Early Action (Nov 1) and Regular Decision (Jan 15). (Duplicate ClosureTarget for the same institution.)',
    sourceUrl:
      'https://www.binghamton.edu/admissions/undergraduate/apply/freshman/',
  },
  {
    targetId: 'cmp9pmzo9007fa85o4etp3k7p',
    name: 'North Carolina State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — NC State offers only non-binding Early Action (Nov 1) and Regular Decision (Jan 15).',
    sourceUrl: 'https://admissions.ncsu.edu/apply/first-year/',
  },
];

async function main() {
  console.log(
    `[closure-v2-ed-agent-3] batch: ${RESOLVED.length} CLOSED, ${
      UNRESOLVED.filter((u) => u.status === 'UNAVAILABLE').length
    } UNAVAILABLE, ${
      UNRESOLVED.filter((u) => u.status === 'FAILED').length
    } FAILED (fetchedAt=${FETCHED_AT})\n`,
  );

  let schoolUpdated = 0;
  let targetUpdated = 0;

  // --- CLOSED: write verified School.edAcceptanceRate + merge provenance ---
  for (const r of RESOLVED) {
    if (r.rate < 1 || r.rate > 80) {
      console.warn(
        `  SKIP ${r.name}: ED rate ${r.rate} outside 1–80 range gate`,
      );
      continue;
    }

    const school = await prisma.school.findUnique({
      where: { id: r.schoolId },
      select: { id: true, name: true, metadata: true },
    });

    if (!school) {
      console.warn(`  SKIP ${r.name}: school id ${r.schoolId} not found`);
      continue;
    }

    const existingMetadata =
      school.metadata &&
      typeof school.metadata === 'object' &&
      !Array.isArray(school.metadata)
        ? (school.metadata as Record<string, unknown>)
        : {};

    const existingProvenance =
      existingMetadata.provenance &&
      typeof existingMetadata.provenance === 'object' &&
      !Array.isArray(existingMetadata.provenance)
        ? (existingMetadata.provenance as Record<string, unknown>)
        : {};

    const mergedMetadata: Prisma.InputJsonValue = {
      ...existingMetadata,
      provenance: {
        ...existingProvenance,
        edAcceptanceRate: {
          value: r.rate,
          sourceUrl: r.sourceUrl,
          fetchedAt: FETCHED_AT,
          verifiedBy: VERIFIED_BY,
          confidence: r.confidence,
          tier: r.tier,
        },
      },
    };

    await prisma.school.update({
      where: { id: r.schoolId },
      data: { edAcceptanceRate: r.rate, metadata: mergedMetadata },
    });
    schoolUpdated += 1;

    // ClosureTarget is a DB table not present in the Prisma schema — raw SQL.
    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = ${'CLOSED'}::"ClosureTargetStatus",
          "sourceUrl" = ${r.sourceUrl},
          confidence = ${r.confidence},
          tier = ${r.tier},
          attempts = attempts + 1,
          "lastAttemptAt" = NOW(),
          "lastError" = NULL,
          "updatedAt" = NOW()
      WHERE id = ${r.targetId}`;
    targetUpdated += 1;
    console.log(`  CLOSED       ${r.name} => ${r.rate}%  [${r.sourceUrl}]`);
  }

  // --- UNAVAILABLE / FAILED: update only the ClosureTarget row (raw SQL) ---
  for (const u of UNRESOLVED) {
    const lastError = u.status === 'FAILED' ? u.reason : null;
    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = ${u.status}::"ClosureTargetStatus",
          "sourceUrl" = ${u.sourceUrl},
          attempts = attempts + 1,
          "lastAttemptAt" = NOW(),
          "lastError" = ${lastError},
          notes = ${u.reason},
          "updatedAt" = NOW()
      WHERE id = ${u.targetId}`;
    targetUpdated += 1;
    console.log(`  ${u.status.padEnd(12)} ${u.name} — ${u.reason}`);
  }

  console.log(
    `\n[closure-v2-ed-agent-3] done. ${schoolUpdated} School rows updated, ${targetUpdated} ClosureTarget rows updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-ed-agent-3] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
