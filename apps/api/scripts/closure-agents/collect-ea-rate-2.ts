/**
 * collect-ea-rate-2.ts
 *
 * closure-v2 data-collection agent output (batch 2).
 *
 * Writes REAL, source-verified `School.eaAcceptanceRate` values for a 30-school
 * batch of `ClosureTarget` rows (field = 'eaAcceptanceRate', status = PENDING).
 *
 * Semantics of eaAcceptanceRate:
 *   number → an authoritative source explicitly publishes a single-early-round,
 *            NON-binding (EA / REA / SCEA) admit rate. Range gate: 1–90%.
 *   null   → school either has NO non-binding early round (ED-only / no early
 *            round / UC single-window) OR has such a round but publishes no
 *            round-specific admit rate → row left NULL, target → UNAVAILABLE.
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
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-ea-rate-2.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-ea-agent-2';

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
 * round-specific rate). EA here = restrictive EA / REA / SCEA single early
 * non-binding round.
 */
const BATCH: BatchTarget[] = [
  // ── CLOSED: credible, source-verified non-binding early-round admit rate ───
  {
    // Georgetown Early Action (non-binding), Class of 2028: 881 admits /
    // 8,584 applicants = 10.3%. The Hoya (Georgetown's student paper of record).
    status: 'CLOSED',
    targetId: 'cmp9pn1q101cga85oqjvgw0uy',
    schoolId: 'cmn1htkoc000lvqf2s5pgbhxx',
    name: 'Georgetown University',
    value: 10.3,
    sourceUrl:
      'https://thehoya.com/news/georgetown-admits-first-early-action-class-without-race-based-affirmative-action/',
    confidence: 0.92,
    tier: 'SCRAPED',
    note: 'Early Action (non-binding). 881/8,584 admitted, Class of 2028.',
  },
  {
    // Notre Dame Restrictive Early Action (non-binding), Class of 2028:
    // 1,724 admits / 11,498 applicants = 15.0%. Official ND admissions newsroom.
    status: 'CLOSED',
    targetId: 'cmp9pn1p401bwa85oiybz6vlv',
    schoolId: 'cmn1htko7000jvqf22r0n55p2',
    name: 'University of Notre Dame',
    value: 15.0,
    sourceUrl:
      'https://admissions.nd.edu/visit-engage/stories-news/university-of-notre-dame-releases-restrictive-early-action-decisions-for-the-class-of-2028-2/',
    confidence: 0.97,
    tier: 'OFFICIAL',
    note: 'Restrictive Early Action (non-binding). 1,724/11,498 admitted, Class of 2028.',
  },
  {
    // UVA Early Action (non-binding), Class of 2028: 6,541 offers /
    // 37,645 EA applicants = 17.4%. Official UVA newsroom (news.virginia.edu).
    status: 'CLOSED',
    targetId: 'cmp9pmzqt0096a85o8csxcqu8',
    schoolId: 'cmn1htkom000pvqf2se90bue1',
    name: 'University of Virginia',
    value: 17.4,
    sourceUrl:
      'https://news.virginia.edu/content/class-2028-uva-offers-entry-nearly-2000-regular-decision-round',
    confidence: 0.93,
    tier: 'OFFICIAL',
    note: 'Early Action (non-binding). 6,541 offers / 37,645 EA applicants, Class of 2028.',
  },

  // ── UNAVAILABLE: no non-binding early round at all (ED-only) ───────────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzjc0049a85om8v353me',
    schoolId: 'cmn1htknm000avqf2g8h3sbdp',
    name: 'Northwestern University',
    sourceUrl:
      'https://admissions.northwestern.edu/apply/application-deadlines.html',
    lastError:
      'No Early Action program — Northwestern offers only binding Early Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1k8018pa85oo4x4rf0z',
    schoolId: 'cmn1htknh0008vqf2i053h8rm',
    name: 'Brown University',
    sourceUrl:
      'https://admission.brown.edu/apply/how-apply/ivy-league-joint-statement-admissions',
    lastError:
      'No Early Action program — Brown offers only binding Early Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn24t01l1a85ot6syy2ox',
    schoolId: 'cmn1htknl0009vqf255v6mh7y',
    name: 'Johns Hopkins University',
    sourceUrl: 'https://apply.jhu.edu/frequently-asked-questions/',
    lastError:
      'No Early Action program — Johns Hopkins offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2j401tua85ondfwnm09',
    schoolId: 'cmnwr8iv4004az0tioxjsp148',
    name: 'Claremont McKenna College',
    sourceUrl:
      'https://www.cmc.edu/admission/first-year-application-instructions',
    lastError:
      'No Early Action program — Claremont McKenna offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1bo013oa85onib4isjc',
    schoolId: 'cmnwr8iv5004bz0ti94b7ow5h',
    name: 'Hamilton College',
    sourceUrl: 'https://www.hamilton.edu/admission/apply/early-decision',
    lastError:
      'No Early Action program — Hamilton offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn20501ifa85o3bx2w1d1',
    schoolId: 'cmnwr8iv7004cz0tiy7lyda2g',
    name: 'Haverford College',
    sourceUrl:
      'https://www.haverford.edu/financial-aid/applying-financial-aid/early-decision-and-regular-decision',
    lastError:
      'No Early Action program — Haverford offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzde000ga85oki14jbtc',
    schoolId: 'cmn1htkno000bvqf209819ok4',
    name: 'Columbia University',
    sourceUrl:
      'https://admission.brown.edu/apply/how-apply/ivy-league-joint-statement-admissions',
    lastError:
      'No Early Action program — Columbia offers only binding Early Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzfx001xa85o7deqefty',
    schoolId: 'cmn1htknq000cvqf2sogobdg1',
    name: 'Cornell University',
    sourceUrl:
      'https://admission.brown.edu/apply/how-apply/ivy-league-joint-statement-admissions',
    lastError:
      'No Early Action program — Cornell offers only binding Early Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1ly019va85omcbttrf3',
    schoolId: 'cmnwr8iv9004dz0tirpo4zq16',
    name: 'Vassar College',
    sourceUrl: 'https://www.collegekickstart.com/blog/tag/Vassar',
    lastError:
      'No Early Action program — Vassar offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzzg00eaa85oku11xxog',
    schoolId: 'cmnwr8ivb004ez0tiduer8l0n',
    name: 'Grinnell College',
    sourceUrl:
      'https://www.grinnell.edu/admission/apply/first-year/early-decision',
    lastError:
      'No Early Action program — Grinnell offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn08h00iga85o7jb9uhec',
    schoolId: 'cmnwr8ivd004fz0tiwbcr93y2',
    name: 'Colgate University',
    sourceUrl: 'https://www.colgate.edu/admission-aid/apply/early-decision',
    lastError:
      'No Early Action program — Colgate offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzjs004ja85o9sr2rsaz',
    schoolId: 'cmnwr8ive004gz0tihs1kxbek',
    name: 'Davidson College',
    sourceUrl:
      'https://www.davidson.edu/admission-and-financial-aid/apply/early-decision',
    lastError:
      'No Early Action program — Davidson offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1nf01ara85o2luljh09',
    schoolId: 'cmnwr8ivg004hz0ti8c1ggiw8',
    name: 'Smith College',
    sourceUrl:
      'https://www.smith.edu/admission-aid/apply-smith/first-year-applicants',
    lastError:
      'No Early Action program — Smith offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn07t00i6a85o5i47wtor',
    schoolId: 'cmn1htko0000gvqf2pmjc1xi9',
    name: 'Rice University',
    sourceUrl:
      'https://admission.rice.edu/apply/first-year-domestic-applicants',
    lastError:
      'No Early Action program — Rice offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1ns01b1a85oczh1at7k',
    schoolId: 'cmn1htko2000hvqf2r5gxwf84',
    name: 'Dartmouth College',
    sourceUrl:
      'https://admissions.dartmouth.edu/glossary-term/ivy-league-agreement',
    lastError:
      'No Early Action program — Dartmouth offers only binding Early Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2aa01oha85om22tboy9',
    schoolId: 'cmnwr8ivi004iz0tinveg964v',
    name: 'Washington and Lee University',
    sourceUrl: 'https://www.wlu.edu/admissions/apply/about-early-decision',
    lastError:
      'No Early Action program — Washington and Lee offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn28z01nna85o81wkurl6',
    schoolId: 'cmn1htko5000ivqf28d3x9557',
    name: 'Vanderbilt University',
    sourceUrl:
      'https://admissions.vanderbilt.edu/vandybloggers/2024/02/class-of-2028-early-decision-by-the-numbers/',
    lastError:
      'No Early Action program — Vanderbilt offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2k201uea85oogpqskur',
    schoolId: 'cmnwr8ivj004jz0tij2m7ox54',
    name: 'Colby College',
    sourceUrl: 'https://afa.colby.edu/apply/faq/',
    lastError:
      'No Early Action program — Colby offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2mr01vua85o1cjwkzds',
    schoolId: 'cmnwr8ivl004kz0tiv0vgf6c6',
    name: 'Bates College',
    sourceUrl: 'https://www.bates.edu/admission/apply/application-options/',
    lastError:
      'No Early Action program — Bates offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzh7002ta85owepjdx7x',
    schoolId: 'cmnwr8ivm004lz0tio6m2uic4',
    name: 'Barnard College',
    sourceUrl: 'https://barnard.edu/admissions/application-rounds',
    lastError:
      'No Early Action program — Barnard offers only binding Early Decision.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn02400fra85oprhtck7h',
    schoolId: 'cmn1htkoa000kvqf2oqm36hw5',
    name: 'University of Michigan, Ann Arbor',
    sourceUrl:
      'https://admissions.umich.edu/apply/first-year-applicants/application-process',
    lastError:
      'Has non-binding Early Action but does not publish a round-specific EA admit rate (only overall ~15.6% rate disclosed; defers/rejects many EA applicants without round breakdown).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzff001ma85ojvvjjnkt',
    schoolId: 'cmn1htkoe000mvqf2odaszvmk',
    name: 'University of North Carolina at Chapel Hill',
    sourceUrl:
      'https://admissions.unc.edu/apply/types-of-applications/first-year/',
    lastError:
      'Has non-binding Early Action but does not publish an authoritative round-specific EA admit rate (no primary-source EA admit count for the Class of 2028; College Kickstart EA table left admits/rate blank).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn00i00eva85obtop2hxy',
    schoolId: 'cmn1htkns000dvqf2a150rn2s',
    name: 'University of Chicago',
    sourceUrl:
      'https://collegeadmissions.uchicago.edu/apply/first-year-applicants',
    lastError:
      'Has non-binding Early Action but does not publish round-specific (EA/ED/RD) admit rates — only the overall Class of 2028 rate is disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0hi00mja85oq1xvr3s8',
    schoolId: 'cmn1htkoj000ovqf226pta7or',
    name: 'Emory University',
    sourceUrl:
      'https://apply.emory.edu/apply/first-year/plans-deadlines/index.html',
    lastError:
      'No Early Action program — Emory offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1l2019aa85o31jts5bd',
    schoolId: 'cmn1htkoh000nvqf2uj3pjgxw',
    name: 'Carnegie Mellon University',
    sourceUrl:
      'https://www.cmu.edu/admission/admission/application-plans-deadlines',
    lastError:
      'No Early Action program — Carnegie Mellon offers only binding Early Decision.',
  },

  // ── UNAVAILABLE: no early round at all (UC single application window) ──────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzyh00doa85o0ylbs719',
    schoolId: 'cmn1htknv000evqf29yjvrstt',
    name: 'University of California, Berkeley',
    sourceUrl:
      'https://admissions.berkeley.edu/apply-to-berkeley/dates-deadlines/',
    lastError:
      'No Early Action program — all UC campuses use a single Oct 1–Nov 30 application window with no EA/ED option.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1mg01a5a85o4d06d44i',
    schoolId: 'cmn1htkny000fvqf2jlmz8ej1',
    name: 'University of California, Los Angeles',
    sourceUrl: 'https://admission.ucla.edu/apply/first-year',
    lastError:
      'No Early Action program — all UC campuses use a single Oct 1–Nov 30 application window with no EA/ED option.',
  },
];

function isClosed(t: BatchTarget): t is ClosedTarget {
  return t.status === 'CLOSED';
}

async function main() {
  const closed = BATCH.filter(isClosed);
  console.log(
    `[closure-v2-ea-agent-2] batch=${BATCH.length}  CLOSED=${closed.length}  ` +
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
    `\n[closure-v2-ea-agent-2] done. ${schoolsUpdated} school rows updated, ` +
      `${targetsUpdated} closure targets updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-ea-agent-2] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
