/**
 * collect-oos-rate.ts
 *
 * closure-v2 data-collection agent output.
 *
 * Writes REAL, source-verified `School.oosAcceptanceRate` values for the
 * remaining 26-school batch of `ClosureTarget` rows
 * (field = 'oosAcceptanceRate', status = PENDING).
 *
 * Semantics of oosAcceptanceRate (PUBLIC universities only):
 *   number → an authoritative source explicitly publishes a freshman admit
 *            rate for OUT-OF-STATE (non-resident domestic) applicants, split
 *            from in-state. Range gate: 1–95%.
 *   null   → the school does NOT publish a residency-split freshman admit rate
 *            (the overwhelmingly common case — most US publics report only a
 *            single combined admit rate; their CDS Section C1 residency
 *            columns are left blank) → row left NULL, target → UNAVAILABLE.
 *
 * Key finding for this batch: of 26 public universities researched, only the
 * University of California system publishes campus-level freshman admit rates
 * split by residency (CA resident / domestic out-of-state / international) via
 * the UC systemwide Information Center. Every other public in this batch
 * publishes only a combined rate — including the University of Michigan, whose
 * 2024-25 Common Data Set C1 table has the In-State / Out-of-State /
 * International columns physically blank (only the Total row is filled in).
 * Widely-circulated "out-of-state admit rate" numbers for those schools are
 * third-party estimates, not institution-published figures, so they are NOT
 * written here.
 *
 * Every target in the batch gets its ClosureTarget row updated:
 *   CLOSED      → oosAcceptanceRate written + provenance merged into metadata
 *   UNAVAILABLE → oosAcceptanceRate left NULL (no residency-split rate published)
 *   FAILED      → could not determine (none in this batch)
 *
 * ClosureTarget is a DB-only table (not in schema.prisma → not on the Prisma
 * client), so its rows are updated via $executeRaw. School rows use the typed
 * client. metadata.provenance.oosAcceptanceRate is MERGED — other keys
 * preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-oos-rate.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-oos-agent';

type Tier = 'OFFICIAL' | 'SCRAPED';

interface ClosedTarget {
  status: 'CLOSED';
  targetId: string;
  schoolId: string;
  name: string;
  value: number; // out-of-state freshman admit rate %
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
 * Full 26-school batch. Each UNAVAILABLE entry's `lastError` records WHY no
 * out-of-state admit rate could be written (school publishes no
 * residency-split freshman admit rate).
 */
