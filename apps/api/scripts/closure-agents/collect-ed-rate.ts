/**
 * collect-ed-rate.ts
 *
 * closure-v2 data-collection agent output.
 *
 * Collects REAL, source-verified `School.edAcceptanceRate` (Early Decision admit
 * rate, as a percentage) for one claimed batch of 30 `ClosureTarget` rows where
 * field='edAcceptanceRate' and status='PENDING'.
 *
 * Semantics:
 *   CLOSED      → the school has a binding Early Decision program AND a credible
 *                 source publishes a current, institution-wide ED admit rate
 *                 inside the 1–80% range. `School.edAcceptanceRate` is written
 *                 and `metadata.provenance.edAcceptanceRate` is merged.
 *   UNAVAILABLE → the field is genuinely not applicable / not obtainable:
 *                 (a) the school has NO binding ED program (it uses Early Action,
 *                     Restrictive/Single-Choice EA, rolling, or no early plan), OR
 *                 (b) the school HAS ED but publishes no current institution-wide
 *                     ED admit rate from a credible source.
 *                 `School.edAcceptanceRate` is left NULL — never fabricated.
 *   FAILED      → research could not determine the school's early-plan status.
 *
 * Result of this batch's research: every one of the 30 schools resolved to
 * UNAVAILABLE. None has a verifiable, currently-published institution-wide ED
 * admit rate. See the per-school reason strings below. RESOLVED is therefore
 * empty and no `School.edAcceptanceRate` value is written — fabrication-free.
 *
 * metadata.provenance.edAcceptanceRate is MERGED into existing metadata; other
 * provenance keys are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-ed-rate.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-ed-agent';

/**
 * A school for which a real, current, institution-wide ED admit rate was
 * verified from a credible source. This batch produced none — kept for shape.
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

// No school in this batch had a verifiable, currently-published ED admit rate.
const RESOLVED: Resolved[] = [];

const UNRESOLVED: Unresolved[] = [
  {
    targetId: 'cmp9pmzci0005a85obirg1crr',
    name: 'Rose-Hulman Institute of Technology',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Rose-Hulman offers only non-binding Early Action (Nov 1) and Regular Decision.',
    sourceUrl:
      'https://www.rose-hulman.edu/admissions-and-aid/the-application-process/application-and-deadlines/index.html',
  },
  {
    targetId: 'cmp9pmzp50081a85oi9kh9rmv',
    name: 'Princeton University',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — Princeton uses non-binding Single-Choice Early Action. ED admit rate is not applicable.',
    sourceUrl: 'https://admission.princeton.edu/apply/admission-statistics',
  },
  {
    targetId: 'cmp9pn2kk01una85oef1ykfm3',
    name: 'The Juilliard School',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — Juilliard uses a single standard application deadline (Dec 1), no ED or EA.',
    sourceUrl:
      'https://www.usnews.com/best-colleges/juilliard-school-2742/applying',
  },
  {
    targetId: 'cmp9pn0cn00k7a85oiiybqqkp',
    name: 'Massachusetts Institute of Technology',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — MIT offers only non-binding (non-restrictive) Early Action and Regular Decision.',
    sourceUrl:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/early-decision-vs-early-action/',
  },
  {
    targetId: 'cmp9pn0qw00rga85o94c6h8wl',
    name: 'Berklee College of Music',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Berklee offers only non-binding Early Action.',
    sourceUrl: 'https://college.berklee.edu/admissions/undergraduate/deadlines',
  },
  {
    targetId: 'cmp9pn2n601w3a85oiux66m8z',
    name: 'Cooper Union',
    status: 'UNAVAILABLE',
    reason:
      'Has a binding Early Decision program, but Cooper Union publishes no current institution-wide ED admit rate. The only ED figures available are a stale 2013-14 Engineering-school-only datapoint (~33%); not a usable current institution-wide rate.',
    sourceUrl:
      'https://cooper.edu/about/news/school-engineering-admitted-early-decision-numbers-are-consistent-past-years',
  },
  {
    targetId: 'cmp9pn2q701xta85ou9ezohfl',
    name: 'Pratt Institute',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Pratt offers only non-binding Early Action (Nov 15) and Regular Decision.',
    sourceUrl:
      'https://www.pratt.edu/admissions/undergraduate-admissions/apply/',
  },
  {
    targetId: 'cmp9pn1fz016ca85ojf3kcrje',
    name: 'School of the Art Institute of Chicago',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — SAIC offers only non-binding Early Action (Nov 15) and rolling Regular Decision.',
    sourceUrl: 'https://www.saic.edu/admissions/undergraduate/faq',
  },
  {
    targetId: 'cmp9pn22s01jva85o7ch7inb2',
    name: 'Harvard University',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — Harvard uses non-binding Single-Choice Early Action. ED admit rate is not applicable.',
    sourceUrl:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/early-decision-vs-early-action/',
  },
  {
    targetId: 'cmp9pn2nn01wda85orzak20l0',
    name: 'Curtis Institute of Music',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — Curtis uses a single application deadline (Dec 10) with audition-based review, no ED or EA.',
    sourceUrl: 'https://www.curtis.edu/apply/applying/',
  },
  {
    targetId: 'cmp9pn2o401wna85ol8ieq0h8',
    name: 'Stanford University',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — Stanford uses non-binding Restrictive Early Action. ED admit rate is not applicable.',
    sourceUrl:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/early-decision-vs-early-action/',
  },
  {
    targetId: 'cmp9pn2qo01y3a85o0la08whi',
    name: 'Olin College of Engineering',
    status: 'UNAVAILABLE',
    reason:
      'No early-admission options at all — Olin has a single application deadline followed by a required Candidates’ Weekend; no ED or EA.',
    sourceUrl: 'https://www.olin.edu/admission/apply/admission-process',
  },
  {
    targetId: 'cmp9pn2jk01u3a85o7x099vly',
    name: 'California Institute of the Arts',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — CalArts uses preferred/regular deadlines (regular Jan 5) with no binding ED option.',
    sourceUrl:
      'https://calarts.edu/admissions-aid/admissions/application-process/application-deadlines-and-fees',
  },
  {
    targetId: 'cmp9pn2l101uxa85o35ul82v5',
    name: 'New England Conservatory',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — NEC uses a single standard application deadline (Dec 1) with audition-based review.',
    sourceUrl: 'https://necmusic.edu/admitted-students',
  },
  {
    targetId: 'cmp9pmznu0075a85o1zdtp7a6',
    name: 'Yale University',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — Yale uses non-binding Single-Choice Early Action. ED admit rate is not applicable.',
    sourceUrl:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/early-decision-vs-early-action/',
  },
  {
    targetId: 'cmp9pn2e701qua85oykx39sk8',
    name: 'California Polytechnic State University, San Luis Obispo',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Cal Poly SLO uses a single Oct 1–Dec 1 application window with notification by April 1. The official admissions page lists no ED plan; third-party "44% ED rate" claims are not supported by Cal Poly.',
    sourceUrl:
      'https://www.calpoly.edu/admissions/first-year-student/dates-and-deadlines',
  },
  {
    targetId: 'cmp9pn2m301via85oalb1d84m',
    name: 'ArtCenter College of Design',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — ArtCenter offers only non-binding Early Action (Nov 15) and rolling admission.',
    sourceUrl:
      'https://www.artcenter.edu/admissions/undergraduate-admissions/important-dates.html',
  },
  {
    targetId: 'cmp9pn2r301yda85ol7brf5mi',
    name: 'Savannah College of Art and Design',
    status: 'UNAVAILABLE',
    reason:
      'SCAD primarily uses non-binding Early Action and Regular Decision; even where a binding ED option is referenced, SCAD publishes no credible institution-wide ED admit rate.',
    sourceUrl:
      'https://www.scad.edu/admission/admission-information/first-year',
  },
  {
    targetId: 'cmp9pmzqd008va85oqh0unlkj',
    name: 'California Institute of Technology',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — Caltech uses non-binding Restrictive Early Action. ED admit rate is not applicable.',
    sourceUrl:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/early-decision-vs-early-action/',
  },
  {
    targetId: 'cmp9pn1hu0177a85ob6xg93mf',
    name: 'Maryland Institute College of Art',
    status: 'UNAVAILABLE',
    reason:
      'MICA references a binding Early Decision option alongside Early Action, but publishes no credible institution-wide ED admit rate.',
    sourceUrl: 'https://www.mica.edu/admissions/',
  },
  {
    targetId: 'cmp9pn1x201goa85oen45nska',
    name: 'California College of the Arts',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — CCA uses rolling admission with a non-binding Early Action option for merit scholarship consideration.',
    sourceUrl: 'https://www.cca.edu/admissions/apply/',
  },
  {
    targetId: 'cmp9pn00g00eua85o62jb8rx9',
    name: 'University of Chicago',
    status: 'UNAVAILABLE',
    reason:
      'Has binding Early Decision I/II, but UChicago does not publish round-by-round admit rates; only the overall acceptance rate is released via the CDS. No credible ED-specific rate exists.',
    sourceUrl: 'https://collegeadmissions.uchicago.edu/apply/class-profile/',
  },
  {
    targetId: 'cmp9pmzyg00dna85ocd9v8ss0',
    name: 'University of California, Berkeley',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — the University of California system uses a single Nov 1–30 application window with no ED or EA.',
    sourceUrl: 'https://admissions.berkeley.edu/admissions-deadlines/',
  },
  {
    targetId: 'cmp9pn1mf01a4a85oe96fn5c6',
    name: 'University of California, Los Angeles',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — the University of California system uses a single Nov 1–30 application window with no ED or EA.',
    sourceUrl: 'https://admission.ucla.edu/apply/deadlines',
  },
  {
    targetId: 'cmp9pn2k101uda85oj4olq4qk',
    name: 'Colby College',
    status: 'UNAVAILABLE',
    reason:
      'Has binding Early Decision I/II, but Colby does not report ED admit rates (declines CDS participation and does not disclose ED data in press releases). No credible current ED-specific rate exists.',
    sourceUrl: 'https://www.colby.edu/admission/apply/early-decision/',
  },
  {
    targetId: 'cmp9pn1p201bva85o6syu6ou4',
    name: 'University of Notre Dame',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — Notre Dame uses non-binding Restrictive Early Action. ED admit rate is not applicable.',
    sourceUrl:
      'https://enrollmentdivision.nd.edu/news/university-of-notre-dame-releases-restrictive-early-action-decisions-for-the-class-of-2028/',
  },
  {
    targetId: 'cmp9pn02200fqa85o6pmzmt5n',
    name: 'University of Michigan, Ann Arbor',
    status: 'UNAVAILABLE',
    reason:
      'Michigan introduces a binding Early Decision plan starting with fall-2026 first-year applicants; as this is the first ED cycle, no ED admit rate has been published yet.',
    sourceUrl:
      'https://admissions.umich.edu/apply/first-year-applicants/first-year-application-plans',
  },
  {
    targetId: 'cmp9pmzfd001la85ozjawm4sh',
    name: 'University of North Carolina at Chapel Hill',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UNC-Chapel Hill offers only non-binding Early Action (Oct 15) and Regular Decision.',
    sourceUrl:
      'https://admissions.unc.edu/apply/types-of-applications/first-year/',
  },
  {
    targetId: 'cmp9pn1q001cfa85o97q1tbdt',
    name: 'Georgetown University',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — Georgetown uses non-binding (restrictive) Early Action. ED admit rate is not applicable.',
    sourceUrl: 'https://uadmissions.georgetown.edu/applying/early-action/',
  },
  {
    targetId: 'cmp9pmzk7004sa85o888tylub',
    name: 'University of California, Davis',
    status: 'UNAVAILABLE',
    reason:
      'No Early Decision program — the University of California system uses a single Nov 1–30 application window with no ED or EA.',
    sourceUrl: 'https://www.ucdavis.edu/admissions',
  },
];

async function main() {
  console.log(
    `[closure-v2-ed-agent] batch: ${RESOLVED.length} CLOSED, ${
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
    `\n[closure-v2-ed-agent] done. ${schoolUpdated} School rows updated, ${targetUpdated} ClosureTarget rows updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-ed-agent] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
