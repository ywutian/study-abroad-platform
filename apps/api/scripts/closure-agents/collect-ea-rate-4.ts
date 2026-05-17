/**
 * collect-ea-rate-4.ts
 *
 * closure-v2 data-collection agent output (batch 4).
 *
 * Writes REAL, source-verified `School.eaAcceptanceRate` values for a 30-school
 * batch of `ClosureTarget` rows (field = 'eaAcceptanceRate', status = PENDING).
 *
 * Semantics of eaAcceptanceRate:
 *   number → an authoritative source explicitly publishes a single-early-round,
 *            NON-binding (EA / REA / SCEA) admit rate. Range gate: 1–90%.
 *   null   → school either has NO non-binding early round (ED-only / rolling /
 *            no early round) OR has such a round but publishes no round-specific
 *            admit rate → row left NULL, target → UNAVAILABLE.
 *
 * Every target in the batch gets its ClosureTarget row updated:
 *   CLOSED      → eaAcceptanceRate written + provenance merged into metadata
 *   UNAVAILABLE → eaAcceptanceRate left NULL (no EA program, or no published rate)
 *   FAILED      → could not determine (none in this batch)
 *
 * ClosureTarget is a DB-only table (not in schema.prisma → not on the Prisma
 * client), so its rows are updated via $executeRaw. School rows use the typed
 * client. metadata.provenance.eaAcceptanceRate is MERGED — other keys preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-ea-rate-4.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-ea-agent-4';

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
 * EA rate exists (no non-binding early round, rolling admission, restricted
 * early round, or round exists but no published round-specific rate). EA here
 * = a general non-binding early round (EA / REA / SCEA).
 */
