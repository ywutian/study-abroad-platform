/**
 * collect-ea-rate.ts
 *
 * closure-v2 data-collection agent output.
 *
 * Writes REAL, source-verified `School.eaAcceptanceRate` values for a 30-school
 * batch of `ClosureTarget` rows (field = 'eaAcceptanceRate', status = PENDING).
 *
 * Semantics of eaAcceptanceRate:
 *   number → an authoritative source explicitly publishes a single-early-round,
 *            NON-binding (EA / REA / SCEA) admit rate. Range gate: 1–90%.
 *   null   → school either has NO non-binding early round (ED-only / rolling /
 *            no early round at all) OR has such a round but publishes no
 *            round-specific admit rate → row left NULL, target → UNAVAILABLE.
 *
 * Every target in the batch gets its ClosureTarget row updated:
 *   CLOSED      → eaAcceptanceRate written + provenance merged into metadata
 *   UNAVAILABLE → eaAcceptanceRate left NULL (has-EA-but-no-rate, or no EA program)
 *   FAILED      → could not determine (none in this batch)
 *
 * ClosureTarget is a DB-only table (not in schema.prisma → not on the Prisma
 * client), so its rows are updated via $executeRaw. School rows use the typed
 * client. metadata.provenance.eaAcceptanceRate is MERGED — other keys preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-ea-rate.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-ea-agent';

type Tier = 'OFFICIAL' | 'SCRAPED';

interface ClosedTarget {
  status: 'CLOSED';
  targetId: string;
  schoolId: string;
  name: string;
  value: number; // EA admit rate %
  sourceUrl: string;
  confidence: number;
  tier: Tier;
  note?: string;
}

interface NonClosedTarget {
  status: 'UNAVAILABLE' | 'FAILED';
  targetId: string;
  schoolId: string;
  name: string;
  sourceUrl?: string;
  confidence?: number;
  tier?: Tier;
  lastError: string;
}

type BatchTarget = ClosedTarget | NonClosedTarget;

/**
 * Full 30-school batch. Each non-CLOSED entry's `lastError` records WHY no
 * EA rate exists (no non-binding early round, or round exists but no published
 * rate). EA here = restrictive EA / REA / SCEA single-early-round non-binding.
 */
