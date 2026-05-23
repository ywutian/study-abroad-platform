/**
 * collect-ea-rate-3.ts
 *
 * closure-v2 data-collection agent output (batch 3).
 *
 * Writes REAL, source-verified `School.eaAcceptanceRate` values for a 30-school
 * batch of `ClosureTarget` rows (field = 'eaAcceptanceRate', status = PENDING).
 *
 * Semantics of eaAcceptanceRate:
 *   number → an authoritative source explicitly publishes a single-early-round,
 *            NON-binding (EA / REA / SCEA) admit rate. Range gate: 1–90%.
 *   null   → school either has NO non-binding early round (ED-only / no early
 *            round / UC single-window / restricted-population EA) OR has such a
 *            round but publishes no round-specific admit rate → row left NULL,
 *            target → UNAVAILABLE.
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
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-ea-rate-3.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-ea-agent-3';

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
 * EA rate exists (no non-binding early round, restricted-population early
 * round, or round exists but no published round-specific rate). EA here =
 * a general non-binding early round (EA / REA / SCEA).
 */
const BATCH: BatchTarget[] = [
  // ── CLOSED: credible, source-verified non-binding EA admit rate ────────────
  {
    // USC Early Action (non-binding), Class of 2028: ~41,000 EA applicants,
    // admitted 7% of them. The Daily Trojan (USC's student paper of record).
    status: 'CLOSED',
    targetId: 'cmp9pmzpn008ca85o3iis26ct',
    schoolId: 'cmn1htkoz000uvqf2rnozc3fe',
    name: 'University of Southern California',
    value: 7.0,
    sourceUrl: 'https://dailytrojan.com/2024/02/04/usc-acceptance-rate-class-of-2028-expected-9-2-record-low/',
    confidence: 0.88,
    tier: 'SCRAPED',
    note: 'Early Action (non-binding). USC admitted 7% of ~41,000 EA applicants, Class of 2028.',
  },
  {
    // Georgia Tech Early Action (non-binding, EA I + EA II combined),
    // Class of 2028: 15.89% admit rate. Ivy Coach EA statistics tracker.
    status: 'CLOSED',
    targetId: 'cmp9pmzgd0027a85ouyfgp3k5',
    schoolId: 'cmn1htkp4000wvqf2ah317ku6',
    name: 'Georgia Institute of Technology',
    value: 15.89,
    sourceUrl: 'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/georgia-tech-early-action-admission-statistics/',
    confidence: 0.85,
    tier: 'SCRAPED',
    note: 'Early Action (non-binding, EA I + EA II combined). 15.89% admit rate, Class of 2028.',
  },
  {
    // University of Maryland, College Park — Early Action (non-binding),
    // Class of 2028: 46.6% admit rate, 41,832 EA applicants.
    status: 'CLOSED',
    targetId: 'cmp9pmzgs002ia85o9pzuag21',
    schoolId: 'cmn1htkq60019vqf2lmijsj2s',
    name: 'University of Maryland, College Park',
    value: 46.6,
    sourceUrl: 'https://www.collegetransitions.com/blog/how-to-get-into-the-university-of-maryland/',
    confidence: 0.82,
    tier: 'SCRAPED',
    note: 'Early Action (non-binding). 46.6% EA admit rate, 41,832 EA applicants, Class of 2028.',
  },
  {
    // University of Georgia — Early Action (non-binding), Class of 2028:
    // 9,000 admits / 26,760 EA applicants = 34%. College Kickstart citing
    // UGA admissions newsroom data.
    status: 'CLOSED',
    targetId: 'cmp9pn2ap01ora85o80ixlosm',
    schoolId: 'cmn1htkqf001cvqf2vdqpa1he',
    name: 'University of Georgia',
    value: 34.0,
    sourceUrl: 'https://www.collegekickstart.com/blog/item/university-of-georgia-admits-9000-early-action-applicants-to-the-class-of-2028',
    confidence: 0.9,
    tier: 'SCRAPED',
    note: 'Early Action (non-binding). 9,000/26,760 admitted = 34%, Class of 2028.',
  },
  {
    // Northeastern University — Early Action (non-binding), Class of 2028:
    // 2,640 admits / 56,000 EA applicants = 4.7%. The Huntington News
    // (Northeastern's student paper of record), widely re-reported.
    status: 'CLOSED',
    targetId: 'cmp9pn0pg00qla85otsd7z1g9',
    schoolId: 'cmnwr8im30004z0tip77mx1gm',
    name: 'Northeastern University',
    value: 4.7,
    sourceUrl: 'https://huntnewsnu.com/79113/campus/northeastern-acceptance-rate-hits-all-time-low-of-5-2-after-record-application-cycle-sees-nearly-100000-applications/',
    confidence: 0.82,
    tier: 'SCRAPED',
    note: 'Early Action (non-binding). 2,640/56,000 admitted = 4.7%, Class of 2028.',
  },

  // ── UNAVAILABLE: no non-binding early round at all (ED-only) ───────────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn29u01o7a85ohclz7mql',
    schoolId: 'cmn1htkoo000qvqf2jgkrffw1',
    name: 'Washington University in St. Louis',
    sourceUrl: 'https://admissions.wustl.edu/how-to-apply/early-decision/',
    lastError: 'No Early Action program — WashU offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0w000uqa85o615qj62m',
    schoolId: 'cmn1htkp9000yvqf29pcl812t',
    name: 'New York University',
    sourceUrl: 'https://www.nyu.edu/admissions/undergraduate-admissions/how-to-apply/all-freshmen-applicants.html',
    lastError: 'No Early Action program — NYU offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0ur00tua85oy3el35ub',
    schoolId: 'cmn1htkpl0012vqf28whnvaoj',
    name: 'Boston College',
    sourceUrl: 'https://www.bc.edu/bc-web/admission/apply/early-decision.html',
    lastError: 'No Early Action program — Boston College offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzrc009ha85o019jojwt',
    schoolId: 'cmn1htkpr0014vqf2w1o1nsyd',
    name: 'Tufts University',
    sourceUrl: 'https://admissions.tufts.edu/apply/applying-to-tufts/checklist-and-deadlines/',
    lastError: 'No Early Action program — Tufts offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzm1005za85oj2w38qnl',
    schoolId: 'cmn1htkpw0016vqf20t0lflxm',
    name: 'Boston University',
    sourceUrl: 'https://www.bu.edu/admissions/apply/early-decision/',
    lastError: 'No Early Action program — Boston University offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzq0008ma85oi36b8ts6',
    schoolId: 'cmn1htkq9001avqf25ziy94gn',
    name: 'Lehigh University',
    sourceUrl: 'https://www2.lehigh.edu/admissions/apply',
    lastError: 'No Early Action program — Lehigh offers only binding Early Decision (ED I/II).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0wf00v0a85olor7lil0',
    schoolId: 'cmnwr8ilt0000z0ticnudxg0y',
    name: 'University of Rochester',
    sourceUrl: 'https://admissions.rochester.edu/applying/dates-and-deadlines/',
    lastError: 'No Early Action program — University of Rochester offers only binding Early Decision (ED I/II).',
  },

  // ── UNAVAILABLE: no early round at all (UC single application window) ──────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzk9004ta85oy5cy5hp0',
    schoolId: 'cmn1htkor000rvqf282ibd6kz',
    name: 'University of California, Davis',
    sourceUrl: 'https://www.ucdavis.edu/admissions/undergraduate/freshman/timeline',
    lastError: 'No Early Action program — all UC campuses use a single Oct 1–Dec 1 application window with no EA/ED option.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzt500ana85okt579t2d',
    schoolId: 'cmn1htkou000svqf2356l4yfj',
    name: 'University of California, San Diego',
    sourceUrl: 'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/',
    lastError: 'No Early Action program — all UC campuses use a single Oct 1–Dec 1 application window with no EA/ED option.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzhk0033a85orphvwpi4',
    schoolId: 'cmn1htkp6000xvqf2rhj774d8',
    name: 'University of California, Irvine',
    sourceUrl: 'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/',
    lastError: 'No Early Action program — all UC campuses use a single Oct 1–Dec 1 application window with no EA/ED option.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1qi01cqa85ogp781duh',
    schoolId: 'cmn1htkpb000zvqf2645ltfg6',
    name: 'University of California, Santa Barbara',
    sourceUrl: 'https://admissions.sa.ucsb.edu/deadlines',
    lastError: 'No general Early Action program — UCSB uses the standard UC Oct 1–Dec 1 window; its only "early action" is restricted to California EOP students and publishes no round-specific admit rate.',
  },

  // ── UNAVAILABLE: no early round at all (single review window) ──────────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzl8005ea85ogjaj7t0p',
    schoolId: 'cmn1htkpu0015vqf2kumhyv3t',
    name: 'University of Washington',
    sourceUrl: 'https://admit.washington.edu/apply/dates-deadlines/',
    lastError: 'No Early Action program — UW Seattle uses a single Nov 15 application deadline with no EA/ED option; decisions made only after all applications reviewed.',
  },

  // ── UNAVAILABLE: has EA but no published round-specific admit rate ─────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn19q012ia85ono8v18hv',
    schoolId: 'cmn1htkp1000vvqf2iogfyk82',
    name: 'University of Texas at Austin',
    sourceUrl: 'https://www.collegetransitions.com/blog/how-to-get-into-ut-austin/',
    lastError: 'Has non-binding Early Action but does not publish a round-specific EA admit rate (only the overall Class of 2028 rate of 26.6% is disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn09v00j0a85owi4ptj4r',
    schoolId: 'cmn1htkpi0011vqf28xmv4but',
    name: 'University of Wisconsin-Madison',
    sourceUrl: 'https://admissions.wisc.edu/deadlines/',
    lastError: 'Has non-binding Early Action but does not publish a round-specific EA admit rate (no EA/RD breakdown in the Common Data Set or admissions data portal).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1dp014va85orhe769vn',
    schoolId: 'cmn1htkpe0010vqf2xzzjz779',
    name: 'University of Illinois Urbana-Champaign',
    sourceUrl: 'https://www.admissions.illinois.edu/apply/freshman/admit-rate',
    lastError: 'Has non-binding Early Action but does not publish round-specific EA/RD admit rates (only the overall Class of 2028 rate of ~42.4% is disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0b700jma85o3r9t30j3',
    schoolId: 'cmn1htkpo0013vqf2byqbw5mb',
    name: 'Rutgers University-New Brunswick',
    sourceUrl: 'https://admissions.rutgers.edu/apply/dates-deadlines/new-brunswick',
    lastError: 'Has non-binding Early Action but does not publish a round-specific EA admit rate (no EA acceptance data in the Common Data Set).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzun00bka85ofdn9n88t',
    schoolId: 'cmn1htkq00017vqf245v5dk2j',
    name: 'Ohio State University',
    sourceUrl: 'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/ohio-state-university-early-action-admission-statistics/',
    lastError: 'Has non-binding Early Action but does not publish a round-specific EA admit rate (Ohio State releases no EA/RD breakdown).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzwk00cha85ozjij0yik',
    schoolId: 'cmn1htkq30018vqf2xt2csyoe',
    name: 'Purdue University',
    sourceUrl: 'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/purdue-university-early-action-admission-statistics/',
    lastError: 'Has non-binding Early Action but does not publish a round-specific EA admit rate (Purdue releases EA application volume only, no EA admit count or rate).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzoq007ra85olxm5mf09',
    schoolId: 'cmnwr8ima0008z0ti358pkae1',
    name: 'University of Minnesota Twin Cities',
    sourceUrl: 'https://admissions.tc.umn.edu/competitive-admission',
    lastError: 'Has non-binding Early Action (EA I/II) but does not publish a round-specific EA admit rate (no EA/RD breakdown disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzmg0069a85ooy2x4o6r',
    schoolId: 'cmnwr8itq003pz0tirhvysbdj',
    name: 'University of Minnesota, Twin Cities',
    sourceUrl: 'https://admissions.tc.umn.edu/competitive-admission',
    lastError: 'Has non-binding Early Action (EA I/II) but does not publish a round-specific EA admit rate (no EA/RD breakdown disclosed). Duplicate school record of University of Minnesota Twin Cities.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2pp01xka85ov7c09qmz',
    schoolId: 'cmnwr8iun0041z0tin8tw3f6b',
    name: 'Villanova University',
    sourceUrl: 'https://www.villanova.edu/university/undergraduate-admission/applying-to-villanova/admission-profile.html',
    lastError: 'Has non-binding Early Action but does not publish a round-specific EA admit rate (only Early Decision and overall Class of 2028 rates are disclosed).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzzz00eka85o9xuq6kth',
    schoolId: 'cmnwr8im70006z0ti47aaywzj',
    name: 'Tulane University',
    sourceUrl: 'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/tulane-university-early-decision-action-admission-statistics/',
    lastError: 'Has non-binding Early Action but has not published a round-specific EA admit rate for the Class of 2028 (Class of 2028 EA statistics not yet released; only the Class of 2027 EA rate is on record).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0sd00sda85o99oi5cdo',
    schoolId: 'cmnwr8ilz0002z0tiwrsmrdi7',
    name: 'Case Western Reserve University',
    sourceUrl: 'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/case-western-reserve-early-decision-early-action-admission-statistics/',
    lastError: 'Has non-binding Early Action but has not published a round-specific EA admit rate for the Class of 2028 (Class of 2028 EA statistics not released; only the Class of 2027 EA rate is on record).',
  },

  // ── UNAVAILABLE: early round restricted to a sub-population, no rate ───────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0wu00vaa85oci1wzzaq',
    schoolId: 'cmn1htkqc001bvqf22zfkx827',
    name: 'Texas A&M University',
    sourceUrl: 'https://admissions.tamu.edu/apply/freshman',
    lastError: 'No general Early Action program — Texas A&M offers Early Action only to College of Engineering applicants and publishes no round-specific EA admit rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0g800lya85onldip22i',
    schoolId: 'cmn1htkqj001dvqf2n8mczcpn',
    name: 'Wake Forest University',
    sourceUrl: 'https://admissions.wfu.edu/apply/',
    lastError: 'No general Early Action program — Wake Forest offers Early Action only to first-generation college applicants and publishes no round-specific EA admit rate.',
  },
];

function isClosed(t: BatchTarget): t is ClosedTarget {
  return t.status === 'CLOSED';
}

async function main() {
  const closed = BATCH.filter(isClosed);
  console.log(
    `[closure-v2-ea-agent-3] batch=${BATCH.length}  CLOSED=${closed.length}  ` +
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
    `\n[closure-v2-ea-agent-3] done. ${schoolsUpdated} school rows updated, ` +
      `${targetsUpdated} closure targets updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-ea-agent-3] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