const BATCH: BatchTarget[] = [
  // ── CLOSED: credible, source-verified non-binding EA admit rate ────────────
  {
    // Penn State — Early Action (non-binding), Class of 2027: 70.3% EA admit
    // rate. Corroborated by College Transitions (reports 71%, 25,053 admits /
    // 35,462 EA applicants) and Ivy Coach's EA statistics tracker (70.3%).
    status: 'CLOSED',
    targetId: 'cmp9pmzmy006ka85oe65400fj',
    schoolId: 'cmnwr8imx000lz0tiez2ik9eg',
    name: 'Pennsylvania State University',
    value: 70.3,
    sourceUrl:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/penn-state-university-early-action-admission-statistics/',
    confidence: 0.82,
    tier: 'SCRAPED',
    note: 'Early Action (non-binding). 70.3% EA admit rate, Class of 2027 (Ivy Coach EA tracker; College Transitions corroborates 71%, 25,053/35,462 EA applicants).',
  },

  // ── UNAVAILABLE: no non-binding early round at all (ED-only) ───────────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn03700gca85o3d6fi95d',
    schoolId: 'cmnwr8imj000dz0tif3r9fq0l',
    name: 'University of Connecticut',
    sourceUrl: 'https://admissions.uconn.edu/apply/first-year/',
    lastError:
      'No Early Action program — UConn offers only binding Early Decision alongside Regular Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1vo01fsa85oxn57zcjd',
    schoolId: 'cmnwr8ilx0001z0tilru6b1th',
    name: 'William & Mary',
    sourceUrl:
      'https://www.wm.edu/admission/undergraduateadmission/facts-figures/',
    lastError:
      'No Early Action program — William & Mary offers only binding Early Decision (ED I/II) alongside Regular Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzif003oa85owmr905f0',
    schoolId: 'cmnwr8imi000cz0tifntjkili',
    name: 'Syracuse University',
    sourceUrl:
      'https://www.syracuse.edu/admissions-aid/application-process/undergraduate/enrollment-options/',
    lastError:
      'No Early Action program — Syracuse offers only binding Early Decision (ED I/II) alongside Regular Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzhz003ea85o1s6omqp4',
    schoolId: 'cmnwr8img000bz0tiktbc3agu',
    name: 'George Washington University',
    sourceUrl: 'https://undergraduate.admissions.gwu.edu/first-year-applicants',
    lastError:
      'No Early Action program — GW offers only binding Early Decision (ED I/II) alongside Regular Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1op01bma85oy10iehgz',
    schoolId: 'cmnwr8itt003rz0tizqmu1u5h',
    name: 'Yeshiva University',
    sourceUrl: 'https://www.yu.edu/admissions/apply/early',
    lastError:
      'No non-binding Early Action program — Yeshiva offers binding Early Decision and an Early Admission track for high-school juniors, but no general non-binding EA round.',
  },

  // ── UNAVAILABLE: no early round at all (rolling admission) ─────────────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn20m01ipa85olr7558w7',
    schoolId: 'cmnwr8im90007z0ti2n04hf3n',
    name: 'University of Pittsburgh',
    sourceUrl: 'https://admissions.pitt.edu/first-year-student/',
    lastError:
      'No Early Action program — Pitt uses rolling admission with no EA/ED option (Dec 1 scholarship priority date only).',
  },

  // ── UNAVAILABLE: no general EA program (EA-only switch, no published rate) ─
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn00z00f5a85o6811hdi6',
    schoolId: 'cmnwr8imc0009z0tie59yu85k',
    name: 'Virginia Tech',
    sourceUrl:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/virginia-tech-early-action-admission-statistics/',
    lastError:
      'Has non-binding Early Action (Virginia Tech switched to EA-only) but does not publish a round-specific EA admit rate.',
  },

  // ── UNAVAILABLE: has EA but no published round-specific admit rate ─────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzx000csa85ouopma68a',
    schoolId: 'cmnwr8imn000fz0ti5zassqtj',
    name: 'Pepperdine University',
    sourceUrl:
      'https://seaver.pepperdine.edu/admission/application/undergraduate/apply.htm',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no verifiable EA acceptance data; third-party figures conflict).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzln005pa85oz845pp7f',
    schoolId: 'cmnwr8im10003z0ti20a5qdxq',
    name: 'Brandeis University',
    sourceUrl:
      'https://www.collegetransitions.com/blog/how-to-get-into-brandeis-acceptance-rate/',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (only Early Decision and overall rates are disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0lu00p5a85o5r9j0ec1',
    schoolId: 'cmnwr8im50005z0ti3z02fhjs',
    name: 'Santa Clara University',
    sourceUrl:
      'https://www.scu.edu/news-and-events/press-releases/2025/december-2025/news/santa-clara-university-admits-first-members-of-class-of-2030.html',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (SCU releases only a combined EA+ED early figure; third-party EA figures conflict).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0st00sna85or9dt6jiy',
    schoolId: 'cmnwr8iml000ez0ti01wzdugn',
    name: 'Indiana University Bloomington',
    sourceUrl: 'https://admissions.indiana.edu/apply/deadlines.html',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no EA/RD breakdown in the Common Data Set or official channels).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn09300iqa85ob33gi17g',
    schoolId: 'cmnwr8in9000rz0ti2orsdpwi',
    name: 'University of Miami',
    sourceUrl:
      'https://admissions.miami.edu/undergraduate/about/class-profile/index.html',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (only Early Decision and overall rates are disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0tb00sya85otrq0irvo',
    schoolId: 'cmnwr8in5000pz0tiefcdnmfi',
    name: 'Stevens Institute of Technology',
    sourceUrl:
      'https://www.stevens.edu/admission-aid/undergraduate-admissions/first-year-application-plans',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no official EA acceptance data; third-party estimates only).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1e70156a85opkqmn61j',
    schoolId: 'cmnwr8imv000kz0ti6chk6fxq',
    name: 'Michigan State University',
    sourceUrl:
      'https://admissions.msu.edu/apply/first-year/dates-and-deadlines',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no EA/RD breakdown disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0lc00ova85oiq0upnog',
    schoolId: 'cmnwr8inf000uz0tic8a7s8is',
    name: 'Rensselaer Polytechnic Institute',
    sourceUrl:
      'https://www.collegetransitions.com/blog/how-to-get-into-rpi-rensselaer/',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no official EA acceptance data; only a US News early figure exists).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0ms00pfa85op44rdd0t',
    schoolId: 'cmnwr8in0000mz0tiria7qm89',
    name: 'University of Iowa',
    sourceUrl:
      'https://admissions.uiowa.edu/apply/how-apply/first-year-admissions',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no EA/RD breakdown disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0yt00wia85o2su5zprf',
    schoolId: 'cmnwr8ims000iz0timfd6oan8',
    name: 'Southern Methodist University',
    sourceUrl:
      'https://www.smu.edu/admission/apply/undergraduate-admission/early-decision',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (only Early Decision and overall rates are disclosed; third-party figures conflict).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmznd006va85ol9zfrjms',
    schoolId: 'cmnwr8in7000qz0ti04kcrc1l',
    name: 'University of Delaware',
    sourceUrl:
      'https://www.udel.edu/apply/undergraduate-admissions/apply-to-ud/freshman-admissions/',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no official EA acceptance data available).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0zq00x3a85ojpzb8l3a',
    schoolId: 'cmnwr8ing000vz0tizgajtqeo',
    name: 'University of Colorado Boulder',
    sourceUrl: 'https://www.colorado.edu/admissions/process/first-year/faqs',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (CU Boulder gives EA applicants the same consideration as RD and discloses no EA/RD breakdown).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0hy00mta85omvto539s',
    schoolId: 'cmnwr8ins0012z0ti4o8njwhn',
    name: 'Stony Brook University',
    sourceUrl:
      'https://www.stonybrook.edu/undergraduate-admissions/apply/early-action.php',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no EA/RD breakdown disclosed; only a US News early figure exists).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0nv00pqa85oia2r00s6',
    schoolId: 'cmnwr8ind000tz0timgwcy8hj',
    name: 'Loyola Marymount University',
    sourceUrl:
      'https://admission.lmu.edu/learnmore/prospectivestudents/first-yearapplicants/',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no official EA acceptance data).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0aj00jba85o7bm348zw',
    schoolId: 'cmnwr8io00017z0ti5bju2vo7',
    name: 'University at Buffalo',
    sourceUrl: 'https://www.buffalo.edu/admissions/apply/first-year.html',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no EA/RD breakdown disclosed; only a US News early figure exists).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0k300o1a85o0prits7k',
    schoolId: 'cmnwr8itw003sz0ti2fueoy2e',
    name: 'Baylor University',
    sourceUrl:
      'https://admissions.web.baylor.edu/admission/incoming-freshman/application-process/admission-plans',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (only Early Decision and overall rates are disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1a7012ta85oxk7h9uwr',
    schoolId: 'cmnwr8inl000yz0ti6wsiqcrv',
    name: 'Marquette University',
    sourceUrl:
      'https://www.marquette.edu/admissions/undergraduate/first-year-application.php',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no EA/RD breakdown disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzkr0054a85on74fj48c',
    schoolId: 'cmnwr8iuk0040z0ti7p8v604n',
    name: 'Gonzaga University',
    sourceUrl:
      'https://www.gonzaga.edu/undergraduate-admission/why-gonzaga/explore-gu/faqs',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no EA/RD breakdown disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0gu00m8a85ou65ctxp8',
    schoolId: 'cmnwr8imu000jz0ti03zavqgf',
    name: 'University of Massachusetts Amherst',
    sourceUrl: 'https://www.umass.edu/admissions/admissions-statistics',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (no EA/RD breakdown in the Common Data Set).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0v500u4a85otyz6b6ev',
    schoolId: 'cmnwr8in3000oz0tih36u19xf',
    name: 'Clemson University',
    sourceUrl:
      'https://www.clemson.edu/admissions/undergraduate-admissions/apply/early-action.html',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (Clemson releases no EA/RD breakdown).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzoa007ga85onpi89bj7',
    schoolId: 'cmnwr8io20018z0tizk1tsitd',
    name: 'North Carolina State University',
    sourceUrl: 'https://admissions.ncsu.edu/apply/fast-facts/',
    lastError:
      'Has non-binding Early Action but has stopped publishing round-specific EA admit data (no EA/RD breakdown disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1gf016na85oh2hx3vrr',
    schoolId: 'cmnwr8imr000hz0tik9lqym4i',
    name: 'Fordham University',
    sourceUrl:
      'https://www.usnews.com/best-colleges/fordham-university-2722/applying',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (only Early Decision and overall rates are disclosed; only a US News early figure exists).',
  },
];

function isClosed(t: BatchTarget): t is ClosedTarget {
  return t.status === 'CLOSED';
}

async function main() {
  const closed = BATCH.filter(isClosed);
  console.log(
    `[closure-v2-ea-agent-4] batch=${BATCH.length}  CLOSED=${closed.length}  ` +
      `UNAVAILABLE=${BATCH.filter((t) => t.status === 'UNAVAILABLE').length}  ` +
      `FAILED=${BATCH.filter((t) => t.status === 'FAILED').length}  (fetchedAt=${FETCHED_AT})\n`,
  );

  // Sanity: no duplicate target IDs.
  const ids = BATCH.map((t) => t.targetId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate targetId in batch');
  }

  // Range gate guard — fail loudly rather than write a bad number.
  for (const t of closed) {
    if (t.value < 1 || t.value > 90) {
      throw new Error(
        `Range gate violation: ${t.name} eaAcceptanceRate=${t.value} (must be 1–90)`,
      );
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
    `\n[closure-v2-ea-agent-4] done. ${schoolsUpdated} school rows updated, ` +
      `${targetsUpdated} closure targets updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-ea-agent-4] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
