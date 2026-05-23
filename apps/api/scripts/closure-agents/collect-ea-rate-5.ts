/**
 * collect-ea-rate-5.ts
 *
 * closure-v2 data-collection agent output (batch 5).
 *
 * Writes REAL, source-verified `School.eaAcceptanceRate` values for a 40-school
 * batch of `ClosureTarget` rows (field = 'eaAcceptanceRate', status = PENDING).
 *
 * Semantics of eaAcceptanceRate:
 *   number → an authoritative source explicitly publishes a single-early-round,
 *            NON-binding (EA / REA / SCEA) admit rate. Range gate: 1–90%.
 *   null   → school either has NO non-binding early round (ED-only / rolling /
 *            no early round / priority-deadline / UC-CSU systems) OR has such a
 *            round but publishes no round-specific admit rate → row left NULL,
 *            target → UNAVAILABLE.
 *
 * Every target in the batch gets its ClosureTarget row updated:
 *   CLOSED      → eaAcceptanceRate written + provenance merged into metadata
 *   UNAVAILABLE → eaAcceptanceRate left NULL (no EA program, or no published rate)
 *   FAILED      → could not determine (none in this batch)
 *
 * Outcome of batch 5: 0 CLOSED, 40 UNAVAILABLE, 0 FAILED. No school in this
 * batch publishes an authoritative round-specific non-binding EA admit rate.
 * Third-party aggregators (Niche/USNews/Clastify) surface an "early acceptance
 * rate" for several schools (WPI, Temple, USF, Illinois Tech, Denver), but
 * these are estimates, are not published by the institutions as EA-specific
 * round rates, and the Common Data Set sections C21/C22 are Yes/No-only and
 * carry no EA applicant/admit counts. Per the strict semantics above, those
 * schools are UNAVAILABLE rather than CLOSED.
 *
 * ClosureTarget is a DB-only table (not in schema.prisma → not on the Prisma
 * client), so its rows are updated via $executeRaw. School rows use the typed
 * client. metadata.provenance.eaAcceptanceRate is MERGED — other keys preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-ea-rate-5.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-ea-agent-5';

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
 * Full 40-school batch. Each non-CLOSED entry's `lastError` records WHY no
 * EA rate exists (no non-binding early round, rolling/priority-deadline
 * admission, UC/CSU system, ED-only, or round exists but no published
 * round-specific rate). EA here = a general non-binding early round (EA / REA
 * / SCEA).
 */