const BATCH: BatchTarget[] = [
  // ── CLOSED: credible, institution-published OOS freshman admit rate ────────
  {
    // UC Merced, Fall 2025 freshman admit rate for out-of-state (domestic
    // non-resident) applicants = 87.1%. The University of California publishes
    // campus-level admit rates split by residency via its systemwide
    // Information Center; this figure (Fall 2024: 85.3%, Fall 2025: 87.1%) is
    // compiled from that official UC source. Within the 1–95% range gate.
    status: 'CLOSED',
    targetId: 'cmp9pn0xd00vma85onsohfuam',
    schoolId: 'cmnwr8imp000gz0tibbuqx67l',
    name: 'University of California, Merced',
    value: 87.1,
    sourceUrl:
      'https://www.universityofcalifornia.edu/about-us/information-center/freshman-admissions-summary',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'Fall 2025 out-of-state (domestic non-resident) freshman admit rate, per UC systemwide Information Center residency-split admit data.',
  },

  // ── UNAVAILABLE: no residency-split freshman admit rate published ──────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn02500fsa85oaarjqy5d',
    schoolId: 'cmn1htkoa000kvqf2oqm36hw5',
    name: 'University of Michigan, Ann Arbor',
    sourceUrl: 'https://obp.umich.edu/wp-content/uploads/pubdata/cds/CDS_2024-25_UMAA.pdf',
    lastError:
      '2024-25 Common Data Set Section C1 In-State / Out-of-State / International columns are blank — UMich publishes only a combined first-year admit rate. The widely-cited "~18% out-of-state" figure is a third-party estimate, not institution-published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn00000ela85olmahh40z',
    schoolId: 'cmnwr8im70006z0ti47aaywzj',
    name: 'Tulane University',
    sourceUrl: 'https://admission.tulane.edu/apply/getting-into-tulane/new-class-profile',
    lastError:
      'Tulane is a PRIVATE university — out-of-state freshman admit rate is not a meaningful residency metric and Tulane publishes no residency-split admit rate (charges identical tuition regardless of residency).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1vp01fta85orhxcsqxt',
    schoolId: 'cmnwr8ilx0001z0tilru6b1th',
    name: 'William & Mary',
    sourceUrl: 'https://www.wm.edu/admission/undergraduateadmission/facts-figures/',
    lastError:
      'W&M Facts & Figures publishes a single Class of 2029 acceptance rate (37%) applied to in-state and out-of-state alike — it does not publish a Virginia-residency-split admit rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn03800gda85opqrb5pg6',
    schoolId: 'cmnwr8imj000dz0tif3r9fq0l',
    name: 'University of Connecticut',
    sourceUrl: 'https://www.collegevine.com/faq/27748/what-s-uconn-s-out-of-state-acceptance-rate',
    lastError:
      'UConn publishes no residency-split freshman admit rate. Third-party sites circulate a "44.94% in-state / 56.23% non-resident" pair, but it is not traceable to a UConn CDS/IR publication and is internally inconsistent with other reported figures — not credible enough to close.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn20o01iqa85o2ql4th6h',
    schoolId: 'cmnwr8im90007z0ti2n04hf3n',
    name: 'University of Pittsburgh',
    sourceUrl: 'https://admissions.pitt.edu/first-year-student/class-profile/',
    lastError:
      'Pitt publishes only a combined first-year admit rate (~58%); it does not release admit rate split by Pennsylvania residency.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2oq01wza85omb1b7af6',
    schoolId: 'cmnwr8ime000az0ti9ts1sd20',
    name: 'Colorado School of Mines',
    sourceUrl: 'https://www.acceptancerate.com/schools/colorado-school-of-mines',
    lastError:
      'Mines publishes only a combined admit rate (~58–61%); no residency-split freshman admit rate is published, and IPEDS does not disaggregate admit rate by residency.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1r501d2a85onlx3i8zk',
    schoolId: 'cmnwr8ini000wz0ti57rv9m9o',
    name: 'Auburn University',
    sourceUrl: 'https://www.auburn.edu/admissions/prospective-students/freshmen/index.php',
    lastError:
      'Auburn publishes only a combined acceptance rate (~46%); it does not release a separate out-of-state freshman admit rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn04n00gza85ox7czacx2',
    schoolId: 'cmnwr8int0013z0tiqysdv07w',
    name: 'University of Oregon',
    sourceUrl: 'https://admissions.uoregon.edu/uo-facts',
    lastError:
      'University of Oregon publishes only a combined acceptance rate; it does not release admit rate split by Oregon residency.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmztm00aza85oelnhxazk',
    schoolId: 'cmnwr8ip7001nz0ti6qy76djw',
    name: 'University of Missouri',
    sourceUrl: 'https://admissions.missouri.edu/apply/freshmen/',
    lastError:
      'Mizzou publishes only a combined acceptance rate (~78%); no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn21701j1a85o5ks63jnz',
    schoolId: 'cmnwr8ip1001lz0ti51lr5gad',
    name: 'University of Alabama',
    sourceUrl: 'https://admissions.ua.edu/faqs/',
    lastError:
      'University of Alabama publishes only a combined acceptance rate (~76–80%); it does not release a separate out-of-state freshman admit rate.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn16o010qa85oiqkptykw',
    schoolId: 'cmnwr8ipv001vz0tiqnippgu6',
    name: 'Colorado State University',
    sourceUrl: 'https://bigfuture.collegeboard.org/colleges/colorado-state-university/admissions',
    lastError:
      'CSU publishes only a combined acceptance rate (~89%); no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn22901jma85orfhxaf8p',
    schoolId: 'cmnwr8iq2001zz0tiix4lbz86',
    name: 'University of Houston',
    sourceUrl: 'https://www.uh.edu/undergraduate-admissions/apply/incoming-freshman/',
    lastError:
      'University of Houston publishes only a combined acceptance rate (~74%); no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1fk0163a85oufm7ymtj',
    schoolId: 'cmnwr8iq70021z0titshta238',
    name: 'University of Hawaii at Manoa',
    sourceUrl: 'https://manoa.hawaii.edu/admissions/freshman/',
    lastError:
      'UH Manoa publishes only a combined acceptance rate; no institution-published residency-split freshman admit rate exists (third-party "65–70% out-of-state" is a vague estimate range, not a published figure).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2da01qaa85okzwljxd6',
    schoolId: 'cmnwr8irj002nz0tief4railh',
    name: 'University of Nevada, Reno',
    sourceUrl: 'https://www.collegevine.com/schools/university-of-nevada-reno',
    lastError:
      'UNR publishes only a combined acceptance rate (~74%); no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0re00rsa85ocy014j12',
    schoolId: 'cmnwr8ird002kz0tifunyipf1',
    name: 'University of North Dakota',
    sourceUrl: 'https://www.usnews.com/best-colleges/university-of-north-dakota-3005/applying',
    lastError:
      'UND publishes only a combined acceptance rate (~77%); no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn12900yma85ohhkmknu5',
    schoolId: 'cmnwr8irv002uz0tic1bpn6g4',
    name: 'Bowling Green State University',
    sourceUrl: 'https://waf.collegedata.com/college-search/bowling-green-state-university/admission',
    lastError:
      'BGSU publishes only a combined acceptance rate (~81%); no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2et01r7a85oh5kbdwbs',
    schoolId: 'cmnwr8is4002zz0ti7l7rukwt',
    name: 'South Dakota State University',
    sourceUrl: 'https://bigfuture.collegeboard.org/colleges/south-dakota-state-university/admissions',
    lastError:
      'SDSU publishes only a combined acceptance rate (~86–98%); no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1jt018fa85oij1wjzo0',
    schoolId: 'cmnwr8is60030z0timvbtgjwa',
    name: 'University of Akron',
    sourceUrl: 'https://www.collegedata.com/college-search/university-of-akron/admission',
    lastError:
      'University of Akron publishes only a combined acceptance rate (~73%); no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn23w01kha85o9079z8sm',
    schoolId: 'cmnwr8ish0036z0tiy3l6tt76',
    name: 'California State University, Northridge',
    sourceUrl: 'https://www.usnews.com/best-colleges/california-state-university-northridge-1153',
    lastError:
      'CSUN publishes only a combined acceptance rate (~92%); the CSU system does not publish campus-level freshman admit rate split by California residency.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzxi00d3a85oji4jqhtk',
    schoolId: 'cmnwr8isj0037z0tihc4cw8ue',
    name: 'University of Southern Mississippi',
    sourceUrl: 'https://www.collegedata.com/college-search/university-of-southern-mississippi/admission',
    lastError:
      'USM publishes only a combined acceptance rate (~97–99%); no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzy000dea85o5uojcv04',
    schoolId: 'cmnwr8isv003ez0timrhbjznd',
    name: 'University of Memphis',
    sourceUrl: 'https://www.memphis.edu/admissions/basics/value.php',
    lastError:
      'University of Memphis publishes only a combined acceptance rate; no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0ih00n5a85o6t1sq8q8',
    schoolId: 'cmnwr8isu003dz0tijwn1m0s0',
    name: 'University of Texas at Arlington',
    sourceUrl: 'https://bigfuture.collegeboard.org/colleges/university-of-texas-at-arlington/admissions',
    lastError:
      'UT Arlington publishes only a combined acceptance rate (~80%); no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn25b01lca85oxbcjfqez',
    schoolId: 'cmnwr8iss003cz0tia71q9qy1',
    name: 'Idaho State University',
    sourceUrl: 'https://www.isu.edu/pa/admission/admission-statistics/',
    lastError:
      'Idaho State has an effectively open-admission policy and publishes only a combined admit rate; no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn14m00zua85oapgn93ti',
    schoolId: 'cmnwr8itk003mz0tirfyu068c',
    name: 'Central Michigan University',
    sourceUrl: 'https://www.usnews.com/best-colleges/central-michigan-university-2243/applying',
    lastError:
      'CMU publishes only a combined acceptance rate (~90%); no residency-split freshman admit rate is published.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1uq01f7a85ozfjhma2x',
    schoolId: 'cmnwr8itm003nz0tiqazikwxi',
    name: 'Indiana University-Purdue University Indianapolis',
    sourceUrl: 'https://www.collegesimply.com/colleges/indiana/indiana-university-purdue-university-indianapolis/admission/',
    lastError:
      'IU Indianapolis (formerly IUPUI) publishes only a combined acceptance rate (~76–81%); no residency-split freshman admit rate is published.',
  },
];