const BATCH: BatchTarget[] = [
  // ── CLOSED: credible, source-verified EA round admit rate ──────────────────
  {
    // Harvard Restrictive Early Action, Class of 2028: 692 admits / 7,921
    // applicants = 8.74%. The Harvard Crimson (campus paper of record).
    status: 'CLOSED',
    targetId: 'cmp9pn22v01jwa85og334o55c',
    schoolId: 'cmn1htkn60002vqf2r731l78m',
    name: 'Harvard University',
    value: 8.74,
    sourceUrl: 'https://www.thecrimson.com/article/2023/12/14/early-action-2028/',
    confidence: 0.95,
    tier: 'SCRAPED',
    note: 'Restrictive Early Action (non-binding). 692/7,921 admitted, Class of 2028.',
  },
  {
    // Yale Single-Choice Early Action, Class of 2028: 709 admits / 7,856
    // applicants = 9.02%. Reported by Yale Daily News; corroborated by
    // College Kickstart and Ivy Coach (identical 709/7,856 figures).
    status: 'CLOSED',
    targetId: 'cmp9pmznv0076a85ourqgemvu',
    schoolId: 'cmn1htkna0004vqf2erll9srp',
    name: 'Yale University',
    value: 9.02,
    sourceUrl:
      'https://www.collegekickstart.com/blog/item/yale-accepts-9-percent-of-early-action-applicants-to-the-class-of-2028',
    confidence: 0.93,
    tier: 'SCRAPED',
    note: 'Single-Choice Early Action (non-binding). 709/7,856 admitted, Class of 2028.',
  },

  // ── UNAVAILABLE: no non-binding early round at all (ED-only / rolling / none)
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzp60082a85o27vgcjkb',
    schoolId: 'cmn1htkmy0000vqf2src2zcb5',
    name: 'Princeton University',
    sourceUrl: 'https://admission.princeton.edu/apply/first-year-application-dates-deadlines',
    lastError:
      'Has Single-Choice Early Action but no longer publishes any round-specific admit rate (last public SCEA data was Class of 2023).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2o501woa85o3lys45vt',
    schoolId: 'cmn1htkn80003vqf29zl0f9lr',
    name: 'Stanford University',
    sourceUrl: 'https://admission.stanford.edu/apply/first-year/decision_process.html',
    lastError:
      'Has Restrictive Early Action but does not publish separate REA vs RD admit rates (only overall rate disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzqe008wa85od0qhkbua',
    schoolId: 'cmn1htkne0006vqf2quzi0v6h',
    name: 'California Institute of Technology',
    sourceUrl: 'https://www.admissions.caltech.edu/apply/what-we-look-for/class-profile',
    lastError:
      'Has Restrictive Early Action but does not publish separate REA admit rate (states REA/RD rates are near-identical, only overall rate disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn26601lwa85ois79oi74',
    schoolId: 'cmn1htknc0005vqf2l2az4cd2',
    name: 'University of Pennsylvania',
    sourceUrl: 'https://admissions.upenn.edu/how-to-apply/first-year-applicants',
    lastError: 'No Early Action program — Penn offers only binding Early Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn24e01kra85oivfdx00a',
    schoolId: 'cmn1htkng0007vqf224oeyvgq',
    name: 'Duke University',
    sourceUrl: 'https://admissions.duke.edu/apply/',
    lastError: 'No Early Action program — Duke offers only binding Early Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2i501taa85olnwodeqa',
    schoolId: 'cmnwr8iup0042z0tign5klw7c',
    name: 'Williams College',
    sourceUrl: 'https://williamsrecord.com/465491/news/college-admits-249-out-of-record-breaking-1068-applicants-to-class-of-2028-through-early-decision/',
    lastError: 'No Early Action program — Williams offers only binding Early Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzef0011a85oiuhe1jjl',
    schoolId: 'cmnwr8iur0043z0tie8ndrb65',
    name: 'Amherst College',
    sourceUrl: 'https://www.amherst.edu/admission/apply/firstyear',
    lastError: 'No Early Action program — Amherst offers only binding Early Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn25r01lma85oqw9392o0',
    schoolId: 'cmnwr8iwe004zz0tilegv5ian',
    name: 'Harvey Mudd College',
    sourceUrl: 'https://www.hmc.edu/admission/apply/',
    lastError: 'No Early Action program — Harvey Mudd offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn28601n3a85ofksl3cq2',
    schoolId: 'cmnwr8iut0044z0tie7749l79',
    name: 'Swarthmore College',
    sourceUrl: 'https://www.swarthmore.edu/news-events/swarthmore-admits-975-to-class-2028',
    lastError: 'No Early Action program — Swarthmore offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2ik01tka85ookqzit2g',
    schoolId: 'cmnwr8iux0046z0tilggqkjw6',
    name: 'Wellesley College',
    sourceUrl: 'https://admissionsight.com/wellesley-application-deadline/',
    lastError: 'No Early Action program — Wellesley offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0dc00kia85ojybjhu0b',
    schoolId: 'cmnwr8iuv0045z0tiq1lprcv8',
    name: 'Pomona College',
    sourceUrl: 'https://admissionsight.com/pomona-college-application-deadline/',
    lastError: 'No Early Action program — Pomona offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2b701p2a85oeke9w89p',
    schoolId: 'cmnwr8iuy0047z0tijtdlowua',
    name: 'Bowdoin College',
    sourceUrl: 'https://bowdoinorient.com/2024/03/29/bowdoin-admits-7-percent-of-applicants-to-class-of-2028-lowest-rate-ever-in-college-history/',
    lastError: 'No Early Action program — Bowdoin offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0kh00oba85oubg9mflm',
    schoolId: 'cmnwr8iv00048z0tityzi3zx8',
    name: 'Middlebury College',
    sourceUrl: 'https://www.middlebury.edu/announcements/announcements/2024/09/middlebury-welcomes-class-2028',
    lastError: 'No Early Action program — Middlebury offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn29d01nxa85orkx5y7oy',
    schoolId: 'cmnwr8iv20049z0ti4tahvum5',
    name: 'Carleton College',
    sourceUrl: 'https://www.carleton.edu/admissions/apply/steps/profile/',
    lastError: 'No Early Action program — Carleton offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn21p01jba85oah4mbkfj',
    schoolId: 'cmnwr8ivo004mz0tign5klw7c',
    name: 'Rhode Island School of Design',
    sourceUrl: 'https://www.risd.edu/admissions/first-year/apply-risd',
    lastError: 'No Early Action program — RISD offers only binding Early Decision and Regular Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2n801w4a85o3smzuybw',
    schoolId: 'cmnwr8iwi0051z0tidfdrzv7w',
    name: 'Cooper Union',
    sourceUrl: 'https://cooper.edu/admissions/applying-to-cu',
    lastError: 'No Early Action program — Cooper Union offers only binding Early Decision and Regular Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2kl01uoa85otrac7iwc',
    schoolId: 'cmnwr8iw4004uz0tia8ikoq2b',
    name: 'The Juilliard School',
    sourceUrl: 'https://www.juilliard.edu/admissions',
    lastError: 'No early round — Juilliard uses a single Dec 1 application deadline with audition-based admission; no EA/ED plan.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2np01wea85oouqv29xt',
    schoolId: 'cmnwr8iw9004wz0tiun4guycq',
    name: 'Curtis Institute of Music',
    sourceUrl: 'https://www.curtis.edu/apply/applying/',
    lastError: 'No Early Action program — Curtis uses a single early-December application deadline with audition-based admission.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2jm01u4a85oe7rbdktf',
    schoolId: 'cmnwr8ivw004pz0tie74ukvke',
    name: 'California Institute of the Arts',
    sourceUrl: 'https://calarts.edu/admissions-aid/admissions/application-process/application-deadlines-and-fees',
    lastError: 'No Early Action program — CalArts uses a priority deadline + rolling space-available admission; no EA/ED plan.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2e901qva85omlka1682',
    schoolId: 'cmnwr8is1002xz0ti23uxhu2j',
    name: 'California Polytechnic State University, San Luis Obispo',
    sourceUrl: 'https://www.calpoly.edu/admissions/first-year-student/dates-and-deadlines',
    lastError: 'No Early Action program — Cal Poly is a CSU with a single Nov 30 application window; no non-binding EA plan.',
  },

  // ── UNAVAILABLE: non-binding EA program EXISTS, but no published EA-specific
  //    admit rate (schools publish only an overall / combined rate) ───────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzck0006a85o8jx2ibm5',
    schoolId: 'cmnwr8iwg0050z0tiyrfhaavh',
    name: 'Rose-Hulman Institute of Technology',
    sourceUrl: 'https://www.rose-hulman.edu/admissions-and-aid/the-application-process/application-and-deadlines/index.html',
    lastError: 'Has non-binding Early Action (Nov 1) but publishes no EA-round-specific admit rate (only overall ~77% rate disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0qx00rha85ot64xcjxb',
    schoolId: 'cmnwr8iw7004vz0ti65mqjgq5',
    name: 'Berklee College of Music',
    sourceUrl: 'https://college.berklee.edu/admissions/undergraduate/deadlines',
    lastError: 'Has non-binding Early Action (Nov 1) but publishes no EA-round-specific admit rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1g1016da85oo30s74e7',
    schoolId: 'cmnwr8ivt004oz0tin9oyxi60',
    name: 'School of the Art Institute of Chicago',
    sourceUrl: 'https://www.saic.edu/admissions/undergraduate/how-apply-freshman',
    lastError: 'Has non-binding Early Action (Nov 15) alongside rolling admission, but publishes no EA-round-specific admit rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2qp01y4a85oe3yt2u50',
    schoolId: 'cmnwr8iwl0052z0ti9adsxk6l',
    name: 'Olin College of Engineering',
    sourceUrl: 'https://www.olin.edu/admission',
    lastError: 'Has an early round but publishes no EA-round-specific admit rate (only overall Class of 2028 profile disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2m601vja85odgw9iro9',
    schoolId: 'cmnwr8ivx004qz0ti7xo8qk4m',
    name: 'ArtCenter College of Design',
    sourceUrl: 'https://www.artcenter.edu/admissions/undergraduate-admissions/important-dates.html',
    lastError: 'Has non-binding Early Action (Nov 15) but publishes no EA-round-specific admit rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2r501yea85otzi2cx38',
    schoolId: 'cmnwr8ivz004rz0tik286u7ol',
    name: 'Savannah College of Art and Design',
    sourceUrl: 'https://www.scad.edu/admission/admission-information/first-year',
    lastError: 'Has non-binding Early Action (Nov 15) alongside rolling admission, but publishes no EA-round-specific admit rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1hw0178a85o2xctl1yb',
    schoolId: 'cmnwr8iw1004sz0ti04r9dj3i',
    name: 'Maryland Institute College of Art',
    sourceUrl: 'https://www.mica.edu/applying-to-mica/apply/first-year-admission/',
    lastError: 'Has Early Action (Dec 1) but publishes no EA-round-specific admit rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1x301gpa85oeb04hp3s',
    schoolId: 'cmnwr8iw3004tz0ti9nqf8ivd',
    name: 'California College of the Arts',
    sourceUrl: 'https://www.cca.edu/admissions/apply/',
    lastError: 'Has an Early Action / priority deadline (Nov 15) but publishes no EA-round-specific admit rate.',
  },
];