const BATCH: BatchTarget[] = [
  // ── UNAVAILABLE: has non-binding EA but no published round-specific rate ────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn28k01nda85owzvfadbw',
    schoolId: 'cmnwr8ity003tz0tie2nazej1',
    name: 'American University',
    sourceUrl: 'https://www.american.edu/admissions/first-year/decision-plans-and-deadlines.cfm',
    lastError: 'Has non-binding Early Action (introduced in the 2024-25 cycle) but does not publish a round-specific EA admit rate — only Early Decision and overall rates are disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2hp01t0a85o6cgs0kgh',
    schoolId: 'cmnwr8iu0003uz0ti43l07p17',
    name: 'Worcester Polytechnic Institute',
    sourceUrl: 'https://www.wpi.edu/admissions/undergraduate/apply/application-options',
    lastError: 'Has non-binding Early Action (two rounds) but does not publish a round-specific EA admit rate; Common Data Set C22 is Yes/No-only and carries no EA applicant/admit counts. Third-party "early acceptance rate" figures conflict (Niche 68.9%, others 64.5%).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1ib017ia85obvkluw8u',
    schoolId: 'cmnwr8iuf003zz0ti12pe3iq1',
    name: 'University of San Diego',
    sourceUrl: 'https://www.sandiego.edu/admission-and-aid/undergraduate/apply/',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — only an overall acceptance rate is disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0dv00ksa85oiu6c2qiw',
    schoolId: 'cmnwr8iud003yz0tinuqfaa54',
    name: 'University of Denver',
    sourceUrl: 'https://www.du.edu/forthedifference/apply-early',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate; CollegeData and other sources report only an overall rate, with no EA/RD breakdown.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn10o00xoa85ohhc2ztr2',
    schoolId: 'cmnwr8inq0011z0tims8lt244',
    name: 'Temple University',
    sourceUrl: 'https://admissions.temple.edu/apply/first-year-students',
    lastError: 'Has non-binding Early Action (confirmed in Temple Common Data Set C22) but does not publish a round-specific EA admit rate; CDS C22 carries no EA applicant/admit counts and third-party EA figures are estimates only.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn10700xea85osgkfo2f4',
    schoolId: 'cmnwr8ink000xz0tivm4enckb',
    name: 'Drexel University',
    sourceUrl: 'https://drexel.edu/admissions/apply/undergrad-instructions/first-year-instructions/early-decision-early-action',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2oo01wya85oox9lb0jf',
    schoolId: 'cmnwr8ime000az0ti9ts1sd20',
    name: 'Colorado School of Mines',
    sourceUrl: 'https://www.mines.edu/undergraduate-admissions/apply/',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — only an overall acceptance rate is disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn02n00g2a85ouhokqwn5',
    schoolId: 'cmnwr8iu6003wz0tio3oagiri',
    name: 'Rochester Institute of Technology',
    sourceUrl: 'https://www.rit.edu/admissions/first-year-application',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — only an overall acceptance rate is disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzw500c6a85otn7w8xpa',
    schoolId: 'cmnwr8inn000zz0tihkfqe5yc',
    name: 'University of Arizona',
    sourceUrl: 'https://www.arizona.edu/admissions/first-year/deadlines',
    lastError: 'Has non-binding Early Action (new EA model replacing rolling admission, ~25,000 EA decisions released for fall 2026) but does not publish a round-specific EA admit rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1pk01c6a85ob5182aez',
    schoolId: 'cmnwr8inb000sz0ti3r4uwfjt',
    name: 'Illinois Institute of Technology',
    sourceUrl: 'https://www.iit.edu/admissions-aid/undergraduate-admission/application-dates-and-deadlines',
    lastError: 'Has non-binding Early Action (Nov 15 deadline) but does not publish a round-specific EA admit rate; the "early acceptance rate" figure is a third-party estimate, not an institution-published EA rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1en015ha85o0n3m76dm',
    schoolId: 'cmnwr8iua003xz0tio2zj4a4z',
    name: 'Saint Louis University',
    sourceUrl: 'https://www.slu.edu/admission/freshman/deadlines.php',
    lastError: 'Has non-binding Early Action (Dec 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0kw00ola85o2jz654f2',
    schoolId: 'cmnwr8iu3003vz0tig0fa53lf',
    name: 'Howard University',
    sourceUrl: 'https://admission.howard.edu/undergraduate/first-year',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzso00aca85oznc2spoz',
    schoolId: 'cmnwr8io7001bz0tihu5wo9mh',
    name: 'Rutgers University-Newark',
    sourceUrl: 'https://admissions.rutgers.edu/apply/dates-deadlines/newark',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — only an overall acceptance rate is disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1r301d1a85o7ockp2ef',
    schoolId: 'cmnwr8ini000wz0ti57rv9m9o',
    name: 'Auburn University',
    sourceUrl: 'https://onthelawn.auburn.edu/2025/10/17/fall-2026-freshmen-admissions-process-dates-deadlines-decision-types-and-next-steps/',
    lastError: 'Has non-binding Early Action (multiple EA deadlines) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1iq017sa85orktbo6ep',
    schoolId: 'cmnwr8inv0014z0ti6jqhq1ga',
    name: 'University of South Carolina',
    sourceUrl: 'https://sc.edu/about/offices_and_divisions/undergraduate_admissions/apply/for_freshmen/',
    lastError: 'Has non-binding Early Action (Oct 15 deadline, introduced fall 2022) but does not publicly disclose a round-specific EA admit rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1c7013ya85o2tkp33wh',
    schoolId: 'cmnwr8iob001dz0ti3go71xpz',
    name: 'University of Utah',
    sourceUrl: 'https://admissions.utah.edu/apply/freshman-students/',
    lastError: 'Has a non-binding Early Action / merit-scholarship priority deadline (Dec 1) but does not publish a round-specific EA admit rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn04l00gya85ozh9yupur',
    schoolId: 'cmnwr8int0013z0tiqysdv07w',
    name: 'University of Oregon',
    sourceUrl: 'https://admissions.uoregon.edu/freshmen/deadlines',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzrs009ra85omm383n0t',
    schoolId: 'cmnwr8iol001gz0ticdgvwjkf',
    name: 'University of San Francisco',
    sourceUrl: 'https://www.usfca.edu/admission/undergraduate/early-decision-early-action-regular-decision',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate; the "early acceptance rate" figure is a third-party estimate, not an institution-published EA rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1xm01gza85o9yafzjpc',
    schoolId: 'cmnwr8ioi001fz0tivlt104p7',
    name: 'Seton Hall University',
    sourceUrl: 'https://www.shu.edu/undergraduate-admissions/application-checklist.html',
    lastError: 'Has non-binding Early Action (EA I/II) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn15z010fa85opo6ang6e',
    schoolId: 'cmnwr8ioe001ez0tii04p5pvd',
    name: 'DePaul University',
    sourceUrl: 'https://www.depaul.edu/admission/undergraduate-admission/early-action-program-faq',
    lastError: 'Has non-binding Early Action (Nov 15 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn05e00h9a85oncidppq5',
    schoolId: 'cmnwr8ior001iz0tibsba6d2o',
    name: 'University of Kentucky',
    sourceUrl: 'https://admission.uky.edu/apply',
    lastError: 'Has a non-binding Early Action track (Dec 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1j70183a85os8nqik7k',
    schoolId: 'cmnwr8iou001jz0tig866z8pb',
    name: 'San Diego State University',
    sourceUrl: 'https://admissions.sdsu.edu/apply',
    lastError: 'No non-binding Early Action program — SDSU is a CSU campus and admits via the Cal State Apply Regular Decision cycle with no general EA round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0f100lca85oj4oegwqe',
    schoolId: 'cmnwr8io8001cz0tivir7q6ki',
    name: 'University of Kansas',
    sourceUrl: 'https://admissions.ku.edu/early-action',
    lastError: 'Has non-binding Early Action (Dec 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0eh00l2a85owqmn1av3',
    schoolId: 'cmnwr8ioy001kz0ti85qspr1l',
    name: 'The New School',
    sourceUrl: 'https://www.newschool.edu/admission/prospective-undergraduate-students/early-application-options/',
    lastError: 'Has non-binding Early Action (Nov 10 deadline) but does not publish a round-specific EA admit rate; the school explicitly states no preference is given to early applicants.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzu100b9a85ozy60tomi',
    schoolId: 'cmnwr8ip3001mz0til7q2dopw',
    name: 'University of Oklahoma',
    sourceUrl: 'https://www.ou.edu/admissions/apply/early-action-admission-deadline',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1ym01hka85oyiex9e6j',
    schoolId: 'cmnwr8ipa001oz0tionb7y3gm',
    name: 'Loyola University Chicago',
    sourceUrl: 'https://www.luc.edu/undergrad/admissions/first-yearstudents/',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzs800a1a85obrms1y6g',
    schoolId: 'cmnwr8ipf001qz0ti3d3001d9',
    name: 'University of Tennessee',
    sourceUrl: 'https://admissions.utk.edu/important-dates-and-deadlines/',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn11700xza85oom2b6scc',
    schoolId: 'cmnwr8ipr001tz0ti8x7z840u',
    name: 'University of New Hampshire',
    sourceUrl: 'https://admissions.unh.edu/apply/first-year',
    lastError: 'Has non-binding Early Action (Nov 15 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0pw00qva85oqqgb1x54',
    schoolId: 'cmnwr8ipx001wz0timhlbfii2',
    name: 'University of Vermont',
    sourceUrl: 'https://catalogue.uvm.edu/undergraduate/admissioninfo/admissionsprograms/',
    lastError: 'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },

  // ── UNAVAILABLE: no non-binding early round at all (UC/CSU system) ──────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn07400hva85ogqpzgn6k',
    schoolId: 'cmnwr8io40019z0ti0z11pe98',
    name: 'University of California, Riverside',
    sourceUrl: 'https://admissions.ucr.edu/firstyear',
    lastError: 'No Early Action program — UC Riverside, like all University of California campuses, admits only via the single UC Regular Decision cycle (Oct 1–Dec 1 filing period).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0iy00nfa85o82hu1int',
    schoolId: 'cmnwr8io5001az0tibgs1vu54',
    name: 'University of California, Santa Cruz',
    sourceUrl: 'https://admissions.ucsc.edu/first-year-student',
    lastError: 'No Early Action program — UC Santa Cruz, like all University of California campuses, admits only via the single UC Regular Decision cycle.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0xa00vla85oncy05mvo',
    schoolId: 'cmnwr8imp000gz0tibbuqx67l',
    name: 'University of California, Merced',
    sourceUrl: 'https://admissions.ucmerced.edu/apply',
    lastError: 'No Early Action program — UC Merced, like all University of California campuses, admits only via the single UC Regular Decision cycle.',
  },

  // ── UNAVAILABLE: no non-binding early round (ED-only) ──────────────────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0oi00q0a85oe81sdcvq',
    schoolId: 'cmnwr8ioo001hz0tim3isqwz9',
    name: 'Clarkson University',
    sourceUrl: 'https://www.clarkson.edu/apply',
    lastError: 'No Early Action program — Clarkson offers only binding Early Decision (Dec 1) alongside Regular Decision (Jan 15) for first-year applicants.',
  },

  // ── UNAVAILABLE: no early round (rolling / priority-deadline admission) ─────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1gv016xa85otcc1tbvj',
    schoolId: 'cmnwr8inp0010z0tivwogzepz',
    name: 'University of South Florida',
    sourceUrl: 'https://www.usf.edu/admissions/freshman/',
    lastError: 'No Early Action program — USF does not offer EA or ED; all first-year applicants are reviewed in a single Regular Decision cycle.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmztk00aya85oan03yc7s',
    schoolId: 'cmnwr8ip7001nz0ti6qy76djw',
    name: 'University of Missouri',
    sourceUrl: 'https://admissions.missouri.edu/apply/dates-deadlines/',
    lastError: 'No Early Action program — Mizzou uses rolling admission with a Dec 1 scholarship priority date, no EA/ED option.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn21601j0a85or3otobes',
    schoolId: 'cmnwr8ip1001lz0ti51lr5gad',
    name: 'University of Alabama',
    sourceUrl: 'https://admissions.ua.edu/apply/',
    lastError: 'No Early Action program — the University of Alabama uses rolling admission with a Dec 5 scholarship priority deadline, no EA/ED option.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzdx000qa85osz077aqm',
    schoolId: 'cmnwr8inx0015z0tix5dndhpi',
    name: 'Arizona State University',
    sourceUrl: 'https://admission.asu.edu/apply/first-year',
    lastError: 'No Early Action program — ASU uses rolling review with a Nov 1 priority date and Jan 15 regular date, no EA/ED option.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn17n011ba85obiq007b9',
    schoolId: 'cmnwr8iwx0059z0tilcfiwj80',
    name: 'University of Texas at Dallas',
    sourceUrl: 'https://enroll.utdallas.edu/freshman/deadlines-and-fees/',
    lastError: 'No general non-binding Early Action program — UT Dallas reviews applications on a priority-deadline holistic basis with no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn12t00ywa85obe5a85b3',
    schoolId: 'cmnwr8ipc001pz0tiz0bgth66',
    name: 'Iowa State University',
    sourceUrl: 'https://www.iastate.edu/admission-and-aid/admissions/first-year-students/first-year-checklist',
    lastError: 'No Early Action program — Iowa State uses rolling admission with no EA/ED option (the CAP program is a separate junior-year early-indication tool).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1ao0133a85oyttc3gxl',
    schoolId: 'cmnwr8ipj001rz0tipapk15or',
    name: 'University of Nebraska-Lincoln',
    sourceUrl: 'https://admissions.unl.edu/apply/first-year-dates-deadlines/',
    lastError: 'No named non-binding Early Action plan — UNL uses a Nov 1 priority deadline within a rolling-style admission cycle, no EA/ED round.',
  },
];

function isClosed(t: BatchTarget): t is ClosedTarget {
  return t.status === 'CLOSED';
}

async function main() {
  const closed = BATCH.filter(isClosed);
  console.log(
    `[closure-v2-ea-agent-5] batch=${BATCH.length}  CLOSED=${closed.length}  ` +
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
    `\n[closure-v2-ea-agent-5] done. ${schoolsUpdated} school rows updated, ` +
      `${targetsUpdated} closure targets updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-ea-agent-5] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