function isClosed(t: BatchTarget): t is ClosedTarget {
  return t.status === 'CLOSED';
}

async function main() {
  const closed = BATCH.filter(isClosed);
  console.log(
    `[closure-v2-oos-agent] batch=${BATCH.length}  CLOSED=${closed.length}  ` +
      `UNAVAILABLE=${BATCH.filter((t) => t.status === 'UNAVAILABLE').length}  ` +
      `FAILED=${BATCH.filter((t) => t.status === 'FAILED').length}  (fetchedAt=${FETCHED_AT})\n`,
  );

  // Range gate guard — fail loudly rather than write a bad number.
  for (const t of closed) {
    if (t.value < 1 || t.value > 95) {
      throw new Error(
        `Range gate violation: ${t.name} oosAcceptanceRate=${t.value} (must be 1–95)`,
      );
    }
  }

  let schoolsUpdated = 0;
  let targetsUpdated = 0;

  for (const t of BATCH) {
    // 1) For CLOSED: write School.oosAcceptanceRate + merge provenance.
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
            oosAcceptanceRate: {
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
            oosAcceptanceRate: new Prisma.Decimal(t.value),
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
    `\n[closure-v2-oos-agent] done. ${schoolsUpdated} school rows updated, ` +
      `${targetsUpdated} closure targets updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-oos-agent] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
