/**
 * collect-ed-accept-final.ts
 *
 * closure-v2 FINAL collection-agent output.
 *
 * Resolves the LAST batch of `ClosureTarget` rows where status='PENDING' and
 * field IN ('edAcceptanceRate','acceptanceRate') — 8 rows total
 * (1 acceptanceRate + 7 edAcceptanceRate).
 *
 * Semantics:
 *   acceptanceRate
 *     CLOSED      → a credible source publishes a current institution-wide
 *                   freshman admit rate inside the 1–100% range. The value is
 *                   written to `School.acceptanceRate` and
 *                   `metadata.provenance.acceptanceRate` is merged.
 *     FAILED      → no credible overall admit rate could be found.
 *
 *   edAcceptanceRate
 *     CLOSED      → the school has a binding Early Decision program AND a
 *                   credible source publishes a current institution-wide ED
 *                   admit rate inside the 1–80% range.
 *     UNAVAILABLE → (a) the school has NO binding ED program, OR
 *                   (b) it HAS ED but publishes no current ED admit rate.
 *                   `School.edAcceptanceRate` is left NULL — never fabricated.
 *     FAILED      → the school's early-plan status could not be determined.
 *
 * Batch research result:
 *   acceptanceRate   — 1 CLOSED, 0 FAILED.
 *     · Indiana University-Purdue University Indianapolis → 76%
 *       (NCES College Navigator, Fall 2024: 15,643 applicants, 76% admitted).
 *   edAcceptanceRate — 0 CLOSED, 7 UNAVAILABLE, 0 FAILED.
 *     Every edAcceptanceRate target is a regional/state public university with
 *     NO binding Early Decision program (rolling admission and/or non-binding
 *     Early Action only).
 *
 * metadata.provenance is MERGED — other provenance keys are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-ed-accept-final.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-final-agent';

/** A target with a real, source-verified numeric value to write. */
interface Resolved {
  targetId: string;
  schoolId: string;
  name: string;
  field: 'acceptanceRate' | 'edAcceptanceRate';
  value: number;
  sourceUrl: string;
  confidence: number; // 0.6–1.0
  tier: 'SCRAPED' | 'OFFICIAL';
}

/** A target that is genuinely UNAVAILABLE or FAILED — no School field written. */
interface Unresolved {
  targetId: string;
  name: string;
  field: 'acceptanceRate' | 'edAcceptanceRate';
  status: 'UNAVAILABLE' | 'FAILED';
  reason: string;
  sourceUrl: string;
}

const RESOLVED: Resolved[] = [
  {
    // NCES College Navigator (IPEDS), Fall 2024: 15,643 applicants, 76% admitted.
    targetId: 'cmpa292zy03hvhws5iv7mscux',
    schoolId: 'cmnwr8itm003nz0tiqazikwxi',
    name: 'Indiana University-Purdue University Indianapolis',
    field: 'acceptanceRate',
    value: 76,
    sourceUrl: 'https://nces.ed.gov/collegenavigator/?id=151111',
    confidence: 0.85,
    tier: 'OFFICIAL',
  },
];

const UNRESOLVED: Unresolved[] = [
  {
    targetId: 'cmp9pn26l01m5a85oxgblkf43',
    name: 'Wichita State University',
    field: 'edAcceptanceRate',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Wichita State uses a rolling admissions policy for all incoming first-year students with no Early Decision or Early Action plan.',
    sourceUrl: 'https://www.wichita.edu/admissions/undergraduate/faq.php',
  },
  {
    targetId: 'cmp9pn2li01v7a85o0yb2ooek',
    name: 'Appalachian State University',
    field: 'edAcceptanceRate',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Appalachian State offers only non-binding Early Action with rolling review and Regular Decision.',
    sourceUrl: 'https://www.appstate.edu/undergrad-deadlines/',
  },
  {
    targetId: 'cmp9pn172010za85ooaoxx34h',
    name: 'James Madison University',
    field: 'edAcceptanceRate',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — JMU offers only non-binding Early Action (Nov 1) and Regular Decision (Jan 15).',
    sourceUrl: 'https://www.jmu.edu/admissions/apply/dates-and-deadlines.shtml',
  },
  {
    targetId: 'cmp9pn1o701baa85ocmtzzm5u',
    name: 'University of North Carolina Wilmington',
    field: 'edAcceptanceRate',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UNCW offers only non-binding Early Action (Nov 1) and Regular Decision (Feb 1).',
    sourceUrl: 'https://uncw.edu/admissions/undergraduate/first-year/deadlines',
  },
  {
    targetId: 'cmp9pn0bv00jwa85o0apk8s31',
    name: 'Grand Valley State University',
    field: 'edAcceptanceRate',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — GVSU uses rolling undergraduate admission with no Early Decision or Early Action plan.',
    sourceUrl:
      'https://www.gvsu.edu/admissions/undergraduate-application-23.htm',
  },
  {
    targetId: 'cmp9pmzvo00bua85o7bvppcfu',
    name: 'Towson University',
    field: 'edAcceptanceRate',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Towson offers only non-binding Early Action (Nov 1) and Regular Decision (Feb 1).',
    sourceUrl:
      'https://www.towson.edu/admissions/undergrad/freshmen/deadlines.html',
  },
  {
    targetId: 'cmp9pn0rs00s1a85ot1bisdar',
    name: 'California State University, Sacramento',
    field: 'edAcceptanceRate',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Sacramento State applies the standard CSU application timeline (single Nov 30 priority deadline) with no Early Decision or Early Action plan.',
    sourceUrl:
      'https://www.csus.edu/apply/admissions/application-process/freshman-process.html',
  },
];

function rangeOk(field: Resolved['field'], v: number): boolean {
  return field === 'edAcceptanceRate' ? v >= 1 && v <= 80 : v >= 1 && v <= 100;
}

async function main() {
  console.log(
    `[closure-v2-final-agent] batch: ${RESOLVED.length} CLOSED, ${
      UNRESOLVED.filter((u) => u.status === 'UNAVAILABLE').length
    } UNAVAILABLE, ${
      UNRESOLVED.filter((u) => u.status === 'FAILED').length
    } FAILED (fetchedAt=${FETCHED_AT})\n`,
  );

  let schoolUpdated = 0;
  let targetUpdated = 0;

  // --- CLOSED: write verified School field + merge provenance ---
  for (const r of RESOLVED) {
    if (!rangeOk(r.field, r.value)) {
      console.warn(
        `  SKIP ${r.name}: ${r.field} ${r.value} outside range gate`,
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
        [r.field]: {
          value: r.value,
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
      data: { [r.field]: r.value, metadata: mergedMetadata },
    });
    schoolUpdated += 1;

    // ClosureTarget is not in the Prisma schema — raw SQL.
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
    console.log(
      `  CLOSED       ${r.name} :: ${r.field} => ${r.value}%  [${r.sourceUrl}]`,
    );
  }

  // --- UNAVAILABLE / FAILED: update only the ClosureTarget row ---
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
    console.log(
      `  ${u.status.padEnd(12)} ${u.name} :: ${u.field} — ${u.reason}`,
    );
  }

  console.log(
    `\n[closure-v2-final-agent] done. ${schoolUpdated} School rows updated, ${targetUpdated} ClosureTarget rows updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-final-agent] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
