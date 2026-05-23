/**
 * collect-ed-rate-2.ts
 *
 * closure-v2 data-collection agent output (agent 2).
 *
 * Collects REAL, source-verified `School.edAcceptanceRate` (Early Decision admit
 * rate, as a percentage) for one claimed batch of `ClosureTarget` rows where
 * field='edAcceptanceRate', status='PENDING', and the joined School isPrivate=true.
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
 * Batch research result (17 schools claimed):
 *   - 1 CLOSED:   Syracuse University (65.95% ED, Class of 2028).
 *   - 16 UNAVAILABLE: either no binding ED program (EA-only / rolling), or has
 *     ED but publishes no current institution-wide ED admit rate.
 *   - 0 FAILED.
 *
 * metadata.provenance.edAcceptanceRate is MERGED into existing metadata; other
 * provenance keys are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-ed-rate-2.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-ed-agent-2';

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
    // Syracuse publishes binding Early Decision. Ivy Coach's compiled ED data
    // table reports a 65.95% combined ED I/II admit rate for the Class of 2028
    // (2022-23 cycle) — well above the overall rate and inside the 1–80% gate.
    targetId: 'cmp9pmzie003na85ofzw3d1mp',
    schoolId: 'cmnwr8imi000cz0tifntjkili',
    name: 'Syracuse University',
    rate: 65.95,
    sourceUrl:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/syracuse-university-early-decision-admission-statistics/',
    confidence: 0.8,
    tier: 'SCRAPED',
  },
];

const UNRESOLVED: Unresolved[] = [
  {
    targetId: 'cmp9pmzpl008ba85o3rdceyxa',
    name: 'University of Southern California',
    status: 'UNAVAILABLE',
    reason:
      'USC only begins offering a binding Early Decision option for Fall 2027 first-year applicants (Class of 2031). No ED admit rate has been published for any cycle yet.',
    sourceUrl: 'https://www.provost.usc.edu/early-decision-admissions-fall-2027-applicants/',
  },
  {
    targetId: 'cmp9pn0vz00upa85orsxza20v',
    name: 'New York University',
    status: 'UNAVAILABLE',
    reason:
      'NYU has a binding Early Decision program (ED I and ED II) but does not publish a separate institution-wide ED admit rate; only the overall acceptance rate (8% for Class of 2028) is released.',
    sourceUrl:
      'https://www.nyu.edu/about/news-publications/news/2024/april/nyu-sends-out-offers-of-admission-to-the-class-of-2028.html',
  },
  {
    targetId: 'cmp9pmzrb009ga85ob0j1p7yf',
    name: 'Tufts University',
    status: 'UNAVAILABLE',
    reason:
      'Tufts has binding Early Decision I/II but has not reported ED-specific admit data for the past several cycles; only the overall acceptance rate (10% for Class of 2028) is published.',
    sourceUrl:
      'https://www.tuftsdaily.com/article/2024/04/tufts-accepts-10-of-applicants-to-class-of-2028',
  },
  {
    targetId: 'cmp9pn0g600lxa85ogea3bk61',
    name: 'Wake Forest University',
    status: 'UNAVAILABLE',
    reason:
      'Wake Forest has binding Early Decision I/II but stopped reporting ED admit statistics in its Common Data Set after the Class of 2025; no current institution-wide ED admit rate is published.',
    sourceUrl: 'https://admissions.wfu.edu/facts/',
  },
  {
    targetId: 'cmp9pmzwz00cra85oyphwjdpr',
    name: 'Pepperdine University',
    status: 'UNAVAILABLE',
    reason:
      'Pepperdine has Early Decision rounds but publishes no verifiable acceptance-rate data for any early round; only the overall acceptance rate is available.',
    sourceUrl: 'https://www.usnews.com/best-colleges/pepperdine-university-1264/applying',
  },
  {
    targetId: 'cmp9pn1a4012sa85ocmdjvioy',
    name: 'Marquette University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Marquette offers only non-binding Early Action (Nov 15 deadline) and Regular Decision.',
    sourceUrl: 'https://www.marquette.edu/admissions/undergraduate/first-year-application.php',
  },
  {
    targetId: 'cmp9pmzko0053a85oj8sr4bcz',
    name: 'Gonzaga University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Gonzaga adopted non-binding Early Action (Nov 15 deadline) for the 2024-25 cycle alongside Regular Decision; no ED option exists.',
    sourceUrl: 'https://www.gonzaga.edu/undergraduate-admission/apply/dates-deadlines',
  },
  {
    targetId: 'cmp9pn1ia017ha85om3pr17mh',
    name: 'University of San Diego',
    status: 'UNAVAILABLE',
    reason:
      'USD has a binding Early Decision program but publishes no separate institution-wide ED admit rate; only the overall acceptance rate (~52%) is available.',
    sourceUrl: 'https://www.sandiego.edu/admission-and-aid/undergraduate/apply/decision-faq.php',
  },
  {
    targetId: 'cmp9pn1el015ga85olesxjptn',
    name: 'Saint Louis University',
    status: 'UNAVAILABLE',
    reason:
      'SLU has binding Early Decision I/II but does not publish a separate ED admit rate; U.S. News lists its Early Decision acceptance rate as N/A.',
    sourceUrl: 'https://www.slu.edu/admission/freshman/deadlines.php',
  },
  {
    targetId: 'cmp9pn15u010ea85or0nymeuf',
    name: 'DePaul University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — DePaul offers only the non-binding Early Action Program (Nov 15 deadline) and Regular Decision.',
    sourceUrl: 'https://www.depaul.edu/admission-and-aid/Pages/deadlines.aspx',
  },
  {
    targetId: 'cmp9pn1xk01gya85ok8p36bzq',
    name: 'Seton Hall University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Seton Hall offers only non-binding Early Action I/II; ED admit rate is not applicable.',
    sourceUrl: 'https://www.shu.edu/undergraduate-admissions/application-checklist.html',
  },
  {
    targetId: 'cmp9pn0ef00l1a85o6anwgqeo',
    name: 'The New School',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — The New School (incl. Parsons) offers only non-binding Early Action (Nov 1 deadline) and Regular Decision.',
    sourceUrl: 'https://www.usnews.com/best-colleges/the-new-school-20662/applying',
  },
  {
    targetId: 'cmp9pn1yk01hja85o74d5h12r',
    name: 'Loyola University Chicago',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Loyola University Chicago offers only non-binding Early Action and Regular Decision.',
    sourceUrl: 'https://www.luc.edu/undergrad/admissions/first-yearstudents/',
  },
  {
    targetId: 'cmp9pn23c01k5a85oq2qfv562',
    name: 'University of Maine',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UMaine offers only non-binding Early Action (Dec 1 deadline) and rolling Regular Decision.',
    sourceUrl: 'https://go.umaine.edu/applyinfo/',
  },
  {
    targetId: 'cmp9pn186011la85ooqebbvph',
    name: 'Hofstra University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Hofstra offers only non-binding Early Action and rolling Regular Decision; ED admit rate is not applicable.',
    sourceUrl: 'https://www.hofstra.edu/admission/apply/',
  },
  {
    targetId: 'cmp9pn1yz01hta85o9eiz115e',
    name: 'Adelphi University',
    status: 'UNAVAILABLE',
    reason:
      'Adelphi prominently uses non-binding Early Action (Nov 1 / Dec 1) and publishes no separate institution-wide ED admit rate; only the overall acceptance rate and EA "early acceptance rate" are available.',
    sourceUrl: 'https://www.adelphi.edu/admissions/first-year/apply/',
  },
];

async function main() {
  console.log(
    `[closure-v2-ed-agent-2] batch: ${RESOLVED.length} CLOSED, ${
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
      console.warn(`  SKIP ${r.name}: ED rate ${r.rate} outside 1–80 range gate`);
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
      school.metadata && typeof school.metadata === 'object' && !Array.isArray(school.metadata)
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
    `\n[closure-v2-ed-agent-2] done. ${schoolUpdated} School rows updated, ${targetUpdated} ClosureTarget rows updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-ed-agent-2] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