function isClosed(t: BatchTarget): t is ClosedTarget {
  return t.status === 'CLOSED';
}

async function main() {
  const closed = BATCH.filter(isClosed);
  console.log(
    `[closure-v2-ea-agent] batch=${BATCH.length}  CLOSED=${closed.length}  ` +
      `UNAVAILABLE=${BATCH.filter((t) => t.status === 'UNAVAILABLE').length}  ` +
      `FAILED=${BATCH.filter((t) => t.status === 'FAILED').length}  (fetchedAt=${FETCHED_AT})\n`,
  );

  // Range gate guard — fail loudly rather than write a bad number.
  for (const t of closed) {
    if (t.value < 1 || t.value > 90) {
      throw new Error(`Range gate violation: ${t.name} eaAcceptanceRate=${t.value} (must be 1–90)`);
    }
  }

  let schoolsUpdated = 0;
  let targetsUpdated = 0;

  for (const t of BATCH) {
    // 1) For CLOSED: write School.eaAcceptanceRate + merge provenance.
    if (isClosed(t)) {
      const school = await prisma.school.findUnique({
        where: { id: t.schoolId },
        select: { id: true, name: true, metadata: true },
      });

      if (!school) {
        console.warn(`  SKIP school ${t.name}: id ${t.schoolId} not found`);
      } else {
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
            eaAcceptanceRate: {
              value: t.value,
              sourceUrl: t.sourceUrl,
              fetchedAt: FETCHED_AT,
              verifiedBy: VERIFIED_BY,
              confidence: t.confidence,
              tier: t.tier,
            },
          },
        };

        await prisma.school.update({
          where: { id: t.schoolId },
          data: {
            eaAcceptanceRate: new Prisma.Decimal(t.value),
            metadata: mergedMetadata,
          },
        });
        schoolsUpdated += 1;
        console.log(`  OK   ${t.name} => ${t.value}%  [${t.sourceUrl}]`);
      }
    } else {
      console.log(`  ${t.status.padEnd(11)} ${t.name} — ${t.lastError}`);
    }

    // 2) Every target: update its ClosureTarget row (DB-only table → raw SQL).
    const sourceUrl = isClosed(t) ? t.sourceUrl : (t.sourceUrl ?? null);
    const confidence = isClosed(t) ? t.confidence : (t.confidence ?? null);
    const tier = isClosed(t) ? t.tier : (t.tier ?? null);
    const lastError = isClosed(t) ? null : t.lastError;

    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = ${t.status}::"ClosureTargetStatus",
          "sourceUrl" = ${sourceUrl},
          confidence = ${confidence},
          tier = ${tier},
          attempts = attempts + 1,
          "lastAttemptAt" = ${new Date()},
          "lastError" = ${lastError},
          "updatedAt" = ${new Date()}
      WHERE id = ${t.targetId}
    `;
    targetsUpdated += 1;
  }

  console.log(
    `\n[closure-v2-ea-agent] done. ${schoolsUpdated} school rows updated, ` +
      `${targetsUpdated} closure targets updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-ea-agent] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
